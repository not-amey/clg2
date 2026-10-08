const supabase = require('../database/db');
const { logAudit } = require('../utils/auditLogger');
const { success, error } = require('../utils/response');

/**
 * Get all courses with pagination, search, and department filter
 */
async function getAll(req, res) {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : null;
        const deptId = req.query.department_id ? parseInt(req.query.department_id, 10) : null;

        let query = supabase
            .from('courses')
            .select('*, departments(name, code), faculty(full_name)', { count: 'exact' });

        if (search) {
            query = query.or(`course_code.ilike.%${search}%,title.ilike.%${search}%`);
        }

        if (deptId) {
            query = query.eq('department_id', deptId);
        }

        query = query.order('id', { ascending: false }).range(offset, offset + limit - 1);

        const { data, count, error: dbErr } = await query;
        if (dbErr) throw dbErr;

        const totalItems = count || 0;
        const totalPages = Math.ceil(totalItems / limit) || 1;

        const courses = (data || []).map(c => ({
            ...c,
            department_name: c.departments ? c.departments.name : null,
            department_code: c.departments ? c.departments.code : null,
            faculty_name: c.faculty ? c.faculty.full_name : null,
            departments: undefined,
            faculty: undefined
        }));

        return success(res, courses, 'Courses fetched successfully', 200, {
            page,
            limit,
            totalItems,
            totalPages
        });
    } catch (err) {
        console.error('[Course GetAll Error]:', err);
        return error(res, 'Failed to retrieve courses.', 500);
    }
}

/**
 * Get single course by ID
 */
async function getById(req, res) {
    try {
        const { data: c, error: dbErr } = await supabase
            .from('courses')
            .select('*, departments(name, code), faculty(full_name)')
            .eq('id', req.params.id)
            .single();

        if (dbErr || !c) {
            return error(res, 'Course not found.', 404);
        }

        const course = {
            ...c,
            department_name: c.departments ? c.departments.name : null,
            department_code: c.departments ? c.departments.code : null,
            faculty_name: c.faculty ? c.faculty.full_name : null,
            departments: undefined,
            faculty: undefined
        };

        return success(res, course);
    } catch (err) {
        console.error('[Course GetById Error]:', err);
        return error(res, 'Failed to fetch course details.', 500);
    }
}

/**
 * Create Course
 */
async function create(req, res) {
    try {
        const { course_code, title, department_id, credits, semester, faculty_id, description } = req.body;

        const { data: existing } = await supabase.from('courses').select('id').eq('course_code', course_code).limit(1);
        if (existing && existing.length > 0) {
            return error(res, 'Course code already exists.', 400);
        }

        const { data: inserted, error: insertErr } = await supabase
            .from('courses')
            .insert({
                course_code,
                title,
                department_id: department_id ? parseInt(department_id, 10) : null,
                credits: parseInt(credits, 10),
                semester: parseInt(semester, 10),
                faculty_id: faculty_id ? parseInt(faculty_id, 10) : null,
                description: description || null
            })
            .select('id')
            .single();

        if (insertErr) throw insertErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'CREATE_COURSE',
            entityType: 'COURSE',
            entityId: inserted.id,
            details: `Created course ${course_code}: ${title}`,
            req
        });

        return success(res, { id: inserted.id }, 'Course created successfully.', 201);
    } catch (err) {
        console.error('[Course Create Error]:', err);
        return error(res, 'Failed to create course.', 500);
    }
}

/**
 * Update Course
 */
async function update(req, res) {
    try {
        const courseId = req.params.id;
        const { course_code, title, department_id, credits, semester, faculty_id, description } = req.body;

        const { data: existing } = await supabase
            .from('courses')
            .select('id')
            .eq('course_code', course_code)
            .neq('id', courseId)
            .limit(1);

        if (existing && existing.length > 0) {
            return error(res, 'Another course with this course code already exists.', 400);
        }

        const { error: updateErr } = await supabase
            .from('courses')
            .update({
                course_code,
                title,
                department_id: department_id ? parseInt(department_id, 10) : null,
                credits: parseInt(credits, 10),
                semester: parseInt(semester, 10),
                faculty_id: faculty_id ? parseInt(faculty_id, 10) : null,
                description: description || null
            })
            .eq('id', courseId);

        if (updateErr) throw updateErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'UPDATE_COURSE',
            entityType: 'COURSE',
            entityId: courseId,
            details: `Updated course ${course_code}: ${title}`,
            req
        });

        return success(res, null, 'Course updated successfully.');
    } catch (err) {
        console.error('[Course Update Error]:', err);
        return error(res, 'Failed to update course.', 500);
    }
}

/**
 * Delete Course
 */
async function remove(req, res) {
    try {
        const courseId = req.params.id;
        const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();

        if (!course) {
            return error(res, 'Course not found.', 404);
        }

        const { error: delErr } = await supabase.from('courses').delete().eq('id', courseId);
        if (delErr) throw delErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'DELETE_COURSE',
            entityType: 'COURSE',
            entityId: courseId,
            details: `Deleted course ${course.course_code}`,
            req
        });

        return success(res, null, 'Course deleted successfully.');
    } catch (err) {
        console.error('[Course Delete Error]:', err);
        return error(res, 'Failed to delete course.', 500);
    }
}

/**
 * Get All Departments (Utility for Dropdowns)
 */
async function getDepartments(req, res) {
    try {
        const { data: depts, error: dbErr } = await supabase.from('departments').select('*').order('name', { ascending: true });
        if (dbErr) throw dbErr;

        return success(res, depts || []);
    } catch (err) {
        console.error('[Course GetDepartments Error]:', err);
        return error(res, 'Failed to fetch departments.', 500);
    }
}

module.exports = { getAll, getById, create, update, remove, getDepartments };
