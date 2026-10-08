const supabase = require('../database/db');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../utils/auditLogger');
const { success, error } = require('../utils/response');

/**
 * List all admin users (Super Admin only)
 */
async function getAll(req, res) {
    try {
        const { data: admins, error: dbErr } = await supabase
            .from('admins')
            .select('id, username, email, full_name, role, status, two_factor_enabled, last_login, created_at')
            .order('id', { ascending: true });

        if (dbErr) throw dbErr;

        return success(res, admins || []);
    } catch (err) {
        console.error('[Admin GetAll Error]:', err);
        return error(res, 'Failed to fetch admin users.', 500);
    }
}

/**
 * Create a new Admin user (Super Admin only)
 */
async function create(req, res) {
    try {
        const { username, email, password, full_name, role } = req.body;

        if (!['super_admin', 'faculty_admin', 'staff_admin'].includes(role)) {
            return error(res, 'Invalid role specified.', 400);
        }

        const { data: existing } = await supabase
            .from('admins')
            .select('id')
            .or(`username.eq.${username},email.eq.${email}`)
            .limit(1);

        if (existing && existing.length > 0) {
            return error(res, 'Admin with this username or email already exists.', 400);
        }

        const password_hash = await bcrypt.hash(password, 10);

        const { data: inserted, error: insertErr } = await supabase
            .from('admins')
            .insert({ username, email, password_hash, full_name, role })
            .select('id')
            .single();

        if (insertErr) throw insertErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'CREATE_ADMIN_USER',
            entityType: 'ADMIN',
            entityId: inserted.id,
            details: `Created admin user ${username} (${role})`,
            req
        });

        return success(res, { id: inserted.id }, 'Admin user created successfully.', 201);
    } catch (err) {
        console.error('[Admin Create Error]:', err);
        return error(res, 'Failed to create admin user.', 500);
    }
}

/**
 * Toggle Admin Status (Active / Disabled)
 */
async function updateStatus(req, res) {
    try {
        const adminId = req.params.id;
        const { status } = req.body;

        if (parseInt(adminId, 10) === req.user.id) {
            return error(res, 'You cannot disable your own admin account.', 400);
        }

        if (!['active', 'disabled'].includes(status)) {
            return error(res, 'Invalid status.', 400);
        }

        const { data: targetAdmin } = await supabase.from('admins').select('username').eq('id', adminId).single();
        if (!targetAdmin) {
            return error(res, 'Admin user not found.', 404);
        }

        const { error: updateErr } = await supabase.from('admins').update({ status }).eq('id', adminId);
        if (updateErr) throw updateErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'UPDATE_ADMIN_STATUS',
            entityType: 'ADMIN',
            entityId: adminId,
            details: `Changed status of ${targetAdmin.username} to ${status}`,
            req
        });

        return success(res, null, `Admin account status updated to ${status}.`);
    } catch (err) {
        console.error('[Admin Update Status Error]:', err);
        return error(res, 'Failed to update admin status.', 500);
    }
}

/**
 * Delete Admin User
 */
async function remove(req, res) {
    try {
        const adminId = req.params.id;

        if (parseInt(adminId, 10) === req.user.id) {
            return error(res, 'You cannot delete your own admin account.', 400);
        }

        const { data: targetAdmin } = await supabase.from('admins').select('username').eq('id', adminId).single();
        if (!targetAdmin) {
            return error(res, 'Admin user not found.', 404);
        }

        const { error: delErr } = await supabase.from('admins').delete().eq('id', adminId);
        if (delErr) throw delErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'DELETE_ADMIN_USER',
            entityType: 'ADMIN',
            entityId: adminId,
            details: `Deleted admin account ${targetAdmin.username}`,
            req
        });

        return success(res, null, 'Admin user deleted successfully.');
    } catch (err) {
        console.error('[Admin Delete Error]:', err);
        return error(res, 'Failed to delete admin user.', 500);
    }
}

module.exports = { getAll, create, updateStatus, remove };
