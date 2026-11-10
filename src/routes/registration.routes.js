const express = require("express");
const upload = require("../middleware/upload.middleware");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const { rateLimits } = require("../middleware/security.middleware");
const { requireApplicationConsent } = require("../middleware/consent.middleware");

const {
  submitRegistration,
  getApplicants,
  getApplicantById,
  getRegistrationFormQuestions,
  saveRegistrationDraft,
  getRegistrationDraft,
  requestApplicationAccessCode,
  verifyApplicationAccessCode,
} = require("../controllers/registration.controller");

const router = express.Router();

router.get("/form/questions", getRegistrationFormQuestions);

router.post("/drafts", rateLimits.draftSave, saveRegistrationDraft);
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

// Status checks and resuming a saved draft: a one-time code goes to the email on the application first.
// Must come before /:id so Express does not treat "status" as an applicant id.
router.post("/status/request-code", rateLimits.verificationCodeRequest, requestApplicationAccessCode);
router.post("/status/verify", rateLimits.verificationCodeVerify, verifyApplicationAccessCode);

router.get("/:id", requireAuth, requireRoles("ADMIN"), getApplicantById);

module.exports = router;
