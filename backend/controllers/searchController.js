const { searchAll } = require('../services/searchService');
const { recordSearch, recordSearchSuccess } = require('../services/analyticsService');
const { getRedis } = require('../config/redis');

const sanitizeSearchQuery = (queryStr) => {
  if (typeof queryStr !== 'string') return '';
  return queryStr.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[<>]/g, "");
};

exports.search = async (req, res, next) => {
  try {
    const { q, tags, type, page = 1, limit = 20 } = req.query;
    const sanitizedQ = sanitizeSearchQuery(q);
    if (!sanitizedQ && !tags) {
      return res.json({ results: [], total: 0, suggestions: [] });
    }

    const cacheKey = `search:${sanitizedQ}:${tags}:${type}:${page}:${limit}`;

    const redis = getRedis();
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    if (sanitizedQ) {
      await recordSearch(sanitizedQ);
    }

    const result = await searchAll({
      query: sanitizedQ,
      tags: tags ? tags.split(',') : [],
      type,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    if (result.total > 0 && sanitizedQ) {
      await recordSearchSuccess(sanitizedQ);
    }

    let suggestions = [];
    try {
      const raw = await redis.lrange('search:suggestions', 0, 9);
      suggestions = raw.map(r => JSON.parse(r));
    } catch (_) {}

    if (sanitizedQ && sanitizedQ.length >= 3) {
      try {
        const suggestionsKey = 'search:suggestions';
        const exists = await redis.lpos(suggestionsKey, JSON.stringify({ query: sanitizedQ }));
        if (exists === null) {
          await redis.lpush(suggestionsKey, JSON.stringify({ query: sanitizedQ, count: 1, timestamp: Date.now() }));
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
