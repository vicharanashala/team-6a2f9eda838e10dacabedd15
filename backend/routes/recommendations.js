const router = require('express').Router();
const { auth, optionalAuth } = require('../middleware/auth');
const { getRecommendedQuestions, getTrendingQuestions } = require('../services/recommendationService');

router.get('/recommended', optionalAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user ? req.user._id : null;
    const result = await getRecommendedQuestions(userId, parseInt(page), parseInt(limit));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/trending', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const questions = await getTrendingQuestions(parseInt(page), parseInt(limit));
    res.json({ questions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;