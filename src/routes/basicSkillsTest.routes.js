const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const {
  getInvitationBasicSkillsTestQuestions,
  sendBasicSkillsTestInvitationForApplicant,
  submitInvitationBasicSkillsTest,
} = require("../controllers/basicSkillsTest.controller");

const router = express.Router();

// Production applicant flow: applicant opens the private email invitation link.
router.get("/invite/:token/questions", getInvitationBasicSkillsTestQuestions);
router.post("/invite/:token/submit", submitInvitationBasicSkillsTest);

// Admin/local helper: resend or create a new invitation after eligibility screening.
router.post(
  "/invitations/:reference/send",
  requireAuth,
  requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON"),
  sendBasicSkillsTestInvitationForApplicant
);


module.exports = router;
