const rateLimit = require('express-rate-limit');
const { error } = require('../utils/response');

// Strict Rate Limiting for Login & 2FA to prevent Brute-Force Attacks
const LOCKOUT_MINUTES = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes (300,000 ms)

const loginLimiter = rateLimit({
    windowMs: LOCKOUT_MS,
    max: 5, // Max 5 failed attempts per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const lockUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
        return res.status(429).json({
            success: false,
            message: 'Too many login attempts.',
            lockUntil: lockUntil
        });
    }
});

// General API Rate Limiting to prevent DoS
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MIN || '15', 10) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_API_MAX || '200', 10),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        return error(res, 'Too many requests from this IP. Please try again later.', 429);
    }
});

module.exports = { loginLimiter, apiLimiter };
