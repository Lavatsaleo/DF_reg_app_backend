const prisma = require("../config/prisma");
const { uploadFileToS3 } = require("../services/fileUpload.service");
const registrationFormQuestions = require("../data/registrationFormQuestions");
const { normalizeContactNumber, normalizeEmail } = require("../utils/normalizers");
const { createBasicSkillsTestInvitation, sendBasicSkillsTestInvitation } = require("../services/basicSkillsTestInvitation.service");
const {
  generateParticipantCode,
  generateApplicationReference,
} = require("../utils/registrationIds");

const ALLOWED_REGISTRATION_MODES = ["PHYSICAL", "VIRTUAL", "BOTH", "UNKNOWN"];

const ALLOWED_PATHWAYS = [
  "PHYSICAL_ACADEMY",
  "VIRTUAL_ACADEMY",
  "DIGITAL_ENTREPRENEURSHIP",
  "UNKNOWN",
];

function toBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "no", "n", "0"].includes(normalized)) return false;
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

  if (operator === "contains") {
    if (Array.isArray(controllingAnswer)) {
      return controllingAnswer.includes(expectedValue);
    }

    if (typeof controllingAnswer === "string") {
      return controllingAnswer.includes(expectedValue);
    }

    return false;
  }

  return true;
}

function isValidPersonName(value) {
  const textValue = String(value || "").trim();

  // Allow letters from all languages, spaces, apostrophes, hyphens, and periods.
  // At least one letter is required and numbers are never accepted.
  return /^(?=.*\p{L})[\p{L}\p{M}\s'.-]+$/u.test(textValue);
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

const ELIGIBILITY_SCREENING_VERSION = "PHYSICAL_ACADEMY_V1_4";
const REGISTRATION_FORM_VERSION = "1.2";
const MAX_ELIGIBLE_AGE = Number(process.env.MAX_ELIGIBLE_AGE || 34);
const MIN_REASONABLE_AGE = Number(process.env.MIN_REASONABLE_APPLICANT_AGE || 10);
const MAX_REASONABLE_AGE = Number(process.env.MAX_REASONABLE_APPLICANT_AGE || 100);

const PUBLIC_ELIGIBILITY_FEEDBACK = {
  OVER_AGE: () =>
    `The programme is currently open to applicants who are ${MAX_ELIGIBLE_AGE} years old or below at the time of application.`,
  NO_DISABILITY: () =>
    "This programme pathway is currently designed for applicants who identify as persons with disabilities.",
  MISSING_AGE_INFORMATION: () =>
    "We could not confirm your age from the date of birth provided, so the application needs a manual check.",
  AGE_DATA_OUTLIER: () =>
    "We could not validate the date of birth provided, so the application needs a manual check.",
  DISABILITY_STATUS_UNCONFIRMED: () =>
    "We could not confirm the disability information provided, so the application needs a manual check.",
  DISABILITY_REGISTRATION_STATUS_MISSING: () =>
    "The disability registration information needs to be confirmed before the next step.",
  DISABILITY_REGISTRATION_STATUS_UNCONFIRMED: () =>
    "The disability registration information needs to be reviewed by the project team before the next step.",
  UNREGISTERED_PWD_REQUIRES_DOCUMENT_REVIEW: () =>
    "Because you indicated that you are not formally registered as a person with disability, the project team needs to review the supporting information before the next step.",
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
      return "Your application has been received and needs a manual eligibility review before the next step.";
    }

    return `Your application has been received and needs a manual eligibility review. Reason: ${feedbackMessages.join(" ")}`;
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
      ageAtApplication: calculateAgeFromDateOfBirth(dateOfBirth, applicationDate),
    };
  }

  return {
    source: null,
    dateOfBirth: null,
    yearOfBirth: null,
    ageAtApplication: null,
  };
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getDisabilityEvidence(responses = []) {
  const hasDisabilityAnswer = getAnswerValue(responses, "HAS_DISABILITY");
  const registrationStatusAnswer = getAnswerValue(
    responses,
    "DISABILITY_REGISTRATION_STATUS"
  );

  const booleanValue = toBoolean(hasDisabilityAnswer);
  const registrationStatus = normalizeText(registrationStatusAnswer);

  const indicatesDisabilityByStatus =
    registrationStatus.includes("registered") ||
    registrationStatus.includes("not registered") ||
    registrationStatus.includes("unregistered") ||
    registrationStatus.startsWith("yes");

  const indicatesNoDisabilityByStatus =
    registrationStatus === "no" ||
    registrationStatus.includes("no disability") ||
    registrationStatus.includes("not disabled");

  let hasDisability = booleanValue;

  if (hasDisability === null && indicatesDisabilityByStatus) {
    hasDisability = true;
  }

  if (hasDisability === null && indicatesNoDisabilityByStatus) {
    hasDisability = false;
  }

  return {
    hasDisability,
    registrationStatus: registrationStatusAnswer || null,
    isRegisteredPwd:
      registrationStatus.includes("registered") &&
      !registrationStatus.includes("not registered") &&
      !registrationStatus.includes("unregistered"),
    isUnregisteredPwd:
      registrationStatus.includes("not registered") ||
      registrationStatus.includes("unregistered"),
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
    maxEligibleAge: MAX_ELIGIBLE_AGE,
    passed:
      ageEvidence.ageAtApplication !== null &&
      ageEvidence.ageAtApplication <= MAX_ELIGIBLE_AGE,
  };

  if (ageEvidence.ageAtApplication === null) {
    reasonCodes.push("MISSING_AGE_INFORMATION");
  } else if (
    ageEvidence.ageAtApplication < MIN_REASONABLE_AGE ||
    ageEvidence.ageAtApplication > MAX_REASONABLE_AGE
  ) {
    reasonCodes.push("AGE_DATA_OUTLIER");
  } else if (ageEvidence.ageAtApplication > MAX_ELIGIBLE_AGE) {
    reasonCodes.push("OVER_AGE");
  }

  criterionResults.disability = {
    hasDisability: disabilityEvidence.hasDisability,
    registrationStatus: disabilityEvidence.registrationStatus,
    passed: disabilityEvidence.hasDisability === true,
  };

  const normalizedDisabilityRegistrationStatus = normalizeText(
    disabilityEvidence.registrationStatus
  );

  if (disabilityEvidence.hasDisability === false) {
    reasonCodes.push("NO_DISABILITY");
  } else if (disabilityEvidence.hasDisability === null) {
    reasonCodes.push("DISABILITY_STATUS_UNCONFIRMED");
  }

  if (
    disabilityEvidence.hasDisability === true &&
    !normalizedDisabilityRegistrationStatus
  ) {
    reasonCodes.push("DISABILITY_REGISTRATION_STATUS_MISSING");
  }

  if (
    normalizedDisabilityRegistrationStatus.includes("not sure") ||
    normalizedDisabilityRegistrationStatus.includes("prefer not")
  ) {
    reasonCodes.push("DISABILITY_REGISTRATION_STATUS_UNCONFIRMED");
  }

  if (disabilityEvidence.isUnregisteredPwd) {
    reasonCodes.push("UNREGISTERED_PWD_REQUIRES_DOCUMENT_REVIEW");
  }

  if (
    disabilityEvidence.hasDisability === true &&
    normalizedDisabilityRegistrationStatus === "no"
  ) {
    reasonCodes.push("DISABILITY_STATUS_CONFLICT");
  }

  const blockingReasonCodes = ["OVER_AGE", "NO_DISABILITY"];
  const pendingReasonCodes = [
    "MISSING_AGE_INFORMATION",
    "AGE_DATA_OUTLIER",
    "DISABILITY_STATUS_UNCONFIRMED",
    "DISABILITY_REGISTRATION_STATUS_MISSING",
    "DISABILITY_REGISTRATION_STATUS_UNCONFIRMED",
    "UNREGISTERED_PWD_REQUIRES_DOCUMENT_REVIEW",
    "DISABILITY_STATUS_CONFLICT",
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
      "Applicant requires manual eligibility review before a Basic IT skills test invitation is sent.",
  };

  return {
    isEligible,
    screeningStatus,
    screeningVersion: ELIGIBILITY_SCREENING_VERSION,
    screenedAt: applicationDate,
    ageAtApplication: ageEvidence.ageAtApplication,
    dateOfBirth: ageEvidence.dateOfBirth,
    yearOfBirth: ageEvidence.yearOfBirth,
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

async function submitRegistration(req, res) {
  try {
    const { responses } = req.body;

    let parsedResponses = [];

    if (responses) {
      parsedResponses =
        typeof responses === "string" ? JSON.parse(responses) : responses;
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

          approximateAge: null,

          ageAtApplication: eligibilityResult.ageAtApplication,

          sex: getAnswerValue(parsedResponses, "SEX"),

          householdSize: getAnswerValue(parsedResponses, "HOUSEHOLD_SIZE")
            ? Number(getAnswerValue(parsedResponses, "HOUSEHOLD_SIZE"))
            : null,

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

          accessibilityNeeds: getAnswerValue(
            parsedResponses,
            "ACCESSIBILITY_NEEDS"
          ),

          canParticipateOnline: toBoolean(
            getAnswerValue(parsedResponses, "CAN_PARTICIPATE_ONLINE")
          ),

          hasDeviceAccess: toBoolean(
            getAnswerValue(parsedResponses, "HAS_DEVICE_ACCESS")
          ),

          heardAboutProject: getAnswerValue(
            parsedResponses,
            "HEARD_ABOUT_PROJECT"
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

          previousSightsaversTraining: toBoolean(
            getAnswerValue(parsedResponses, "PREVIOUS_SIGHTSAVERS_TRAINING")
          ),

          motivation: getAnswerValue(parsedResponses, "MOTIVATION"),

          employmentStatus: getAnswerValue(parsedResponses, "EMPLOYMENT_STATUS"),
          jobSearchActions: getAnswerValue(parsedResponses, "JOB_SEARCH_ACTIONS"),

          monthlyIncomeRange: getAnswerValue(
            parsedResponses,
            "MONTHLY_INCOME_RANGE"
          ),

          dignifiedWorkResponse: getAnswerValue(
            parsedResponses,
            "DIGNIFIED_WORK_RESPONSE"
          ),

          careerAspirations: getAnswerValue(
            parsedResponses,
            "CAREER_ASPIRATIONS"
          ),

          currentBusinessDetails: getAnswerValue(
            parsedResponses,
            "CURRENT_BUSINESS_DETAILS"
          ),

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
          ? "You passed the initial eligibility check. A Basic IT skills test invitation link has been sent to your email address. Complete the test so the committee can review your full application."
          : applicant.status === "PENDING_REVIEW"
            ? "Your application requires a manual review before the next step."
            : applicantEligibilityMessage,

      // New tracking fields.
      personUid: canTrackApplication ? applicant.id : null,
      participantCode: publicParticipantCode,
      applicationReference: publicApplicationReference,
      submittedAt: applicant.createdAt,

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
            ? "You passed the initial eligibility check. A Basic IT skills test invitation link has been sent to your email address. Complete the test so the committee can review your full application."
            : applicant.status === "PENDING_REVIEW"
              ? "Your application requires a manual review before the next step."
              : applicantEligibilityMessage,
        submittedAt: applicant.createdAt,
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
      "Your application has been received and requires manual eligibility review before a test invitation is sent.",
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
};