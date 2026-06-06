const Tag = require('../models/Tag');
const Question = require('../models/Question');
const { AppError } = require('../middleware/errorHandler');

exports.getTags = async (req, res, next) => {
  try {
    // 1. Run an aggregation on Question to get counts of public, non-deleted questions per tag
    const tagCounts = await Question.aggregate([
      {
        $match: {
          visibility: 'public',
          isDeleted: false,
          lastVerifiedAt: { $exists: true, $ne: null }
        }
      },
      {
        $unwind: '$tags'
      },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      }
    ]);

    // Create a map of tag ID to count
    const countMap = {};
    const activeTagIds = [];
    tagCounts.forEach(tc => {
      countMap[tc._id.toString()] = tc.count;
      activeTagIds.push(tc._id);
    });

    // 2. Fetch the corresponding Tag documents
    const filter = { _id: { $in: activeTagIds } };
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const rawTags = await Tag.find(filter).limit(100);

    // Map counts to tags and sort them
    const tags = rawTags.map(tag => {
      const obj = tag.toObject();
      obj.questionCount = countMap[tag._id.toString()] || 0;
      return obj;
    }).filter(t => t.questionCount > 0)
      .sort((a, b) => b.questionCount - a.questionCount);

    res.json({ tags });
  } catch (err) {
    next(err);
  }
};

exports.getTag = async (req, res, next) => {
  try {
    const tag = await Tag.findOne({ name: req.params.name.toLowerCase() });
    if (!tag) throw new AppError('Tag not found', 404);
    res.json({ tag });
  } catch (err) {
    next(err);
  }
};

exports.createTag = async (req, res, next) => {
  try {
    const { name, description, color, category } = req.body;
    const existing = await Tag.findOne({ name: name.toLowerCase().trim() });
    if (existing) throw new AppError('Tag already exists', 409);

    const tag = await Tag.create({ name: name.toLowerCase().trim(), description, color, category });
    res.status(201).json({ tag });
  } catch (err) {
    next(err);
  }
};

exports.updateTag = async (req, res, next) => {
  try {
    const tag = await Tag.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!tag) throw new AppError('Tag not found', 404);
    res.json({ tag });
  } catch (err) {
    next(err);
  }
};
