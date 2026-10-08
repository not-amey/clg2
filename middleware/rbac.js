const { error } = require('../utils/response');

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param {Array<string>|string} allowedRoles - e.g. ['super_admin', 'faculty_admin']
 */
function requireRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (req, res, next) => {
        if (!req.user) {
            return error(res, 'Authentication required.', 401);
        }

        if (!roles.includes(req.user.role)) {
            return error(res, `Access denied. Requires one of the following roles: ${roles.join(', ')}`, 403);
        }

        next();
    };
}

module.exports = { requireRole };
