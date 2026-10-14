const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { error } = require('../utils/response');

// Memory storage for general image uploads
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

// Dedicated multer for site logo: accepts image files only (.png, .jpg, .jpeg, .svg), max 2MB
const logoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.png', '.jpg', '.jpeg', '.svg'];
        const allowedMimes = ['image/png', 'image/jpeg', 'image/svg+xml'];

        if (allowedExts.includes(ext) && allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            const err = new Error('Please upload a PNG, JPG, or SVG under 2MB');
            err.code = 'INVALID_FILE_TYPE';
            cb(err, false);
        }
    }
});

// GET /api/settings (Public - used by website frontend cms-loader)
router.get('/', settingsController.getSettings);

// POST /api/settings (Protected - Admin text settings save)
router.post('/', authenticateToken, settingsController.updateSettings);

// POST /api/settings/upload-image (Protected - Admin image upload & replace)
router.post('/upload-image', authenticateToken, upload.single('image'), settingsController.uploadSettingImage);

// POST /api/settings/upload-logo (Protected - Super Admin only)
router.post('/upload-logo', authenticateToken, requireRole(['super_admin']), (req, res, next) => {
    logoUpload.single('logo')(req, res, (err) => {
        if (err) {
            return error(res, 'Please upload a PNG, JPG, or SVG under 2MB', 400);
        }
        next();
    });
}, settingsController.uploadLogo);

module.exports = router;
