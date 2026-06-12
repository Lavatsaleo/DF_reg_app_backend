const crypto = require("crypto");

const SCRYPT_KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash || "").split(":");
  if (!salt || !key) return false;

  const candidate = crypto.scryptSync(String(password), salt, SCRYPT_KEY_LENGTH);
  const stored = Buffer.from(key, "hex");

  if (stored.length !== candidate.length) return false;
  return crypto.timingSafeEqual(stored, candidate);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
