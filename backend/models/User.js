const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: function() {
      return this.authProvider === 'email' || this.authProvider === 'both';
    },
    minlength: 6,
    select: false,
  },
  displayName: { type: String, trim: true, maxlength: 50 },
  bio: { type: String, maxlength: 500 },
  avatar: { type: String, default: '' },
  avatarUrl: { type: String },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  authProvider: {
    type: String,
    enum: ['google', 'email', 'both'],
    default: 'email',
  },
  website: { type: String },
  location: { type: String },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user',
  },
  reputation: { type: Number, default: 1 },
  badges: [{ type: String }],

  // Stats
  questionCount: { type: Number, default: 0 },
  answerCount: { type: Number, default: 0 },
  savedCount: { type: Number, default: 0 },

  // Preferences
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
  },

  // Moderation
  isBanned: { type: Boolean, default: false },
  banReason: { type: String },
  flags: { type: Number, default: 0 },
  lastActive: { type: Date },

  // Onboarding
  hasCompletedOnboarding: { type: Boolean, default: false },
  currentPhase: {
    type: String,
    enum: ['pre', 'phase1_coursework', 'phase1_completed', 'phase2_project', 'completed']
  },
  receivedTop10Email: { type: Boolean, default: false },
  tagAffinity: [{
    tag: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

userSchema.index({ username: 'text', displayName: 'text', bio: 'text' });
userSchema.index({ role: 1 });

userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    username: this.username,
    displayName: this.displayName,
    bio: this.bio,
    avatar: this.avatar,
    avatarUrl: this.avatarUrl,
    website: this.website,
    location: this.location,
    role: this.role,
    reputation: this.reputation,
    badges: this.badges,
    questionCount: this.questionCount,
    answerCount: this.answerCount,
    hasCompletedOnboarding: this.hasCompletedOnboarding,
    currentPhase: this.currentPhase,
    authProvider: this.authProvider,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
