const router = require('express').Router();
const { auth, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

// IMPORTANT: All /me/* routes MUST come before /:username
// Otherwise Express matches "me" as a username parameter
router.get('/me/saved', auth, ctrl.getSavedQuestions);
router.get('/me/saved/tags', auth, ctrl.getSavedTags);
router.post('/me/saved', auth, ctrl.saveQuestion);
router.patch('/me/saved/:questionId', auth, ctrl.updateSavedQuestion);
router.delete('/me/saved/:questionId', auth, ctrl.unsaveQuestion);

router.get('/me/me-too', auth, ctrl.getMeTooQuestions);
router.patch('/me/onboarding', auth, ctrl.completeOnboarding);

router.get('/me/saved/faqs', auth, ctrl.getSavedFAQs);
router.get('/me/saved/faqs/tags', auth, ctrl.getSavedFAQTags);
router.post('/me/saved/faqs', auth, ctrl.saveFAQ);
router.patch('/me/saved/faqs/:faqId', auth, ctrl.updateSavedFAQ);
router.delete('/me/saved/faqs/:faqId', auth, ctrl.unsaveFAQ);

// Wildcard :username routes come AFTER all /me/* routes
router.get('/leaderboard', ctrl.getLeaderboard);
router.get('/moderators', ctrl.getModerators);
router.get('/:username', ctrl.getUserProfile);
router.get('/:username/questions', ctrl.getUserQuestions);
router.get('/:username/answers', ctrl.getUserAnswers);

module.exports = router;
