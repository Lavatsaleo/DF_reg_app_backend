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

function validateRequiredQuestions(responses = []) {
  const missingQuestions = [];

  for (const question of registrationFormQuestions) {
    if (!question.required) continue;

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
      createdAt: true,
    },
  });
}

function calculateEligibility(responses = []) {
  const hasDisabilityAnswer = getAnswerValue(responses, "HAS_DISABILITY");
  const consentAnswer = getAnswerValue(responses, "REGISTRATION_CONSENT");

  const hasDisability = toBoolean(hasDisabilityAnswer);
  const hasConsent = toBoolean(consentAnswer);

  if (hasDisability !== true) {
    return {
      isEligible: false,
      reason:
        "Applicant is not eligible because they did not indicate that they have a disability.",
    };
  }

  if (hasConsent !== true) {
    return {
      isEligible: false,
      reason:
        "Applicant is not eligible because they did not provide consent for registration, review, and project follow-up.",
    };
  }

  return {
    isEligible: true,
    reason:
      "Applicant passed the initial eligibility criteria: disability status confirmed and consent provided.",
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
      response.questionCode === "HAS_DISABILITY" ||
      response.questionCode === "REGISTRATION_CONSENT"
        ? toBoolean(rawAnswer) === true
        : null,
  };
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
      return res.status(409).json({
        success: false,
        message:
          "This applicant appears to have already submitted an application. Please use the existing reference number to check the application status instead of re-applying.",
        duplicate: true,
        applicationReference: existingApplicant.applicationReference,
        participantCode: existingApplicant.participantCode,
        status: existingApplicant.status,
        submittedAt: existingApplicant.createdAt,
        data: {
          duplicate: true,
          applicationReference: existingApplicant.applicationReference,
          participantCode: existingApplicant.participantCode,
          status: existingApplicant.status,
          submittedAt: existingApplicant.createdAt,
        },
      });
    }

    const eligibilityResult = calculateEligibility(parsedResponses);

    const registrationMode = normalizeRegistrationMode(
      req.body.registrationMode
    );

    const pathway = normalizePathway(req.body.pathway);

    const finalStatus = eligibilityResult.isEligible
      ? "ELIGIBLE_PENDING_SKILLS_TEST"
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

          yearOfBirth: getAnswerValue(parsedResponses, "YEAR_OF_BIRTH")
            ? Number(getAnswerValue(parsedResponses, "YEAR_OF_BIRTH"))
            : null,

          approximateAge: getAnswerValue(parsedResponses, "APPROXIMATE_AGE")
            ? Number(getAnswerValue(parsedResponses, "APPROXIMATE_AGE"))
            : null,

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

          hasDisability:
            toBoolean(getAnswerValue(parsedResponses, "HAS_DISABILITY")) || false,

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

          isEligible: eligibilityResult.isEligible,
          eligibilityReason: eligibilityResult.reason,
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

    return res.status(201).json({
      success: true,
      message: "Registration submitted successfully.",

      // Existing response fields kept so the current frontend does not break.
      applicantId: applicant.id,
      pathway: applicant.pathway,
      registrationMode: applicant.registrationMode,
      isEligible: applicant.isEligible,
      status: applicant.status,
      eligibilityReason: applicant.eligibilityReason,
      documentsUploaded: uploadedDocuments.length,
      requiresBasicSkillsTest: applicant.isEligible,
      skillsTestUrl: null,
      skillsTestInviteUrl: testInvitationData?.invitationUrl || null,
      testInvitationEmailSent: Boolean(testInvitationEmailResult?.sent),
      testInvitationEmailStatus: testInvitationEmailResult?.status || null,
      nextStepMessage: applicant.isEligible
        ? "You passed the initial eligibility check. A Basic IT skills test invitation link has been sent to your email address. Complete the test so the committee can review your full application."
        : "Your registration was received and will remain in the system for project records.",

      // New tracking fields.
      personUid: applicant.id,
      participantCode: applicant.participantCode,
      applicationReference: applicant.applicationReference,
      submittedAt: applicant.createdAt,

      data: {
        applicantId: applicant.id,
        personUid: applicant.id,
        participantCode: applicant.participantCode,
        applicationReference: applicant.applicationReference,
        pathway: applicant.pathway,
        registrationMode: applicant.registrationMode,
        isEligible: applicant.isEligible,
        status: applicant.status,
        eligibilityReason: applicant.eligibilityReason,
        documentsUploaded: uploadedDocuments.length,
        requiresBasicSkillsTest: applicant.isEligible,
        skillsTestUrl: null,
        skillsTestInviteUrl: testInvitationData?.invitationUrl || null,
        testInvitationEmailSent: Boolean(testInvitationEmailResult?.sent),
        testInvitationEmailStatus: testInvitationEmailResult?.status || null,
        nextStepMessage: applicant.isEligible
          ? "You passed the initial eligibility check. A Basic IT skills test invitation link has been sent to your email address. Complete the test so the committee can review your full application."
          : "Your registration was received and will remain in the system for project records.",
        submittedAt: applicant.createdAt,
      },
    });
  } catch (error) {
    console.error("Registration submission error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message:
          "This applicant appears to have already submitted an application. Please check your existing application status instead of re-applying.",
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
    const reference = String(req.params.reference || "")
      .trim()
      .toUpperCase();

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Application reference is required.",
      });
    }

    const applicant = await prisma.applicant.findUnique({
      where: {
        applicationReference: reference,
      },
      include: {
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
      },
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "No application was found with that reference number.",
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
        submittedAt: applicant.createdAt,
        lastUpdatedAt: applicant.updatedAt,
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

async function getRegistrationFormQuestions(req, res) {
  return res.json({
    formName: "Registration Form - phy & virt",
    formVersion: "1.0",
    questions: registrationFormQuestions,
  });
}

module.exports = {
  submitRegistration,
  getApplicants,
  getApplicantById,
  getRegistrationStatus,
  getRegistrationFormQuestions,
};