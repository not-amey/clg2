const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const { loginRules, resetPasswordRules, handleValidation } = require('../middleware/validator');

// Login Route (Rate Limited + Input Sanitized)
router.post('/login', loginLimiter, loginRules, handleValidation, authController.login);

// Password Reset Routes
router.post('/forgot-password', loginLimiter, authController.forgotPassword);
router.post('/reset-password', loginLimiter, resetPasswordRules, handleValidation, authController.resetPassword);

// Logout Route
router.post('/logout', authenticateToken, authController.logout);

// Current User Profile
router.get('/me', authenticateToken, authController.getMe);

// 2FA Routes
router.post('/2fa/setup', authenticateToken, authController.setup2FA);
router.post('/2fa/verify', authenticateToken, authController.verifyAndEnable2FA);
router.post('/2fa/disable', authenticateToken, authController.disable2FA);

module.exports = router;
