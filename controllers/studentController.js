const supabase = require('../database/db');
const { uploadToSupabase } = require('../utils/supabase');
const { logAudit } = require('../utils/auditLogger');
const { success, error } = require('../utils/response');

/**
 * Get all students with pagination, search, and department filter
 */
async function getAll(req, res) {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '50', 10);
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : null;
        let deptId = req.query.department_id ? parseInt(req.query.department_id, 10) : null;
        const stream = req.query.stream ? req.query.stream.trim() : null;
        const standard = req.query.standard ? req.query.standard.trim() : null;
        const status = req.query.status || null;

        let query = supabase
            .from('students')
            .select('*, departments(name, code)', { count: 'exact' });

        if (search) {
            // Search across all students regardless of filter
            query = query.or(`roll_number.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
        } else {
            if (!deptId && stream) {
                const { data: dept } = await supabase.from('departments').select('id').ilike('name', stream).maybeSingle();
                if (dept) deptId = dept.id;
            }

            if (deptId) {
                query = query.eq('department_id', deptId);
            }

            if (standard) {
                const is12 = standard.includes('12');
                query = is12 ? query.in('semester', [12, 2]) : query.in('semester', [11, 1]);
            }
        }

        if (status) {
            query = query.eq('status', status);
        }

        query = query.order('id', { ascending: false }).range(offset, offset + limit - 1);

        const { data, count, error: dbErr } = await query;
        if (dbErr) throw dbErr;

        const totalItems = count || 0;
        const totalPages = Math.ceil(totalItems / limit) || 1;

        const students = (data || []).map(s => {
            const is12 = s.semester === 12 || s.semester === 2;
            const deptName = s.departments ? s.departments.name : null;
            return {
                ...s,
                department_name: deptName,
                department_code: s.departments ? s.departments.code : null,
                standard: is12 ? '12th' : '11th',
                stream: deptName || 'Science',
                departments: undefined
            };
        });

        return success(res, students, 'Students fetched successfully', 200, {
            page,
            limit,
            totalItems,
            totalPages
        });
    } catch (err) {
        console.error('[Student GetAll Error]:', err);
        return error(res, 'Failed to retrieve students.', 500);
    }
}

/**
 * Get Single Student by ID
 */
async function getById(req, res) {
    try {
        const { data: s, error: dbErr } = await supabase
            .from('students')
            .select('*, departments(name, code)')
            .eq('id', req.params.id)
            .single();

        if (dbErr || !s) {
            return error(res, 'Student record not found.', 404);
        }

        const is12 = s.semester === 12 || s.semester === 2;
        const deptName = s.departments ? s.departments.name : null;

        const student = {
            ...s,
            department_name: deptName,
            department_code: s.departments ? s.departments.code : null,
            standard: is12 ? '12th' : '11th',
            stream: deptName || 'Science',
            departments: undefined
        };

        return success(res, student);
    } catch (err) {
        console.error('[Student GetById Error]:', err);
        return error(res, 'Failed to fetch student record.', 500);
    }
}

/**
 * Create New Student
 */
async function create(req, res) {
    try {
        const { roll_number, full_name, email, phone, department_id, stream, standard, semester, enrollment_year, status } = req.body;
        
        let document_path = null;
        if (req.file) {
            document_path = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'student_documents');
        }

        let resolvedDeptId = department_id ? parseInt(department_id, 10) : null;
        if (!resolvedDeptId && stream) {
            const { data: dept } = await supabase.from('departments').select('id').ilike('name', stream.trim()).maybeSingle();
            if (dept) resolvedDeptId = dept.id;
        }

        let sem = 11;
        if (standard) {
            const stdStr = standard.toString().toLowerCase();
            sem = (stdStr.includes('12') || stdStr === '12th' || stdStr === '12') ? 12 : 11;
        } else if (semester) {
            const sInt = parseInt(semester, 10);
            sem = (sInt === 12 || sInt === 2) ? 12 : 11;
        }

        const hasCustomEmail = email && email.trim();
        const cleanEmail = hasCustomEmail ? email.trim() : `${roll_number.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}@student.local`;

        let dupFilter = `roll_number.eq.${roll_number}`;
        if (hasCustomEmail) {
            dupFilter += `,email.eq.${cleanEmail}`;
        }

        const { data: existing } = await supabase
            .from('students')
            .select('id')
            .or(dupFilter)
            .limit(1);

        if (existing && existing.length > 0) {
            return error(res, 'Student with this roll number or email already exists.', 400);
        }

        const { data: inserted, error: insertErr } = await supabase
            .from('students')
            .insert({
                roll_number,
                full_name,
                email: cleanEmail,
                phone: phone ? phone.trim() : null,
                department_id: resolvedDeptId,
                semester: sem,
                enrollment_year: parseInt(enrollment_year, 10) || new Date().getFullYear(),
                status: status || 'active',
                document_path
            })
            .select('id')
            .single();

        if (insertErr) throw insertErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'CREATE_STUDENT',
            entityType: 'STUDENT',
            entityId: inserted.id,
            details: `Added student ${full_name} (${roll_number})`,
            req
        });

        return success(res, { id: inserted.id }, 'Student record created successfully.', 201);
    } catch (err) {
        console.error('[Student Create Error]:', err);
        return error(res, 'Failed to create student record.', 500);
    }
}

/**
 * Update Student Record
 */
async function update(req, res) {
    try {
        const studentId = req.params.id;
        const { roll_number, full_name, email, phone, department_id, stream, standard, semester, enrollment_year, status } = req.body;

        const { data: current } = await supabase.from('students').select('*').eq('id', studentId).single();
        if (!current) {
            return error(res, 'Student not found.', 404);
        }

        let resolvedDeptId = department_id ? parseInt(department_id, 10) : (current.department_id || null);
        if (stream) {
            const { data: dept } = await supabase.from('departments').select('id').ilike('name', stream.trim()).maybeSingle();
            if (dept) resolvedDeptId = dept.id;
        }

        let sem = current.semester || 11;
        if (standard) {
            const stdStr = standard.toString().toLowerCase();
            sem = (stdStr.includes('12') || stdStr === '12th' || stdStr === '12') ? 12 : 11;
        } else if (semester) {
            const sInt = parseInt(semester, 10);
            sem = (sInt === 12 || sInt === 2) ? 12 : 11;
        }

        const hasCustomEmail = email && email.trim();
        const cleanEmail = hasCustomEmail ? email.trim() : `${roll_number.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}@student.local`;

        let dupFilter = `roll_number.eq.${roll_number}`;
        if (hasCustomEmail) {
            dupFilter += `,email.eq.${cleanEmail}`;
        }

        const { data: duplicate } = await supabase
            .from('students')
            .select('id')
            .or(dupFilter)
            .neq('id', studentId)
            .limit(1);

        if (duplicate && duplicate.length > 0) {
            return error(res, 'Another student with this roll number or email already exists.', 400);
        }

        let document_path = current.document_path;
        if (req.file) {
            document_path = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'student_documents');
        }

        const { error: updateErr } = await supabase
            .from('students')
            .update({
                roll_number,
                full_name,
                email: cleanEmail,
                phone: phone ? phone.trim() : null,
                department_id: resolvedDeptId,
                semester: sem,
                enrollment_year: parseInt(enrollment_year, 10) || current.enrollment_year,
                status: status || current.status,
                document_path
            })
            .eq('id', studentId);

        if (updateErr) throw updateErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'UPDATE_STUDENT',
            entityType: 'STUDENT',
            entityId: studentId,
            details: `Updated student record for ${full_name} (${roll_number})`,
            req
        });

        return success(res, null, 'Student record updated successfully.');
    } catch (err) {
        console.error('[Student Update Error]:', err);
        return error(res, 'Failed to update student record.', 500);
    }
}

/**
 * Delete Student Record
 */
async function remove(req, res) {
    try {
        const studentId = req.params.id;
        const { data: student } = await supabase.from('students').select('*').eq('id', studentId).single();

        if (!student) {
            return error(res, 'Student not found.', 404);
        }

        const { error: delErr } = await supabase.from('students').delete().eq('id', studentId);
        if (delErr) throw delErr;

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'DELETE_STUDENT',
            entityType: 'STUDENT',
            entityId: studentId,
            details: `Deleted student ${student.full_name} (${student.roll_number})`,
            req
        });

        return success(res, null, 'Student record deleted successfully.');
    } catch (err) {
        console.error('[Student Delete Error]:', err);
        return error(res, 'Failed to delete student record.', 500);
    }
}

module.exports = { getAll, getById, create, update, remove };
