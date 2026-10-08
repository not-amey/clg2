const supabase = require('../database/db');

/**
 * Log admin action to the audit trail in Supabase
 * @param {Object} params
 * @param {number} params.adminId
 * @param {string} params.adminUsername
 * @param {string} params.action - e.g. 'LOGIN', 'CREATE_STUDENT', 'DELETE_NOTICE'
 * @param {string} params.entityType - e.g. 'STUDENT', 'FACULTY', 'NOTICE', 'COURSE', 'APPLICATION', 'AUTH'
 * @param {number|null} [params.entityId]
 * @param {string|Object} [params.details]
 * @param {Object} [params.req] - Express request object for IP and User-Agent
 */
async function logAudit({ adminId, adminUsername, action, entityType, entityId = null, details = '', req = null }) {
    try {
        let ipAddress = 'UNKNOWN';
        let userAgent = 'UNKNOWN';

        if (req) {
            ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
            userAgent = req.headers['user-agent'] || 'UNKNOWN';
        }

        const detailsString = typeof details === 'object' ? JSON.stringify(details) : String(details);

        await supabase.from('audit_logs').insert({
            admin_id: adminId,
            admin_username: adminUsername,
            action,
            entity_type: entityType,
            entity_id: entityId,
            details: detailsString,
            ip_address: ipAddress,
            user_agent: userAgent
        });
    } catch (err) {
        console.error('[Audit Log Error]: Failed to record audit log:', err.message || err);
    }
}

module.exports = { logAudit };
