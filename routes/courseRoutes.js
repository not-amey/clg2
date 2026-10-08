const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { courseRules, handleValidation } = require('../middleware/validator');

router.get('/departments', authenticateToken, courseController.getDepartments);
router.get('/', authenticateToken, requireRole(['super_admin', 'faculty_admin', 'staff_admin']), courseController.getAll);
router.get('/:id', authenticateToken, requireRole(['super_admin', 'faculty_admin', 'staff_admin']), courseController.getById);

router.post('/', authenticateToken, requireRole(['super_admin', 'faculty_admin']), courseRules, handleValidation, courseController.create);
router.put('/:id', authenticateToken, requireRole(['super_admin', 'faculty_admin']), courseRules, handleValidation, courseController.update);
router.delete('/:id', authenticateToken, requireRole(['super_admin']), courseController.remove);

module.exports = router;
