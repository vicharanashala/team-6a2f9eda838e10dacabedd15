const mongoose = require('mongoose');

const suspiciousActivitySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['ip_abuse', 'device_abuse'],
    required: true
  },
  ip: {
    type: String
  },
  deviceId: {
    type: String
  },
  affectedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isResolved: {
    type: Boolean,
    default: false
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  }
}, { timestamps: { createdAt: 'flagDate', updatedAt: 'resolvedAt' } });

suspiciousActivitySchema.index({ flagDate: -1 });

module.exports = mongoose.model('SuspiciousActivity', suspiciousActivitySchema);
