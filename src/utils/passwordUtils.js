const crypto = require("crypto");

const SCRYPT_KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 10;
// Hashing cost grows with input length; a cap stops very long passwords being used to tie up the server.
const MAX_PASSWORD_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "123456789", "1234567890", "12345678910",
  "qwertyuiop", "qwerty123", "iloveyou", "welcome1", "welcome123", "letmein123", "admin12345",
  "administrator", "changeme", "changeme123", "sightsavers", "sightsavers1", "digitalfutures",
]);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash || "").split(":");
  if (!salt || !key) return false;
  if (String(password).length > MAX_PASSWORD_LENGTH) return false;

  const candidate = crypto.scryptSync(String(password), salt, SCRYPT_KEY_LENGTH);
  const stored = Buffer.from(key, "hex");

  if (stored.length !== candidate.length) return false;
  return crypto.timingSafeEqual(stored, candidate);
}

// Unknown accounts take as long as known ones, so response time doesn't reveal which emails exist.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString("hex"));
function verifyPasswordAgainstNothing(password) {
  verifyPassword(password, DUMMY_HASH);
  return false;
}

// Returns a message explaining why a new password is not acceptable, or "" when it is.
function getPasswordProblem(password, { email = "", fullName = "" } = {}) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Use a password with no more than ${MAX_PASSWORD_LENGTH} characters.`;
  }

  const lower = value.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(value) || /^(0123456789|1234567890|abcdefghij)/.test(lower)) {
    return "This password is too easy to guess. Choose a less common password.";
  }

  const emailName = String(email).split("@")[0].toLowerCase();
  const nameParts = String(fullName).toLowerCase().split(/\s+/).filter((part) => part.length >= 4);
  if ((emailName.length >= 4 && lower.includes(emailName)) || nameParts.some((part) => lower.includes(part))) {
    return "The password must not contain your name or email address.";
  }

  return "";
}

module.exports = {
  hashPassword,
  verifyPassword,
  verifyPasswordAgainstNothing,
  getPasswordProblem,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};
