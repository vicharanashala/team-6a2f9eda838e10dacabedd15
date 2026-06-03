const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const { AppError } = require('../middleware/errorHandler');
const { paginate, buildPaginationMeta } = require('../utils/helpers');
const { getDashboardStats, getUserAnalytics, getGlobalFAQAnalytics } = require('../services/analyticsService');
const { banUser, unbanUser } = require('../services/moderationService');
const { getRedis } = require('../config/redis');

exports.getDashboard = async (req, res, next) => {
  try {
    const stats = await getDashboardStats();
    res.json({ stats });
  } catch (err) {
    next(err);
  }
};

exports.getUserAnalytics = async (req, res, next) => {
  try {
    const data = await getUserAnalytics();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

exports.getGlobalFAQAnalytics = async (req, res, next) => {
  try {
    const data = await getGlobalFAQAnalytics();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    try {
      const { syncGoogleUsers } = require('../services/syncService');
      // Execute syncGoogleUsers in the background to avoid blocking the request
      syncGoogleUsers().catch(syncErr => {
        console.error('Failed to sync Google users in background:', syncErr.message);
      });
    } catch (syncErr) {
      console.error('Failed to require/invoke syncGoogleUsers:', syncErr.message);
    }

    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.search) {
      filter.$or = [
        { username: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-password')
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ users, pagination: buildPaginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'moderator', 'admin'].includes(role)) {
      throw new AppError('Invalid role', 400);
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) throw new AppError('User not found', 404);

    // If promoted to moderator or admin, send email notification
    if (role === 'moderator' || role === 'admin') {
      try {
        const { sendRolePromotionEmail } = require('../services/emailService');
        await sendRolePromotionEmail(user, role);
      } catch (emailErr) {
        console.error('Failed to send promotion email:', emailErr.message);
      }
    }

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'update_role', userId: user._id, role });
      const { broadcastLeaderboard } = require('../services/leaderboardService');
      await broadcastLeaderboard();
    } catch (err) {
      console.error('Socket notification error in updateUserRole:', err.message);
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.banUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    await banUser({ userId: req.params.id, reason: reason || 'Violation of terms' });

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'ban_user', userId: req.params.id });
      const { broadcastLeaderboard } = require('../services/leaderboardService');
      await broadcastLeaderboard();
    } catch (err) {
      console.error('Socket notification error in banUser:', err.message);
    }

    res.json({ message: 'User banned' });
  } catch (err) {
    next(err);
  }
};

exports.unbanUser = async (req, res, next) => {
  try {
    await unbanUser(req.params.id);

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'unban_user', userId: req.params.id });
      const { broadcastLeaderboard } = require('../services/leaderboardService');
      await broadcastLeaderboard();
    } catch (err) {
      console.error('Socket notification error in unbanUser:', err.message);
    }

    res.json({ message: 'User unbanned' });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    console.log(`[Admin Action] Deleting user ${user.username} (${user.email}) completely.`);

    // Find all answers of the user before deleting to update parent question counts
    const Answer = require('../models/Answer');
    const userAnswers = await Answer.find({ author: userId });
    const questionIds = [...new Set(userAnswers.map(a => a.question.toString()))];

    // Cascading deletion
    await Promise.all([
      Question.deleteMany({ author: userId }),
      Answer.deleteMany({ author: userId }),
      User.deleteOne({ _id: userId })
    ]);

    const { recalculateAnswerCount } = require('../utils/helpers');
    for (const qId of questionIds) {
      await recalculateAnswerCount(qId);
    }

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'delete_user', userId });
      const { broadcastLeaderboard } = require('../services/leaderboardService');
      await broadcastLeaderboard();
    } catch (err) {
      console.error('Socket notification error in deleteUser:', err.message);
    }

    res.json({ success: true, message: 'User and all related data deleted successfully' });
  } catch (err) {
    next(err);
  }
};

exports.getFlaggedContent = async (req, res, next) => {
  try {
    const [flaggedQuestions, flaggedAnswers] = await Promise.all([
      Question.find({
        $or: [
          { isFlagged: true },
          { visibility: 'pending' }
        ],
        isDeleted: false
      })
        .populate('author', 'username displayName')
        .populate('flaggedBy', 'username')
        .select('title body visibility isFlagged flagReason createdAt')
        .lean(),
      Answer.find({
        $or: [
          { isFlagged: true },
          { visibility: 'pending' }
        ],
        isDeleted: false
      })
        .populate('author', 'username displayName')
        .populate('flaggedBy', 'username')
        .select('body visibility isFlagged flagReason createdAt')
        .lean(),
    ]);

    res.json({ flaggedQuestions, flaggedAnswers });
  } catch (err) {
    next(err);
  }
};

exports.getAnomalies = async (req, res, next) => {
  try {
    const { severity, status, sortBy = 'time', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { anomalySeverity: { $in: ['high', 'medium', 'low'] } };
    
    if (severity && severity !== 'all') {
      filter.anomalySeverity = severity;
    }
    
    if (status === 'resolved') {
      filter.anomalyResolvedAt = { $ne: null };
    } else if (status === 'unresolved') {
      filter.anomalyResolvedAt = null;
    }

    const sort = {};
    if (sortBy === 'severity') {
      sort.anomalyScore = -1;
    } else {
      sort.createdAt = -1;
    }

    const [anomalies, total] = await Promise.all([
      Question.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author', 'username displayName email')
        .populate('anomalyResolvedBy', 'username displayName')
        .lean(),
      Question.countDocuments(filter)
    ]);

    const resolvedStats = await Question.aggregate([
      { 
        $match: { 
          anomalySeverity: { $in: ['high', 'medium', 'low'] },
          anomalyResolvedAt: { $ne: null } 
        } 
      },
      {
        $group: {
          _id: '$anomalySeverity',
          count: { $sum: 1 },
          totalMs: { $sum: { $subtract: ['$anomalyResolvedAt', '$createdAt'] } }
        }
      }
    ]);

    const avgResolutionTimes = {
      high: 0,
      medium: 0,
      low: 0
    };

    resolvedStats.forEach(stat => {
      const avgMinutes = stat.count > 0 ? Math.round(stat.totalMs / (1000 * 60) / stat.count) : 0;
      avgResolutionTimes[stat._id] = avgMinutes;
    });

    const openHighCount = await Question.countDocuments({ anomalySeverity: 'high', anomalyResolvedAt: null });
    const openMediumCount = await Question.countDocuments({ anomalySeverity: 'medium', anomalyResolvedAt: null });

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const trendStats = await Question.aggregate([
      {
        $match: {
          anomalySeverity: { $in: ['high', 'medium', 'low'] },
          createdAt: { $gte: fourWeeksAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%U', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      anomalies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        openHighCount,
        openMediumCount,
        avgResolutionTimes,
        trend: trendStats.map(t => ({ week: t._id, count: t.count }))
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.resolveAnomaly = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);

    question.anomalyResolvedAt = new Date();
    question.anomalyResolvedBy = req.user._id;
    await question.save();

    const populated = await Question.findById(question._id)
      .populate('author', 'username displayName email')
      .populate('anomalyResolvedBy', 'username displayName');

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'resolve_anomaly', questionId: question._id });
    } catch (err) {
      console.error('Socket notification error in resolveAnomaly:', err.message);
    }

    res.json({ message: 'Anomaly marked as resolved', question: populated });
  } catch (err) {
    next(err);
  }
};

exports.clearCache = async (req, res) => {
  try {
    const redis = getRedis();
    await redis.flushall();
    res.json({ message: 'Cache cleared' });
  } catch (_) {
    res.json({ message: 'Cache not available' });
  }
};

exports.createSiteReport = async (req, res, next) => {
  try {
    const SiteReport = require('../models/SiteReport');
    const { subject, description, pageUrl } = req.body;
    if (!subject || !description) {
      throw new AppError('Subject and description are required', 400);
    }
    const report = await SiteReport.create({
      user: req.user._id,
      subject,
      description,
      pageUrl
    });
    res.status(201).json({ message: 'Site report submitted successfully', report });
  } catch (err) {
    next(err);
  }
};

exports.getSiteReports = async (req, res, next) => {
  try {
    const SiteReport = require('../models/SiteReport');
    const reports = await SiteReport.find()
      .populate('user', 'username displayName email')
      .sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    next(err);
  }
};

exports.resolveSiteReport = async (req, res, next) => {
  try {
    const SiteReport = require('../models/SiteReport');
    const report = await SiteReport.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved' },
      { new: true }
    );
    if (!report) throw new AppError('Report not found', 404);

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'resolve_site_report', reportId: report._id });
    } catch (err) {
      console.error('Socket notification error in resolveSiteReport:', err.message);
    }

    res.json({ message: 'Site report marked as resolved', report });
  } catch (err) {
    next(err);
  }
};

exports.convertQuestionToFAQItem = async (req, res, next) => {
  try {
    const Question = require('../models/Question');
    const Answer = require('../models/Answer');
    const FAQ = require('../models/FAQ');
    
    const { categoryId } = req.body;
    if (!categoryId) {
      throw new AppError('FAQ Category ID is required', 400);
    }

    const question = await Question.findById(req.params.id);
    if (!question) {
      throw new AppError('Student question not found', 404);
    }

    let answerText = '';
    if (question.acceptedAnswer) {
      const ans = await Answer.findById(question.acceptedAnswer);
      if (ans) answerText = ans.body;
    } else {
      const topAns = await Answer.findOne({ question: question._id, isDeleted: false }).sort({ upvotes: -1 });
      if (topAns) answerText = topAns.body;
    }

    if (!answerText) {
      throw new AppError('The student question must have at least one answer to be converted to an FAQ', 400);
    }

    const faqPage = await FAQ.findById(categoryId);
    if (!faqPage) {
      throw new AppError('FAQ category not found', 404);
    }

    faqPage.items.push({
      question: question.title,
      answer: answerText,
      tags: question.tagNames || [],
      order: faqPage.items.length,
      reviewedBy: req.user._id,
      lastReviewed: new Date()
    });

    await faqPage.save();

    const { indexFAQItem } = require('../services/searchService');
    const newItem = faqPage.items[faqPage.items.length - 1];
    await indexFAQItem(faqPage, newItem);

    question.isFAQ = true;
    await question.save();

    res.json({ message: 'Question successfully converted and added to FAQ list!', faq: faqPage });
  } catch (err) {
    next(err);
  }
};

// Admin Moderation Methods
exports.getModerationQueue = async (req, res, next) => {
  try {
    const questions = await Question.find({ visibility: 'pending', isDeleted: { $ne: true } })
      .populate('author', 'username displayName trustLevel trustScore')
      .lean();
    const answers = await Answer.find({ visibility: 'pending', isDeleted: { $ne: true } })
      .populate('author', 'username displayName trustLevel trustScore')
      .populate({ path: 'question', select: 'title' })
      .lean();
    res.json({ questions, answers });
  } catch (err) {
    next(err);
  }
};

exports.approvePost = async (req, res, next) => {
  try {
    const { postId, postType } = req.body;
    const AuditLog = require('../models/AuditLog');
    const { indexQuestion } = require('../services/searchService');

    let post;
    if (postType === 'Question') {
      post = await Question.findById(postId);
    } else {
      post = await Answer.findById(postId);
    }

    if (!post) throw new AppError('Post not found', 404);

    post.visibility = 'public';
    await post.save();

    // Mark user pre-moderation approved
    const author = await User.findById(post.author);
    if (author) {
      author.premodApproved = true;
      await author.save();
    }

    // Trigger side-effects since it's now public
    if (postType === 'Question') {
      const populated = await Question.findById(post._id)
        .populate('author', 'username displayName avatar reputation')
        .populate('tags', 'name color')
        .populate('relatedQuestions', 'title answerCount');
      await indexQuestion(populated);

      // Email notification
      try {
        const { sendNewQuestionNotification } = require('../services/emailService');
        const authorName = populated.author ? (populated.author.displayName || populated.author.username) : 'Anonymous';
        await sendNewQuestionNotification(populated, authorName);
      } catch (emailErr) {
        console.error('Email notification error:', emailErr.message);
      }
    } else {
      const q = await Question.findById(post.question);
      if (q) {
        q.answerCount += 1;
        q.lastActivity = new Date();
        await q.save();

        const populated = await Answer.findById(post._id)
          .populate('author', 'username displayName avatar reputation');

        const { emitToQuestion, emitToUser } = require('../socket');
        const Notification = require('../models/Notification');

        if (q.author.toString() !== post.author.toString()) {
          await Notification.create({
            recipient: q.author,
            type: 'new_answer',
            title: 'New answer on your question',
            message: `${author.displayName || author.username} answered "${q.title}"`,
            link: `/questions/${q._id}`,
            referenceType: 'Answer',
            reference: post._id,
          });
          emitToUser(q.author.toString(), 'notification:new', { answer: populated });
        }
        emitToQuestion(q._id.toString(), 'answer:new', { answer: populated });
      }
    }

    // Audit Log
    await AuditLog.create({
      adminId: req.user._id,
      action: 'approve_post',
      targetId: post._id,
      targetType: postType,
      reason: 'Approved from pre-moderation queue'
    });

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'approve_post', postType, postId: post._id });
      const { broadcastLeaderboard } = require('../services/leaderboardService');
      await broadcastLeaderboard();
    } catch (err) {
      console.error('Socket notification error in approvePost:', err.message);
    }

    res.json({ message: 'Post approved successfully', post });
  } catch (err) {
    next(err);
  }
};

exports.rejectPost = async (req, res, next) => {
  try {
    const { postId, postType, reason } = req.body;
    const AuditLog = require('../models/AuditLog');

    let post;
    if (postType === 'Question') {
      post = await Question.findById(postId);
    } else {
      post = await Answer.findById(postId);
    }

    if (!post) throw new AppError('Post not found', 404);

    post.visibility = 'hidden';
    post.isDeleted = true; // Mark as deleted so it won't appear
    await post.save();

    // Send post rejection email notification
    try {
      const author = await User.findById(post.author);
      if (author && author.email) {
        const { sendPostRejectionEmail } = require('../services/emailService');
        const previewText = postType === 'Question' ? post.title : post.body;
        await sendPostRejectionEmail(author, postType, previewText, reason);
      }
    } catch (emailErr) {
      console.error('Failed to send rejection email:', emailErr.message);
    }

    // Audit Log
    await AuditLog.create({
      adminId: req.user._id,
      action: 'reject_post',
      targetId: post._id,
      targetType: postType,
      reason: reason || 'Rejected from pre-moderation queue'
    });

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'reject_post', postType, postId: post._id });
      const { broadcastLeaderboard } = require('../services/leaderboardService');
      await broadcastLeaderboard();
    } catch (err) {
      console.error('Socket notification error in rejectPost:', err.message);
    }

    res.json({ message: 'Post rejected and hidden successfully' });
  } catch (err) {
    next(err);
  }
};

exports.getReportedPosts = async (req, res, next) => {
  try {
    const Report = require('../models/Report');
    const reports = await Report.find()
      .populate('reportedBy', 'username displayName')
      .populate({
        path: 'postId',
        populate: { path: 'author', select: 'username displayName' }
      })
      .sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    next(err);
  }
};

exports.moderateUser = async (req, res, next) => {
  try {
    const { userId, action, durationHours, reason } = req.body;
    const AuditLog = require('../models/AuditLog');

    const targetUser = await User.findById(userId);
    if (!targetUser) throw new AppError('User not found', 404);

    if (action === 'warn') {
      targetUser.status = 'warned';
      targetUser.violationCount += 1;
    } else if (action === 'suspend') {
      targetUser.status = 'suspended';
      targetUser.violationCount += 1;
      const hours = durationHours ? parseInt(durationHours) : 24;
      targetUser.suspendedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    } else if (action === 'block') {
      targetUser.status = 'blocked';
      // Hide all posts
      await Question.updateMany({ author: targetUser._id }, { visibility: 'hidden' });
      
      const Answer = require('../models/Answer');
      const userAnswers = await Answer.find({ author: targetUser._id });
      const questionIds = [...new Set(userAnswers.map(a => a.question.toString()))];
      await Answer.updateMany({ author: targetUser._id }, { visibility: 'hidden' });

      const { recalculateAnswerCount } = require('../utils/helpers');
      for (const qId of questionIds) {
        await recalculateAnswerCount(qId);
      }
    } else if (action === 'shadow_ban') {
      targetUser.status = 'shadow_banned';
      // Hide all posts
      await Question.updateMany({ author: targetUser._id }, { visibility: 'hidden' });

      const Answer = require('../models/Answer');
      const userAnswers = await Answer.find({ author: targetUser._id });
      const questionIds = [...new Set(userAnswers.map(a => a.question.toString()))];
      await Answer.updateMany({ author: targetUser._id }, { visibility: 'hidden' });

      const { recalculateAnswerCount } = require('../utils/helpers');
      for (const qId of questionIds) {
        await recalculateAnswerCount(qId);
      }
    } else {
      throw new AppError('Invalid action', 400);
    }

    // Deduct trust score: -10 for spam, -20 for abuse/harassment
    const normalizedReason = (reason || '').toLowerCase();
    if (normalizedReason.includes('spam')) {
      targetUser.trustScore = Math.max(0, targetUser.trustScore - 10);
    } else if (normalizedReason.includes('abuse') || normalizedReason.includes('abusive') || normalizedReason.includes('harassment')) {
      targetUser.trustScore = Math.max(0, targetUser.trustScore - 20);
    }

    await targetUser.save();

    // Send user sanction email notification
    try {
      if (targetUser.email) {
        const { sendUserSanctionEmail } = require('../services/emailService');
        await sendUserSanctionEmail(targetUser, action, reason, targetUser.suspendedUntil);
      }
    } catch (emailErr) {
      console.error('Failed to send sanction email:', emailErr.message);
    }

    // Audit Log
    await AuditLog.create({
      adminId: req.user._id,
      action: `user_${action}`,
      targetId: targetUser._id,
      targetType: 'User',
      reason: reason || `Admin action: ${action}`
    });

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: `user_${action}`, userId: targetUser._id });
      const { broadcastLeaderboard } = require('../services/leaderboardService');
      await broadcastLeaderboard();
    } catch (err) {
      console.error('Socket notification error in moderateUser:', err.message);
    }

    res.json({ message: `User successfully moderate with action: ${action}`, user: targetUser });
  } catch (err) {
    next(err);
  }
};

exports.getSuspiciousActivity = async (req, res, next) => {
  try {
    const SuspiciousActivity = require('../models/SuspiciousActivity');
    const activities = await SuspiciousActivity.find()
      .populate('affectedUsers', 'username displayName email')
      .sort({ flagDate: -1 });
    res.json({ activities });
  } catch (err) {
    next(err);
  }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const logs = await AuditLog.find()
      .populate('adminId', 'username displayName')
      .sort({ timestamp: -1 });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
};



