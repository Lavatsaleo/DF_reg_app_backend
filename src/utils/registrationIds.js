const crypto = require("crypto");

const ORGANISATION_PREFIX = process.env.ORGANISATION_PREFIX || "SS";
const PROJECT_PREFIX = process.env.PROJECT_PREFIX || "DF";

function getCurrentYear() {
  return new Date().getFullYear();
}

function randomReadableCode(length = 6) {
  // Avoid confusing characters like I, O, 0 and 1.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }

  return code;
}

async function generateParticipantCode(tx) {
  const year = getCurrentYear();
  const counterName = `${ORGANISATION_PREFIX}-${PROJECT_PREFIX}-${year}`;

  const counter = await tx.sequenceCounter.upsert({
    where: { name: counterName },
    update: {
      value: {
        increment: 1,
      },
    },
    create: {
      name: counterName,
      value: 1,
    },
  });

  const paddedNumber = String(counter.value).padStart(6, "0");
  return `${ORGANISATION_PREFIX}-${PROJECT_PREFIX}-${year}-${paddedNumber}`;
}

async function generateApplicationReference(tx) {
  const year = getCurrentYear();

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const reference = `APP-${PROJECT_PREFIX}-${year}-${randomReadableCode(6)}`;

    const existing = await tx.applicant.findUnique({
      where: { applicationReference: reference },
      select: { id: true },
    });

    if (!existing) return reference;
  }

  throw new Error("Unable to generate a unique application reference.");
}

module.exports = {
  generateParticipantCode,
  generateApplicationReference,
};
