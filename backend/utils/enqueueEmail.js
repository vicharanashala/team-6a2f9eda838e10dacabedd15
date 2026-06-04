const EmailQueue = require('../models/EmailQueue');
const BouncedEmail = require('../models/BouncedEmail');

function sanitizeSubject(subject) {
  let cleaned = subject || 'Notification';
  
  // 1. Remove spam words (case-insensitive)
  const spamWords = ['FREE', 'URGENT', 'CASH', 'CLICK HERE', 'WIN', 'OFFER'];
  for (const word of spamWords) {
    const regex = new RegExp('\\b' + word + '\\b', 'gi');
    cleaned = cleaned.replace(regex, '');
  }
  
  // 2. Remove exclamation marks
  cleaned = cleaned.replace(/!/g, '');
  
  // 3. Prevent ALL CAPS
  if (cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }
  
  // 4. Max 60 chars
  if (cleaned.length > 60) {
    cleaned = cleaned.substring(0, 57) + '...';
  }
  
  return cleaned.trim() || 'Notification';
}

/**
 * Enqueues an email into the MongoDB email_queue collection.
 * Always injects userName, timestamp, and contentTitle.
 */
async function enqueueEmail({ to, userName, subject, body, contentTitle }) {
  try {
    const targetEmail = to.toLowerCase().trim();
    
    // Check if email is in the bounced_emails collection
    const bounced = await BouncedEmail.findOne({ email: targetEmail });
    if (bounced) {
      console.log(`[Enqueue] Skipping email to ${targetEmail} (previously bounced)`);
      return null;
    }
    
    // Sanitize subject
    const finalSubject = sanitizeSubject(subject);
    
    // Inject personalization into body
    const timestamp = new Date().toISOString();
    const titleText = contentTitle || finalSubject;
    const finalBody = `Hi ${userName},\n\n${body}\n\n---\nTopic: ${titleText}\nSent: ${timestamp}`;
    
    const emailJob = await EmailQueue.create({
      to: targetEmail,
      userName,
      subject: finalSubject,
      body: finalBody,
      status: 'pending',
    });
    
    console.log(`[Enqueue] Email to ${targetEmail} enqueued successfully.`);
    return emailJob;
  } catch (err) {
    console.error('[Enqueue] Error enqueuing email:', err.message);
    throw err;
  }
}

module.exports = enqueueEmail;
