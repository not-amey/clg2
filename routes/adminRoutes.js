const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticateToken, requireRole(['super_admin']));

router.get('/', adminController.getAll);
router.post('/', adminController.create);
router.patch('/:id/status', adminController.updateStatus);
router.delete('/:id', adminController.remove);

module.exports = router;
