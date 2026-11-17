/*
 * Access to a participant registration form.
 *
 * The emailed link identifies the invitation, but it is not enough on its own: it can be found
 * in a shared computer's browser history or in an inbox left open. The participant also enters a
 * code sent to their email. A correct code starts a session for that browser; the browser sends
 * it with every request in the X-Registration-Session header. Only a hash is stored.
 */
const crypto = require("crypto");

const SESSION_HEADER = "x-registration-session";

function idleMinutes() {
  const minutes = Number(process.env.REGISTRATION_SESSION_IDLE_MINUTES);
  return Number.isFinite(minutes) && minutes >= 5 ? minutes : 120;
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function newSession(now = new Date()) {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    data: {
      accessSessionHash: hashSessionToken(token),
      accessSessionExpiresAt: new Date(now.getTime() + idleMinutes() * 60 * 1000),
    },
  };
}

// The session's new end time after the participant does something (saving, uploading).
function extendedSession(now = new Date()) {
  return { accessSessionExpiresAt: new Date(now.getTime() + idleMinutes() * 60 * 1000) };
}

function hasValidSession(invitation, req, now = new Date()) {
  const token = req.get?.(SESSION_HEADER) || req.headers?.[SESSION_HEADER];
  if (!token || typeof token !== "string" || token.length > 200) return false;
  if (!invitation?.accessSessionHash || !invitation.accessSessionExpiresAt) return false;
  if (new Date(invitation.accessSessionExpiresAt) <= now) return false;
  const expected = Buffer.from(invitation.accessSessionHash, "hex");
  const actual = Buffer.from(hashSessionToken(token), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// "am***@example.org": enough for the participant to recognise their address, not enough to read it.
function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return null;
  const visible = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

module.exports = { SESSION_HEADER, newSession, extendedSession, hasValidSession, maskEmail, hashSessionToken };
