import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendEmail({ to, subject, html }) {
  try {
    await sgMail.send({
      to,
      from: process.env.SMTP_FROM, 
      subject,
      html,
    });
    console.log("✅ Email sent to", to);
  } catch (err) {
    console.error("❌ Email send error:", err);
    throw err;
  }
}
