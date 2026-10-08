const { getSiteSettings, updateSiteSettings, uploadImageSetting } = require('../utils/supabase');
const { success, error } = require('../utils/response');
const { logAudit } = require('../utils/auditLogger');

/**
 * Get all website CMS settings (Public endpoint)
 */
async function getSettings(req, res) {
    try {
        const settings = await getSiteSettings();
        return success(res, settings, 'Site settings fetched successfully');
    } catch (err) {
        console.error('[Get Settings Error]:', err);
        return error(res, 'Failed to fetch site settings', 500);
    }
}

/**
 * Update CMS text settings (Admin only)
 */
async function updateSettings(req, res) {
    try {
        const settingsMap = req.body;
        if (!settingsMap || typeof settingsMap !== 'object' || Object.keys(settingsMap).length === 0) {
            return error(res, 'No settings data provided', 400);
        }

        await updateSiteSettings(settingsMap);

        logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'UPDATE_SITE_SETTINGS',
            entityType: 'CMS',
            details: `Updated ${Object.keys(settingsMap).length} site settings fields`,
            req
        });

        return success(res, null, 'Website settings saved successfully!');
    } catch (err) {
        console.error('[Update Settings Error]:', err);
        return error(res, 'Failed to save site settings', 500);
    }
}

/**
 * Upload & replace a setting image (Admin only)
 */
async function uploadSettingImage(req, res) {
    try {
        const { key } = req.body;
        if (!key) {
            return error(res, 'Setting key is required', 400);
        }

        if (!req.file) {
            return error(res, 'No image file uploaded', 400);
        }

        const publicUrl = await uploadImageSetting(
            key,
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname
        );

        logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'UPDATE_SETTING_IMAGE',
            entityType: 'CMS',
            details: `Updated image setting [${key}] with URL: ${publicUrl}`,
            req
        });

        return success(res, { key, url: publicUrl }, 'Image uploaded and setting updated successfully!');
    } catch (err) {
        console.error('[Upload Setting Image Error]:', err);
        return error(res, 'Failed to upload setting image', 500);
    }
}

module.exports = {
    getSettings,
    updateSettings,
    uploadSettingImage
};
