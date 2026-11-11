/*
 * Read-only API keys for analysts (for example R / RStudio).
 * The key is shown once when created; only its SHA-256 hash is stored.
 */
const crypto = require("crypto");
const prisma = require("../config/prisma");
const { hashToken } = require("../utils/tokenUtils");

const KEY_PREFIX = "dfk_";
const ALLOWED_EXPIRY_DAYS = [30, 90, 180, 365];
const DEFAULT_EXPIRY_DAYS = 90;
// Writing "last used" on every request would add a database write per page; once a minute is enough.
const LAST_USED_WRITE_INTERVAL_MS = 60 * 1000;

function generateApiKey() {
  return `${KEY_PREFIX}${crypto.randomBytes(30).toString("base64url")}`;
}

// What the admin screen shows so people can tell keys apart without seeing the secret.
function getDisplayPrefix(rawKey) {
  return `${rawKey.slice(0, KEY_PREFIX.length + 6)}…`;
}

function getExpiryDays(value) {
  const days = Number(value);
  return ALLOWED_EXPIRY_DAYS.includes(days) ? days : null;
}

async function createApiKey({ name, country, includePersonalData, expiresInDays, createdBy }) {
  const rawKey = generateApiKey();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const key = await prisma.apiAccessKey.create({
    data: {
      name,
      keyPrefix: getDisplayPrefix(rawKey),
      keyHash: hashToken(rawKey),
      country: country || null,
      includePersonalData: Boolean(includePersonalData),
      createdByUserId: createdBy?.id || null,
      createdByName: createdBy?.fullName || null,
      expiresAt,
    },
  });

  return { key, rawKey };
}

// Returns the active key record for a raw key, or null when it is unknown, revoked or expired.
async function findActiveApiKey(rawKey, requestIp) {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX) || rawKey.length > 200) return null;

  const key = await prisma.apiAccessKey.findUnique({ where: { keyHash: hashToken(rawKey) } });
  if (!key || key.revokedAt || key.expiresAt <= new Date()) return null;

  const lastUsed = key.lastUsedAt ? key.lastUsedAt.getTime() : 0;
  if (Date.now() - lastUsed > LAST_USED_WRITE_INTERVAL_MS) {
    await prisma.apiAccessKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date(), lastUsedIp: requestIp || null } })
      .catch((error) => console.warn("Could not record API key use:", error.message));
  }

  return key;
}

// Safe view of a key for the admin screen: never includes the hash.
function toPublicKey(key) {
  const now = new Date();
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    country: key.country,
    includePersonalData: key.includePersonalData,
    createdByName: key.createdByName,
    createdAt: key.createdAt,
    expiresAt: key.expiresAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    revokedByName: key.revokedByName,
    status: key.revokedAt ? "REVOKED" : key.expiresAt <= now ? "EXPIRED" : "ACTIVE",
  };
}

module.exports = {
  KEY_PREFIX,
  ALLOWED_EXPIRY_DAYS,
  DEFAULT_EXPIRY_DAYS,
  getExpiryDays,
  createApiKey,
  findActiveApiKey,
  toPublicKey,
};
