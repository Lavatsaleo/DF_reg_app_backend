const express = require("express");
const upload = require("../middleware/upload.middleware");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const {
  getParticipantRegistrationForm,
  submitParticipantRegistration,
  resendParticipantRegistrationInvitation,
} = require("../controllers/participantRegistration.controller");

const router = express.Router();

router.get("/invite/:token", getParticipantRegistrationForm);

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
