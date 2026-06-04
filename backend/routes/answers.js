const router = require('express').Router();
const { auth, optionalAuth, moderatorOrAdmin } = require('../middleware/auth');
const { answerValidation } = require('../utils/validators');
const { spamGuard } = require('../middleware/spamGuard');
const ctrl = require('../controllers/answerController');

router.get('/question/:questionId', optionalAuth, ctrl.getAnswers);
router.post('/question/:questionId', auth, spamGuard, answerValidation, ctrl.createAnswer);
router.put('/:id', auth, ctrl.updateAnswer);
router.delete('/:id', auth, ctrl.deleteAnswer);
router.post('/:id/accept', auth, ctrl.acceptAnswer);
router.post('/:id/unaccept', auth, ctrl.unacceptAnswer);
router.patch('/:id/solved-my-doubt', auth, ctrl.toggleSolvedMyDoubt);
router.patch('/:id/flag', moderatorOrAdmin, ctrl.flagAnswer);
router.patch('/:id/flag/clear', moderatorOrAdmin, ctrl.clearFlagAnswer);

module.exports = router;
