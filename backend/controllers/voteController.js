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
      await Notification.create({
        recipient: target.author,
        type: 'upvote',
        title: 'You received an upvote',
        message: `Your ${targetType.toLowerCase()} received an upvote`,
        link: `/${targetType === 'Question' ? 'questions' : 'answers'}/${targetId}`,
        referenceType: targetType,
        reference: targetId,
      });
      emitToUser(target.author.toString(), 'notification:new', { upvote: true });
    }

    releaseVoteLock(req.user._id, targetId);
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
