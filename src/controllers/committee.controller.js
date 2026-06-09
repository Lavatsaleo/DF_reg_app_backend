const prisma = require("../config/prisma");
const {
  READY_FOR_COMMITTEE_STATUS,
  PENDING_ASSIGNMENT_STATUSES,
  assignApplicantToLeastLoadedMember,
  assignReadyApplicants,
  normalizeCommitteeRole,
  normalizeAssignmentStatus,
} = require("../services/committeeAssignment.service");
const { normalizeEmail, normalizeContactNumber } = require("../utils/normalizers");

const REVIEW_DECISION_LABELS = {
  SELECTED: "Selected",
  NOT_SELECTED: "Not selected",
  WAITLISTED: "Waitlisted",
  PENDING_VERIFICATION: "Pending additional verification",
};

const DECISION_TO_APPLICANT_STATUS = {
  SELECTED: "APPROVED_FOR_ENROLLMENT",
  NOT_SELECTED: "REJECTED_BY_REVIEW_COMMITTEE",
  WAITLISTED: "UNDER_REVIEW",
  PENDING_VERIFICATION: "UNDER_REVIEW",
};

function toSafeString(value) {
  return String(value || "").trim();
}

function normalizeDecision(value) {
  const decision = toSafeString(value).toUpperCase().replace(/[\s-]+/g, "_");
  if (Object.prototype.hasOwnProperty.call(REVIEW_DECISION_LABELS, decision)) {
    return decision;
  }
  return null;
}

function formatApplicantName(applicant) {
  return [applicant?.firstName, applicant?.lastName].filter(Boolean).join(" ").trim();
}

function summarizeMember(member, workload = {}) {
  if (!member) return null;

  return {
    id: member.id,
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    role: member.role,
    isActive: member.isActive,
    notes: member.notes,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    workload: {
      pending: workload.pending || 0,
      completed: workload.completed || 0,
      total: workload.total || 0,
    },
  };
}

function summarizeSkillsTest(applicant) {
  const attempt = applicant?.skillsTestAttempts?.[0];
  if (!attempt) return null;

  return {
    id: attempt.id,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage,
    passed: attempt.passed,
    passingPercentage: attempt.passingPercentage,
    submittedAt: attempt.submittedAt,
    testVersion: attempt.testVersion,
  };
}

function summarizeApplicant(applicant) {
  if (!applicant) return null;

  return {
    id: applicant.id,
    fullName: formatApplicantName(applicant),
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    email: applicant.email,
    contactNumber: applicant.contactNumber,
    participantCode: applicant.participantCode,
    applicationReference: applicant.applicationReference,
    pathway: applicant.pathway,
    country: applicant.country,
    county: applicant.county,
    town: applicant.town,
    sex: applicant.sex,
    ageAtApplication: applicant.ageAtApplication,
    educationLevel: applicant.educationLevel,
    employmentStatus: applicant.employmentStatus,
    hasDisability: applicant.hasDisability,
    disabilityType: applicant.disabilityType,
    screeningStatus: applicant.screeningStatus,
    status: applicant.status,
    createdAt: applicant.createdAt,
    updatedAt: applicant.updatedAt,
    skillsTest: summarizeSkillsTest(applicant),
  };
}

function summarizeAssignment(assignment) {
  if (!assignment) return null;

  return {
    id: assignment.id,
    status: assignment.status,
    assignedByType: assignment.assignedByType,
    assignedAt: assignment.assignedAt,
    startedAt: assignment.startedAt,
    completedAt: assignment.completedAt,
    updatedAt: assignment.updatedAt,
    applicant: summarizeApplicant(assignment.applicant),
    committeeMember: summarizeMember(assignment.committeeMember),
    assignedByMember: summarizeMember(assignment.assignedByMember),
    review: assignment.review
      ? {
          id: assignment.review.id,
          decision: assignment.review.decision,
          decisionLabel: REVIEW_DECISION_LABELS[assignment.review.decision] || assignment.review.decision,
          comments: assignment.review.comments,
          reviewedAt: assignment.review.reviewedAt,
        }
      : null,
    history: (assignment.history || []).map((item) => ({
      id: item.id,
      changeType: item.changeType,
      reason: item.reason,
      createdAt: item.createdAt,
      fromCommitteeMember: summarizeMember(item.fromCommitteeMember),
      toCommitteeMember: summarizeMember(item.toCommitteeMember),
      changedByMember: summarizeMember(item.changedByMember),
    })),
  };
}

async function getWorkloadByMemberId() {
  const grouped = await prisma.committeeAssignment.groupBy({
    by: ["committeeMemberId", "status"],
    _count: {
      status: true,
    },
  });

  const map = new Map();

  for (const item of grouped) {
    const current = map.get(item.committeeMemberId) || {
      pending: 0,
      completed: 0,
      total: 0,
    };

    const count = item._count.status;
    current.total += count;

    if (PENDING_ASSIGNMENT_STATUSES.includes(item.status)) {
      current.pending += count;
    }

    if (item.status === "COMPLETED") {
      current.completed += count;
    }

    map.set(item.committeeMemberId, current);
  }

  return map;
}

function getAssignmentInclude() {
  return {
    applicant: {
      include: {
        skillsTestAttempts: {
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
    },
    committeeMember: true,
    assignedByMember: true,
    review: true,
    history: {
      orderBy: { createdAt: "desc" },
      include: {
        fromCommitteeMember: true,
        toCommitteeMember: true,
        changedByMember: true,
      },
    },
  };
}

async function listCommitteeMembers(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    const workloadMap = await getWorkloadByMemberId();
    const members = await prisma.committeeMember.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    });

    return res.json({
      success: true,
      members: members.map((member) => summarizeMember(member, workloadMap.get(member.id))),
    });
  } catch (error) {
    console.error("List committee members error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load committee members.",
      error: error.message,
    });
  }
}

async function createCommitteeMember(req, res) {
  try {
    const fullName = toSafeString(req.body.fullName);
    const email = normalizeEmail(req.body.email);
    const phone = toSafeString(req.body.phone);
    const role = normalizeCommitteeRole(req.body.role);
    const notes = toSafeString(req.body.notes) || null;

    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "Committee member name and email are required.",
      });
    }

    const member = await prisma.committeeMember.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        role,
        isActive: req.body.isActive === undefined ? true : Boolean(req.body.isActive),
        notes,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Committee member added successfully.",
      member: summarizeMember(member),
    });
  } catch (error) {
    console.error("Create committee member error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A committee member with this email address already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add committee member.",
      error: error.message,
    });
  }
}

async function updateCommitteeMember(req, res) {
  try {
    const memberId = req.params.memberId;
    const data = {};

    if (req.body.fullName !== undefined) data.fullName = toSafeString(req.body.fullName);
    if (req.body.email !== undefined) data.email = normalizeEmail(req.body.email);
    if (req.body.phone !== undefined) data.phone = toSafeString(req.body.phone) || null;
    if (req.body.role !== undefined) data.role = normalizeCommitteeRole(req.body.role);
    if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
    if (req.body.notes !== undefined) data.notes = toSafeString(req.body.notes) || null;

    if (data.fullName === "" || data.email === "") {
      return res.status(400).json({
        success: false,
        message: "Committee member name and email cannot be blank.",
      });
    }

    const member = await prisma.committeeMember.update({
      where: { id: memberId },
      data,
    });

    return res.json({
      success: true,
      message: "Committee member updated successfully.",
      member: summarizeMember(member),
    });
  } catch (error) {
    console.error("Update committee member error:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Committee member not found.",
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Another committee member already uses this email address.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update committee member.",
      error: error.message,
    });
  }
}

async function getCommitteeOverview(req, res) {
  try {
    const [members, readyCount, unassignedReadyCount, assignmentCounts] = await Promise.all([
      prisma.committeeMember.findMany({ orderBy: [{ role: "asc" }, { fullName: "asc" }] }),
      prisma.applicant.count({ where: { status: READY_FOR_COMMITTEE_STATUS } }),
      prisma.applicant.count({
        where: {
          status: READY_FOR_COMMITTEE_STATUS,
          committeeAssignments: { none: {} },
        },
      }),
      prisma.committeeAssignment.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const byStatus = assignmentCounts.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    const workloadMap = await getWorkloadByMemberId();

    return res.json({
      success: true,
      overview: {
        activeMembers: members.filter((member) => member.isActive).length,
        allMembers: members.length,
        readyForReview: readyCount,
        unassignedReadyForReview: unassignedReadyCount,
        assignedPending: PENDING_ASSIGNMENT_STATUSES.reduce(
          (sum, status) => sum + (byStatus[status] || 0),
          0
        ),
        completedReviews: byStatus.COMPLETED || 0,
        byAssignmentStatus: byStatus,
      },
      members: members.map((member) => summarizeMember(member, workloadMap.get(member.id))),
    });
  } catch (error) {
    console.error("Committee overview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load committee overview.",
      error: error.message,
    });
  }
}

async function listCommitteeAssignments(req, res) {
  try {
    const status = req.query.status ? normalizeAssignmentStatus(req.query.status) : null;
    const memberId = toSafeString(req.query.memberId);
    const search = toSafeString(req.query.search).toLowerCase();

    const where = {};
    if (status) where.status = status;
    if (memberId) where.committeeMemberId = memberId;

    const assignments = await prisma.committeeAssignment.findMany({
      where,
      orderBy: [{ status: "asc" }, { assignedAt: "desc" }],
      include: getAssignmentInclude(),
      take: 200,
    });

    const filtered = search
      ? assignments.filter((assignment) => {
          const applicant = assignment.applicant || {};
          const searchText = [
            applicant.firstName,
            applicant.lastName,
            applicant.applicationReference,
            applicant.participantCode,
            applicant.contactNumber,
            applicant.email,
            assignment.committeeMember?.fullName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return searchText.includes(search);
        })
      : assignments;

    return res.json({
      success: true,
      assignments: filtered.map(summarizeAssignment),
    });
  } catch (error) {
    console.error("List committee assignments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load committee assignments.",
      error: error.message,
    });
  }
}

async function listUnassignedReadyApplicants(req, res) {
  try {
    const applicants = await prisma.applicant.findMany({
      where: {
        status: READY_FOR_COMMITTEE_STATUS,
        committeeAssignments: { none: {} },
      },
      orderBy: { updatedAt: "asc" },
      include: {
        skillsTestAttempts: {
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
      take: 200,
    });

    return res.json({
      success: true,
      applicants: applicants.map(summarizeApplicant),
    });
  } catch (error) {
    console.error("List unassigned ready applicants error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load unassigned applicants ready for review.",
      error: error.message,
    });
  }
}

async function autoAssignReadyApplicants(req, res) {
  try {
    const results = await assignReadyApplicants();
    const assigned = results.filter((result) => result.assigned).length;

    return res.status(201).json({
      success: true,
      message: assigned > 0
        ? `${assigned} applicant${assigned === 1 ? "" : "s"} assigned to committee members.`
        : "No applicants were assigned. Confirm there are active committee members and unassigned applicants ready for review.",
      assigned,
      totalChecked: results.length,
      results: results.map((result) => ({
        applicantId: result.applicantId,
        assigned: result.assigned,
        assignment: summarizeAssignment(result.assignment),
      })),
    });
  } catch (error) {
    console.error("Auto assign ready applicants error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to run automatic assignment.",
      error: error.message,
    });
  }
}

async function assignSingleApplicant(req, res) {
  try {
    const applicantId = req.params.applicantId;
    const assignment = await assignApplicantToLeastLoadedMember({
      applicantId,
      assignedByType: "SYSTEM",
      reason: "Manual system assignment triggered from committee dashboard.",
    });

    if (!assignment) {
      return res.status(409).json({
        success: false,
        message: "No active committee member is available for assignment.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Applicant assigned successfully.",
      assignment: summarizeAssignment(assignment),
    });
  } catch (error) {
    console.error("Assign single applicant error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign applicant.",
      error: error.message,
    });
  }
}

async function reassignApplicant(req, res) {
  try {
    const assignmentId = req.params.assignmentId;
    const toCommitteeMemberId = toSafeString(req.body.toCommitteeMemberId);
    const changedByMemberId = toSafeString(req.body.changedByMemberId) || null;
    const reason = toSafeString(req.body.reason) || "Reassigned by committee chairperson.";

    if (!toCommitteeMemberId) {
      return res.status(400).json({
        success: false,
        message: "Please select the committee member who should receive this applicant.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.committeeAssignment.findUnique({
        where: { id: assignmentId },
        include: getAssignmentInclude(),
      });

      if (!assignment) {
        const err = new Error("Committee assignment not found.");
        err.statusCode = 404;
        throw err;
      }

      const newMember = await tx.committeeMember.findUnique({ where: { id: toCommitteeMemberId } });
      if (!newMember || !newMember.isActive) {
        const err = new Error("Selected committee member is not active or does not exist.");
        err.statusCode = 400;
        throw err;
      }

      if (assignment.committeeMemberId === toCommitteeMemberId) {
        const err = new Error("This applicant is already assigned to the selected committee member.");
        err.statusCode = 409;
        throw err;
      }

      if (assignment.status === "COMPLETED") {
        const err = new Error("Completed reviews cannot be reassigned.");
        err.statusCode = 409;
        throw err;
      }

      const updated = await tx.committeeAssignment.update({
        where: { id: assignmentId },
        data: {
          committeeMemberId: toCommitteeMemberId,
          assignedByType: "CHAIRPERSON",
          assignedByMemberId: changedByMemberId,
          status: "ASSIGNED",
          assignedAt: new Date(),
          startedAt: null,
        },
        include: getAssignmentInclude(),
      });

      await tx.committeeAssignmentHistory.create({
        data: {
          assignmentId,
          applicantId: assignment.applicantId,
          fromCommitteeMemberId: assignment.committeeMemberId,
          toCommitteeMemberId,
          changedByMemberId,
          changeType: "REASSIGNED",
          reason,
        },
      });

      return updated;
    });

    return res.json({
      success: true,
      message: "Applicant reassigned successfully.",
      assignment: summarizeAssignment(result),
    });
  } catch (error) {
    console.error("Reassign applicant error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to reassign applicant.",
      error: error.statusCode ? undefined : error.message,
    });
  }
}

async function startReview(req, res) {
  try {
    const assignmentId = req.params.assignmentId;
    const assignment = await prisma.committeeAssignment.update({
      where: { id: assignmentId },
      data: {
        status: "IN_REVIEW",
        startedAt: new Date(),
      },
      include: getAssignmentInclude(),
    });

    return res.json({
      success: true,
      message: "Review started.",
      assignment: summarizeAssignment(assignment),
    });
  } catch (error) {
    console.error("Start review error:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Committee assignment not found.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to start review.",
      error: error.message,
    });
  }
}

async function submitCommitteeReview(req, res) {
  try {
    const assignmentId = req.params.assignmentId;
    const decision = normalizeDecision(req.body.decision);
    const comments = toSafeString(req.body.comments) || null;

    if (!decision) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid committee decision.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.committeeAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          applicant: true,
          review: true,
        },
      });

      if (!assignment) {
        const err = new Error("Committee assignment not found.");
        err.statusCode = 404;
        throw err;
      }

      if (assignment.review) {
        const err = new Error("A review decision has already been submitted for this assignment.");
        err.statusCode = 409;
        throw err;
      }

      const applicantStatus = DECISION_TO_APPLICANT_STATUS[decision] || "UNDER_REVIEW";
      const review = await tx.committeeReview.create({
        data: {
          assignmentId: assignment.id,
          applicantId: assignment.applicantId,
          committeeMemberId: assignment.committeeMemberId,
          decision,
          comments,
        },
      });

      await tx.committeeAssignment.update({
        where: { id: assignment.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      await tx.applicant.update({
        where: { id: assignment.applicantId },
        data: {
          status: applicantStatus,
          reviewDecision: decision === "SELECTED" ? "APPROVED" : decision === "NOT_SELECTED" ? "REJECTED" : "NEEDS_MORE_INFORMATION",
          reviewComments: comments,
          reviewedAt: new Date(),
          reviewedBy: assignment.committeeMemberId,
        },
      });

      await tx.applicantStatusHistory.create({
        data: {
          applicantId: assignment.applicantId,
          status: applicantStatus,
          note: `Committee decision recorded: ${REVIEW_DECISION_LABELS[decision] || decision}.`,
        },
      });

      return review;
    });

    const updatedAssignment = await prisma.committeeAssignment.findUnique({
      where: { id: assignmentId },
      include: getAssignmentInclude(),
    });

    return res.status(201).json({
      success: true,
      message: "Committee review decision saved successfully.",
      review: result,
      assignment: summarizeAssignment(updatedAssignment),
    });
  } catch (error) {
    console.error("Submit committee review error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to submit committee review.",
      error: error.statusCode ? undefined : error.message,
    });
  }
}

module.exports = {
  listCommitteeMembers,
  createCommitteeMember,
  updateCommitteeMember,
  getCommitteeOverview,
  listCommitteeAssignments,
  listUnassignedReadyApplicants,
  autoAssignReadyApplicants,
  assignSingleApplicant,
  reassignApplicant,
  startReview,
  submitCommitteeReview,
};
