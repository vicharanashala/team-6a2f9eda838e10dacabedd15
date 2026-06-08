const mongoose = require('mongoose');

const spurtiPointLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  action: {
    type: String,
    required: true, // 'reward' | 'deduction' | 'redeem'
  },
  reason: {
    type: String,
    required: true,
  },
  referenceType: {
    type: String, // 'Answer' | 'Question'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
  },
}, { timestamps: true });

module.exports = mongoose.model('SpurtiPointLog', spurtiPointLogSchema);
