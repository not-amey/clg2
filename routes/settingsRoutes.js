const express = require('express');
const multer = require('multer');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken } = require('../middleware/auth');
const { error } = require('../utils/response');

// Memory storage for image uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
        }
    }
});

// GET /api/settings (Public - used by website frontend cms-loader)
router.get('/', settingsController.getSettings);

// POST /api/settings (Protected - Admin text settings save)
router.post('/', authenticateToken, settingsController.updateSettings);

// POST /api/settings/upload-image (Protected - Admin image upload & replace)
router.post('/upload-image', authenticateToken, upload.single('image'), settingsController.uploadSettingImage);

module.exports = router;
