const router = require('express').Router();
const { auth, moderatorOrAdmin } = require('../middleware/auth');
const Category = require('../models/Category');

router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ order: 1 });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, moderatorOrAdmin, async (req, res, next) => {
  try {
    const { name, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ message: 'Category already exists' });
    }
    const maxOrder = await Category.findOne().sort({ order: -1 });
    const category = await Category.create({
      name: name.trim(),
      icon: icon || '📌',
      order: maxOrder ? maxOrder.order + 1 : 0,
    });
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', auth, moderatorOrAdmin, async (req, res, next) => {
  try {
    const { name, icon, order } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    if (name) category.name = name.trim();
    if (icon) category.icon = icon;
    if (order !== undefined) category.order = order;
    await category.save();
    res.json({ category });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', auth, moderatorOrAdmin, async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const FAQ = require('../models/FAQ');
    const Question = require('../models/Question');

    const AuditLog = require('../models/AuditLog');
    await Promise.all([
      FAQ.updateMany({ category: category.name }, { $set: { category: '' } }),
      Question.updateMany({ category: category.name }, { $set: { category: '' } }),
      Category.findByIdAndDelete(req.params.id),
      AuditLog.create({
        adminId: req.user._id,
        action: 'delete_category',
        targetId: category._id,
        targetType: 'Category',
        reason: `Category "${category.name}" deleted`
      })
    ]);

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;