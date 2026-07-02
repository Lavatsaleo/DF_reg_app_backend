const prisma = require("../config/prisma");
const {
  BASIC_SKILLS_TEST_PASSING_PERCENTAGE,
  BASIC_SKILLS_TEST_VERSION,
} = require("../data/basicSkillsTestQuestions");
const { hashToken } = require("../utils/tokenUtils");
const {
  calculateAttemptResult,
  getOrCreateInProgressAttempt,
  toPublicQuestion,
  validateAttemptAnswers,
} = require("../services/basicSkillsQuestionBank.service");
const {
  createAndSendBasicSkillsTestInvitation,
} = require("../services/basicSkillsTestInvitation.service");
const {
  assignApplicantToLeastLoadedMember,
} = require("../services/committeeAssignment.service");

const REVIEW_TERMINAL_STATUSES = [
  "APPROVED_FOR_ENROLLMENT",
  "REJECTED_BY_REVIEW_COMMITTEE",
  "ENROLLED_IN_DHIS2_PROGRAM",
];

function normalizeReference(value) {
  return String(value || "").trim().toUpperCase();
}

function getAttemptInclude() {
  return {
    answers: {
      orderBy: {
        questionCode: "asc",
      },
    },
    invitation: true,
    selectedQuestions: {
      orderBy: {
        questionNumber: "asc",
      },
    },
  };
}

function findSubmittedAttempt(applicant) {
  if (!Array.isArray(applicant?.skillsTestAttempts)) return null;

  return (
    applicant.skillsTestAttempts.find((attempt) => attempt.status === "SUBMITTED") ||
    null
  );
}

function summarizeAttempt(attempt) {
  if (!attempt) return null;

  return {
    id: attempt.id,
    invitationId: attempt.invitationId || null,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage,
    passed: attempt.passed,
    passingPercentage: attempt.passingPercentage,
    submittedAt: attempt.submittedAt,
    durationSeconds: attempt.durationSeconds,
    testVersion: attempt.testVersion || BASIC_SKILLS_TEST_VERSION,
  };
}

function summarizeInvitation(invitation) {
  if (!invitation) return null;

  return {
    id: invitation.id,
    status: invitation.status,
    emailTo: invitation.emailTo,
    sentAt: invitation.sentAt,
    openedAt: invitation.openedAt,
    usedAt: invitation.usedAt,
    expiresAt: invitation.expiresAt,
  };
}

function buildApplicantSummary(applicant) {
  return {
    applicantId: applicant.id,
    applicationReference: applicant.applicationReference,
    participantCode: applicant.participantCode,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    pathway: applicant.pathway,
    registrationMode: applicant.registrationMode,
    status: applicant.status,
    isEligible: applicant.isEligible,
  };
}

function getTestMetadata(questions) {
  return {
    title: "Basic IT Skills Test",
    instructions:
      "Answer each question once. The result will be attached to your registration record for committee review.",
    totalQuestions: questions.length,
    maxScore: questions.reduce(
      (sum, question) => sum + Number(question.points || 1),
      0
    ),
    passingPercentage: BASIC_SKILLS_TEST_PASSING_PERCENTAGE,
    testVersion: BASIC_SKILLS_TEST_VERSION,
    randomizationMode: "balanced-question-bank",
    questions,
  };
}

function validateApplicantCanTakeTest(applicant) {
  if (!applicant) {
    return {
      allowed: false,
      statusCode: 404,
      message: "No application was found with that reference number.",
    };
  }

  if (applicant.isEligible !== true || applicant.status === "INELIGIBLE") {
    return {
      allowed: false,
      statusCode: 403,
      message:
        "The basic IT skills test is only available after an applicant has passed the initial eligibility check.",
    };
  }

  return { allowed: true };
}

async function findApplicantForSkillsTest(reference) {
  return prisma.applicant.findUnique({
    where: {
      applicationReference: normalizeReference(reference),
    },
    include: {
      skillsTestAttempts: {
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        include: getAttemptInclude(),
      },
      skillsTestInvitations: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

async function findInvitationForToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token) return null;

  return prisma.basicSkillsTestInvitation.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      applicant: {
        include: {
          skillsTestAttempts: {
            orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
            include: getAttemptInclude(),
          },
        },
      },
    },
  });
}

async function markInvitationExpired(invitation) {
  if (!invitation || invitation.status === "EXPIRED") return invitation;

  return prisma.basicSkillsTestInvitation.update({
    where: { id: invitation.id },
    data: { status: "EXPIRED" },
    include: {
      applicant: {
        include: {
          skillsTestAttempts: {
            orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
            include: getAttemptInclude(),
          },
        },
      },
    },
  });
}

async function validateInvitationToken(rawToken) {
  const invitation = await findInvitationForToken(rawToken);

  if (!invitation) {
    return {
      allowed: false,
      statusCode: 404,
      message: "This Basic IT skills test invitation link is invalid.",
    };
  }

  const applicantCheck = validateApplicantCanTakeTest(invitation.applicant);
  if (!applicantCheck.allowed) return applicantCheck;

  if (invitation.status === "CANCELLED") {
    return {
      allowed: false,
      statusCode: 403,
      message: "This Basic IT skills test invitation link has been cancelled.",
      invitation,
    };
  }

  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    const expiredInvitation = await markInvitationExpired(invitation);
    return {
      allowed: false,
      statusCode: 410,
      message: "This Basic IT skills test invitation link has expired. Please contact the project team for a new link.",
      invitation: expiredInvitation,
    };
  }

  return {
    allowed: true,
    invitation,
    applicant: invitation.applicant,
  };
}

async function prepareQuestionBankAttempt({ applicant, invitation = null }) {
  const submittedAttempt = findSubmittedAttempt(applicant);

  if (submittedAttempt) {
    return {
      alreadySubmitted: true,
      test: getTestMetadata([]),
      attempt: submittedAttempt,
    };
  }

  const preparedAttempt = await getOrCreateInProgressAttempt({
    applicantId: applicant.id,
    invitationId: invitation?.id || null,
  });

  if (preparedAttempt.alreadySubmitted) {
    return {
      alreadySubmitted: true,
      test: getTestMetadata([]),
      attempt: preparedAttempt.attempt,
    };
  }

  const publicQuestions = preparedAttempt.attempt.selectedQuestions.map(toPublicQuestion);

  return {
    alreadySubmitted: false,
    test: getTestMetadata(publicQuestions),
    attempt: preparedAttempt.attempt,
  };
}

async function getBasicSkillsTestQuestions(req, res) {
  try {
    const reference = normalizeReference(req.params.reference);

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Application reference is required.",
      });
    }

    const applicant = await findApplicantForSkillsTest(reference);
    const accessCheck = validateApplicantCanTakeTest(applicant);

    if (!accessCheck.allowed) {
      return res.status(accessCheck.statusCode).json({
        success: false,
        message: accessCheck.message,
      });
    }

    const preparedTest = await prepareQuestionBankAttempt({ applicant });

    return res.json({
      success: true,
      alreadySubmitted: preparedTest.alreadySubmitted,
      accessMode: "reference",
      applicant: buildApplicantSummary(applicant),
      invitation: summarizeInvitation(applicant.skillsTestInvitations?.[0]),
      test: preparedTest.alreadySubmitted ? getTestMetadata([]) : preparedTest.test,
      attempt: preparedTest.alreadySubmitted ? summarizeAttempt(preparedTest.attempt) : null,
      message:
        "For production use, applicants should open the Basic IT skills test using the private email invitation link.",
    });
  } catch (error) {
    console.error("Get basic skills test questions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load the basic IT skills test.",
      error: error.message,
    });
  }
}

async function getInvitationBasicSkillsTestQuestions(req, res) {
  try {
    const token = req.params.token;
    const tokenCheck = await validateInvitationToken(token);

    if (!tokenCheck.allowed) {
      return res.status(tokenCheck.statusCode).json({
        success: false,
        message: tokenCheck.message,
        invitation: summarizeInvitation(tokenCheck.invitation),
      });
    }

    let invitation = tokenCheck.invitation;
    const applicant = tokenCheck.applicant;
    const submittedAttempt = findSubmittedAttempt(applicant);

    if (!submittedAttempt && !invitation.openedAt && ["PENDING", "SENT", "EMAIL_FAILED"].includes(invitation.status)) {
      invitation = await prisma.basicSkillsTestInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "OPENED",
          openedAt: new Date(),
        },
      });
    }

    const preparedTest = await prepareQuestionBankAttempt({ applicant, invitation });

    return res.json({
      success: true,
      alreadySubmitted: preparedTest.alreadySubmitted,
      accessMode: "invitation-token",
      applicant: buildApplicantSummary(applicant),
      invitation: summarizeInvitation(invitation),
      test: preparedTest.alreadySubmitted ? getTestMetadata([]) : preparedTest.test,
      attempt: preparedTest.alreadySubmitted ? summarizeAttempt(preparedTest.attempt) : null,
    });
  } catch (error) {
    console.error("Get invitation basic skills test questions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load the Basic IT skills test invitation.",
      error: error.message,
    });
  }
}

async function createSubmittedAttempt({ applicant, invitation, submittedAnswers, durationSeconds }) {
  const preparedAttempt = await getOrCreateInProgressAttempt({
    applicantId: applicant.id,
    invitationId: invitation?.id || null,
  });

  if (preparedAttempt.alreadySubmitted) {
    return {
      duplicate: true,
      attempt: preparedAttempt.attempt,
      nextStatus: applicant.status,
    };
  }

  const attempt = preparedAttempt.attempt;
  const selectedQuestions = attempt.selectedQuestions || [];
  const validation = validateAttemptAnswers(selectedQuestions, submittedAnswers);

  if (!validation.valid) {
    return {
      validationError: true,
      missingAnswers: validation.missingAnswers,
      unknownAnswers: validation.unknownAnswers,
    };
  }

  const result = calculateAttemptResult(selectedQuestions, submittedAnswers);
  const passed = result.percentage >= BASIC_SKILLS_TEST_PASSING_PERCENTAGE;
  const nextStatus = REVIEW_TERMINAL_STATUSES.includes(applicant.status)
    ? applicant.status
    : "SKILLS_TEST_COMPLETED_PENDING_REVIEW";

  const transactionResult = await prisma.$transaction(async (tx) => {
    const currentAttempt = await tx.basicSkillsTestAttempt.findUnique({
      where: { id: attempt.id },
      include: getAttemptInclude(),
    });

    if (!currentAttempt || currentAttempt.status === "SUBMITTED") {
      return {
        duplicate: true,
        attempt: currentAttempt,
        assignment: null,
      };
    }

    await tx.basicSkillsTestAnswer.deleteMany({
      where: { attemptId: attempt.id },
    });

    const updatedAttempt = await tx.basicSkillsTestAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "SUBMITTED",
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        passed,
        passingPercentage: BASIC_SKILLS_TEST_PASSING_PERCENTAGE,
        durationSeconds,
        submittedAt: new Date(),
        testVersion: BASIC_SKILLS_TEST_VERSION,
        answers: {
          create: result.answerRecords,
        },
      },
      include: getAttemptInclude(),
    });

    const invitationId = invitation?.id || updatedAttempt.invitationId;
    if (invitationId) {
      await tx.basicSkillsTestInvitation.update({
        where: { id: invitationId },
        data: {
          status: "USED",
          usedAt: new Date(),
        },
      });
    }

    if (nextStatus !== applicant.status) {
      await tx.applicant.update({
        where: { id: applicant.id },
        data: { status: nextStatus },
      });

      await tx.applicantStatusHistory.create({
        data: {
          applicantId: applicant.id,
          status: nextStatus,
          note: `Basic IT skills test completed. Score: ${result.score}/${result.maxScore} (${result.percentage}%).`,
        },
      });
    }

    const assignment = nextStatus === "SKILLS_TEST_COMPLETED_PENDING_REVIEW"
      ? await assignApplicantToLeastLoadedMember({
          applicantId: applicant.id,
          tx,
          assignedByType: "SYSTEM",
          reason: "Automatically assigned after Basic IT skills test completion.",
        })
      : null;

    return { attempt: updatedAttempt, assignment, duplicate: false };
  });

  if (transactionResult.duplicate) {
    return {
      duplicate: true,
      attempt: transactionResult.attempt,
      nextStatus: applicant.status,
    };
  }

  return {
    duplicate: false,
    attempt: transactionResult.attempt,
    assignment: transactionResult.assignment,
    nextStatus,
  };
}

async function submitBasicSkillsTest(req, res) {
  try {
    const reference = normalizeReference(req.params.reference);
    const submittedAnswers = req.body.answers;
    const durationSeconds = req.body.durationSeconds
      ? Number(req.body.durationSeconds)
      : null;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Application reference is required.",
      });
    }

    const applicant = await findApplicantForSkillsTest(reference);
    const accessCheck = validateApplicantCanTakeTest(applicant);

    if (!accessCheck.allowed) {
      return res.status(accessCheck.statusCode).json({
        success: false,
        message: accessCheck.message,
      });
    }

    const result = await createSubmittedAttempt({
      applicant,
      invitation: null,
      submittedAnswers,
      durationSeconds,
    });

    if (result.validationError) {
      return res.status(400).json({
        success: false,
        message: "Please answer all Basic IT skills test questions before submitting.",
        missingAnswers: result.missingAnswers,
        unknownAnswers: result.unknownAnswers,
      });
    }

    if (result.duplicate) {
      return res.status(409).json({
        success: false,
        message:
          "A Basic IT skills test has already been submitted for this application reference.",
        attempt: summarizeAttempt(result.attempt),
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "Basic IT skills test submitted successfully. Your application is now ready for committee review.",
      applicant: {
        ...buildApplicantSummary(applicant),
        status: result.nextStatus,
      },
      committeeAssignment: result.assignment
        ? {
            id: result.assignment.id,
            status: result.assignment.status,
            committeeMember: result.assignment.committeeMember
              ? {
                  id: result.assignment.committeeMember.id,
                  fullName: result.assignment.committeeMember.fullName,
                  email: result.assignment.committeeMember.email,
                }
              : null,
          }
        : null,
      attempt: summarizeAttempt(result.attempt),
    });
  } catch (error) {
    console.error("Submit basic skills test error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit the Basic IT skills test.",
      error: error.message,
    });
  }
}

async function submitInvitationBasicSkillsTest(req, res) {
  try {
    const token = req.params.token;
    const submittedAnswers = req.body.answers;
    const durationSeconds = req.body.durationSeconds
      ? Number(req.body.durationSeconds)
      : null;

    const tokenCheck = await validateInvitationToken(token);

    if (!tokenCheck.allowed) {
      return res.status(tokenCheck.statusCode).json({
        success: false,
        message: tokenCheck.message,
        invitation: summarizeInvitation(tokenCheck.invitation),
      });
    }

    const result = await createSubmittedAttempt({
      applicant: tokenCheck.applicant,
      invitation: tokenCheck.invitation,
      submittedAnswers,
      durationSeconds,
    });

    if (result.validationError) {
      return res.status(400).json({
        success: false,
        message: "Please answer all Basic IT skills test questions before submitting.",
        missingAnswers: result.missingAnswers,
        unknownAnswers: result.unknownAnswers,
      });
    }

    if (result.duplicate) {
      return res.status(409).json({
        success: false,
        message:
          "A Basic IT skills test has already been submitted for this applicant.",
        attempt: summarizeAttempt(result.attempt),
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "Basic IT skills test submitted successfully. Your application is now ready for committee review.",
      applicant: {
        ...buildApplicantSummary(tokenCheck.applicant),
        status: result.nextStatus,
      },
      invitation: summarizeInvitation({
        ...tokenCheck.invitation,
        status: "USED",
        usedAt: new Date(),
      }),
      attempt: summarizeAttempt(result.attempt),
    });
  } catch (error) {
    console.error("Submit invitation basic skills test error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit the Basic IT skills test.",
      error: error.message,
    });
  }
}

async function sendBasicSkillsTestInvitationForApplicant(req, res) {
  try {
    const reference = normalizeReference(req.params.reference);

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Application reference is required.",
      });
    }

    const applicant = await findApplicantForSkillsTest(reference);
    const accessCheck = validateApplicantCanTakeTest(applicant);

    if (!accessCheck.allowed) {
      return res.status(accessCheck.statusCode).json({
        success: false,
        message: accessCheck.message,
      });
    }

    const submittedAttempt = findSubmittedAttempt(applicant);
    if (submittedAttempt) {
      return res.status(409).json({
        success: false,
        message: "This applicant has already submitted the Basic IT skills test.",
        attempt: summarizeAttempt(submittedAttempt),
      });
    }

    const invitationResult = await createAndSendBasicSkillsTestInvitation(applicant);

    return res.status(201).json({
      success: true,
      message: invitationResult.emailResult?.sent
        ? "Basic IT skills test invitation email sent successfully."
        : "Basic IT skills test invitation created. Email was not sent because SMTP is not configured or failed.",
      applicant: buildApplicantSummary(applicant),
      invitation: summarizeInvitation(invitationResult.invitation),
      invitationUrl: invitationResult.invitationUrl,
      emailResult: invitationResult.emailResult,
    });
  } catch (error) {
    console.error("Send Basic IT skills test invitation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create or send the Basic IT skills test invitation.",
      error: error.message,
    });
  }
}

module.exports = {
  getBasicSkillsTestQuestions,
  getInvitationBasicSkillsTestQuestions,
  sendBasicSkillsTestInvitationForApplicant,
  submitBasicSkillsTest,
  submitInvitationBasicSkillsTest,
};
