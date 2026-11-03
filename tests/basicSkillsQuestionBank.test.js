const test = require('node:test');
const assert = require('node:assert/strict');
const { basicSkillsQuestionBankSeed } = require('../src/data/basicSkillsQuestionBankSeed');
const { BASIC_SKILLS_TEST_BLUEPRINT, BASIC_SKILLS_TEST_PASS_MARK, BASIC_SKILLS_TEST_PASSING_PERCENTAGE, getAttemptPassMark } = require('../src/data/basicSkillsTestQuestions');
const { pickQuestionsForBlueprint, hasCurrentQuestionSet, toAttemptQuestionCreateData, calculateAttemptResult } = require('../src/services/basicSkillsQuestionBank.service');

const pool = basicSkillsQuestionBankSeed.map((row) => ({ ...row, id: row.questionCode }));
const optionText = (question, key) => question[`option${key}`];

test('the seed is the 175-question DigComp bank with a valid answer key for every question', () => {
  assert.equal(pool.length, 175);
  assert.equal(new Set(pool.map((q) => q.questionCode)).size, 175);
  for (const q of pool) {
    assert.ok(['A', 'B', 'C', 'D'].includes(q.correctOption), q.questionCode);
    assert.equal(optionText(q, q.correctOption), q.correctAnswer, q.questionCode);
    assert.ok(BASIC_SKILLS_TEST_BLUEPRINT.some((item) => item.domains.includes(q.domain)), q.domain);
  }
});

test('every attempt draws 30 unique questions with the fixed domain quotas', () => {
  for (let run = 0; run < 200; run += 1) {
    const picked = pickQuestionsForBlueprint(pool);
    assert.equal(picked.length, 30);
    assert.equal(new Set(picked.map((q) => q.id)).size, 30);
    for (const item of BASIC_SKILLS_TEST_BLUEPRINT) {
      assert.equal(picked.filter((q) => item.domains.includes(q.domain)).length, item.count, item.category);
    }
  }
});

test('a domain short of its quota stops the draw instead of borrowing from other domains', () => {
  const short = pool.filter((q) => q.domain !== 'Information & Search' || q.questionCode.endsWith('1'));
  assert.throws(() => pickQuestionsForBlueprint(short), /Information and search/);
});

test('shuffled options keep the correct answer and scoring uses the 22/30 pass mark', () => {
  const attemptQuestions = pickQuestionsForBlueprint(pool).map((q, i) => ({ ...toAttemptQuestionCreateData(q, i + 1), questionId: q.id }));
  for (const q of attemptQuestions) {
    assert.equal(q.options.find((option) => option.value === q.correctOption).label, q.correctAnswer);
  }
  const answersWithCorrect = (count) => attemptQuestions.map((q, i) => ({
    questionCode: q.questionCode,
    answer: i < count ? q.correctOption : ['A', 'B', 'C', 'D'].find((key) => key !== q.correctOption),
  }));
  assert.equal(calculateAttemptResult(attemptQuestions, answersWithCorrect(30)).score, 30);
  const atMark = calculateAttemptResult(attemptQuestions, answersWithCorrect(22));
  const belowMark = calculateAttemptResult(attemptQuestions, answersWithCorrect(21));
  assert.equal(atMark.score >= BASIC_SKILLS_TEST_PASS_MARK, true);
  assert.equal(belowMark.score >= BASIC_SKILLS_TEST_PASS_MARK, false);
  assert.equal(getAttemptPassMark({ maxScore: 30, passingPercentage: BASIC_SKILLS_TEST_PASSING_PERCENTAGE }), 22);
  assert.equal(getAttemptPassMark({ maxScore: 10, passingPercentage: 60 }), 6);
});

test('an unfinished attempt holding old-bank questions is redrawn', () => {
  const current = pickQuestionsForBlueprint(pool).map((q) => ({ questionId: q.id }));
  assert.equal(hasCurrentQuestionSet(current, pool), true);
  assert.equal(hasCurrentQuestionSet(current.slice(0, 10), pool), false);
  assert.equal(hasCurrentQuestionSet([...current.slice(1), { questionId: 'old-bank-question' }], pool), false);
});
