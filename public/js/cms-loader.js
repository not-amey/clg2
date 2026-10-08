/**
 * CMS Dynamic Content & Image Loader for College Website
 * Includes Global Admin Lock Button & Developer Credits Modal
 */

// Global Modal Handlers
window.openCreditsModal = function () {
    const modal = document.getElementById('credits-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Small delay for smooth opacity transition
        setTimeout(() => modal.classList.add('active'), 10);
    }
};

window.closeCreditsModal = function () {
    const modal = document.getElementById('credits-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 250);
    }
};

window.closeCreditsModalOnBackdrop = function (event) {
    if (event.target.id === 'credits-modal') {
        window.closeCreditsModal();
    }
};

(function () {
    // Inject Bottom-Left Admin Lock Button if not present
    function initAdminLockButton() {
        if (!document.querySelector('.admin-lock-btn')) {
            const lockBtn = document.createElement('a');
            lockBtn.href = '/admin/login.html';
            lockBtn.className = 'admin-lock-btn';
            lockBtn.title = 'Admin Portal';
            lockBtn.setAttribute('aria-label', 'Admin Portal');
            lockBtn.innerHTML = '🔒';
            document.body.appendChild(lockBtn);
        }
    }

    // Inject Credits Modal if not present
    function initCreditsModal() {
        if (!document.getElementById('credits-modal')) {
            const modalDiv = document.createElement('div');
            modalDiv.id = 'credits-modal';
            modalDiv.className = 'credits-modal-overlay';
            modalDiv.style.display = 'none';
            modalDiv.onclick = window.closeCreditsModalOnBackdrop;
            modalDiv.innerHTML = `
                <div class="credits-modal-card">
                    <button class="credits-close-btn" onclick="window.closeCreditsModal()">&times;</button>
                    <div class="credits-header">
                        <img src="https://github.com/not-amey.png" alt="Amey Zore" class="credits-avatar" onerror="this.src='https://ui-avatars.com/api/?name=Amey+Zore&background=0f172a&color=fff'">
                        <div class="credits-user-info">
                            <h3>Amey Zore</h3>
                            <p class="credits-role">Web Developer</p>
                        </div>
                    </div>
                    <div class="credits-divider"></div>
                    <div class="credits-body">
                        <p>Official Website & Administrative Management System designed and built for Shriman G. R. Warange Junior College.</p>
                        <a href="https://github.com/not-amey" target="_blank" rel="noopener noreferrer" class="credits-github-btn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                            </svg>
                            github.com/not-amey
                        </a>
                    </div>
                </div>
            `;
            document.body.appendChild(modalDiv);
        }

        // Attach click handler to any .creator-credit elements
        document.querySelectorAll('.creator-credit').forEach(el => {
            el.textContent = 'Credits';
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.onclick = window.openCreditsModal;
        });
    }

    async function loadCMSSettings() {
        try {
            const response = await fetch('/api/settings');
            if (!response.ok) return;

            const resData = await response.json();
            if (!resData.success || !resData.data) return;

            const settings = resData.data;

            // 1. Update text elements (data-cms-key)
            document.querySelectorAll('[data-cms-key]').forEach(el => {
                const key = el.getAttribute('data-cms-key');
                if (settings[key]) {
                    el.textContent = settings[key];
                }
            });

            // 2. Update image elements (data-cms-img)
            document.querySelectorAll('[data-cms-img]').forEach(img => {
                const key = img.getAttribute('data-cms-img');
                if (settings[key]) {
                    img.src = settings[key];
                }
            });

            // 3. Update background images (data-cms-bg)
            document.querySelectorAll('[data-cms-bg]').forEach(el => {
                const key = el.getAttribute('data-cms-bg');
                if (settings[key]) {
                    el.style.backgroundImage = `linear-gradient(135deg, rgba(15, 33, 55, 0.90) 0%, rgba(27, 54, 93, 0.85) 100%), url('${settings[key]}')`;
                }
            });
        } catch (err) {
            console.log('[CMS Loader]: Operating with default static fallback content.');
        }
    }

    function initAll() {
        initAdminLockButton();
        initCreditsModal();
        loadCMSSettings();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();
