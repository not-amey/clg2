/**
 * Admin Authentication & Session Management Script
 */

let currentAdminUser = null;
let inactivityTimer = null;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
        showToast('You have been logged out due to inactivity.', 'info');
        await logoutAdmin();
    }, INACTIVITY_TIMEOUT_MS);
}

function initInactivityTracker() {
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetInactivityTimer, true);
    });
    resetInactivityTimer();
}

async function checkSession() {
    if (window.__preAuthUser) {
        currentAdminUser = window.__preAuthUser;
        updateUserUI(currentAdminUser);
        initInactivityTracker();
        return currentAdminUser;
    }

    try {
        const res = await apiRequest('/api/auth/me');
        if (res && res.success && res.data && res.data.user) {
            currentAdminUser = res.data.user;
            updateUserUI(currentAdminUser);
            initInactivityTracker();
            return currentAdminUser;
        }
    } catch (err) {
        // Handled server-side by routing middleware
    }
    return null;
}

function updateUserUI(user) {
    if (!user) return;
    const nameEl = document.getElementById('user-full-name');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');

    if (nameEl && user.full_name) nameEl.textContent = user.full_name;
    if (roleEl && user.role) {
        roleEl.textContent = user.role.replace('_', ' ');
        roleEl.className = `role-${user.role}`;
    }
    if (avatarEl && user.full_name) avatarEl.textContent = user.full_name.charAt(0).toUpperCase();

    // Hide role-restricted elements if needed
    if (user.role) {
        document.querySelectorAll('[data-role-required]').forEach(el => {
            const allowed = el.getAttribute('data-role-required').split(',');
            if (!allowed.includes(user.role)) {
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        });
    }
}

async function logoutAdmin() {
    try {
        await fetch('/api/admin-logout', { method: 'POST' });
        await apiRequest('/api/auth/logout', 'POST');
    } catch (e) {
        // ignore
    } finally {
        window.location.href = '/admin';
    }
}
