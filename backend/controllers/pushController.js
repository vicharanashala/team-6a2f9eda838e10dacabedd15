const User = require('../models/User');
const config = require('../config');

exports.getVapidPublicKey = (req, res) => {
  const publicKey = config.webPush && config.webPush.publicKey;
  if (!publicKey) {
    return res.status(503).json({ error: 'Push notifications not configured on server', publicKey: null });
  }
  res.json({ publicKey });
};

exports.savePushSubscription = async (req, res, next) => {
  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      pushSubscription: {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      'preferences.pushNotifications': true,
    });

    res.json({ message: 'Push subscription saved' });
  } catch (err) {
    next(err);
  }
};

exports.deletePushSubscription = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      pushSubscription: null,
      'preferences.pushNotifications': false,
    });

    res.json({ message: 'Push subscription removed' });
  } catch (err) {
    next(err);
  }
};

exports.saveFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { fcmTokens: token },
      'preferences.pushNotifications': true,
    });

    res.json({ message: 'FCM token saved' });
  } catch (err) {
    next(err);
  }
};

exports.deleteFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { fcmTokens: token }
    });

    res.json({ message: 'FCM token removed' });
  } catch (err) {
    next(err);
  }
};