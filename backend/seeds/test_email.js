require('dotenv').config({ path: require('path').join(__dirname, '../../secrets.env') });
const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = parseInt(process.env.SMTP_PORT || '587');
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

console.log('--- SMTP Diagnostic Tool ---');
console.log('SMTP_HOST:', host);
console.log('SMTP_PORT:', port);
console.log('SMTP_USER:', user ? user : '(not set)');
console.log('SMTP_PASS:', pass ? '******' : '(not set)');

if (!user || !pass) {
  console.error('❌ Error: SMTP_USER or SMTP_PASS is not set in secrets.env/environment variables.');
  process.exit(1);
}

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

console.log('Initializing transporter with options:', JSON.stringify({
  ...transportOptions,
  auth: { user, pass: '******' }
}, null, 2));

const transporter = nodemailer.createTransport(transportOptions);

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Connection verification FAILED:');
    console.error(error);
    process.exit(1);
  } else {
    console.log('✅ SMTP Connection is verified and ready to send messages!');
    
    const mailOptions = {
      from: `"PrashnaSārathi Test" <${user}>`,
      to: user,
      subject: 'PrashnaSārathi SMTP Test Email 🚀',
      text: 'This is a test email sent from the PrashnaSārathi SMTP diagnostic script.',
      html: '<h1>PrashnaSārathi SMTP Diagnostic</h1><p>This is a test email sent from the PrashnaSārathi SMTP diagnostic script. If you received this, your email configuration is working perfectly!</p>'
    };

    console.log('Sending test email to:', user);
    transporter.sendMail(mailOptions, (sendErr, info) => {
      if (sendErr) {
        console.error('❌ Error sending test email:');
        console.error(sendErr);
        process.exit(1);
      } else {
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        process.exit(0);
      }
    });
  }
});
