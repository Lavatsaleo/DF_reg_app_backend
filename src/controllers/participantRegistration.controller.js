const prisma = require("../config/prisma");
const { hashToken } = require("../utils/tokenUtils");
const { uploadFileToS3 } = require("../services/fileUpload.service");
const { sendEmail } = require("../services/email.service");
const {
  createAndSendParticipantRegistrationInvitation,
  pathwaySupportsParticipantRegistration,
} = require("../services/participantRegistrationInvitation.service");
const {
  PARTICIPANT_REGISTRATION_FORM_VERSION,
  CONSENT,
  MODULES,
  QUESTIONS,
} = require("../data/participantRegistrationForm");
const { canAccessCountry } = require("../utils/countryAccess");

function parseJson(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isQuestionVisible(question, answers) {
  if (!question.showIf) return true;

  const actual = answers[question.showIf.questionCode];
  const expected = question.showIf.value;

  if (question.showIf.operator === "equals") {
    return actual === expected;
  }

  if (question.showIf.operator === "in") {
    const expectedValues = Array.isArray(expected) ? expected : [expected];
    return expectedValues.includes(actual);
  }

  if (question.showIf.operator === "contains") {
    return Array.isArray(actual)
      ? actual.includes(expected)
      : String(actual || "").includes(String(expected || ""));
  }

  return true;
}

function validateResponses(answers) {
  const missing = [];
  const invalid = [];

  for (const question of QUESTIONS) {
    if (question.responseType === "FILE") continue;
    if (!isQuestionVisible(question, answers)) continue;

    const value = answers[question.questionCode];

    if (question.required && !hasValue(value)) {
      missing.push({
        questionCode: question.questionCode,
        displayNumber: question.displayNumber,
        questionText: question.questionText,
      });
      continue;
    }

    if (!hasValue(value)) continue;

    if (question.responseType === "NUMBER") {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue) || numberValue < 0) {
        invalid.push({
          questionCode: question.questionCode,
          message: `${question.questionText} must be a valid number of zero or more.`,
        });
      }
    }

    if (question.responseType === "DATE") {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        invalid.push({
          questionCode: question.questionCode,
          message: `${question.questionText} must be a valid date.`,
        });
      }
    }

    if (
      question.questionCode === "M3_5" &&
      Array.isArray(value) &&
      value.includes("None of the above") &&
      value.length > 1
    ) {
      invalid.push({
        questionCode: question.questionCode,
        message: "None of the above cannot be selected together with another option.",
      });
    }
  }

  return { missing, invalid };
}

function isSupportedSignature(method, data) {
  const cleanMethod = String(method || "").toUpperCase();
  if (!["DRAWN", "TYPED"].includes(cleanMethod)) return false;
  if (!hasValue(data)) return false;

  const signature = String(data);
  if (signature.length > 60000) return false;

  if (cleanMethod === "DRAWN") {
    return /^[ML0-9.,\s-]+$/.test(signature);
  }

  return signature.trim().length >= 2;
}

function containsOther(value) {
  if (Array.isArray(value)) {
    return value.some((item) => String(item || "").toLowerCase().startsWith("other"));
  }
  return String(value || "").toLowerCase().startsWith("other");
}

function validateConsent(consent) {
  if (consent.decision !== CONSENT.consentGrantedOption) {
    return "Consent is required before the participant registration form can be submitted.";
  }

  if (
    !hasValue(consent.fullName) ||
    !hasValue(consent.signedDate) ||
    !isSupportedSignature(consent.signatureMethod, consent.signatureData)
  ) {
    return "Please complete your full name, date and electronic signature.";
  }

  if (!hasValue(consent.completedSelf)) {
    return "Please indicate whether you completed the consent section yourself.";
  }

  if (consent.completedSelf === CONSENT.assistanceRequiredOption) {
    if (
      !hasValue(consent.assistantName) ||
      !hasValue(consent.assistantRelationship) ||
      !hasValue(consent.assistanceTypes) ||
      !hasValue(consent.assistanceLanguage) ||
      !hasValue(consent.assistanceDate) ||
      !isSupportedSignature(
        consent.assistantSignatureMethod,
        consent.assistantSignatureData
      )
    ) {
      return "Please complete all required details for the person who provided consent assistance.";
    }

    if (
      containsOther(consent.assistantRelationship) &&
      !hasValue(consent.assistantRelationshipOther)
    ) {
      return "Please specify the other relationship to the applicant.";
    }

    if (
      containsOther(consent.assistanceTypes) &&
      !hasValue(consent.assistanceTypeOther)
    ) {
      return "Please specify the other type of assistance provided.";
    }
  }

  return null;
}

function getInvitationStatus(invitation) {
  if (!invitation) return null;

  if (
    !["SUBMITTED", "CANCELLED", "EXPIRED"].includes(invitation.status) &&
    new Date(invitation.expiresAt) < new Date()
  ) {
    return "EXPIRED";
  }

  return invitation.status;
}

async function loadInvitation(rawToken) {
  const tokenHash = hashToken(rawToken);

  return prisma.participantRegistrationInvitation.findUnique({
    where: { tokenHash },
    include: { applicant: true },
  });
}

function summarizeApplicant(applicant) {
  return {
    applicationReference: applicant.applicationReference,
    participantCode: applicant.participantCode,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    email: applicant.email,
    country: applicant.country,
    pathway: applicant.pathway,
  };
}

function summarizeInvitation(invitation, effectiveStatus = invitation?.status) {
  if (!invitation) return null;

  return {
    id: invitation.id,
    status: effectiveStatus,
    sentAt: invitation.sentAt,
    openedAt: invitation.openedAt,
    submittedAt: invitation.submittedAt,
    expiresAt: invitation.expiresAt,
    formVersion: invitation.formVersion,
  };
}

function buildResponseRecord(applicantId, question, value) {
  const base = {
    applicantId,
    questionCode: question.questionCode,
    questionNumber: null,
    questionText: question.questionText,
    section: question.section,
    responseType: question.responseType,
    isEligibilityQuestion: false,
    isPassing: null,
    formContext: "PARTICIPANT_REGISTRATION",
  };

  if (question.responseType === "NUMBER") {
    return { ...base, valueNumber: Number(value) };
  }

  if (question.responseType === "DATE") {
    return { ...base, valueDate: new Date(value) };
  }

  if (question.responseType === "MULTI_SELECT") {
    return { ...base, valueJson: value };
  }

  return { ...base, valueText: value === undefined || value === null ? null : String(value) };
}

const CONSENT_RESPONSE_DEFINITIONS = [
  ["PR_CONSENT_DECISION", "Registration consent decision", "TEXT"],
  ["PR_CONSENT_FULL_NAME", "Full name", "TEXT"],
  ["PR_CONSENT_SIGNED_DATE", "Consent date", "DATE"],
  ["PR_CONSENT_SIGNATURE_METHOD", "Participant signature method", "TEXT"],
  ["PR_CONSENT_SIGNATURE_DATA", "Participant electronic signature", "LONG_TEXT"],
  ["PR_CONSENT_COMPLETED_SELF", "Did you complete this consent section yourself?", "TEXT"],
  ["PR_CONSENT_ASSISTANT_NAME", "Full name of person providing assistance", "TEXT"],
  ["PR_CONSENT_ASSISTANT_RELATIONSHIP", "Relationship to the applicant", "TEXT"],
  ["PR_CONSENT_ASSISTANT_RELATIONSHIP_OTHER", "Other relationship", "TEXT"],
  ["PR_CONSENT_ASSISTANCE_TYPES", "Type of assistance provided", "MULTI_SELECT"],
  ["PR_CONSENT_ASSISTANCE_TYPE_OTHER", "Other assistance provided", "TEXT"],
  ["PR_CONSENT_ASSISTANCE_LANGUAGE", "Language/communication method", "TEXT"],
  ["PR_CONSENT_ASSISTANT_SIGNATURE_METHOD", "Assistant signature method", "TEXT"],
  ["PR_CONSENT_ASSISTANT_SIGNATURE_DATA", "Assistant electronic signature", "LONG_TEXT"],
  ["PR_CONSENT_ASSISTANCE_DATE", "Assistance date", "DATE"],
];

function buildConsentResponseRecords(applicantId, consent) {
  const valueByCode = {
    PR_CONSENT_DECISION: consent.decision,
    PR_CONSENT_FULL_NAME: consent.fullName,
    PR_CONSENT_SIGNED_DATE: consent.signedDate,
    PR_CONSENT_SIGNATURE_METHOD: consent.signatureMethod,
    PR_CONSENT_SIGNATURE_DATA: consent.signatureData,
    PR_CONSENT_COMPLETED_SELF: consent.completedSelf,
    PR_CONSENT_ASSISTANT_NAME: consent.assistantName,
    PR_CONSENT_ASSISTANT_RELATIONSHIP: consent.assistantRelationship,
    PR_CONSENT_ASSISTANT_RELATIONSHIP_OTHER: consent.assistantRelationshipOther,
    PR_CONSENT_ASSISTANCE_TYPES: consent.assistanceTypes,
    PR_CONSENT_ASSISTANCE_TYPE_OTHER: consent.assistanceTypeOther,
    PR_CONSENT_ASSISTANCE_LANGUAGE: consent.assistanceLanguage,
    PR_CONSENT_ASSISTANT_SIGNATURE_METHOD: consent.assistantSignatureMethod,
    PR_CONSENT_ASSISTANT_SIGNATURE_DATA: consent.assistantSignatureData,
    PR_CONSENT_ASSISTANCE_DATE: consent.assistanceDate,
  };

  return CONSENT_RESPONSE_DEFINITIONS
    .filter(([code]) => hasValue(valueByCode[code]))
    .map(([code, questionText, responseType]) => {
      const value = valueByCode[code];
      const base = {
        applicantId,
        questionCode: code,
        questionNumber: null,
        questionText,
        section: "Participant Registration Consent",
        responseType,
        isEligibilityQuestion: false,
        isPassing: null,
        formContext: "PARTICIPANT_REGISTRATION",
      };

      if (responseType === "DATE") return { ...base, valueDate: new Date(value) };
      if (responseType === "MULTI_SELECT") return { ...base, valueJson: value };
      return { ...base, valueText: String(value) };
    });
}

function getFile(req, fieldName) {
  return req.files?.[fieldName]?.[0] || null;
}

async function getParticipantRegistrationForm(req, res) {
  try {
    const rawToken = String(req.params.token || "").trim();
    if (!rawToken) {
      return res.status(400).json({ success: false, message: "Registration invitation token is required." });
    }

    const invitation = await loadInvitation(rawToken);
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "This participant registration invitation could not be found.",
      });
    }

    const effectiveStatus = getInvitationStatus(invitation);

    if (effectiveStatus === "EXPIRED") {
      if (invitation.status !== "EXPIRED") {
        await prisma.participantRegistrationInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
      }

      return res.status(410).json({
        success: false,
        message: "This participant registration invitation has expired. Please contact the programme team for a new invitation.",
      });
    }

    if (effectiveStatus === "CANCELLED") {
      return res.status(410).json({
        success: false,
        message: "This participant registration invitation is no longer active. Please use the most recent email invitation.",
      });
    }

    if (!pathwaySupportsParticipantRegistration(invitation.applicant.pathway)) {
      return res.status(403).json({
        success: false,
        message: "Participant registration is currently available only for Physical Academy and Virtual Academy.",
      });
    }

    if (effectiveStatus !== "SUBMITTED" && invitation.status !== "OPENED") {
      await prisma.participantRegistrationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "OPENED",
          openedAt: invitation.openedAt || new Date(),
        },
      });
    }

    return res.json({
      success: true,
      alreadySubmitted: effectiveStatus === "SUBMITTED",
      applicant: summarizeApplicant(invitation.applicant),
      invitation: summarizeInvitation(invitation, effectiveStatus),
      form: {
        formVersion: PARTICIPANT_REGISTRATION_FORM_VERSION,
        consent: CONSENT,
        modules: MODULES,
        questions: QUESTIONS,
      },
    });
  } catch (error) {
    console.error("Get participant registration form error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load the participant registration form.",
    });
  }
}

async function saveParticipantRegistrationSupportRequest(req, res) {
  try {
    const rawToken = String(req.params.token || "").trim();
    const invitation = await loadInvitation(rawToken);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "This participant registration invitation could not be found.",
      });
    }

    const effectiveStatus = getInvitationStatus(invitation);
    if (["EXPIRED", "CANCELLED", "SUBMITTED"].includes(effectiveStatus)) {
      return res.status(410).json({
        success: false,
        message: "This participant registration invitation is not available for a support request.",
      });
    }

    const fullName = String(req.body.fullName || "").trim();
    const contactNumber = String(req.body.contactNumber || "").trim();
    const accommodation = String(req.body.accommodation || "").trim();

    if (!fullName || !contactNumber) {
      return res.status(400).json({
        success: false,
        message: "Full name and contact number are required so programme staff can contact you.",
      });
    }

    const applicantId = invitation.applicant.id;

    const supportRecords = [
      ["PR_CONSENT_SUPPORT_REQUEST_NAME", "Name for consent explanation request", "TEXT", fullName],
      ["PR_CONSENT_SUPPORT_REQUEST_PHONE", "Contact number for consent explanation request", "PHONE", contactNumber],
      ["PR_CONSENT_SUPPORT_REQUEST_ACCOMMODATION", "Reasonable accommodation required for consent explanation", "LONG_TEXT", accommodation],
    ];

    await prisma.$transaction(async (tx) => {
      await tx.registrationResponse.deleteMany({
        where: {
          applicantId,
          formContext: "PARTICIPANT_REGISTRATION_SUPPORT_REQUEST",
          questionCode: { in: supportRecords.map(([code]) => code) },
        },
      });

      await tx.registrationResponse.createMany({
        data: supportRecords
          .filter(([, , , value]) => hasValue(value))
          .map(([questionCode, questionText, responseType, value]) => ({
            applicantId,
            questionCode,
            questionNumber: null,
            questionText,
            section: "Participant Registration Consent Support Request",
            responseType,
            valueText: String(value),
            formContext: "PARTICIPANT_REGISTRATION_SUPPORT_REQUEST",
            isEligibilityQuestion: false,
            isPassing: null,
          })),
      });
    });

    const supportEmail = String(
      process.env.PARTICIPANT_REGISTRATION_SUPPORT_EMAIL ||
      process.env.SMTP_FROM_EMAIL ||
      ""
    ).trim();

    if (supportEmail) {
      await sendEmail({
        to: supportEmail,
        subject: "Digital Futures participant requested consent support",
        text: [
          "A selected participant has requested help understanding the Participant Registration consent information.",
          "",
          `Participant: ${fullName}`,
          `Application reference: ${invitation.applicant.applicationReference || "Not available"}`,
          `Pathway: ${invitation.applicant.pathway}`,
          `Contact number: ${contactNumber}`,
          `Reasonable accommodation requirements: ${accommodation || "None stated"}`,
        ].join("\n"),
      });
    }

    return res.json({
      success: true,
      message: "Your request has been recorded. Programme staff will contact you using the details provided.",
    });
  } catch (error) {
    console.error("Participant registration support request error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to save your support request.",
    });
  }
}

async function submitParticipantRegistration(req, res) {
  try {
    const rawToken = String(req.params.token || "").trim();
    const invitation = await loadInvitation(rawToken);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "This participant registration invitation could not be found.",
      });
    }

    const effectiveStatus = getInvitationStatus(invitation);

    if (effectiveStatus === "SUBMITTED") {
      return res.status(409).json({
        success: false,
        alreadySubmitted: true,
        message: "This participant registration form has already been submitted.",
      });
    }

    if (["EXPIRED", "CANCELLED"].includes(effectiveStatus)) {
      return res.status(410).json({
        success: false,
        message:
          effectiveStatus === "EXPIRED"
            ? "This participant registration invitation has expired."
            : "This participant registration invitation is no longer active.",
      });
    }

    if (!pathwaySupportsParticipantRegistration(invitation.applicant.pathway)) {
      return res.status(403).json({
        success: false,
        message: "Participant registration is currently available only for Physical Academy and Virtual Academy.",
      });
    }

    if (invitation.applicant.reviewDecision !== "APPROVED") {
      return res.status(403).json({
        success: false,
        message: "Participant registration is available only after selection approval.",
      });
    }

    const answers = parseJson(req.body.responses, {});
    const consent = parseJson(req.body.consent, {});

    const consentError = validateConsent(consent);
    if (consentError) {
      return res.status(400).json({ success: false, message: consentError });
    }

    const { missing, invalid } = validateResponses(answers);
    if (missing.length || invalid.length) {
      return res.status(400).json({
        success: false,
        message: "Please complete the required registration questions.",
        missingQuestions: missing,
        invalidQuestions: invalid,
      });
    }

    const idDocument = getFile(req, "idDocument");
    const educationCertificate = getFile(req, "educationCertificate");
    const disabilityRegistrationCard = getFile(req, "disabilityRegistrationCard");
    const hasDisabilityCard = answers.M1_2 === "Yes";

    const missingDocuments = [];
    if (!idDocument) missingDocuments.push("Upload your ID document");
    if (!educationCertificate) {
      missingDocuments.push("Upload your certificate for your highest level of education");
    }
    if (hasDisabilityCard && !disabilityRegistrationCard) {
      missingDocuments.push("Please upload a copy of your disability registration card");
    }

    if (missingDocuments.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload the required registration documents.",
        missingDocuments,
      });
    }

    const applicantId = invitation.applicant.id;
    const uploadedDocuments = [];

    for (const [file, documentType] of [
      [idDocument, "NATIONAL_ID"],
      [educationCertificate, "EDUCATION_CERTIFICATE"],
      [disabilityRegistrationCard, "DISABILITY_DOCUMENT"],
    ]) {
      if (!file) continue;

      const uploaded = await uploadFileToS3(file, applicantId, documentType);
      uploadedDocuments.push({
        applicantId,
        documentType,
        originalName: file.originalname,
        fileName: uploaded.fileName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageBucket: uploaded.storageBucket,
        storageKey: uploaded.storageKey,
        storageUrl: uploaded.storageUrl,
      });
    }

    const visibleQuestionResponses = QUESTIONS
      .filter(
        (question) =>
          question.responseType !== "FILE" &&
          isQuestionVisible(question, answers) &&
          hasValue(answers[question.questionCode])
      )
      .map((question) =>
        buildResponseRecord(applicantId, question, answers[question.questionCode])
      );

    const consentResponses = buildConsentResponseRecords(applicantId, consent);

    await prisma.$transaction(async (tx) => {
      await tx.registrationResponse.deleteMany({
        where: {
          applicantId,
          formContext: "PARTICIPANT_REGISTRATION",
        },
      });

      if (visibleQuestionResponses.length + consentResponses.length > 0) {
        await tx.registrationResponse.createMany({
          data: [...visibleQuestionResponses, ...consentResponses],
        });
      }

      if (uploadedDocuments.length > 0) {
        await tx.applicantDocument.createMany({
          data: uploadedDocuments,
        });
      }

      const workResponses = [
        "M4_4",
        "M4_5",
        "M4_6",
        "M4_7",
        "M4_8",
        "M4_9",
        "M4_10",
      ].reduce((result, code) => {
        if (hasValue(answers[code])) result[code] = answers[code];
        return result;
      }, {});

      await tx.applicant.update({
        where: { id: applicantId },
        data: {
          status: "PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION",
          householdSize: hasValue(answers.M3_3) ? Number(answers.M3_3) : undefined,
          employmentStatus: answers.M3_4 || undefined,
          jobSearchActions: Array.isArray(answers.M3_5)
            ? JSON.stringify(answers.M3_5)
            : undefined,
          monthlyIncomeRange: hasValue(answers.M3_10)
            ? String(answers.M3_10)
            : undefined,
          careerAspirations: answers.M4_1 || undefined,
          preferredSector:
            answers.M3_SECTOR === "Other"
              ? answers.M3_SECTOR_OTHER || "Other"
              : answers.M3_SECTOR || undefined,
          dignifiedWorkResponse:
            Object.keys(workResponses).length > 0
              ? JSON.stringify(workResponses)
              : undefined,
          consentedAt: new Date(consent.signedDate),
        },
      });

      await tx.participantRegistrationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });

      await tx.applicantStatusHistory.create({
        data: {
          applicantId,
          status: "PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION",
          note: "Participant Registration & Baseline Survey submitted by participant.",
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: "Your participant registration form has been submitted successfully.",
      applicant: summarizeApplicant(invitation.applicant),
      status: "PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION",
      submittedAt: new Date(),
      documentsUploaded: uploadedDocuments.length,
    });
  } catch (error) {
    console.error("Submit participant registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to submit the participant registration form.",
      error: error.message,
    });
  }
}

async function resendParticipantRegistrationInvitation(req, res) {
  try {
    const reference = String(req.params.reference || "").trim();

    const applicant = await prisma.applicant.findFirst({
      where: {
        OR: [
          { id: reference },
          { applicationReference: reference.toUpperCase() },
          { participantCode: reference.toUpperCase() },
        ],
      },
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found.",
      });
    }

    if (!canAccessCountry(req.user, applicant.country)) {
      return res.status(403).json({
        success: false,
        message: "You can only manage participants from your assigned country.",
      });
    }

    if (applicant.reviewDecision !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "A participant registration invitation can be sent only after the applicant is selected.",
      });
    }

    const submittedInvitation = await prisma.participantRegistrationInvitation.findFirst({
      where: { applicantId: applicant.id, status: "SUBMITTED" },
      select: { id: true },
    });

    if (submittedInvitation) {
      return res.status(409).json({
        success: false,
        message: "This participant has already submitted their registration. A second invitation cannot be issued.",
      });
    }

    if (!pathwaySupportsParticipantRegistration(applicant.pathway)) {
      return res.status(400).json({
        success: false,
        message: "Participant registration invitations are currently enabled only for Physical Academy and Virtual Academy.",
      });
    }

    const result = await createAndSendParticipantRegistrationInvitation(applicant);

    if (result.created === false) {
      return res.status(400).json({
        success: false,
        message: "This pathway is not currently configured for participant registration.",
      });
    }

    if (applicant.status !== "PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION") {
      await prisma.applicant.update({
        where: { id: applicant.id },
        data: { status: "PARTICIPANT_REGISTRATION_PENDING" },
      });
    }

    return res.json({
      success: true,
      message: result.emailResult?.sent
        ? "Participant registration invitation sent successfully."
        : "The invitation was created, but the email could not be delivered.",
      applicant: summarizeApplicant(applicant),
      invitation: summarizeInvitation(result.invitation),
      emailResult: result.emailResult,
    });
  } catch (error) {
    console.error("Resend participant registration invitation error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send the participant registration invitation.",
      error: error.message,
    });
  }
}

module.exports = {
  getParticipantRegistrationForm,
  saveParticipantRegistrationSupportRequest,
  submitParticipantRegistration,
  resendParticipantRegistrationInvitation,
};
