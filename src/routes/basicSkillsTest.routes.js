const express = require("express");
const {
  getBasicSkillsTestQuestions,
  getInvitationBasicSkillsTestQuestions,
  sendBasicSkillsTestInvitationForApplicant,
  submitBasicSkillsTest,
  submitInvitationBasicSkillsTest,
} = require("../controllers/basicSkillsTest.controller");

const router = express.Router();

// Production applicant flow: applicant opens the private email invitation link.
router.get("/invite/:token/questions", getInvitationBasicSkillsTestQuestions);
router.post("/invite/:token/submit", submitInvitationBasicSkillsTest);

// Admin/local helper: resend or create a new invitation after eligibility screening.
router.post("/invitations/:reference/send", sendBasicSkillsTestInvitationForApplicant);

// Backward-compatible/local testing routes using the public application reference.
router.get("/:reference/questions", getBasicSkillsTestQuestions);
router.post("/:reference/submit", submitBasicSkillsTest);

module.exports = router;
