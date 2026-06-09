const webpush = require('web-push');
const config = require('../config');
const User = require('../models/User');

let admin = null;
try {
  admin = require('firebase-admin');
} catch (_) {}

let firebaseMessaging = null;

const getFirebaseMessaging = () => {
  if (!admin) return null;
  if (firebaseMessaging) return firebaseMessaging;

  let app;
  if (admin.apps.length > 0) {
    app = admin.apps[0];
  } else {
    const serviceAccountEnv = config.firebase?.serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountEnv) return null;

    try {
      let serviceAccount;
      let trimmed = serviceAccountEnv.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        trimmed = trimmed.slice(1, -1);
      }
      trimmed = trimmed.replace(/\\"/g, '"');

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        serviceAccount = JSON.parse(trimmed);
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
      } else {
        serviceAccount = require(trimmed);
      }

      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (err) {
      console.error('⚠️ Failed to initialize Firebase Admin in pushService:', err.message);
      return null;
    }
  }

  firebaseMessaging = admin.messaging(app);
  return firebaseMessaging;
};

let vapidKeys = {
  publicKey: config.webPush ? config.webPush.publicKey : null,
  privateKey: config.webPush ? config.webPush.privateKey : null
};

let hasVapidKeys = vapidKeys.publicKey && vapidKeys.privateKey;

if (!hasVapidKeys) {
  try {
    const keys = webpush.generateVAPIDKeys();
    vapidKeys.publicKey = keys.publicKey;
    vapidKeys.privateKey = keys.privateKey;
    hasVapidKeys = true;
    if (config.webPush) {
      config.webPush.publicKey = keys.publicKey;
      config.webPush.privateKey = keys.privateKey;
    }
    console.log('🔑 Dynamic VAPID keys generated for this server run.');
  } catch (err) {
    console.error('Failed to generate dynamic VAPID keys:', err);
  }
}

if (hasVapidKeys) {
  webpush.setVapidDetails(
    (config.webPush && config.webPush.subject) || 'mailto:admin@quorafaq.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} else {
  console.warn('WebPush VAPID details not configured. Web push notifications are disabled.');
}

const sendPushNotification = async (userId, payload) => {
  try {
    const user = await User.findById(userId);
    if (!user || (user.preferences && user.preferences.pushNotifications === false)) {
      return { sent: false, reason: 'disabled_by_preferences' };
    }

    let webPushSent = false;
    let fcmSent = false;

    // 1. Web Push Notification (PWA / Web)
    if (hasVapidKeys && user.pushSubscription && user.pushSubscription.endpoint) {
      try {
        const subscription = {
          endpoint: user.pushSubscription.endpoint,
          keys: user.pushSubscription.keys,
        };
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        webPushSent = true;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await User.findByIdAndUpdate(userId, { pushSubscription: null });
        } else {
          console.error('WebPush send error:', err.message);
        }
      }
    }

    // 2. FCM Push Notification (Android / iOS / Mobile Hybrid)
    const fcmMessaging = getFirebaseMessaging();
    if (fcmMessaging && user.fcmTokens && user.fcmTokens.length > 0) {
      try {
        const message = {
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            link: payload.data?.link || '',
            type: payload.data?.type || '',
          },
          tokens: user.fcmTokens,
        };

        const response = await fcmMessaging.sendEachForMulticast(message);
        fcmSent = true;
        if (response.failureCount > 0) {
          const failedTokens = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              if (resp.error?.code === 'messaging/invalid-registration-token' ||
                  resp.error?.code === 'messaging/registration-token-not-registered') {
                failedTokens.push(user.fcmTokens[idx]);
              }
            }
          });
          if (failedTokens.length > 0) {
            await User.findByIdAndUpdate(userId, {
              $pull: { fcmTokens: { $in: failedTokens } }
            });
          }
        }
      } catch (err) {
        console.error('FCM send error:', err.message);
      }
    }

    return { sent: webPushSent || fcmSent };
  } catch (err) {
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

const broadcastPushNotification = async (payload) => {
  try {
    const users = await User.find({
      $or: [
        { 'pushSubscription.endpoint': { $exists: true, $ne: null } },
        { 'fcmTokens.0': { $exists: true } }
      ],
      isBanned: false,
      'preferences.pushNotifications': { $ne: false }
    });

    for (const user of users) {
      sendPushNotification(user._id, payload).catch(err => {
        console.error(`Error sending broadcast push to user ${user._id}:`, err.message);
      });
    }
  } catch (err) {
    console.error('Error broadcasting push notification:', err.message);
  }
};

module.exports = { sendPushNotification, sendNotificationToUser, broadcastPushNotification };