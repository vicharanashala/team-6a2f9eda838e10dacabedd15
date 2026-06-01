const webpush = require('web-push');
const config = require('../config');
const User = require('../models/User');

webpush.setVapidDetails(
  config.webPush.subject,
  config.webPush.publicKey,
  config.webPush.privateKey
);

const sendPushNotification = async (userId, payload) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.pushSubscription || !user.preferences.pushNotifications) {
      return { sent: false, reason: 'no_subscription' };
    }

    const subscription = {
      endpoint: user.pushSubscription.endpoint,
      keys: user.pushSubscription.keys,
    };

    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { sent: true };
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await User.findByIdAndUpdate(userId, { pushSubscription: null });
      return { sent: false, reason: 'expired' };
    }
    console.error('Push notification error:', err.message);
    return { sent: false, reason: 'error' };
  }
};

const sendNotificationToUser = async (userId, notification) => {
  const payload = {
    title: notification.title,
    body: notification.message || '',
    icon: '/icon.png',
    badge: '/badge.png',
    tag: 'notification',
    data: {
      link: notification.link,
      type: notification.type,
    },
  };

  return await sendPushNotification(userId, payload);
};

module.exports = { sendPushNotification, sendNotificationToUser };