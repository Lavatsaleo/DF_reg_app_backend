const prisma = require("../config/prisma");
const {
  BASIC_SKILLS_TEST_PASSING_PERCENTAGE,
  BASIC_SKILLS_TEST_VERSION,
  basicSkillsTestQuestions,
  getPublicBasicSkillsTestQuestions,
} = require("../data/basicSkillsTestQuestions");
const { hashToken } = require("../utils/tokenUtils");
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
    answers: attempt.answers || undefined,
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
    totalQuestions: basicSkillsTestQuestions.length,
    maxScore: basicSkillsTestQuestions.reduce(
      (sum, question) => sum + Number(question.points || 1),
      0
    ),
    passingPercentage: BASIC_SKILLS_TEST_PASSING_PERCENTAGE,
    testVersion: BASIC_SKILLS_TEST_VERSION,
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

    const previousAttempt = applicant.skillsTestAttempts[0] || null;

    return res.json({
      success: true,
      alreadySubmitted: Boolean(previousAttempt),
      accessMode: "reference",
      applicant: buildApplicantSummary(applicant),
      invitation: summarizeInvitation(applicant.skillsTestInvitations?.[0]),
      test: getTestMetadata(previousAttempt ? [] : getPublicBasicSkillsTestQuestions()),
      attempt: summarizeAttempt(previousAttempt),
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
    const previousAttempt = applicant.skillsTestAttempts[0] || null;

    if (!previousAttempt && !invitation.openedAt && ["PENDING", "SENT", "EMAIL_FAILED"].includes(invitation.status)) {
      invitation = await prisma.basicSkillsTestInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "OPENED",
          openedAt: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      alreadySubmitted: Boolean(previousAttempt),
      accessMode: "invitation-token",
      applicant: buildApplicantSummary(applicant),
      invitation: summarizeInvitation(invitation),
      test: getTestMetadata(previousAttempt ? [] : getPublicBasicSkillsTestQuestions()),
      attempt: summarizeAttempt(previousAttempt),
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

function calculateResult(submittedAnswers) {
  const answerLookup = new Map(
    normalizeSubmittedAnswers(submittedAnswers).map((item) => [
      item.questionCode,
      String(item.answer || "").trim(),
    ])
  );

  const maxScore = basicSkillsTestQuestions.reduce(
    (sum, question) => sum + Number(question.points || 1),
    0
  );

  const answerRecords = basicSkillsTestQuestions.map((question) => {
    const selectedAnswer = answerLookup.get(question.questionCode) || "";
    const isCorrect = selectedAnswer === question.correctAnswer;
    const pointsPossible = Number(question.points || 1);
    const pointsAwarded = isCorrect ? pointsPossible : 0;

    return {
      questionCode: question.questionCode,
      questionText: question.questionText,
      category: question.category,
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      pointsAwarded,
      pointsPossible,
    };
  });

  const score = answerRecords.reduce(
    (sum, answer) => sum + answer.pointsAwarded,
    0
  );

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  const passed = percentage >= BASIC_SKILLS_TEST_PASSING_PERCENTAGE;

  return {
    score,
    maxScore,
    percentage,
    passed,
    answerRecords,
  };
}

function validateAllQuestionsAnswered(submittedAnswers) {
  const answerLookup = new Map(
    normalizeSubmittedAnswers(submittedAnswers).map((item) => [
      item.questionCode,
      String(item.answer || "").trim(),
    ])
  );

  return basicSkillsTestQuestions
    .filter((question) => !answerLookup.get(question.questionCode))
    .map((question) => ({
      questionCode: question.questionCode,
      questionText: question.questionText,
    }));
}

async function createSubmittedAttempt({ applicant, invitation, submittedAnswers, durationSeconds }) {
  const previousAttempt = applicant.skillsTestAttempts[0] || null;

  if (previousAttempt) {
    return {
      duplicate: true,
      attempt: previousAttempt,
      nextStatus: applicant.status,
    };
  }

  const result = calculateResult(submittedAnswers);
  const nextStatus = REVIEW_TERMINAL_STATUSES.includes(applicant.status)
    ? applicant.status
    : "SKILLS_TEST_COMPLETED_PENDING_REVIEW";

  const transactionResult = await prisma.$transaction(async (tx) => {
    const attempt = await tx.basicSkillsTestAttempt.create({
      data: {
        applicantId: applicant.id,
        invitationId: invitation?.id || null,
        attemptNumber: 1,
        status: "SUBMITTED",
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        passed: result.passed,
        passingPercentage: BASIC_SKILLS_TEST_PASSING_PERCENTAGE,
        durationSeconds,
        testVersion: BASIC_SKILLS_TEST_VERSION,
        answers: {
          create: result.answerRecords,
        },
      },
      include: {
        answers: {
          orderBy: {
            questionCode: "asc",
          },
        },
        invitation: true,
      },
    });

    if (invitation) {
      await tx.basicSkillsTestInvitation.update({
        where: { id: invitation.id },
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

    return { attempt, assignment };
  });

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

    const missingAnswers = validateAllQuestionsAnswered(submittedAnswers);

    if (missingAnswers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please answer all Basic IT skills test questions before submitting.",
        missingAnswers,
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

    const missingAnswers = validateAllQuestionsAnswered(submittedAnswers);

    if (missingAnswers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please answer all Basic IT skills test questions before submitting.",
        missingAnswers,
      });
    }

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

    if (applicant.skillsTestAttempts[0]) {
      return res.status(409).json({
        success: false,
        message: "This applicant has already submitted the Basic IT skills test.",
        attempt: summarizeAttempt(applicant.skillsTestAttempts[0]),
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
