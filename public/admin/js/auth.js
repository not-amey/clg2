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

// Force logout on every page refresh, tab close, or window exit
window.addEventListener('beforeunload', () => {
    if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/auth/logout');
    }
});

async function checkSession() {
    // Detect page refresh (F5 / reload)
    const navEntries = performance.getEntriesByType('navigation');
    const isReload = navEntries.length > 0 && navEntries[0].type === 'reload';

    if (isReload) {
        await logoutAdmin();
        return null;
    }

    try {
        const res = await apiRequest('/api/auth/me');
        if (res.success && res.data.user) {
            currentAdminUser = res.data.user;
            updateUserUI(currentAdminUser);
            initInactivityTracker();
            return currentAdminUser;
        }
    } catch (err) {
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = '/admin/login.html';
        }
    }
    return null;
}

function updateUserUI(user) {
    const nameEl = document.getElementById('user-full-name');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');

    if (nameEl) nameEl.textContent = user.full_name;
    if (roleEl) {
        roleEl.textContent = user.role.replace('_', ' ');
        roleEl.className = `role-${user.role}`;
    }
    if (avatarEl) avatarEl.textContent = user.full_name.charAt(0).toUpperCase();

    // Hide role-restricted elements if needed
    document.querySelectorAll('[data-role-required]').forEach(el => {
        const allowed = el.getAttribute('data-role-required').split(',');
        if (!allowed.includes(user.role)) {
            el.style.display = 'none';
        } else {
            el.style.display = '';
        }
    });
}

async function logoutAdmin() {
    try {
        await apiRequest('/api/auth/logout', 'POST');
    } catch (e) {
        // ignore
    } finally {
        window.location.href = '/admin/login.html';
    }
}
