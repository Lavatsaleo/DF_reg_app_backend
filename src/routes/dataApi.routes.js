const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const { requireApiKey } = require("../middleware/apiKey.middleware");
const { rateLimits } = require("../middleware/security.middleware");
const {
  getDataApiIndex,
  getApplicantsData,
  getStatusHistoryData,
  getSkillsTestsData,
  getCommitteeReviewsData,
  listApiKeys,
  createApiKey,
  revokeApiKey,
} = require("../controllers/dataApi.controller");

// Mounted at /api/data.
const router = express.Router();

// Key management: signed-in super admins only.
router.get("/keys", requireAuth, requireRoles("ADMIN"), listApiKeys);
router.post("/keys", requireAuth, requireRoles("ADMIN"), createApiKey);
router.post("/keys/:keyId/revoke", requireAuth, requireRoles("ADMIN"), revokeApiKey);

// Read-only datasets: API key in the Authorization header.
router.use("/v1", rateLimits.dataApi, requireApiKey);
router.get("/v1", getDataApiIndex);
router.get("/v1/applicants", getApplicantsData);
router.get("/v1/status-history", getStatusHistoryData);
router.get("/v1/skills-tests", getSkillsTestsData);
router.get("/v1/committee-reviews", getCommitteeReviewsData);

module.exports = router;
