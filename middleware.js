export const config = {
    matcher: ['/admin', '/admin/:path*']
};

function timingSafeEqualHex(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

async function verifySessionCookie(cookieValue, secret) {
    if (!cookieValue || !secret) return false;
    const parts = cookieValue.split('.');
    if (parts.length !== 2) return false;

    const [expiresMsStr, hmacHex] = parts;
    const expiresMs = Number(expiresMsStr);
    if (!expiresMs || isNaN(expiresMs) || expiresMs < Date.now()) {
        return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(expiresMsStr)
    );

    const expectedHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return timingSafeEqualHex(expectedHex, hmacHex);
}

function getCookieValue(cookieHeader, name) {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[2]) : null;
}

export default async function middleware(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Allow /admin/login.html and exact files that login.html loads
    const allowedExactPaths = [
        '/admin/login.html',
        '/admin/js/api.js'
    ];

    if (allowedExactPaths.includes(pathname)) {
        return new Response(null, {
            headers: { 'x-middleware-next': '1' }
        });
    }

    const cookieHeader = request.headers.get('cookie') || '';
    const sessionCookie = getCookieValue(cookieHeader, 'admin_session');
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || 'college_admin_session_secret_default_key_99411';

    const isValid = await verifySessionCookie(sessionCookie, secret);

    if (isValid) {
        // If session is valid and path is /admin or /admin/, serve /admin/panel.html
        if (pathname === '/admin' || pathname === '/admin/') {
            const panelUrl = new URL('/admin/panel.html', request.url);
            return new Response(null, {
                headers: { 'x-middleware-rewrite': panelUrl.toString() }
            });
        }
        // Otherwise pass through to requested admin resource
        return new Response(null, {
            headers: { 'x-middleware-next': '1' }
        });
    }

    // Missing or invalid session: rewrite to /admin/login.html and keep URL as typed
    const loginUrl = new URL('/admin/login.html', request.url);
    return new Response(null, {
        headers: { 'x-middleware-rewrite': loginUrl.toString() }
    });
}
