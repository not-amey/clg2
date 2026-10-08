const supabase = require('../database/db');
const { success, error } = require('../utils/response');

/**
 * Get Audit Logs with search, filters, and pagination
 */
async function getAll(req, res) {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '15', 10);
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : null;
        const entityType = req.query.entity_type || null;
        const action = req.query.action || null;

        let query = supabase.from('audit_logs').select('*', { count: 'exact' });

        if (search) {
            query = query.or(`admin_username.ilike.%${search}%,action.ilike.%${search}%,details.ilike.%${search}%,ip_address.ilike.%${search}%`);
        }

        if (entityType) {
            query = query.eq('entity_type', entityType);
        }

        if (action) {
            query = query.eq('action', action);
        }

        query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, count, error: dbErr } = await query;
        if (dbErr) throw dbErr;

        const totalItems = count || 0;
        const totalPages = Math.ceil(totalItems / limit) || 1;

        return success(res, data || [], 'Audit logs fetched successfully', 200, {
            page,
            limit,
            totalItems,
            totalPages
        });
    } catch (err) {
        console.error('[Audit Log GetAll Error]:', err);
        return error(res, 'Failed to retrieve audit logs.', 500);
    }
}

/**
 * Export Audit Logs as CSV
 */
async function exportCSV(req, res) {
    try {
        const { data: logs, error: dbErr } = await supabase
            .from('audit_logs')
            .select('id, admin_username, action, entity_type, entity_id, details, ip_address, created_at')
            .order('id', { ascending: false })
            .limit(5000);

        if (dbErr) throw dbErr;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=audit_logs_export.csv');

        let csv = 'ID,Admin Username,Action,Entity Type,Entity ID,Details,IP Address,Timestamp\n';
        (logs || []).forEach(log => {
            const cleanDetails = (log.details || '').replace(/"/g, '""');
            csv += `"${log.id}","${log.admin_username}","${log.action}","${log.entity_type}","${log.entity_id || ''}","${cleanDetails}","${log.ip_address}","${log.created_at}"\n`;
        });

        return res.send(csv);
    } catch (err) {
        console.error('[Audit Log Export Error]:', err);
        return error(res, 'Failed to export logs.', 500);
    }
}

module.exports = { getAll, exportCSV };
