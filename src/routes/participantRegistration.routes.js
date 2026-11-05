const express = require("express");
const upload = require("../middleware/upload.middleware");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const {
  getParticipantRegistrationForm,
  saveParticipantRegistrationDraft,
  uploadParticipantRegistrationDocument,
  saveParticipantRegistrationSupportRequest,
  submitParticipantRegistration,
  resendParticipantRegistrationInvitation,
} = require("../controllers/participantRegistration.controller");

const router = express.Router();

router.get("/invite/:token", getParticipantRegistrationForm);

router.put("/invite/:token/draft", saveParticipantRegistrationDraft);

// A file over the size limit gets a clear message instead of a server error.
function uploadSingleDocument(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      success: false,
      message: error.code === "LIMIT_FILE_SIZE"
        ? "This file is larger than 10 MB. Please upload a smaller file."
        : "Unable to read this file. Please try again.",
    });
  });
}

router.post(
  "/invite/:token/documents/:field",
  uploadSingleDocument,
  uploadParticipantRegistrationDocument
);

router.post(
  "/invite/:token/support-request",
  saveParticipantRegistrationSupportRequest
);

router.post(
  "/invite/:token/submit",
  upload.fields([
    { name: "disabilityRegistrationCard", maxCount: 1 },
    { name: "idDocument", maxCount: 1 },
    { name: "educationCertificate", maxCount: 1 },
  ]),
  submitParticipantRegistration
);

router.post(
  "/invitations/:reference/send",
  requireAuth,
  requireRoles("ADMIN", "COUNTRY_ADMIN", "COMMITTEE_CHAIRPERSON"),
  resendParticipantRegistrationInvitation
);

module.exports = router;
