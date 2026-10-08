/**
 * API Wrapper with CSRF Protection and Session handling
 */

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

async function apiRequest(endpoint, method = 'GET', body = null, isFormData = false) {
    const headers = {};

    // Attach CSRF token
    const csrfToken = getCookie('XSRF-TOKEN');
    if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    const options = {
        method,
        headers,
        credentials: 'same-origin'
    };

    if (body) {
        if (isFormData) {
            options.body = body; // Browser automatically sets multipart/form-data boundary
        } else {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(endpoint, options);
        const data = await response.json();

        if (response.status === 401) {
            // Unauthorized - clear user session and redirect to login if not already on login page
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = '/admin/login.html';
            }
        }

        if (!response.ok) {
            const errObj = new Error(data.message || 'An error occurred during API request.');
            errObj.lockUntil = data.lockUntil;
            errObj.status = response.status;
            throw errObj;
        }

        return data;
    } catch (err) {
        console.error(`[API Error] ${method} ${endpoint}:`, err);
        throw err;
    }
}

// Toast helper
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'info') icon = 'info-circle';

    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}
