const nodemailer = require('nodemailer');
const User = require('../models/User');

// Setup Nodemailer transporter with dynamic options
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    const isGmail = host.includes('gmail.com') || host.includes('googlemail.com');
    const transportOptions = isGmail 
      ? {
          service: 'gmail',
          auth: { user, pass }
        }
      : {
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          tls: {
            rejectUnauthorized: false
          }
        };
    return nodemailer.createTransport(transportOptions);
  }

  // Fallback: Console Logging / Mock Transporter to prevent crashes
  console.log('⚠️ SMTP Credentials not configured. Operating in SIMULATED mock email mode.');
  return {
    sendMail: async (options) => {
      console.log('================ [SIMULATED EMAIL SENT] ================');
      console.log(`From: ${options.from}`);
      console.log(`To: ${options.to}`);
      if (options.bcc) console.log(`Bcc: ${options.bcc}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Body (HTML Snippet): ${options.html.substring(0, 300)}...`);
      console.log('========================================================');
      return { messageId: 'simulated-id-' + Date.now() };
    }
  };
};

const transporter = createTransporter();
const SENDER_EMAIL = 'faqportal.in@gmail.com';

/**
 * Send email when a new user completes onboarding
 */
exports.sendOnboardingEmail = async (user) => {
  try {
    const htmlContent = `
      <div style="font-family: 'Outfit', 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-2xl; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #4f46e5, #06b6d4); padding: 30px; border-radius: 12px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Welcome to PrashnaSārathi! 🚀</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Your learning journey begins here</p>
        </div>
        <div style="padding: 20px; color: #334155; line-height: 1.6;">
          <p>Hi <strong>${user.displayName || user.username}</strong>,</p>
          <p>We are absolutely thrilled to welcome you to the community! Your profile has been successfully set up and onboarded.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #1e293b;">Selected Internship Phase:</p>
            <p style="margin: 5px 0 0 0; color: #4f46e5; text-transform: uppercase; font-size: 14px; font-weight: 800;">
              ${user.currentPhase ? user.currentPhase.replace('_', ' ') : 'PRE-INTERNSHIP'}
            </p>
          </div>

          <p>Feel free to explore our extensive FAQ categories, search for existing queries, or post any doubts you might have. We believe in learning without fear!</p>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
          </div>
        </div>
        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
          <p>Sent with ❤️ by PrashnaSārathi Team</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `PrashnaSārathi <${SENDER_EMAIL}>`,
      to: user.email,
      subject: 'Welcome to PrashnaSārathi! 🚀 Onboarding Completed',
      html: htmlContent
    });
  } catch (err) {
    console.error('Error sending onboarding email:', err.message);
  }
};

/**
 * Send email when a user enters top 10 on the leaderboard
 */
exports.sendLeaderboardTop10Email = async (user) => {
  try {
    if (user.receivedTop10Email) return; // Prevent spamming

    const htmlContent = `
      <div style="font-family: 'Outfit', 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #eab308, #ca8a04); padding: 30px; border-radius: 12px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🏆 Top 10 Elite Leaderboard!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">You are crushing it, ${user.displayName || user.username}!</p>
        </div>
        <div style="padding: 20px; color: #334155; line-height: 1.6;">
          <p>Hi <strong>${user.displayName || user.username}</strong>,</p>
          <p>A huge congratulations! Your amazing contributions and high engagement have earned you a spot in the **Top 10 Leaders** of PrashnaSārathi community!</p>
          
          <div style="background-color: #fef08a; border: 1px solid #facc15; padding: 15px; margin: 20px 0; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-weight: bold; color: #854d0e; font-size: 16px;">Your Current Reputation Score</p>
            <p style="margin: 5px 0 0 0; color: #ca8a04; font-size: 32px; font-weight: 900;">${user.reputation}</p>
          </div>

          <p>Keep answering student queries, contributing content, and helping peers. Your badge and standing reflect your commitment to open-source excellence.</p>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/users" style="background-color: #ca8a04; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Leaderboard</a>
          </div>
        </div>
        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
          <p>Sent with 🏆 by PrashnaSārathi Team</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `PrashnaSārathi <${SENDER_EMAIL}>`,
      to: user.email,
      subject: '🏆 Elite Standing: You entered the Top 10 Leaderboard! 🚀',
      html: htmlContent
    });

    user.receivedTop10Email = true;
    await user.save();
  } catch (err) {
    console.error('Error sending leaderboard email:', err.message);
  }
};

/**
 * Send newsletter broadcast to all registered users when a new query is posted
 */
exports.sendNewQuestionNotification = async (question, authorName) => {
  try {
    // Fetch all registered users with emails, excluding the author
    const users = await User.find({ 
      email: { $exists: true, $ne: null },
      _id: { $ne: question.author }
    }).select('email');

    if (users.length === 0) return;

    const emails = users.map(u => u.email);
    const detailUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/questions/${question._id}`;

    const htmlContent = `
      <div style="font-family: 'Outfit', 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; border-radius: 12px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">❓ New Query Posted!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Can you help a peer out?</p>
        </div>
        <div style="padding: 20px; color: #334155; line-height: 1.6;">
          <p>Hey there,</p>
          <p>A new student query has been posted on the PrashnaSārathi platform by <strong>${question.isAnonymous ? 'Anonymous' : authorName}</strong>:</p>
          
          <div style="background-color: #f1f5f9; padding: 20px; margin: 20px 0; border-radius: 12px; border-left: 5px solid #3b82f6;">
            <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 18px;">${question.title}</h3>
            <div style="color: #475569; font-size: 14px; margin-bottom: 15px;">
              ${question.body.replace(/<[^>]*>/g, '').substring(0, 180)}...
            </div>
            ${question.tagNames && question.tagNames.length > 0 ? `
              <div style="margin-top: 10px;">
                ${question.tagNames.map(t => `<span style="background-color: #e2e8f0; color: #475569; font-size: 12px; padding: 4px 8px; border-radius: 6px; margin-right: 6px; display: inline-block;">#${t}</span>`).join('')}
              </div>
            ` : ''}
          </div>

          <p>Helping others solve doubts is the fastest way to learn and build community reputation. Give it a look!</p>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${detailUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Answer This Question</a>
          </div>
        </div>
        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
          <p>Sent with ❓ by PrashnaSārathi Team</p>
        </div>
      </div>
    `;

    // To prevent exceeding SMTP recipient limit, chunk the email sends
    const chunkSize = 50;
    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      await transporter.sendMail({
        from: `PrashnaSārathi Notifications <${SENDER_EMAIL}>`,
        to: SENDER_EMAIL, // Send to self
        bcc: chunk, // Hide everyone's email
        subject: `❓ New Community Query: "${question.title}"`,
        html: htmlContent
      });
    }
  } catch (err) {
    console.error('Error sending new question broadcast email:', err.message);
  }
};

/**
 * Notify all 'Me Too' users when a question is marked solved / accepted answer is selected
 */
exports.sendDoubtSolvedNotification = async (question, answerBody, solverName) => {
  try {
    if (!question.meTooUsers || question.meTooUsers.length === 0) return;

    // Populate user emails
    const meTooUsersPopulated = await User.find({
      _id: { $in: question.meTooUsers }
    }).select('email displayName username');

    if (meTooUsersPopulated.length === 0) return;

    const emails = meTooUsersPopulated.map(u => u.email);
    const detailUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/questions/${question._id}`;

    const htmlContent = `
      <div style="font-family: 'Outfit', 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #10b981, #047857); padding: 30px; border-radius: 12px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">✅ Doubt Solved!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">A query you had is now answered</p>
        </div>
        <div style="padding: 20px; color: #334155; line-height: 1.6;">
          <p>Hey there,</p>
          <p>Good news! A doubt you also had has been marked as <strong>SOLVED</strong> on PrashnaSārathi:</p>
          
          <div style="background-color: #f1f5f9; padding: 20px; margin: 20px 0; border-radius: 12px; border-left: 5px solid #10b981;">
            <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px;">Question: ${question.title}</h3>
            <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 15px 0;" />
            <p style="margin: 0 0 5px 0; font-weight: bold; color: #047857;">Verified Solution (by ${solverName}):</p>
            <div style="color: #334155; font-size: 14px; font-style: italic;">
              "${answerBody.replace(/<[^>]*>/g, '').substring(0, 250)}..."
            </div>
          </div>

          <p>Check out the full verified answer and conversation on the site!</p>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${detailUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Verified Solution</a>
          </div>
        </div>
        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
          <p>Sent with ✅ by PrashnaSārathi Team</p>
        </div>
      </div>
    `;

    // Send emails in chunk
    const chunkSize = 50;
    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      await transporter.sendMail({
        from: `PrashnaSārathi Notifications <${SENDER_EMAIL}>`,
        to: SENDER_EMAIL,
        bcc: chunk,
        subject: `✅ Resolved: The query "${question.title}" has been solved!`,
        html: htmlContent
      });
    }
  } catch (err) {
    console.error('Error sending doubt solved email:', err.message);
  }
};
