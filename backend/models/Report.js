const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'postType'
  },
  postType: {
    type: String,
    required: true,
    enum: ['Question', 'Answer']
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ["spam", "abusive", "off_topic", "duplicate", "harassment", "misleading"]
  }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
