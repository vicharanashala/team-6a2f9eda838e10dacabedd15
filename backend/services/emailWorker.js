const cron = require('node-cron');
const transporter = require('../config/mailer');
const EmailQueue = require('../models/EmailQueue');
const BouncedEmail = require('../models/BouncedEmail');
const EmailStat = require('../models/EmailStat');

let isProcessing = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getDailySentCount() {
  const today = new Date().toISOString().split('T')[0];
  const stat = await EmailStat.findOne({ date: today });
  return stat ? stat.count : 0;
}

async function incrementDailySentCount() {
  const today = new Date().toISOString().split('T')[0];
  await EmailStat.findOneAndUpdate(
    { date: today },
    { $inc: { count: 1 } },
    { upsert: true, new: true }
  );
}

function isPermanentError(err) {
  const msg = (err.message || '').toLowerCase();
  const responseCode = err.responseCode;
  
  if (responseCode === 550 || responseCode === 551 || responseCode === 553) {
    return true;
  }
  
  if (msg.includes('550') || msg.includes('551') || msg.includes('553') || msg.includes('recipient address rejected') || msg.includes('mailbox not found')) {
    return true;
  }
  
  return false;
}

async function processEmailQueue() {
  if (isProcessing) {
    console.log('[EmailWorker] Queue run already in progress. Skipping overlapping run.');
    return;
  }
  
  isProcessing = true;
  console.log('[EmailWorker] Starting queue processing job...');
  
  try {
    // 1. Fetch up to 10 pending emails where nextRetryAt <= now
    const now = new Date();
    const pendingJobs = await EmailQueue.find({
      status: 'pending',
      nextRetryAt: { $lte: now }
    })
    .sort({ createdAt: 1 })
    .limit(10);
    
    console.log(`[EmailWorker] Found ${pendingJobs.length} pending emails to process.`);
    
    for (let i = 0; i < pendingJobs.length; i++) {
      const job = pendingJobs[i];
      
      // Check daily limit guard
      const dailyCount = await getDailySentCount();
      if (dailyCount >= 450) {
        console.warn(`[EmailWorker] Hard limit of 450 daily emails reached (${dailyCount}). Pausing email delivery.`);
        break;
      }
      
      // Delay 3 seconds between each email (except the first one)
      if (i > 0) {
        await delay(3000);
      }
      
      // Double check bounce list right before sending (just in case they got bounced during this run)
      const bounced = await BouncedEmail.findOne({ email: job.to });
      if (bounced) {
        job.status = 'bounced';
        job.failReason = 'Bounced address skipped during delivery';
        await job.save();
        console.log(`[EmailWorker] Silently marked job ${job._id} as bounced (address ${job.to} is in bounce list)`);
        continue;
      }
      
      try {
        console.log(`[EmailWorker] Sending email to ${job.to} for user ${job.userName}...`);
        
        await transporter.sendMail({
          from: `"PrashnaSārathi" <${transporter.options.auth.user}>`,
          to: job.to,
          subject: job.subject,
          text: job.body,
        });
        
        // On success:
        job.status = 'sent';
        job.sentAt = new Date();
        job.attempts += 1;
        await job.save();
        
        await incrementDailySentCount();
        console.log(`[EmailWorker] Email sent successfully to ${job.to}`);
        
      } catch (err) {
        console.error(`[EmailWorker] Failed sending to ${job.to}:`, err.message);
        
        const isPerm = isPermanentError(err);
        job.attempts += 1;
        job.failReason = err.message;
        
        if (isPerm) {
          // Permanent bounce
          job.status = 'bounced';
          await job.save();
          
          // Add to bounced_emails list
          try {
            await BouncedEmail.create({
              email: job.to,
              reason: err.message
            });
            console.log(`[EmailWorker] Added ${job.to} to permanent bounce list.`);
          } catch (bounceErr) {
            // Unique index might throw error if already added
          }
        } else {
          // Temporary error
          if (job.attempts >= job.maxAttempts) {
            job.status = 'failed';
          } else {
            // Exponential backoff: attempts * 5 minutes
            const backoffMs = job.attempts * 5 * 60 * 1000;
            job.nextRetryAt = new Date(Date.now() + backoffMs);
          }
          await job.save();
        }
      }
    }
  } catch (err) {
    console.error('[EmailWorker] Critical queue processing error:', err.message);
  } finally {
    isProcessing = false;
    console.log('[EmailWorker] Queue processing job finished.');
  }
}

function startEmailWorker() {
  console.log('[EmailWorker] Initializing Nodemailer Queue Worker...');
  
  // Process pending jobs immediately on startup
  processEmailQueue().catch(err => {
    console.error('[EmailWorker] Startup run failed:', err.message);
  });
  
  // Schedule every 1 minute
  cron.schedule('* * * * *', () => {
    processEmailQueue().catch(err => {
      console.error('[EmailWorker] Cron run failed:', err.message);
    });
  });
}

module.exports = {
  startEmailWorker,
  processEmailQueue
};
