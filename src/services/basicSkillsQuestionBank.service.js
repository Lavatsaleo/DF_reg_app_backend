const crypto = require("crypto");
const prisma = require("../config/prisma");
const {
  BASIC_SKILLS_TEST_BLUEPRINT,
  BASIC_SKILLS_TEST_LENGTH,
  getBlueprintTotalQuestions,
} = require("../data/basicSkillsTestQuestions");

const OPTION_KEYS = ["A", "B", "C", "D"];

function secureShuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function normalizeDomain(value) {
  return String(value || "").trim();
}

function getBlueprintCategoryForDomain(domain) {
  const normalizedDomain = normalizeDomain(domain);
  const blueprintItem = BASIC_SKILLS_TEST_BLUEPRINT.find((item) =>
    item.domains.includes(normalizedDomain)
  );

  return blueprintItem?.category || normalizedDomain || "Basic IT skills";
}

function buildOptionList(question) {
  return OPTION_KEYS.map((optionKey) => ({
    value: optionKey,
    label: question[`option${optionKey}`],
  })).filter((option) => String(option.label || "").trim());
}

function toAttemptQuestionCreateData(question, questionNumber) {
  const options = secureShuffle(buildOptionList(question));

  return {
    questionId: question.id,
    questionCode: question.questionCode,
    questionNumber,
    domain: question.domain,
    category: getBlueprintCategoryForDomain(question.domain),
    difficulty: question.difficulty,
    questionText: question.questionText,
    options,
    correctOption: String(question.correctOption || "").trim().toUpperCase(),
    correctAnswer: question.correctAnswer,
    pointsPossible: Number(question.scoreWeight || 1),
  };
}

function toPublicQuestion(attemptQuestion) {
  return {
    questionCode: attemptQuestion.questionCode,
    questionNumber: attemptQuestion.questionNumber,
    category: attemptQuestion.category || attemptQuestion.domain,
    domain: attemptQuestion.domain,
    difficulty: attemptQuestion.difficulty,
    questionText: attemptQuestion.questionText,
    options: Array.isArray(attemptQuestion.options) ? attemptQuestion.options : [],
    points: Number(attemptQuestion.pointsPossible || 1),
  };
}

function pickQuestionsForBlueprint(pool) {
  const selected = [];
  const selectedIds = new Set();

  for (const blueprintItem of BASIC_SKILLS_TEST_BLUEPRINT) {
    const eligibleQuestions = pool.filter(
      (question) =>
        blueprintItem.domains.includes(question.domain) && !selectedIds.has(question.id)
    );

    const pickedQuestions = secureShuffle(eligibleQuestions).slice(0, blueprintItem.count);

    pickedQuestions.forEach((question) => {
      selected.push(question);
      selectedIds.add(question.id);
    });
  }

  const expectedTotal = Math.min(
    BASIC_SKILLS_TEST_LENGTH,
    getBlueprintTotalQuestions() || BASIC_SKILLS_TEST_LENGTH
  );

  if (selected.length < expectedTotal) {
    const remainingQuestions = secureShuffle(
      pool.filter((question) => !selectedIds.has(question.id))
    );

    for (const question of remainingQuestions) {
      selected.push(question);
      selectedIds.add(question.id);
      if (selected.length >= expectedTotal) break;
    }
  }

  if (selected.length < expectedTotal) {
    throw new Error(
      `The active Basic IT skills question bank has only ${selected.length} usable questions. At least ${expectedTotal} are required.`
    );
  }

  return secureShuffle(selected).slice(0, expectedTotal);
}

async function getActiveQuestionPool(tx = prisma) {
  return tx.basicSkillsTestQuestion.findMany({
    where: {
      active: true,
    },
    orderBy: [
      { domain: "asc" },
      { questionCode: "asc" },
    ],
  });
}

async function createSelectedQuestionsForAttempt(tx, attemptId) {
  const activePool = await getActiveQuestionPool(tx);

  if (!activePool.length) {
    throw new Error(
      "The Basic IT skills question bank is empty. Run npm run seed:basic-skills before issuing test invitations."
    );
  }

  const selectedQuestions = pickQuestionsForBlueprint(activePool);

  await tx.basicSkillsTestAttemptQuestion.createMany({
    data: selectedQuestions.map((question, index) => ({
      attemptId,
      ...toAttemptQuestionCreateData(question, index + 1),
    })),
  });

  return tx.basicSkillsTestAttemptQuestion.findMany({
    where: { attemptId },
    orderBy: { questionNumber: "asc" },
  });
}

async function getOrCreateInProgressAttempt({ applicantId, invitationId = null }) {
  return prisma.$transaction(async (tx) => {
    const submittedAttempt = await tx.basicSkillsTestAttempt.findFirst({
      where: {
        applicantId,
        status: "SUBMITTED",
      },
      orderBy: { submittedAt: "desc" },
      include: {
        answers: {
          orderBy: { questionCode: "asc" },
        },
        invitation: true,
        selectedQuestions: {
          orderBy: { questionNumber: "asc" },
        },
      },
    });

    if (submittedAttempt) {
      return {
        alreadySubmitted: true,
        attempt: submittedAttempt,
      };
    }

    let attempt = await tx.basicSkillsTestAttempt.findFirst({
      where: {
        applicantId,
        status: "IN_PROGRESS",
      },
      orderBy: { createdAt: "desc" },
      include: {
        invitation: true,
        selectedQuestions: {
          orderBy: { questionNumber: "asc" },
        },
      },
    });

    if (!attempt) {
      attempt = await tx.basicSkillsTestAttempt.create({
        data: {
          applicantId,
          invitationId,
          attemptNumber: 1,
          status: "IN_PROGRESS",
        },
        include: {
          invitation: true,
          selectedQuestions: {
            orderBy: { questionNumber: "asc" },
          },
        },
      });
    } else if (invitationId && !attempt.invitationId) {
      attempt = await tx.basicSkillsTestAttempt.update({
        where: { id: attempt.id },
        data: { invitationId },
        include: {
          invitation: true,
          selectedQuestions: {
            orderBy: { questionNumber: "asc" },
          },
        },
      });
    }

    if (!attempt.selectedQuestions.length) {
      const selectedQuestions = await createSelectedQuestionsForAttempt(tx, attempt.id);
      attempt = {
        ...attempt,
        selectedQuestions,
      };
    }

    return {
      alreadySubmitted: false,
      attempt,
    };
  });
}

function buildSelectedQuestionsLookup(selectedQuestions) {
  return new Map(
    selectedQuestions.map((question) => [question.questionCode, question])
  );
}

function getSelectedOptionLabel(attemptQuestion, selectedOption) {
  const option = Array.isArray(attemptQuestion.options)
    ? attemptQuestion.options.find((item) => item.value === selectedOption)
    : null;

  return option?.label || "";
}

function normalizeSubmittedAnswers(rawAnswers) {
  if (Array.isArray(rawAnswers)) return rawAnswers;

  if (rawAnswers && typeof rawAnswers === "object") {
    return Object.entries(rawAnswers).map(([questionCode, answer]) => ({
      questionCode,
      answer,
    }));
  }

  return [];
}

function validateAttemptAnswers(selectedQuestions, submittedAnswers) {
  const selectedQuestionLookup = buildSelectedQuestionsLookup(selectedQuestions);
  const answerLookup = new Map(
    normalizeSubmittedAnswers(submittedAnswers).map((item) => [
      item.questionCode,
      String(item.answer || "").trim().toUpperCase(),
    ])
  );

  const missingAnswers = selectedQuestions
    .filter((question) => !answerLookup.get(question.questionCode))
    .map((question) => ({
      questionCode: question.questionCode,
      questionText: question.questionText,
    }));

  const unknownAnswers = [...answerLookup.keys()]
    .filter((questionCode) => !selectedQuestionLookup.has(questionCode))
    .map((questionCode) => ({ questionCode }));

  return {
    valid: missingAnswers.length === 0 && unknownAnswers.length === 0,
    missingAnswers,
    unknownAnswers,
  };
}

function calculateAttemptResult(selectedQuestions, submittedAnswers) {
  const answerLookup = new Map(
    normalizeSubmittedAnswers(submittedAnswers).map((item) => [
      item.questionCode,
      String(item.answer || "").trim().toUpperCase(),
    ])
  );

  const answerRecords = selectedQuestions.map((question) => {
    const selectedOption = answerLookup.get(question.questionCode) || "";
    const correctOption = String(question.correctOption || "").trim().toUpperCase();
    const isCorrect = selectedOption === correctOption;
    const pointsPossible = Number(question.pointsPossible || 1);
    const pointsAwarded = isCorrect ? pointsPossible : 0;
    const selectedOptionLabel = getSelectedOptionLabel(question, selectedOption);

    return {
      questionCode: question.questionCode,
      questionText: question.questionText,
      category: question.category || question.domain,
      selectedAnswer: selectedOptionLabel
        ? `${selectedOption}. ${selectedOptionLabel}`
        : selectedOption,
      correctAnswer: question.correctAnswer
        ? `${correctOption}. ${question.correctAnswer}`
        : correctOption,
      isCorrect,
      pointsAwarded,
      pointsPossible,
    };
  });

  const score = answerRecords.reduce(
    (sum, answer) => sum + Number(answer.pointsAwarded || 0),
    0
  );
  const maxScore = selectedQuestions.reduce(
    (sum, question) => sum + Number(question.pointsPossible || 1),
    0
  );
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;

  return {
    score,
    maxScore,
    percentage,
    answerRecords,
  };
}

module.exports = {
  calculateAttemptResult,
  getOrCreateInProgressAttempt,
  toPublicQuestion,
  validateAttemptAnswers,
};
