const mongoose = require('mongoose');

const appVersionSchema = new mongoose.Schema({
  latestVersion: {
    type: String,
    required: true,
    default: '1.1.0'
  },
  latestVersionCode: {
    type: Number,
    required: true,
    default: 2
  },
  apkUrl: {
    type: String,
    required: true,
    default: 'https://prashnasarathi.vercel.app/downloads/prashnasarathi-app.apk'
  },
  changelog: {
    type: String,
    required: true,
    default: 'Performance improvements, smoother client-side navigation transitions, and native deep linking support.'
  },
  forceUpdate: {
    type: Boolean,
    required: true,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('AppVersion', appVersionSchema);
