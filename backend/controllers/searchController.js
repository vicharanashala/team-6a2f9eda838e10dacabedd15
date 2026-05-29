const { searchAll } = require('../services/searchService');
const { recordSearch, recordSearchSuccess } = require('../services/analyticsService');
const { getRedis } = require('../config/redis');

exports.search = async (req, res, next) => {
  try {
    const { q, tags, type, page = 1, limit = 20 } = req.query;
    if (!q && !tags) {
      return res.json({ results: [], total: 0, suggestions: [] });
    }

    const cacheKey = `search:${q}:${tags}:${type}:${page}:${limit}`;

    const redis = getRedis();
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    await recordSearch(q || '');

    const result = await searchAll({
      query: q,
      tags: tags ? tags.split(',') : [],
      type,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    if (result.total > 0) {
      await recordSearchSuccess(q || '');
    }

    let suggestions = [];
    try {
      const raw = await redis.lrange('search:suggestions', 0, 9);
      suggestions = raw.map(r => JSON.parse(r));
    } catch (_) {}

    if (q && q.length >= 3) {
      try {
        const suggestionsKey = 'search:suggestions';
        const exists = await redis.lpos(suggestionsKey, JSON.stringify({ query: q }));
        if (exists === null) {
          await redis.lpush(suggestionsKey, JSON.stringify({ query: q, count: 1, timestamp: Date.now() }));
          await redis.ltrim(suggestionsKey, 0, 99);
        }
      } catch (_) {}
    }

    const response = { ...result, suggestions };
    redis.setex(cacheKey, 60, JSON.stringify(response)).catch(() => {});
    res.json(response);
  } catch (err) {
    next(err);
  }
};

exports.getSuggestions = async (req, res) => {
  try {
    const redis = getRedis();
    const raw = await redis.lrange('search:suggestions', 0, 9);
    const suggestions = raw.map(r => JSON.parse(r));
    res.json({ suggestions });
  } catch (_) {
    res.json({ suggestions: [] });
  }
};
