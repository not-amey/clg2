const crypto = require('crypto');

function timingSafeEqualStrings(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const hashA = crypto.createHash('sha256').update(a).digest();
    const hashB = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (_) {}
        }
        if (!body && req.on) {
            body = await new Promise((resolve) => {
                let data = '';
                req.on('data', chunk => { data += chunk; });
                req.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch (_) { resolve({}); }
                });
            });
        }

        const password = (body && typeof body.password === 'string') ? body.password : '';
        const adminPassword = process.env.ADMIN_PASSWORD;
        const sessionSecret = process.env.ADMIN_SESSION_SECRET;

        if (!adminPassword || !sessionSecret) {
            return res.status(500).json({ success: false, message: 'Server configuration error.' });
        }

        const isValid = timingSafeEqualStrings(password, adminPassword);

        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Wrong password.' });
        }

        const expiresMs = Date.now() + 28800 * 1000;
        const hmacHex = crypto
            .createHmac('sha256', sessionSecret)
            .update(String(expiresMs))
            .digest('hex');

        const sessionValue = `${expiresMs}.${hmacHex}`;
        const cookieHeader = `admin_session=${sessionValue}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`;

        res.setHeader('Set-Cookie', cookieHeader);
        return res.status(200).json({ success: true, message: 'Authenticated.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
