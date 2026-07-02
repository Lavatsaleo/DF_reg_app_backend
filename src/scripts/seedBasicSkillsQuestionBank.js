const prisma = require("../config/prisma");
const { basicSkillsQuestionBankSeed } = require("../data/basicSkillsQuestionBankSeed");

function normalizeQuestion(row) {
  return {
    questionCode: row.questionCode,
    domain: row.domain,
    competencyArea: row.competencyArea || null,
    difficulty: row.difficulty || null,
    questionText: row.questionText,
    optionA: row.optionA,
    optionB: row.optionB,
    optionC: row.optionC,
    optionD: row.optionD,
    correctOption: String(row.correctOption || "").trim().toUpperCase(),
    correctAnswer: row.correctAnswer,
    explanation: row.explanation || null,
    sourceFrameworks: row.sourceFrameworks || null,
    sourceUrl: row.sourceUrl || null,
    adaptationNote: row.adaptationNote || null,
    recommendedFor: row.recommendedFor || null,
    active: Boolean(row.active),
    scoreWeight: Number(row.scoreWeight || 1),
  };
}

async function seedBasicSkillsQuestionBank() {
  let created = 0;
  let updated = 0;

  for (const row of basicSkillsQuestionBankSeed) {
    const data = normalizeQuestion(row);

    const existing = await prisma.basicSkillsTestQuestion.findUnique({
      where: { questionCode: data.questionCode },
      select: { id: true },
    });

    await prisma.basicSkillsTestQuestion.upsert({
      where: { questionCode: data.questionCode },
      create: data,
      update: data,
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  const totalActive = await prisma.basicSkillsTestQuestion.count({
    where: { active: true },
  });

  return {
    created,
    updated,
    totalSeedRows: basicSkillsQuestionBankSeed.length,
    totalActive,
  };
}

seedBasicSkillsQuestionBank()
  .then((result) => {
    console.log("Basic IT skills question bank seeded successfully:", result);
  })
  .catch((error) => {
    console.error("Failed to seed Basic IT skills question bank:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
