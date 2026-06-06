const Notification = require('../models/Notification');

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

  return notification;
};

module.exports = { createNotification };