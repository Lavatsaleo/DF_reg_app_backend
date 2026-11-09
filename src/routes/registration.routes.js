const express = require("express");
const upload = require("../middleware/upload.middleware");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const { rateLimits } = require("../middleware/security.middleware");
const { requireApplicationConsent } = require("../middleware/consent.middleware");

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

router.post("/drafts", rateLimits.draftSave, saveRegistrationDraft);
router.post("/drafts/resume", rateLimits.draftResume, resumeRegistrationDraft);
router.get("/drafts/:draftReference", rateLimits.publicLookup, getRegistrationDraft);

router.post(
  "/",
  rateLimits.applicationSubmit,
  upload.array("documents", 10),
  requireApplicationConsent,
  submitRegistration
);

// Full applicant records: super admins only. Committee screens use the blind-review endpoints instead.
router.get("/", requireAuth, requireRoles("ADMIN"), getApplicants);

// Must come before /:id so Express does not treat "status" as an applicant id.
router.get("/status/:reference", rateLimits.publicLookup, getRegistrationStatus);

router.get("/:id", requireAuth, requireRoles("ADMIN"), getApplicantById);

module.exports = router;
