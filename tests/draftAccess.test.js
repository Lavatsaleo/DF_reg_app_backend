const test = require("node:test");
const assert = require("node:assert/strict");
const { createDraftToken, hashDraftToken, draftTokenMatches } = require("../src/utils/draftAccess");

test("only the token issued for a draft can change it", () => {
  const token = createDraftToken();
  const draft = { editTokenHash: hashDraftToken(token) };
  assert.equal(draftTokenMatches(draft, token), true);
  assert.equal(draftTokenMatches(draft, createDraftToken()), false);
  assert.equal(draftTokenMatches(draft, ""), false);
  assert.equal(draftTokenMatches(draft, undefined), false);
});

test("a draft without a token (older draft, or closed) cannot be changed from a device", () => {
  assert.equal(draftTokenMatches({ editTokenHash: null }, createDraftToken()), false);
  assert.equal(draftTokenMatches(null, createDraftToken()), false);
});

test("tokens are long and random, and only their hash is stored", () => {
  const a = createDraftToken();
  const b = createDraftToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40);
  assert.notEqual(hashDraftToken(a), a);
  assert.match(hashDraftToken(a), /^[0-9a-f]{64}$/);
});
