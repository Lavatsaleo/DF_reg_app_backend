const prisma = require("../config/prisma");
const {
  PHYSICAL_ACADEMY_CONSENT,
  PHYSICAL_ACADEMY_CONSENT_VERSION,
} = require("../data/physicalAcademyConsent");

const CONSENT_CODES = [
  "CONSENT_VERSION",
  "CONSENT_INFORMATION_READ",
  "REGISTRATION_CONSENT",
  "CONSENT_NAME_ID_CODE",
  "CONSENT_SIGNED_DATE",
  "CONSENT_SIGNATURE_METHOD",
  "CONSENT_SIGNATURE_DATA",
  "JURAT_REQUIRED",
  "JURAT_INTERPRETER_NAME",
  "JURAT_INTERPRETER_ADDRESS",
  "JURAT_LANGUAGE",
  "JURAT_SIGNATURE_METHOD",
  "JURAT_INTERPRETER_SIGNATURE",
  "JURAT_DATE",
];

function responseValue(response) {
  if (!response) return null;
  if (response.valueBoolean !== null && response.valueBoolean !== undefined) return response.valueBoolean;
  if (response.valueDate) return response.valueDate;
  if (response.valueNumber !== null && response.valueNumber !== undefined) return response.valueNumber;
  if (response.valueJson !== null && response.valueJson !== undefined) return response.valueJson;
  return response.valueText;
}

function responseMap(responses = []) {
  return responses.reduce((accumulator, response) => {
    accumulator[response.questionCode] = responseValue(response);
    return accumulator;
  }, {});
}

function buildConsentRecord(applicant) {
  const answers = responseMap(applicant.responses);
  const version = answers.CONSENT_VERSION || PHYSICAL_ACADEMY_CONSENT_VERSION;

  return {
    applicantId: applicant.id,
    applicationReference: applicant.applicationReference,
    participantCode: applicant.participantCode,
    applicantName: [applicant.firstName, applicant.lastName].filter(Boolean).join(" "),
    country: applicant.country,
    pathway: applicant.pathway,
    submittedAt: applicant.createdAt,
    consentVersion: version,
    consentSnapshot: version === PHYSICAL_ACADEMY_CONSENT_VERSION ? PHYSICAL_ACADEMY_CONSENT : null,
    informationRead: answers.CONSENT_INFORMATION_READ === true || String(answers.CONSENT_INFORMATION_READ || "").toLowerCase() === "yes",
    agreedToParticipate: answers.REGISTRATION_CONSENT === true || String(answers.REGISTRATION_CONSENT || "").toLowerCase() === "yes",
    nameOrIdCode: answers.CONSENT_NAME_ID_CODE || null,
    signedDate: answers.CONSENT_SIGNED_DATE || null,
    signatureMethod: answers.CONSENT_SIGNATURE_METHOD || null,
    signatureData: answers.CONSENT_SIGNATURE_DATA || null,
    juratRequired: answers.JURAT_REQUIRED === true || String(answers.JURAT_REQUIRED || "").toLowerCase() === "yes",
    jurat: {
      interpreterName: answers.JURAT_INTERPRETER_NAME || null,
      interpreterAddress: answers.JURAT_INTERPRETER_ADDRESS || null,
      language: answers.JURAT_LANGUAGE || null,
      signatureMethod: answers.JURAT_SIGNATURE_METHOD || null,
      signatureData: answers.JURAT_INTERPRETER_SIGNATURE || null,
      date: answers.JURAT_DATE || null,
    },
  };
}

async function getCurrentConsent(req, res) {
  return res.json({
    success: true,
    consent: PHYSICAL_ACADEMY_CONSENT,
  });
}

async function getConsentRecords(req, res) {
  try {
    const applicants = await prisma.applicant.findMany({
      where: {
        responses: {
          some: {
            questionCode: "CONSENT_VERSION",
          },
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        applicationReference: true,
        participantCode: true,
        firstName: true,
        lastName: true,
        country: true,
        pathway: true,
        createdAt: true,
        responses: {
          where: {
            questionCode: { in: CONSENT_CODES },
          },
          select: {
            questionCode: true,
            valueText: true,
            valueNumber: true,
            valueBoolean: true,
            valueDate: true,
            valueJson: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      count: applicants.length,
      records: applicants.map(buildConsentRecord),
    });
  } catch (error) {
    console.error("Get consent records error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load consent records.",
    });
  }
}

module.exports = {
  getCurrentConsent,
  getConsentRecords,
};
