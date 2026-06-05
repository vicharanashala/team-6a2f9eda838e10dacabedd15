/**
 * Generates a beautiful, responsive HTML email template for PrashnaSārathi notifications.
 */
function getHtmlTemplate(userName, subject, body, contentTitle, timestamp) {
  // Replace plain text newlines with <br /> for HTML body while keeping formatting intact
  const formattedBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, '<br />');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #0b0f19;
      margin: 0;
      padding: 0;
      color: #f3f4f6;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f19;
      padding: 32px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15);
    }
    .header {
      background-color: #0f172a;
      padding: 32px 24px;
      text-align: center;
      border-bottom: 1px solid #1f2937;
    }
    .logo-container {
      margin: 0 auto 12px auto;
      width: 64px;
      height: 64px;
      background: #1e293b;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #6366f1;
    }
    .logo {
      height: 48px;
      width: 48px;
      object-fit: contain;
      vertical-align: middle;
    }
    .header-title {
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .content {
      padding: 36px 32px;
      line-height: 1.6;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #ffffff;
    }
    .message-body {
      font-size: 15px;
      color: #d1d5db;
      margin-bottom: 28px;
      line-height: 1.7;
    }
    .footer {
      background-color: #0f172a;
      padding: 32px 24px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #1f2937;
    }
    .footer-links {
      margin-bottom: 16px;
    }
    .footer-links a {
      color: #818cf8;
      text-decoration: none;
      margin: 0 10px;
      font-weight: 500;
    }
    .footer-links a:hover {
      text-decoration: underline;
    }
    .metadata {
      font-size: 11px;
      color: #6b7280;
      margin-top: 16px;
      border-top: 1px solid #1f2937;
      padding-top: 16px;
      text-align: left;
    }
    .metadata-row {
      margin-bottom: 4px;
    }
    .badge {
      display: inline-block;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div style="display: table; margin: 0 auto;">
          <img src="cid:logo" alt="PrashnaSārathi Logo" class="logo" />
        </div>
        <div class="header-title" style="margin-top: 12px;">PrashnaSārathi</div>
      </div>
      <div class="content">
        <div class="greeting">Hi ${userName},</div>
        <div class="message-body">${formattedBody}</div>
      </div>
      <div class="footer">
        <div class="footer-links">
          <a href="http://localhost:3000/questions">Questions</a> • 
          <a href="http://localhost:3000/faqs">FAQs</a> • 
          <a href="http://localhost:3000/guidelines">Guidelines</a>
        </div>
        <div style="font-weight: 600; color: #ffffff; margin-bottom: 4px;">PrashnaSārathi Portal</div>
        <div>Empowering peer-to-peer knowledge exchange</div>
        <div class="metadata">
          <div class="metadata-row"><strong>Topic:</strong> ${contentTitle || subject}</div>
          <div class="metadata-row"><strong>Sent:</strong> ${new Date(timestamp).toLocaleString()}</div>
          <div class="metadata-row">This is an automated system notification from your subscription.</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = { getHtmlTemplate };
