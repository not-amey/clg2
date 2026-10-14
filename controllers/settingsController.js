const fs = require('fs');
const path = require('path');
const { getSiteSettings, updateSiteSettings, uploadImageSetting, uploadToSupabase } = require('../utils/supabase');
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

/**
 * Upload & update Site Logo (Super Admin only)
 */
async function uploadLogo(req, res) {
    try {
        if (!req.file) {
            return error(res, 'Please upload a PNG, JPG, or SVG under 2MB', 400);
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        const allowedExts = ['.png', '.jpg', '.jpeg', '.svg'];
        const allowedMimes = ['image/png', 'image/jpeg', 'image/svg+xml'];

        if (!allowedExts.includes(ext) || !allowedMimes.includes(req.file.mimetype)) {
            return error(res, 'Please upload a PNG, JPG, or SVG under 2MB', 400);
        }

        if (req.file.size > 2 * 1024 * 1024) {
            return error(res, 'Please upload a PNG, JPG, or SVG under 2MB', 400);
        }

        // 1. Store in existing uploads folder structure
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const cleanFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const localFileName = `logo_${Date.now()}_${cleanFileName}`;
        const localFilePath = path.join(uploadsDir, localFileName);
        fs.writeFileSync(localFilePath, req.file.buffer);

        let finalUrl = `/uploads/${localFileName}`;

        // 2. Also upload to Supabase storage if available
        try {
            const supabaseUrl = await uploadToSupabase(
                req.file.buffer,
                localFileName,
                req.file.mimetype,
                'cms_images'
            );
            if (supabaseUrl) {
                finalUrl = supabaseUrl;
            }
        } catch (storageErr) {
            console.warn('[Logo Upload]: Cloud storage upload warning, persisting local path:', storageErr.message);
        }

        // 3. Persist setting in database / config
        await updateSiteSettings({ site_logo: finalUrl });

        logAudit({
            adminId: req.user.id,
            adminUsername: req.user.username,
            action: 'UPDATE_SITE_LOGO',
            entityType: 'CMS',
            details: `Updated site logo with file: ${finalUrl}`,
            req
        });

        return success(res, { key: 'site_logo', url: finalUrl }, 'Site logo updated successfully!');
    } catch (err) {
        console.error('[Upload Site Logo Error]:', err);
        return error(res, 'Failed to upload site logo', 500);
    }
}

module.exports = {
    getSettings,
    updateSettings,
    uploadSettingImage,
    uploadLogo
};
