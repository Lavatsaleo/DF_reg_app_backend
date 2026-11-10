const crypto = require("crypto");

const SCRYPT_KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 12;
// Hashing cost grows with input length; a cap stops very long passwords being used to tie up the server.
const MAX_PASSWORD_LENGTH = 128;

// Common words that stay easy to guess even with numbers or symbols added ("Password123!").
const COMMON_WORDS = [
  "password", "passw0rd", "qwerty", "welcome", "letmein", "admin", "administrator", "changeme",
  "iloveyou", "sightsavers", "digitalfutures", "committee", "kenya", "nigeria", "ghana", "zambia",
];

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
// The same rules are listed to staff in the frontend PasswordFields component; keep them in step.
function getPasswordProblem(password, { email = "", fullName = "" } = {}) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Use a password with no more than ${MAX_PASSWORD_LENGTH} characters.`;
  }

  const lower = value.toLowerCase();
  const lettersOnly = lower.replace(/[^a-z]/g, "");
  if (
    COMMON_PASSWORDS.has(lower)
    || /^(.)\1+$/.test(value)
    || /^(0123456789|1234567890|abcdefghij)/.test(lower)
    || COMMON_WORDS.includes(lettersOnly)
  ) {
    return "This password is too easy to guess. Choose a less common password.";
  }

  const emailName = String(email).split("@")[0].toLowerCase();
  const nameParts = String(fullName).toLowerCase().split(/\s+/).filter((part) => part.length >= 4);
  if ((emailName.length >= 4 && lower.includes(emailName)) || nameParts.some((part) => lower.includes(part))) {
    return "The password must not contain the account holder's name or email address.";
  }

  const missing = [];
  if (!/[A-Z]/.test(value)) missing.push("an uppercase letter");
  if (!/[a-z]/.test(value)) missing.push("a lowercase letter");
  if (!/[0-9]/.test(value)) missing.push("a number");
  if (!/[^A-Za-z0-9]/.test(value)) missing.push("a symbol such as ! ? # or -");
  if (missing.length) {
    return `Add ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")} to the password.`;
  }

  return "";
}

// For forms that collect the password twice.
function getNewPasswordProblem(password, confirmPassword, person = {}) {
  const problem = getPasswordProblem(password, person);
  if (problem) return problem;
  if (confirmPassword !== undefined && String(confirmPassword) !== String(password)) {
    return "The two passwords do not match. Type the same password in both boxes.";
  }
  return "";
}

module.exports = {
  hashPassword,
  verifyPassword,
  verifyPasswordAgainstNothing,
  getPasswordProblem,
  getNewPasswordProblem,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};
