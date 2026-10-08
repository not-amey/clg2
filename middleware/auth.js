const jwt = require('jsonwebtoken');
const supabase = require('../database/db');
const { error } = require('../utils/response');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_college_admin_jwt_key_2026_x892a!';

/**
 * Authentication Middleware: Protects routes and verifies JWT session
 */
async function authenticateToken(req, res, next) {
    try {
        let token = null;

        // 1. Check HTTP-Only Cookie
        if (req.cookies && req.cookies.admin_token) {
            token = req.cookies.admin_token;
        } 
        // 2. Fallback to Authorization Header (Bearer token)
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return error(res, 'Access denied. Authentication required.', 401);
        }

        // Verify Token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch fresh admin details from Supabase
        const { data: admin, error: dbErr } = await supabase
            .from('admins')
            .select('id, username, email, full_name, role, status, two_factor_enabled')
            .eq('id', decoded.id)
            .single();

        if (dbErr || !admin) {
            return error(res, 'Invalid session. Admin user no longer exists.', 401);
        }

        if (admin.status !== 'active') {
            return error(res, 'Account is disabled. Please contact the Super Admin.', 403);
        }

        // Attach user info to request
        req.user = admin;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return error(res, 'Session expired. Please log in again.', 401);
        }
        return error(res, 'Invalid authentication token.', 401);
    }
}

module.exports = { authenticateToken, JWT_SECRET };
