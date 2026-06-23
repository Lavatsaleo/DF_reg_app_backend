const prisma = require("../config/prisma");
const { uploadFileToS3 } = require("../services/fileUpload.service");
const registrationFormQuestions = require("../data/registrationFormQuestions");
const { normalizeContactNumber, normalizeEmail } = require("../utils/normalizers");
const { createBasicSkillsTestInvitation, sendBasicSkillsTestInvitation } = require("../services/basicSkillsTestInvitation.service");
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

const COUNTRY_DIAL_CODES = {
  Kenya: "+254",
  Nigeria: "+234",
  Ghana: "+233",
  Zambia: "+260",
  Senegal: "+221",
  Zimbabwe: "+263",
  Tanzania: "+255",
};

function toBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "yes", "y", "1"].includes(normalized) || normalized.startsWith("yes -")) return true;
    if (["false", "no", "n", "0"].includes(normalized) || normalized.startsWith("no -")) return false;
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

  const normalized = String(value).trim().toUpperCase();

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

function isQuestionVisible(question, responses = []) {
  if (!question.showIf) return true;

  const controllingAnswer = getAnswerValue(responses, question.showIf.questionCode);
  const expectedValue = question.showIf.value;
  const operator = question.showIf.operator;

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

function validateQuestionFormats(responses = []) {
  const invalidQuestions = [];

  for (const question of registrationFormQuestions) {
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

function validateRequiredQuestions(responses = []) {
  const missingQuestions = [];

  for (const question of registrationFormQuestions) {
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
      createdAt: true,
    },
  });
}

function sanitizeDraftAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [key, answer]) => {
    if (answer === undefined) return accumulator;

    if (answer === null || ["string", "number", "boolean"].includes(typeof answer)) {
      accumulator[key] = answer;
      return accumulator;
    }

    if (Array.isArray(answer)) {
      accumulator[key] = answer.filter((item) => item !== undefined);
      return accumulator;
    }

    accumulator[key] = String(answer);
    return accumulator;
  }, {});
}

function buildResponsesFromAnswerObject(answers = {}) {
  return Object.entries(answers).map(([questionCode, answer]) => ({
    questionCode,
    answer,
  }));
}

function calculateDraftCompletionPercent(answers = {}) {
  const draftResponses = buildResponsesFromAnswerObject(answers);
  const visibleQuestions = registrationFormQuestions.filter((question) =>
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
    registrationMode: draft.pathway === "PHYSICAL_ACADEMY" ? "PHYSICAL" : "UNKNOWN",
    contactNumber: draft.contactNumber,
    email: draft.email,
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

function datesMatch(leftValue, rightValue) {
  if (!leftValue || !rightValue) return false;

  const leftDate = new Date(leftValue);
  const rightDate = new Date(rightValue);

  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
    return String(leftValue).slice(0, 10) === String(rightValue).slice(0, 10);
  }

  return leftDate.toISOString().slice(0, 10) === rightDate.toISOString().slice(0, 10);
}

async function findIncompleteDraftByIdentifier(identifier) {
  const cleanIdentifier = String(identifier || "").trim();
  const draftReference = cleanIdentifier.toUpperCase();
  const normalizedContactNumber = normalizeContactNumber(cleanIdentifier);

  if (!cleanIdentifier) return null;

  if (draftReference.startsWith("DRAFT-")) {
    const draft = await prisma.registrationDraft.findUnique({
      where: { draftReference },
    });

    return draft?.status === "INCOMPLETE" ? draft : null;
  }

  if (normalizedContactNumber && normalizedContactNumber.length >= 7) {
    return prisma.registrationDraft.findFirst({
      where: {
        normalizedContactNumber,
        status: "INCOMPLETE",
      },
      orderBy: { lastSavedAt: "desc" },
    });
  }

  return null;
}

const ELIGIBILITY_SCREENING_VERSION = "DIGITAL_FUTURES_FORM_V4_AGE_18_33";
const REGISTRATION_FORM_VERSION = "3.1";
const MIN_ELIGIBLE_AGE = Number(process.env.MIN_ELIGIBLE_AGE || 18);
const MAX_ELIGIBLE_AGE = Number(process.env.MAX_ELIGIBLE_AGE || 33);
const MIN_REASONABLE_AGE = Number(process.env.MIN_REASONABLE_APPLICANT_AGE || 10);
const MAX_REASONABLE_AGE = Number(process.env.MAX_REASONABLE_APPLICANT_AGE || 100);

const PUBLIC_ELIGIBILITY_FEEDBACK = {
  UNDER_AGE: () =>
    `The programme is currently open to applicants who are between ${MIN_ELIGIBLE_AGE} and ${MAX_ELIGIBLE_AGE} years old at the time of application.`,
  OVER_AGE: () =>
    `The programme is currently open to applicants who are between ${MIN_ELIGIBLE_AGE} and ${MAX_ELIGIBLE_AGE} years old at the time of application.`,
  NO_DISABILITY: () =>
    "This programme pathway is currently designed for applicants who identify as persons with disabilities.",
  MISSING_AGE_INFORMATION: () =>
    "We could not confirm your age from the information provided, so the application needs a manual check.",
  AGE_DATA_OUTLIER: () =>
    "We could not validate the age information provided, so the application needs a manual check.",
  AGE_NEEDS_MANUAL_REVIEW: () =>
    "Your year of birth places you near the programme age cut-off, so the project team will review this manually.",
  DISABILITY_STATUS_UNCONFIRMED: () =>
    "We could not confirm the disability information provided, so the application needs a manual check.",
  DISABILITY_REGISTRATION_STATUS_MISSING: () =>
    "The disability registration information will be checked later by the review committee.",
  DISABILITY_REGISTRATION_STATUS_UNCONFIRMED: () =>
    "The disability registration information will be reviewed later by the project team.",
  UNREGISTERED_PWD_REQUIRES_DOCUMENT_REVIEW: () =>
    "Because you indicated that you are not formally registered as a person with disability, the supporting information will be reviewed later by the committee.",
  DISABILITY_STATUS_CONFLICT: () =>
    "The disability answers provided appear to conflict, so the project team needs to review the application before the next step.",
};

function buildPublicEligibilityFeedback(reasonCodes = []) {
  const feedback = [];

  for (const code of reasonCodes || []) {
    const messageFactory = PUBLIC_ELIGIBILITY_FEEDBACK[code];
    const message = typeof messageFactory === "function" ? messageFactory() : null;

    if (message && !feedback.includes(message)) {
      feedback.push(message);
    }
  }

  return feedback;
}

function buildApplicantEligibilityMessage(screeningStatus, feedbackMessages = []) {
  if (screeningStatus === "NOT_ELIGIBLE") {
    if (feedbackMessages.length === 0) {
      return "Unfortunately, you are not eligible for this programme at this time because the application did not meet the current programme requirements.";
    }

    return `Unfortunately, you are not eligible for this programme at this time. Reason: ${feedbackMessages.join(" ")}`;
  }

  if (screeningStatus === "PENDING_REVIEW") {
    if (feedbackMessages.length === 0) {
      return "Your application has been received and needs an internal data review because the initial eligibility check could not be completed automatically.";
    }

    return `Your application has been received and needs an internal data review because the initial eligibility check could not be completed automatically. Reason: ${feedbackMessages.join(" ")}`;
  }

  return "You passed the initial eligibility check. A Basic IT skills test invitation link has been sent to your email address.";
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

  if (dateOfBirth) {
    return {
      source: "DATE_OF_BIRTH",
      dateOfBirth,
      yearOfBirth: dateOfBirth.getFullYear(),
      approximateAge: null,
      ageAtApplication: calculateAgeFromDateOfBirth(dateOfBirth, applicationDate),
      manualReviewRequired: false,
    };
  }

  const birthYearKnown = toBoolean(getAnswerValue(responses, "BIRTH_YEAR_KNOWN"));
  const shouldUseYearOfBirth = birthYearKnown === true || birthYearKnown === null;
  const shouldUseApproximateAge = birthYearKnown === false || birthYearKnown === null;

  if (shouldUseYearOfBirth) {
    const yearOfBirthAnswer = getAnswerValue(responses, "YEAR_OF_BIRTH");
    const yearOfBirth = yearOfBirthAnswer ? Number(yearOfBirthAnswer) : null;

    if (Number.isInteger(yearOfBirth)) {
      const ageFromYearOnly = applicationDate.getFullYear() - yearOfBirth;

      return {
        source: "YEAR_OF_BIRTH",
        dateOfBirth: null,
        yearOfBirth,
        approximateAge: null,
        ageAtApplication: ageFromYearOnly,
        manualReviewRequired: false,
      };
    }
  }

  if (shouldUseApproximateAge) {
    const approximateAgeAnswer = getAnswerValue(responses, "APPROXIMATE_AGE");
    const approximateAge = approximateAgeAnswer ? Number(approximateAgeAnswer) : null;

    if (Number.isFinite(approximateAge)) {
      return {
        source: "APPROXIMATE_AGE",
        dateOfBirth: null,
        yearOfBirth: null,
        approximateAge,
        ageAtApplication: approximateAge,
        manualReviewRequired: false,
      };
    }
  }

  return {
    source: null,
    dateOfBirth: null,
    yearOfBirth: null,
    approximateAge: null,
    ageAtApplication: null,
    manualReviewRequired: false,
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
  const answer = getAnswerValue(responses, "PREVIOUS_SIGHTSAVERS_TRAINING");

  if (!Array.isArray(answer)) return toBoolean(answer);

  const noPreviousTraining = "I have not undertaken training with Sightsavers before";
  const selectedTraining = answer.filter((item) => item !== noPreviousTraining);

  return selectedTraining.length > 0;
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
  const businessStartDate = getAnswerValue(responses, "BUSINESS_START_DATE");
  const currentEmployees = getAnswerValue(responses, "CURRENT_EMPLOYEES");

  if (!businessStartDate && !currentEmployees) return null;

  return JSON.stringify({
    businessStartDate: businessStartDate || null,
    currentEmployees: currentEmployees || null,
  });
}

function getDisabilityEvidence(responses = []) {
  const hasDisabilityAnswer = getAnswerValue(responses, "HAS_DISABILITY");
  const booleanValue = toBoolean(hasDisabilityAnswer);

  return {
    hasDisability: booleanValue,
    registrationStatus: null,
    isRegisteredPwd: false,
    isUnregisteredPwd: false,
  };
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

function calculateEligibility(responses = [], applicationDate = new Date()) {
  const reasonCodes = [];
  const criterionResults = {};
  const ageEvidence = getAgeEvidence(responses, applicationDate);
  const disabilityEvidence = getDisabilityEvidence(responses);

  criterionResults.age = {
    source: ageEvidence.source,
    ageAtApplication: ageEvidence.ageAtApplication,
    minEligibleAge: MIN_ELIGIBLE_AGE,
    maxEligibleAge: MAX_ELIGIBLE_AGE,
    passed:
      ageEvidence.ageAtApplication !== null &&
      ageEvidence.ageAtApplication >= MIN_ELIGIBLE_AGE &&
      ageEvidence.ageAtApplication <= MAX_ELIGIBLE_AGE,
  };

  if (ageEvidence.ageAtApplication === null) {
    reasonCodes.push("MISSING_AGE_INFORMATION");
  } else if (
    ageEvidence.ageAtApplication < MIN_REASONABLE_AGE ||
    ageEvidence.ageAtApplication > MAX_REASONABLE_AGE
  ) {
    reasonCodes.push("AGE_DATA_OUTLIER");
  } else if (ageEvidence.manualReviewRequired) {
    reasonCodes.push("AGE_NEEDS_MANUAL_REVIEW");
  } else if (ageEvidence.ageAtApplication < MIN_ELIGIBLE_AGE) {
    reasonCodes.push("UNDER_AGE");
  } else if (ageEvidence.ageAtApplication > MAX_ELIGIBLE_AGE) {
    reasonCodes.push("OVER_AGE");
  }

  criterionResults.disability = {
    hasDisability: disabilityEvidence.hasDisability,
    registrationStatus: disabilityEvidence.registrationStatus,
    passed: disabilityEvidence.hasDisability === true,
  };

  if (disabilityEvidence.hasDisability === false) {
    reasonCodes.push("NO_DISABILITY");
  } else if (disabilityEvidence.hasDisability === null) {
    reasonCodes.push("DISABILITY_STATUS_UNCONFIRMED");
  }

  // Initial eligibility only decides whether the applicant can proceed to the
  // Basic IT Skills Test. Document and disability registration evidence is
  // reviewed later by the committee together with the test result.
  const blockingReasonCodes = ["UNDER_AGE", "OVER_AGE", "NO_DISABILITY"];
  const pendingReasonCodes = [
    "MISSING_AGE_INFORMATION",
    "AGE_DATA_OUTLIER",
    "DISABILITY_STATUS_UNCONFIRMED",
    "DISABILITY_STATUS_CONFLICT",
    "AGE_NEEDS_MANUAL_REVIEW",
  ];

  let screeningStatus = "ELIGIBLE";

  if (reasonCodes.some((code) => blockingReasonCodes.includes(code))) {
    screeningStatus = "NOT_ELIGIBLE";
  } else if (reasonCodes.some((code) => pendingReasonCodes.includes(code))) {
    screeningStatus = "PENDING_REVIEW";
  }

  const isEligible = screeningStatus === "ELIGIBLE";
  const publicFeedback = buildPublicEligibilityFeedback(reasonCodes);
  const applicantMessage = buildApplicantEligibilityMessage(screeningStatus, publicFeedback);

  const reasonMessages = {
    ELIGIBLE:
      "Applicant passed the initial eligibility screening and can be invited to complete the Basic IT skills test.",
    NOT_ELIGIBLE:
      "Applicant did not meet the initial eligibility criteria. The application has still been saved for programme records and reporting.",
    PENDING_REVIEW:
      "Applicant requires internal data review because the initial eligibility check could not be completed automatically.",
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

function buildResponseRecord(applicantId, response) {
  const questionDefinition = registrationFormQuestions.find(
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
  return res.json({
    success: true,
    formVersion: REGISTRATION_FORM_VERSION,
    screeningVersion: ELIGIBILITY_SCREENING_VERSION,
    questions: registrationFormQuestions,
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

    if (!draftReference && !normalizedContactNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Enter a mobile number before saving to the portal. The form is still saved on this device until then.",
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
          message:
            "A submitted application already exists for this mobile number. Use Check Status instead of creating a new draft.",
          applicationReference:
            existingApplicant.status === "INELIGIBLE"
              ? null
              : existingApplicant.applicationReference,
        });
      }
    }

    const completionPercent = calculateDraftCompletionPercent(answers);
    const now = new Date();

    const draft = await prisma.$transaction(async (tx) => {
      let existingDraft = null;

      if (draftReference) {
        existingDraft = await tx.registrationDraft.findUnique({
          where: { draftReference },
        });
      }

      if (!existingDraft && normalizedContactNumber) {
        existingDraft = await tx.registrationDraft.findFirst({
          where: {
            normalizedContactNumber,
            status: "INCOMPLETE",
          },
          orderBy: { lastSavedAt: "desc" },
        });
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
      message: error.message || "Failed to save application draft.",
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
      error: error.message,
    });
  }
}

async function resumeRegistrationDraft(req, res) {
  try {
    const identifier =
      req.body.draftReference || req.body.contactNumber || req.body.identifier || "";
    const draft = await findIncompleteDraftByIdentifier(identifier);

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: "No incomplete application draft was found for those details.",
      });
    }

    const answers = draft.answers || {};
    const providedDateOfBirth = req.body.dateOfBirth;
    const providedEmail = normalizeEmail(req.body.email);
    const savedDateOfBirth = answers.DATE_OF_BIRTH;
    const savedEmail = normalizeEmail(answers.EMAIL || draft.email);

    const verifiedByDateOfBirth =
      savedDateOfBirth && providedDateOfBirth && datesMatch(savedDateOfBirth, providedDateOfBirth);
    const verifiedByEmail = savedEmail && providedEmail && savedEmail === providedEmail;
    const canResumeWithoutExtraVerification = !savedDateOfBirth && !savedEmail;

    if (!verifiedByDateOfBirth && !verifiedByEmail && !canResumeWithoutExtraVerification) {
      return res.status(403).json({
        success: false,
        message:
          "We found an incomplete application, but the verification details did not match. Use the date of birth or email address entered in the form.",
      });
    }

    return res.json({
      success: true,
      message: "Incomplete application draft found.",
      data: buildDraftPublicPayload(draft, { includeAnswers: true }),
    });
  } catch (error) {
    console.error("Resume registration draft error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to resume application draft.",
      error: error.message,
    });
  }
}

async function submitRegistration(req, res) {
  try {
    const { responses } = req.body;

    let parsedResponses = [];

    if (responses) {
      parsedResponses =
        typeof responses === "string" ? JSON.parse(responses) : responses;
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

    const missingRequiredQuestions = validateRequiredQuestions(parsedResponses);

    if (missingRequiredQuestions.length > 0) {
      return res.status(400).json({
        message: "Some required questions are missing.",
        missingRequiredQuestions,
      });
    }

    const invalidQuestions = validateQuestionFormats(parsedResponses);

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
        },
      });
    }

    const eligibilityResult = calculateEligibility(parsedResponses);

    const registrationMode = normalizeRegistrationMode(
      req.body.registrationMode
    );

    const pathway = normalizePathway(req.body.pathway);

    const finalStatus =
      eligibilityResult.screeningStatus === "ELIGIBLE"
        ? "ELIGIBLE_PENDING_SKILLS_TEST"
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
          county: getAnswerValue(parsedResponses, "COUNTY"),
          subCounty: getAnswerValue(parsedResponses, "SUB_COUNTY"),

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

          canParticipateOnline: toBoolean(
            getAnswerValue(parsedResponses, "CAN_PARTICIPATE_ONLINE")
          ),

          hasDeviceAccess: toBoolean(
            getAnswerValue(parsedResponses, "HAS_DEVICE_ACCESS")
          ),

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
          formVersion: REGISTRATION_FORM_VERSION,

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
        buildResponseRecord(createdApplicant.id, response)
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

      if (eligibilityResult.isEligible) {
        testInvitationData = await createBasicSkillsTestInvitation(tx, createdApplicant);

        await tx.applicantStatusHistory.create({
          data: {
            applicantId: createdApplicant.id,
            status: finalStatus,
            note: "Basic IT skills test invitation created. The invitation link is tied to this applicant record.",
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
      };
    });

    const applicant = registrationResult.applicant;
    const testInvitationData = registrationResult.testInvitationData;

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
        const documentType = req.body.documentType || "OTHER";

        const uploadedFile = await uploadFileToS3(
          file,
          applicant.id,
          documentType
        );

        const savedDocument = await prisma.applicantDocument.create({
          data: {
            applicantId: applicant.id,
            documentType,
            originalName: file.originalname,
            fileName: uploadedFile.fileName,
            mimeType: file.mimetype,
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
      requiresBasicSkillsTest: applicant.isEligible,
      skillsTestUrl: null,
      skillsTestInviteUrl: testInvitationData?.invitationUrl || null,
      testInvitationEmailSent: Boolean(testInvitationEmailResult?.sent),
      testInvitationEmailStatus: testInvitationEmailResult?.status || null,
      nextStepMessage:
        applicant.status === "ELIGIBLE_PENDING_SKILLS_TEST"
          ? testInvitationEmailResult?.sent
            ? "You passed the initial eligibility check. A Basic IT skills test invitation link has been sent to your email address. Complete the test so the committee can review your full application."
            : "You passed the initial eligibility check and your Basic IT skills test invitation has been created. Email delivery is not active yet, so use the local testing link while SMTP is being configured."
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
        requiresBasicSkillsTest: applicant.isEligible,
        skillsTestUrl: null,
        skillsTestInviteUrl: testInvitationData?.invitationUrl || null,
        testInvitationEmailSent: Boolean(testInvitationEmailResult?.sent),
        testInvitationEmailStatus: testInvitationEmailResult?.status || null,
        nextStepMessage:
          applicant.status === "ELIGIBLE_PENDING_SKILLS_TEST"
            ? testInvitationEmailResult?.sent
              ? "You passed the initial eligibility check. A Basic IT skills test invitation link has been sent to your email address. Complete the test so the committee can review your full application."
              : "You passed the initial eligibility check and your Basic IT skills test invitation has been created. Email delivery is not active yet, so use the local testing link while SMTP is being configured."
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
      error: error.message,
    });
  }
}

async function getApplicants(req, res) {
  try {
    const applicants = await prisma.applicant.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        responses: true,
        documents: true,
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
      },
    });

    return res.json(applicants);
  } catch (error) {
    console.error("Get applicants error:", error);

    return res.status(500).json({
      message: "Failed to fetch applicants.",
      error: error.message,
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
        documents: true,
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
      },
    });

    if (!applicant) {
      return res.status(404).json({
        message: "Applicant not found.",
      });
    }

    return res.json(applicant);
  } catch (error) {
    console.error("Get applicant error:", error);

    return res.status(500).json({
      message: "Failed to fetch applicant.",
      error: error.message,
    });
  }
}


function getNextStepMessage(status) {
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
    REJECTED_BY_REVIEW_COMMITTEE:
      "Your application was reviewed but was not approved for enrollment.",
    ENROLLED_IN_DHIS2_PROGRAM:
      "You have been enrolled into the programme pathway.",
    SYNC_FAILED:
      "Your application was received, but the DHIS2 sync needs technical follow-up.",
  };

  return messages[status] || "Your application is being processed.";
}

async function getRegistrationStatus(req, res) {
  try {
    const identifier = String(req.params.reference || "").trim();
    const applicationReference = identifier.toUpperCase();
    const normalizedContactNumber = normalizeContactNumber(identifier);

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Application reference or mobile number is required.",
      });
    }

    const include = {
      statusHistory: {
        orderBy: {
          createdAt: "asc",
        },
      },
      skillsTestAttempts: {
        orderBy: {
          submittedAt: "desc",
        },
      },
      skillsTestInvitations: {
        orderBy: {
          createdAt: "desc",
        },
      },
    };

    // Keep the existing application-reference lookup as the first option.
    let applicant = await prisma.applicant.findUnique({
      where: {
        applicationReference,
      },
      include,
    });

    let lookupMethod = "APPLICATION_REFERENCE";

    // If no reference match is found, use the normalized primary mobile number.
    // The normalized field is unique, so one mobile number can only open one application.
    if (!applicant && normalizedContactNumber && normalizedContactNumber.length >= 7) {
      applicant = await prisma.applicant.findUnique({
        where: {
          normalizedContactNumber,
        },
        include,
      });
      lookupMethod = "MOBILE_NUMBER";
    }

    if (!applicant) {
      const draft = await findIncompleteDraftByIdentifier(identifier);

      if (draft) {
        return res.json({
          success: true,
          data: {
            ...buildDraftPublicPayload(draft, { includeAnswers: false }),
            lookupMethod: draft.draftReference === applicationReference
              ? "DRAFT_REFERENCE"
              : "MOBILE_NUMBER",
            dhis2Synced: false,
            requiresBasicSkillsTest: false,
            skillsTest: { submitted: false },
            timeline: [
              {
                status: "INCOMPLETE",
                note: "Application draft saved but not yet submitted.",
                date: draft.createdAt,
              },
              {
                status: "INCOMPLETE",
                note: "Latest draft save.",
                date: draft.lastSavedAt,
              },
            ],
          },
        });
      }
    }

    if (!applicant || applicant.status === "INELIGIBLE") {
      return res.status(404).json({
        success: false,
        message:
          "No trackable application was found with that application reference or mobile number.",
      });
    }

    return res.json({
      success: true,
      data: {
        applicationReference: applicant.applicationReference,
        participantCode: applicant.participantCode,
        status: applicant.status,
        pathway: applicant.pathway,
        registrationMode: applicant.registrationMode,
        isEligible: applicant.isEligible,
        eligibilityReason: applicant.eligibilityReason,
        screeningStatus: applicant.screeningStatus,
        screeningVersion: applicant.screeningVersion,
        ageAtApplication: applicant.ageAtApplication,
        eligibilityReasonCodes: applicant.eligibilityReasonCodes,
        eligibilityDetails: applicant.eligibilityDetails,
        submittedAt: applicant.createdAt,
        lastUpdatedAt: applicant.updatedAt,
        lookupMethod,
        dhis2Synced: Boolean(applicant.dhis2TrackedEntityId),
        requiresBasicSkillsTest:
          applicant.isEligible && applicant.skillsTestAttempts.length === 0,
        testInvitation: applicant.skillsTestInvitations?.[0]
          ? {
              status: applicant.skillsTestInvitations[0].status,
              emailTo: applicant.skillsTestInvitations[0].emailTo,
              sentAt: applicant.skillsTestInvitations[0].sentAt,
              expiresAt: applicant.skillsTestInvitations[0].expiresAt,
              openedAt: applicant.skillsTestInvitations[0].openedAt,
              usedAt: applicant.skillsTestInvitations[0].usedAt,
            }
          : null,
        skillsTest: applicant.skillsTestAttempts[0]
          ? {
              submitted: true,
              score: applicant.skillsTestAttempts[0].score,
              maxScore: applicant.skillsTestAttempts[0].maxScore,
              percentage: applicant.skillsTestAttempts[0].percentage,
              passed: applicant.skillsTestAttempts[0].passed,
              testVersion: applicant.skillsTestAttempts[0].testVersion,
              submittedAt: applicant.skillsTestAttempts[0].submittedAt,
            }
          : { submitted: false },
        timeline: applicant.statusHistory.map((item) => ({
          status: item.status,
          note: item.note,
          date: item.createdAt,
        })),
        nextStepMessage: getNextStepMessage(applicant.status),
      },
    });
  } catch (error) {
    console.error("Get registration status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check application status.",
      error: error.message,
    });
  }
}


module.exports = {
  submitRegistration,
  getApplicants,
  getApplicantById,
  getRegistrationStatus,
  getRegistrationFormQuestions,
  saveRegistrationDraft,
  getRegistrationDraft,
  resumeRegistrationDraft,
};