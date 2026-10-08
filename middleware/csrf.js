const crypto = require('crypto');
const { error } = require('../utils/response');

/**
 * Generate a random CSRF token
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF Protection Middleware using Double Submit Cookie Strategy
 */
function csrfProtection(req, res, next) {
    // 1. Ensure XSRF-TOKEN cookie is set on response
    let csrfToken = req.cookies['XSRF-TOKEN'];

    if (!csrfToken) {
        csrfToken = generateToken();
        res.cookie('XSRF-TOKEN', csrfToken, {
            httpOnly: false, // Accessible by frontend JS to attach as header
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        });
    }

    // 2. Exempt safe HTTP methods (GET, HEAD, OPTIONS) and unauthenticated login / public endpoints
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || ['/api/auth/login', '/api/applications/public/submit'].includes(req.path)) {
        return next();
    }

    // 3. For state-changing requests, verify header matches cookie
    const headerToken = req.headers['x-csrf-token'] || req.body?._csrf;

    if (!headerToken || headerToken !== csrfToken) {
        return error(res, 'CSRF verification failed. Invalid or missing CSRF token.', 403);
    }

    next();
}

module.exports = { csrfProtection, generateToken };
