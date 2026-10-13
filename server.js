const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const { apiLimiter } = require('./middleware/rateLimiter');
const { csrfProtection } = require('./middleware/csrf');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const studentRoutes = require('./routes/studentRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const courseRoutes = require('./routes/courseRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const logRoutes = require('./routes/logRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const adminLoginHandler = require('./api/admin-login');
const adminLogoutHandler = require('./api/admin-logout');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser(process.env.SESSION_SECRET || 'college_admin_session_cookie_secret_99411'));

// Apply General Rate Limiter to API routes
app.use('/api', apiLimiter);

// CSRF Cookie Middleware
app.use(csrfProtection);

// Helper to verify admin session
function verifyAdminSession(req) {
    const crypto = require('crypto');
    const cookie = req.cookies && req.cookies.admin_session;
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || 'college_admin_session_secret_default_key_99411';
    if (!cookie || !secret) return false;

    const parts = cookie.split('.');
    if (parts.length !== 2) return false;

    const [expiresMsStr, hmacHex] = parts;
    const expiresMs = Number(expiresMsStr);
    if (!expiresMs || isNaN(expiresMs) || expiresMs < Date.now()) return false;

    const expected = crypto.createHmac('sha256', secret).update(expiresMsStr).digest('hex');
    if (expected.length !== hmacHex.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmacHex));
}

// Admin Route Guard (Checked before static file serving)
app.get(['/admin', '/admin/', '/admin/panel.html', '/admin/index.html'], (req, res) => {
    if (verifyAdminSession(req)) {
        return res.sendFile(path.join(__dirname, 'public/admin/panel.html'));
    }
    return res.sendFile(path.join(__dirname, 'public/admin/login.html'));
});

// Serve Public Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.use(express.static(__dirname));

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.post('/api/admin-login', (req, res) => adminLoginHandler(req, res));
app.post('/api/admin-logout', (req, res) => adminLogoutHandler(req, res));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Fallback for Admin SPA routes
app.get(/^\/admin\/.*/, (req, res) => {
    if (verifyAdminSession(req)) {
        return res.sendFile(path.join(__dirname, 'public/admin/panel.html'));
    }
    return res.sendFile(path.join(__dirname, 'public/admin/login.html'));
});

// Global 404 Handler for API
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'API route not found.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Unhandled Error]:', err.stack);
    const status = err.status || 500;
    res.status(status).json({
        success: false,
        message: err.message || 'Internal Server Error',
        errors: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Run server locally when executed directly
if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`=======================================================`);
        console.log(`🚀 College Secure Admin Server is running on port ${PORT}`);
        console.log(`🔗 Admin Portal URL : http://127.0.0.1:${PORT}/admin/login.html`);
        console.log(`=======================================================`);
    });
}

module.exports = app;
