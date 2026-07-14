const express = require("express");
const {
  listCommitteeMembers,
  createCommitteeMember,
  createCommitteeMemberLogin,
  updateCommitteeMember,
  getCommitteeOverview,
  listCommitteeAssignments,
  listUnassignedReadyApplicants,
  autoAssignReadyApplicants,
  assignSingleApplicant,
  reassignApplicant,
  startReview,
  submitCommitteeReview,
  listSelectedParticipantsReport,
} = require("../controllers/committee.controller");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/overview", getCommitteeOverview);
router.get("/members", listCommitteeMembers);
router.post("/members", requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON"), createCommitteeMember);
router.patch("/members/:memberId", requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON"), updateCommitteeMember);
router.post("/members/:memberId/login", requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON"), createCommitteeMemberLogin);

router.get("/assignments", listCommitteeAssignments);
router.get("/selected-report", requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON"), listSelectedParticipantsReport);
router.get("/unassigned-ready", requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON", "VIEWER"), listUnassignedReadyApplicants);
router.post("/auto-assign", requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON"), autoAssignReadyApplicants);
router.post("/applicants/:applicantId/assign", requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON"), assignSingleApplicant);
router.patch("/assignments/:assignmentId/reassign", requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON"), reassignApplicant);
router.patch("/assignments/:assignmentId/start", requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON", "COMMITTEE_MEMBER"), startReview);
router.post("/assignments/:assignmentId/review", requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON", "COMMITTEE_MEMBER"), submitCommitteeReview);

module.exports = router;
