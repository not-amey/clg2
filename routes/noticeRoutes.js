const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/noticeController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const { noticeRules, handleValidation } = require('../middleware/validator');

// Public Feed Endpoint for College Website
router.get('/public', noticeController.getPublicNotices);

// Admin Protected Routes
router.get('/', authenticateToken, noticeController.getAll);
router.get('/:id', authenticateToken, noticeController.getById);

router.post('/', authenticateToken, requireRole(['super_admin', 'faculty_admin', 'staff_admin']), upload.single('attachment'), noticeRules, handleValidation, noticeController.create);
router.put('/:id', authenticateToken, requireRole(['super_admin', 'faculty_admin', 'staff_admin']), upload.single('attachment'), noticeRules, handleValidation, noticeController.update);
router.delete('/:id', authenticateToken, requireRole(['super_admin']), noticeController.remove);

module.exports = router;
