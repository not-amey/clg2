/**
 * Single-Page Admin Dashboard Controller
 */

let state = {
    currentTab: 'dashboard',
    departments: [],
    facultyList: [],
    students: { page: 1, limit: 10, totalPages: 1, search: '', dept: '', status: '' },
    faculty: { page: 1, limit: 10, totalPages: 1, search: '', dept: '', status: '' },
    courses: { page: 1, limit: 10, totalPages: 1, search: '', dept: '' },
    notices: { page: 1, limit: 10, totalPages: 1, search: '', category: '', target: '' },
    applications: { page: 1, limit: 10, totalPages: 1, search: '', status: '' },
    logs: { page: 1, limit: 15, totalPages: 1, search: '', entity: '' }
};

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkSession();
    if (!user) return;

    await loadDepartments();
    switchTab('dashboard');
});

function switchTab(tabId) {
    state.currentTab = tabId;

    // Highlight sidebar item
    document.querySelectorAll('.nav-item button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick')?.includes(tabId)) {
            btn.classList.add('active');
        }
    });

    // Update Top Header Title
    const titleMap = {
        'dashboard': 'Overview Dashboard',
        'students': 'Student Records Management',
        'faculty': 'Faculty & Staff Directory',
        'courses': 'Course Catalog & Departments',
        'notices': 'Notices & Announcements',
        'applications': 'Admissions & Applications',
        'cms': 'Website Content & Image Management',
        'logs': 'Security Audit Trail & Logs',
        'admins': 'Admin Users & Roles'
    };
    document.getElementById('header-title-text').textContent = titleMap[tabId] || 'Admin Portal';

    // Show/Hide views
    document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
    const activeSec = document.getElementById(`view-${tabId}`);
    if (activeSec) activeSec.style.display = 'block';

    // Fetch view data
    if (tabId === 'dashboard') loadDashboardStats();
    else if (tabId === 'students') loadStudents();
    else if (tabId === 'faculty') loadFaculty();
    else if (tabId === 'courses') loadCourses();
    else if (tabId === 'notices') loadNotices();
    else if (tabId === 'applications') loadApplications();
    else if (tabId === 'cms') loadCMSSettings();
    else if (tabId === 'logs') loadLogs();
    else if (tabId === 'admins') loadAdmins();
}

async function loadDepartments() {
    try {
        const res = await apiRequest('/api/courses/departments');
        if (res.success) {
            state.departments = res.data;
            populateDepartmentSelects();
        }
    } catch (e) {
        console.error(e);
    }
}

function populateDepartmentSelects() {
    const selects = ['filter-student-dept', 'modal-student-dept'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const isFilter = id.startsWith('filter');
        el.innerHTML = isFilter ? '<option value="">All Streams / Departments</option>' : '<option value="">Select Stream / Department</option>';
        state.departments.forEach(d => {
            el.innerHTML += `<option value="${d.id}">${d.name}</option>`;
        });
    });
}

/* ================= 1. DASHBOARD ================= */
async function loadDashboardStats() {
    try {
        const res = await apiRequest('/api/dashboard/stats');
        if (!res.success) return;

        const { counts, recentLogs, deptBreakdown } = res.data;

        if (document.getElementById('stat-students')) document.getElementById('stat-students').textContent = counts.totalStudents;
        if (document.getElementById('stat-faculty')) document.getElementById('stat-faculty').textContent = counts.totalFaculty;
        if (document.getElementById('stat-courses')) document.getElementById('stat-courses').textContent = counts.totalCourses;
        if (document.getElementById('stat-notices')) document.getElementById('stat-notices').textContent = counts.activeNotices;
        if (document.getElementById('stat-apps')) document.getElementById('stat-apps').textContent = counts.pendingApplications;
        if (document.getElementById('stat-admins')) document.getElementById('stat-admins').textContent = counts.activeAdmins;

        // Render Recent Activity Stream
        const logsContainer = document.getElementById('recent-activity-list');
        if (logsContainer) {
            logsContainer.innerHTML = recentLogs.map(log => `
                <div style="display: flex; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid var(--border-glass);">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: #1E293B; color: #94A3B8; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-history"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                            <strong>${log.admin_username}</strong>
                            <span style="color: var(--text-dim);">${new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem;">${log.action} - ${log.details}</p>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        showToast('Failed to load dashboard stats', 'error');
    }
}

/* ================= 2. STUDENTS ================= */
async function loadStudents(page = 1) {
    state.students.page = page;
    const search = document.getElementById('search-student')?.value || '';
    const dept = document.getElementById('filter-student-dept')?.value || '';
    const status = document.getElementById('filter-student-status')?.value || '';

    try {
        const query = `page=${page}&limit=${state.students.limit}&search=${encodeURIComponent(search)}&department_id=${dept}&status=${status}`;
        const res = await apiRequest(`/api/students?${query}`);
        if (!res.success) return;

        const tableBody = document.getElementById('student-table-body');
        tableBody.innerHTML = res.data.map(s => `
            <tr>
                <td><strong>${s.roll_number}</strong></td>
                <td>
                    <div style="font-weight: 600;">${s.full_name}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${s.email || (s.phone ? 'Phone: ' + s.phone : 'No Contact Info')}</div>
                </td>
                <td>${s.department_name || 'Unassigned'}</td>
                <td><span class="badge badge-${s.status}">${s.status}</span></td>
                <td>
                    ${s.document_path ? `<a href="${s.document_path}" target="_blank" class="btn btn-sm btn-secondary"><i class="fas fa-file-pdf"></i> Doc</a>` : '<span style="color: var(--text-dim);">None</span>'}
                </td>
                <td>
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-sm btn-secondary" onclick="openStudentModal(${s.id})"><i class="fas fa-edit"></i> Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id}, '${s.full_name}')" data-role-required="super_admin"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        renderPagination('student-pagination', res.meta, loadStudents);
    } catch (err) {
        showToast('Failed to load student records', 'error');
    }
}

function editStudent(id) {
    openStudentModal(id);
}

function openStudentModal(id = null) {
    document.getElementById('student-form').reset();
    document.getElementById('student-id').value = id || '';
    document.getElementById('modal-student-title').textContent = id ? 'Edit Student Record' : 'Add New Student';

    if (id) {
        apiRequest(`/api/students/${id}`).then(res => {
            if (res.success) {
                const s = res.data;
                document.getElementById('modal-student-roll').value = s.roll_number || '';
                document.getElementById('modal-student-name').value = s.full_name || '';
                document.getElementById('modal-student-email').value = s.email || '';
                document.getElementById('modal-student-phone').value = s.phone || '';
                document.getElementById('modal-student-dept').value = s.department_id || '';
                if (document.getElementById('modal-student-sem')) {
                    document.getElementById('modal-student-sem').value = s.semester || 1;
                }
                document.getElementById('modal-student-year').value = s.enrollment_year || 2026;
                document.getElementById('modal-student-status').value = s.status || 'active';
            }
        });
    }

    openModal('modal-student');
}

async function saveStudent(e) {
    e.preventDefault();
    const id = document.getElementById('student-id').value;
    const formData = new FormData(document.getElementById('student-form'));

    try {
        const url = id ? `/api/students/${id}` : '/api/students';
        const method = id ? 'PUT' : 'POST';

        const res = await apiRequest(url, method, formData, true);
        if (res.success) {
            showToast(res.message, 'success');
            closeModal('modal-student');
            loadStudents(state.students.page);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteStudent(id, name) {
    if (!confirm(`Are you sure you want to delete student "${name}"?`)) return;
    try {
        const res = await apiRequest(`/api/students/${id}`, 'DELETE');
        if (res.success) {
            showToast('Student deleted successfully', 'success');
            loadStudents(state.students.page);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ================= 3. FACULTY ================= */
async function loadFaculty(page = 1) {
    state.faculty.page = page;
    const search = document.getElementById('search-faculty')?.value || '';
    const dept = document.getElementById('filter-faculty-dept')?.value || '';

    try {
        const query = `page=${page}&limit=${state.faculty.limit}&search=${encodeURIComponent(search)}&department_id=${dept}`;
        const res = await apiRequest(`/api/faculty?${query}`);
        if (!res.success) return;

        const tableBody = document.getElementById('faculty-table-body');
        tableBody.innerHTML = res.data.map(f => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        ${f.photo_path ? `<img src="${f.photo_path}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700;">${f.full_name.charAt(0)}</div>`}
                        <div>
                            <div style="font-weight: 600;">${f.full_name}</div>
                            <div style="font-size: 0.78rem; color: var(--text-muted);">${f.faculty_id_num}</div>
                        </div>
                    </div>
                </td>
                <td>${f.designation}</td>
                <td>${f.department_name || 'Unassigned'}</td>
                <td>${f.email}</td>
                <td><span class="badge badge-${f.status}">${f.status}</span></td>
                <td>
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-sm btn-secondary" onclick="editFaculty(${f.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteFaculty(${f.id}, '${f.full_name}')" data-role-required="super_admin"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        renderPagination('faculty-pagination', res.meta, loadFaculty);
    } catch (err) {
        showToast('Failed to load faculty list', 'error');
    }
}

function openFacultyModal(id = null) {
    document.getElementById('faculty-form').reset();
    document.getElementById('faculty-id').value = id || '';
    document.getElementById('modal-faculty-title').textContent = id ? 'Edit Faculty Record' : 'Add New Faculty Member';

    if (id) {
        apiRequest(`/api/faculty/${id}`).then(res => {
            if (res.success) {
                const f = res.data;
                document.getElementById('modal-faculty-num').value = f.faculty_id_num;
                document.getElementById('modal-faculty-name').value = f.full_name;
                document.getElementById('modal-faculty-email').value = f.email;
                document.getElementById('modal-faculty-phone').value = f.phone || '';
                document.getElementById('modal-faculty-dept').value = f.department_id || '';
                document.getElementById('modal-faculty-desig').value = f.designation;
                document.getElementById('modal-faculty-qual').value = f.qualification || '';
                document.getElementById('modal-faculty-status').value = f.status;
            }
        });
    }

    openModal('modal-faculty');
}

async function saveFaculty(e) {
    e.preventDefault();
    const id = document.getElementById('faculty-id').value;
    const formData = new FormData(document.getElementById('faculty-form'));

    try {
        const url = id ? `/api/faculty/${id}` : '/api/faculty';
        const method = id ? 'PUT' : 'POST';

        const res = await apiRequest(url, method, formData, true);
        if (res.success) {
            showToast(res.message, 'success');
            closeModal('modal-faculty');
            loadFaculty(state.faculty.page);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteFaculty(id, name) {
    if (!confirm(`Are you sure you want to delete faculty member "${name}"?`)) return;
    try {
        const res = await apiRequest(`/api/faculty/${id}`, 'DELETE');
        if (res.success) {
            showToast('Faculty deleted successfully', 'success');
            loadFaculty(state.faculty.page);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ================= 4. COURSES ================= */
async function loadCourses(page = 1) {
    state.courses.page = page;
    const search = document.getElementById('search-course')?.value || '';
    const dept = document.getElementById('filter-course-dept')?.value || '';

    try {
        const query = `page=${page}&limit=${state.courses.limit}&search=${encodeURIComponent(search)}&department_id=${dept}`;
        const res = await apiRequest(`/api/courses?${query}`);
        if (!res.success) return;

        const tableBody = document.getElementById('course-table-body');
        tableBody.innerHTML = res.data.map(c => `
            <tr>
                <td><strong>${c.course_code}</strong></td>
                <td>
                    <div style="font-weight: 600;">${c.title}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${c.description || ''}</div>
                </td>
                <td>${c.department_name || 'N/A'}</td>
                <td>${c.credits} Credits</td>
                <td>Sem ${c.semester}</td>
                <td>${c.faculty_name || 'Unassigned'}</td>
                <td>
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-sm btn-secondary" onclick="editCourse(${c.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCourse(${c.id}, '${c.course_code}')" data-role-required="super_admin"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        renderPagination('course-pagination', res.meta, loadCourses);
    } catch (err) {
        showToast('Failed to load course list', 'error');
    }
}

function openCourseModal(id = null) {
    document.getElementById('course-form').reset();
    document.getElementById('course-id').value = id || '';
    document.getElementById('modal-course-title').textContent = id ? 'Edit Course' : 'Add New Course';

    if (id) {
        apiRequest(`/api/courses/${id}`).then(res => {
            if (res.success) {
                const c = res.data;
                document.getElementById('modal-course-code').value = c.course_code;
                document.getElementById('modal-course-name').value = c.title;
                document.getElementById('modal-course-dept').value = c.department_id;
                document.getElementById('modal-course-credits').value = c.credits;
                document.getElementById('modal-course-sem').value = c.semester;
                document.getElementById('modal-course-desc').value = c.description || '';
            }
        });
    }

    openModal('modal-course');
}

async function saveCourse(e) {
    e.preventDefault();
    const id = document.getElementById('course-id').value;
    const body = {
        course_code: document.getElementById('modal-course-code').value.trim(),
        title: document.getElementById('modal-course-name').value.trim(),
        department_id: document.getElementById('modal-course-dept').value,
        credits: document.getElementById('modal-course-credits').value,
        semester: document.getElementById('modal-course-sem').value,
        description: document.getElementById('modal-course-desc').value.trim()
    };

    try {
        const url = id ? `/api/courses/${id}` : '/api/courses';
        const method = id ? 'PUT' : 'POST';

        const res = await apiRequest(url, method, body);
        if (res.success) {
            showToast(res.message, 'success');
            closeModal('modal-course');
            loadCourses(state.courses.page);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteCourse(id, code) {
    if (!confirm(`Are you sure you want to delete course "${code}"?`)) return;
    try {
        const res = await apiRequest(`/api/courses/${id}`, 'DELETE');
        if (res.success) {
            showToast('Course deleted successfully', 'success');
            loadCourses(state.courses.page);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ================= 5. NOTICES ================= */
async function loadNotices(page = 1) {
    state.notices.page = page;
    const search = document.getElementById('search-notice')?.value || '';
    const category = document.getElementById('filter-notice-category')?.value || '';

    try {
        const query = `page=${page}&limit=${state.notices.limit}&search=${encodeURIComponent(search)}&category=${category}`;
        const res = await apiRequest(`/api/notices?${query}`);
        if (!res.success) return;

        const tableBody = document.getElementById('notice-table-body');
        tableBody.innerHTML = res.data.map(n => `
            <tr>
                <td>
                    <div style="font-weight: 600;">${n.title}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${new Date(n.publish_date).toLocaleDateString()}</div>
                </td>
                <td><span class="badge badge-active">${n.category}</span></td>
                <td><span class="badge badge-${n.priority === 'urgent' ? 'rejected' : 'pending'}">${n.priority}</span></td>
                <td>${n.target_audience}</td>
                <td>
                    ${n.attachment_path ? `<a href="${n.attachment_path}" target="_blank" class="btn btn-sm btn-secondary"><i class="fas fa-paperclip"></i> View</a>` : '<span style="color: var(--text-dim);">None</span>'}
                </td>
                <td>
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-sm btn-secondary" onclick="editNotice(${n.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteNotice(${n.id}, '${n.title}')" data-role-required="super_admin"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        renderPagination('notice-pagination', res.meta, loadNotices);
    } catch (err) {
        showToast('Failed to load notices', 'error');
    }
}

function openNoticeModal(id = null) {
    document.getElementById('notice-form').reset();
    document.getElementById('notice-id').value = id || '';

    if (id) {
        apiRequest(`/api/notices/${id}`).then(res => {
            if (res.success) {
                const n = res.data;
                document.getElementById('modal-notice-title').value = n.title;
                document.getElementById('modal-notice-cat').value = n.category;
                document.getElementById('modal-notice-target').value = n.target_audience;
                document.getElementById('modal-notice-priority').value = n.priority;
                document.getElementById('modal-notice-content').value = n.content;
            }
        });
    }

    openModal('modal-notice');
}

async function saveNotice(e) {
    e.preventDefault();
    const id = document.getElementById('notice-id').value;
    const formData = new FormData(document.getElementById('notice-form'));

    try {
        const url = id ? `/api/notices/${id}` : '/api/notices';
        const method = id ? 'PUT' : 'POST';

        const res = await apiRequest(url, method, formData, true);
        if (res.success) {
            showToast(res.message, 'success');
            closeModal('modal-notice');
            loadNotices(state.notices.page);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteNotice(id, title) {
    if (!confirm(`Are you sure you want to delete notice "${title}"?`)) return;
    try {
        const res = await apiRequest(`/api/notices/${id}`, 'DELETE');
        if (res.success) {
            showToast('Notice deleted successfully', 'success');
            loadNotices(state.notices.page);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ================= 6. ADMISSIONS / APPLICATIONS ================= */
async function loadApplications(page = 1) {
    state.applications.page = page;
    const search = document.getElementById('search-app')?.value || '';
    const status = document.getElementById('filter-app-status')?.value || '';

    try {
        const query = `page=${page}&limit=${state.applications.limit}&search=${encodeURIComponent(search)}&status=${status}`;
        const res = await apiRequest(`/api/applications?${query}`);
        if (!res.success) return;

        const tableBody = document.getElementById('app-table-body');
        tableBody.innerHTML = res.data.map(a => `
            <tr>
                <td><strong>${a.application_no}</strong></td>
                <td>
                    <div style="font-weight: 600;">${a.applicant_name}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${a.email} | ${a.phone}</div>
                </td>
                <td>${a.department_name || 'N/A'}</td>
                <td><strong>${a.previous_marks_percentage ? a.previous_marks_percentage + '%' : 'N/A'}</strong></td>
                <td><span class="badge badge-${a.status}">${a.status}</span></td>
                <td>
                    ${a.document_path ? `<a href="${a.document_path}" target="_blank" class="btn btn-sm btn-secondary"><i class="fas fa-file-pdf"></i> Certificate</a>` : 'None'}
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="reviewApplication(${a.id}, '${a.application_no}', '${a.applicant_name}', '${a.status}')">Review</button>
                </td>
            </tr>
        `).join('');

        renderPagination('app-pagination', res.meta, loadApplications);
    } catch (err) {
        showToast('Failed to load applications', 'error');
    }
}

function reviewApplication(id, appNo, name, currentStatus) {
    document.getElementById('review-app-id').value = id;
    document.getElementById('modal-review-app-no').textContent = `${appNo} (${name})`;
    document.getElementById('modal-review-status').value = currentStatus === 'pending' ? 'approved' : currentStatus;
    document.getElementById('modal-review-notes').value = '';
    openModal('modal-review');
}

async function saveApplicationReview(e) {
    e.preventDefault();
    const id = document.getElementById('review-app-id').value;
    const body = {
        status: document.getElementById('modal-review-status').value,
        reviewer_notes: document.getElementById('modal-review-notes').value.trim()
    };

    try {
        const res = await apiRequest(`/api/applications/${id}/status`, 'PATCH', body);
        if (res.success) {
            showToast(res.message, 'success');
            closeModal('modal-review');
            loadApplications(state.applications.page);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ================= 7. AUDIT LOGS ================= */
async function loadLogs(page = 1) {
    state.logs.page = page;
    const search = document.getElementById('search-log')?.value || '';

    try {
        const query = `page=${page}&limit=${state.logs.limit}&search=${encodeURIComponent(search)}`;
        const res = await apiRequest(`/api/logs?${query}`);
        if (!res.success) return;

        const tableBody = document.getElementById('log-table-body');
        tableBody.innerHTML = res.data.map(l => `
            <tr>
                <td><strong>#${l.id}</strong></td>
                <td><span style="font-weight: 600; color: var(--secondary);">${l.admin_username}</span></td>
                <td><span class="badge badge-active">${l.action}</span></td>
                <td>${l.entity_type}</td>
                <td><div style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${l.details || ''}</div></td>
                <td><code>${l.ip_address}</code></td>
                <td>${new Date(l.created_at).toLocaleString()}</td>
            </tr>
        `).join('');

        renderPagination('log-pagination', res.meta, loadLogs);
    } catch (err) {
        showToast('Failed to load audit logs', 'error');
    }
}

function exportLogsCSV() {
    window.open('/api/logs/export', '_blank');
}

/* ================= 8. ADMIN USER MANAGEMENT ================= */
async function loadAdmins() {
    try {
        const res = await apiRequest('/api/admins');
        if (!res.success) return;

        const tableBody = document.getElementById('admin-table-body');
        tableBody.innerHTML = res.data.map(a => `
            <tr>
                <td>
                    <div style="font-weight: 600;">${a.full_name}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${a.email}</div>
                </td>
                <td><code>${a.username}</code></td>
                <td><span class="role-${a.role}" style="padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">${a.role}</span></td>
                <td><span class="badge badge-${a.status}">${a.status}</span></td>
                <td>${a.two_factor_enabled ? '<span style="color: var(--success);"><i class="fas fa-check-circle"></i> Active</span>' : '<span style="color: var(--text-dim);">Disabled</span>'}</td>
                <td>${a.last_login ? new Date(a.last_login).toLocaleString() : 'Never'}</td>
                <td>
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-sm ${a.status === 'active' ? 'btn-danger' : 'btn-success'}" onclick="toggleAdminStatus(${a.id}, '${a.status === 'active' ? 'disabled' : 'active'}')">${a.status === 'active' ? 'Disable' : 'Enable'}</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Failed to load admin list', 'error');
    }
}

function openAdminModal() {
    document.getElementById('admin-user-form').reset();
    openModal('modal-admin-user');
}

async function saveAdminUser(e) {
    e.preventDefault();
    const body = {
        username: document.getElementById('modal-admin-uname').value.trim(),
        full_name: document.getElementById('modal-admin-fname').value.trim(),
        email: document.getElementById('modal-admin-email').value.trim(),
        password: document.getElementById('modal-admin-pass').value,
        role: document.getElementById('modal-admin-role').value
    };

    try {
        const res = await apiRequest('/api/admins', 'POST', body);
        if (res.success) {
            showToast(res.message, 'success');
            closeModal('modal-admin-user');
            loadAdmins();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleAdminStatus(id, newStatus) {
    try {
        const res = await apiRequest(`/api/admins/${id}/status`, 'PATCH', { status: newStatus });
        if (res.success) {
            showToast(res.message, 'success');
            loadAdmins();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ================= 2FA SETUP MODAL ================= */
async function open2FASetupModal() {
    try {
        const res = await apiRequest('/api/auth/2fa/setup', 'POST');
        if (res.success) {
            document.getElementById('qr-code-img').src = res.data.qrCodeUrl;
            document.getElementById('2fa-secret-text').textContent = res.data.secret;
            openModal('modal-2fa-setup');
        }
    } catch (err) {
        showToast('Failed to generate 2FA secret', 'error');
    }
}

async function confirm2FAEnable() {
    const totpCode = document.getElementById('2fa-code-input').value.trim();
    try {
        const res = await apiRequest('/api/auth/2fa/verify', 'POST', { totpCode });
        if (res.success) {
            showToast('Two-Factor Authentication enabled successfully!', 'success');
            closeModal('modal-2fa-setup');
            checkSession();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ================= UI UTILITIES ================= */
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

function renderPagination(containerId, meta, callback) {
    const el = document.getElementById(containerId);
    if (!el || !meta) return;

    const { page, totalPages, totalItems } = meta;

    el.innerHTML = `
        <div class="pagination-info">Showing page ${page} of ${totalPages} (${totalItems} total records)</div>
        <div class="pagination-controls">
            <button class="btn btn-sm btn-secondary" ${page <= 1 ? 'disabled' : ''} onclick="${callback.name}(${page - 1})"><i class="fas fa-chevron-left"></i> Prev</button>
            <button class="btn btn-sm btn-secondary" ${page >= totalPages ? 'disabled' : ''} onclick="${callback.name}(${page + 1})">Next <i class="fas fa-chevron-right"></i></button>
        </div>
    `;
}

/* ================= 9. CMS WEBSITE CONTENT & IMAGES ================= */
const CMS_DEFAULTS = {
    hero_motto: 'KNOWLEDGE • DISCIPLINE • CHARACTER',
    hero_title: 'Shriman G. R. Warange Junior College',
    hero_subtitle: 'Providing quality higher secondary education in Malkapur. We are committed to fostering academic excellence, moral values, and preparing students for competitive examinations and university studies across Science, Commerce, and Arts.',
    admission_session: '2026-27',
    notice_banner_text: 'Admissions for Class XI (Science, Commerce & Arts) for the Academic Session 2026-27 are now open. Collect prospectus from the college office.',
    stat_years: '25+ Years',
    stat_pass_rate: '98.4%',
    stat_students: '1,200+',
    contact_phone: '+91 02329 222100',
    contact_email: 'info@warangecollege.edu.in',
    contact_address: 'Shriman G. R. Warange Junior College, Malkapur, Shahuwadi, Maharashtra — 415101',
    office_hours: '7:30 AM to 12:00 PM (Morning Shift)',
    img_hero_bg: 'https://raw.githubusercontent.com/not-amey/clgsite/main/prayer.png',
    img_assembly: 'https://raw.githubusercontent.com/not-amey/clgsite/main/prayer.png',
    img_lab: 'https://raw.githubusercontent.com/not-amey/clgsite/main/lab.png',
    img_principal: 'https://raw.githubusercontent.com/not-amey/clgsite/main/lab.png'
};

async function loadCMSSettings() {
    try {
        const res = await apiRequest('/api/settings');
        const settings = (res && res.success && res.data) ? res.data : {};

        // Populate text inputs
        const keys = [
            'admission_session', 'notice_banner_text', 'hero_motto', 'hero_title',
            'hero_subtitle', 'stat_years', 'stat_pass_rate', 'stat_students',
            'contact_phone', 'contact_email', 'contact_address', 'office_hours'
        ];

        keys.forEach(k => {
            const el = document.getElementById(`cms-${k}`);
            if (el) {
                const val = (settings[k] && settings[k].trim() !== '') ? settings[k] : CMS_DEFAULTS[k];
                el.value = val || '';
            }
        });

        // Populate image previews
        const imgKeys = ['img_hero_bg', 'img_assembly', 'img_lab', 'img_principal'];
        imgKeys.forEach(k => {
            const imgEl = document.getElementById(`preview-${k}`);
            if (imgEl) {
                const imgVal = (settings[k] && settings[k].trim() !== '') ? settings[k] : CMS_DEFAULTS[k];
                imgEl.src = imgVal || '';
            }
        });
    } catch (err) {
        showToast('Failed to load CMS settings', 'error');
    }
}

async function saveCMSSettings() {
    try {
        const keys = [
            'admission_session', 'notice_banner_text', 'hero_motto', 'hero_title',
            'hero_subtitle', 'stat_years', 'stat_pass_rate', 'stat_students',
            'contact_phone', 'contact_email', 'contact_address', 'office_hours'
        ];

        const payload = {};
        keys.forEach(k => {
            const el = document.getElementById(`cms-${k}`);
            if (el) {
                const val = el.value.trim();
                payload[k] = val !== '' ? val : CMS_DEFAULTS[k];
            }
        });

        const res = await apiRequest('/api/settings', 'POST', payload);
        if (res.success) {
            showToast('Website content saved successfully!', 'success');
            await loadCMSSettings();
        }
    } catch (err) {
        showToast(err.message || 'Failed to save website content', 'error');
    }
}

async function uploadCMSImage(key) {
    const fileInput = document.getElementById(`file-${key}`);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('Please select an image file to upload', 'error');
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('key', key);
    formData.append('image', file);

    try {
        showToast('Uploading image to cloud storage...', 'info');
        const res = await apiRequest('/api/settings/upload-image', 'POST', formData, true);
        if (res.success && res.data.url) {
            const imgEl = document.getElementById(`preview-${key}`);
            if (imgEl) imgEl.src = res.data.url;
            fileInput.value = '';
            showToast('Image replaced successfully!', 'success');
        }
    } catch (err) {
        showToast(err.message || 'Failed to upload image', 'error');
    }
}
