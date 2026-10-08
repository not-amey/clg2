const supabase = require('./db');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
    console.log('[Seed] Seeding Supabase database with initial data...');

    // 1. Seed Admins
    const saltRounds = 10;
    const defaultPassword = await bcrypt.hash('Admin@123456', saltRounds);
    const facultyPassword = await bcrypt.hash('Faculty@123456', saltRounds);
    const staffPassword = await bcrypt.hash('Staff@123456', saltRounds);

    const adminsToSeed = [
        { username: 'admin', email: 'admin@college.edu', password_hash: defaultPassword, full_name: 'System Super Admin', role: 'super_admin' },
        { username: 'faculty_head', email: 'faculty.head@college.edu', password_hash: facultyPassword, full_name: 'Dr. Sarah Jenkins', role: 'faculty_admin' },
        { username: 'staff_user', email: 'staff.admissions@college.edu', password_hash: staffPassword, full_name: 'Robert Miller', role: 'staff_admin' }
    ];

    for (const admin of adminsToSeed) {
        const { data: existing } = await supabase.from('admins').select('id').eq('username', admin.username).maybeSingle();
        if (!existing) {
            await supabase.from('admins').insert(admin);
        }
    }

    console.log('[Seed] Admin users verified:');
    console.log('  - super_admin   -> username: admin / pass: Admin@123456');
    console.log('  - faculty_admin -> username: faculty_head / pass: Faculty@123456');
    console.log('  - staff_admin   -> username: staff_user / pass: Staff@123456');

    // 2. Seed Departments
    const deptsToSeed = [
        { code: 'CSE', name: 'Computer Science & Engineering', description: 'Department of Computer Science, Software Engineering and AI' },
        { code: 'ECE', name: 'Electronics & Communication', description: 'Department of VLSI, Embedded Systems and Signals' },
        { code: 'ME', name: 'Mechanical Engineering', description: 'Department of Robotics, Dynamics and Thermals' },
        { code: 'CE', name: 'Civil Engineering', description: 'Department of Structural and Environmental Engineering' },
        { code: 'MBA', name: 'Business Administration', description: 'Department of Finance, Marketing and Management' }
    ];

    for (const d of deptsToSeed) {
        const { data: existing } = await supabase.from('departments').select('id').eq('code', d.code).maybeSingle();
        if (!existing) {
            await supabase.from('departments').insert(d);
        }
    }

    const { data: depts } = await supabase.from('departments').select('id, code');
    const deptMap = {};
    (depts || []).forEach(d => { deptMap[d.code] = d.id; });

    // 3. Seed Faculty
    const facultyToSeed = [
        { faculty_id_num: 'FAC-CSE-01', full_name: 'Dr. Alan Turing', email: 'alan.turing@college.edu', phone: '+1-555-0101', department_id: deptMap['CSE'], designation: 'Head of Department', qualification: 'Ph.D. in Computer Science', status: 'active' },
        { faculty_id_num: 'FAC-CSE-02', full_name: 'Prof. Grace Hopper', email: 'grace.hopper@college.edu', phone: '+1-555-0102', department_id: deptMap['CSE'], designation: 'Professor', qualification: 'Ph.D. in Mathematics', status: 'active' },
        { faculty_id_num: 'FAC-ECE-01', full_name: 'Dr. Nikola Tesla', email: 'nikola.tesla@college.edu', phone: '+1-555-0103', department_id: deptMap['ECE'], designation: 'Associate Professor', qualification: 'Ph.D. in Electrical Eng', status: 'active' },
        { faculty_id_num: 'FAC-ME-01', full_name: 'Prof. James Watt', email: 'james.watt@college.edu', phone: '+1-555-0104', department_id: deptMap['ME'], designation: 'Assistant Professor', qualification: 'M.Tech in Thermal Science', status: 'active' },
        { faculty_id_num: 'FAC-MBA-01', full_name: 'Dr. Eleanor Vance', email: 'eleanor.vance@college.edu', phone: '+1-555-0105', department_id: deptMap['MBA'], designation: 'Professor', qualification: 'Ph.D. in Finance', status: 'active' }
    ];

    for (const f of facultyToSeed) {
        const { data: existing } = await supabase.from('faculty').select('id').eq('faculty_id_num', f.faculty_id_num).maybeSingle();
        if (!existing) {
            await supabase.from('faculty').insert(f);
        }
    }

    const { data: facultyMembers } = await supabase.from('faculty').select('id, faculty_id_num');
    const facMap = {};
    (facultyMembers || []).forEach(f => { facMap[f.faculty_id_num] = f.id; });

    // 4. Seed Courses
    const coursesToSeed = [
        { course_code: 'CS101', title: 'Data Structures & Algorithms', department_id: deptMap['CSE'], credits: 4, semester: 3, faculty_id: facMap['FAC-CSE-01'], description: 'Fundamental algorithms, tree structures, graph theory and complexity analysis.' },
        { course_code: 'CS202', title: 'Database Management Systems', department_id: deptMap['CSE'], credits: 4, semester: 4, faculty_id: facMap['FAC-CSE-02'], description: 'Relational database design, SQL querying, indexing and transaction processing.' },
        { course_code: 'EC301', title: 'Digital Signal Processing', department_id: deptMap['ECE'], credits: 3, semester: 5, faculty_id: facMap['FAC-ECE-01'], description: 'Discrete Fourier transform, digital filter design, and spectral analysis.' },
        { course_code: 'ME102', title: 'Thermodynamics & Heat Transfer', department_id: deptMap['ME'], credits: 4, semester: 2, faculty_id: facMap['FAC-ME-01'], description: 'First and second laws of thermodynamics, energy balance and steady heat transfer.' },
        { course_code: 'MB501', title: 'Corporate Financial Strategy', department_id: deptMap['MBA'], credits: 3, semester: 1, faculty_id: facMap['FAC-MBA-01'], description: 'Capital budgeting, corporate valuation, mergers & acquisitions.' }
    ];

    for (const c of coursesToSeed) {
        const { data: existing } = await supabase.from('courses').select('id').eq('course_code', c.course_code).maybeSingle();
        if (!existing) {
            await supabase.from('courses').insert(c);
        }
    }

    // 5. Seed Students
    const studentsToSeed = [
        { roll_number: '2024CSE001', full_name: 'Alice Johnson', email: 'alice.j@student.college.edu', phone: '+1-555-0201', department_id: deptMap['CSE'], semester: 3, enrollment_year: 2024, status: 'active' },
        { roll_number: '2024CSE002', full_name: 'Bob Smith', email: 'bob.s@student.college.edu', phone: '+1-555-0202', department_id: deptMap['CSE'], semester: 3, enrollment_year: 2024, status: 'active' },
        { roll_number: '2023ECE015', full_name: 'Charlie Brown', email: 'charlie.b@student.college.edu', phone: '+1-555-0203', department_id: deptMap['ECE'], semester: 5, enrollment_year: 2023, status: 'active' },
        { roll_number: '2024ME008', full_name: 'Diana Prince', email: 'diana.p@student.college.edu', phone: '+1-555-0204', department_id: deptMap['ME'], semester: 2, enrollment_year: 2024, status: 'active' },
        { roll_number: '2023CE012', full_name: 'Edward Elric', email: 'edward.e@student.college.edu', phone: '+1-555-0205', department_id: deptMap['CE'], semester: 6, enrollment_year: 2023, status: 'active' }
    ];

    for (const s of studentsToSeed) {
        const { data: existing } = await supabase.from('students').select('id').eq('roll_number', s.roll_number).maybeSingle();
        if (!existing) {
            await supabase.from('students').insert(s);
        }
    }

    // 6. Seed Notices
    const { data: superAdminObj } = await supabase.from('admins').select('id').eq('username', 'admin').single();
    if (superAdminObj) {
        const noticesToSeed = [
            { title: 'Mid-Semester Examination Schedule Fall 2026', category: 'examination', content: 'The Mid-Semester examinations for all undergraduate programs will commence from October 15, 2026. Detailed date-sheets are posted on the student portal.', target_audience: 'students', priority: 'high', is_published: 1, created_by: superAdminObj.id },
            { title: 'Annual Tech Symposium "Innovate 2026"', category: 'event', content: 'Department of Computer Science presents Innovate 2026. Call for papers and project prototypes is now open. Cash prizes worth $5,000 to be won!', target_audience: 'all', priority: 'normal', is_published: 1, created_by: superAdminObj.id },
            { title: 'Faculty Research Grant Applications 2026-27', category: 'academic', content: 'The Dean of Research invites faculty proposals for interdisciplinary research grants. Submission deadline is November 30, 2026.', target_audience: 'faculty', priority: 'normal', is_published: 1, created_by: superAdminObj.id }
        ];

        for (const n of noticesToSeed) {
            const { data: existing } = await supabase.from('notices').select('id').eq('title', n.title).maybeSingle();
            if (!existing) {
                await supabase.from('notices').insert(n);
            }
        }
    }

    // 7. Seed Applications
    const appsToSeed = [
        { application_no: 'APP2026-001', applicant_name: 'Fiona Gallagher', email: 'fiona.g@gmail.com', phone: '+1-555-0301', applied_department_id: deptMap['CSE'], previous_marks_percentage: 92.5, status: 'approved', reviewer_notes: 'Excellent high school transcript in Math and Physics.' },
        { application_no: 'APP2026-002', applicant_name: 'George Clark', email: 'george.c@gmail.com', phone: '+1-555-0302', applied_department_id: deptMap['ECE'], previous_marks_percentage: 85.0, status: 'pending', reviewer_notes: null },
        { application_no: 'APP2026-003', applicant_name: 'Hannah Abbott', email: 'hannah.a@gmail.com', phone: '+1-555-0303', applied_department_id: deptMap['MBA'], previous_marks_percentage: 78.4, status: 'under_review', reviewer_notes: 'Interview scheduled for next Tuesday.' }
    ];

    for (const a of appsToSeed) {
        const { data: existing } = await supabase.from('applications').select('id').eq('application_no', a.application_no).maybeSingle();
        if (!existing) {
            await supabase.from('applications').insert(a);
        }
    }

    console.log('[Seed] Supabase database seeding completed successfully.');
}

if (require.main === module) {
    seedDatabase().catch(err => {
        console.error('[Seed Error]:', err);
        process.exit(1);
    });
}

module.exports = seedDatabase;
