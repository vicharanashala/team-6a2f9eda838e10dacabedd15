const Question = require('../models/Question');
const User = require('../models/User');
const { createNotification } = require('./notificationService');

const HIGH_KEYWORDS = [
  "can't access", "cannot access", "access blocked", "blocked from", "nobody is helping", "no one is helping",
  "this is urgent", "extremely urgent", "please help immediately", "immediate attention", "help me please",
  "abusive", "panic", "broken", "useless", "worst platform", "fail", "failed repeatedly", "failed multiple times"
];

const MEDIUM_KEYWORDS = [
  "waiting", "been waiting", "how long", "slow", "confused", "doesn't make sense", "does not make sense",
  "unclear", "repeat query", "again", "still not", "not working", "why"
];

const classifyText = (text) => {
  const clean = text.toLowerCase();
  let score = 0;

  HIGH_KEYWORDS.forEach(kw => {
    if (clean.includes(kw)) score += 35;
  });
  
  MEDIUM_KEYWORDS.forEach(kw => {
    if (clean.includes(kw)) score += 15;
  });

  if (/[!?]{2,}/.test(text)) score += 10;
  
  const words = text.split(/\s+/);
  const capsWords = words.filter(w => w.length > 3 && w === w.toUpperCase());
  if (capsWords.length / words.length > 0.3) {
    score += 15;
  }

  let severity = 'low';
  if (score >= 40) {
    severity = 'high';
  } else if (score >= 15) {
    severity = 'medium';
  }

  return { score: Math.min(100, score), severity };
};

const sendSimulatedEmail = (to, subject, body) => {
  console.log(`\n============================================================`);
  console.log(`✉️ SIMULATED EMAIL SENT TO: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`------------------------------------------------------------`);
  console.log(body);
  console.log(`============================================================\n`);
};

const alertAdminsAndModerators = async (question, subject) => {
  try {
    const staff = await User.find({ role: { $in: ['admin', 'moderator'] } });
    const author = await User.findById(question.author);
    const truncatedBody = question.body.substring(0, 150) + (question.body.length > 150 ? '...' : '');
    const directLink = `/questions/${question._id}`;
    
    for (const member of staff) {
      await createNotification({
        recipient: member._id,
        type: 'anomaly',
        title: subject,
        message: `User ${author?.displayName || author?.username} posted a query flagged as high severity.`,
        link: directLink,
        referenceType: 'Question',
        reference: question._id
      });
      
      sendSimulatedEmail(
        member.email,
        subject,
        `User ${author?.displayName || author?.username} posted a query flagged as high severity.
Query: "${truncatedBody}"
Posted: ${question.createdAt || new Date()}
Link: ${process.env.CLIENT_URL || 'http://localhost:3000'}${directLink}`
      );
    }
  } catch (err) {
    console.error('Failed to send anomaly alerts:', err);
  }
};

const processAnomalyClassification = async (questionId) => {
  try {
    const question = await Question.findById(questionId);
    if (!question) return;

    const fullText = `${question.title} ${question.body}`;
    const { score, severity } = classifyText(fullText);

    question.anomalyScore = score;
    question.anomalySeverity = severity;

    if (severity === 'high') {
      // Smart Deduplication check: last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentHighQuery = await Question.findOne({
        _id: { $ne: question._id },
        author: question.author,
        anomalySeverity: 'high',
        createdAt: { $gte: thirtyMinutesAgo }
      });

      if (recentHighQuery) {
        console.log(`Anomaly deduplicated: User ${question.author} posted similar query recently. Appending to alert thread.`);
        question.alertSent = false;
        await question.save();
        return;
      }

      question.alertSent = true;
      await question.save();

      const subject = `[HIGH ALERT] User query needs immediate attention`;
      await alertAdminsAndModerators(question, subject);
    } else {
      await question.save();
    }

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'anomaly_classified', questionId: question._id, severity });
    } catch (err) {
      console.error('Socket notification error for anomaly:', err.message);
    }
  } catch (err) {
    console.error('Error processing anomaly classification:', err);
  }
};

const checkAndEscalateAnomalies = async () => {
  try {
    const now = new Date();
    const fifteenMinAgo = new Date(now - 15 * 60 * 1000);
    const thirtyMinAgo = new Date(now - 30 * 60 * 1000);
    
    // 15-minute check
    const queriesToRealert = await Question.find({
      anomalySeverity: 'high',
      anomalyResolvedAt: null,
      escalated15MinSent: false,
      createdAt: { $lte: fifteenMinAgo, $gt: thirtyMinAgo }
    });
    
    for (const query of queriesToRealert) {
      query.escalated15MinSent = true;
      await query.save();
      
      const subject = `[UNRESOLVED — 15min] [HIGH ALERT] User query needs immediate attention`;
      await alertAdminsAndModerators(query, subject);
    }
    
    // 30-minute escalation
    const queriesToEscalate = await Question.find({
      anomalySeverity: 'high',
      anomalyResolvedAt: null,
      escalated30MinSent: false,
      createdAt: { $lte: thirtyMinAgo }
    });
    
    for (const query of queriesToEscalate) {
      query.escalated30MinSent = true;
      await query.save();
      
      const subject = `[UNRESOLVED — 30min] [ESCALATED] User query needs immediate attention`;
      await alertAdminsAndModerators(query, subject);
    }
  } catch (err) {
    console.error('Error in anomaly auto-escalation job:', err);
  }
};

module.exports = {
  classifyText,
  processAnomalyClassification,
  checkAndEscalateAnomalies,
  alertAdminsAndModerators
};
