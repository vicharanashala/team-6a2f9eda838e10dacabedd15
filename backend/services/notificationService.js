const Notification = require('../models/Notification');
const { emitToUser } = require('../socket');
const { sendNotificationToUser } = require('./pushService');

const createNotification = async ({ recipient, type, title, message, link, referenceType, reference }) => {
  const notification = await Notification.create({
    recipient,
    type,
    title,
    message,
    link,
    referenceType,
    reference,
  });

  emitToUser(recipient.toString(), 'notification:new', {
    _id: notification._id,
    type,
    title,
    message,
    link,
  });

  await sendNotificationToUser(recipient.toString(), {
    type,
    title,
    message,
    link,
  });

  return notification;
};

module.exports = { createNotification };