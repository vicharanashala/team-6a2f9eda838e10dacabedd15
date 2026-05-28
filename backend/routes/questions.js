const router = require('express').Router();
const { auth, optionalAuth } = require('../middleware/auth');
const { questionValidation } = require('../utils/validators');
const ctrl = require('../controllers/questionController');

router.get('/similar', ctrl.findSimilar);
router.get('/', ctrl.getQuestions);
router.get('/:id', optionalAuth, ctrl.getQuestion);
router.get('/:id/similar', ctrl.getSimilarQuestions);
router.get('/:id/related', ctrl.getRelatedQuestions);
router.post('/', auth, questionValidation, ctrl.createQuestion);
router.put('/:id', auth, ctrl.updateQuestion);
router.patch('/:id/duplicate', auth, ctrl.markAsDuplicate);
router.delete('/:id', auth, ctrl.deleteQuestion);

module.exports = router;
