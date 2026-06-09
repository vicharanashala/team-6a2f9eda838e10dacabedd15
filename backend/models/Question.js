const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300,
  },
  body: {
    type: String,
    required: true,
    maxlength: 50000,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isAnonymous: { type: Boolean, default: false },
  category: { type: String },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag',
  }],
  tagNames: [{ type: String }],

  // Stats
  upvotes: { type: Number, default: 0 },
  downvotes: { type: Number, default: 0 },
  answerCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  saveCount: { type: Number, default: 0 },
  meTooCount: { type: Number, default: 0 },
  meTooUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Accepted answer
  acceptedAnswer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Answer',
    default: null,
  },

  // FAQ status (becomes searchable when resolved)
  isFAQ: { type: Boolean, default: false },
  resolvedAt: { type: Date },

  // Resolution tracking
  resolutionStatus: {
    type: String,
    enum: ['unresolved', 'resolved', 'escalated'],
    default: 'unresolved',
  },
  resolvedByStudent: { type: Boolean, default: false },
  resolvedAtStudent: { type: Date },
  escalatedAt: { type: Date },
  escalationReason: { type: String },
  escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isEscalated: { type: Boolean, default: false },

  // Verification / outdated status
  lastVerifiedAt: { type: Date },
  isOutdated: { type: Boolean, default: false },
  outdatedReason: { type: String },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Master FAQ / Merging
  isMasterFAQ: { type: Boolean, default: false },
  mergedQuestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  }],
  mergeCount: { type: Number, default: 0 },
  mergedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  },

  // Duplicate detection
  isDuplicate: { type: Boolean, default: false },
  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  },

  // Already asked tracking
  isAlreadyAsked: { type: Boolean, default: false },
  relatedQuestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  }],
  scopeMatch: {
    type: String,
    enum: ['exact', 'similar', 'tag', null],
    default: null,
  },

  // Moderation
  status: {
    type: String,
    enum: ['open', 'closed', 'deleted'],
    default: 'open',
  },
  isLocked: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  isFlagged: { type: Boolean, default: false },
  flagReason: { type: String },
  flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedAt: { type: Date },
  closedReason: { type: String },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Anomaly Detection
  anomalyScore: { type: Number, default: 0 },
  anomalySeverity: {
    type: String,
    enum: ['high', 'medium', 'low', 'none'],
    default: 'none',
  },
  alertSent: { type: Boolean, default: false },
  anomalyResolvedAt: { type: Date, default: null },
  anomalyResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  escalated15MinSent: { type: Boolean, default: false },
  escalated30MinSent: { type: Boolean, default: false },

  // Timestamps
  lastActivity: { type: Date },

  // Moderation & Visibility Fields
  visibility: {
    type: String,
    enum: ["public", "pending", "hidden", "archived"],
    default: "pending"
  },
  reportCount: { type: Number, default: 0 },
  reportedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  triggeredRule: { type: String },
  phase: {
    type: String,
    enum: ["onboarding", "week1", "week2", "week3", "final", "certificate"]
  },
  archivedAt: { type: Date },
  attachments: [{
    filename: { type: String, required: true },
    content: { type: String, required: true },
    mimetype: { type: String },
    size: { type: Number }
  }],
  links: [{
    title: { type: String },
    url: { type: String, required: true }
  }],
}, { timestamps: true });

questionSchema.index({ title: 'text', body: 'text' });
questionSchema.index({ visibility: 1, isDeleted: 1 });
questionSchema.index({ author: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ status: 1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index({ upvotes: -1 });
questionSchema.index({ viewCount: -1 });
questionSchema.index({ meTooCount: -1 });
questionSchema.index({ lastActivity: -1 });
questionSchema.index({ title: 1 }, { collation: { locale: 'en', strength: 2 } });
questionSchema.index({ isFAQ: 1, isOutdated: 1, lastVerifiedAt: -1 });
questionSchema.index({ resolutionStatus: 1, createdAt: -1 });
questionSchema.index({ escalatedTo: 1, escalatedAt: -1 });
questionSchema.index({ isMasterFAQ: 1, mergeCount: -1 });
questionSchema.index({ mergedInto: 1 });

module.exports = mongoose.model('Question', questionSchema);
