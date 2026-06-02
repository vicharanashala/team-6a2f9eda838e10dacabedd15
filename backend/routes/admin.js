const router = require('express').Router();
const { auth, adminOnly, moderatorOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

router.get('/dashboard', auth, adminOnly, ctrl.getDashboard);
router.get('/user-analytics', auth, adminOnly, ctrl.getUserAnalytics);
router.get('/faq-analytics', auth, adminOnly, ctrl.getGlobalFAQAnalytics);
router.get('/users', auth, adminOnly, ctrl.getUsers);
router.put('/users/:id/role', auth, adminOnly, ctrl.updateUserRole);
router.post('/users/:id/ban', auth, adminOnly, ctrl.banUser);
router.post('/users/:id/unban', auth, adminOnly, ctrl.unbanUser);
router.get('/flagged', auth, adminOnly, ctrl.getFlaggedContent);
router.post('/cache/clear', auth, adminOnly, ctrl.clearCache);

router.get('/anomalies', auth, moderatorOrAdmin, ctrl.getAnomalies);
router.post('/anomalies/:id/resolve', auth, moderatorOrAdmin, ctrl.resolveAnomaly);

router.post('/reports', auth, ctrl.createSiteReport);
router.get('/reports', auth, adminOnly, ctrl.getSiteReports);
router.post('/reports/:id/resolve', auth, adminOnly, ctrl.resolveSiteReport);

router.post('/questions/:id/convert-to-faq', auth, moderatorOrAdmin, ctrl.convertQuestionToFAQItem);

module.exports = router;
