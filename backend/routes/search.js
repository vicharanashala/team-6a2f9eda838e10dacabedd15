const router = require('express').Router();
const ctrl = require('../controllers/searchController');

router.get('/', ctrl.search);
router.get('/ai', ctrl.searchAI);
router.get('/suggestions', ctrl.getSuggestions);
router.post('/transcribe', ctrl.transcribe);

module.exports = router;
