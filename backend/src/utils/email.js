const sgMail = require("@sendgrid/mail");

let isConfigured = false;

function configureSendGrid() {
  if (isConfigured) return;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not set.");
  }

  sgMail.setApiKey(apiKey);
  isConfigured = true;
}

async function sendEmail({ to, subject, html, from }) {
  configureSendGrid();

  const sender = from || process.env.SMTP_FROM;
  if (!sender) {
    throw new Error("SMTP_FROM is not set.");
  }

  try {
    await sgMail.send({
      to,
      from: sender,
      subject,
      html,
    });
    console.log("✅ Email sent to", to);
  } catch (err) {
    console.error("❌ Email send error:", err);
    throw err;
  }
}

module.exports = { sendEmail };
