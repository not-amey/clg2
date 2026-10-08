const { authenticator } = require('otplib');
const QRCode = require('qrcode');

/**
 * Generate a new 2FA secret and QR code URL for an admin user
 * @param {string} username
 * @returns {Promise<{ secret: string, qrCodeUrl: string, otpauthUrl: string }>}
 */
async function generate2FASecret(username) {
    const serviceName = 'College Admin Portal';
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(username, serviceName, secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, qrCodeUrl, otpauthUrl };
}

/**
 * Verify a 6-digit TOTP token against secret
 * @param {string} token
 * @param {string} secret
 * @returns {boolean}
 */
function verify2FAToken(token, secret) {
    if (!token || !secret) return false;
    try {
        return authenticator.check(token, secret);
    } catch (e) {
        return false;
    }
}

module.exports = {
    generate2FASecret,
    verify2FAToken
};

