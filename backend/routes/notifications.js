const router = require('express').Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');
const pushCtrl = require('../controllers/pushController');

router.get('/', auth, ctrl.getNotifications);
router.get('/unread-count', auth, ctrl.getUnreadCount);
router.put('/read', auth, ctrl.markAsRead);
router.put('/:id/archive', auth, ctrl.archiveNotification);

// Web Push (VAPID) Endpoints
router.get('/push/vapid-public-key', auth, pushCtrl.getVapidPublicKey);
router.post('/push/subscribe', auth, pushCtrl.savePushSubscription);
router.delete('/push/unsubscribe', auth, pushCtrl.deletePushSubscription);

// Native App FCM Token Endpoints
router.post('/push/fcm-token', auth, pushCtrl.saveFcmToken);
router.delete('/push/fcm-token', auth, pushCtrl.deleteFcmToken);

module.exports = router;
