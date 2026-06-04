const mongoose = require('mongoose');
const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Report = require('../models/Report');
const SiteReport = require('../models/SiteReport');
const { recalculateAnswerCount } = require('./helpers');

const cleanupOrphanedData = async () => {
  try {
    console.log('[Cleanup] Starting database purge of fake, gibberish and deleted data...');
    
    // 1. Delete all deleted/hidden questions and answers
    const deletedQs = await Question.deleteMany({ $or: [{ isDeleted: true }, { status: 'deleted' }] });
    const deletedAs = await Answer.deleteMany({ $or: [{ isDeleted: true }, { status: 'deleted' }] });
    console.log(`[Cleanup] Purged ${deletedQs.deletedCount} deleted questions and ${deletedAs.deletedCount} deleted answers.`);

    // 2. Delete questions/answers with gibberish title or body
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

    // 3. Delete orphaned reports pointing to non-existent posts or authors
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

    // 4. Delete site reports with title "undefined" or description containing test/error gibberish
    const deletedSiteReports = await SiteReport.deleteMany({
      $or: [
        { title: 'undefined' },
        { title: undefined },
        { description: /7j6rrfikdfudj/ },
        { description: /test/i }
      ]
    });
    console.log(`[Cleanup] Deleted ${deletedSiteReports.deletedCount} fake site reports.`);

    // 5. Delete any remaining questions/answers whose authors do not exist
    const remainingQs = await Question.find({});
    let orphanedQs = 0;
    for (const q of remainingQs) {
      if (!q.author || !userIds.has(q.author.toString())) {
        console.log(`[Cleanup] Deleting orphaned question "${q.title}" (Author does not exist)`);
        await Question.deleteOne({ _id: q._id });
        await Answer.deleteMany({ question: q._id });
        orphanedQs++;
      }
    }

    const remainingAs = await Answer.find({});
    let orphanedAs = 0;
    for (const a of remainingAs) {
      if (!a.author || !userIds.has(a.author.toString()) || !a.question || !(await Question.exists({ _id: a.question }))) {
        console.log(`[Cleanup] Deleting orphaned answer (Author/Question does not exist)`);
        await Answer.deleteOne({ _id: a._id });
        orphanedAs++;
      }
    }

    // Recalculate answer counts
    const activeQs = await Question.find({}, '_id');
    for (const q of activeQs) {
      await recalculateAnswerCount(q._id);
    }

    console.log(`[Cleanup] Finished. Orphaned Qs deleted: ${orphanedQs}, Orphaned As deleted: ${orphanedAs}`);
  } catch (err) {
    console.error('[Cleanup] Error during database cleanup:', err.message);
  }
};

module.exports = { cleanupOrphanedData };
