const { validationResult } = require('express-validator');
const FAQ = require('../models/FAQ');
const { AppError } = require('../middleware/errorHandler');
const { paginate, buildPaginationMeta, generateSlug } = require('../utils/helpers');
const { indexFAQ, indexFAQItem, deleteFAQIndex, deleteFAQItemIndex } = require('../services/searchService');

exports.createFAQ = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, slug, description, category, icon, tags, items } = req.body;
    const finalSlug = slug || generateSlug(title);

    const existing = await FAQ.findOne({ slug: finalSlug });
    if (existing) throw new AppError('FAQ with this slug already exists', 409);

    const faq = await FAQ.create({
      title,
      slug: finalSlug,
      description,
      category,
      icon,
      tags,
      items: items || [],
      author: req.user._id,
    });

    await indexFAQ(faq);
    res.status(201).json({ faq });
  } catch (err) {
    next(err);
  }
};

exports.getFAQs = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const filter = { isPublished: true };

    if (req.query.category) filter.category = req.query.category;
    if (req.query.tag) filter.tags = req.query.tag;
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const sort = {};
    switch (req.query.sort) {
      case 'newest': sort.createdAt = -1; break;
      case 'views': sort.viewCount = -1; break;
      case 'saved': sort.saveCount = -1; break;
      case 'title': sort.title = 1; break;
      default: sort.createdAt = -1;
    }

    const [faqs, total] = await Promise.all([
      FAQ.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('title slug description category icon tags viewCount saveCount isOfficial createdAt items')
        .populate('author', 'username displayName'),
      FAQ.countDocuments(filter),
    ]);

    const faqsWithCounts = faqs.map(faq => ({
      ...faq.toObject(),
      itemCount: faq.items.filter(i => i.isPublished).length,
    }));

    res.json({ faqs: faqsWithCounts, pagination: buildPaginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
};

exports.getFAQBySlug = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const query = { isPublished: true };
    if (mongoose.Types.ObjectId.isValid(req.params.slug)) {
      query.$or = [
        { _id: req.params.slug },
        { slug: req.params.slug }
      ];
    } else {
      query.slug = req.params.slug;
    }

    const faq = await FAQ.findOne(query)
      .populate('author', 'username displayName avatar')
      .populate('items.reviewedBy', 'username displayName');

    if (!faq) throw new AppError('FAQ not found', 404);
    await FAQ.findByIdAndUpdate(faq._id, { $inc: { viewCount: 1 } });

    const userId = req.user?._id;
    if (userId) {
      const { recordTagAffinity } = require('../services/recommendationService');
      if (faq.tags && faq.tags.length > 0) {
        recordTagAffinity(userId, faq.tags);
      }
      faq.items.forEach(item => {
        const userVote = item.userFeedback.find(f => f.user.toString() === userId.toString());
        item.userVote = userVote ? (userVote.helpful ? 'helpful' : 'notHelpful') : null;
      });
    }

    res.json({ faq });
  } catch (err) {
    next(err);
  }
};

exports.updateFAQ = async (req, res, next) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) throw new AppError('FAQ not found', 404);

    const allowed = ['title', 'description', 'category', 'icon', 'tags', 'isPublished', 'isOfficial'];
    for (const field of allowed) {
      if (req.body[field] !== undefined) faq[field] = req.body[field];
    }
    if (req.body.items) faq.items = req.body.items;
    if (req.body.slug) faq.slug = req.body.slug;

    await faq.save();
    await indexFAQ(faq);
    res.json({ faq });
  } catch (err) {
    next(err);
  }
};

exports.deleteFAQ = async (req, res, next) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) throw new AppError('FAQ not found', 404);
    await FAQ.findByIdAndDelete(req.params.id);
    await deleteFAQIndex(req.params.id);
    res.json({ message: 'FAQ deleted' });
  } catch (err) {
    next(err);
  }
};

exports.addFAQItem = async (req, res, next) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) throw new AppError('FAQ not found', 404);

    const { question, answer, tags } = req.body;
    if (!question || !answer) throw new AppError('Question and answer required', 400);

    faq.items.push({
      question,
      answer,
      tags: tags || [],
      order: faq.items.length,
    });
    await faq.save();
    const newItem = faq.items[faq.items.length - 1];
    await indexFAQItem(faq, newItem);
    res.status(201).json({ faq });
  } catch (err) {
    next(err);
  }
};

exports.updateFAQItem = async (req, res, next) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) throw new AppError('FAQ not found', 404);

    const item = faq.items.id(req.params.itemId);
    if (!item) throw new AppError('FAQ item not found', 404);

    const allowed = ['question', 'answer', 'order', 'isPublished', 'tags'];
    for (const field of allowed) {
      if (req.body[field] !== undefined) item[field] = req.body[field];
    }

    item.lastReviewed = new Date();
    item.reviewedBy = req.user._id;

    await faq.save();
    await indexFAQItem(faq, item);
    res.json({ faq });
  } catch (err) {
    next(err);
  }
};

exports.deleteFAQItem = async (req, res, next) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) throw new AppError('FAQ not found', 404);
    faq.items.pull({ _id: req.params.itemId });
    await faq.save();
    await deleteFAQItemIndex(req.params.id, req.params.itemId);
    res.json({ faq });
  } catch (err) {
    next(err);
  }
};

exports.markFAQHelpful = async (req, res, next) => {
  try {
    const { helpful, undo } = req.body;
    const faq = await FAQ.findById(req.params.id);
    if (!faq) throw new AppError('FAQ not found', 404);

    const item = faq.items.id(req.params.itemId);
    if (!item) throw new AppError('FAQ item not found', 404);

    const userId = req.user._id;
    const existingFeedback = item.userFeedback.find(f => f.user.toString() === userId.toString());

    if (undo && existingFeedback) {
      if (existingFeedback.helpful) {
        item.helpfulCount = Math.max(0, item.helpfulCount - 1);
      } else {
        item.notHelpfulCount = Math.max(0, item.notHelpfulCount - 1);
      }
      item.userFeedback = item.userFeedback.filter(f => f.user.toString() !== userId.toString());
      await faq.save();
      return res.json({ message: 'Vote removed', helpfulCount: item.helpfulCount, notHelpfulCount: item.notHelpfulCount, voted: null });
    }

    if (existingFeedback) {
      if (existingFeedback.helpful === helpful) {
        return res.status(400).json({ message: 'You have already voted on this item', voted: helpful ? 'helpful' : 'notHelpful' });
      }
      if (existingFeedback.helpful) {
        item.helpfulCount -= 1;
        item.notHelpfulCount += 1;
      } else {
        item.notHelpfulCount -= 1;
        item.helpfulCount += 1;
      }
      existingFeedback.helpful = helpful;
      existingFeedback.votedAt = new Date();
    } else {
      if (helpful) item.helpfulCount += 1;
      else item.notHelpfulCount += 1;
      item.userFeedback.push({ user: userId, helpful });
    }

    if (userId && helpful && !undo) {
      const { recordTagAffinity } = require('../services/recommendationService');
      const allTags = [...(faq.tags || []), ...(item.tags || [])];
      if (allTags.length > 0) {
        recordTagAffinity(userId, allTags);
      }
    }

    await faq.save();
    res.json({ message: 'Feedback recorded', helpfulCount: item.helpfulCount, notHelpfulCount: item.notHelpfulCount, voted: helpful ? 'helpful' : 'notHelpful' });
  } catch (err) {
    next(err);
  }
};

exports.getRecommendedFAQs = async (req, res, next) => {
  try {
    const { getRecommendedFAQs } = require('../services/recommendationService');
    const userId = req.user ? req.user._id : null;
    const faqs = await getRecommendedFAQs(userId);
    res.json({ faqs });
  } catch (err) {
    next(err);
  }
};
