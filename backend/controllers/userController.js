const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const FAQ = require('../models/FAQ');
const SavedQuestion = require('../models/SavedQuestion');
const SavedFAQ = require('../models/SavedFAQ');
const { AppError } = require('../middleware/errorHandler');
const { paginate, buildPaginationMeta } = require('../utils/helpers');
const { getLeaderboardData } = require('../services/leaderboardService');

exports.getUserProfile = async (req, res, next) => {
  try {
    const safeUsername = req.params.username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const user = await User.findOne({ username: { $regex: new RegExp(`^${safeUsername}$`, 'i') } });
    if (!user) throw new AppError('User not found', 404);

    const [questions, answers, questionLikes, answerLikes, questionVotes, answerVotes, savedQuestionsCount, savedFaqsCount] = await Promise.all([
      Question.countDocuments({ author: user._id, isDeleted: false }),
      Answer.countDocuments({ author: user._id, isDeleted: false }),
      Question.aggregate([
        { $match: { author: user._id, isDeleted: false } },
        { $group: { _id: null, total: { $sum: '$upvotes' } } }
      ]),
      Answer.aggregate([
        { $match: { author: user._id, isDeleted: false } },
        { $group: { _id: null, total: { $sum: '$upvotes' } } }
      ]),
      Question.aggregate([
        { $match: { author: user._id, isDeleted: false } },
        { $group: { _id: null, up: { $sum: '$upvotes' }, down: { $sum: '$downvotes' } } }
      ]),
      Answer.aggregate([
        { $match: { author: user._id, isDeleted: false } },
        { $group: { _id: null, up: { $sum: '$upvotes' }, down: { $sum: '$downvotes' } } }
      ]),
      SavedQuestion.countDocuments({ user: user._id }),
      SavedFAQ.countDocuments({ user: user._id })
    ]);

    const totalLikes = (questionLikes[0]?.total || 0) + (answerLikes[0]?.total || 0);
    const totalVotes = (questionVotes[0]?.up || 0) + (questionVotes[0]?.down || 0) + (answerVotes[0]?.up || 0) + (answerVotes[0]?.down || 0);
    const totalBookmarks = savedQuestionsCount + savedFaqsCount;

    res.json({
      user: {
        ...user.toPublicJSON(),
        questionCount: questions,
        answerCount: answers,
        totalLikes,
        totalVotes,
        totalBookmarks
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getUserQuestions = async (req, res, next) => {
  try {
    const safeUsername = req.params.username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const user = await User.findOne({ username: { $regex: new RegExp(`^${safeUsername}$`, 'i') } });
    if (!user) throw new AppError('User not found', 404);

    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const [questions, total] = await Promise.all([
      Question.find({ author: user._id, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('tags', 'name color')
        .select('title upvotes answerCount viewCount createdAt tagNames'),
      Question.countDocuments({ author: user._id, isDeleted: false }),
    ]);

    res.json({ questions, pagination: buildPaginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
};

exports.getUserAnswers = async (req, res, next) => {
  try {
    const safeUsername = req.params.username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const user = await User.findOne({ username: { $regex: new RegExp(`^${safeUsername}$`, 'i') } });
    if (!user) throw new AppError('User not found', 404);

    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const [answers, total] = await Promise.all([
      Answer.find({ author: user._id, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'question', select: 'title slug', match: { isDeleted: false } })
        .select('body upvotes isAccepted createdAt'),
      Answer.countDocuments({ author: user._id, isDeleted: false }),
    ]);

    res.json({ answers: answers.filter(a => a.question), pagination: buildPaginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
};

exports.getMeTooQuestions = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const filter = { meTooUsers: req.user._id, isDeleted: false };
    const [questions, total] = await Promise.all([
      Question.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username displayName avatar reputation')
        .populate('tags', 'name color'),
      Question.countDocuments(filter),
    ]);

    res.json({ questions, pagination: buildPaginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
};

exports.completeOnboarding = async (req, res, next) => {
  try {
    const { currentPhase } = req.body;
    const updates = { hasCompletedOnboarding: true };
    if (currentPhase) {
      updates.currentPhase = currentPhase;
    }
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });

    // Invalidate recommendation cache
    try {
      const { getRedis } = require('../config/redis');
      const redis = getRedis();
      await redis.del(`recommendations:user:${req.user._id.toString()}`);
    } catch (redisErr) {
      console.error('Redis delete recommendation cache error:', redisErr.message);
    }

    res.json({ message: 'Onboarding completed', user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
};

exports.saveQuestion = async (req, res, next) => {
  try {
    const { questionId } = req.body;
    const question = await Question.findById(questionId);
    if (!question) throw new AppError('Question not found', 404);

    const existing = await SavedQuestion.findOne({ user: req.user._id, question: questionId });
    if (existing) throw new AppError('Already saved', 409);

    await SavedQuestion.create({ user: req.user._id, question: questionId });
    await Question.findByIdAndUpdate(questionId, { $inc: { saveCount: 1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { savedCount: 1 } });

    res.status(201).json({ message: 'Question saved' });
  } catch (err) {
    next(err);
  }
};

exports.unsaveQuestion = async (req, res, next) => {
  try {
    const saved = await SavedQuestion.findOne({ user: req.user._id, question: req.params.questionId });
    if (!saved) throw new AppError('Not saved', 404);

    await saved.deleteOne();
    await Question.findByIdAndUpdate(req.params.questionId, { $inc: { saveCount: -1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { savedCount: -1 } });

    res.json({ message: 'Question unsaved' });
  } catch (err) {
    next(err);
  }
};

exports.getSavedQuestions = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const filter = { user: req.user._id };
    if (req.query.tag) {
      filter.tags = req.query.tag;
    }
    const [saved, total] = await Promise.all([
      SavedQuestion.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'question',
          match: { isDeleted: false },
          populate: { path: 'author', select: 'username displayName avatar reputation' },
        }),
      SavedQuestion.countDocuments(filter),
    ]);

    res.json({ saved: saved.filter(s => s.question), pagination: buildPaginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
};

exports.getSavedTags = async (req, res, next) => {
  try {
    const tags = await SavedQuestion.distinct('tags', { user: req.user._id, tags: { $exists: true, $ne: [] } });
    res.json({ tags: tags.filter(t => t) });
  } catch (err) {
    next(err);
  }
};

exports.updateSavedQuestion = async (req, res, next) => {
  try {
    const { notes, tags } = req.body;
    const saved = await SavedQuestion.findOne({ user: req.user._id, question: req.params.questionId });
    if (!saved) throw new AppError('Not saved', 404);

    if (notes !== undefined) saved.notes = notes;
    if (tags !== undefined) saved.tags = tags;

    await saved.save();
    res.json({ message: 'Saved question updated', saved });
  } catch (err) {
    next(err);
  }
};

exports.saveFAQ = async (req, res, next) => {
  try {
    const { faqId } = req.body;
    const faq = await FAQ.findById(faqId);
    if (!faq) throw new AppError('FAQ not found', 404);

    const existing = await SavedFAQ.findOne({ user: req.user._id, faq: faqId });
    if (existing) throw new AppError('Already saved', 409);

    await SavedFAQ.create({ user: req.user._id, faq: faqId });
    await FAQ.findByIdAndUpdate(faqId, { $inc: { saveCount: 1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { savedCount: 1 } });

    if (faq.tags && faq.tags.length > 0) {
      const { recordTagAffinity } = require('../services/recommendationService');
      recordTagAffinity(req.user._id, faq.tags);
    }

    res.status(201).json({ message: 'FAQ saved' });
  } catch (err) {
    next(err);
  }
};

exports.unsaveFAQ = async (req, res, next) => {
  try {
    const saved = await SavedFAQ.findOne({ user: req.user._id, faq: req.params.faqId });
    if (!saved) throw new AppError('Not saved', 404);

    await saved.deleteOne();
    await FAQ.findByIdAndUpdate(req.params.faqId, { $inc: { saveCount: -1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { savedCount: -1 } });

    res.json({ message: 'FAQ unsaved' });
  } catch (err) {
    next(err);
  }
};

exports.getSavedFAQs = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const filter = { user: req.user._id };
    if (req.query.tag) {
      filter.tags = req.query.tag;
    }
    const [saved, total] = await Promise.all([
      SavedFAQ.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'faq',
        }),
      SavedFAQ.countDocuments(filter),
    ]);

    res.json({ saved: saved.filter(s => s.faq), pagination: buildPaginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
};

exports.getSavedFAQTags = async (req, res, next) => {
  try {
    const tags = await SavedFAQ.distinct('tags', { user: req.user._id, tags: { $exists: true, $ne: [] } });
    res.json({ tags: tags.filter(t => t) });
  } catch (err) {
    next(err);
  }
};

exports.updateSavedFAQ = async (req, res, next) => {
  try {
    const { notes, tags } = req.body;
    const saved = await SavedFAQ.findOne({ user: req.user._id, faq: req.params.faqId });
    if (!saved) throw new AppError('Not saved', 404);

    if (notes !== undefined) saved.notes = notes;
    if (tags !== undefined) saved.tags = tags;

    await saved.save();
    res.json({ message: 'Saved FAQ updated', saved });
  } catch (err) {
    next(err);
  }
};

exports.getLeaderboard = async (req, res, next) => {
  try {
    const data = await getLeaderboardData();
    res.json({ leaderboard: data });
  } catch (err) {
    next(err);
  }
};
