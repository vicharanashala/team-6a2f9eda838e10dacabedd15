const Vote = require('../models/Vote');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');
const { emitToUser } = require('../socket');

const voteLocks = new Map();

const acquireVoteLock = (userId, targetId) => {
  const key = `${userId}:${targetId}`;
  if (voteLocks.has(key)) return false;
  voteLocks.set(key, true);
  return true;
};

const releaseVoteLock = (userId, targetId) => {
  const key = `${userId}:${targetId}`;
  voteLocks.delete(key);
};

exports.vote = async (req, res, next) => {
  const { targetType, targetId, voteType, reason, reasonText } = req.body;

  if (!['Question', 'Answer'].includes(targetType)) {
    return next(new AppError('Invalid target type', 400));
  }
  if (!['upvote', 'downvote'].includes(voteType)) {
    return next(new AppError('Invalid vote type', 400));
  }
  if (voteType === 'downvote' && reason) {
    const validReasons = ['incorrect', 'incomplete', 'unclear', 'harmful', 'spam', 'other'];
    if (!validReasons.includes(reason)) {
      return next(new AppError('Invalid reason', 400));
    }
  }

  if (!acquireVoteLock(req.user._id, targetId)) {
    return next(new AppError('Vote already in progress', 429));
  }

  try {
    const Model = targetType === 'Question' ? Question : Answer;
    const target = await Model.findById(targetId);
    if (!target || target.isDeleted) {
      releaseVoteLock(req.user._id, targetId);
      return next(new AppError('Target not found', 404));
    }

    const existingVote = await Vote.findOne({
      user: req.user._id,
      target: targetId,
      targetType,
    });

    if (existingVote && existingVote.voteType === voteType) {
      await existingVote.deleteOne();
      await Model.findByIdAndUpdate(targetId, { $inc: { [`${voteType}s`]: -1 } });
      if (target.author.toString() !== req.user._id.toString()) {
        await User.findByIdAndUpdate(target.author, { $inc: { reputation: voteType === 'upvote' ? -10 : 10 } });
      }
      releaseVoteLock(req.user._id, targetId);
      try {
        const { broadcastLeaderboard } = require('../services/leaderboardService');
        broadcastLeaderboard();
      } catch (lErr) {}
      return res.json({ message: 'Vote removed', vote: null });
    }

    if (existingVote) {
      const oldType = existingVote.voteType;
      existingVote.voteType = voteType;
      existingVote.reason = voteType === 'downvote' ? reason : null;
      existingVote.reasonText = voteType === 'downvote' ? reasonText : null;
      await existingVote.save();
      await Model.findByIdAndUpdate(targetId, { $inc: { [`${oldType}s`]: -1, [`${voteType}s`]: 1 } });
      if (target.author.toString() !== req.user._id.toString()) {
        await User.findByIdAndUpdate(target.author, { $inc: { reputation: voteType === 'upvote' ? 10 : -10 } });
      }
      releaseVoteLock(req.user._id, targetId);
      try {
        const { broadcastLeaderboard } = require('../services/leaderboardService');
        broadcastLeaderboard();
      } catch (lErr) {}
      return res.json({ message: 'Vote updated', vote: existingVote });
    }

    const vote = await Vote.create({
      user: req.user._id,
      target: targetId,
      targetType,
      voteType,
      reason: voteType === 'downvote' ? reason : null,
      reasonText: voteType === 'downvote' ? reasonText : null,
    });
    await Model.findByIdAndUpdate(targetId, { $inc: { [`${voteType}s`]: 1 } });

    if (target.author.toString() !== req.user._id.toString()) {
      const repChange = voteType === 'upvote' ? 10 : -10;
      await User.findByIdAndUpdate(target.author, { $inc: { reputation: repChange } });
    }

    if (voteType === 'upvote' && target.author.toString() !== req.user._id.toString()) {
      const questionId = targetType === 'Question'
        ? targetId
        : (target.question && target.question._id ? target.question._id.toString() : target.question.toString());
      const linkUrl = targetType === 'Question'
        ? `/questions/${targetId}`
        : `/questions/${questionId}#answer-${target._id.toString()}`;

      await Notification.create({
        recipient: target.author,
        type: 'upvote',
        title: 'You received an upvote',
        message: `Your ${targetType.toLowerCase()} received an upvote`,
        link: linkUrl,
        referenceType: targetType,
        reference: targetId,
      });
      emitToUser(target.author.toString(), 'notification:new', { upvote: true });
    }

    if (voteType === 'downvote' && target.author.toString() !== req.user._id.toString()) {
      const reasonLabels = {
        incorrect: 'This is incorrect',
        incomplete: 'This is incomplete',
        unclear: 'This is unclear',
        harmful: 'This is harmful',
        spam: 'This is spam',
        other: 'See feedback below',
      };

      const questionId = targetType === 'Question'
        ? targetId
        : (target.question && target.question._id ? target.question._id.toString() : target.question.toString());
      const linkUrl = targetType === 'Question'
        ? `/questions/${targetId}`
        : `/questions/${questionId}#answer-${target._id.toString()}`;

      await Notification.create({
        recipient: target.author,
        type: 'downvote',
        title: 'You received feedback on your post',
        message: reasonText
          ? `${reasonLabels[reason] || 'Feedback'}: ${reasonText}`
          : `${reasonLabels[reason] || 'Feedback'}: A downvote was received`,
        link: linkUrl,
        referenceType: targetType,
        reference: targetId,
      });
      emitToUser(target.author.toString(), 'notification:new', { downvote: true });
    }

    releaseVoteLock(req.user._id, targetId);
    try {
      const { broadcastLeaderboard } = require('../services/leaderboardService');
      broadcastLeaderboard();
    } catch (lErr) {}
    res.status(201).json({ message: 'Voted', vote });
  } catch (err) {
    releaseVoteLock(req.user._id, targetId);
    next(err);
  }
};

exports.getVoteStatus = async (req, res, next) => {
  try {
    const { targetType, targetId } = req.params;
    if (!req.user) return res.json({ vote: null });

    const vote = await Vote.findOne({
      user: req.user._id,
      target: targetId,
      targetType,
    });
    res.json({ vote: vote ? vote.voteType : null });
  } catch (err) {
    next(err);
  }
};

exports.getBatchVoteStatus = async (req, res, next) => {
  try {
    const { ids, targetType } = req.query;
    if (!req.user || !ids) return res.json({});

    const idArray = ids.split(',').slice(0, 50);
    const votes = await Vote.find({
      user: req.user._id,
      target: { $in: idArray },
      targetType,
    });

    const voteMap = {};
    votes.forEach(v => { voteMap[v.target.toString()] = v.voteType; });
    res.json(voteMap);
  } catch (err) {
    next(err);
  }
};

exports.getDownvoteFeedback = async (req, res, next) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));

    const { targetType, targetId } = req.params;
    if (!['Question', 'Answer'].includes(targetType)) {
      return next(new AppError('Invalid target type', 400));
    }

    const Model = targetType === 'Question' ? Question : Answer;
    const target = await Model.findById(targetId);
    if (!target) return next(new AppError('Not found', 404));

    if (target.author.toString() !== req.user._id.toString()) {
      return next(new AppError('You can only see feedback on your own posts', 403));
    }

    const feedback = await Vote.find({
      target: targetId,
      targetType,
      voteType: 'downvote',
      reason: { $exists: true, $ne: null },
    }).select('reason reasonText createdAt').sort({ createdAt: -1 });

    res.json({ feedback });
  } catch (err) {
    next(err);
  }
};
