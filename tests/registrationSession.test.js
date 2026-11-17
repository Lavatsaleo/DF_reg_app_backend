const test = require("node:test");
const assert = require("node:assert/strict");
const { newSession, hasValidSession, maskEmail } = require("../src/utils/registrationSession");

const request = (token) => ({ headers: token ? { "x-registration-session": token } : {} });

test("the registration form opens only with the session started by the emailed code", () => {
  const session = newSession();
  const invitation = { ...session.data };
  assert.equal(hasValidSession(invitation, request(session.token)), true);
  assert.equal(hasValidSession(invitation, request(newSession().token)), false);
  assert.equal(hasValidSession(invitation, request("")), false);
});

test("a new code replaces the session, so the earlier browser loses access", () => {
  const first = newSession();
  const second = newSession();
  const invitation = { ...second.data };
  assert.equal(hasValidSession(invitation, request(first.token)), false);
  assert.equal(hasValidSession(invitation, request(second.token)), true);
});

test("the session ends after the idle time", () => {
  const session = newSession(new Date(Date.now() - 3 * 60 * 60 * 1000));
  assert.equal(hasValidSession({ ...session.data }, request(session.token)), false);
});

test("an invitation with no session (link only) never opens", () => {
  assert.equal(hasValidSession({ accessSessionHash: null, accessSessionExpiresAt: null }, request(newSession().token)), false);
});

test("email addresses are masked on the code screen", () => {
  assert.equal(maskEmail("amina.otieno@example.org"), "am**********@example.org");
  assert.equal(maskEmail("ab@example.org"), "a***@example.org");
  assert.equal(maskEmail(""), null);
});
