const router = require('express').Router();
const { auth, adminOnly, moderatorOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

router.get('/dashboard', auth, moderatorOrAdmin, ctrl.getDashboard);
router.get('/user-analytics', auth, adminOnly, ctrl.getUserAnalytics);
router.get('/faq-analytics', auth, adminOnly, ctrl.getGlobalFAQAnalytics);
router.get('/users', auth, adminOnly, ctrl.getUsers);
router.put('/users/:id/role', auth, adminOnly, ctrl.updateUserRole);
router.post('/users/:id/ban', auth, adminOnly, ctrl.banUser);
router.post('/users/:id/unban', auth, adminOnly, ctrl.unbanUser);
router.delete('/users/:id', auth, adminOnly, ctrl.deleteUser);
router.get('/flagged', auth, moderatorOrAdmin, ctrl.getFlaggedContent);
router.post('/cache/clear', auth, adminOnly, ctrl.clearCache);

router.get('/anomalies', auth, moderatorOrAdmin, ctrl.getAnomalies);
router.post('/anomalies/:id/resolve', auth, moderatorOrAdmin, ctrl.resolveAnomaly);

router.post('/reports', auth, ctrl.createSiteReport);
router.get('/reports', auth, adminOnly, ctrl.getSiteReports);
router.post('/reports/:id/resolve', auth, adminOnly, ctrl.resolveSiteReport);

// Email Queue Monitoring & Admin Endpoints
router.get('/emails/queue', auth, adminOnly, ctrl.getEmailQueue);
router.post('/emails/process', auth, adminOnly, ctrl.forceProcessQueue);
router.post('/emails/retry-failed', auth, adminOnly, ctrl.retryFailedEmails);
router.delete('/emails/queue', auth, adminOnly, ctrl.clearEmailQueue);
router.get('/emails/bounces', auth, adminOnly, ctrl.getBouncedEmails);
router.delete('/emails/bounces/:id', auth, adminOnly, ctrl.removeBouncedEmail);

router.post('/questions/:id/convert-to-faq', auth, moderatorOrAdmin, ctrl.convertQuestionToFAQItem);

// Moderation Endpoints
router.get('/moderation/queue', auth, moderatorOrAdmin, ctrl.getModerationQueue);
router.post('/moderation/approve', auth, moderatorOrAdmin, ctrl.approvePost);
router.post('/moderation/reject', auth, moderatorOrAdmin, ctrl.rejectPost);
router.get('/moderation/reported', auth, moderatorOrAdmin, ctrl.getReportedPosts);
router.post('/moderation/action', auth, moderatorOrAdmin, ctrl.moderateUser);
router.get('/moderation/suspicious', auth, moderatorOrAdmin, ctrl.getSuspiciousActivity);
router.get('/moderation/audit-logs', auth, moderatorOrAdmin, ctrl.getAuditLogs);

module.exports = router;
