const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const { applicationReviewRules, handleValidation } = require('../middleware/validator');

// Public application submission
router.post('/public/submit', upload.single('document'), applicationController.submitPublicApplication);

// Admin protected routes
router.get('/', authenticateToken, requireRole(['super_admin', 'staff_admin']), applicationController.getAll);
router.patch('/:id/status', authenticateToken, requireRole(['super_admin', 'staff_admin']), applicationReviewRules, handleValidation, applicationController.updateStatus);

module.exports = router;
