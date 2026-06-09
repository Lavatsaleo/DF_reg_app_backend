const express = require("express");
const {
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
} = require("../controllers/committee.controller");

const router = express.Router();

router.get("/overview", getCommitteeOverview);
router.get("/members", listCommitteeMembers);
router.post("/members", createCommitteeMember);
router.patch("/members/:memberId", updateCommitteeMember);

router.get("/assignments", listCommitteeAssignments);
router.get("/unassigned-ready", listUnassignedReadyApplicants);
router.post("/auto-assign", autoAssignReadyApplicants);
router.post("/applicants/:applicantId/assign", assignSingleApplicant);
router.patch("/assignments/:assignmentId/reassign", reassignApplicant);
router.patch("/assignments/:assignmentId/start", startReview);
router.post("/assignments/:assignmentId/review", submitCommitteeReview);

module.exports = router;
