const supabase = require('../database/db');

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'college-assets';

const DEFAULT_SETTINGS = {
    hero_motto: 'KNOWLEDGE • DISCIPLINE • CHARACTER',
    hero_title: 'Shriman G. R. Warange Junior College',
    hero_subtitle: 'Providing quality higher secondary education in Malkapur. We are committed to fostering academic excellence, moral values, and preparing students for competitive examinations and university studies across Science, Commerce, and Arts.',
    admission_session: '2026-27',
    notice_banner_text: 'Admissions for Class XI (Science, Commerce & Arts) for the Academic Session 2026-27 are now open. Collect prospectus from the college office.',
    stat_years: '25+ Years',
    stat_pass_rate: '98.4%',
    stat_students: '1,200+',
    contact_phone: '+91 02329 222100',
    contact_email: 'info@warangecollege.edu.in',
    contact_address: 'Shriman G. R. Warange Junior College, Malkapur, Shahuwadi, Maharashtra — 415101',
    office_hours: '7:30 AM to 12:00 PM (Morning Shift)',
    img_hero_bg: 'https://raw.githubusercontent.com/not-amey/clgsite/main/prayer.png',
    img_assembly: 'https://raw.githubusercontent.com/not-amey/clgsite/main/prayer.png',
    img_lab: 'https://raw.githubusercontent.com/not-amey/clgsite/main/lab.png',
    img_principal: 'https://raw.githubusercontent.com/not-amey/clgsite/main/lab.png'
};

/**
 * Upload a file buffer to Supabase Storage
 */
async function uploadToSupabase(fileBuffer, originalName, mimeType, folder = 'uploads') {
    if (!fileBuffer) return null;
    
    const cleanFileName = (originalName || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder}/${Date.now()}_${cleanFileName}`;

    const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).upload(filePath, fileBuffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: true
    });

    if (error) {
        console.error('[Supabase Storage Upload Error]:', error.message || error);
        throw new Error(`Supabase Storage Upload Error: ${error.message}`);
    }

    const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filePath);
    return urlData.publicUrl;
}

/**
 * Get all site settings as key-value pairs
 */
async function getSiteSettings() {
    let settingsObj = { ...DEFAULT_SETTINGS };

    try {
        const { data, error } = await supabase.from('site_settings').select('*');
        if (!error && data && data.length > 0) {
            data.forEach(item => {
                if (item.value !== null && item.value !== undefined && item.value.trim() !== '') {
                    settingsObj[item.key] = item.value;
                }
            });
        }
    } catch (err) {
        console.error('[Supabase Settings Fetch Error]:', err.message || err);
    }

    return settingsObj;
}

/**
 * Update multiple text key-value settings
 */
async function updateSiteSettings(settingsMap) {
    const keys = Object.keys(settingsMap);
    if (keys.length === 0) return true;

    const upsertArray = keys.map(k => ({
        key: k,
        value: (settingsMap[k] && settingsMap[k].trim() !== '') ? settingsMap[k].trim() : (DEFAULT_SETTINGS[k] || ''),
        updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('site_settings').upsert(upsertArray);
    if (error) {
        console.error('[Supabase Settings Upsert Error]:', error.message || error);
        throw error;
    }

    return true;
}

/**
 * Upload Image to Supabase Storage & update setting
 */
async function uploadImageSetting(key, fileBuffer, mimeType, fileName) {
    const publicUrl = await uploadToSupabase(fileBuffer, fileName, mimeType, 'cms_images');
    await updateSiteSettings({ [key]: publicUrl });
    return publicUrl;
}

module.exports = {
    supabase,
    uploadToSupabase,
    getSiteSettings,
    updateSiteSettings,
    uploadImageSetting
};
