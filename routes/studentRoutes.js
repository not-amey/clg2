const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const { studentRules, handleValidation } = require('../middleware/validator');

router.get('/', authenticateToken, requireRole(['super_admin', 'faculty_admin', 'staff_admin']), studentController.getAll);
router.get('/:id', authenticateToken, requireRole(['super_admin', 'faculty_admin', 'staff_admin']), studentController.getById);

router.post('/', authenticateToken, requireRole(['super_admin', 'staff_admin']), upload.single('document'), studentRules, handleValidation, studentController.create);
router.put('/:id', authenticateToken, requireRole(['super_admin', 'staff_admin']), upload.single('document'), studentRules, handleValidation, studentController.update);
router.delete('/:id', authenticateToken, requireRole(['super_admin']), studentController.remove);

module.exports = router;
