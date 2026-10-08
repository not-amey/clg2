const supabase = require('../database/db');
const { uploadToSupabase } = require('../utils/supabase');
const { logAudit } = require('../utils/auditLogger');
const { success, error } = require('../utils/response');
const crypto = require('crypto');

/**
 * Get all applications with search, status filter & pagination
 */
async function getAll(req, res) {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : null;
        const status = req.query.status || null;

        let query = supabase
            .from('applications')
            .select('*, departments(name, code), admins(full_name)', { count: 'exact' });

        if (search) {
            query = query.or(`application_no.ilike.%${search}%,applicant_name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        if (status) {
            query = query.eq('status', status);
        }

        query = query.order('id', { ascending: false }).range(offset, offset + limit - 1);

        const { data, count, error: dbErr } = await query;
        if (dbErr) throw dbErr;

        const totalItems = count || 0;
        const totalPages = Math.ceil(totalItems / limit) || 1;

        const apps = (data || []).map(a => ({
            ...a,
            department_name: a.departments ? a.departments.name : null,
            department_code: a.departments ? a.departments.code : null,
            reviewer_name: a.admins ? a.admins.full_name : null,
            departments: undefined,
            admins: undefined
        }));

        return success(res, apps, 'Applications fetched successfully', 200, {
            page,
            limit,
            totalItems,
            totalPages
        });
    } catch (err) {
        console.error('[Application GetAll Error]:', err);
        return error(res, 'Failed to fetch applications.', 500);
    }
}

/**
 * Update Application Status (Approve / Reject / Review)
 */
async function updateStatus(req, res) {
    try {
        const appId = req.params.id;
        const { status, reviewer_notes } = req.body;

        const { data: app } = await supabase.from('applications').select('*').eq('id', appId).single();
        if (!app) {
            return error(res, 'Application not found.', 404);
        }

        const now = new Date().toISOString();

        const { error: updateErr } = await supabase
            .from('applications')
            .update({
                status,
                reviewer_notes: reviewer_notes || null,
                reviewed_by: req.user.id,
                reviewed_at: now
            })
            .eq('id', appId);

        if (updateErr) throw updateErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: `APPLICATION_${status.toUpperCase()}`,
            entityType: 'APPLICATION',
            entityId: appId,
            details: `Updated status of Application ${app.application_no} (${app.applicant_name}) to ${status}`,
            req
        });

        return success(res, null, `Application ${status} successfully.`);
    } catch (err) {
        console.error('[Application Status Error]:', err);
        return error(res, 'Failed to update application status.', 500);
    }
}

/**
 * Public Admission Application Submission Endpoint
 */
async function submitPublicApplication(req, res) {
    try {
        const { applicant_name, email, phone, applied_department_id, previous_marks_percentage } = req.body;
        
        let document_path = null;
        if (req.file) {
            document_path = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'applicant_documents');
        }

        const application_no = `APP${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        const { data: inserted, error: insertErr } = await supabase
            .from('applications')
            .insert({
                application_no,
                applicant_name,
                email,
                phone,
                applied_department_id: applied_department_id ? parseInt(applied_department_id, 10) : null,
                previous_marks_percentage: previous_marks_percentage ? parseFloat(previous_marks_percentage) : null,
                document_path
            })
            .select('application_no')
            .single();

        if (insertErr) throw insertErr;

        return success(res, { application_no: inserted.application_no }, 'Your application has been submitted successfully! Please note your application number.', 201);
    } catch (err) {
        console.error('[Public Application Submit Error]:', err);
        return error(res, 'Failed to submit application. Please check your input.', 500);
    }
}

module.exports = { getAll, updateStatus, submitPublicApplication };
