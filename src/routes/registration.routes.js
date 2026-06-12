const express = require("express");
const upload = require("../middleware/upload.middleware");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");

const {
  submitRegistration,
  getApplicants,
  getApplicantById,
  getRegistrationStatus,
  getRegistrationFormQuestions,
  saveRegistrationDraft,
  getRegistrationDraft,
  resumeRegistrationDraft,
} = require("../controllers/registration.controller");

const router = express.Router();

router.get("/form/questions", getRegistrationFormQuestions);

router.post("/drafts", saveRegistrationDraft);
router.post("/drafts/resume", resumeRegistrationDraft);
router.get("/drafts/:draftReference", getRegistrationDraft);

router.post("/", upload.array("documents", 10), submitRegistration);

router.get("/", requireAuth, requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON", "VIEWER"), getApplicants);

// Must come before /:id so Express does not treat "status" as an applicant id.
router.get("/status/:reference", getRegistrationStatus);

router.get("/:id", requireAuth, requireRoles("ADMIN", "COMMITTEE_CHAIRPERSON", "VIEWER"), getApplicantById);

module.exports = router;