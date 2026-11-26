const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNationalId, buildActiveIdentityKeys, isApplicationEnded } = require('../src/utils/applicationIdentity');
const { validateNotSelectedReason, buildOutcomeEmail } = require('../src/services/applicationOutcome.service');

test('national IDs ignore spacing and punctuation, and are per country', () => {
  assert.equal(normalizeNationalId('Kenya', ' 3245 6781 '), 'KENYA:32456781');
  assert.equal(normalizeNationalId('Ghana', 'gha-723456789-1'), 'GHANA:GHA7234567891');
  assert.equal(normalizeNationalId('Zambia', '284519/61/1'), 'ZAMBIA:284519611');
  assert.notEqual(normalizeNationalId('Kenya', '32456781'), normalizeNationalId('Zambia', '32456781'));
  assert.equal(normalizeNationalId('Kenya', ''), null);
});

test('placeholder IDs are never used to match two applicants as one person', () => {
  for (const placeholder of ['NONE', 'N/A', 'NIL', '0000', '12345', '11111111', '00000000', '12345678', '0123456789', '987654', 'GHA-000000000-0']) {
    assert.equal(normalizeNationalId('Kenya', placeholder), null, placeholder);
  }
  // Real numbers that merely contain a run of digits still match.
  assert.equal(normalizeNationalId('Kenya', 'A2345678'), 'KENYA:A2345678');
  assert.equal(normalizeNationalId('Nigeria', '70391845226'), 'NIGERIA:70391845226');
});

test('a live application holds the identity keys; an ended one does not', () => {
  const identity = { normalizedEmail: 'a@b.org', normalizedContactNumber: '254700000001', normalizedNationalId: 'KENYA:1' };
  assert.deepEqual(buildActiveIdentityKeys(identity, 'PENDING_REVIEW'), { activeEmailKey: 'a@b.org', activePhoneKey: '254700000001', activeNationalIdKey: 'KENYA:1' });
  assert.deepEqual(buildActiveIdentityKeys(identity, 'INELIGIBLE'), { activeEmailKey: null, activePhoneKey: null, activeNationalIdKey: null });
  assert.equal(isApplicationEnded('REJECTED_BY_REVIEW_COMMITTEE'), true);
  assert.equal(isApplicationEnded('APPROVED_FOR_ENROLLMENT'), false);
});

test('"not selected" needs a reason, and "Other" needs a written one', () => {
  assert.ok(validateNotSelectedReason('', '').error);
  assert.ok(validateNotSelectedReason('OTHER', 'too short').error);
  assert.equal(validateNotSelectedReason('OTHER', 'Your portfolio links did not open.').reasonCode, 'OTHER');
  const ok = validateNotSelectedReason('SKILLS_TEST', 'Practise and apply again.');
  assert.match(ok.reasonText, /skills test result.*Practise and apply again\./);
});

test('outcome emails escape what applicants and reviewers typed', () => {
  const email = buildOutcomeEmail({ firstName: '<b>Amina</b>', pathway: 'VIRTUAL_ACADEMY', country: 'Kenya' }, { kind: 'NOT_SELECTED', reasons: 'Reason <script>x</script>' });
  assert.doesNotMatch(email.html, /<script>|<b>Amina/);
  assert.match(email.text, /Virtual Academy/);
});
