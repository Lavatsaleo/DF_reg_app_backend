const prisma = require("../config/prisma");

const READY_FOR_COMMITTEE_STATUS = "SKILLS_TEST_COMPLETED_PENDING_REVIEW";
const PENDING_ASSIGNMENT_STATUSES = ["ASSIGNED", "IN_REVIEW"];

function getDbClient(tx) {
  return tx || prisma;
}

function normalizeCommitteeRole(value) {
  const role = String(value || "MEMBER").trim().toUpperCase();
  return role === "CHAIRPERSON" ? "CHAIRPERSON" : "MEMBER";
}

function normalizeAssignmentStatus(value) {
  const status = String(value || "ASSIGNED").trim().toUpperCase();
  const allowed = ["ASSIGNED", "IN_REVIEW", "COMPLETED", "REASSIGNED"];
  return allowed.includes(status) ? status : "ASSIGNED";
}

async function getActiveReviewMembers(db = prisma) {
  return db.committeeMember.findMany({
    where: {
      isActive: true,
      role: "MEMBER",
    },
    orderBy: [
      { createdAt: "asc" },
      { fullName: "asc" },
    ],
  });
}

async function buildWorkloadMap(db, memberIds) {
  if (!memberIds.length) return new Map();

  const grouped = await db.committeeAssignment.groupBy({
    by: ["committeeMemberId"],
    where: {
      committeeMemberId: { in: memberIds },
      status: { in: PENDING_ASSIGNMENT_STATUSES },
    },
    _count: {
      committeeMemberId: true,
    },
  });

  return new Map(
    grouped.map((item) => [item.committeeMemberId, item._count.committeeMemberId])
  );
}

async function selectLeastLoadedMember(db = prisma) {
  const members = await getActiveReviewMembers(db);
  if (!members.length) return null;

  const workloadMap = await buildWorkloadMap(
    db,
    members.map((member) => member.id)
  );

  return members
    .map((member) => ({
      ...member,
      pendingAssignments: workloadMap.get(member.id) || 0,
    }))
    .sort((a, b) => {
      if (a.pendingAssignments !== b.pendingAssignments) {
        return a.pendingAssignments - b.pendingAssignments;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })[0];
}

async function assignApplicantToLeastLoadedMember({
  applicantId,
  tx,
  assignedByType = "SYSTEM",
  assignedByMemberId = null,
  reason = "Automatically assigned after Basic IT skills test completion.",
} = {}) {
  if (!applicantId) return null;

  const db = getDbClient(tx);

  const existingAssignment = await db.committeeAssignment.findUnique({
    where: { applicantId },
    include: { committeeMember: true },
  });

  if (existingAssignment) return existingAssignment;

  const member = await selectLeastLoadedMember(db);
  if (!member) return null;

  const assignment = await db.committeeAssignment.create({
    data: {
      applicantId,
      committeeMemberId: member.id,
      assignedByType,
      assignedByMemberId,
      status: "ASSIGNED",
      history: {
        create: {
          applicantId,
          toCommitteeMemberId: member.id,
          changedByMemberId: assignedByMemberId || null,
          changeType: assignedByType === "SYSTEM" ? "AUTO_ASSIGNED" : "ASSIGNED",
          reason,
        },
      },
    },
    include: {
      committeeMember: true,
      assignedByMember: true,
      applicant: true,
    },
  });

  return assignment;
}

async function assignReadyApplicants({ tx } = {}) {
  const db = getDbClient(tx);

  const applicants = await db.applicant.findMany({
    where: {
      status: READY_FOR_COMMITTEE_STATUS,
      committeeAssignments: {
        none: {},
      },
    },
    orderBy: {
      updatedAt: "asc",
    },
  });

  const results = [];

  for (const applicant of applicants) {
    const assignment = await assignApplicantToLeastLoadedMember({
      applicantId: applicant.id,
      tx: db,
      assignedByType: "SYSTEM",
      reason: "Bulk automatic assignment from committee chairperson dashboard.",
    });

    results.push({
      applicantId: applicant.id,
      assigned: Boolean(assignment),
      assignment,
    });
  }

  return results;
}

module.exports = {
  READY_FOR_COMMITTEE_STATUS,
  PENDING_ASSIGNMENT_STATUSES,
  assignApplicantToLeastLoadedMember,
  assignReadyApplicants,
  normalizeCommitteeRole,
  normalizeAssignmentStatus,
};
