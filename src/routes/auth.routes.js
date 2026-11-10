const express = require("express");
const {
  bootstrapAdmin,
  login,
  me,
  getSessionConfig,
  requestPasswordReset,
  completePasswordReset,
  getSsoConfig,
  startSso,
  ssoCallback,
  listStaffUsers,
  createStaffUser,
  updateStaffUser,
  sendStaffUserPasswordReset,
} = require("../controllers/auth.controller");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");
const { rateLimits } = require("../middleware/security.middleware");

const router = express.Router();

router.post("/bootstrap-admin", rateLimits.bootstrap, bootstrapAdmin);
router.post("/login", rateLimits.loginByAddress, rateLimits.login, login);
router.get("/me", requireAuth, me);
router.get("/session-config", requireAuth, getSessionConfig);

router.post("/password-reset/request", rateLimits.passwordReset, requestPasswordReset);
router.post("/password-reset/complete", rateLimits.passwordReset, completePasswordReset);

router.get("/sso/config", getSsoConfig);
router.get("/sso/start", rateLimits.loginByAddress, startSso);
router.get("/sso/callback", rateLimits.loginByAddress, ssoCallback);

router.get("/users", requireAuth, requireRoles("ADMIN"), listStaffUsers);
router.post("/users", requireAuth, requireRoles("ADMIN"), createStaffUser);
router.patch("/users/:userId", requireAuth, requireRoles("ADMIN"), updateStaffUser);
router.post("/users/:userId/password-reset", rateLimits.adminPasswordReset, requireAuth, requireRoles("ADMIN"), sendStaffUserPasswordReset);

module.exports = router;
