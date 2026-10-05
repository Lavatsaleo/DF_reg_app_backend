const express = require('express');
const { requireAuth, requireRoles } = require('../middleware/auth.middleware');
const { getApplicationDashboard } = require('../controllers/applicationDashboard.controller');
const router = express.Router();
router.get('/', requireAuth, requireRoles('ADMIN', 'VIEWER'), getApplicationDashboard);
module.exports = router;
