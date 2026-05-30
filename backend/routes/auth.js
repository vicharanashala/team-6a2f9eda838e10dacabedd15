const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../utils/validators');
const { upload } = require('../middleware/upload');
const ctrl = require('../controllers/authController');

router.post('/register', registerValidation, ctrl.register);
router.post('/login', loginValidation, ctrl.login);
router.get('/me', auth, ctrl.getMe);
router.put('/profile', auth, upload.single('avatar'), ctrl.updateProfile);

module.exports = router;
