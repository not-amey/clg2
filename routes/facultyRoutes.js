const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const { facultyRules, handleValidation } = require('../middleware/validator');

router.get('/', authenticateToken, requireRole(['super_admin', 'faculty_admin', 'staff_admin']), facultyController.getAll);
router.get('/:id', authenticateToken, requireRole(['super_admin', 'faculty_admin', 'staff_admin']), facultyController.getById);

router.post('/', authenticateToken, requireRole(['super_admin', 'faculty_admin']), upload.single('photo'), facultyRules, handleValidation, facultyController.create);
router.put('/:id', authenticateToken, requireRole(['super_admin', 'faculty_admin']), upload.single('photo'), facultyRules, handleValidation, facultyController.update);
router.delete('/:id', authenticateToken, requireRole(['super_admin']), facultyController.remove);

module.exports = router;
