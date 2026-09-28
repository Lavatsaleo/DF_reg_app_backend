const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const { getCurrentConsent, getConsentRecords } = require("../controllers/consent.controller");

const router = express.Router();

router.get("/current", getCurrentConsent);
router.get("/", requireAuth, requireRoles("ADMIN"), getConsentRecords);

module.exports = router;
