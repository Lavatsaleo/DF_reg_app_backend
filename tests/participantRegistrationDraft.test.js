const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeDraft } = require('../src/controllers/participantRegistration.controller');
const { getQuestionsForCountry, MODULES } = require('../src/data/participantRegistrationForm');
const { createParticipantRegistrationInvitation } = require('../src/services/participantRegistrationInvitation.service');

test('the disability body question names only the participant country body', () => {
  const kenya = getQuestionsForCountry('Kenya').find((question) => question.questionCode === 'M1_1');
  assert.equal(kenya.questionText, 'Are you a registered member of the National Council for Persons with Disabilities (NCPWD)?');
  assert.ok(!kenya.questionText.includes('Zambia'));
  assert.equal(kenya.textByCountry, undefined);

  const zambia = getQuestionsForCountry('Zambia').find((question) => question.questionCode === 'M1_1');
  assert.match(zambia.questionText, /Zambia Agency for Persons with Disabilities \(ZAPD\)/);

  // An unexpected country still gets the full question rather than nothing.
  const unknown = getQuestionsForCountry('Elsewhere').find((question) => question.questionCode === 'M1_1');
  assert.match(unknown.questionText, /Zambia: .*Kenya: .*Nigeria: .*Ghana:/);
});

test('saved drafts keep only known answers and consent fields, within limits', () => {
  const draft = sanitizeDraft({
    stage: 'form',
    step: 99,
    furthestStep: -4,
    answers: {
      M1_1: 'Yes',
      M3_3: 4,
      M3_5: ['Applied for jobs', { nested: true }],
      M1_5: 'not-a-file-answer',
      NOT_A_QUESTION: 'drop me',
      M2_1: { object: 'dropped' },
    },
    consent: {
      decision: 'Yes, I consent',
      signatureMethod: 'TYPED',
      signatureData: 'x'.repeat(60001),
      assistantSignatureData: 'M1 1 L2 2',
      isAdmin: true,
    },
  });

  assert.equal(draft.stage, 'form');
  assert.equal(draft.step, MODULES.length - 1);
  assert.equal(draft.furthestStep, 0);
  assert.deepEqual(draft.answers, { M1_1: 'Yes', M3_3: 4, M3_5: ['Applied for jobs', '[object Object]'] });
  assert.deepEqual(draft.consent, {
    decision: 'Yes, I consent',
    signatureMethod: 'TYPED',
    assistantSignatureData: 'M1 1 L2 2',
  });
});

test('an unknown stage falls back to the consent page', () => {
  assert.equal(sanitizeDraft({ stage: 'submitted' }).stage, 'consent');
  assert.equal(sanitizeDraft({ furthestStep: MODULES.length + 1 }).furthestStep, MODULES.length + 1);
});

test('a resent registration link keeps the progress saved on the previous link', async () => {
  const savedDraft = {
    draftData: { stage: 'form', step: 2, furthestStep: 3, answers: { M1_1: 'Yes' }, consent: {} },
    draftDocuments: { idDocument: { originalName: 'id.pdf' } },
    draftSavedAt: new Date('2026-11-04T10:00:00Z'),
  };
  let created;
  const tx = {
    participantRegistrationInvitation: {
      findFirst: async ({ where }) => {
        assert.deepEqual(where.status, { not: 'SUBMITTED' });
        return savedDraft;
      },
      updateMany: async () => ({ count: 1 }),
      create: async ({ data }) => {
        created = data;
        return { id: 'new-invite', ...data };
      },
    },
  };

  await createParticipantRegistrationInvitation(tx, {
    id: 'applicant-1',
    email: 'participant@example.org',
    pathway: 'PHYSICAL_ACADEMY',
  });

  assert.deepEqual(created.draftData, savedDraft.draftData);
  assert.deepEqual(created.draftDocuments, savedDraft.draftDocuments);
  assert.equal(created.draftSavedAt, savedDraft.draftSavedAt);
});
