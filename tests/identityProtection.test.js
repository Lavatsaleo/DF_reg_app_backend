const test = require('node:test');
const assert = require('node:assert/strict');
const { canSeeIdentity, isIdentifyingQuestionCode, redactNarrative } = require('../src/utils/identityProtection');

const countryAdmin = { role: 'COUNTRY_ADMIN', country: 'Kenya' };
const superAdmin = { role: 'ADMIN' };

test('country admins see names only after committee selection', () => {
  for (const status of ['SUBMITTED', 'PENDING_REVIEW', 'ELIGIBLE_PENDING_SKILLS_TEST', 'SKILLS_TEST_COMPLETED_PENDING_REVIEW', 'UNDER_REVIEW', 'INELIGIBLE', 'REJECTED_BY_REVIEW_COMMITTEE']) {
    assert.equal(canSeeIdentity(countryAdmin, { status }), false, status);
  }
  for (const status of ['APPROVED_FOR_ENROLLMENT', 'PARTICIPANT_REGISTRATION_PENDING', 'PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION', 'ENROLLED_IN_DHIS2_PROGRAM']) {
    assert.equal(canSeeIdentity(countryAdmin, { status }), true, status);
  }
});

test('super admins always see names', () => {
  assert.equal(canSeeIdentity(superAdmin, { status: 'PENDING_REVIEW' }), true);
});

test('identifying questions are recognised', () => {
  for (const code of ['FIRST_NAME', 'LAST_NAME', 'EMAIL', 'CONTACT_NUMBER', 'NATIONAL_ID_NUMBER', 'DATE_OF_BIRTH', 'NEXT_OF_KIN_NAME', 'CONSENT_SIGNATURE_DATA', 'PR_ANY_FIELD', 'TOWN']) {
    assert.equal(isIdentifyingQuestionCode(code), true, code);
  }
  for (const code of ['EDUCATION_LEVEL', 'DISABILITY_TYPE', 'MOTIVATION', 'COUNTRY', 'SEX']) {
    assert.equal(isIdentifyingQuestionCode(code), false, code);
  }
});

test('free text loses the person\'s name, email and phone numbers', () => {
  const text = redactNarrative('I am Jane Wanjiru, email jane@example.org or call +254 712 345 678.', { firstName: 'Jane', lastName: 'Wanjiru' });
  assert.doesNotMatch(text, /Jane|Wanjiru|jane@example\.org|712/);
});
