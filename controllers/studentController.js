const supabase = require('../database/db');
const { uploadToSupabase } = require('../utils/supabase');
const { logAudit } = require('../utils/auditLogger');
const { success, error } = require('../utils/response');

const DIV_LETTER_TO_NUM = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
const DIV_NUM_TO_LETTER = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };

function encodeSem(standard, division) {
    const is12 = standard && (standard.toString().includes('12') || standard === 12);
    const stdBase = is12 ? 120 : 110;
    const divNum = DIV_LETTER_TO_NUM[(division || 'A').toUpperCase()] || 1;
    return stdBase + divNum;
}

function decodeSem(semester, docPath) {
    let division = 'A';
    if (docPath) {
        const m = docPath.match(/div[:=]([A-D])/i);
        if (m) division = m[1].toUpperCase();
    }

    let standard = '11th';
    const sem = parseInt(semester, 10) || 11;
    if (sem >= 120 && sem < 130) {
        standard = '12th';
        if (!docPath || !docPath.match(/div[:=]/i)) {
            division = DIV_NUM_TO_LETTER[sem % 10] || 'A';
        }
    } else if (sem >= 110 && sem < 120) {
        standard = '11th';
        if (!docPath || !docPath.match(/div[:=]/i)) {
            division = DIV_NUM_TO_LETTER[sem % 10] || 'A';
        }
    } else if (sem === 12 || sem === 2) {
        standard = '12th';
    } else {
        standard = '11th';
    }

    return { standard, division };
}

function cleanDocPath(docPath) {
    if (!docPath) return null;
    if (docPath.startsWith('div:') || docPath.startsWith('#div=')) return null;
    return docPath.replace(/#div=[A-D]/i, '');
}

/**
 * Natural Alphanumeric Sort for Roll Numbers (Prefix A-Z, then numeric value)
 */
function compareRollNumbers(a, b) {
    const rollA = (a.roll_number || '').toString().trim();
    const rollB = (b.roll_number || '').toString().trim();

    const matchA = rollA.match(/^([A-Za-z_-]*)(\d+)(.*)$/);
    const matchB = rollB.match(/^([A-Za-z_-]*)(\d+)(.*)$/);

    if (matchA && matchB) {
        const prefixA = matchA[1].toUpperCase();
        const prefixB = matchB[1].toUpperCase();
        if (prefixA !== prefixB) {
            return prefixA.localeCompare(prefixB);
        }
        const numA = parseInt(matchA[2], 10);
        const numB = parseInt(matchB[2], 10);
        if (numA !== numB) {
            return numA - numB;
        }
        return (matchA[3] || '').localeCompare(matchB[3] || '');
    }

    return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
}

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
        const division = req.query.division ? req.query.division.trim().toUpperCase() : null;
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

            if (standard || division) {
                const divNums = division ? [DIV_LETTER_TO_NUM[division] || 1] : [1, 2, 3, 4];
                let semValues = [];
                if (!standard || standard.includes('11')) {
                    divNums.forEach(d => semValues.push(110 + d));
                    if (!division || division === 'A') {
                        semValues.push(11, 1);
                    }
                }
                if (!standard || standard.includes('12')) {
                    divNums.forEach(d => semValues.push(120 + d));
                    if (!division || division === 'A') {
                        semValues.push(12, 2);
                    }
                }
                query = query.in('semester', semValues);
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
            const { standard: std, division: div } = decodeSem(s.semester, s.document_path);
            const deptName = s.departments ? s.departments.name : null;
            return {
                ...s,
                department_name: deptName,
                department_code: s.departments ? s.departments.code : null,
                standard: std,
                division: div,
                stream: deptName || 'Science',
                document_path: cleanDocPath(s.document_path),
                departments: undefined
            };
        });

        students.sort(compareRollNumbers);

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

        const { standard: std, division: div } = decodeSem(s.semester, s.document_path);
        const deptName = s.departments ? s.departments.name : null;

        const student = {
            ...s,
            department_name: deptName,
            department_code: s.departments ? s.departments.code : null,
            standard: std,
            division: div,
            stream: deptName || 'Science',
            document_path: cleanDocPath(s.document_path),
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
        const { roll_number, full_name, email, phone, department_id, stream, standard, division, semester, enrollment_year, status } = req.body;
        
        let document_path = null;
        if (req.file) {
            document_path = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'student_documents');
        }

        let resolvedDeptId = department_id ? parseInt(department_id, 10) : null;
        if (!resolvedDeptId && stream) {
            const { data: dept } = await supabase.from('departments').select('id').ilike('name', stream.trim()).maybeSingle();
            if (dept) resolvedDeptId = dept.id;
        }

        const div = (division || 'A').toString().trim().toUpperCase();
        const sem = encodeSem(standard || semester, div);
        const storedDocPath = document_path ? `${document_path}#div=${div}` : `div:${div}`;

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
                document_path: storedDocPath
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
        const { roll_number, full_name, email, phone, department_id, stream, standard, division, semester, enrollment_year, status } = req.body;

        const { data: current } = await supabase.from('students').select('*').eq('id', studentId).single();
        if (!current) {
            return error(res, 'Student not found.', 404);
        }

        let resolvedDeptId = department_id ? parseInt(department_id, 10) : (current.department_id || null);
        if (stream) {
            const { data: dept } = await supabase.from('departments').select('id').ilike('name', stream.trim()).maybeSingle();
            if (dept) resolvedDeptId = dept.id;
        }

        const currentDecoded = decodeSem(current.semester, current.document_path);
        const div = division ? division.toString().trim().toUpperCase() : currentDecoded.division;
        const sem = encodeSem(standard || currentDecoded.standard, div);

        let document_path = current.document_path;
        if (req.file) {
            const rawUpload = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'student_documents');
            document_path = `${rawUpload}#div=${div}`;
        } else if (current.document_path && !current.document_path.startsWith('div:')) {
            document_path = `${cleanDocPath(current.document_path)}#div=${div}`;
        } else {
            document_path = `div:${div}`;
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

module.exports = { getAll, getById, create, update, remove, decodeSem, encodeSem };
