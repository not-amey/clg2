const supabase = require('../database/db');
const { success, error } = require('../utils/response');

async function getStats(req, res) {
    try {
        const [
            { count: totalStudents },
            { count: totalFaculty },
            { count: totalCourses },
            { count: activeNotices },
            { count: pendingApplications },
            { count: activeAdmins }
        ] = await Promise.all([
            supabase.from('students').select('*', { count: 'exact', head: true }),
            supabase.from('faculty').select('*', { count: 'exact', head: true }),
            supabase.from('courses').select('*', { count: 'exact', head: true }),
            supabase.from('notices').select('*', { count: 'exact', head: true }).eq('is_published', 1),
            supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('admins').select('*', { count: 'exact', head: true }).eq('status', 'active')
        ]);

        // Recent Activity Logs (latest 8)
        const { data: recentLogs } = await supabase
            .from('audit_logs')
            .select('id, admin_username, action, entity_type, details, created_at')
            .order('created_at', { ascending: false })
            .limit(8);

        // Department breakdown
        const { data: depts } = await supabase.from('departments').select('id, name, code');
        const { data: studentDepts } = await supabase.from('students').select('department_id');

        const deptCountMap = {};
        (studentDepts || []).forEach(s => {
            if (s.department_id) {
                deptCountMap[s.department_id] = (deptCountMap[s.department_id] || 0) + 1;
            }
        });

        const deptBreakdown = (depts || []).map(d => ({
            dept_name: d.name,
            code: d.code,
            student_count: deptCountMap[d.id] || 0
        }));

        return success(res, {
            counts: {
                totalStudents: totalStudents || 0,
                totalFaculty: totalFaculty || 0,
                totalCourses: totalCourses || 0,
                activeNotices: activeNotices || 0,
                pendingApplications: pendingApplications || 0,
                activeAdmins: activeAdmins || 0
            },
            recentLogs: recentLogs || [],
            deptBreakdown: deptBreakdown || []
        }, 'Dashboard statistics retrieved successfully');
    } catch (err) {
        console.error('[Dashboard Error]:', err);
        return error(res, 'Failed to fetch dashboard statistics.', 500);
    }
}

module.exports = { getStats };
