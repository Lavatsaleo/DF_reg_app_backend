const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateEligibility } = require('../src/controllers/registration.controller');
const { getApplicationQuestionsForPathway } = require('../src/data/applicationFormQuestions');

// Digital Entrepreneurship form V4 (Form DF-03, received 26 November 2026).
const questions = getApplicationQuestionsForPathway('DIGITAL_ENTREPRENEURSHIP');
const byCode = (code) => questions.find((question) => question.questionCode === code);

function eligible(overrides = {}) {
  const answers = {
    COUNTRY: 'Ghana',
    DATE_OF_BIRTH: '1998-01-15',
    HAS_DISABILITY: 'Yes',
    EDUCATION_LEVEL: "Bachelor's degree",
    TRAINING_AVAILABILITY: 'Yes',
    BUSINESS_STAGE: 'I have a business idea, but I have not started the business yet.',
    BUSINESS_ROLE: 'I am starting or running this business by myself.',
    DESIRED_DIGITAL_TOOL_USE: ['Sell products or services online.'],
    ...overrides,
  };
  const responses = Object.entries(answers).map(([questionCode, answer]) => ({ questionCode, answer }));
  return calculateEligibility(responses, new Date('2026-11-26T09:00:00Z'), 'DIGITAL_ENTREPRENEURSHIP');
}

test('sections follow the V4 order, with motivation before device and internet access', () => {
  const sections = [...new Set(questions.filter((q) => !q.hiddenFromApplicant).map((q) => q.section))];
  assert.deepEqual(sections, [
    'Section 1: Eligibility Criteria',
    'Section 2: Personal & contact details',
    'Section 3: Prior Engagement with Sightsavers',
    'Section 4: Motivation & Training Readiness',
    'Section 5: Access to device, internet and electricity',
  ]);
  assert.ok(byCode('COUNTRY').questionNumber < byCode('FIRST_NAME').questionNumber, 'country is asked before names');
  for (const old of ['DIGITAL_ENTERPRISE_CHARACTERISTICS', 'DIGITAL_ENTERPRISE_TYPE', 'DIGITAL_NATIVE_CATEGORY']) {
    assert.equal(byCode(old), undefined, old);
  }
  assert.equal(byCode('BUSINESS_DESCRIPTION').metadata.maxWords, 200);
  assert.equal(byCode('MOTIVATION').metadata.maxWords, 200);
});

test('an applicant with an idea who owns the business passes', () => {
  assert.equal(eligible().screeningStatus, 'ELIGIBLE');
});

test('no business or business idea ends the application', () => {
  const result = eligible({ BUSINESS_STAGE: 'I do not have a business or a business idea yet.' });
  assert.equal(result.screeningStatus, 'NOT_ELIGIBLE');
  assert.ok(result.reasonCodes.includes('ENTREPRENEURSHIP_BUSINESS_IDEA_REQUIRED'));
});

test('employees, people applying for someone else, and "None of these" are not eligible', () => {
  for (const role of byCode('BUSINESS_ROLE').metadata.ineligibleAnswers) {
    const result = eligible({ BUSINESS_ROLE: role });
    assert.equal(result.screeningStatus, 'NOT_ELIGIBLE', role);
    assert.ok(result.reasonCodes.includes('ENTREPRENEURSHIP_OWNERSHIP_REQUIRED'));
  }
  assert.equal(eligible({ BUSINESS_ROLE: 'I am starting or running this business with one or more other people.' }).screeningStatus, 'ELIGIBLE');
});

test('not wanting to use digital tools ends the application', () => {
  const result = eligible({ DESIRED_DIGITAL_TOOL_USE: ['I do not want to use digital tools in my business.'] });
  assert.equal(result.screeningStatus, 'NOT_ELIGIBLE');
  assert.ok(result.reasonCodes.includes('ENTREPRENEURSHIP_DIGITAL_TOOLS_REQUIRED'));
  assert.match(result.applicantMessage, /digital tools/);
});

test('skip logic: co-owner count only for shared businesses, current tool use only once started', () => {
  assert.equal(byCode('BUSINESS_OWNER_COUNT').showIf.value, 'I am starting or running this business with one or more other people.');
  const startedStages = byCode('CURRENT_DIGITAL_TOOL_USE').showIf.value;
  assert.equal(startedStages.length, 3);
  assert.ok(!startedStages.includes('I have a business idea, but I have not started the business yet.'));
});
