const { getRedis } = require('../config/redis');
const Question = require('../models/Question');
const Tag = require('../models/Tag');

const CACHE_TTL = 3600;

// ADDITION: Trending score formula (inspired by HackerNews ranking)
// Higher score = more relevant right now, not just all-time popular
const computeTrendingScore = (upvotes, answers, views, createdAt) => {
  const ageInHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  const score = (upvotes * 3 + answers * 2 + views * 0.5) / Math.pow(ageInHours + 2, 1.5);
  return score;
};

// ADDITION: Jaccard similarity between user's tag history and a question's tags
// Tells us HOW WELL a question matches user interests, not just IF it matches
const jaccardScore = (userTagIds, questionTagIds) => {
  const setA = new Set(userTagIds);
  const setB = new Set(questionTagIds.map(t => t.toString()));
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
};

const getRecommendedQuestions = async (userId, page = 1, limit = 20) => {
  const redis = getRedis();
  const cacheKey = `rec:${userId || 'anon'}:${page}:${limit}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  let pipeline = [];
  let userTagIds = [];

  if (userId) {
    const user = await (require('../models/User')).findById(userId);
    if (user) {
      const recentQuestions = await Question.find({ author: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('tags');

      userTagIds = [...new Set(recentQuestions.flatMap(q => q.tags.map(t => t.toString())))];

      if (userTagIds.length > 0) {
        pipeline.push({
          $match: {
            tags: { $in: userTagIds },
            author: { $ne: userId },
            status: 'open',
            isDeleted: false
          }
        });
      }
    }
  }

  if (pipeline.length === 0) {
    pipeline.push({ $match: { status: 'open', isDeleted: false } });
  }

  // ADDITION: compute trendingScore and tagMatchScore inside the pipeline
  // addFields lets MongoDB carry these computed values through the rest of the pipeline
  pipeline.push({
    $addFields: {
      trendingScore: {
        $divide: [
          {
            $add: [
              { $multiply: ['$upvotes', 3] },
              { $multiply: ['$answerCount', 2] },
              { $multiply: ['$viewCount', 0.5] }
            ]
          },
          {
            $pow: [
              {
                $add: [
                  {
                    $divide: [
                      { $subtract: [new Date(), '$createdAt'] },
                      1000 * 60 * 60  // convert ms to hours
                    ]
                  },
                  2
                ]
              },
              1.5
            ]
          }
        ]
      }
    }
  });

  // ADDITION: sort by trendingScore instead of just lastActivity + upvotes
  pipeline.push({ $sort: { trendingScore: -1, lastActivity: -1 } });

  pipeline.push(
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'author',
      },
    },
    { $unwind: '$author' },
    {
      $lookup: {
        from: 'tags',
        localField: 'tags',
        foreignField: '_id',
        as: 'tags',
      },
    },
    {
      $project: {
        title: 1,
        body: { $substrCP: ['$body', 0, 300] },
        upvotes: 1,
        answerCount: 1,
        viewCount: 1,
        createdAt: 1,
        lastActivity: 1,
        trendingScore: 1,   // ADDITION: expose this so frontend can show "trending" badge
        tagNames: 1,
        'author.username': 1,
        'author.displayName': 1,
        'author.avatar': 1,
        'author.reputation': 1,
      },
    },
  );

  let questions = await Question.aggregate(pipeline);

  // ADDITION: re-rank by jaccard tag similarity on top of trending score
  // This is done in JS after DB fetch because MongoDB can't easily compute set intersection
  if (userTagIds.length > 0) {
    questions = questions.map(q => ({
      ...q,
      tagMatchScore: jaccardScore(userTagIds, q.tags.map(t => t._id?.toString() || t.toString()))
    }));

    // Blend both scores: 60% tag relevance, 40% trending
    questions = questions.map(q => ({
      ...q,
      finalScore: 0.6 * q.tagMatchScore + 0.4 * (q.trendingScore / 100) // normalize trending
    }));

    questions.sort((a, b) => b.finalScore - a.finalScore);
  }

  const result = { questions, page, limit };

  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  } catch (_) {}

  return result;
};

const getTrendingQuestions = async (page = 1, limit = 20) => {
  const redis = getRedis();

  //  ADDITION: cache trending too, with shorter TTL since it changes faster
  const cacheKey = `trending:${page}:${limit}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  //  ADDITION: extended window from 3 days to 7 days so more questions are considered
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const questions = await Question.aggregate([
    {
      $match: {
        status: 'open',
        isDeleted: false,
        createdAt: { $gte: sevenDaysAgo }
      }
    },
    //  ADDITION: compute trending score instead of raw sort
    {
      $addFields: {
        trendingScore: {
          $divide: [
            {
              $add: [
                { $multiply: ['$upvotes', 3] },
                { $multiply: ['$answerCount', 2] },
                { $multiply: ['$viewCount', 0.5] }
              ]
            },
            {
              $pow: [
                {
                  $add: [
                    {
                      $divide: [
                        { $subtract: [new Date(), '$createdAt'] },
                        1000 * 60 * 60
                      ]
                    },
                    2
                  ]
                },
                1.5
              ]
            }
          ]
        }
      }
    },
    { $sort: { trendingScore: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'author'
      }
    },
    { $unwind: '$author' },
    {
      $lookup: {
        from: 'tags',
        localField: 'tags',
        foreignField: '_id',
        as: 'tags'
      }
    },
    {
      $project: {
        title: 1,
        upvotes: 1,
        answerCount: 1,
        viewCount: 1,
        createdAt: 1,
        trendingScore: 1,
        tagNames: 1,
        'author.username': 1,
        'author.displayName': 1,
        'author.avatar': 1,
        'author.reputation': 1
      }
    }
  ]);

  // ADDITION: shorter cache for trending (15 min) since it updates frequently
  try {
    await redis.setex(cacheKey, 900, JSON.stringify({ questions, page, limit }));
  } catch (_) {}

  return { questions, page, limit };
};

module.exports = { getRecommendedQuestions, getTrendingQuestions };