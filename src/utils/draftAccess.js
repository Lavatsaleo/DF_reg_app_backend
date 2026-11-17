/*
 * Who may change a saved application draft.
 *
 * When a draft is first saved, the device filling it in gets a private random token; only a hash
 * is stored. Every later save must present that token. Another device (or the same person on a
 * new visit) gets a fresh token only after proving they own the email address, by entering the
 * code sent to it on the Check status page. The fresh token replaces the old one, so the device
 * that was used before can no longer change the draft.
 */
const crypto = require("crypto");

function createDraftToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashDraftToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function draftTokenMatches(draft, token) {
  if (!draft?.editTokenHash || !token || typeof token !== "string" || token.length > 200) return false;
  const expected = Buffer.from(draft.editTokenHash, "hex");
  const actual = Buffer.from(hashDraftToken(token), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

module.exports = { createDraftToken, hashDraftToken, draftTokenMatches };
