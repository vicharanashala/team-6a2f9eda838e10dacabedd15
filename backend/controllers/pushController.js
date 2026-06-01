const User = require('../models/User');
const config = require('../config');

exports.getVapidPublicKey = (req, res) => {
  res.json({ publicKey: config.webPush.publicKey });
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