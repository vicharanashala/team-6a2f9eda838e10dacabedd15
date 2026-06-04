const mongoose = require('mongoose');

const emailStatSchema = new mongoose.Schema({
  date: {
    type: String, // YYYY-MM-DD
    required: true,
    unique: true,
  },
  count: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('EmailStat', emailStatSchema, 'emailStats');
