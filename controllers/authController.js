const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');
const { generate2FASecret, verify2FAToken } = require('../utils/twoFactor');
const { logAudit } = require('../utils/auditLogger');
const { success, error } = require('../utils/response');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 Minutes
const BCRYPT_COST = 12;

// Dummy hash for constant-time comparison when username doesn't exist
const DUMMY_HASH = '$2b$12$eImiTXuWVxfM37uY4JANj.R.8G3N1bFm8h.q6.z/s5aH.v/e.7t/m';

/**
 * Admin Login
 */
async function login(req, res) {
    try {
        const { username, password, totpCode } = req.body;

        // Fetch admin from Supabase
        const { data: admins } = await supabase
            .from('admins')
            .select('*')
            .or(`username.eq.${username},email.eq.${username}`)
            .limit(1);

        const admin = (admins && admins.length > 0) ? admins[0] : null;

        // Check account lock status
        if (admin && admin.lock_until) {
            let lockTime = new Date(admin.lock_until);
            const now = new Date();
            
            if (lockTime.getTime() > now.getTime() + LOCKOUT_MS) {
                lockTime = new Date(now.getTime() + LOCKOUT_MS);
                await supabase.from('admins').update({ lock_until: lockTime.toISOString() }).eq('id', admin.id);
            }

            if (lockTime > now) {
                return res.status(403).json({
                    success: false,
                    message: 'Too many login attempts.',
                    lockUntil: lockTime.toISOString()
                });
            }
        }

        // Constant-time password check
        const hashToCompare = admin ? admin.password_hash : DUMMY_HASH;
        const isMatch = await bcrypt.compare(password, hashToCompare);

        if (!admin || !isMatch) {
            if (admin) {
                const attempts = (admin.failed_login_attempts || 0) + 1;
                let lockUntil = null;

                if (attempts >= MAX_FAILED_ATTEMPTS) {
                    const lockTime = new Date(Date.now() + LOCKOUT_MS);
                    lockUntil = lockTime.toISOString();
                }

                await supabase.from('admins').update({
                    failed_login_attempts: attempts,
                    lock_until: lockUntil
                }).eq('id', admin.id);

                await logAudit({
                    adminId: admin.id,
                    adminUsername: admin.username,
                    action: 'FAILED_LOGIN_ATTEMPT',
                    entityType: 'AUTH',
                    details: `Failed login attempt #${attempts}`,
                    req
                });

                if (lockUntil) {
                    return res.status(403).json({
                        success: false,
                        message: 'Too many login attempts.',
                        lockUntil: lockUntil
                    });
                }
            }

            return error(res, 'Invalid credentials.', 401);
        }

        if (admin.status !== 'active') {
            return error(res, 'Invalid credentials.', 401);
        }

        // Check 2FA if enabled
        if (admin.two_factor_enabled) {
            if (!totpCode) {
                return res.status(200).json({
                    success: false,
                    require2FA: true,
                    message: 'Two-Factor Authentication code required.'
                });
            }

            const is2FAValid = verify2FAToken(totpCode, admin.two_factor_secret);
            if (!is2FAValid) {
                return error(res, 'Invalid credentials.', 401);
            }
        }

        // Reset failed login attempts & update last login timestamp
        const now = new Date().toISOString();
        await supabase.from('admins').update({
            failed_login_attempts: 0,
            lock_until: null,
            last_login: now
        }).eq('id', admin.id);

        // Generate JWT Token
        const token = jwt.sign(
            { id: admin.id, username: admin.username, role: admin.role },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        // Set HTTP-Only Cookie
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        await logAudit({
            adminId: admin.id,
            adminUsername: admin.username,
            action: 'LOGIN_SUCCESS',
            entityType: 'AUTH',
            entityId: admin.id,
            details: `Logged in successfully with role ${admin.role}`,
            req
        });

        return success(res, {
            user: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                full_name: admin.full_name,
                role: admin.role,
                two_factor_enabled: Boolean(admin.two_factor_enabled)
            },
            token
        }, 'Login successful');

    } catch (err) {
        console.error('[Login Error]:', err);
        return error(res, 'Login failed due to a server error.', 500);
    }
}

/**
 * Admin Logout
 */
async function logout(req, res) {
    if (req.user) {
        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'LOGOUT',
            entityType: 'AUTH',
            details: 'Logged out of admin session',
            req
        });
    }

    res.clearCookie('admin_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });

    return success(res, null, 'Logged out successfully');
}

/**
 * Get Current Logged-in Admin Profile
 */
function getMe(req, res) {
    return success(res, { user: req.user });
}

/**
 * Forgot Password (Request Reset Link)
 */
async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        const { data: admins } = await supabase
            .from('admins')
            .select('id, username')
            .eq('email', email)
            .eq('status', 'active')
            .limit(1);

        const genericMsg = 'If an account exists with that email, a password reset link has been processed.';
        const admin = (admins && admins.length > 0) ? admins[0] : null;

        if (!admin) {
            return success(res, null, genericMsg);
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        await supabase.from('password_resets').insert({
            admin_id: admin.id,
            token_hash: tokenHash,
            expires_at: expiresAt
        });

        await logAudit({
            adminId: admin.id,
            adminUsername: admin.username,
            action: 'FORGOT_PASSWORD_REQUEST',
            entityType: 'AUTH',
            details: 'Requested password reset token',
            req
        });

        return success(res, { resetToken }, genericMsg);
    } catch (err) {
        console.error('[Forgot Password Error]:', err);
        return error(res, 'Failed to process password reset request.', 500);
    }
}

/**
 * Reset Password with Single-Use Token
 */
async function resetPassword(req, res) {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword || newPassword.length < 12) {
            return error(res, 'Password must be at least 12 characters long.', 400);
        }

        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        const { data: resetRecords } = await supabase
            .from('password_resets')
            .select('*')
            .eq('token_hash', tokenHash)
            .eq('used', 0)
            .gt('expires_at', new Date().toISOString())
            .limit(1);

        const resetRecord = (resetRecords && resetRecords.length > 0) ? resetRecords[0] : null;

        if (!resetRecord) {
            return error(res, 'Invalid or expired password reset token.', 400);
        }

        const { data: admin } = await supabase.from('admins').select('*').eq('id', resetRecord.admin_id).single();
        if (!admin) {
            return error(res, 'Invalid password reset token.', 400);
        }

        const password_hash = await bcrypt.hash(newPassword, BCRYPT_COST);

        await supabase.from('admins').update({
            password_hash,
            failed_login_attempts: 0,
            lock_until: null
        }).eq('id', admin.id);

        await supabase.from('password_resets').update({ used: 1 }).eq('id', resetRecord.id);

        await logAudit({
            adminId: admin.id,
            adminUsername: admin.username,
            action: 'PASSWORD_RESET_SUCCESS',
            entityType: 'AUTH',
            details: 'Password reset completed using token',
            req
        });

        return success(res, null, 'Password reset successful. You can now log in with your new password.');
    } catch (err) {
        console.error('[Reset Password Error]:', err);
        return error(res, 'Failed to reset password.', 500);
    }
}

/**
 * Setup 2FA Secret & QR Code
 */
async function setup2FA(req, res) {
    try {
        const adminId = req.user.id;
        const { secret, qrCodeUrl } = await generate2FASecret(req.user.username);

        await supabase.from('admins').update({ two_factor_secret: secret }).eq('id', adminId);

        return success(res, { secret, qrCodeUrl }, '2FA secret generated. Scan QR code in your authenticator app.');
    } catch (err) {
        console.error('[Setup 2FA Error]:', err);
        return error(res, 'Failed to generate 2FA secret.', 500);
    }
}

/**
 * Confirm & Enable 2FA
 */
async function verifyAndEnable2FA(req, res) {
    try {
        const { totpCode } = req.body;
        const { data: admin } = await supabase.from('admins').select('two_factor_secret').eq('id', req.user.id).single();

        if (!admin || !admin.two_factor_secret) {
            return error(res, '2FA setup was not initiated.', 400);
        }

        const isValid = verify2FAToken(totpCode, admin.two_factor_secret);

        if (!isValid) {
            return error(res, 'Invalid 2FA verification code.', 400);
        }

        await supabase.from('admins').update({ two_factor_enabled: 1 }).eq('id', req.user.id);

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'ENABLE_2FA',
            entityType: 'AUTH',
            details: 'Enabled Two-Factor Authentication',
            req
        });

        return success(res, null, 'Two-Factor Authentication enabled successfully.');
    } catch (err) {
        console.error('[Verify 2FA Error]:', err);
        return error(res, 'Failed to verify 2FA code.', 500);
    }
}

/**
 * Disable 2FA
 */
async function disable2FA(req, res) {
    try {
        await supabase.from('admins').update({ two_factor_enabled: 0, two_factor_secret: null }).eq('id', req.user.id);

        await logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'DISABLE_2FA',
            entityType: 'AUTH',
            details: 'Disabled Two-Factor Authentication',
            req
        });

        return success(res, null, 'Two-Factor Authentication disabled successfully.');
    } catch (err) {
        console.error('[Disable 2FA Error]:', err);
        return error(res, 'Failed to disable 2FA.', 500);
    }
}

module.exports = {
    login,
    logout,
    getMe,
    forgotPassword,
    resetPassword,
    setup2FA,
    verifyAndEnable2FA,
    disable2FA
};
