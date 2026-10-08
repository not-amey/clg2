const supabase = require('../database/db');
const { uploadToSupabase } = require('../utils/supabase');
const { logAudit } = require('../utils/auditLogger');
const { success, error } = require('../utils/response');

/**
 * Get all faculty members with pagination, search & department filter
 */
async function getAll(req, res) {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : null;
        const deptId = req.query.department_id ? parseInt(req.query.department_id, 10) : null;
        const status = req.query.status || null;

        let query = supabase
            .from('faculty')
            .select('*, departments(name, code)', { count: 'exact' });

        if (search) {
            query = query.or(`faculty_id_num.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%,designation.ilike.%${search}%`);
        }

        if (deptId) {
            query = query.eq('department_id', deptId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        query = query.order('id', { ascending: false }).range(offset, offset + limit - 1);

        const { data, count, error: dbErr } = await query;
        if (dbErr) throw dbErr;

        const totalItems = count || 0;
        const totalPages = Math.ceil(totalItems / limit) || 1;

        const faculty = (data || []).map(f => ({
            ...f,
            department_name: f.departments ? f.departments.name : null,
            department_code: f.departments ? f.departments.code : null,
            departments: undefined
        }));

        return success(res, faculty, 'Faculty list fetched successfully', 200, {
            page,
            limit,
            totalItems,
            totalPages
        });
    } catch (err) {
        console.error('[Faculty GetAll Error]:', err);
        return error(res, 'Failed to fetch faculty list.', 500);
    }
}

/**
 * Get Single Faculty Record by ID
 */
async function getById(req, res) {
    try {
        const { data: f, error: dbErr } = await supabase
            .from('faculty')
            .select('*, departments(name, code)')
            .eq('id', req.params.id)
            .single();

        if (dbErr || !f) {
            return error(res, 'Faculty member not found.', 404);
        }

        const faculty = {
            ...f,
            department_name: f.departments ? f.departments.name : null,
            department_code: f.departments ? f.departments.code : null,
            departments: undefined
        };

        return success(res, faculty);
    } catch (err) {
        console.error('[Faculty GetById Error]:', err);
        return error(res, 'Failed to fetch faculty details.', 500);
    }
}

/**
 * Create New Faculty Record
 */
async function create(req, res) {
    try {
        const { faculty_id_num, full_name, email, phone, department_id, designation, qualification, status } = req.body;
        
        let photo_path = null;
        if (req.file) {
            photo_path = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'faculty_photos');
        }

        const { data: existing } = await supabase
            .from('faculty')
            .select('id')
            .or(`faculty_id_num.eq.${faculty_id_num},email.eq.${email}`)
            .limit(1);

        if (existing && existing.length > 0) {
            return error(res, 'Faculty member with this ID number or email already exists.', 400);
        }

        const { data: inserted, error: insertErr } = await supabase
            .from('faculty')
            .insert({
                faculty_id_num,
                full_name,
                email,
                phone: phone || null,
                department_id: department_id ? parseInt(department_id, 10) : null,
                designation,
                qualification: qualification || null,
                photo_path,
                status: status || 'active'
            })
            .select('id')
            .single();

        if (insertErr) throw insertErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'CREATE_FACULTY',
            entityType: 'FACULTY',
            entityId: inserted.id,
            details: `Added faculty member ${full_name} (${faculty_id_num})`,
            req
        });

        return success(res, { id: inserted.id }, 'Faculty record created successfully.', 201);
    } catch (err) {
        console.error('[Faculty Create Error]:', err);
        return error(res, 'Failed to create faculty member.', 500);
    }
}

/**
 * Update Faculty Record
 */
async function update(req, res) {
    try {
        const facultyId = req.params.id;
        const { faculty_id_num, full_name, email, phone, department_id, designation, qualification, status } = req.body;

        const { data: current } = await supabase.from('faculty').select('*').eq('id', facultyId).single();
        if (!current) {
            return error(res, 'Faculty record not found.', 404);
        }

        const { data: duplicate } = await supabase
            .from('faculty')
            .select('id')
            .or(`faculty_id_num.eq.${faculty_id_num},email.eq.${email}`)
            .neq('id', facultyId)
            .limit(1);

        if (duplicate && duplicate.length > 0) {
            return error(res, 'Another faculty member with this ID number or email already exists.', 400);
        }

        let photo_path = current.photo_path;
        if (req.file) {
            photo_path = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'faculty_photos');
        }

        const { error: updateErr } = await supabase
            .from('faculty')
            .update({
                faculty_id_num,
                full_name,
                email,
                phone: phone || null,
                department_id: department_id ? parseInt(department_id, 10) : null,
                designation,
                qualification: qualification || null,
                photo_path,
                status
            })
            .eq('id', facultyId);

        if (updateErr) throw updateErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'UPDATE_FACULTY',
            entityType: 'FACULTY',
            entityId: facultyId,
            details: `Updated faculty details for ${full_name}`,
            req
        });

        return success(res, null, 'Faculty record updated successfully.');
    } catch (err) {
        console.error('[Faculty Update Error]:', err);
        return error(res, 'Failed to update faculty record.', 500);
    }
}

/**
 * Delete Faculty Record
 */
async function remove(req, res) {
    try {
        const facultyId = req.params.id;
        const { data: faculty } = await supabase.from('faculty').select('*').eq('id', facultyId).single();

        if (!faculty) {
            return error(res, 'Faculty record not found.', 404);
        }

        const { error: delErr } = await supabase.from('faculty').delete().eq('id', facultyId);
        if (delErr) throw delErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'DELETE_FACULTY',
            entityType: 'FACULTY',
            entityId: facultyId,
            details: `Deleted faculty ${faculty.full_name} (${faculty.faculty_id_num})`,
            req
        });

        return success(res, null, 'Faculty record deleted successfully.');
    } catch (err) {
        console.error('[Faculty Delete Error]:', err);
        return error(res, 'Failed to delete faculty record.', 500);
    }
}

module.exports = { getAll, getById, create, update, remove };
