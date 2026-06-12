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
} = require("../controllers/auth.controller");
const { requireAuth, requireRoles } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/bootstrap-admin", bootstrapAdmin);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.get("/session-config", requireAuth, getSessionConfig);

router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/complete", completePasswordReset);

router.get("/sso/config", getSsoConfig);
router.get("/sso/start", startSso);
router.get("/sso/callback", ssoCallback);

router.get("/users", requireAuth, requireRoles("ADMIN"), listStaffUsers);
router.post("/users", requireAuth, requireRoles("ADMIN"), createStaffUser);
router.patch("/users/:userId", requireAuth, requireRoles("ADMIN"), updateStaffUser);

module.exports = router;
