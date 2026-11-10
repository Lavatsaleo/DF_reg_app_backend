/*
  One-time verification codes for public applicant lookups (status check, resuming a saved draft).

  - 6 digits, valid for 10 minutes, usable once.
  - Only an HMAC of the code is stored, bound to its purpose and subject.
  - 5 wrong guesses lock the code; a new one must be requested.
  - A new code can be requested after 60 seconds, at most 5 per hour per application.
*/
const crypto = require("crypto");
const prisma = require("../config/prisma");
const { deliverVerificationCode } = require("./otpDelivery.service");

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;

function getSecret() {
  const secret = process.env.OTP_SECRET || process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("AUTH_TOKEN_SECRET (or OTP_SECRET) must be set to issue verification codes.");
  return secret;
}

function hashCode({ purpose, subjectType, subjectId, code }) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${purpose}|${subjectType}|${subjectId}|${code}`)
    .digest("hex");
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function normalizeSubmittedCode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

/*
  Creates and sends a new code. Returns { issued, reason } where reason is one of
  "cooldown", "hourly_limit", "delivery_failed". Callers reply to the public the same way
  whatever happens, so these outcomes are only logged.
*/
async function issueVerificationCode({ purpose, subjectType, subjectId, email, phone, purposeText }) {
  const now = Date.now();
  const recent = await prisma.verificationCode.findMany({
    where: { purpose, subjectType, subjectId, createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (recent[0] && now - new Date(recent[0].createdAt).getTime() < RESEND_COOLDOWN_MS) {
    return { issued: false, reason: "cooldown" };
  }
  if (recent.length >= MAX_CODES_PER_HOUR) {
    return { issued: false, reason: "hourly_limit" };
  }

  const code = generateCode();
  const expiresAt = new Date(now + CODE_TTL_MINUTES * 60 * 1000);

  // Only the newest code works.
  await prisma.verificationCode.updateMany({
    where: { purpose, subjectType, subjectId, consumedAt: null },
    data: { consumedAt: new Date(now) },
  });

  const record = await prisma.verificationCode.create({
    data: {
      purpose,
      subjectType,
      subjectId,
      codeHash: hashCode({ purpose, subjectType, subjectId, code }),
      expiresAt,
    },
  });

  const delivery = await deliverVerificationCode({
    email,
    phone,
    code,
    minutes: CODE_TTL_MINUTES,
    purposeText,
  });

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { channels: delivery.channels.filter((item) => item.sent).map((item) => item.channel).join(",") || "NONE" },
  });

  if (!delivery.sent) {
    console.warn("[verification-code] not delivered", {
      purpose,
      subjectType,
      channels: delivery.channels.map(({ channel, reason }) => ({ channel, reason })),
    });
    return { issued: false, reason: "delivery_failed" };
  }

  return { issued: true };
}

/*
  Checks a submitted code. Returns true once for the right, unexpired, unlocked code;
  the code is then used up.
*/
async function verifyCode({ purpose, subjectType, subjectId, code }) {
  const submitted = normalizeSubmittedCode(code);
  if (!submitted) return false;

  const record = await prisma.verificationCode.findFirst({
    where: { purpose, subjectType, subjectId, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.attempts >= MAX_ATTEMPTS) return false;

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode({ purpose, subjectType, subjectId, code: submitted }), "hex");
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  // Conditional update so two simultaneous requests can't both use the same code.
  const used = await prisma.verificationCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return used.count === 1;
}

module.exports = {
  issueVerificationCode,
  verifyCode,
  CODE_TTL_MINUTES,
  MAX_ATTEMPTS,
};
