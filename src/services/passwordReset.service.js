const prisma = require("../config/prisma");
const { generateSecureToken, hashToken } = require("../utils/tokenUtils");
const { escapeHtml } = require("../utils/html");
const { sendEmail } = require("./email.service");

function getFrontendBaseUrl() {
  return (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
}

function getPasswordResetExpiryMinutes() {
  const minutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 60);
  return Math.max(15, Number.isFinite(minutes) ? minutes : 60);
}

function describeMinutes(minutes) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${minutes} minutes`;
}

// Creates a single-use reset link for a local staff account and emails it. Any earlier unused links
// for the same account stop working. Only a hash of the token is stored.
// Returns { sent, resetUrl }; callers must never show resetUrl outside local development.
async function sendPasswordResetLink(user, { requestedIp = null, requestedByAdmin = false } = {}) {
  const token = generateSecureToken();
  const minutes = getPasswordResetExpiryMinutes();
  const resetUrl = `${getFrontendBaseUrl()}/reset-password/${encodeURIComponent(token)}`;

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { staffUserId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        staffUserId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + minutes * 60 * 1000),
        requestedIp,
      },
    }),
  ]);

  const expiry = describeMinutes(minutes);
  const reason = requestedByAdmin
    ? "A Digital Futures administrator asked for this link so you can set your password."
    : "Someone asked to reset the password for your Digital Futures staff account.";
  const ignore = requestedByAdmin
    ? "If you were not expecting this, contact your country programme lead."
    : "If you did not ask for this, you can ignore this email. Your password will not change.";

  const result = await sendEmail({
    to: user.email,
    subject: "Set your Digital Futures staff password",
    text: [
      `Hello ${user.fullName},`,
      "",
      reason,
      "",
      "Open this link to choose a new password:",
      resetUrl,
      "",
      `The link works once and expires in ${expiry}.`,
      ignore,
    ].join("\n"),
    html: [
      `<p>Hello ${escapeHtml(user.fullName)},</p>`,
      `<p>${escapeHtml(reason)}</p>`,
      `<p><a href="${escapeHtml(resetUrl)}">Choose a new password</a></p>`,
      `<p>The link works once and expires in ${escapeHtml(expiry)}.</p>`,
      `<p>${escapeHtml(ignore)}</p>`,
    ].join(""),
  });

  return { sent: result?.sent === true, resetUrl };
}

module.exports = { sendPasswordResetLink };
