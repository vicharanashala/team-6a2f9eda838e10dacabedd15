const { validationResult } = require('express-validator');
const Question = require('../models/Question');
const Tag = require('../models/Tag');
const QuestionView = require('../models/QuestionView');
const { AppError } = require('../middleware/errorHandler');
const { paginate, buildPaginationMeta } = require('../utils/helpers');
const { indexQuestion, deleteQuestionIndex } = require('../services/searchService');
const { emitToQuestion, emitToUser } = require('../socket');
const { canDeleteQuestion, hasPermission, PERMISSIONS } = require('../utils/permissions');
const Notification = require('../models/Notification');
const { flagContent, clearFlag } = require('../services/moderationService');
const FAQ = require('../models/FAQ');
const User = require('../models/User');
const { triggerAutoAnswer } = require('../services/autoAnswerService');

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

    if (isAiFlaggedNoise) {
      return res.status(400).json({ error: `Your question was flagged as spam or noise and is not allowed. Reason: ${aiFlagReason}` });
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
      anomalyScore: isAiFlaggedNoise ? 0.95 : 0,
      attachments: req.body.attachments || [],
      links: req.body.links || [],
    };

    if (existingQuestion) {
      questionData.isAlreadyAsked = true;
      questionData.scopeMatch = existingQuestion.scopeMatch;
      questionData.relatedQuestions = [existingQuestion.question._id];
    }

    const question = await Question.create(questionData);

    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      userId: req.user._id,
      action: 'create_question',
      targetId: question._id,
      targetType: 'Question',
      reason: `Created question: "${title}"`
    });

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

      // Trigger AI auto-answer (fire-and-forget — never blocks the user response)
      setImmediate(() => {
        triggerAutoAnswer(populated).catch(err =>
          console.error('[AutoAnswer] Background trigger error:', err.message)
        );
      });
    } else if (visibility === 'pending') {
      try {
        const { emitToAdmin } = require('../socket');
        emitToAdmin('moderation:updated', { action: 'new_pending_question', questionId: question._id });
      } catch (err) {
        console.error('Socket notification error for pending question:', err.message);
      }
    }

    const isModOrAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'moderator');
    const responseObj = populated.toObject();
    if (responseObj.isAnonymous && !isModOrAdmin) {
      responseObj.author = {
        _id: 'anonymous',
        username: 'Anonymous Student',
        displayName: 'Anonymous Student',
        avatar: null,
        reputation: 0,
      };
    }

    res.status(201).json({
      question: responseObj,
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
      const anonymized = q.isAnonymous ? {
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

    if (question.isAnonymous) {
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

    const oldTitle = question.title;
    const oldBody = question.body;

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

    const AuditLog = require('../models/AuditLog');
    let changes = [];
    if (title && title !== oldTitle) changes.push(`title: "${oldTitle}" -> "${title}"`);
    if (body && body !== oldBody) changes.push(`body: "${oldBody}" -> "${body}"`);
    const changeReason = changes.length > 0 ? `Updated question: ${changes.join(', ')}` : 'Updated question tags';

    await AuditLog.create({
      userId: req.user._id,
      action: 'update_question',
      targetId: question._id,
      targetType: 'Question',
      reason: changeReason
    });

    const updated = await Question.findById(question._id)
      .populate('author', 'username displayName avatar reputation')
      .populate('tags', 'name color');
    await indexQuestion(updated);

    const responseObj = updated.toObject();
    if (responseObj.isAnonymous) {
      responseObj.author = {
        _id: 'anonymous',
        username: 'Anonymous Student',
        displayName: 'Anonymous Student',
        avatar: null,
        reputation: 0,
      };
    }
    res.json({ question: responseObj });
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

    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      userId: req.user._id,
      action: 'delete_question',
      targetId: question._id,
      targetType: 'Question',
      reason: `Deleted question: "${question.title}"`
    });

    const Answer = require('../models/Answer');
    const User = require('../models/User');
    // Gather authors of non-deleted answers before cascading deletion
    const cascadedAnswers = await Answer.find({ question: question._id, isDeleted: false }).select('author');
    await Answer.updateMany({ question: question._id }, { isDeleted: true });
    // Decrement each author's answerCount
    for (const a of cascadedAnswers) {
      if (a.author) {
        await User.findByIdAndUpdate(a.author, { $inc: { answerCount: -1 } });
      }
    }

    await deleteQuestionIndex(question._id);

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'delete_question', questionId: question._id });
      const { broadcastLeaderboard } = require('../services/leaderboardService');
      await broadcastLeaderboard();
    } catch (err) {
      console.error('Socket notification error in deleteQuestion:', err.message);
    }

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

    const anonymized = similar.map(q => {
      if (q.isAnonymous) {
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
    if (!isAuthor) {
      throw new AppError('Only the author of the question can escalate it', 403);
    }
    if (question.isEscalated) {
      throw new AppError('Question already escalated', 400);
    }
    if (question.resolutionStatus === 'escalated') {
      throw new AppError('Question already escalated', 400);
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

    // Check if the user has escalated more than 5 questions in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyEscalationCount = await Question.countDocuments({
      author: req.user._id,
      isEscalated: true,
      escalatedAt: { $gte: oneHourAgo }
    });
    if (hourlyEscalationCount >= 5) {
      throw new AppError('You have reached the maximum limit of 5 escalations per hour', 429);
    }

    // Check if another question on the same topic/tags is already escalated and unresolved
    const words = question.title.toLowerCase().split(' ').filter(w => w.length > 3 && !['what', 'how', 'why', 'with', 'from', 'this', 'that', 'here', 'there'].includes(w));
    if (words.length > 0) {
      const titleRegex = new RegExp(words.join('|'), 'i');
      
      const topicQuery = {
        _id: { $ne: question._id },
        resolutionStatus: 'escalated',
        title: { $regex: titleRegex }
      };

      if (question.tagNames && question.tagNames.length > 0) {
        topicQuery.tagNames = { $in: question.tagNames };
      }

      const duplicateEscalation = await Question.findOne(topicQuery);
      if (duplicateEscalation) {
        throw new AppError(`An escalation is already open for a query on the same topic: "${duplicateEscalation.title}"`, 400);
      }
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
        title: '⚠️ Question escalated - needs attention',
        message: `Question "${question.title}" was escalated by the author: ${reason || 'No response received within 24 hours'}`,
        link: `/questions/${question._id}`,
        referenceType: 'Question',
        reference: question._id,
      })
    ));

    // Emit real-time update to admin panel
    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'question_escalated', questionId: question._id });
    } catch (socketErr) {
      console.error('Socket notification error in escalateQuestion:', socketErr.message);
    }

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

    // Audit Log
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      adminId: req.user._id,
      action: 'resolve_escalation',
      targetId: question._id,
      targetType: 'Question',
      reason: `Resolved escalation for question: "${question.title}"` + (resolutionNote ? `. Note: ${resolutionNote}` : '')
    });

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

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'resolve_escalation', questionId: question._id });
    } catch (socketErr) {
      console.error('Socket notification error in resolveEscalation:', socketErr.message);
    }

    res.json({ message: 'Escalation resolved', question });
  } catch (err) {
    next(err);
  }
};

exports.getEscalatedQuestions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const isModOrAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    const filter = {};

    if (!isModOrAdmin) {
      // Normal users can only see their own escalated questions (both active and resolved)
      filter.author = req.user._id;
      filter.isEscalated = true;
    } else {
      // Admins/mods see active escalated queries by default, or filtered by status
      if (status === 'resolved') {
        filter.resolutionStatus = 'resolved';
        filter.isEscalated = true;
      } else if (status === 'all') {
        filter.isEscalated = true;
      } else {
        filter.resolutionStatus = 'escalated';
      }
    }

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .sort({ escalatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title escalationReason escalatedAt resolutionStatus isEscalated answerCount tagNames')
        .populate('author', 'username displayName'),
      Question.countDocuments(filter),
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

exports.validateQuestionText = async (req, res, next) => {
  try {
    const { title, body } = req.body;

    // Heuristic 1: Repeated Character Pattern /(.)\1{6,}/
    const repeatedCharPattern = /(.)\1{6,}/;
    if ((title && repeatedCharPattern.test(title)) || (body && repeatedCharPattern.test(body))) {
      return res.json({ valid: false, reason: "Message contains repeated character patterns (spam/noise)." });
    }

    // Heuristic 2: Gibberish detection
    const isGibberish = (text) => {
      if (!text || text.length < 5) return false;
      const lower = text.toLowerCase();
      const letters = lower.replace(/[^a-z]/g, '');
      if (letters.length < 5) return false;
      // Check vowel ratio — real words need at least 10% vowels
      const vowels = (letters.match(/[aeiou]/g) || []).length;
      const vowelRatio = vowels / letters.length;
      if (vowelRatio < 0.10) return true; // nearly no vowels = gibberish
      // Check consecutive consonant clusters (6+ in a row)
      if (/[bcdfghjklmnpqrstvwxyz]{6,}/.test(lower)) return true;
      // Check unique char ratio — real sentences have repetition
      const uniqueChars = new Set(letters).size;
      const uniqueRatio = uniqueChars / letters.length;
      if (letters.length > 12 && uniqueRatio > 0.85) return true;
      return false;
    };

    if ((title && isGibberish(title)) || (body && isGibberish(body))) {
      return res.json({ valid: false, reason: "Your input appears to be gibberish or random characters. Please write a clear, meaningful question." });
    }

    // Call FastAPI AI microservice for zero-shot validation (if title is provided)
    if (title && title.trim().length >= 8) {
      try {
        const axios = require('axios');
        const config = require('../config');
        const response = await axios.post(`${config.fastApiUrl}/api/v1/validate`, {
          text: title
        }, { timeout: 1500 }); // Fast timeout for typing responsiveness

        if (response.data && response.data.valid === false) {
          return res.json({
            valid: false,
            reason: response.data.reason || 'AI flagged this as unreadable noise.'
          });
        }
      } catch (err) {
        // Log but don't fail, fallback to valid since local checks passed
        console.error('[AI Validate typing] FastAPI validation failed or timed out:', err.message);
      }
    }

    return res.json({ valid: true });
  } catch (err) {
    next(err);
  }
};

