const User = require('../models/User');
const enqueueEmail = require('../utils/enqueueEmail');

/**
 * Send email when a new question is approved (visibility becomes public).
 * Notifies all users who are in the same internship phase.
 */
async function sendNewQuestionApprovedNotification(question, authorName) {
  try {
    if (!question.phase) {
      console.log(`[EmailService] Question has no phase. Skipping notification.`);
      return;
    }

    // Find all users in the same phase with an email
    const users = await User.find({
      currentPhase: question.phase,
      email: { $exists: true, $ne: null },
      _id: { $ne: question.author }
    }).select('email displayName username');

    console.log(`[EmailService] Found ${users.length} users in phase ${question.phase} to notify about approved question.`);

    for (const u of users) {
      const body = `A new question has been approved in your internship phase (${question.phase}) by ${authorName}:\n\n"${question.title}"\n\nRead and answer it here: ${process.env.CLIENT_URL || 'http://localhost:3000'}/questions/${question._id}`;
      await enqueueEmail({
        to: u.email,
        userName: u.displayName || u.username,
        subject: `New Question in ${question.phase}: ${question.title}`,
        body,
        contentTitle: question.title
      });
    }
  } catch (err) {
    console.error('[EmailService] Error in sendNewQuestionApprovedNotification:', err.message);
  }
}

/**
 * Send email when an answer is posted and becomes public.
 * Notifies the question author only.
 */
async function sendAnswerPostedNotification(answer, question) {
  try {
    // Populate question author if needed
    let author = question.author;
    if (author && typeof author.email === 'undefined') {
      author = await User.findById(question.author).select('email displayName username');
    }

    if (!author || !author.email) {
      console.log(`[EmailService] Question author has no email. Skipping notification.`);
      return;
    }

    // Skip if author answered their own question
    if (author._id.toString() === answer.author.toString()) {
      return;
    }

    const answerAuthorName = answer.author && typeof answer.author === 'object' 
      ? (answer.author.displayName || answer.author.username || 'A peer')
      : 'A peer';

    const body = `Good news! Your question has a new answer from ${answerAuthorName}:\n\n"${answer.body.replace(/<[^>]*>/g, '')}"\n\nView the answer here: ${process.env.CLIENT_URL || 'http://localhost:3000'}/questions/${question._id}`;
    
    await enqueueEmail({
      to: author.email,
      userName: author.displayName || author.username,
      subject: `New Answer on: ${question.title}`,
      body,
      contentTitle: question.title
    });
  } catch (err) {
    console.error('[EmailService] Error in sendAnswerPostedNotification:', err.message);
  }
}

/**
 * Send email when a user is blocked.
 */
async function sendUserBlockedNotification(user, reason) {
  try {
    if (!user.email) {
      console.log(`[EmailService] User has no email. Skipping block notification.`);
      return;
    }

    const body = `This is to notify you that your account has been blocked by the administration.\n\nReason: ${reason || 'Violation of community terms.'}\n\nIf you believe this is an error, please contact support.`;
    
    await enqueueEmail({
      to: user.email,
      userName: user.displayName || user.username,
      subject: 'Account Status Notice: Blocked',
      body,
      contentTitle: 'Account Blocked'
    });
  } catch (err) {
    console.error('[EmailService] Error in sendUserBlockedNotification:', err.message);
  }
}

/**
 * Send email when a user is unblocked.
 */
async function sendUserUnblockedNotification(user) {
  try {
    if (!user.email) {
      console.log(`[EmailService] User has no email. Skipping unblock notification.`);
      return;
    }

    const body = `We are pleased to inform you that your account has been unblocked by the administration. You can now log back in and participate in the community.`;
    
    await enqueueEmail({
      to: user.email,
      userName: user.displayName || user.username,
      subject: 'Account Status Notice: Active',
      body,
      contentTitle: 'Account Re-activated'
    });
  } catch (err) {
    console.error('[EmailService] Error in sendUserUnblockedNotification:', err.message);
  }
}

/**
 * Send email when a user is warned.
 */
async function sendUserWarnedNotification(user, reason) {
  try {
    if (!user.email) {
      console.log(`[EmailService] User has no email. Skipping warn notification.`);
      return;
    }

    const body = `This is a formal warning regarding your account activity on PrashnaSārathi.\n\nReason: ${reason || 'Violation of community guidelines.'}\n\nPlease review our rules and ensure future behavior aligns with community standards.`;
    
    await enqueueEmail({
      to: user.email,
      userName: user.displayName || user.username,
      subject: 'Account Status Notice: Warning Issued',
      body,
      contentTitle: 'Account Warning'
    });
  } catch (err) {
    console.error('[EmailService] Error in sendUserWarnedNotification:', err.message);
  }
}

/**
 * Send email when a user is suspended.
 */
async function sendUserSuspendedNotification(user, durationHours, reason) {
  try {
    if (!user.email) {
      console.log(`[EmailService] User has no email. Skipping suspension notification.`);
      return;
    }

    const body = `This is to notify you that your account has been temporarily suspended.\n\nDuration: ${durationHours} hours\nReason: ${reason || 'Violation of community guidelines.'}\n\nYou will be unable to log in or post content until this suspension period ends.`;
    
    await enqueueEmail({
      to: user.email,
      userName: user.displayName || user.username,
      subject: `Account Status Notice: Suspended for ${durationHours}h`,
      body,
      contentTitle: 'Account Suspended'
    });
  } catch (err) {
    console.error('[EmailService] Error in sendUserSuspendedNotification:', err.message);
  }
}

/**
 * Send email when a user is shadow banned.
 */
async function sendUserShadowBannedNotification(user, reason) {
  try {
    if (!user.email) {
      console.log(`[EmailService] User has no email. Skipping shadow ban notification.`);
      return;
    }

    const body = `This is to notify you that your account has been restricted by the administration.\n\nReason: ${reason || 'Violation of community guidelines.'}\n\nIf you believe this restriction is an error, please contact support.`;
    
    await enqueueEmail({
      to: user.email,
      userName: user.displayName || user.username,
      subject: 'Account Status Notice: Restricted',
      body,
      contentTitle: 'Account Restricted'
    });
  } catch (err) {
    console.error('[EmailService] Error in sendUserShadowBannedNotification:', err.message);
  }
}

/**
 * Send email when a user is re-activated (unsuspended/unbanned/etc).
 */
async function sendUserActivatedNotification(user) {
  try {
    if (!user.email) {
      console.log(`[EmailService] User has no email. Skipping activation notification.`);
      return;
    }

    const body = `We are pleased to inform you that your account has been fully re-activated. You can now log back in and participate in the community.`;
    
    await enqueueEmail({
      to: user.email,
      userName: user.displayName || user.username,
      subject: 'Account Status Notice: Active',
      body,
      contentTitle: 'Account Re-activated'
    });
  } catch (err) {
    console.error('[EmailService] Error in sendUserActivatedNotification:', err.message);
  }
}

module.exports = {
  sendNewQuestionApprovedNotification,
  sendAnswerPostedNotification,
  sendUserBlockedNotification,
  sendUserUnblockedNotification,
  sendUserWarnedNotification,
  sendUserSuspendedNotification,
  sendUserShadowBannedNotification,
  sendUserActivatedNotification
};
