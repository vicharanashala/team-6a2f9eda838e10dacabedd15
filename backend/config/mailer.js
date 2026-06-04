const nodemailer = require('nodemailer');

const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || 'faqportal.in@gmail.com';
const gmailPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || 'your_app_password_here';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  pool: true,
  maxConnections: 1,
  rateLimit: 1, // 1 message per second
  auth: {
    user: gmailUser,
    pass: gmailPassword
  }
});

module.exports = transporter;
