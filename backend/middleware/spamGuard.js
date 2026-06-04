const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const SuspiciousActivity = require('../models/SuspiciousActivity');
const blocklist = require('../config/blocklist');
const topicWhitelist = require('../config/topicWhitelist');

// Levenshtein distance helper
function getLevenshteinDistance(a, b) {
  const tmp = [];
  let i, j, alen = a.length, blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  for (i = 0; i <= alen; i++) tmp[i] = [i];
  for (j = 0; j <= blen; j++) tmp[0][j] = j;
  for (i = 1; i <= alen; i++) {
    for (j = 1; j <= blen; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[alen][blen];
}

const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ").trim();
};

const trackUserIpAndDevice = async (user, req) => {
  let ip = req.ip || req.connection.remoteAddress;
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  const deviceId = req.headers['x-device-id'];
  let updated = false;

  if (ip && !user.ipHistory.includes(ip)) {
    user.ipHistory.push(ip);
    if (user.ipHistory.length > 10) user.ipHistory.shift();
    updated = true;
  }

  if (deviceId && !user.deviceFingerprints.includes(deviceId)) {
    user.deviceFingerprints.push(deviceId);
    if (user.deviceFingerprints.length > 5) user.deviceFingerprints.shift();
    updated = true;
  }

  if (updated) {
    await user.save();
  }

  // Suspicious flags check
  if (ip) {
    const ipUsers = await User.find({ ipHistory: ip });
    if (ipUsers.length >= 5) {
      const affectedUserIds = ipUsers.map(u => u._id);
      await SuspiciousActivity.findOneAndUpdate(
        { type: 'ip_abuse', ip },
        { affectedUsers: affectedUserIds },
        { upsert: true, new: true }
      );
    }
  }

  if (deviceId) {
    const deviceUsers = await User.find({ deviceFingerprints: deviceId });
    if (deviceUsers.length >= 3) {
      const affectedUserIds = deviceUsers.map(u => u._id);
      await SuspiciousActivity.findOneAndUpdate(
        { type: 'device_abuse', deviceId },
        { affectedUsers: affectedUserIds },
        { upsert: true, new: true }
      );
    }
  }
};

const handleViolation = async (user) => {
  user.violationCount += 1;
  user.trustScore = Math.max(0, user.trustScore - 10);

  if (user.violationCount === 1) {
    user.status = 'warned';
  } else if (user.violationCount === 2) {
    user.status = 'suspended';
    user.suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  } else if (user.violationCount === 3) {
    user.status = 'suspended';
    user.suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  } else if (user.violationCount >= 4) {
    user.status = 'blocked';
    // Hide all user's content
    await Question.updateMany({ author: user._id }, { visibility: 'hidden' });
    await Answer.updateMany({ author: user._id }, { visibility: 'hidden' });
  }
  await user.save();
};

const spamGuard = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return next();

    const isQuestion = req.body.title !== undefined;
    const title = req.body.title || '';
    const body = req.body.body || '';
    const category = req.body.category || '';

    // Track IP and device fingerprint on post action
    await trackUserIpAndDevice(user, req);

    // A. Rate Limits (by trustLevel)
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const questions24h = await Question.countDocuments({ author: user._id, createdAt: { $gte: oneDayAgo } });
    const answers24h = await Answer.countDocuments({ author: user._id, createdAt: { $gte: oneDayAgo } });
    const totalPosts24h = questions24h + answers24h;

    let dailyLimit = 10;
    if (user.trustLevel === 'new') dailyLimit = 3;
    if (user.trustLevel === 'trusted') dailyLimit = 25;

    if (totalPosts24h >= dailyLimit) {
      // Find oldest post in 24h to compute retryAfter
      const oldestPost = await Promise.all([
        Question.findOne({ author: user._id, createdAt: { $gte: oneDayAgo } }).sort({ createdAt: 1 }),
        Answer.findOne({ author: user._id, createdAt: { $gte: oneDayAgo } }).sort({ createdAt: 1 })
      ]);
      const posts = oldestPost.filter(Boolean);
      posts.sort((x, y) => x.createdAt - y.createdAt);
      const retryAfter = posts[0] ? Math.max(0, Math.ceil((posts[0].createdAt.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / 1000)) : 86400;

      return res.status(429).json({ blocked: false, reason: "Rate limit exceeded", retryAfter });
    }

    if (user.trustLevel === 'new') {
      const questions10m = await Question.countDocuments({ author: user._id, createdAt: { $gte: tenMinsAgo } });
      const answers10m = await Answer.countDocuments({ author: user._id, createdAt: { $gte: tenMinsAgo } });
      const totalPosts10m = questions10m + answers10m;

      if (totalPosts10m >= 3) {
        const oldestPost = await Promise.all([
          Question.findOne({ author: user._id, createdAt: { $gte: tenMinsAgo } }).sort({ createdAt: 1 }),
          Answer.findOne({ author: user._id, createdAt: { $gte: tenMinsAgo } }).sort({ createdAt: 1 })
        ]);
        const posts = oldestPost.filter(Boolean);
        posts.sort((x, y) => x.createdAt - y.createdAt);
        const retryAfter = posts[0] ? Math.max(0, Math.ceil((posts[0].createdAt.getTime() + 10 * 60 * 1000 - Date.now()) / 1000)) : 600;

        return res.status(429).json({ blocked: false, reason: "Rate limit exceeded", retryAfter });
      }
    }

    // B. Cooldown Escalation
    if (user.lastPostedAt) {
      let cooldownSeconds = 60; // 0 violations
      if (user.violationCount === 1) cooldownSeconds = 300; // 5 min
      if (user.violationCount === 2) cooldownSeconds = 3600; // 1 hour
      if (user.violationCount >= 3) {
        // Suspend for 24h
        user.status = 'suspended';
        user.suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();

        // Hide all user's content
        await Question.updateMany({ author: user._id }, { visibility: 'hidden' });
        await Answer.updateMany({ author: user._id }, { visibility: 'hidden' });

        // Recalculate answer counts for affected questions
        try {
          const { recalculateAnswerCount } = require('../utils/helpers');
          const userAnswers = await Answer.find({ author: user._id });
          const questionIds = [...new Set(userAnswers.map(a => a.question.toString()))];
          for (const qId of questionIds) {
            await recalculateAnswerCount(qId);
          }
        } catch (err) {
          console.error('[spamGuard] Failed to recalculate answer counts during auto-suspension:', err.message);
        }

        return res.status(403).json({ suspended: true, retryAfter: user.suspendedUntil.getTime() });
      }

      const diffSeconds = (Date.now() - user.lastPostedAt.getTime()) / 1000;
      if (diffSeconds < cooldownSeconds) {
        const retryAfter = Math.ceil(cooldownSeconds - diffSeconds);
        return res.status(400).json({ blocked: false, reason: "Cooldown in effect. Please wait.", retryAfter });
      }
    }

    // C. Content Quality Checks
    if (isQuestion) {
      if (title.length < 10) {
        await handleViolation(user);
        return res.status(400).json({ blocked: false, reason: "Title must be at least 10 characters long" });
      }
      if (!category) {
        await handleViolation(user);
        return res.status(400).json({ blocked: false, reason: "Category is required" });
      }
    }

    if (body.length < 30) {
      await handleViolation(user);
      return res.status(400).json({ blocked: false, reason: "Body must be at least 30 characters long" });
    }

    const repeatedCharPattern = /(.)\1{6,}/;
    if (repeatedCharPattern.test(title) || repeatedCharPattern.test(body)) {
      await handleViolation(user);
      return res.status(400).json({ blocked: false, reason: "Message contains repeated character patterns" });
    }

    // Gibberish / randomstring detection
    const isGibberish = (text) => {
      if (!text || text.length < 5) return false;
      const lower = text.toLowerCase();
      const letters = lower.replace(/[^a-z]/g, '');
      if (letters.length < 5) return false;
      // Check vowel ratio — real words need at least 10% vowels
      const vowels = (letters.match(/[aeiou]/g) || []).length;
      const vowelRatio = vowels / letters.length;
      if (vowelRatio < 0.10) return true; // nearly no vowels = gibberish
      // Check consecutive consonant clusters (6+ in a row)
      if (/[bcdfghjklmnpqrstvwxyz]{6,}/.test(lower)) return true;
      // Check unique char ratio — real sentences have repetition
      const uniqueChars = new Set(letters).size;
      const uniqueRatio = uniqueChars / letters.length;
      if (letters.length > 12 && uniqueRatio > 0.85) return true;
      return false;
    };

    if (isQuestion && ((title && isGibberish(title)) || (body && isGibberish(body)))) {
      await handleViolation(user);
      return res.status(400).json({ blocked: false, reason: "Your question appears to be gibberish or random characters. Please write a clear, meaningful question." });
    }

    const externalLinkRegex = /https?:\/\//g;
    const linkMatches = (body.match(externalLinkRegex) || []).length + (title.match(externalLinkRegex) || []).length;
    if (user.trustLevel === 'new' && linkMatches > 0) {
      await handleViolation(user);
      return res.status(400).json({ blocked: false, reason: "New users cannot post external links" });
    } else if (linkMatches > 1) {
      await handleViolation(user);
      return res.status(400).json({ blocked: false, reason: "Only 1 external link is allowed per post" });
    }

    // D. Keyword Blacklist
    const lowerContent = (title + ' ' + body).toLowerCase();
    const blacklistMatch = blocklist.some(word => lowerContent.includes(word.toLowerCase()));
    if (blacklistMatch) {
      // Shadow ban user
      user.status = 'shadow_banned';
      await user.save();

      // Hide all user's content
      await Question.updateMany({ author: user._id }, { visibility: 'hidden' });
      await Answer.updateMany({ author: user._id }, { visibility: 'hidden' });

      // Override request fields so controller saves silently as hidden
      req.body.visibility = 'hidden';
      req.body.triggeredRule = 'keyword_blacklist';

      // Let request proceed silently
      return next();
    }

    // E. Off-topic Detection (Questions only)
    if (isQuestion) {
      const allowedKeywords = topicWhitelist[category.toLowerCase()] || [];
      if (allowedKeywords.length > 0) {
        const words = lowerContent.split(/\W+/);
        const hasOverlap = words.some(word => allowedKeywords.includes(word));
        if (!hasOverlap) {
          req.body.visibility = 'pending';
          req.body.triggeredRule = 'off_topic_flag';
        }
      }
    }

    // F. Duplicate Detection
    const normalizedBody = normalizeText(body);
    const normalizedTitle = normalizeText(title);

    // Check exact title match across all posts (Questions)
    if (isQuestion && title) {
      const exactMatch = await Question.findOne({ title: { $regex: new RegExp(`^${title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } });
      if (exactMatch) {
        await handleViolation(user);
        return res.status(400).json({
          blocked: false,
          reason: `A similar question already exists. View it here: /questions/${exactMatch._id}`
        });
      }
    }

    // Compare Levenshtein distance on last 10 posts
    const lastQuestions = await Question.find({ author: user._id }).sort({ createdAt: -1 }).limit(10);
    const lastAnswers = await Answer.find({ author: user._id }).sort({ createdAt: -1 }).limit(10);
    const lastPosts = [...lastQuestions, ...lastAnswers].sort((x, y) => y.createdAt - x.createdAt).slice(0, 10);

    for (const post of lastPosts) {
      const postText = normalizeText(post.body);
      const distance = getLevenshteinDistance(normalizedBody, postText);
      if (distance < 15) {
        await handleViolation(user);
        const link = post.question ? `/questions/${post.question}` : `/questions/${post._id}`;
        return res.status(400).json({
          blocked: false,
          reason: `A similar question already exists. View it here: ${link}`
        });
      }
    }

    // If we passed all checks, update lastPostedAt
    user.lastPostedAt = new Date();
    await user.save();

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { spamGuard, trackUserIpAndDevice };
