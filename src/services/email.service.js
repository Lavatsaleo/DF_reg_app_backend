function getEmailFromAddress() {
  const fromName = process.env.SMTP_FROM_NAME || "Digital Futures Registration Portal";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "noreply@example.org";
  return `"${fromName}" <${fromEmail}>`;
}

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM_EMAIL);
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) {
    return {
      sent: false,
      skipped: true,
      reason: "No recipient email address was provided.",
    };
  }

  if (!isSmtpConfigured()) {
    console.warn("[EMAIL NOT CONFIGURED] Email was not sent.");
    console.warn(`To: ${to}`);
    console.warn(`Subject: ${subject}`);
    console.warn(text);

    return {
      sent: false,
      skipped: true,
      reason: "SMTP is not configured. The invite link was printed in the backend console for local testing.",
    };
  }

  // Nodemailer is required lazily so the backend can still start in local
  // environments before SMTP is configured.
  const nodemailer = require("nodemailer");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

  await transporter.sendMail({
    from: getEmailFromAddress(),
    to,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    skipped: false,
    reason: null,
  };
}

module.exports = {
  sendEmail,
};
