const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.get('/', authenticateToken, requireRole(['super_admin']), logController.getAll);
router.get('/export', authenticateToken, requireRole(['super_admin']), logController.exportCSV);

module.exports = router;
