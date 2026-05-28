const { validationResult } = require('express-validator');
const Question = require('../models/Question');
const Tag = require('../models/Tag');
const { AppError } = require('../middleware/errorHandler');
const { paginate, buildPaginationMeta } = require('../utils/helpers');
const { indexQuestion, deleteQuestionIndex } = require('../services/searchService');
const { emitToQuestion } = require('../socket');

exports.createQuestion = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, body, tags } = req.body;
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

    const questionData = {
      title,
      body,
      author: req.user._id,
      tags: tagIds,
      tagNames,
      lastActivity: new Date(),
    };

    if (existingQuestion) {
      questionData.isAlreadyAsked = true;
      questionData.scopeMatch = existingQuestion.scopeMatch;
      questionData.relatedQuestions = [existingQuestion.question._id];
    }

    const question = await Question.create(questionData);

    if (existingQuestion) {
      await Question.findByIdAndUpdate(existingQuestion.question._id, {
        $addToSet: { relatedQuestions: question._id },
      });
    }

    await Question.findByIdAndUpdate(req.user._id, { $inc: { questionCount: 1 } });

    const populated = await Question.findById(question._id)
      .populate('author', 'username displayName avatar reputation')
      .populate('tags', 'name color')
      .populate('relatedQuestions', 'title answerCount');

    await indexQuestion(populated);

    res.status(201).json({ question: populated, alreadyAsked: existingQuestion ? {
      isAlreadyAsked: true,
      scopeMatch: existingQuestion.scopeMatch,
      matchedQuestion: {
        _id: existingQuestion.question._id,
        title: existingQuestion.question.title,
        answerCount: existingQuestion.question.answerCount,
      },
    } : null });
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
      const scopeMatch = hasSimilarTitle && hasMatchingTags ? 'similar' : 'tag';
      return { question: similarMatch, scopeMatch };
    }
  }

  return null;
}

exports.getQuestions = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const filter = { status: 'open', isDeleted: false };

    if (req.query.tag) filter.tagNames = req.query.tag.toLowerCase();
    if (req.query.author) filter.author = req.query.author;
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const sort = {};
    switch (req.query.sort) {
      case 'newest': sort.createdAt = -1; break;
      case 'active': sort.lastActivity = -1; break;
      case 'votes':
      case 'liked': sort.upvotes = -1; break;
      case 'views': sort.viewCount = -1; break;
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

    res.json({ questions, pagination: buildPaginationMeta(total, page, limit) });
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

    await Question.findByIdAndUpdate(question._id, { $inc: { viewCount: 1 } });

    res.json({ question });
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
    if (question.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new AppError('Not authorized', 403);
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
      .select('title upvotes answerCount viewCount tagNames')
      .populate('author', 'username displayName');

    res.json({ similar });
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
      .select('title upvotes answerCount viewCount tagNames status isDuplicate duplicateOf')
      .populate('author', 'username displayName');

    const duplicates = questions.filter(q => q.status === 'closed' && q.isDuplicate);
    const similar = questions.filter(q => !q.isDuplicate || q.status !== 'closed');

    res.json({ similar, duplicates });
  } catch (err) {
    next(err);
  }
};
