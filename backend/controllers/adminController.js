const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const { AppError } = require('../middleware/errorHandler');
const { paginate, buildPaginationMeta } = require('../utils/helpers');
const { getDashboardStats, getUserAnalytics, getGlobalFAQAnalytics } = require('../services/analyticsService');
const { banUser, unbanUser } = require('../services/moderationService');
const { getRedis } = require('../config/redis');
const { triggerAutoAnswer } = require('../services/autoAnswerService');

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
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) throw new AppError('User not found', 404);
    if (targetUser.email === 'faqportal.in@gmail.com') {
      throw new AppError("Cannot change the site owner's role", 400);
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');

    // Role promotion emails are disabled to prevent non-compliant outbound emails

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
    if (req.params.id === req.user._id.toString()) {
      throw new AppError('You cannot ban yourself', 400);
    }
    const target = await User.findById(req.params.id);
    if (target && target.email === 'faqportal.in@gmail.com') {
      throw new AppError('Cannot ban the site owner', 400);
    }
    await banUser({ userId: req.params.id, reason: reason || 'Violation of terms' });

    try {
      const targetUser = await User.findById(req.params.id);
      if (targetUser && targetUser.email) {
        const { sendUserBlockedNotification } = require('../services/emailService');
        await sendUserBlockedNotification(targetUser, reason || 'Violation of terms');
      }
    } catch (emailErr) {
      console.error('Failed to send block email in banUser:', emailErr.message);
    }

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
      const targetUser = await User.findById(req.params.id);
      if (targetUser && targetUser.email) {
        const { sendUserUnblockedNotification } = require('../services/emailService');
        await sendUserUnblockedNotification(targetUser);
      }
    } catch (emailErr) {
      console.error('Failed to send unblocked email:', emailErr.message);
    }

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
    if (userId === req.user._id.toString()) {
      throw new AppError('You cannot delete yourself', 400);
    }
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.email === 'faqportal.in@gmail.com') {
      throw new AppError('Cannot delete the site owner', 400);
    }

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

    const filter = { anomalySeverity: { $in: ['high', 'medium', 'low'] }, isDeleted: { $ne: true } };
    
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
          anomalyResolvedAt: { $ne: null },
          isDeleted: { $ne: true }
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

    const openHighCount = await Question.countDocuments({ anomalySeverity: 'high', anomalyResolvedAt: null, isDeleted: { $ne: true } });
    const openMediumCount = await Question.countDocuments({ anomalySeverity: 'medium', anomalyResolvedAt: null, isDeleted: { $ne: true } });

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const trendStats = await Question.aggregate([
      {
        $match: {
          anomalySeverity: { $in: ['high', 'medium', 'low'] },
          createdAt: { $gte: fourWeeksAgo },
          isDeleted: { $ne: true }
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

    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      adminId: req.user._id,
      action: 'resolve_anomaly',
      targetId: question._id,
      targetType: 'Question',
      reason: `Resolved anomaly on question: "${question.title}"`
    });

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
    try {
      const { syncToElasticsearch } = require('../services/searchService');
      await syncToElasticsearch();
    } catch (esErr) {
      console.error('Failed to sync ES indices during cache clear:', esErr.message);
    }
    res.json({ message: 'Cache and search indices cleared' });
  } catch (_) {
    res.json({ message: 'Cache or search not available' });
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

      // Trigger AI auto-answer for newly-approved question (fire-and-forget)
      setImmediate(() => {
        triggerAutoAnswer(populated).catch(err =>
          console.error('[AutoAnswer] approvePost trigger error:', err.message)
        );
      });

      // Email notification
      try {
        const { sendNewQuestionApprovedNotification } = require('../services/emailService');
        const authorName = populated.author ? (populated.author.displayName || populated.author.username) : 'Anonymous';
        await sendNewQuestionApprovedNotification(populated, authorName);
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

          // Send email notification to question author
          try {
            const { sendAnswerPostedNotification } = require('../services/emailService');
            await sendAnswerPostedNotification(populated, q);
          } catch (emailErr) {
            console.error('Email notification error:', emailErr.message);
          }
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
    if (postType && postType.toLowerCase() === 'question') {
      post = await Question.findById(postId);
    } else {
      post = await Answer.findById(postId);
    }

    if (!post) throw new AppError('Post not found', 404);

    post.visibility = 'hidden';
    post.isDeleted = true; // Mark as deleted so it won't appear
    await post.save();

    if (postType && postType.toLowerCase() === 'question') {
      const Answer = require('../models/Answer');
      // Find all non-deleted answers before bulk-marking them deleted
      const affectedAnswers = await Answer.find({ question: post._id, isDeleted: false }).select('author');
      await Answer.updateMany({ question: post._id }, { isDeleted: true, visibility: 'hidden' });
      // Decrement each answer author's answerCount
      for (const a of affectedAnswers) {
        if (a.author) {
          await User.findByIdAndUpdate(a.author, { $inc: { answerCount: -1 } });
        }
      }
    } else {
      // Single answer rejected — decrement its author's answerCount
      await User.findByIdAndUpdate(post.author, { $inc: { answerCount: -1 } });
    }

    // Post rejection emails are disabled to prevent non-compliant outbound emails

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

    if (action === 'shadow_ban') {
      throw new AppError('Shadow ban option is removed', 400);
    }

    if (userId === req.user._id.toString() && ['suspend', 'block', 'warn'].includes(action)) {
      throw new AppError('You cannot perform this action on yourself', 400);
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) throw new AppError('User not found', 404);

    if (targetUser.email === 'faqportal.in@gmail.com' && ['suspend', 'block', 'warn', 'shadow_ban'].includes(action)) {
      throw new AppError('Cannot ban or suspend the site owner', 400);
    }

    if (action === 'warn') {
      targetUser.status = 'warned';
      targetUser.violationCount += 1;
    } else if (action === 'suspend') {
      targetUser.status = 'suspended';
      targetUser.violationCount += 1;
      const hours = durationHours ? parseInt(durationHours) : 24;
      targetUser.suspendedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
      
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
      throw new AppError('Shadow ban option is removed', 400);
    } else if (action === 'activate' || action === 'unsuspend' || action === 'unblock' || action === 'unshadow_ban') {
      targetUser.status = 'active';
      targetUser.suspendedUntil = null;
      targetUser.isBanned = false;
      targetUser.banReason = null;
      
      // Restore all posts
      await Question.updateMany({ author: targetUser._id, visibility: 'hidden' }, { visibility: 'public' });
      
      const Answer = require('../models/Answer');
      const userAnswers = await Answer.find({ author: targetUser._id });
      const questionIds = [...new Set(userAnswers.map(a => a.question.toString()))];
      await Answer.updateMany({ author: targetUser._id, visibility: 'hidden' }, { visibility: 'public' });

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

    // Send relevant email notifications based on action
    try {
      if (targetUser.email) {
        const emailService = require('../services/emailService');
        if (action === 'block') {
          await emailService.sendUserBlockedNotification(targetUser, reason);
        } else if (action === 'suspend') {
          await emailService.sendUserSuspendedNotification(targetUser, durationHours || 24, reason);
        } else if (action === 'warn') {
          await emailService.sendUserWarnedNotification(targetUser, reason);
        } else if (action === 'shadow_ban') {
          await emailService.sendUserShadowBannedNotification(targetUser, reason);
        } else if (['activate', 'unsuspend', 'unblock', 'unshadow_ban'].includes(action)) {
          await emailService.sendUserActivatedNotification(targetUser);
        }
      }
    } catch (emailErr) {
      console.error(`Failed to send ${action} email:`, emailErr.message);
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

exports.getAuditLogs = async (req, res, next) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const logs = await AuditLog.find()
      .populate('adminId', 'username displayName')
      .populate('userId', 'username displayName')
      .sort({ timestamp: -1 });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
};

exports.getEmailQueue = async (req, res, next) => {
  try {
    const EmailQueue = require('../models/EmailQueue');
    const BouncedEmail = require('../models/BouncedEmail');
    const EmailStat = require('../models/EmailStat');

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      EmailQueue.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      EmailQueue.countDocuments()
    ]);

    // Real-time queue counters
    const today = new Date().toISOString().split('T')[0];
    const todayStat = await EmailStat.findOne({ date: today });
    const sentToday = todayStat ? todayStat.count : 0;

    const [pendingCount, bouncedCount] = await Promise.all([
      EmailQueue.countDocuments({ status: 'pending' }),
      EmailQueue.countDocuments({ status: 'bounced' })
    ]);

    res.json({
      emails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        pendingCount,
        sentToday,
        bouncedCount
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.forceProcessQueue = async (req, res, next) => {
  try {
    const { processEmailQueue } = require('../services/emailWorker');
    // Run asynchronously, don't wait to complete
    processEmailQueue().catch(err => console.error('Force process queue error:', err.message));
    res.json({ message: 'Queue processing started in background' });
  } catch (err) {
    next(err);
  }
};

exports.retryFailedEmails = async (req, res, next) => {
  try {
    const EmailQueue = require('../models/EmailQueue');
    const result = await EmailQueue.updateMany(
      { status: { $in: ['failed', 'bounced'] } },
      {
        $set: {
          status: 'pending',
          attempts: 0,
          nextRetryAt: new Date(),
          failReason: null
        }
      }
    );
    res.json({ message: `Successfully reset ${result.modifiedCount || result.nModified || 0} failed/bounced email(s) to pending` });
  } catch (err) {
    next(err);
  }
};

exports.clearEmailQueue = async (req, res, next) => {
  try {
    const EmailQueue = require('../models/EmailQueue');
    await EmailQueue.deleteMany({});
    res.json({ message: 'Email queue cleared successfully' });
  } catch (err) {
    next(err);
  }
};

exports.getBouncedEmails = async (req, res, next) => {
  try {
    const BouncedEmail = require('../models/BouncedEmail');
    const bounces = await BouncedEmail.find().sort({ bouncedAt: -1 }).lean();
    res.json({ bounces });
  } catch (err) {
    next(err);
  }
};

exports.removeBouncedEmail = async (req, res, next) => {
  try {
    const BouncedEmail = require('../models/BouncedEmail');
    const result = await BouncedEmail.findByIdAndDelete(req.params.id);
    if (!result) throw new AppError('Bounce record not found', 404);
    res.json({ message: 'Bounce record removed successfully' });
  } catch (err) {
    next(err);
  }
};

exports.sendAdminAlert = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) {
      throw new AppError('Message is required', 400);
    }

    const User = require('../models/User');
    const Notification = require('../models/Notification');
    const { broadcastAlert } = require('../socket');

    // 1. Get all active, non-banned users (excluding the sender)
    const users = await User.find({ _id: { $ne: req.user._id }, isBanned: false }).select('_id');
    
    // 2. Create system notifications in batch
    if (users.length > 0) {
      const notificationsToInsert = users.map(user => ({
        recipient: user._id,
        type: 'system',
        title: 'Admin Alert',
        message: message,
        isRead: false,
      }));
      await Notification.insertMany(notificationsToInsert);
    }

    // 3. Broadcast real-time alert to all connected sockets
    try {
      broadcastAlert('admin:alert', {
        title: 'Admin Alert',
        message,
        senderId: req.user._id.toString(),
        createdAt: new Date()
      });
    } catch (socketErr) {
      console.error('Socket broadcast failed for admin alert:', socketErr.message);
    }

    // 3b. Broadcast push notifications to all apps (even if closed)
    try {
      const { broadcastPushNotification } = require('../services/pushService');
      broadcastPushNotification({
        title: 'Admin Alert',
        body: message,
        data: {
          link: '/notifications',
          type: 'system'
        }
      });
    } catch (pushErr) {
      console.error('Push broadcast failed for admin alert:', pushErr.message);
    }

    // 4. Also audit log this action
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      adminId: req.user._id,
      action: 'send_admin_alert',
      targetId: req.user._id,
      targetType: 'User',
      reason: `Broadcasted alert: "${message}"`
    });

    res.json({ success: true, message: 'Admin alert broadcasted successfully' });
  } catch (err) {
    next(err);
  }
};

exports.sendEmailBroadcast = async (req, res, next) => {
  try {
    const { subject, body, contentTitle } = req.body;
    if (!subject || !body) {
      throw new AppError('Subject and body are required', 400);
    }

    const User = require('../models/User');
    const enqueueEmail = require('../utils/enqueueEmail');

    // 1. Get all active, non-banned users with emails
    const users = await User.find({ isBanned: false }).select('email displayName username');
    
    // 2. Enqueue emails for all users
    let enqueuedCount = 0;
    for (const u of users) {
      if (u.email) {
        await enqueueEmail({
          to: u.email,
          userName: u.displayName || u.username,
          subject: subject,
          body: body,
          contentTitle: contentTitle || 'Admin Broadcast Announcement'
        });
        enqueuedCount++;
      }
    }

    // 3. Log to Audit Log
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      adminId: req.user._id,
      action: 'email_broadcast',
      targetId: req.user._id,
      targetType: 'User',
      reason: `Sent email broadcast to ${enqueuedCount} users: "${subject}"`
    });

    res.json({ success: true, message: `Email broadcast enqueued for ${enqueuedCount} user(s)` });
  } catch (err) {
    next(err);
  }
};

exports.updateAppVersion = async (req, res, next) => {
  try {
    const { latestVersion, latestVersionCode, apkUrl, changelog, forceUpdate } = req.body;
    if (!latestVersion || !latestVersionCode || !apkUrl) {
      throw new AppError('latestVersion, latestVersionCode, and apkUrl are required', 400);
    }

    const AppVersion = require('../models/AppVersion');
    let versionInfo = await AppVersion.findOne().sort({ createdAt: -1 });
    
    if (versionInfo) {
      versionInfo.latestVersion = latestVersion;
      versionInfo.latestVersionCode = parseInt(latestVersionCode);
      versionInfo.apkUrl = apkUrl;
      versionInfo.changelog = changelog || '';
      versionInfo.forceUpdate = !!forceUpdate;
      await versionInfo.save();
    } else {
      versionInfo = await AppVersion.create({
        latestVersion,
        latestVersionCode: parseInt(latestVersionCode),
        apkUrl,
        changelog: changelog || '',
        forceUpdate: !!forceUpdate
      });
    }

    // Broadcast update notification to all apps in real-time via Socket.IO
    try {
      const { broadcastAlert } = require('../socket');
      broadcastAlert('app:update', {
        latestVersion: versionInfo.latestVersion,
        latestVersionCode: versionInfo.latestVersionCode,
        changelog: versionInfo.changelog,
        forceUpdate: versionInfo.forceUpdate,
        apkUrl: versionInfo.apkUrl
      });
    } catch (socketErr) {
      console.error('Socket broadcast failed for app update:', socketErr.message);
    }

    // Audit log
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      adminId: req.user._id,
      action: 'update_app_version',
      targetId: versionInfo._id,
      targetType: 'FAQ',
      reason: `Updated app version to ${latestVersion} (${latestVersionCode})`
    });

    res.json({ success: true, message: 'App version updated and live broadcast sent', version: versionInfo });
  } catch (err) {
    next(err);
  }
};

exports.getSpurtiLogs = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 15;
    const skip = (pageNum - 1) * limitNum;

    let query = {};
    if (search) {
      const User = require('../models/User');
      const users = await User.find({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = users.map(u => u._id);
      query.user = { $in: userIds };
    }

    const SpurtiPointLog = require('../models/SpurtiPointLog');
    const logs = await SpurtiPointLog.find(query)
      .populate('user', 'username displayName avatar email spurtiPoints')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await SpurtiPointLog.countDocuments(query);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        total
      }
    });
  } catch (err) {
    next(err);
  }
};


