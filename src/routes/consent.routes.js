const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const { getCurrentConsent, getConsentRecords, getConsentRecord } = require("../controllers/consent.controller");

const { createSupportRequest, markSupportRequestContacted } = require("../controllers/consentSupport.controller");
const router = express.Router();
router.post("/support-requests", createSupportRequest);
router.patch("/support-requests/:id/contacted", requireAuth, requireRoles("ADMIN"), markSupportRequestContacted);

router.get("/current", getCurrentConsent);
router.get("/", requireAuth, requireRoles("ADMIN"), getConsentRecords);
router.get("/records/:applicantId", requireAuth, requireRoles("ADMIN"), getConsentRecord);

module.exports = router;

