const mongoose = require('mongoose');

const questionViewSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewedAt: { type: Date, default: Date.now },
});

questionViewSchema.index({ question: 1, user: 1 }, { unique: true });
questionViewSchema.index({ question: 1, viewedAt: -1 });
questionViewSchema.index({ user: 1, viewedAt: -1 });

const QuestionView = mongoose.model('QuestionView', questionViewSchema);

module.exports = QuestionView;