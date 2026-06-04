const mongoose = require('mongoose');

const emailQueueSchema = new mongoose.Schema({
  to: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  userName: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
    maxlength: 60,
  },
  body: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'bounced'],
    default: 'pending',
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 3,
  },
  nextRetryAt: {
    type: Date,
    default: Date.now,
  },
  sentAt: {
    type: Date,
  },
  failReason: {
    type: String,
  },
}, { timestamps: true });

emailQueueSchema.index({ status: 1, nextRetryAt: 1 });

module.exports = mongoose.model('EmailQueue', emailQueueSchema, 'email_queue');
