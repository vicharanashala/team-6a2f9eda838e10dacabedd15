const nodemailer = require('nodemailer');
const config = require('./index');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  pool: true,
  maxConnections: 1,
  rateLimit: 1, // 1 message per second
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass
  }
});

module.exports = transporter;
