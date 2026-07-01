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
} = require("../controllers/committee.controller");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/overview", getCommitteeOverview);
router.get("/members", listCommitteeMembers);
router.post("/members", requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON"), createCommitteeMember);
router.patch("/members/:memberId", requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON"), updateCommitteeMember);
router.post("/members/:memberId/login", requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON"), createCommitteeMemberLogin);

router.get("/assignments", listCommitteeAssignments);
router.get("/unassigned-ready", requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON", "VIEWER"), listUnassignedReadyApplicants);
router.post("/auto-assign", requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON"), autoAssignReadyApplicants);
router.post("/applicants/:applicantId/assign", requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON"), assignSingleApplicant);
router.patch("/assignments/:assignmentId/reassign", requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON"), reassignApplicant);
router.patch("/assignments/:assignmentId/start", requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON", "COMMITTEE_MEMBER"), startReview);
router.post("/assignments/:assignmentId/review", requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON", "COMMITTEE_MEMBER"), submitCommitteeReview);

module.exports = router;
