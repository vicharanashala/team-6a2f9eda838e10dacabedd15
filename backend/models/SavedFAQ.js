const mongoose = require('mongoose');

const savedFAQSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  faq: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FAQ',
    required: true,
  },
  notes: { type: String, maxlength: 500 },
  tags: [{ type: String }],
}, { timestamps: true });

savedFAQSchema.index({ user: 1, faq: 1 }, { unique: true });
savedFAQSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('SavedFAQ', savedFAQSchema);