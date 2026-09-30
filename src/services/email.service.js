// SMTP acceptance is not the same as delivery into a participant's inbox.
// Store invitation status as SENT only when the SMTP server explicitly accepts it.
function getEmailFromAddress() {
  const fromName = process.env.SMTP_FROM_NAME || "Digital Futures Registration Portal";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "noreply@example.org";
  return `"${fromName}" <${fromEmail}>`;
}

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && (process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER));
}

function isTransientSmtpFailure(error) {
  const responseCode = Number(error?.responseCode);
  if ([421, 450, 451, 452].includes(responseCode)) return true;

  return ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EAI_AGAIN"].includes(
    String(error?.code || "").toUpperCase()
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sendEmail({ to, subject, text, html }) {
  const recipient = String(to || "").trim();

  if (!recipient) {
    return {
      sent: false,
      skipped: true,
      reason: "No recipient email address was provided.",
    };
  }

  if (!isSmtpConfigured()) {
    console.warn("[DIGITAL FUTURES EMAIL] SMTP not configured; invitation was not sent.");
    // Do not log the email body: it contains a private one-time invitation URL.
    return {
      sent: false,
      skipped: true,
      reason: "SMTP is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL (or SMTP_USER).",
    };
  }

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
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  try {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await transporter.sendMail({
          from: getEmailFromAddress(),
          to: recipient,
          subject,
          text,
          html,
        });
        const accepted = Array.isArray(result.accepted) ? result.accepted : [];
        const rejected = Array.isArray(result.rejected) ? result.rejected : [];

        // A message may have been processed without acceptance of its recipient.
        const recipientAccepted = accepted.some(
          (address) => String(address).toLowerCase() === recipient.toLowerCase()
        );

        if (!recipientAccepted || rejected.length > 0) {
          const reason = "The SMTP server did not accept the recipient address.";
          console.warn("[DIGITAL FUTURES EMAIL] SMTP recipient rejected", {
            messageId: result.messageId || null,
            acceptedCount: accepted.length,
            rejectedCount: rejected.length,
          });
          return { sent: false, skipped: false, reason };
        }

        console.info("[DIGITAL FUTURES EMAIL] SMTP accepted", {
          messageId: result.messageId || null,
          subject,
          recipientCount: accepted.length,
          attempts: attempt,
        });

        return {
          sent: true,
          skipped: false,
          reason: null,
          messageId: result.messageId || null,
        };
      } catch (error) {
        const transient = isTransientSmtpFailure(error);
        console.warn("[DIGITAL FUTURES EMAIL] SMTP sending error", {
          code: error.code || null,
          responseCode: error.responseCode || null,
          attempt,
          retrying: transient && attempt < 3,
        });

        if (!transient || attempt === 3) {
          throw error;
        }

        await sleep(attempt * 1500);
      }
    }

    return { sent: false, skipped: false, reason: "SMTP sending did not complete." };
  } finally {
    transporter.close();
  }
}

module.exports = { sendEmail };
