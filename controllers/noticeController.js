const supabase = require('../database/db');
const { uploadToSupabase } = require('../utils/supabase');
const { logAudit } = require('../utils/auditLogger');
const { success, error } = require('../utils/response');

/**
 * Get all notices (Admin view with pagination & search)
 */
async function getAll(req, res) {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : null;
        const category = req.query.category || null;
        const targetAudience = req.query.target_audience || null;

        let query = supabase
            .from('notices')
            .select('*, admins(full_name)', { count: 'exact' });

        if (search) {
            query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
        }

        if (category) {
            query = query.eq('category', category);
        }

        if (targetAudience) {
            query = query.eq('target_audience', targetAudience);
        }

        query = query.order('id', { ascending: false }).range(offset, offset + limit - 1);

        const { data, count, error: dbErr } = await query;
        if (dbErr) throw dbErr;

        const totalItems = count || 0;
        const totalPages = Math.ceil(totalItems / limit) || 1;

        const notices = (data || []).map(n => ({
            ...n,
            created_by_name: n.admins ? n.admins.full_name : null,
            admins: undefined
        }));

        return success(res, notices, 'Notices fetched successfully', 200, {
            page,
            limit,
            totalItems,
            totalPages
        });
    } catch (err) {
        console.error('[Notice GetAll Error]:', err);
        return error(res, 'Failed to retrieve notices.', 500);
    }
}

/**
 * Get single notice by ID
 */
async function getById(req, res) {
    try {
        const { data: n, error: dbErr } = await supabase
            .from('notices')
            .select('*, admins(full_name)')
            .eq('id', req.params.id)
            .single();

        if (dbErr || !n) {
            return error(res, 'Notice not found.', 404);
        }

        const notice = {
            ...n,
            created_by_name: n.admins ? n.admins.full_name : null,
            admins: undefined
        };

        return success(res, notice);
    } catch (err) {
        console.error('[Notice GetById Error]:', err);
        return error(res, 'Failed to fetch notice.', 500);
    }
}

/**
 * Create Notice
 */
async function create(req, res) {
    try {
        const { title, category, content, target_audience, priority, expiry_date, is_published } = req.body;
        
        let attachment_path = null;
        if (req.file) {
            attachment_path = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'notice_attachments');
        }

        const { data: inserted, error: insertErr } = await supabase
            .from('notices')
            .insert({
                title,
                category,
                content,
                target_audience: target_audience || 'all',
                priority: priority || 'normal',
                attachment_path,
                expiry_date: expiry_date || null,
                is_published: is_published !== undefined ? parseInt(is_published, 10) : 1,
                created_by: req.user.id
            })
            .select('id')
            .single();

        if (insertErr) throw insertErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'CREATE_NOTICE',
            entityType: 'NOTICE',
            entityId: inserted.id,
            details: `Posted notice: "${title}" (${category})`,
            req
        });

        return success(res, { id: inserted.id }, 'Notice published successfully.', 201);
    } catch (err) {
        console.error('[Notice Create Error]:', err);
        return error(res, 'Failed to create notice.', 500);
    }
}

/**
 * Update Notice
 */
async function update(req, res) {
    try {
        const noticeId = req.params.id;
        const { title, category, content, target_audience, priority, expiry_date, is_published } = req.body;

        const { data: current } = await supabase.from('notices').select('*').eq('id', noticeId).single();
        if (!current) {
            return error(res, 'Notice not found.', 404);
        }

        let attachment_path = current.attachment_path;
        if (req.file) {
            attachment_path = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'notice_attachments');
        }

        const { error: updateErr } = await supabase
            .from('notices')
            .update({
                title,
                category,
                content,
                target_audience: target_audience || 'all',
                priority: priority || 'normal',
                attachment_path,
                expiry_date: expiry_date || null,
                is_published: is_published !== undefined ? parseInt(is_published, 10) : current.is_published
            })
            .eq('id', noticeId);

        if (updateErr) throw updateErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'UPDATE_NOTICE',
            entityType: 'NOTICE',
            entityId: noticeId,
            details: `Updated notice: "${title}"`,
            req
        });

        return success(res, null, 'Notice updated successfully.');
    } catch (err) {
        console.error('[Notice Update Error]:', err);
        return error(res, 'Failed to update notice.', 500);
    }
}

/**
 * Delete Notice
 */
async function remove(req, res) {
    try {
        const noticeId = req.params.id;
        const { data: notice } = await supabase.from('notices').select('*').eq('id', noticeId).single();

        if (!notice) {
            return error(res, 'Notice not found.', 404);
        }

        const { error: delErr } = await supabase.from('notices').delete().eq('id', noticeId);
        if (delErr) throw delErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'DELETE_NOTICE',
            entityType: 'NOTICE',
            entityId: noticeId,
            details: `Deleted notice: "${notice.title}"`,
            req
        });

        return success(res, null, 'Notice deleted successfully.');
    } catch (err) {
        console.error('[Notice Delete Error]:', err);
        return error(res, 'Failed to delete notice.', 500);
    }
}

/**
 * Public Notices Feed (For Public Website Front-end)
 */
async function getPublicNotices(req, res) {
    try {
        const nowIso = new Date().toISOString();
        const { data: notices, error: dbErr } = await supabase
            .from('notices')
            .select('id, title, category, content, target_audience, priority, attachment_path, publish_date, expiry_date')
            .eq('is_published', 1)
            .or(`expiry_date.is.null,expiry_date.gte.${nowIso}`)
            .order('publish_date', { ascending: false })
            .limit(20);

        if (dbErr) throw dbErr;

        return success(res, notices || []);
    } catch (err) {
        console.error('[Notice GetPublicNotices Error]:', err);
        return error(res, 'Failed to fetch public notices.', 500);
    }
}

module.exports = { getAll, getById, create, update, remove, getPublicNotices };
