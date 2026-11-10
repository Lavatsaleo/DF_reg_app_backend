const prisma = require("../config/prisma");
const { uploadFileToS3, detectFileType, normalizeDocumentType } = require("../services/fileUpload.service");
const registrationFormQuestions = require("../data/registrationFormQuestions");
const {
  getApplicationQuestionsForPathway,
  getApplicationFormVersion,
} = registrationFormQuestions;
const { getEligibilityRules } = require("../data/pathwayEligibility");
const { COUNTRY_CONTACTS } = require("../data/physicalAcademyConsent");
const { COUNTRY_DIAL_CODES } = require("../data/administrativeLocations");
const { normalizeContactNumber, normalizeEmail } = require("../utils/normalizers");
const { createBasicSkillsTestInvitation, sendBasicSkillsTestInvitation } = require("../services/basicSkillsTestInvitation.service");
const { issueVerificationCode, verifyCode } = require("../services/verificationCode.service");
const { assignApplicantToLeastLoadedMember } = require("../services/committeeAssignment.service");
const { getApplicantCountryFilter, canAccessCountry } = require("../utils/countryAccess");
const {
  generateParticipantCode,
  generateApplicationReference,
  generateDraftReference,
} = require("../utils/registrationIds");

const ALLOWED_REGISTRATION_MODES = ["PHYSICAL", "VIRTUAL", "BOTH", "UNKNOWN"];

const ALLOWED_PATHWAYS = [
  "PHYSICAL_ACADEMY",
  "VIRTUAL_ACADEMY",
  "DIGITAL_ENTREPRENEURSHIP",
  "UNKNOWN",
];

const PATHWAY_TITLES = {
  PHYSICAL_ACADEMY: "Physical Academy",
  VIRTUAL_ACADEMY: "Virtual Academy",
  DIGITAL_ENTREPRENEURSHIP: "Digital Entrepreneurship",
};

const BASIC_SKILLS_TEST_PATHWAYS = new Set([
  "PHYSICAL_ACADEMY",
  "VIRTUAL_ACADEMY",
]);

function pathwayRequiresBasicSkillsTest(pathway) {
  return BASIC_SKILLS_TEST_PATHWAYS.has(normalizePathway(pathway));
}


function toBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "yes", "y", "1"].includes(normalized) || normalized.startsWith("yes")) return true;
    if (["false", "no", "n", "0"].includes(normalized) || normalized.startsWith("no")) return false;
  }

  return null;
}

function normalizeRegistrationMode(value) {
  if (!value) return "UNKNOWN";

  const normalized = String(value).trim().toUpperCase();

  return ALLOWED_REGISTRATION_MODES.includes(normalized)
    ? normalized
    : "UNKNOWN";
}

function normalizePathway(value) {
  if (!value) return "UNKNOWN";

  const normalized = String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  return ALLOWED_PATHWAYS.includes(normalized) ? normalized : "UNKNOWN";
}

function getPathwayTitle(value) {
  const normalizedPathway = normalizePathway(value);
  return PATHWAY_TITLES[normalizedPathway] || null;
}

function getCountryDialCode(country) {
  return COUNTRY_DIAL_CODES[String(country || "").trim()] || "";
}

function normalizePhoneNumberForCountry(value, country) {
  const digitsOnly = String(value || "").replace(/\D/g, "");
  if (!digitsOnly) return digitsOnly;

  const dialCodeDigits = getCountryDialCode(country).replace(/\D/g, "");

  if (!dialCodeDigits || digitsOnly.startsWith(dialCodeDigits)) {
    return digitsOnly;
  }

  return `${dialCodeDigits}${digitsOnly.replace(/^0+/, "")}`;
}

function setAnswerValue(responses, code, nextValue) {
  const existingResponse = responses.find((item) => item.questionCode === code);

  if (existingResponse) {
    existingResponse.answer = nextValue;
    return responses;
  }

  responses.push({ questionCode: code, answer: nextValue });
  return responses;
}

function prepareResponsesForSubmission(responses = [], pathway) {
  const preparedResponses = responses.map((response) => ({ ...response }));
  const pathwayTitle = getPathwayTitle(pathway);

  if (pathwayTitle && !getAnswerValue(preparedResponses, "COURSE_APPLIED_FOR")) {
    setAnswerValue(preparedResponses, "COURSE_APPLIED_FOR", pathwayTitle);
  }

  const country = getAnswerValue(preparedResponses, "COUNTRY");

  for (const phoneQuestionCode of ["CONTACT_NUMBER", "ALTERNATIVE_CONTACT_NUMBER", "NEXT_OF_KIN_PHONE"]) {
    const phoneAnswer = getAnswerValue(preparedResponses, phoneQuestionCode);

    if (phoneAnswer !== undefined && phoneAnswer !== null && phoneAnswer !== "") {
      setAnswerValue(
        preparedResponses,
        phoneQuestionCode,
        normalizePhoneNumberForCountry(phoneAnswer, country)
      );
    }
  }

  return preparedResponses;
}

function getAnswerValue(responses, code) {
  const response = responses.find((item) => item.questionCode === code);
  return response ? response.answer : null;
}

function normalizeBoolean(value) {
  const booleanValue = toBoolean(value);
  return booleanValue === null ? value : booleanValue;
}

// A showIf may be one condition or a list of conditions, any of which shows the question.
function isQuestionVisible(question, responses = []) {
  if (!question.showIf) return true;
  const conditions = Array.isArray(question.showIf) ? question.showIf : [question.showIf];
  return conditions.some((condition) => matchesShowCondition(condition, responses));
}

function matchesShowCondition(condition, responses) {
  const controllingAnswer = getAnswerValue(responses, condition.questionCode);
  const expectedValue = condition.value;
  const operator = condition.operator;

  const normalizedAnswer = normalizeBoolean(controllingAnswer);
  const normalizedExpected = normalizeBoolean(expectedValue);

  if (operator === "equals") {
    return normalizedAnswer === normalizedExpected;
  }

  if (operator === "in") {
    const expectedValues = Array.isArray(expectedValue) ? expectedValue : [expectedValue];

    if (Array.isArray(normalizedAnswer)) {
      return normalizedAnswer.some((item) => expectedValues.includes(normalizeBoolean(item)));
    }

    return expectedValues.map(normalizeBoolean).includes(normalizedAnswer);
  }

  if (operator === "notEquals") {
    return normalizedAnswer !== normalizedExpected;
  }

  if (operator === "contains") {
    if (Array.isArray(controllingAnswer)) {
      return controllingAnswer.includes(expectedValue);
    }

    if (typeof controllingAnswer === "string") {
      return controllingAnswer.includes(expectedValue);
    }

    return false;
  }

  if (operator === "notContains") {
    if (Array.isArray(controllingAnswer)) {
      return !controllingAnswer.includes(expectedValue);
    }

    if (typeof controllingAnswer === "string") {
      return !controllingAnswer.includes(expectedValue);
    }

    return true;
  }

  return true;
}

function isValidPersonName(value) {
  const textValue = String(value || "").trim();

  // Allow letters from all languages, spaces, apostrophes, hyphens, and periods.
  // At least one letter is required and numbers are never accepted.
  return /^(?=.*\p{L})[\p{L}\p{M}\s'.-]+$/u.test(textValue);
}

function isWholeNumber(value) {
  return /^\d+$/.test(String(value || "").trim());
}

function isValidPhoneDigits(value) {
  return /^\d{7,15}$/.test(String(value || "").trim());
}

function isValidCountryPhone(value, country) {
  const digits = String(value || "").replace(/\D/g, "");
  const rules = {
    Kenya: [/^(?:01|07)\d{8}$/, /^254(?:1|7)\d{8}$/],
    Nigeria: [/^(?:070|080|081|090|091)\d{8}$/, /^234(?:70|80|81|90|91)\d{8}$/],
    Zambia: [/^09\d{8}$/, /^2609\d{8}$/],
    Ghana: [/^(?:02|03|05)\d{8}$/, /^233(?:2|3|5)\d{8}$/],
  };
  const patterns = rules[String(country || "").trim()];
  if (!patterns) return isValidPhoneDigits(digits);
  return patterns.some((pattern) => pattern.test(digits));
}

function isValidIdentification(value) {
  const clean = String(value || "").trim();
  return clean.length >= 3 && /^[\p{L}\p{N}\s/_.()+#&-]+$/u.test(clean);
}

function isValidNationalId(value, responses = []) {
  const clean = String(value || "").trim();
  const country = getAnswerValue(responses, "COUNTRY");

  if (country === "Nigeria") return /^\d{11}$/.test(clean);
  if (country === "Ghana") return /^GHA-[A-Za-z0-9-]{11}$/.test(clean);
  return isValidIdentification(clean);
}

function isValidCardIdentification(value, responses = []) {
  const clean = String(value || "").trim();
  const country = getAnswerValue(responses, "COUNTRY");
  const idType = String(getAnswerValue(responses, "NATIONAL_ID_TYPE") || "");

  if (country === "Ghana" && idType.startsWith("Ghana Card")) {
    return /^GHA-[A-Za-z0-9-]{11}$/.test(clean) && clean.length === 15;
  }

  if (country === "Nigeria" && idType.includes("National Identification Number")) {
    return /^\d{11}$/.test(clean);
  }

  return isValidIdentification(clean);
}

function countWords(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function isValidYear(value) {
  const year = Number(value);
  const currentYear = new Date().getFullYear();
  return Number.isInteger(year) && year >= 1900 && year <= currentYear;
}

function isValidYearOrNotSure(value) {
  if (String(value || "").trim() === "Not sure") return true;
  return isValidYear(value);
}

function getAgeFromYear(value, applicationDate = new Date()) {
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  return applicationDate.getFullYear() - year;
}

function isEligibleYearOfBirth(value, applicationDate = new Date()) {
  const age = getAgeFromYear(value, applicationDate);
  return age !== null && age >= MIN_ELIGIBLE_AGE && age <= MAX_ELIGIBLE_AGE;
}

function isValidAge(value) {
  const age = Number(value);
  return Number.isInteger(age) && age >= 0 && age <= 120;
}

function isEligibleAge(value) {
  const age = Number(value);
  return Number.isInteger(age) && age >= MIN_ELIGIBLE_AGE && age <= MAX_ELIGIBLE_AGE;
}

function isNonNegativeNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0;
}

function validateQuestionFormats(responses = [], questions = registrationFormQuestions) {
  const invalidQuestions = [];

  for (const question of questions) {
    if (!isQuestionVisible(question, responses)) continue;

    const answer = getAnswerValue(responses, question.questionCode);
    const isEmpty =
      answer === undefined ||
      answer === null ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0);

    if (isEmpty) continue;

    if (question.validationType === "PERSON_NAME" && !isValidPersonName(answer)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must contain letters only. Numbers are not allowed.`,
      });
    }

    if (question.validationType === "WHOLE_NUMBER" && !isWholeNumber(answer)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must be a whole number.`,
      });
    }

    if (question.validationType === "PHONE_DIGITS" && !isValidPhoneDigits(answer)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must contain numbers only and must be 7 to 15 digits long.`,
      });
    }

    if (question.validationType === "COUNTRY_PHONE") {
      const country = getAnswerValue(responses, "COUNTRY");
      if (!isValidCountryPhone(answer, country)) {
        invalidQuestions.push({
          questionCode: question.questionCode,
          questionText: question.questionText,
          message: `${question.questionText} does not match the phone-number format stated for ${country || "the selected country"}.`,
        });
      }
    }

    if (question.validationType === "IDENTIFICATION" && !isValidIdentification(answer)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must contain a valid identification number.`,
      });
    }

    if (question.validationType === "NATIONAL_ID" && !isValidNationalId(answer, responses)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: getAnswerValue(responses, "COUNTRY") === "Nigeria"
          ? "Your National Identification Number (NIN) must be exactly 11 digits."
          : `${question.questionText} does not match the identification format stated in the application form.`,
      });
    }

    if (question.validationType === "CARD_IDENTIFICATION" && !isValidCardIdentification(answer, responses)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} does not match the identification format stated in the application form.`,
      });
    }

    if (question.metadata?.maxWords && countWords(answer) > Number(question.metadata.maxWords)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must be no more than ${question.metadata.maxWords} words.`,
      });
    }

    if (question.validationType === "YEAR_OR_NOT_SURE" && !isValidYearOrNotSure(answer)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must be a valid year or Not sure.`,
      });
    }

    if (question.validationType === "ELIGIBLE_YEAR_OF_BIRTH" && !isEligibleYearOfBirth(answer)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must be a year of birth for applicants aged ${MIN_ELIGIBLE_AGE} to ${MAX_ELIGIBLE_AGE} at the time of application.`,
      });
    }

    if (question.validationType === "YEAR" && !isValidYear(answer)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must be a valid year in YYYY format.`,
      });
    }

    if (question.validationType === "AGE" && !isValidAge(answer)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must be a realistic age.`,
      });
    }

    if (question.validationType === "ELIGIBLE_AGE" && !isEligibleAge(answer)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must be between ${MIN_ELIGIBLE_AGE} and ${MAX_ELIGIBLE_AGE}.`,
      });
    }

    if (question.validationType === "NON_NEGATIVE_NUMBER" && !isNonNegativeNumber(answer)) {
      invalidQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
        message: `${question.questionText} must be zero or a positive number.`,
      });
    }
  }

  return invalidQuestions;
}

function validateRequiredQuestions(responses = [], questions = registrationFormQuestions) {
  const missingQuestions = [];

  for (const question of questions) {
    if (!question.required || !isQuestionVisible(question, responses)) continue;

    const answer = getAnswerValue(responses, question.questionCode);

    const isMissing =
      answer === undefined ||
      answer === null ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0);

    if (isMissing) {
      missingQuestions.push({
        questionCode: question.questionCode,
        questionText: question.questionText,
      });
    }
  }

  return missingQuestions;
}

async function findDuplicateApplication({ normalizedEmail, normalizedContactNumber }) {
  const duplicateConditions = [];

  if (normalizedEmail) {
    duplicateConditions.push({ normalizedEmail });
  }

  if (normalizedContactNumber) {
    duplicateConditions.push({ normalizedContactNumber });
  }

  if (duplicateConditions.length === 0) return null;

  return prisma.applicant.findFirst({
    where: {
      OR: duplicateConditions,
    },
    select: {
      id: true,
      applicationReference: true,
      participantCode: true,
      firstName: true,
      lastName: true,
      email: true,
      contactNumber: true,
      status: true,
      pathway: true,
      registrationMode: true,
      screeningStatus: true,
      country: true,
      createdAt: true,
    },
  });
}

function sanitizeDraftAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  // Public endpoint: bound the number and size of answers so a draft can't be used to store junk.
  return Object.entries(value).slice(0, 300).reduce((accumulator, [key, answer]) => {
    if (answer === undefined || !/^[A-Z0-9_]{1,80}$/i.test(key)) return accumulator;

    if (typeof answer === "string") {
      // Signatures are the longest answers (drawn path data).
      accumulator[key] = answer.slice(0, 70000);
      return accumulator;
    }

    if (answer === null || ["number", "boolean"].includes(typeof answer)) {
      accumulator[key] = answer;
      return accumulator;
    }

    if (Array.isArray(answer)) {
      accumulator[key] = answer
        .filter((item) => item !== undefined && item !== null)
        .slice(0, 50)
        .map((item) => String(item).slice(0, 500));
      return accumulator;
    }

    return accumulator;
  }, {});
}

function buildResponsesFromAnswerObject(answers = {}) {
  return Object.entries(answers).map(([questionCode, answer]) => ({
    questionCode,
    answer,
  }));
}

function calculateDraftCompletionPercent(answers = {}, pathway = "PHYSICAL_ACADEMY") {
  const draftResponses = buildResponsesFromAnswerObject(answers);
  const pathwayQuestions = getApplicationQuestionsForPathway(pathway);
  const visibleQuestions = pathwayQuestions.filter((question) =>
    isQuestionVisible(question, draftResponses)
  );
  const requiredQuestions = visibleQuestions.filter((question) => question.required);

  if (requiredQuestions.length === 0) return 0;

  const completedRequired = requiredQuestions.filter((question) => {
    const answer = answers[question.questionCode];
    return !(
      answer === undefined ||
      answer === null ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0)
    );
  });

  return Math.round((completedRequired.length / requiredQuestions.length) * 100);
}

function buildDraftPublicPayload(draft, { includeAnswers = false } = {}) {
  if (!draft) return null;

  return {
    draftReference: draft.draftReference,
    applicationReference: null,
    participantCode: null,
    status: draft.status || "INCOMPLETE",
    pathway: draft.pathway,
    registrationMode:
      draft.pathway === "PHYSICAL_ACADEMY"
        ? "PHYSICAL"
        : ["VIRTUAL_ACADEMY", "DIGITAL_ENTREPRENEURSHIP"].includes(draft.pathway)
          ? "VIRTUAL"
          : "UNKNOWN",
    ...(includeAnswers ? { contactNumber: draft.contactNumber, email: draft.email } : {}),
    documentType: draft.documentType || "DISABILITY_DOCUMENT",
    currentStep: draft.currentStep || 0,
    completionPercent: draft.completionPercent || 0,
    lastSavedAt: draft.lastSavedAt,
    savedAt: draft.lastSavedAt,
    submittedAt: null,
    allowResume: draft.status === "INCOMPLETE",
    isIncompleteDraft: draft.status === "INCOMPLETE",
    nextStepMessage:
      draft.status === "INCOMPLETE"
        ? "Your application is incomplete. You can continue from where you stopped."
        : "This saved draft has already been submitted.",
    ...(includeAnswers ? { answers: draft.answers || {} } : {}),
  };
}

// Saved numbers include the country dial code (254712345678), but applicants often type the local
// form (0712345678). Returns every stored form the typed number could match.
function getContactNumberCandidates(value) {
  const digits = normalizeContactNumber(value);
  if (!digits || digits.length < 7) return [];
  const candidates = new Set([digits]);
  if (digits.startsWith("0")) {
    for (const dialCode of Object.values(COUNTRY_DIAL_CODES)) {
      const dialDigits = String(dialCode || "").replace(/\D/g, "");
      if (dialDigits) candidates.add(`${dialDigits}${digits.replace(/^0+/, "")}`);
    }
  }
  return [...candidates];
}

async function findIncompleteDraftByIdentifier(identifier) {
  const cleanIdentifier = String(identifier || "").trim();
  const draftReference = cleanIdentifier.toUpperCase();

  if (!cleanIdentifier) return null;

  if (draftReference.startsWith("DRAFT-")) {
    const draft = await prisma.registrationDraft.findUnique({
      where: { draftReference },
    });

    return draft?.status === "INCOMPLETE" ? draft : null;
  }

  if (cleanIdentifier.includes("@")) {
    const normalizedEmail = normalizeEmail(cleanIdentifier);
    return normalizedEmail
      ? prisma.registrationDraft.findFirst({
          where: { normalizedEmail, status: "INCOMPLETE" },
          orderBy: { lastSavedAt: "desc" },
        })
      : null;
  }

  const contactNumberCandidates = getContactNumberCandidates(cleanIdentifier);
  if (contactNumberCandidates.length) {
    return prisma.registrationDraft.findFirst({
      where: {
        normalizedContactNumber: { in: contactNumberCandidates },
        status: "INCOMPLETE",
      },
      orderBy: { lastSavedAt: "desc" },
    });
  }

  return null;
}

const ELIGIBILITY_SCREENING_VERSION = "DIGITAL_FUTURES_COUNTRY_PAGES_20261102";
const MIN_ELIGIBLE_AGE = 18;
const MAX_ELIGIBLE_AGE = 45;
const MIN_REASONABLE_AGE = Number(process.env.MIN_REASONABLE_APPLICANT_AGE || 10);
const MAX_REASONABLE_AGE = Number(process.env.MAX_REASONABLE_APPLICANT_AGE || 100);

function formatMonthYear(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

const PUBLIC_ELIGIBILITY_FEEDBACK = {
  MISSING_AGE_INFORMATION: () =>
    "We could not confirm your age from the information provided, so the application needs a manual check.",
  AGE_DATA_OUTLIER: () =>
    "We could not validate the age information provided, so the application needs a manual check.",
  ACADEMY_AGE_OUTSIDE_RANGE: ({ ageRangeLabel }) =>
    `Applicants for this pathway must be aged ${ageRangeLabel}. Unfortunately, you do not meet the age requirement.`,
  AGE_OUTSIDE_REVIEW_RANGE: ({ ageRangeLabel }) =>
    `This pathway is for applicants aged ${ageRangeLabel}. Your application has been saved and flagged for programme review.`,
  ENTREPRENEURSHIP_AVAILABILITY_REQUIRED: () =>
    "The Digital Entrepreneurship programme requires you to be available for the full training period.",
  EDUCATION_BELOW_MINIMUM: ({ minimumEducationLabel }) =>
    `This pathway requires a completed ${minimumEducationLabel} qualification. Unfortunately, you do not meet the education requirement.`,
  LOCATION_OUTSIDE_AREA_REVIEW: ({ locationLabel }) =>
    `This pathway is for applicants based in ${locationLabel}, so your location needs a programme check.`,
  EDUCATION_OTHER_REVIEW: () =>
    "Your education level needs to be checked against the pathway requirement, so the application needs a manual check.",
  DISABILITY_REQUIRED: () =>
    "Digital Futures is a programme for young people with disabilities. Unfortunately, you do not meet this requirement.",
};

function getMinimumEducationLabel(levels = []) {
  const names = levels.map((level) => level.replace(/\s*\/\s*/g, " / ").replace(/^Highter /, "Higher "));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0] || "";
}

function buildPublicEligibilityFeedback(reasonCodes = [], context = {}) {
  const feedback = [];

  for (const code of reasonCodes || []) {
    const messageFactory = PUBLIC_ELIGIBILITY_FEEDBACK[code];
    const message = typeof messageFactory === "function" ? messageFactory(context) : null;

    if (message && !feedback.includes(message)) {
      feedback.push(message);
    }
  }

  return feedback;
}

function buildApplicantEligibilityMessage(screeningStatus, feedbackMessages = []) {
  if (screeningStatus === "NOT_ELIGIBLE") {
    if (feedbackMessages.length === 0) {
      return "Unfortunately, this application does not meet an explicit eligibility requirement in the selected application form.";
    }

    return `Unfortunately, this application cannot continue at this time. Reason: ${feedbackMessages.join(" ")}`;
  }

  if (screeningStatus === "PENDING_REVIEW") {
    if (feedbackMessages.length === 0) {
      return "Your application has been received and needs a programme review before the next step.";
    }

    return `Your application has been received and needs a programme review. ${feedbackMessages.join(" ")}`;
  }

  return "You passed the initial application checks. Please follow the next-step instructions sent by the programme.";
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculateAgeFromDateOfBirth(dateOfBirth, applicationDate = new Date()) {
  if (!dateOfBirth) return null;

  let age = applicationDate.getFullYear() - dateOfBirth.getFullYear();
  const monthDifference = applicationDate.getMonth() - dateOfBirth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && applicationDate.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }

  return age;
}

function getAgeEvidence(responses = [], applicationDate = new Date()) {
  const dateOfBirth = parseDate(getAnswerValue(responses, "DATE_OF_BIRTH"));

  if (!dateOfBirth) {
    return {
      source: null,
      dateOfBirth: null,
      yearOfBirth: null,
      approximateAge: null,
      ageAtApplication: null,
    };
  }

  return {
    source: "DATE_OF_BIRTH",
    dateOfBirth,
    yearOfBirth: dateOfBirth.getFullYear(),
    approximateAge: null,
    ageAtApplication: calculateAgeFromDateOfBirth(dateOfBirth, applicationDate),
  };
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function answerToText(value) {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function answerToNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function hasPreviousSightsaversTraining(responses = []) {
  return toBoolean(getAnswerValue(responses, "PREVIOUS_SIGHTSAVERS_TRAINING"));
}

function buildDignifiedWorkResponse(responses = []) {
  const fields = [
    ["FAMILY_RESPECTS_WORK", "Does your family think your work is honest and respected?"],
    ["WORKPLACE_RESPECT", "Are you treated with respect at your workplace?"],
    ["TREATED_SAME_AS_COWORKERS", "Are you treated the same as your co-workers at your workplace?"],
    ["WORK_MAKES_PROUD", "Does your work make you feel proud?"],
    ["WORK_GIVES_PURPOSE", "Does your work give you a purpose?"],
  ];

  const values = fields
    .map(([code, label]) => ({ code, label, answer: getAnswerValue(responses, code) }))
    .filter((item) => item.answer !== undefined && item.answer !== null && item.answer !== "");

  return values.length > 0 ? JSON.stringify(values) : null;
}

function buildCurrentBusinessDetails(responses = []) {
  const fields = [
    "DIGITAL_ENTERPRISE_CHARACTERISTICS",
    "DIGITAL_ENTERPRISE_TYPE",
    "DIGITAL_NATIVE_CATEGORY",
    "DIGITAL_TRANSFORMED_CATEGORY",
    "BUSINESS_STAGE",
    "BUSINESS_DESCRIPTION",
  ];

  const values = fields.reduce((result, code) => {
    const answer = getAnswerValue(responses, code);
    if (answer !== undefined && answer !== null && answer !== "") result[code] = answer;
    return result;
  }, {});

  return Object.keys(values).length > 0 ? JSON.stringify(values) : null;
}

function getDisabilityEvidence(responses = []) {
  const hasDisabilityAnswer = getAnswerValue(responses, "HAS_DISABILITY");
  return { hasDisability: toBoolean(hasDisabilityAnswer) };
}

function validateSubmissionConsent(responses = []) {
  const hasConsent = toBoolean(getAnswerValue(responses, "REGISTRATION_CONSENT"));

  if (hasConsent !== true) {
    return {
      valid: false,
      message:
        "Consent is required before the application can be submitted. Consent is not treated as an eligibility score; it is a submission requirement.",
    };
  }

  return { valid: true };
}

function calculateEligibility(responses = [], applicationDate = new Date(), pathway = "UNKNOWN") {
  const normalizedPathway = normalizePathway(pathway || getAnswerValue(responses, "COURSE_APPLIED_FOR"));
  const reasonCodes = [];
  const criterionResults = {};
  const country = getAnswerValue(responses, "COUNTRY");
  const rules = getEligibilityRules(normalizedPathway, country) || { minAge: 18, maxAge: 45, education: null };
  const ageRange = { min: rules.minAge, max: rules.maxAge };
  const ageEvidence = getAgeEvidence(responses, applicationDate);
  const disabilityEvidence = getDisabilityEvidence(responses);
  const trainingAvailability = toBoolean(getAnswerValue(responses, "TRAINING_AVAILABILITY"));

  // Some countries set the upper age limit at the end of training rather than at application.
  const ageAtMaxCheck = rules.maxAgeAt && ageEvidence.dateOfBirth
    ? calculateAgeFromDateOfBirth(ageEvidence.dateOfBirth, new Date(`${rules.maxAgeAt}T00:00:00`))
    : ageEvidence.ageAtApplication;
  const ageWithinRange =
    ageEvidence.ageAtApplication !== null &&
    ageEvidence.ageAtApplication >= ageRange.min &&
    ageAtMaxCheck <= ageRange.max;

  criterionResults.age = {
    source: ageEvidence.source,
    ageAtApplication: ageEvidence.ageAtApplication,
    minEligibleAge: ageRange.min,
    maxEligibleAge: ageRange.max,
    maxAgeCheckedAt: rules.maxAgeAt || "APPLICATION",
    ageAtMaxCheck,
    withinStatedRange: ageWithinRange,
    outOfRangeAction: normalizedPathway === "DIGITAL_ENTREPRENEURSHIP" ? "REVIEW" : "NOT_ELIGIBLE",
  };

  if (ageEvidence.ageAtApplication === null) {
    reasonCodes.push("MISSING_AGE_INFORMATION");
  } else if (
    ageEvidence.ageAtApplication < MIN_REASONABLE_AGE ||
    ageEvidence.ageAtApplication > MAX_REASONABLE_AGE
  ) {
    reasonCodes.push("AGE_DATA_OUTLIER");
  } else if (!ageWithinRange) {
    // Academies reject applicants outside the age range; Digital Entrepreneurship flags them for review.
    reasonCodes.push(
      normalizedPathway === "DIGITAL_ENTREPRENEURSHIP"
        ? "AGE_OUTSIDE_REVIEW_RANGE"
        : "ACADEMY_AGE_OUTSIDE_RANGE"
    );
  }

  // Every pathway is for people with disabilities; answering "No" ends the application.
  criterionResults.disability = {
    hasDisability: disabilityEvidence.hasDisability,
    usedForAutomaticExclusion: true,
  };

  if (disabilityEvidence.hasDisability === false) {
    reasonCodes.push("DISABILITY_REQUIRED");
  }

  // A minimum completed qualification, where the country page sets one; "Other" is checked by the programme team.
  const educationLevel = getAnswerValue(responses, "EDUCATION_LEVEL");
  const minimumEducation = rules.education;

  criterionResults.education = {
    pathway: normalizedPathway,
    country,
    educationLevel,
    minimumEducation,
    usedForAutomaticExclusion: Boolean(minimumEducation),
  };

  if (rules.locations) {
    const location = getAnswerValue(responses, rules.locationQuestionCode);
    criterionResults.location = { questionCode: rules.locationQuestionCode, answer: location, allowed: rules.locations };
    if (location && !rules.locations.includes(location)) reasonCodes.push("LOCATION_OUTSIDE_AREA_REVIEW");
  }

  criterionResults.trainingAvailability = {
    pathway: normalizedPathway,
    answer: getAnswerValue(responses, "TRAINING_AVAILABILITY"),
    available: trainingAvailability,
    explicitBlockingRule:
      normalizedPathway === "DIGITAL_ENTREPRENEURSHIP"
        ? "Applicant must be available on average 5 hours per week for a minimum period of 3 months."
        : null,
  };

  if (minimumEducation && educationLevel) {
    if (educationLevel === "Other") reasonCodes.push("EDUCATION_OTHER_REVIEW");
    else if (!minimumEducation.includes(educationLevel)) reasonCodes.push("EDUCATION_BELOW_MINIMUM");
  }

  if (normalizedPathway === "DIGITAL_ENTREPRENEURSHIP" && trainingAvailability !== true) {
    reasonCodes.push("ENTREPRENEURSHIP_AVAILABILITY_REQUIRED");
  }

  const blockingReasonCodes = [
    "ENTREPRENEURSHIP_AVAILABILITY_REQUIRED",
    "ACADEMY_AGE_OUTSIDE_RANGE",
    "EDUCATION_BELOW_MINIMUM",
    "DISABILITY_REQUIRED",
  ];
  const pendingReasonCodes = [
    "MISSING_AGE_INFORMATION",
    "AGE_DATA_OUTLIER",
    "AGE_OUTSIDE_REVIEW_RANGE",
    "EDUCATION_OTHER_REVIEW",
    "LOCATION_OUTSIDE_AREA_REVIEW",
  ];

  let screeningStatus = "ELIGIBLE";
  if (reasonCodes.some((code) => blockingReasonCodes.includes(code))) {
    screeningStatus = "NOT_ELIGIBLE";
  } else if (reasonCodes.some((code) => pendingReasonCodes.includes(code))) {
    screeningStatus = "PENDING_REVIEW";
  }

  const isEligible = screeningStatus === "ELIGIBLE";
  const publicFeedback = buildPublicEligibilityFeedback(reasonCodes, {
    ageRangeLabel: `${ageRange.min}–${ageRange.max}${rules.maxAgeAt ? ` at the end of training (${formatMonthYear(rules.maxAgeAt)})` : ""}`,
    locationLabel: rules.locationLabel,
    minimumEducationLabel: getMinimumEducationLabel(minimumEducation || []),
  });
  const applicantMessage = buildApplicantEligibilityMessage(screeningStatus, publicFeedback);

  const reasonMessages = {
    ELIGIBLE:
      "You meet the initial eligibility requirements for this pathway.",
    NOT_ELIGIBLE:
      "Your application did not meet one or more of the initial eligibility requirements for this pathway.",
    PENDING_REVIEW:
      "The programme team needs to check some of your answers before the next step.",
  };

  return {
    isEligible,
    screeningStatus,
    screeningVersion: ELIGIBILITY_SCREENING_VERSION,
    screenedAt: applicationDate,
    ageAtApplication: ageEvidence.ageAtApplication,
    dateOfBirth: ageEvidence.dateOfBirth,
    yearOfBirth: ageEvidence.yearOfBirth,
    approximateAge: ageEvidence.approximateAge,
    reasonCodes,
    criterionResults,
    publicFeedback,
    applicantMessage,
    reason: reasonMessages[screeningStatus],
  };
}

function buildResponseRecord(applicantId, response, questions = registrationFormQuestions) {
  const questionDefinition = questions.find(
    (question) => question.questionCode === response.questionCode
  );

  const responseType =
    questionDefinition?.responseType || response.responseType || "TEXT";

  const rawAnswer = response.answer;

  let valueText = null;
  let valueNumber = null;
  let valueBoolean = null;
  let valueDate = null;
  let valueJson = null;

  if (responseType === "NUMBER") {
    valueNumber =
      rawAnswer === "" || rawAnswer === null || rawAnswer === undefined
        ? null
        : Number(rawAnswer);

    valueText =
      rawAnswer === undefined || rawAnswer === null ? null : String(rawAnswer);
  } else if (responseType === "BOOLEAN") {
    valueBoolean = toBoolean(rawAnswer);
    valueText =
      rawAnswer === undefined || rawAnswer === null ? null : String(rawAnswer);
  } else if (responseType === "DATE") {
    valueDate = rawAnswer ? new Date(rawAnswer) : null;
    valueText =
      rawAnswer === undefined || rawAnswer === null ? null : String(rawAnswer);
  } else if (responseType === "MULTI_SELECT") {
    valueJson = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
    valueText = Array.isArray(rawAnswer)
      ? rawAnswer.join(", ")
      : String(rawAnswer || "");
  } else {
    valueText =
      rawAnswer === undefined || rawAnswer === null ? null : String(rawAnswer);
  }

  return {
    applicantId,
    questionCode: response.questionCode,
    questionNumber:
      questionDefinition?.questionNumber || response.questionNumber || null,
    questionText:
      questionDefinition?.questionText ||
      response.questionText ||
      response.questionCode,
    section: questionDefinition?.section || response.section || null,
    responseType,
    valueText,
    valueNumber,
    valueBoolean,
    valueDate,
    valueJson,
    isEligibilityQuestion: questionDefinition?.isEligibilityQuestion || false,
    isPassing:
      response.questionCode === "HAS_DISABILITY"
        ? toBoolean(rawAnswer) === true
        : null,
  };
}


async function getRegistrationFormQuestions(req, res) {
  const pathway = normalizePathway(req.query.pathway || "PHYSICAL_ACADEMY");
  const questions = getApplicationQuestionsForPathway(pathway);

  return res.json({
    success: true,
    pathway,
    formVersion: getApplicationFormVersion(pathway),
    screeningVersion: ELIGIBILITY_SCREENING_VERSION,
    questions,
  });
}

async function saveRegistrationDraft(req, res) {
  try {
    const answers = sanitizeDraftAnswers(req.body.answers || {});
    const draftReference = String(req.body.draftReference || "").trim().toUpperCase();
    const pathway = normalizePathway(req.body.pathway);
    const documentType = req.body.documentType || "DISABILITY_DOCUMENT";
    const currentStep = Number.isFinite(Number(req.body.currentStep))
      ? Math.max(0, Number(req.body.currentStep))
      : 0;

    const country = answers.COUNTRY || req.body.country || null;
    const contactNumber = answers.CONTACT_NUMBER
      ? normalizePhoneNumberForCountry(answers.CONTACT_NUMBER, country)
      : req.body.contactNumber || null;
    const email = answers.EMAIL || req.body.email || null;
    const normalizedContactNumber = normalizeContactNumber(contactNumber);
    const normalizedEmail = normalizeEmail(email);

    // A saved draft is reopened with a code sent to its email, so it needs both before it is saved to the portal.
    if (!draftReference && (!normalizedContactNumber || !normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message:
          "Enter your mobile number and email address before saving to the portal. The form is still saved on this device until then.",
      });
    }

    if (normalizedContactNumber) {
      const existingApplicant = await prisma.applicant.findUnique({
        where: { normalizedContactNumber },
        select: { applicationReference: true, status: true },
      });

      if (existingApplicant) {
        return res.status(409).json({
          success: false,
          reasonCode: "APPLICATION_EXISTS",
          message:
            "An application has already been submitted with this mobile number. You can apply for one pathway only. Use Check status to follow your application.",
        });
      }
    }

    const completionPercent = calculateDraftCompletionPercent(answers, pathway);
    const now = new Date();

    const draft = await prisma.$transaction(async (tx) => {
      let existingDraft = null;

      if (draftReference) {
        existingDraft = await tx.registrationDraft.findUnique({
          where: { draftReference },
        });
      }

      if (!existingDraft && normalizedContactNumber) {
        const draftForNumber = await tx.registrationDraft.findFirst({
          where: {
            normalizedContactNumber,
            status: "INCOMPLETE",
          },
          select: { id: true },
        });

        if (draftForNumber) {
          throw Object.assign(
            new Error("An application is already saved for this mobile number. Use Check status to get a code by email and continue it."),
            { statusCode: 409 }
          );
        }
      }

      if (existingDraft) {
        if (existingDraft.status !== "INCOMPLETE") {
          throw Object.assign(new Error("This draft has already been submitted."), {
            statusCode: 409,
          });
        }

        return tx.registrationDraft.update({
          where: { id: existingDraft.id },
          data: {
            pathway,
            contactNumber,
            normalizedContactNumber,
            email,
            normalizedEmail,
            answers,
            documentType,
            currentStep,
            completionPercent,
            lastSavedAt: now,
          },
        });
      }

      const newDraftReference = await generateDraftReference(tx);

      return tx.registrationDraft.create({
        data: {
          draftReference: newDraftReference,
          pathway,
          contactNumber,
          normalizedContactNumber,
          email,
          normalizedEmail,
          answers,
          documentType,
          currentStep,
          completionPercent,
          status: "INCOMPLETE",
          lastSavedAt: now,
        },
      });
    });

    return res.json({
      success: true,
      message: "Application draft saved.",
      data: buildDraftPublicPayload(draft, { includeAnswers: false }),
    });
  } catch (error) {
    console.error("Save registration draft error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to save application draft.",
    });
  }
}

async function getRegistrationDraft(req, res) {
  try {
    const draftReference = String(req.params.draftReference || "").trim().toUpperCase();

    const draft = await prisma.registrationDraft.findUnique({
      where: { draftReference },
    });

    if (!draft || draft.status !== "INCOMPLETE") {
      return res.status(404).json({
        success: false,
        message: "No incomplete application draft was found.",
      });
    }

    return res.json({
      success: true,
      data: buildDraftPublicPayload(draft, { includeAnswers: false }),
    });
  } catch (error) {
    console.error("Get registration draft error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch application draft.",
    });
  }
}

async function submitRegistration(req, res) {
  try {
    const { responses } = req.body;

    // Reject a disguised or unsupported file before anything about the applicant is saved.
    if ((req.files || []).some((file) => !detectFileType(file.buffer))) {
      return res.status(400).json({
        success: false,
        message: "Each document must be a valid PDF, JPG or PNG file.",
      });
    }

    let parsedResponses = [];

    if (responses) {
      try {
        parsedResponses =
          typeof responses === "string" ? JSON.parse(responses) : responses;
      } catch {
        return res.status(400).json({ success: false, message: "Registration responses are not valid." });
      }
    }

    const submittedDraftReference = String(req.body.draftReference || "").trim().toUpperCase();

    if (Array.isArray(parsedResponses)) {
      parsedResponses = prepareResponsesForSubmission(parsedResponses, req.body.pathway);
    }

    if (!Array.isArray(parsedResponses) || parsedResponses.length === 0) {
      return res.status(400).json({
        message: "Registration responses are required.",
      });
    }

    const pathway = normalizePathway(req.body.pathway);
    const pathwayQuestions = getApplicationQuestionsForPathway(pathway);

    const missingRequiredQuestions = validateRequiredQuestions(parsedResponses, pathwayQuestions);

    if (missingRequiredQuestions.length > 0) {
      return res.status(400).json({
        message: "Some required questions are missing.",
        missingRequiredQuestions,
      });
    }

    const invalidQuestions = validateQuestionFormats(parsedResponses, pathwayQuestions);

    if (invalidQuestions.length > 0) {
      return res.status(400).json({
        message: "Some responses are not in the expected format.",
        invalidQuestions,
      });
    }

    const consentCheck = validateSubmissionConsent(parsedResponses);

    if (!consentCheck.valid) {
      return res.status(400).json({
        success: false,
        message: consentCheck.message,
        reasonCode: "CONSENT_REQUIRED",
      });
    }

    const firstName = getAnswerValue(parsedResponses, "FIRST_NAME");
    const lastName = getAnswerValue(parsedResponses, "LAST_NAME");
    const contactNumber = getAnswerValue(parsedResponses, "CONTACT_NUMBER");
    const email = getAnswerValue(parsedResponses, "EMAIL");
    const normalizedContactNumber = normalizeContactNumber(contactNumber);
    const normalizedEmail = normalizeEmail(email);

    const existingApplicant = await findDuplicateApplication({
      normalizedEmail,
      normalizedContactNumber,
    });

    if (existingApplicant) {
      const canTrackExistingApplication = existingApplicant.status !== "INELIGIBLE";

      return res.status(409).json({
        success: false,
        duplicate: true,
        existingApplicationOpened: true,
        message: "This application already exists.",
        hideApplicationReference: !canTrackExistingApplication,
        allowStatusCheck: canTrackExistingApplication,
        applicationReference: canTrackExistingApplication
          ? existingApplicant.applicationReference
          : null,
        participantCode: canTrackExistingApplication
          ? existingApplicant.participantCode
          : null,
        status: canTrackExistingApplication ? existingApplicant.status : null,
        pathway: existingApplicant.pathway,
        registrationMode: existingApplicant.registrationMode,
        screeningStatus: canTrackExistingApplication
          ? existingApplicant.screeningStatus
          : "NOT_ELIGIBLE",
        submittedAt: existingApplicant.createdAt,
        supportEmail: getSupportEmail(existingApplicant.country),
        data: {
          duplicate: true,
          existingApplicationOpened: true,
          hideApplicationReference: !canTrackExistingApplication,
          allowStatusCheck: canTrackExistingApplication,
          applicationReference: canTrackExistingApplication
            ? existingApplicant.applicationReference
            : null,
          participantCode: canTrackExistingApplication
            ? existingApplicant.participantCode
            : null,
          status: canTrackExistingApplication ? existingApplicant.status : null,
          pathway: existingApplicant.pathway,
          registrationMode: existingApplicant.registrationMode,
          screeningStatus: canTrackExistingApplication
            ? existingApplicant.screeningStatus
            : "NOT_ELIGIBLE",
          submittedAt: existingApplicant.createdAt,
          supportEmail: getSupportEmail(existingApplicant.country),
        },
      });
    }

    const registrationMode = normalizeRegistrationMode(
      req.body.registrationMode
    );

    const eligibilityResult = calculateEligibility(parsedResponses, new Date(), pathway);

    const requiresBasicSkillsTest = pathwayRequiresBasicSkillsTest(pathway);

    const finalStatus =
      eligibilityResult.screeningStatus === "ELIGIBLE"
        ? requiresBasicSkillsTest
          ? "ELIGIBLE_PENDING_SKILLS_TEST"
          : "PENDING_REVIEW"
        : eligibilityResult.screeningStatus === "PENDING_REVIEW"
          ? "PENDING_REVIEW"
          : "INELIGIBLE";

    const registrationResult = await prisma.$transaction(async (tx) => {
      const participantCode = await generateParticipantCode(tx);
      const applicationReference = await generateApplicationReference(tx);

      const createdApplicant = await tx.applicant.create({
        data: {
          participantCode,
          applicationReference,

          firstName,
          lastName,
          contactNumber,
          email,
          normalizedContactNumber,
          normalizedEmail,
          alternativeContactNumber: getAnswerValue(
            parsedResponses,
            "ALTERNATIVE_CONTACT_NUMBER"
          ),

          country: getAnswerValue(parsedResponses, "COUNTRY"),
          town: getAnswerValue(parsedResponses, "TOWN"),
          county:
            getAnswerValue(parsedResponses, "COUNTY") ||
            getAnswerValue(parsedResponses, "STATE") ||
            getAnswerValue(parsedResponses, "REGION"),
          subCounty:
            getAnswerValue(parsedResponses, "SUB_COUNTY") ||
            getAnswerValue(parsedResponses, "DISTRICT"),
          state: getAnswerValue(parsedResponses, "STATE"),
          region: getAnswerValue(parsedResponses, "REGION"),
          district: getAnswerValue(parsedResponses, "DISTRICT"),

          dateOfBirth: eligibilityResult.dateOfBirth,

          yearOfBirth: eligibilityResult.yearOfBirth,

          approximateAge: eligibilityResult.approximateAge,

          ageAtApplication: eligibilityResult.ageAtApplication,

          sex: getAnswerValue(parsedResponses, "SEX"),

          householdSize: answerToNumber(getAnswerValue(parsedResponses, "HOUSEHOLD_SIZE")),

          educationLevel: getAnswerValue(parsedResponses, "EDUCATION_LEVEL"),
          courseStudied: getAnswerValue(parsedResponses, "COURSE_STUDIED"),
          currentEducationStatus: getAnswerValue(
            parsedResponses,
            "CURRENT_EDUCATION_STATUS"
          ),

          hasDisability: eligibilityResult.criterionResults.disability.hasDisability === true,

          disabilityType: Array.isArray(
            getAnswerValue(parsedResponses, "DISABILITY_TYPE")
          )
            ? getAnswerValue(parsedResponses, "DISABILITY_TYPE").join(", ")
            : getAnswerValue(parsedResponses, "DISABILITY_TYPE"),

          otherDisabilityType: getAnswerValue(
            parsedResponses,
            "OTHER_DISABILITY_TYPE"
          ),

          accessibilityNeeds: answerToText(
            getAnswerValue(parsedResponses, "ACCESSIBILITY_NEEDS")
          ),

          canParticipateOnline:
            getAnswerValue(parsedResponses, "INTERNET_ACCESS") !== undefined
              ? String(getAnswerValue(parsedResponses, "INTERNET_ACCESS") || "").trim() === "Yes"
              : null,

          hasDeviceAccess:
            getAnswerValue(parsedResponses, "DEVICE_ACCESS") !== undefined
              ? String(getAnswerValue(parsedResponses, "DEVICE_ACCESS") || "").trim() !== "None of the above"
              : null,

          heardAboutProject: answerToText(
            getAnswerValue(parsedResponses, "HEARD_ABOUT_PROJECT")
          ),

          nextOfKinName: getAnswerValue(parsedResponses, "NEXT_OF_KIN_NAME"),
          nextOfKinPhone: getAnswerValue(parsedResponses, "NEXT_OF_KIN_PHONE"),
          nextOfKinRelationship: getAnswerValue(
            parsedResponses,
            "NEXT_OF_KIN_RELATIONSHIP"
          ),
          preferredContactMethod: getAnswerValue(
            parsedResponses,
            "PREFERRED_CONTACT_METHOD"
          ),
          consentedAt: eligibilityResult.screenedAt,

          previousSightsaversTraining: hasPreviousSightsaversTraining(parsedResponses),

          motivation: getAnswerValue(parsedResponses, "MOTIVATION"),

          employmentStatus: getAnswerValue(parsedResponses, "EMPLOYMENT_STATUS"),
          jobSearchActions: answerToText(getAnswerValue(parsedResponses, "JOB_SEARCH_ACTIONS")),

          monthlyIncomeRange: answerToText(
            getAnswerValue(parsedResponses, "MONTHLY_INCOME_LOCAL_CURRENCY")
          ),

          dignifiedWorkResponse: buildDignifiedWorkResponse(parsedResponses),

          careerAspirations: getAnswerValue(
            parsedResponses,
            "CAREER_ASPIRATIONS"
          ),

          currentBusinessDetails: buildCurrentBusinessDetails(parsedResponses),

          preferredSector: getAnswerValue(parsedResponses, "PREFERRED_SECTOR"),

          registrationMode,
          pathway,
          formName:
            pathway === "PHYSICAL_ACADEMY"
              ? "Participant Application Form - Physical Academy"
              : pathway === "VIRTUAL_ACADEMY"
                ? "Participant Application Form - Virtual Academy"
                : pathway === "DIGITAL_ENTREPRENEURSHIP"
                  ? "Participant Application Form - Digital Entrepreneurship"
                  : "Participant Application Form",
          formVersion: getApplicationFormVersion(pathway),

          isEligible: eligibilityResult.isEligible,
          eligibilityReason: eligibilityResult.reason,
          screeningStatus: eligibilityResult.screeningStatus,
          screeningVersion: eligibilityResult.screeningVersion,
          screenedAt: eligibilityResult.screenedAt,
          eligibilityReasonCodes: eligibilityResult.reasonCodes,
          eligibilityDetails: eligibilityResult.criterionResults,
          duplicateCheckStatus: "NO_MATCH",
          status: finalStatus,
        },
      });

      const responseRecords = parsedResponses.map((response) =>
        buildResponseRecord(createdApplicant.id, response, pathwayQuestions)
      );

      await tx.registrationResponse.createMany({
        data: responseRecords,
      });

      await tx.applicantStatusHistory.create({
        data: {
          applicantId: createdApplicant.id,
          status: "SUBMITTED",
          note: "Application submitted by applicant.",
        },
      });

      await tx.applicantStatusHistory.create({
        data: {
          applicantId: createdApplicant.id,
          status: finalStatus,
          note: eligibilityResult.reason,
        },
      });

      let testInvitationData = null;
      let committeeAssignment = null;

      if (eligibilityResult.isEligible && requiresBasicSkillsTest) {
        testInvitationData = await createBasicSkillsTestInvitation(tx, createdApplicant);

        await tx.applicantStatusHistory.create({
          data: {
            applicantId: createdApplicant.id,
            status: finalStatus,
            note: "Basic IT skills test invitation created. The invitation link is tied to this applicant record.",
          },
        });
      }

      if (
        eligibilityResult.isEligible &&
        pathway === "DIGITAL_ENTREPRENEURSHIP"
      ) {
        committeeAssignment = await assignApplicantToLeastLoadedMember({
          applicantId: createdApplicant.id,
          tx,
          assignedByType: "SYSTEM",
          reason: "Digital Entrepreneurship application moved directly to committee review because this pathway does not require the Basic IT skills test.",
        });

        await tx.applicantStatusHistory.create({
          data: {
            applicantId: createdApplicant.id,
            status: finalStatus,
            note: committeeAssignment
              ? "Digital Entrepreneurship application is ready for committee review and was assigned automatically."
              : "Digital Entrepreneurship application is ready for committee review. No active committee member was available for automatic assignment.",
          },
        });
      }

      const draftMatchConditions = [];

      if (submittedDraftReference) {
        draftMatchConditions.push({ draftReference: submittedDraftReference });
      }

      if (normalizedContactNumber) {
        draftMatchConditions.push({ normalizedContactNumber });
      }

      if (draftMatchConditions.length > 0) {
        await tx.registrationDraft.updateMany({
          where: {
            status: "INCOMPLETE",
            OR: draftMatchConditions,
          },
          data: {
            status: "SUBMITTED",
            submittedApplicantId: createdApplicant.id,
            lastSavedAt: new Date(),
          },
        });
      }

      return {
        applicant: createdApplicant,
        testInvitationData,
        committeeAssignment,
      };
    });

    const applicant = registrationResult.applicant;
    const testInvitationData = registrationResult.testInvitationData;
    const committeeAssignment = registrationResult.committeeAssignment;

    let testInvitationEmailResult = null;

    if (testInvitationData?.invitation) {
      testInvitationEmailResult = await sendBasicSkillsTestInvitation(
        applicant,
        testInvitationData.invitation
      );
    }

    const uploadedDocuments = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadedFile = await uploadFileToS3(
          file,
          applicant.id,
          normalizeDocumentType(req.body.documentType)
        );

        const savedDocument = await prisma.applicantDocument.create({
          data: {
            applicantId: applicant.id,
            documentType: uploadedFile.documentType,
            originalName: uploadedFile.originalName,
            fileName: uploadedFile.fileName,
            mimeType: uploadedFile.mimeType,
            sizeBytes: file.size,
            storageBucket: uploadedFile.storageBucket,
            storageKey: uploadedFile.storageKey,
            storageUrl: uploadedFile.storageUrl,
          },
        });

        uploadedDocuments.push(savedDocument);
      }
    }

    const canTrackApplication = applicant.status !== "INELIGIBLE";
    const publicApplicationReference = canTrackApplication
      ? applicant.applicationReference
      : null;
    const publicParticipantCode = canTrackApplication
      ? applicant.participantCode
      : null;
    const eligibilityFeedbackMessages = buildPublicEligibilityFeedback(
      applicant.eligibilityReasonCodes || []
    );
    const applicantEligibilityMessage = buildApplicantEligibilityMessage(
      applicant.screeningStatus,
      eligibilityFeedbackMessages
    );
    const publicEligibilityReason = canTrackApplication
      ? applicant.eligibilityReason
      : applicantEligibilityMessage;
    const publicMessage = canTrackApplication
      ? "Registration submitted successfully."
      : applicantEligibilityMessage;

    return res.status(201).json({
      success: true,
      message: publicMessage,
      hideApplicationReference: !canTrackApplication,
      allowStatusCheck: canTrackApplication,

      // Existing response fields kept so the current frontend does not break.
      applicantId: canTrackApplication ? applicant.id : null,
      pathway: applicant.pathway,
      registrationMode: applicant.registrationMode,
      isEligible: applicant.isEligible,
      status: applicant.status,
      eligibilityReason: publicEligibilityReason,
      eligibilityFeedback: eligibilityFeedbackMessages,
      screeningStatus: applicant.screeningStatus,
      screeningVersion: applicant.screeningVersion,
      ageAtApplication: applicant.ageAtApplication,
      eligibilityReasonCodes: canTrackApplication ? applicant.eligibilityReasonCodes : [],
      eligibilityDetails: canTrackApplication ? applicant.eligibilityDetails : null,
      documentsUploaded: uploadedDocuments.length,
      requiresBasicSkillsTest: applicant.isEligible && pathwayRequiresBasicSkillsTest(applicant.pathway),
      testInvitationEmailSent: Boolean(testInvitationEmailResult?.sent),
      testInvitationEmailStatus: testInvitationEmailResult?.status || null,
      nextStepMessage:
        applicant.status === "ELIGIBLE_PENDING_SKILLS_TEST"
          ? testInvitationEmailResult?.sent
            ? "You passed the initial eligibility check. A Basic IT skills test invitation link has been sent to your email address. Complete the test so the committee can review your full application."
            : "You passed the initial eligibility check and your Basic IT skills test invitation has been created. The email has not been confirmed as sent; the programme team can check the address and resend the invitation."
          : applicant.pathway === "DIGITAL_ENTREPRENEURSHIP" &&
              applicant.screeningStatus === "ELIGIBLE"
            ? committeeAssignment
              ? "Your application passed the initial checks and has moved directly to committee review. The Basic IT skills test is not required for Digital Entrepreneurship."
              : "Your application passed the initial checks and is ready for committee review. The Basic IT skills test is not required for Digital Entrepreneurship."
            : applicant.status === "PENDING_REVIEW"
              ? "Your application needs an internal data review because the initial eligibility check could not be completed automatically."
              : applicantEligibilityMessage,

      // New tracking fields.
      personUid: canTrackApplication ? applicant.id : null,
      participantCode: publicParticipantCode,
      applicationReference: publicApplicationReference,
      submittedAt: applicant.createdAt,
      contactNumber: applicant.contactNumber,

      data: {
        applicantId: canTrackApplication ? applicant.id : null,
        hideApplicationReference: !canTrackApplication,
        allowStatusCheck: canTrackApplication,
        personUid: canTrackApplication ? applicant.id : null,
        participantCode: publicParticipantCode,
        applicationReference: publicApplicationReference,
        pathway: applicant.pathway,
        registrationMode: applicant.registrationMode,
        isEligible: applicant.isEligible,
        status: applicant.status,
        eligibilityReason: publicEligibilityReason,
        eligibilityFeedback: eligibilityFeedbackMessages,
        screeningStatus: applicant.screeningStatus,
        screeningVersion: applicant.screeningVersion,
        ageAtApplication: applicant.ageAtApplication,
        eligibilityReasonCodes: canTrackApplication ? applicant.eligibilityReasonCodes : [],
        eligibilityDetails: canTrackApplication ? applicant.eligibilityDetails : null,
        documentsUploaded: uploadedDocuments.length,
        requiresBasicSkillsTest: applicant.isEligible && pathwayRequiresBasicSkillsTest(applicant.pathway),
            testInvitationEmailSent: Boolean(testInvitationEmailResult?.sent),
        testInvitationEmailStatus: testInvitationEmailResult?.status || null,
        nextStepMessage:
          applicant.status === "ELIGIBLE_PENDING_SKILLS_TEST"
            ? testInvitationEmailResult?.sent
              ? "You passed the initial eligibility check. A Basic IT skills test invitation link has been sent to your email address. Complete the test so the committee can review your full application."
              : "You passed the initial eligibility check and your Basic IT skills test invitation has been created. The email has not been confirmed as sent; the programme team can check the address and resend the invitation."
            : applicant.pathway === "DIGITAL_ENTREPRENEURSHIP" &&
                applicant.screeningStatus === "ELIGIBLE"
              ? committeeAssignment
                ? "Your application passed the initial checks and has moved directly to committee review. The Basic IT skills test is not required for Digital Entrepreneurship."
                : "Your application passed the initial checks and is ready for committee review. The Basic IT skills test is not required for Digital Entrepreneurship."
              : applicant.status === "PENDING_REVIEW"
                ? "Your application needs an internal data review because the initial eligibility check could not be completed automatically."
                : applicantEligibilityMessage,
        submittedAt: applicant.createdAt,
        contactNumber: applicant.contactNumber,
      },
    });
  } catch (error) {
    console.error("Registration submission error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        duplicate: true,
        existingApplicationOpened: false,
        hideApplicationReference: true,
        allowStatusCheck: false,
        message: "This application already exists.",
      });
    }

    return res.status(500).json({
      message: "Failed to submit registration.",
    });
  }
}

async function getApplicants(req, res) {
  try {
    const applicants = await prisma.applicant.findMany({
      where: getApplicantCountryFilter(req.user),
      orderBy: {
        createdAt: "desc",
      },
      include: {
        responses: true,
        documents: { select: { id: true, documentType: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } },
        syncLogs: true,
        statusHistory: {
          orderBy: {
            createdAt: "asc",
          },
        },
        skillsTestAttempts: {
          orderBy: {
            submittedAt: "desc",
          },
          include: {
            answers: {
              orderBy: {
                questionCode: "asc",
              },
            },
            invitation: true,
          },
        },
        skillsTestInvitations: {
          orderBy: {
            createdAt: "desc",
          },
        },
        participantRegistrationInvitations: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return res.json(applicants);
  } catch (error) {
    console.error("Get applicants error:", error);

    return res.status(500).json({
      message: "Failed to fetch applicants.",
    });
  }
}

async function getApplicantById(req, res) {
  try {
    const { id } = req.params;

    const applicant = await prisma.applicant.findUnique({
      where: { id },
      include: {
        responses: true,
        documents: { select: { id: true, documentType: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } },
        syncLogs: true,
        statusHistory: {
          orderBy: {
            createdAt: "asc",
          },
        },
        skillsTestAttempts: {
          orderBy: {
            submittedAt: "desc",
          },
          include: {
            answers: {
              orderBy: {
                questionCode: "asc",
              },
            },
            invitation: true,
          },
        },
        skillsTestInvitations: {
          orderBy: {
            createdAt: "desc",
          },
        },
        participantRegistrationInvitations: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!applicant) {
      return res.status(404).json({
        message: "Applicant not found.",
      });
    }

    if (!canAccessCountry(req.user, applicant.country)) {
      return res.status(403).json({
        message: "You can only view applicants from your assigned country.",
      });
    }

    return res.json(applicant);
  } catch (error) {
    console.error("Get applicant error:", error);

    return res.status(500).json({
      message: "Failed to fetch applicant.",
    });
  }
}

// The status lookup is public, so show only enough of the address for applicants to spot a typo.
function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return null;
  const visible = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

function getNextStepMessage(status, pathway, screeningStatus) {
  if (
    status === "PENDING_REVIEW" &&
    pathway === "DIGITAL_ENTREPRENEURSHIP" &&
    screeningStatus === "ELIGIBLE"
  ) {
    return "Your application passed the initial checks and is ready for committee review. The Basic IT skills test is not required for Digital Entrepreneurship.";
  }

  const messages = {
    SUBMITTED:
      "Your application has been received and is waiting for eligibility review.",
    PENDING_REVIEW:
      "Your application has been received and needs internal data review because the initial eligibility check could not be completed automatically.",
    INELIGIBLE:
      "Your application was received but did not meet the initial eligibility criteria.",
    ELIGIBLE_PENDING_SKILLS_TEST:
      "Your application passed the initial eligibility check. Please check your email for the Basic IT skills test invitation link.",
    SKILLS_TEST_COMPLETED_PENDING_REVIEW:
      "Your basic IT skills test has been submitted. Your registration and test results are ready for committee review.",
    ELIGIBLE_PENDING_DHIS2_SYNC:
      "Your application passed the initial eligibility check and is waiting to be synced to DHIS2.",
    SYNCED_TO_DHIS2_PENDING_REVIEW:
      "Your application has been synced to DHIS2 and is waiting for review committee action.",
    UNDER_REVIEW:
      "Your application is currently being reviewed by the project team.",
    APPROVED_FOR_ENROLLMENT:
      "Your application has been approved for programme enrollment.",
    PARTICIPANT_REGISTRATION_PENDING:
      "You have been selected. Please check your email for the secure Participant Registration & Baseline Survey link.",
    PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION:
      "Your Participant Registration & Baseline Survey has been submitted and is pending verification by the programme team.",
    REJECTED_BY_REVIEW_COMMITTEE:
      "Your application was reviewed but was not approved for enrollment.",
    ENROLLED_IN_DHIS2_PROGRAM:
      "You have been enrolled into the programme pathway.",
    SYNC_FAILED:
      "Your application was received, but the DHIS2 sync needs technical follow-up.",
  };

  return messages[status] || "Your application is being processed.";
}

// The latest skills test link, as the applicant needs to see it. The email address is only shown
// (masked) to someone who searched with the application reference.
function summarizeTestInvitation(invitation, { includeEmail }) {
  if (!invitation) return null;
  return {
    status: invitation.status,
    ...(includeEmail ? { emailTo: maskEmail(invitation.emailTo) } : {}),
    sentAt: invitation.sentAt,
    expiresAt: invitation.expiresAt,
    expired:
      !["USED", "CANCELLED"].includes(invitation.status) &&
      new Date(invitation.expiresAt).getTime() < Date.now(),
    openedAt: invitation.openedAt,
    usedAt: invitation.usedAt,
  };
}

// The country team's public address for application questions, shown so applicants know who to ask.
function getSupportEmail(country) {
  return COUNTRY_CONTACTS[country]?.questions || null;
}

const ACCESS_CODE_PURPOSE = "APPLICATION_ACCESS";
const ACCESS_CODE_SENT_MESSAGE =
  "If we found an application with those details, we have sent a 6-digit code to the email address used in it. The code expires in 10 minutes. Check your spam or junk folder if it does not arrive.";
const ACCESS_CODE_INVALID_MESSAGE =
  "That code is not correct or has expired. Check the latest email we sent, or ask for a new code.";

const STATUS_LOOKUP_INCLUDE = {
  statusHistory: { orderBy: { createdAt: "asc" } },
  skillsTestAttempts: { where: { status: "SUBMITTED" }, orderBy: { submittedAt: "desc" } },
  skillsTestInvitations: { orderBy: { createdAt: "desc" } },
  participantRegistrationInvitations: { orderBy: { createdAt: "desc" }, take: 1 },
};

// Finds the submitted application, or failing that the saved draft, for a reference, mobile number or email.
async function findApplicationForLookup(identifier, { include } = {}) {
  const cleanIdentifier = String(identifier || "").trim();
  if (!cleanIdentifier) return null;

  const upperIdentifier = cleanIdentifier.toUpperCase();
  const normalizedEmail = cleanIdentifier.includes("@") ? normalizeEmail(cleanIdentifier) : null;
  const contactNumberCandidates = normalizedEmail ? [] : getContactNumberCandidates(cleanIdentifier);

  let applicant = await prisma.applicant.findUnique({ where: { applicationReference: upperIdentifier }, include });
  if (!applicant && normalizedEmail) {
    applicant = await prisma.applicant.findUnique({ where: { normalizedEmail }, include });
  }
  if (!applicant && contactNumberCandidates.length) {
    applicant = await prisma.applicant.findFirst({
      where: { normalizedContactNumber: { in: contactNumberCandidates } },
      orderBy: { createdAt: "desc" },
      include,
    });
  }
  // Ineligible applications are not tracked on the public status page.
  if (applicant) return applicant.status === "INELIGIBLE" ? null : { kind: "APPLICANT", applicant };

  const draft = await findIncompleteDraftByIdentifier(cleanIdentifier);
  return draft ? { kind: "DRAFT", draft } : null;
}

function buildApplicantStatusPayload(applicant) {
  const latestRegistrationInvitation = applicant.participantRegistrationInvitations?.[0];
  const latestAttempt = applicant.skillsTestAttempts[0];

  return {
    kind: "APPLICATION",
    applicationReference: applicant.applicationReference,
    participantCode: applicant.participantCode,
    status: applicant.status,
    pathway: applicant.pathway,
    registrationMode: applicant.registrationMode,
    isEligible: applicant.isEligible,
    eligibilityReason: applicant.eligibilityReason,
    screeningStatus: applicant.screeningStatus,
    submittedAt: applicant.createdAt,
    lastUpdatedAt: applicant.updatedAt,
    requiresBasicSkillsTest:
      applicant.isEligible &&
      pathwayRequiresBasicSkillsTest(applicant.pathway) &&
      applicant.skillsTestAttempts.length === 0,
    testInvitation: summarizeTestInvitation(applicant.skillsTestInvitations?.[0], { includeEmail: true }),
    participantRegistrationInvitation: latestRegistrationInvitation
      ? {
          status: latestRegistrationInvitation.status,
          emailTo: maskEmail(latestRegistrationInvitation.emailTo),
          sentAt: latestRegistrationInvitation.sentAt,
          expiresAt: latestRegistrationInvitation.expiresAt,
          openedAt: latestRegistrationInvitation.openedAt,
          submittedAt: latestRegistrationInvitation.submittedAt,
          formVersion: latestRegistrationInvitation.formVersion,
        }
      : null,
    skillsTest: latestAttempt
      ? {
          submitted: true,
          score: latestAttempt.score,
          maxScore: latestAttempt.maxScore,
          percentage: latestAttempt.percentage,
          passed: latestAttempt.passed,
          testVersion: latestAttempt.testVersion,
          submittedAt: latestAttempt.submittedAt,
        }
      : { submitted: false },
    timeline: applicant.statusHistory.map((item) => ({ status: item.status, note: item.note, date: item.createdAt })),
    nextStepMessage: getNextStepMessage(applicant.status, applicant.pathway, applicant.screeningStatus),
    supportEmail: getSupportEmail(applicant.country),
  };
}

function buildDraftAccessPayload(draft) {
  return {
    kind: "DRAFT",
    ...buildDraftPublicPayload(draft, { includeAnswers: true }),
    supportEmail: getSupportEmail(draft.answers?.COUNTRY),
  };
}

/*
  Step 1 of a status check or resume: send a one-time code to the email on the application or draft.
  The reply is the same whether or not anything was found, so the form can't be used to discover
  who has applied.
*/
async function requestApplicationAccessCode(req, res) {
  try {
    const identifier = String(req.body?.identifier || "").trim().slice(0, 200);
    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Enter your application reference, mobile number or email address.",
      });
    }

    const match = await findApplicationForLookup(identifier);
    const subject = match?.kind === "APPLICANT" ? match.applicant : match?.draft;

    if (subject?.email) {
      const result = await issueVerificationCode({
        purpose: ACCESS_CODE_PURPOSE,
        subjectType: match.kind,
        subjectId: subject.id,
        email: subject.email,
        phone: subject.contactNumber,
        purposeText: match.kind === "APPLICANT" ? "see your application status" : "continue your saved application",
      });
      if (!result.issued) console.warn("[application-access] code not issued", { kind: match.kind, reason: result.reason });
    }

    return res.status(202).json({ success: true, message: ACCESS_CODE_SENT_MESSAGE });
  } catch (error) {
    console.error("Request application access code error:", error);
    return res.status(500).json({ success: false, message: "We could not send a code. Please try again." });
  }
}

// Step 2: a correct code shows the status, or returns the saved draft so the applicant can continue.
async function verifyApplicationAccessCode(req, res) {
  try {
    const identifier = String(req.body?.identifier || "").trim().slice(0, 200);
    const code = req.body?.code;
    if (!identifier || !code) {
      return res.status(400).json({ success: false, message: "Enter the 6-digit code from the email." });
    }

    const match = await findApplicationForLookup(identifier, { include: STATUS_LOOKUP_INCLUDE });
    const subject = match?.kind === "APPLICANT" ? match.applicant : match?.draft;

    const verified = subject
      ? await verifyCode({ purpose: ACCESS_CODE_PURPOSE, subjectType: match.kind, subjectId: subject.id, code })
      : false;

    if (!verified) {
      return res.status(400).json({ success: false, message: ACCESS_CODE_INVALID_MESSAGE });
    }

    return res.json({
      success: true,
      data: match.kind === "APPLICANT" ? buildApplicantStatusPayload(match.applicant) : buildDraftAccessPayload(match.draft),
    });
  } catch (error) {
    console.error("Verify application access code error:", error);
    return res.status(500).json({ success: false, message: "We could not check the code. Please try again." });
  }
}


module.exports = {
  submitRegistration,
  getApplicants,
  getApplicantById,
  requestApplicationAccessCode,
  verifyApplicationAccessCode,
  getRegistrationFormQuestions,
  saveRegistrationDraft,
  getRegistrationDraft,
};