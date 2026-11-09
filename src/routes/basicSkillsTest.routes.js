const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const { rateLimits } = require("../middleware/security.middleware");
const {
  getInvitationBasicSkillsTestQuestions,
  sendBasicSkillsTestInvitationForApplicant,
  listBasicSkillsTestInvitationDelivery,
  submitInvitationBasicSkillsTest,
  requestNewBasicSkillsTestInvitation,
} = require("../controllers/basicSkillsTest.controller");

const router = express.Router();

// Production applicant flow: applicant opens the private email invitation link.
router.get("/invite/:token/questions", rateLimits.invitation, getInvitationBasicSkillsTestQuestions);
router.post("/invite/:token/submit", rateLimits.invitation, submitInvitationBasicSkillsTest);

// Applicants who can't find their email ask for a new link; it goes only to the address on file.
router.post("/invitations/request-new-link", rateLimits.contactRequest, requestNewBasicSkillsTestInvitation);

// Only admins and country admins see applicant email addresses for troubleshooting.
router.get(
  "/invitations/delivery-report",
  requireAuth,
  requireRoles("ADMIN", "COUNTRY_ADMIN"),
  listBasicSkillsTestInvitationDelivery
);

// Admin/local helper: resend or create a new invitation after eligibility screening.
router.post(
  "/invitations/:reference/send",
  requireAuth,
  requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON"),
  sendBasicSkillsTestInvitationForApplicant
);


module.exports = router;
