const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const {
  listParticipants,
  getParticipantProfile,
  downloadParticipantDocument,
} = require("../controllers/participants.controller");

// Mounted at /api/participants. Super admins (all countries) and country admins (their own).
const router = express.Router();

router.use(requireAuth, requireRoles("ADMIN", "COUNTRY_ADMIN"));
router.get("/", listParticipants);
router.get("/:participantId", getParticipantProfile);
router.get("/:participantId/documents/:documentId", downloadParticipantDocument);

module.exports = router;
