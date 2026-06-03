const User = require('../models/User');
const FAQ = require('../models/FAQ');
const Question = require('../models/Question');

// Phase → broad keyword list for matching FAQ categories and titles
// Uses partial/substring matching so it works regardless of exact category name variations
const PHASE_CATEGORY_KEYWORDS = {
  pre: [
    'internship', 'timing', 'dates', 'noc', 'objection', 'selection',
    'offer letter', 'certificate', 'work', 'mentorship', 'projects',
    'code of conduct', 'communication', 'spurti', 'vibe platform', 'getting started',
    'about the internship',
  ],
  phase1_coursework: [
    'phase 1', 'vibe lms', 'lms', 'live sessions', 'coursework', 'sessions',
  ],
  phase1_completed: [
    'team formation', 'yaksha', 'chat', 'team',
  ],
  phase2_project: [
    'interview', 'certificate', 'project', 'placement', 'phase 2',
  ],
  completed: ['certificate', 'alumni', 'completed'],
};

const isFaqMatchingPhase = (faq, phase) => {
  const keywords = PHASE_CATEGORY_KEYWORDS[phase] || [];
  if (keywords.length === 0) return false;

  const haystack = [
    faq.category || '',
    faq.title || '',
    ...(faq.tags || []),
  ].join(' ').toLowerCase();

  return keywords.some(kw => haystack.includes(kw));
};

/**
 * Tracks tag affinity when user views, saves, or marks an FAQ helpful.
 * Keeps last 30 days, max 20 tags.
 */
const recordTagAffinity = async (userId, tags) => {
  if (!userId || !tags || tags.length === 0) return;
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Keep tags within 30 days
    let currentAffinity = (user.tagAffinity || []).filter(item => item.timestamp >= thirtyDaysAgo);

    // Add new tags
    const cleanedTags = tags.map(t => t.toLowerCase().trim()).filter(Boolean);
    for (const tag of cleanedTags) {
      currentAffinity.push({ tag, timestamp: now });
    }

    // Sort by timestamp descending, cap at 20
    currentAffinity.sort((a, b) => b.timestamp - a.timestamp);
    if (currentAffinity.length > 20) {
      currentAffinity = currentAffinity.slice(0, 20);
    }

    user.tagAffinity = currentAffinity;
    await user.save();
  } catch (err) {
    console.error('Error recording tag affinity:', err.message);
  }
};

/**
 * Recommends FAQs based on user phase and tag affinity.
 * Returns scored + sorted FAQ list with phaseMatch & matchingTagsCount flags.
 */
const getRecommendedFAQs = async (userId) => {
  let user = null;
  if (userId) {
    try {
      user = await User.findById(userId);
    } catch (_) {}
  }

  // Get all published FAQs
  const allFAQs = await FAQ.find({ isPublished: true })
    .populate('author', 'username displayName')
    .lean();

  if (!user || !user.currentPhase) {
    // No phase: return official + most-viewed FAQs sorted by score
    return allFAQs
      .map(faq => ({
        ...faq,
        score: (faq.isOfficial ? 20 : 0) + Math.log((faq.viewCount || 0) + 1) * 2,
        phaseMatch: false,
        matchingTagsCount: 0,
      }))
      .sort((a, b) => b.score - a.score);
  }

  const phase = user.currentPhase;
  const affinityTags = (user.tagAffinity || []).map(item => item.tag.toLowerCase());

  const phaseQueries = {
    pre: 'pre internship selection process NOC certificate getting started onboarding',
    phase1_coursework: 'phase 1 coursework live sessions modules lectures test assignment LMS Vibe',
    phase1_completed: 'phase 1 completed team formation yaksha chat project group',
    phase2_project: 'phase 2 project code reviews github checkin final evaluation placement interview',
    completed: 'internship completed certificate alumni job placement resume referral graduation',
  };

  const query = phaseQueries[phase] || phase;
  let aiRecommendedTitles = [];
  try {
    const axios = require('axios');
    const config = require('../config');
    console.log(`[AI Recommend] Querying FastAPI search for phase "${phase}" with query: "${query}"`);
    const response = await axios.post(`${config.fastApiUrl}/api/v1/search`, {
      query,
      documents: allFAQs.map(faq => faq.title)
    }, { timeout: 3000 });

    if (response.data && response.data.recommendations) {
      aiRecommendedTitles = response.data.recommendations;
      console.log(`[AI Recommend] FastAPI returned recommendations:`, aiRecommendedTitles);
    }
  } catch (err) {
    console.error('[AI Recommend] FastAPI search call failed or timed out:', err.message);
  }

  const scoredFAQs = allFAQs.map(faq => {
    // 1. Phase Match: keyword-based, broad matching
    const phaseMatch = isFaqMatchingPhase(faq, phase);

    // 2. AI Semantic Match from FastAPI
    const aiMatch = aiRecommendedTitles.includes(faq.title);

    // 3. Tag affinity overlap
    const faqTagsClean = (faq.tags || []).map(t => t.toLowerCase().trim());
    const matchingTagsCount = faqTagsClean.filter(t => affinityTags.includes(t)).length;

    // 4. View count (log scale)
    const viewFactor = Math.log((faq.viewCount || 0) + 1) * 2;

    // 5. Official bonus
    const officialFactor = faq.isOfficial ? 10 : 0;

    // Phase Match adds 50, AI Semantic Match adds 100
    const score = (phaseMatch ? 50 : 0) + (aiMatch ? 100 : 0) + (matchingTagsCount * 10) + viewFactor + officialFactor;

    return { ...faq, score, phaseMatch: phaseMatch || aiMatch, matchingTagsCount };
  });

  scoredFAQs.sort((a, b) => b.score - a.score);

  // If nothing scored, fall back to recency
  const hasAnyMatches = scoredFAQs.some(faq => faq.score > 0);
  if (!hasAnyMatches) {
    return allFAQs
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(faq => ({ ...faq, phaseMatch: false, matchingTagsCount: 0 }));
  }

  return scoredFAQs;
};

/**
 * Recommends questions based on user's tag affinity (used by /api/recommendations/recommended).
 */
const getRecommendedQuestions = async (userId, page = 1, limit = 20) => {
  let affinityTags = [];
  if (userId) {
    try {
      const user = await User.findById(userId);
      if (user && user.tagAffinity) {
        affinityTags = user.tagAffinity.map(a => a.tag.toLowerCase());
      }
    } catch (_) {}
  }

  const skip = (page - 1) * limit;
  const filter = { isDeleted: false, status: { $ne: 'closed' } };

  let questions;
  if (affinityTags.length > 0) {
    // Try to get tag-matched questions
    const Tag = require('../models/Tag');
    const matchingTags = await Tag.find({ name: { $in: affinityTags } }).lean();
    if (matchingTags.length > 0) {
      filter.tags = { $in: matchingTags.map(t => t._id) };
    }
  }

  questions = await Question.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'username displayName avatar reputation')
    .populate('tags', 'name color')
    .lean();

  const total = await Question.countDocuments(filter);
  return { questions, total, page, limit };
};

/**
 * Returns trending questions (most views + votes in the last 7 days).
 */
const getTrendingQuestions = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const questions = await Question.find({
    isDeleted: false,
    createdAt: { $gte: sevenDaysAgo },
  })
    .sort({ viewCount: -1, upvotes: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'username displayName avatar reputation')
    .populate('tags', 'name color')
    .lean();

  return questions;
};

module.exports = {
  recordTagAffinity,
  getRecommendedFAQs,
  getRecommendedQuestions,
  getTrendingQuestions,
};
