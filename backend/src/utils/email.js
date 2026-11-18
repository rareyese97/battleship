const sgMail = require("@sendgrid/mail");

let configuredApiKey;

function configureSendGrid() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("SENDGRID_API_KEY is not configured.");
  if (configuredApiKey !== apiKey) {
    sgMail.setApiKey(apiKey);
    configuredApiKey = apiKey;
  }
}

async function sendEmail({ to, subject, html, text, from }) {
  configureSendGrid();
  const sender = from || process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_FROM;
  if (!sender) throw new Error("Set SENDGRID_FROM_EMAIL to a verified SendGrid sender address.");
  if (!to || !subject || (!html && !text)) throw new Error("Email requires a recipient, subject, and content.");

  try {
    await sgMail.send({ to, from: sender, subject, ...(html ? { html } : {}), ...(text ? { text } : {}) });
  } catch (err) {
    // Log SendGrid's structured API errors without exposing authorization headers or API keys.
    console.error("SendGrid delivery failed:", JSON.stringify({
      statusCode: err?.code,
      message: err?.message,
      errors: err?.response?.body?.errors ?? err?.response?.body ?? null,
    }, null, 2));
    throw err;
  }
}

module.exports = { sendEmail };
