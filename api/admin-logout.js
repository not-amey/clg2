module.exports = async function handler(req, res) {
    const cookieHeader = 'admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict';
    res.setHeader('Set-Cookie', cookieHeader);
    return res.status(200).json({ success: true, message: 'Logged out.' });
};
