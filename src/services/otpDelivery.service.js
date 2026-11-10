/*
  Sends one-time verification codes to applicants.

  Channels are chosen with OTP_CHANNELS (comma separated, default "email"):
    email     uses the existing SMTP settings.
    whatsapp  uses the WhatsApp Business Platform (Cloud API). It needs a Meta business account,
              a registered sender number and an approved AUTHENTICATION template with a copy-code
              button. Set:
                WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
                WHATSAPP_OTP_TEMPLATE (template name), WHATSAPP_OTP_TEMPLATE_LANGUAGE (default "en"),
                WHATSAPP_API_VERSION (default "v21.0").
  A code counts as sent when at least one channel delivers it.
*/
const { sendEmail } = require("./email.service");

function getEnabledChannels() {
  return String(process.env.OTP_CHANNELS || "email")
    .split(",")
    .map((channel) => channel.trim().toLowerCase())
    .filter((channel) => ["email", "whatsapp"].includes(channel));
}

function isWhatsAppConfigured() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_OTP_TEMPLATE
  );
}

function buildEmail({ code, minutes, purposeText }) {
  const text = [
    "Hello,",
    "",
    `Your Digital Futures verification code is: ${code}`,
    "",
    `Enter this code to ${purposeText}. It expires in ${minutes} minutes and can be used once.`,
    "",
    "If you did not ask for this code, you can ignore this email. Nobody from the programme will ever ask you to share it.",
    "",
    "Digital Futures programme team",
  ].join("\n");

  const html = `
    <p>Hello,</p>
    <p>Your Digital Futures verification code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p>
    <p>Enter this code to ${purposeText}. It expires in ${minutes} minutes and can be used once.</p>
    <p>If you did not ask for this code, you can ignore this email. Nobody from the programme will ever ask you to share it.</p>
    <p>Digital Futures programme team</p>
  `;

  // The subject is written to the server log, so it never carries the code.
  return { subject: "Your Digital Futures verification code", text, html };
}

async function sendWhatsAppCode({ phone, code }) {
  const to = String(phone || "").replace(/\D/g, "");
  if (!to) return { sent: false, reason: "No phone number." };
  if (!isWhatsAppConfigured()) return { sent: false, reason: "WhatsApp is not configured." };

  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: process.env.WHATSAPP_OTP_TEMPLATE,
      language: { code: process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || "en" },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { sent: false, reason: `WhatsApp API returned ${response.status}: ${detail.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error.message };
  }
}

// Returns { sent, channels: [{ channel, sent, reason? }] }. Never includes the code.
async function deliverVerificationCode({ email, phone, code, minutes, purposeText }) {
  const results = [];

  for (const channel of getEnabledChannels()) {
    if (channel === "email" && email) {
      const message = buildEmail({ code, minutes, purposeText });
      try {
        const result = await sendEmail({ to: email, ...message });
        results.push({ channel: "EMAIL", sent: Boolean(result.sent), reason: result.reason });
      } catch (error) {
        results.push({ channel: "EMAIL", sent: false, reason: error.code || error.message });
      }
    }
    if (channel === "whatsapp" && phone) {
      const result = await sendWhatsAppCode({ phone, code });
      results.push({ channel: "WHATSAPP", ...result });
    }
  }

  return { sent: results.some((result) => result.sent), channels: results };
}

module.exports = { deliverVerificationCode, getEnabledChannels, isWhatsAppConfigured };
