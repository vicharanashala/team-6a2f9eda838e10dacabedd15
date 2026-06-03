const { validationResult } = require('express-validator');
const Question = require('../models/Question');
const Tag = require('../models/Tag');
const User = require('../models/User');
const QuestionView = require('../models/QuestionView');
const { AppError } = require('../middleware/errorHandler');
const { paginate, buildPaginationMeta } = require('../utils/helpers');
const { indexQuestion, deleteQuestionIndex } = require('../services/searchService');
const { emitToQuestion, emitToUser } = require('../socket');
const { canDeleteQuestion, hasPermission, PERMISSIONS } = require('../utils/permissions');
const Notification = require('../models/Notification');
const { flagContent, clearFlag } = require('../services/moderationService');
const FAQ = require('../models/FAQ');

exports.createQuestion = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, body, tags, anonymous, phase } = req.body;
    let tagIds = [];
    let tagNames = [];

    if (tags && tags.length > 0) {
      const tagDocs = await Promise.all(
        tags.map(async (name) => {
          const normalized = name.toLowerCase().trim();
          const tag = await Tag.findOneAndUpdate(
            { name: normalized },
            { $setOnInsert: { name: normalized } },
            { upsert: true, new: true },
          );
          await Tag.findByIdAndUpdate(tag._id, { $inc: { questionCount: 1 } });
          return tag;
        }),
      );
      tagIds = tagDocs.map(t => t._id);
      tagNames = tagDocs.map(t => t.name);
    }

    const existingQuestion = await findExistingQuestion(title, tagNames);

    // Map user phase to question phase
    const mapUserPhase = (userPhase) => {
      switch (userPhase) {
        case 'pre': return 'onboarding';
        case 'phase1_coursework': return 'week1';
        case 'phase1_completed': return 'week2';
        case 'phase2_project': return 'week3';
        case 'completed': return 'final';
        default: return 'onboarding';
      }
    };

    let visibility = req.body.visibility;
    if (!visibility) {
      if (req.user.trustLevel === 'trusted' || req.user.trustLevel === 'regular') {
        visibility = 'public';
      } else if (req.user.premodApproved) {
        visibility = 'public';
      } else {
        const qCount = await Question.countDocuments({ author: req.user._id });
        visibility = qCount < 3 ? 'pending' : 'public';
      }
    }

    // Call FastAPI AI microservice for zero-shot validation and noise classification
    let isAiFlaggedNoise = false;
    let aiFlagReason = '';
    try {
      const axios = require('axios');
      const config = require('../config');
      console.log(`[AI Validate] Calling FastAPI validate at: ${config.fastApiUrl}/api/v1/validate`);
      const response = await axios.post(`${config.fastApiUrl}/api/v1/validate`, {
        text: title
      }, { timeout: 3000 });

      if (response.data && response.data.valid === false) {
        isAiFlaggedNoise = true;
        aiFlagReason = response.data.reason || 'AI flagged this as unreadable noise.';
        console.log(`[AI Validate] Question flagged as noise. Reason: ${aiFlagReason}`);
      }
    } catch (err) {
      console.error('[AI Validate] FastAPI validation call failed or timed out:', err.message);
    }

    // If AI flags gibberish/noise — reject immediately with a clear message
    if (isAiFlaggedNoise) {
      return res.status(400).json({
        error: `Your question appears to be spam or gibberish and was not allowed. Reason: ${aiFlagReason} Please write a clear, meaningful question.`
      });
    }

    const questionData = {
      title,
      body,
      author: req.user._id,
      tags: tagIds,
      tagNames,
      lastActivity: new Date(),
      isAnonymous: !!anonymous,
      visibility,
      triggeredRule: isAiFlaggedNoise ? 'AI Noise Filter' : (req.body.triggeredRule || undefined),
      phase: phase || mapUserPhase(req.user.currentPhase) || 'onboarding',
      anomalySeverity: isAiFlaggedNoise ? 'high' : 'none',
      anomalyScore: isAiFlaggedNoise ? 0.95 : 0
    };

    if (existingQuestion) {
      questionData.isAlreadyAsked = true;
      questionData.scopeMatch = existingQuestion.scopeMatch;
      questionData.relatedQuestions = [existingQuestion.question._id];
    }

    const question = await Question.create(questionData);

    const { processAnomalyClassification } = require('../services/anomalyService');
    await processAnomalyClassification(question._id);

    if (existingQuestion) {
      await Question.findByIdAndUpdate(existingQuestion.question._id, {
        $addToSet: { relatedQuestions: question._id },
      });
    }

    await User.findByIdAndUpdate(req.user._id, { $inc: { questionCount: 1 } });

    const populated = await Question.findById(question._id)
      .populate('author', 'username displayName avatar reputation')
      .populate('tags', 'name color')
      .populate('relatedQuestions', 'title answerCount');

    // Only index and notify if it is immediately public
    if (visibility === 'public') {
      await indexQuestion(populated);

      // Send new question approved notification
      try {
        const { sendNewQuestionApprovedNotification } = require('../services/emailService');
        const authorName = populated.author ? (populated.author.displayName || populated.author.username) : 'Anonymous';
        await sendNewQuestionApprovedNotification(populated, authorName);
      } catch (emailErr) {
        console.error('Email notification error:', emailErr.message);
      }
    } else if (visibility === 'pending') {
      try {
        const { emitToAdmin } = require('../socket');
        emitToAdmin('moderation:updated', { action: 'new_pending_question', questionId: question._id });
      } catch (err) {
        console.error('Socket notification error for pending question:', err.message);
      }
    }

    res.status(201).json({
      question: populated,
      alreadyAsked: existingQuestion ? {
        isAlreadyAsked: true,
        scopeMatch: existingQuestion.scopeMatch,
        matchedQuestion: {
          _id: existingQuestion.question._id,
          title: existingQuestion.question.title,
          answerCount: existingQuestion.question.answerCount,
        },
      } : null
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleMeToo = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question || question.isDeleted) throw new AppError('Question not found', 404);

    const userId = req.user._id;
    const alreadyMeToo = question.meTooUsers.some(u => u.toString() === userId.toString());

    if (alreadyMeToo) {
      question.meTooUsers = question.meTooUsers.filter(u => u.toString() !== userId.toString());
      question.meTooCount = Math.max(0, question.meTooCount - 1);
    } else {
      question.meTooUsers.push(userId);
      question.meTooCount += 1;
    }

    await question.save();

    emitToQuestion(question._id.toString(), 'meToo:updated', {
      meTooCount: question.meTooCount,
      meTooUsers: question.meTooUsers.length,
    });

    res.json({
      meTooCount: question.meTooCount,
      hasMeToo: !alreadyMeToo,
    });
  } catch (err) {
    next(err);
  }
};

async function findExistingQuestion(title, tagNames) {
  const normalizedTitle = title.toLowerCase().trim();

  const exactMatch = await Question.findOne({
    isDeleted: false,
    title: { $regex: `^${normalizedTitle}$`, $options: 'i' },
  }).sort({ createdAt: -1 });

  if (exactMatch) {
    return { question: exactMatch, scopeMatch: 'exact' };
  }

  if (tagNames.length > 0 && title.length >= 10) {
    const words = title.toLowerCase().split(' ').filter(w => w.length > 3);
    const similarMatch = await Question.findOne({
      isDeleted: false,
      $or: [
        { title: { $regex: words.join('|'), $options: 'i' } },
        { tagNames: { $in: tagNames } },
      ],
    })
      .sort({ upvotes: -1, createdAt: -1 });

    if (similarMatch) {
      const hasSimilarTitle = words.some(w =>
        similarMatch.title.toLowerCase().includes(w)
      );
      const hasMatchingTags = similarMatch.tagNames.some(t => tagNames.includes(t));
      if (hasSimilarTitle && hasMatchingTags) {
        return { question: similarMatch, scopeMatch: 'similar' };
      }
    }
  }

  return null;
}

exports.getQuestions = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const filter = { isDeleted: { $ne: true } };

    if (req.query.tag) filter.tagNames = req.query.tag.toLowerCase();
    if (req.query.author) filter.author = req.query.author;
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const isModOrAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'moderator');
    const currentUserId = req.user ? req.user._id.toString() : null;

    const visibilityConditions = [];
    if (isModOrAdmin) {
      // No visibility restrictions for admin/mod
    } else if (currentUserId) {
      visibilityConditions.push({ visibility: { $in: ['public', 'archived'] } });
      visibilityConditions.push({ author: req.user._id });
    } else {
      visibilityConditions.push({ visibility: { $in: ['public', 'archived'] } });
    }

    if (visibilityConditions.length > 0) {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: visibilityConditions });
    }

    const sort = {};
    switch (req.query.sort) {
      case 'newest': sort.createdAt = -1; break;
      case 'active': sort.lastActivity = -1; break;
      case 'votes':
      case 'liked': sort.upvotes = -1; break;
      case 'views': sort.viewCount = -1; break;
      case 'me-too': sort.meTooCount = -1; break;
      default: sort.createdAt = -1;
    }

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('author', 'username displayName avatar reputation')
        .populate('tags', 'name color'),
      Question.countDocuments(filter),
    ]);

    const withOwner = questions.map(q => {
      const authorId = q.author && q.author._id ? q.author._id.toString() : null;
      const isAuthor = currentUserId && authorId && currentUserId === authorId;
      const anonymized = q.isAnonymous && !isAuthor && !isModOrAdmin ? {
        ...q.toObject(),
        author: {
          _id: 'anonymous',
          username: 'Anonymous Student',
          displayName: 'Anonymous Student',
          avatar: null,
          reputation: 0,
        },
      } : q.toObject();
      return {
        ...anonymized,
        hasMeToo: currentUserId ? q.meTooUsers && q.meTooUsers.some(u => u.toString() === currentUserId) : false,
        isOwner: isAuthor,
      };
    });

    res.json({ questions: withOwner, pagination: buildPaginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
};

exports.getQuestion = async (req, res, next) => {
  try {
    const question = await Question.findOne({
      _id: req.params.id,
      isDeleted: false,
    })
      .populate('author', 'username displayName avatar reputation website')
      .populate('tags', 'name color description')
      .populate({
        path: 'acceptedAnswer',
        populate: { path: 'author', select: 'username displayName avatar reputation' },
      });

    if (!question) throw new AppError('Question not found', 404);

    const isModOrAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'moderator');
    const isAuthor = req.user && question.author && question.author._id.toString() === req.user._id.toString();

    if (question.visibility !== 'public' && question.visibility !== 'archived') {
      if (!isModOrAdmin && !isAuthor) {
        throw new AppError('Question not found or pending moderation', 404);
      }
    }

    if (req.user) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existingView = await QuestionView.findOne({
        question: question._id,
        user: req.user._id,
        viewedAt: { $gte: oneHourAgo },
      });
      if (!existingView) {
        await QuestionView.findOneAndUpdate(
          { question: question._id, user: req.user._id },
          { viewedAt: new Date() },
          { upsert: true, new: true }
        );
        await Question.findByIdAndUpdate(question._id, { $inc: { viewCount: 1 } });
      }
    }

    if (question.isAnonymous && !isModOrAdmin && !isAuthor) {
      question.author = {
        _id: 'anonymous',
        username: 'Anonymous Student',
        displayName: 'Anonymous Student',
        avatar: null,
        reputation: 0,
      };
    }

    const hasMeToo = req.user ? question.meTooUsers.some(u => u.toString() === req.user._id.toString()) : false;

    const responseData = {
      ...question.toObject(),
      hasMeToo,
      meTooCount: question.meTooCount,
      isOwner: isAuthor,
    };

    res.json({ question: responseData });
  } catch (err) {
    next(err);
  }
};

exports.updateQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);
    if (question.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new AppError('Not authorized', 403);
    }

    const { title, body, tags } = req.body;
    if (title) question.title = title;
    if (body) question.body = body;
    if (tags) {
      const tagDocs = await Promise.all(
        tags.map(async (name) => {
          const tag = await Tag.findOneAndUpdate(
            { name: name.toLowerCase().trim() },
            { $setOnInsert: { name: name.toLowerCase().trim() } },
            { upsert: true, new: true },
          );
          return tag;
        }),
      );
      question.tags = tagDocs.map(t => t._id);
      question.tagNames = tagDocs.map(t => t.name);
    }

    await question.save();
    const updated = await Question.findById(question._id)
      .populate('author', 'username displayName avatar reputation')
      .populate('tags', 'name color');
    await indexQuestion(updated);
    res.json({ question: updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question || question.isDeleted) throw new AppError('Question not found', 404);
    if (!canDeleteQuestion(req.user, question)) {
      throw new AppError('Not authorized to delete this question', 403);
    }

    question.status = 'deleted';
    question.isDeleted = true;
    await question.save();
    await deleteQuestionIndex(question._id);
    res.json({ message: 'Question deleted' });
  } catch (err) {
    next(err);
  }
};

exports.markAsDuplicate = async (req, res, next) => {
  try {
    const { duplicateOfId } = req.body;
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);

    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Not authorized', 403);
    }

    const original = await Question.findById(duplicateOfId);
    if (!original) throw new AppError('Original question not found', 404);

    question.isDuplicate = true;
    question.duplicateOf = duplicateOfId;
    question.status = 'closed';
    question.closedReason = 'duplicate';
    question.closedBy = req.user._id;
    question.closedAt = new Date();
    await question.save();

    res.json({ message: 'Marked as duplicate', question });
  } catch (err) {
    next(err);
  }
};

exports.getSimilarQuestions = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);

    const similar = await Question.find({
      _id: { $ne: question._id },
      isDeleted: false,
      isDuplicate: false,
      $or: [
        { title: { $regex: question.title, $options: 'i' } },
        { tagNames: { $in: question.tagNames } },
      ],
    })
      .sort({ upvotes: -1 })
      .limit(5)
      .select('title upvotes answerCount viewCount tagNames isAnonymous')
      .populate('author', 'username displayName');

    const isModOrAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'moderator');
    const anonymized = similar.map(q => {
      if (q.isAnonymous && !isModOrAdmin) {
        return {
          ...q.toObject(),
          author: { _id: 'anonymous', username: 'Anonymous Student', displayName: 'Anonymous Student' },
        };
      }
      return q;
    });

    res.json({ similar: anonymized });
  } catch (err) {
    next(err);
  }
};

exports.getRelatedQuestions = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id).populate('relatedQuestions', 'title answerCount tagNames status');
    if (!question) throw new AppError('Question not found', 404);

    const related = await Question.find({
      _id: { $in: question.relatedQuestions },
      isDeleted: false,
    })
      .select('title answerCount tagNames status isDuplicate scopeMatch')
      .populate('author', 'username displayName');

    res.json({
      question: {
        _id: question._id,
        title: question.title,
        isAlreadyAsked: question.isAlreadyAsked,
        scopeMatch: question.scopeMatch,
      },
      related,
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);
    if (!question.isFAQ) throw new AppError('Question is not a resolved FAQ', 400);
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Not authorized', 403);
    }

    question.lastVerifiedAt = new Date();
    question.verifiedBy = req.user._id;
    question.isOutdated = false;
    question.outdatedReason = null;
    await question.save();

    const populated = await Question.findById(question._id)
      .populate('verifiedBy', 'username displayName');

    res.json({ message: 'FAQ verified', question: populated });
  } catch (err) {
    next(err);
  }
};

exports.clearVerifyQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Not authorized', 403);
    }

    question.lastVerifiedAt = null;
    question.verifiedBy = null;
    await question.save();

    res.json({ message: 'FAQ verification cleared', question });
  } catch (err) {
    next(err);
  }
};

exports.markOutdated = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);
    if (!question.isFAQ) throw new AppError('Question is not a resolved FAQ', 400);

    question.isOutdated = true;
    question.outdatedReason = reason || 'Information may be outdated';
    await question.save();

    res.json({ message: 'Marked as outdated', question });
  } catch (err) {
    next(err);
  }
};

exports.clearOutdated = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);

    question.isOutdated = false;
    question.outdatedReason = null;
    await question.save();

    res.json({ message: 'Outdated status cleared', question });
  } catch (err) {
    next(err);
  }
};

exports.findSimilar = async (req, res, next) => {
  try {
    const { title, tags } = req.query;
    if (!title && !tags) {
      return res.json({ similar: [], duplicates: [] });
    }

    const filter = { isDeleted: false, isDuplicate: false };
    const orConditions = [];

    if (title && title.length >= 5) {
      const words = title.toLowerCase().split(' ').filter(w => w.length > 3);
      if (words.length > 0) {
        orConditions.push({ title: { $regex: words.join('|'), $options: 'i' } });
      }
      orConditions.push({ title: { $regex: title, $options: 'i' } });
    }

    if (tags && tags.length > 0) {
      orConditions.push({ tagNames: { $in: tags.split(',') } });
    }

    if (orConditions.length === 0) {
      return res.json({ similar: [], duplicates: [] });
    }

    filter.$or = orConditions;

    const questions = await Question.find(filter)
      .sort({ upvotes: -1, createdAt: -1 })
      .limit(10)
      .select('title upvotes answerCount viewCount tagNames status isDuplicate duplicateOf');

    const duplicates = questions.filter(q => q.status === 'closed' && q.isDuplicate);
    const similar = questions.filter(q => !q.isDuplicate || q.status !== 'closed');

    res.json({ similar, duplicates });
  } catch (err) {
    next(err);
  }
};

exports.confirmResolution = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);
    if (question.author.toString() !== req.user._id.toString()) {
      throw new AppError('Only the author can confirm resolution', 403);
    }

    question.resolutionStatus = 'resolved';
    question.resolvedByStudent = true;
    question.resolvedAtStudent = new Date();
    await question.save();

    res.json({ message: 'Resolution confirmed', question });
  } catch (err) {
    next(err);
  }
};

exports.escalateQuestion = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);

    const isAuthor = question.author.toString() === req.user._id.toString();
    const isModOrAdmin = req.user.role === 'admin' || req.user.role === 'moderator';

    if (!isAuthor && !isModOrAdmin) {
      throw new AppError('Only the author or moderators can escalate', 403);
    }
    if (question.isEscalated) {
      throw new AppError('Question already escalated', 400);
    }
    if (question.resolutionStatus === 'escalated') {
      throw new AppError('Question already escalated', 400);
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (question.createdAt > twentyFourHoursAgo) {
      throw new AppError('Question cannot be escalated within 24 hours of creation', 400);
    }

    const Answer = require('../models/Answer');
    const otherAnswersCount = await Answer.countDocuments({
      question: question._id,
      author: { $ne: question.author },
      isDeleted: false,
    });
    if (otherAnswersCount > 0) {
      throw new AppError('Question has answers from other users, cannot escalate', 400);
    }

    question.resolutionStatus = 'escalated';
    question.isEscalated = true;
    question.escalatedAt = new Date();
    question.escalationReason = reason || 'No response received within 24 hours';
    await question.save();

    const Notification = require('../models/Notification');
    const User = require('../models/User');
    const moderators = await User.find({ role: { $in: ['admin', 'moderator'] } });
    await Promise.all(moderators.map(mod =>
      Notification.create({
        recipient: mod._id,
        type: 'escalation',
        title: 'Question escalated - needs attention',
        message: `Question "${question.title}" was escalated by the author: ${reason || 'No response received within 24 hours'}`,
        link: `/questions/${question._id}`,
        referenceType: 'Question',
        reference: question._id,
      })
    ));

    res.json({ message: 'Question escalated', question });
  } catch (err) {
    next(err);
  }
};

exports.selfEscalateAnomaly = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);
    
    if (question.author.toString() !== req.user._id.toString()) {
      throw new AppError('Only the author can self-escalate their question', 403);
    }

    question.anomalySeverity = 'high';
    question.anomalyScore = Math.max(85, question.anomalyScore || 0);
    question.alertSent = true;
    await question.save();

    const { alertAdminsAndModerators } = require('../services/anomalyService');
    const subject = `[SELF-ESCALATED HIGH ALERT] User query marked urgent by author`;
    await alertAdminsAndModerators(question, subject);

    res.json({ message: 'Question successfully escalated to urgent status', question });
  } catch (err) {
    next(err);
  }
};

exports.resolveEscalation = async (req, res, next) => {
  try {
    const { resolutionNote } = req.body;
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);
    if (question.resolutionStatus !== 'escalated') {
      throw new AppError('Question is not escalated', 400);
    }
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Only moderators can resolve escalations', 403);
    }

    question.resolutionStatus = 'resolved';
    question.escalatedTo = req.user._id;
    if (resolutionNote) {
      question.escalationReason = resolutionNote;
    }
    await question.save();

    // Notify the student
    const Notification = require('../models/Notification');
    await Notification.create({
      recipient: question.author,
      type: 'escalation_resolved',
      title: 'Your escalated question has been addressed',
      message: `Your question "${question.title}" has been reviewed and addressed.`,
      link: `/questions/${question._id}`,
      referenceType: 'Question',
      reference: question._id,
    });

    res.json({ message: 'Escalation resolved', question });
  } catch (err) {
    next(err);
  }
};

exports.getEscalatedQuestions = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Not authorized', 403);
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      Question.find({ resolutionStatus: 'escalated' })
        .sort({ escalatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title escalationReason escalatedAt answerCount tagNames')
        .populate('author', 'username displayName'),
      Question.countDocuments({ resolutionStatus: 'escalated' }),
    ]);

    res.json({
      questions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

exports.mergeIntoMasterFAQ = async (req, res, next) => {
  try {
    const { masterFAQId } = req.body;
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Only moderators can merge questions into master FAQs', 403);
    }

    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);

    const masterFAQ = await Question.findById(masterFAQId);
    if (!masterFAQ) throw new AppError('Master FAQ not found', 404);
    if (!masterFAQ.isFAQ) throw new AppError('Target must be a resolved FAQ', 400);

    // Mark question as merged
    question.mergedInto = masterFAQId;
    question.status = 'closed';
    question.closedReason = 'merged';
    question.closedBy = req.user._id;
    question.closedAt = new Date();
    await question.save();

    // Add to master's merged questions and increment count
    await Question.findByIdAndUpdate(masterFAQId, {
      $addToSet: { mergedQuestions: question._id },
      $inc: { mergeCount: 1 },
    });

    res.json({ message: 'Question merged into master FAQ', question });
  } catch (err) {
    next(err);
  }
};

exports.getMasterFAQs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      Question.find({ isFAQ: true, isMasterFAQ: true, isDeleted: false })
        .sort({ mergeCount: -1, resolvedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title answerCount viewCount mergeCount resolvedAt tagNames isOutdated')
        .populate('author', 'username displayName'),
      Question.countDocuments({ isFAQ: true, isMasterFAQ: true, isDeleted: false }),
    ]);

    res.json({
      questions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

exports.promoteToMasterFAQ = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Only moderators can promote questions to master FAQ', 403);
    }

    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);
    if (!question.isFAQ) throw new AppError('Question must be a resolved FAQ to promote', 400);

    question.isMasterFAQ = true;
    await question.save();

    res.json({ message: 'Promoted to master FAQ', question });
  } catch (err) {
    next(err);
  }
};

exports.addToFAQ = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Only moderators can add questions to FAQs', 403);
    }

    const { faqId, answerId } = req.body;
    if (!faqId) throw new AppError('FAQ ID is required', 400);

    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);

    let answerBody = question.body;
    if (answerId) {
      const Answer = require('../models/Answer');
      const answer = await Answer.findById(answerId);
      if (!answer) throw new AppError('Answer not found', 404);
      if (answer.question.toString() !== question._id.toString()) {
        throw new AppError('Answer does not belong to this question', 400);
      }
      answerBody = answer.body;
    }

    const faq = await FAQ.findById(faqId);
    if (!faq) throw new AppError('FAQ not found', 404);

    faq.items.push({
      question: question.title,
      answer: answerBody,
      tags: question.tagNames || [],
      order: faq.items.length,
    });
    await faq.save();

    res.json({ message: 'Added to FAQ', faq });
  } catch (err) {
    next(err);
  }
};

exports.removeFromFAQ = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Only moderators can remove questions from FAQs', 403);
    }

    const { answerId } = req.body;

    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);

    let removeContent = question.title;

    if (answerId) {
      const Answer = require('../models/Answer');
      const answer = await Answer.findById(answerId);
      if (answer && answer.question.toString() === question._id.toString()) {
        removeContent = answer.body;
      }
    }

    const faqs = await FAQ.find({ 'items.question': question.title });
    for (const faq of faqs) {
      faq.items = faq.items.filter(item => {
        if (item.question !== question.title) return true;
        if (answerId) {
          return item.answer !== removeContent;
        }
        return item.answer !== removeContent && item.answer !== question.body;
      });
      if (faq.items.length === 0) {
        await FAQ.findByIdAndDelete(faq._id);
      } else {
        await faq.save();
      }
    }

    res.json({ message: 'Removed from FAQs' });
  } catch (err) {
    next(err);
  }
};

exports.getMergedQuestions = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) throw new AppError('Question not found', 404);

    const mergedQuestions = await Question.find({
      _id: { $in: question.mergedQuestions },
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .select('title author answerCount viewCount createdAt tagNames status')
      .populate('author', 'username displayName');

    res.json({ mergedQuestions });
  } catch (err) {
    next(err);
  }
};

const VALID_FLAG_REASONS = ['incorrect', 'incomplete', 'unclear', 'harmful', 'spam', 'other'];

exports.flagQuestion = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !VALID_FLAG_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Invalid flag reason', validReasons: VALID_FLAG_REASONS });
    }

    const question = await Question.findById(req.params.id);
    if (!question || question.isDeleted) throw new AppError('Question not found', 404);

    await flagContent({ targetType: 'Question', targetId: req.params.id, reason, flaggedBy: req.user._id });

    res.json({ message: 'Question flagged', reason });
  } catch (err) {
    next(err);
  }
};

exports.clearFlagQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question || question.isDeleted) throw new AppError('Question not found', 404);

    await clearFlag({ targetType: 'Question', targetId: req.params.id });

    res.json({ message: 'Question flag cleared' });
  } catch (err) {
    next(err);
  }
};
