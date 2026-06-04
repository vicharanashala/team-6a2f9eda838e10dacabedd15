const router = require('express').Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/postController');

router.post('/:id/report', auth, ctrl.reportPost);

module.exports = router;
