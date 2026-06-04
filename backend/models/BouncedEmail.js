const mongoose = require('mongoose');

const bouncedEmailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  reason: {
    type: String,
  },
  bouncedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('BouncedEmail', bouncedEmailSchema, 'bounced_emails');
