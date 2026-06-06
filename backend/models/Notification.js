const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'new_answer',
      'answer_accepted',
      'upvote',
      'downvote',
      'comment',
      'mention',
      'follow',
      'badge',
      'system',
      'moderation',
      'faq_update',
      'me_too',
      'question_answered',
      'anomaly',
      'escalation',
      'escalation_resolved',
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String },
  link: { type: String },
  icon: { type: String },

  // Reference to the related entity
  referenceType: {
    type: String,
    enum: ['Question', 'Answer', 'FAQ', 'User', null],
  },
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceType',
  },

  isRead: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false },
  readAt: { type: Date },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ reference: 1, referenceType: 1 });

notificationSchema.post('save', async function (doc) {
  try {
    const { emitToUser } = require('../socket');
    const { sendNotificationToUser } = require('../services/pushService');

    emitToUser(doc.recipient.toString(), 'notification:new', {
      _id: doc._id,
      type: doc.type,
      title: doc.title,
      message: doc.message,
      link: doc.link,
      isRead: doc.isRead,
      createdAt: doc.createdAt
    });

    await sendNotificationToUser(doc.recipient.toString(), {
      type: doc.type,
      title: doc.title,
      message: doc.message,
      link: doc.link
    });
  } catch (err) {
    console.error('Error in Notification post-save hook:', err.message);
  }
});

notificationSchema.post('insertMany', async function (docs) {
  try {
    const { emitToUser } = require('../socket');
    const { sendNotificationToUser } = require('../services/pushService');

    for (const doc of docs) {
      emitToUser(doc.recipient.toString(), 'notification:new', {
        _id: doc._id,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        link: doc.link,
        isRead: doc.isRead,
        createdAt: doc.createdAt
      });

      sendNotificationToUser(doc.recipient.toString(), {
        type: doc.type,
        title: doc.title,
        message: doc.message,
        link: doc.link
      }).catch(err => console.error('Error sending push in insertMany hook:', err.message));
    }
  } catch (err) {
    console.error('Error in Notification post-insertMany hook:', err.message);
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
