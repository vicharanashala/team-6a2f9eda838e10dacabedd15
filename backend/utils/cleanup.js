const mongoose = require('mongoose');
const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Report = require('../models/Report');
const SiteReport = require('../models/SiteReport');
const { recalculateAnswerCount } = require('./helpers');

const cleanupOrphanedData = async () => {
  try {
    console.log('[Cleanup] Starting database cleanup and repair...');

    // 1. Hard-delete all soft-deleted questions and answers from DB
    const deletedQs = await Question.deleteMany({ $or: [{ isDeleted: true }, { status: 'deleted' }] });
    const deletedAs = await Answer.deleteMany({ $or: [{ isDeleted: true }, { status: 'deleted' }] });
    console.log(`[Cleanup] Purged ${deletedQs.deletedCount} deleted questions and ${deletedAs.deletedCount} deleted answers.`);

    // 2. Delete questions with gibberish titles
    const allQs = await Question.find({});
    let gibberishQsCount = 0;
    for (const q of allQs) {
      const uppercaseNoSpaces = q.title.replace(/\s/g, '');
      const uniqueChars = new Set(uppercaseNoSpaces).size;
      const hasConsecutiveConsonants = /[bcdfghjklmnpqrstvwxyz]{6,}/i.test(q.title);
      const isGibberish = (uppercaseNoSpaces.length > 10 && uniqueChars / uppercaseNoSpaces.length < 0.3) ||
                          hasConsecutiveConsonants ||
                          q.title.toLowerCase().includes('fdsfsf') ||
                          q.title.toLowerCase().includes('dfsfdsf');
      if (isGibberish) {
        console.log(`[Cleanup] Deleting gibberish question: "${q.title}"`);
        await Question.deleteOne({ _id: q._id });
        await Answer.deleteMany({ question: q._id });
        gibberishQsCount++;
      }
    }
    console.log(`[Cleanup] Deleted ${gibberishQsCount} gibberish questions.`);

    // 3. Delete orphaned reports
    const users = await User.find({}, '_id').lean();
    const userIds = new Set(users.map(u => u._id.toString()));

    const reports = await Report.find({});
    let deletedReports = 0;
    for (const r of reports) {
      const hasReporter = r.reportedBy && userIds.has(r.reportedBy.toString());
      let targetExists = false;
      if (r.postId) {
        if (r.postType === 'Question') {
          targetExists = await Question.exists({ _id: r.postId });
        } else if (r.postType === 'Answer') {
          targetExists = await Answer.exists({ _id: r.postId });
        }
      }
      if (!hasReporter || !targetExists) {
        await Report.deleteOne({ _id: r._id });
        deletedReports++;
      }
    }
    console.log(`[Cleanup] Deleted ${deletedReports} orphaned reports.`);

    // 4. Delete fake site reports
    const deletedSiteReports = await SiteReport.deleteMany({
      $or: [
        { title: 'undefined' },
        { title: undefined },
        { description: /7j6rrfikdfudj/ },
        { description: /test/i }
      ]
    });
    console.log(`[Cleanup] Deleted ${deletedSiteReports.deletedCount} fake site reports.`);

    // 5. Delete orphaned questions/answers (author or parent question no longer exists)
    const remainingQs = await Question.find({});
    let orphanedQs = 0;
    for (const q of remainingQs) {
      if (!q.author || !userIds.has(q.author.toString())) {
        await Question.deleteOne({ _id: q._id });
        await Answer.deleteMany({ question: q._id });
        orphanedQs++;
      }
    }

    const remainingAs = await Answer.find({});
    let orphanedAs = 0;
    for (const a of remainingAs) {
      if (!a.author || !userIds.has(a.author.toString()) || !a.question || !(await Question.exists({ _id: a.question }))) {
        await Answer.deleteOne({ _id: a._id });
        orphanedAs++;
      }
    }

    // 5a. Recalculate answerCount on Question documents
    const activeQs = await Question.find({}, '_id');
    for (const q of activeQs) {
      await recalculateAnswerCount(q._id);
    }

    // 5b. Sync User.answerCount from actual non-deleted answers
    console.log('[Cleanup] Syncing User.answerCount from live answer data...');
    const allUserDocs = await User.find({}, '_id').lean();
    let syncedAnswerCountUsers = 0;
    for (const u of allUserDocs) {
      const actualCount = await Answer.countDocuments({ author: u._id, isDeleted: { $ne: true } });
      const dbUser = await User.findById(u._id).select('answerCount');
      if (dbUser && dbUser.answerCount !== actualCount) {
        await User.updateOne({ _id: u._id }, { $set: { answerCount: actualCount } });
        syncedAnswerCountUsers++;
      }
    }
    console.log(`[Cleanup] Synced answerCount for ${syncedAnswerCountUsers} users.`);

    // ─── Spurti Points Repair ─────────────────────────────────────────────────
    const SpurtiPointLog = require('../models/SpurtiPointLog');

    // 6a. Create retroactive +1 SP log for each accepted answer that lacks one
    console.log('[Cleanup] Backfilling SpurtiPointLog for historic accepted answers...');
    const acceptedAnswers = await Answer.find({ isAccepted: true }).select('_id author question');
    let retroLogCount = 0;
    for (const ans of acceptedAnswers) {
      const existing = await SpurtiPointLog.findOne({
        referenceId: ans._id,
        referenceType: 'Answer',
        action: 'reward',
        amount: 1
      });
      if (!existing && ans.author) {
        const parentQ = await Question.findById(ans.question).select('title');
        await SpurtiPointLog.create({
          user: ans.author,
          amount: 1,
          action: 'reward',
          reason: `Answer accepted on question: "${parentQ ? parentQ.title : 'Unknown'}"`,
          referenceType: 'Answer',
          referenceId: ans._id
        });
        retroLogCount++;
      }
    }
    console.log(`[Cleanup] Backfilled ${retroLogCount} SP logs for existing accepted answers.`);

    // 6b. Ensure every user has the 10-point base registration credit
    console.log('[Cleanup] Ensuring base 10 Sp credit for all users...');
    const allUsers = await User.find({});
    let creditedCount = 0;
    for (const u of allUsers) {
      const existingLog = await SpurtiPointLog.findOne({
        user: u._id,
        reason: 'Base Spurti Points credited on account registration'
      });
      if (!existingLog) {
        console.log(`[Cleanup] Crediting base 10 Sp to: ${u.username}`);
        await SpurtiPointLog.create({
          user: u._id,
          amount: 10,
          action: 'reward',
          reason: 'Base Spurti Points credited on account registration',
        });
        creditedCount++;
      }
    }
    console.log(`[Cleanup] Credited base Sp to ${creditedCount} users.`);

    // 6c. Resync User.spurtiPoints from authoritative SpurtiPointLog sum
    console.log('[Cleanup] Resyncing spurtiPoints from SpurtiPointLog totals...');
    const logTotals = await SpurtiPointLog.aggregate([
      { $group: { _id: '$user', totalSp: { $sum: '$amount' } } }
    ]);
    let spSyncedCount = 0;
    for (const entry of logTotals) {
      const correctSp = Math.max(0, entry.totalSp);
      const targetUser = await User.findById(entry._id).select('spurtiPoints');
      if (targetUser && targetUser.spurtiPoints !== correctSp) {
        await User.updateOne({ _id: entry._id }, { $set: { spurtiPoints: correctSp } });
        spSyncedCount++;
      }
    }
    console.log(`[Cleanup] Resynced spurtiPoints for ${spSyncedCount} users from log data.`);

    // Broadcast updated leaderboard if anything changed
    if (creditedCount > 0 || spSyncedCount > 0 || retroLogCount > 0) {
      try {
        const { broadcastLeaderboard } = require('../services/leaderboardService');
        await broadcastLeaderboard();
      } catch (err) {
        console.error('[Cleanup] Error broadcasting leaderboard:', err.message);
      }
    }

    console.log(
      `[Cleanup] Done. Orphaned Qs: ${orphanedQs}, Orphaned As: ${orphanedAs}, ` +
      `answerCount synced for ${syncedAnswerCountUsers} users, ` +
      `Base Sp credited to ${creditedCount} users, ` +
      `Retro SP logs: ${retroLogCount}, SP resynced: ${spSyncedCount} users.`
    );
  } catch (err) {
    console.error('[Cleanup] Error during database cleanup:', err.message);
  }
};

module.exports = { cleanupOrphanedData };
