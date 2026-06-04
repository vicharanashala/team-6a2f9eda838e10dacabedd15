const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Answer = require('../models/Answer');
const Question = require('../models/Question');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');
const { paginate, buildPaginationMeta } = require('../utils/helpers');
const { emitToUser, emitToQuestion } = require('../socket');
const { indexQuestion } = require('../services/searchService');
const { flagContent, clearFlag } = require('../services/moderationService');
const { broadcastLeaderboard } = require('../services/leaderboardService');

exports.createAnswer = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const question = await Question.findById(req.params.questionId);
    if (!question || question.isDeleted) throw new AppError('Question not found', 404);
    if (question.status === 'closed') throw new AppError('Question is closed', 400);

    let visibility = req.body.visibility;
    if (!visibility) {
      if (req.user.trustLevel === 'trusted' || req.user.trustLevel === 'regular') {
        visibility = 'public';
      } else if (req.user.premodApproved) {
        visibility = 'public';
      } else {
        const aCount = await Answer.countDocuments({ author: req.user._id });
        visibility = aCount < 5 ? 'pending' : 'public';
      }
    }

    const answer = await Answer.create({
      body: req.body.body,
      question: question._id,
      author: req.user._id,
      confidenceLevel: req.body.confidenceLevel || null,
      visibility,
      triggeredRule: req.body.triggeredRule || undefined
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { answerCount: 1 } });

    const populated = await Answer.findById(answer._id)
      .populate('author', 'username displayName avatar reputation');

    if (visibility === 'public') {
      question.answerCount += 1;
      question.lastActivity = new Date();
      await question.save();

      // Notify question author
      if (question.author.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: question.author,
          type: 'new_answer',
          title: 'New answer on your question',
          message: `${req.user.displayName || req.user.username} answered "${question.title}"`,
          link: `/questions/${question._id}`,
          referenceType: 'Answer',
          reference: answer._id,
        });
        emitToUser(question.author.toString(), 'notification:new', { answer: populated });

        // Send email notification to question author
        try {
          const { sendAnswerPostedNotification } = require('../services/emailService');
          await sendAnswerPostedNotification(populated, question);
        } catch (emailErr) {
          console.error('Email notification error:', emailErr.message);
        }
      }

      emitToQuestion(question._id.toString(), 'answer:new', { answer: populated });
    } else if (visibility === 'pending') {
      try {
        const { emitToAdmin } = require('../socket');
        emitToAdmin('moderation:updated', { action: 'new_pending_answer', answerId: answer._id });
      } catch (err) {
        console.error('Socket notification error for pending answer:', err.message);
      }
    }

    res.status(201).json({ answer: populated });
  } catch (err) {
    next(err);
  }
};

exports.getAnswers = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const questionId = new mongoose.Types.ObjectId(req.params.questionId);
    const filter = { question: questionId, isDeleted: false };

    const isModOrAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'moderator');
    const currentUserId = req.user ? req.user._id.toString() : null;

    const visibilityConditions = [];
    if (isModOrAdmin) {
      // Admins/mods see all answers
    } else if (currentUserId) {
      visibilityConditions.push({ visibility: 'public' });
      visibilityConditions.push({ author: req.user._id });
    } else {
      visibilityConditions.push({ visibility: 'public' });
    }

    if (visibilityConditions.length > 0) {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: visibilityConditions });
    }

    const sort = {};
    switch (req.query.sort) {
      case 'oldest': sort.createdAt = 1; break;
      case 'votes': sort.upvotes = -1; break;
      default: sort.createdAt = -1;
    }

    // Accepted answer first
    const pipeline = [
      { $match: filter },
      { $addFields: { isAccepted: { $ifNull: ['$isAccepted', false] } } },
      { $sort: { isAccepted: -1, ...sort } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author',
        },
      },
      { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          body: 1,
          upvotes: 1,
          downvotes: 1,
          isAccepted: 1,
          isOfficial: 1,
          solvedMyDoubtCount: 1,
          confidenceLevel: 1,
          createdAt: 1,
          updatedAt: 1,
          'author.username': 1,
          'author.displayName': 1,
          'author.avatar': 1,
          'author.reputation': 1,
        },
      },
    ];

    const [answers, total] = await Promise.all([
      Answer.aggregate(pipeline),
      Answer.countDocuments(filter),
    ]);

    res.json({ answers, pagination: buildPaginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
};

exports.updateAnswer = async (req, res, next) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer || answer.isDeleted) throw new AppError('Answer not found', 404);
    if (answer.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new AppError('Not authorized', 403);
    }

    answer.body = req.body.body || answer.body;
    await answer.save();

    const populated = await Answer.findById(answer._id)
      .populate('author', 'username displayName avatar reputation');
    res.json({ answer: populated });
  } catch (err) {
    next(err);
  }
};

exports.deleteAnswer = async (req, res, next) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer || answer.isDeleted) throw new AppError('Answer not found', 404);
    const isModOrAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    if (answer.author.toString() !== req.user._id.toString() && !isModOrAdmin) {
      throw new AppError('Not authorized', 403);
    }

    answer.isDeleted = true;
    answer.status = 'deleted';
    await answer.save();
    const { recalculateAnswerCount } = require('../utils/helpers');
    await recalculateAnswerCount(answer.question);
    res.json({ message: 'Answer deleted' });
  } catch (err) {
    next(err);
  }
};

exports.acceptAnswer = async (req, res, next) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer) throw new AppError('Answer not found', 404);

    const question = await Question.findById(answer.question);
    if (!question) throw new AppError('Question not found', 404);
    if (question.author.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Not authorized', 403);
    }

    // Remove previous accepted answer
    if (question.acceptedAnswer) {
      await Answer.findByIdAndUpdate(question.acceptedAnswer, { isAccepted: false });
    }

    answer.isAccepted = true;
    await answer.save();

    question.acceptedAnswer = answer._id;
    question.isFAQ = true;
    question.resolvedAt = new Date();
    await question.save();

    const populatedQuestion = await Question.findById(question._id)
      .populate('author', 'username displayName avatar reputation')
      .populate('tags', 'name color');
    await indexQuestion(populatedQuestion);

    // Reward answer author reputation (+15) and trustScore (+5)
    const authorUser = await User.findById(answer.author);
    if (authorUser) {
      authorUser.reputation += 15;
      authorUser.trustScore += 5;
      await authorUser.save();
    }

    await Notification.create({
      recipient: answer.author,
      type: 'answer_accepted',
      title: 'Your answer was accepted',
      message: `Your answer on "${question.title}" was accepted`,
      link: `/questions/${question._id}`,
      referenceType: 'Answer',
      reference: answer._id,
    });
    emitToUser(answer.author.toString(), 'notification:new', { accepted: true });

    if (question.meTooUsers && question.meTooUsers.length > 0) {
      const meTooNotifications = question.meTooUsers.map(userId => ({
        recipient: userId,
        type: 'question_answered',
        title: 'A question you follow has an answer',
        message: `"${question.title}" now has an accepted answer`,
        link: `/questions/${question._id}`,
        referenceType: 'Question',
        reference: question._id,
      }));
      await Notification.insertMany(meTooNotifications);
      question.meTooUsers.forEach(userId => {
        emitToUser(userId.toString(), 'notification:new', { questionAnswered: true });
      });

      // Doubt solved email notifications are disabled to prevent non-compliant outbound emails
    }

    await broadcastLeaderboard();
    res.json({ answer, message: 'Answer accepted' });
  } catch (err) {
    next(err);
  }
};

exports.unacceptAnswer = async (req, res, next) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer) throw new AppError('Answer not found', 404);

    const question = await Question.findById(answer.question);
    if (!question) throw new AppError('Question not found', 404);
    if (question.author.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin' && req.user.role !== 'moderator') {
      throw new AppError('Not authorized', 403);
    }

    if (question.acceptedAnswer?.toString() !== answer._id.toString()) {
      throw new AppError('This answer is not the accepted answer', 400);
    }

    answer.isAccepted = false;
    await answer.save();

    question.acceptedAnswer = null;
    question.isFAQ = false;
    question.resolvedAt = null;
    await question.save();

    const populatedQuestion = await Question.findById(question._id)
      .populate('author', 'username displayName avatar reputation')
      .populate('tags', 'name color');
    await indexQuestion(populatedQuestion);

    // Remove reputation reward reputation (-15) and trustScore (-5)
    const authorUser = await User.findById(answer.author);
    if (authorUser) {
      authorUser.reputation = Math.max(0, authorUser.reputation - 15);
      authorUser.trustScore = Math.max(0, authorUser.trustScore - 5);
      await authorUser.save();
    }

    await broadcastLeaderboard();
    res.json({ answer, message: 'Answer unaccepted' });
  } catch (err) {
    next(err);
  }
};

exports.toggleSolvedMyDoubt = async (req, res, next) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer || answer.isDeleted) throw new AppError('Answer not found', 404);

    if (answer.author.toString() === req.user._id.toString()) {
      throw new AppError('You cannot mark your own answer as solving your doubt', 400);
    }

    const userId = req.user._id;
    const alreadySolved = answer.solvedByUsers.some(u => u.toString() === userId.toString());

    if (alreadySolved) {
      answer.solvedByUsers = answer.solvedByUsers.filter(u => u.toString() !== userId.toString());
      answer.solvedMyDoubtCount = Math.max(0, answer.solvedMyDoubtCount - 1);
    } else {
      answer.solvedByUsers.push(userId);
      answer.solvedMyDoubtCount += 1;
    }

    await answer.save();

    emitToQuestion(answer.question.toString(), 'answer:solvedUpdated', {
      answerId: answer._id,
      solvedMyDoubtCount: answer.solvedMyDoubtCount,
    });

    await broadcastLeaderboard();
    res.json({
      solvedMyDoubtCount: answer.solvedMyDoubtCount,
      hasSolvedMyDoubt: !alreadySolved,
    });
  } catch (err) {
    next(err);
  }
};

const VALID_FLAG_REASONS = ['incorrect', 'incomplete', 'unclear', 'harmful', 'spam', 'other'];

exports.flagAnswer = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !VALID_FLAG_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Invalid flag reason', validReasons: VALID_FLAG_REASONS });
    }

    const answer = await Answer.findById(req.params.id);
    if (!answer || answer.isDeleted) throw new AppError('Answer not found', 404);

    await flagContent({ targetType: 'Answer', targetId: req.params.id, reason, flaggedBy: req.user._id });

    res.json({ message: 'Answer flagged', reason });
  } catch (err) {
    next(err);
  }
};

exports.clearFlagAnswer = async (req, res, next) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer || answer.isDeleted) throw new AppError('Answer not found', 404);

    await clearFlag({ targetType: 'Answer', targetId: req.params.id });

    res.json({ message: 'Answer flag cleared' });
  } catch (err) {
    next(err);
  }
};
