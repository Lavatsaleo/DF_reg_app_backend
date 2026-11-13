const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateEligibility } = require('../src/controllers/registration.controller');

// Participants must be no older than 35 when they finish, so ages are checked at application:
// 18–33 for both academies and 18–45 for Digital Entrepreneurship, in every country.
const APPLIED_ON = new Date('2026-11-11T09:00:00Z');

function birthDateForAge(age) {
  // A birthday well before the application date, so the age is exactly `age`.
  return `${APPLIED_ON.getUTCFullYear() - age}-01-15`;
}

function ageReasons(pathway, country, age) {
  const responses = [
    { questionCode: 'COUNTRY', answer: country },
    { questionCode: 'DATE_OF_BIRTH', answer: birthDateForAge(age) },
  ];
  const result = calculateEligibility(responses, APPLIED_ON, pathway);
  return result.reasonCodes.filter((code) => /AGE/.test(code));
}

for (const pathway of ['PHYSICAL_ACADEMY', 'VIRTUAL_ACADEMY']) {
  for (const country of ['Kenya', 'Ghana', 'Nigeria', 'Zambia']) {
    test(`${pathway} in ${country}: 18 and 33 pass, 17 and 34 do not`, () => {
      assert.deepEqual(ageReasons(pathway, country, 18), []);
      assert.deepEqual(ageReasons(pathway, country, 33), []);
      assert.deepEqual(ageReasons(pathway, country, 17), ['ACADEMY_AGE_OUTSIDE_RANGE']);
      assert.deepEqual(ageReasons(pathway, country, 34), ['ACADEMY_AGE_OUTSIDE_RANGE']);
    });
  }
}

for (const country of ['Kenya', 'Ghana', 'Nigeria', 'Zambia']) {
  test(`DIGITAL_ENTREPRENEURSHIP in ${country}: 18 and 45 pass, 17 and 46 are flagged`, () => {
    assert.deepEqual(ageReasons('DIGITAL_ENTREPRENEURSHIP', country, 18), []);
    assert.deepEqual(ageReasons('DIGITAL_ENTREPRENEURSHIP', country, 45), []);
    assert.deepEqual(ageReasons('DIGITAL_ENTREPRENEURSHIP', country, 17), ['AGE_OUTSIDE_REVIEW_RANGE']);
    assert.deepEqual(ageReasons('DIGITAL_ENTREPRENEURSHIP', country, 46), ['AGE_OUTSIDE_REVIEW_RANGE']);
  });
}

test('Ghana Digital Entrepreneurship accepts Junior High School; other countries keep their minimum', () => {
  const run = (country, educationLevel) => {
    const responses = [
      { questionCode: 'COUNTRY', answer: country },
      { questionCode: 'DATE_OF_BIRTH', answer: birthDateForAge(30) },
      { questionCode: 'EDUCATION_LEVEL', answer: educationLevel },
      { questionCode: 'TRAINING_AVAILABILITY', answer: 'Yes' },
    ];
    return calculateEligibility(responses, APPLIED_ON, 'DIGITAL_ENTREPRENEURSHIP').reasonCodes.filter((code) => /EDUCATION/.test(code));
  };
  assert.deepEqual(run('Ghana', 'Junior Secondary'), []);
  assert.deepEqual(run('Ghana', 'Primary'), ['EDUCATION_BELOW_MINIMUM']);
  assert.deepEqual(run('Nigeria', 'Junior Secondary'), ['EDUCATION_BELOW_MINIMUM']);
});
