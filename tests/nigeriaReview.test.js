// Nigeria portal review (11 November 2026).
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateEligibility } = require('../src/controllers/registration.controller');
const { getApplicationQuestionsForPathway } = require('../src/data/applicationFormQuestions');
const { getQuestionsForCountry } = require('../src/data/participantRegistrationForm');

const PATHWAYS = ['PHYSICAL_ACADEMY', 'VIRTUAL_ACADEMY', 'DIGITAL_ENTREPRENEURSHIP'];
const find = (pathway, code) => getApplicationQuestionsForPathway(pathway).find((q) => q.questionCode === code);

test('academies: not available for the whole course ends the application', () => {
  for (const pathway of ['PHYSICAL_ACADEMY', 'VIRTUAL_ACADEMY']) {
    const responses = [
      { questionCode: 'COUNTRY', answer: 'Nigeria' },
      { questionCode: 'DATE_OF_BIRTH', answer: '2000-01-15' },
      { questionCode: 'TRAINING_AVAILABILITY', answer: 'No' },
    ];
    const result = calculateEligibility(responses, new Date('2026-11-13'), pathway);
    assert.ok(result.reasonCodes.includes('ACADEMY_AVAILABILITY_REQUIRED'), pathway);
    assert.equal(result.screeningStatus, 'NOT_ELIGIBLE', pathway);
    const yes = calculateEligibility([...responses.slice(0, 2), { questionCode: 'TRAINING_AVAILABILITY', answer: 'Yes' }], new Date('2026-11-13'), pathway);
    assert.ok(!yes.reasonCodes.includes('ACADEMY_AVAILABILITY_REQUIRED'), pathway);
  }
});

test('the NHIS card is no longer an ID type', () => {
  for (const pathway of PATHWAYS) {
    const idType = find(pathway, 'NATIONAL_ID_TYPE');
    assert.ok(!idType.options.includes('NHIS Card'), pathway);
    assert.ok(!idType.metadata.optionsByCountry.Nigeria.includes('NHIS Card'), pathway);
  }
});

test('devices are multiple choice, and Digital Entrepreneurship now asks about access and how people heard', () => {
  for (const pathway of ['VIRTUAL_ACADEMY', 'DIGITAL_ENTREPRENEURSHIP']) {
    const device = find(pathway, 'DEVICE_ACCESS');
    assert.equal(device.responseType, 'MULTI_SELECT', pathway);
    assert.deepEqual(device.metadata.exclusiveOptions, ['None of the above']);
    assert.ok(find(pathway, 'POWER_SUPPLY_RELIABILITY'), pathway);
  }
  for (const pathway of PATHWAYS) {
    const opd = find(pathway, 'HEARD_ABOUT_PROJECT_OPD');
    assert.deepEqual(opd.options, ['Inclusive Friends Association (IFA)', 'FAECARE', 'Others'], pathway);
    // Shown only when an OPD was chosen and the applicant is in Nigeria.
    assert.ok(opd.showIf.all.some((c) => c.questionCode === 'COUNTRY' && c.value === 'Nigeria'));
  }
});

test('registration form: weekly hours, monthly income, Nigeria body named', () => {
  const questions = getQuestionsForCountry('Nigeria');
  const text = (code) => questions.find((q) => q.questionCode === code).questionText;
  assert.match(text('M3_8'), /per week\?$/);
  assert.match(text('M3_9'), /^Last week/);
  assert.match(text('M3_10'), /each month/);
  assert.doesNotMatch(JSON.stringify(questions), /Database formula|M3\.7"?\s*$/);
  assert.match(text('M1_1'), /National Commission for Persons with Disabilities \(NCPWD\)/);
});

test('registration numbers have sensible limits (UX review)', () => {
  const questions = getQuestionsForCountry('Kenya');
  const meta = (code) => questions.find((q) => q.questionCode === code).metadata;
  assert.deepEqual(meta('M3_3'), { min: 1, max: 50, integer: true });
  assert.equal(meta('M3_8').max, 168);
  assert.equal(meta('M3_9').max, 168);
  assert.doesNotMatch(JSON.stringify(questions), /show step-ladder picture/);
});
