const mongoose = require('mongoose');

const siteReportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: 1000
  },
  pageUrl: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['open', 'resolved'],
    default: 'open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SiteReport', siteReportSchema);
