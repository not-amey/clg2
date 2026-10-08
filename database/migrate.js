const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'college-assets';

async function runMigration() {
    console.log('=======================================================');
    console.log('📦 Starting One-Time Data & Storage Migration to Supabase');
    console.log('=======================================================');

    if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes('your-project')) {
        console.error('❌ ERROR: Please configure valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env before running migration.');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const dbPath = path.join(__dirname, 'college.db');

    if (!fs.existsSync(dbPath)) {
        console.error(`❌ ERROR: SQLite database file not found at ${dbPath}`);
        process.exit(1);
    }

    const sqlite = new Database(dbPath);
    const urlMap = {};

    // 1. Upload files from uploads/ directory to Supabase Storage bucket
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir).filter(f => fs.statSync(path.join(uploadsDir, f)).isFile());
        console.log(`\n📁 Found ${files.length} local files in uploads/ folder. Uploading to '${SUPABASE_BUCKET}' storage bucket...`);

        for (const file of files) {
            const filePath = path.join(uploadsDir, file);
            const fileBuffer = fs.readFileSync(filePath);
            const ext = path.extname(file).toLowerCase();
            let mimeType = 'application/octet-stream';
            if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
            else if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.webp') mimeType = 'image/webp';
            else if (ext === '.pdf') mimeType = 'application/pdf';

            const storagePath = `uploads/${file}`;
            const { error: uploadErr } = await supabase.storage
                .from(SUPABASE_BUCKET)
                .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true });

            if (uploadErr) {
                console.warn(`⚠️ Warning uploading file ${file}: ${uploadErr.message}`);
            } else {
                const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
                const publicUrl = urlData.publicUrl;
                urlMap[`/uploads/${file}`] = publicUrl;
                urlMap[`uploads/${file}`] = publicUrl;
                urlMap[file] = publicUrl;
                console.log(`  ✅ Uploaded: ${file} -> ${publicUrl}`);
            }
        }
    } else {
        console.log('\n📁 No uploads/ folder found. Skipping storage file upload.');
    }

    // Helper to replace local uploads URL with Supabase URL
    const mapUrl = (val) => {
        if (!val || typeof val !== 'string') return val;
        for (const [localPath, cloudUrl] of Object.entries(urlMap)) {
            if (val.includes(localPath)) {
                return val.replace(localPath, cloudUrl);
            }
        }
        return val;
    };

    // 2. Migrate Database Tables
    const tablesInOrder = [
        'departments',
        'admins',
        'faculty',
        'courses',
        'students',
        'notices',
        'applications',
        'audit_logs',
        'password_resets',
        'site_settings'
    ];

    console.log('\n📊 Migrating SQLite database tables into Supabase...');

    for (const tableName of tablesInOrder) {
        try {
            const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
            if (rows.length === 0) {
                console.log(`  - Table '${tableName}': 0 rows (skipped)`);
                continue;
            }

            const transformedRows = rows.map(row => {
                const newRow = { ...row };
                for (const key of Object.keys(newRow)) {
                    if (typeof newRow[key] === 'string' && newRow[key].includes('uploads')) {
                        newRow[key] = mapUrl(newRow[key]);
                    }
                }
                return newRow;
            });

            let errorCount = 0;
            for (const item of transformedRows) {
                let upsertErr;
                if (tableName === 'site_settings') {
                    const { error } = await supabase.from(tableName).upsert(item, { onConflict: 'key' });
                    upsertErr = error;
                } else {
                    const { error } = await supabase.from(tableName).upsert(item, { onConflict: 'id' });
                    upsertErr = error;
                }

                if (upsertErr) {
                    console.warn(`  ⚠️ Table '${tableName}' row insert error: ${upsertErr.message}`);
                    errorCount++;
                }
            }

            console.log(`  ✅ Table '${tableName}': Migrated ${rows.length - errorCount}/${rows.length} rows successfully.`);
        } catch (err) {
            console.error(`  ❌ Failed to migrate table '${tableName}': ${err.message}`);
        }
    }

    console.log('\n=======================================================');
    console.log('🎉 Data and Files Migration Completed Successfully!');
    console.log('=======================================================');
}

if (require.main === module) {
    runMigration().catch(err => {
        console.error('❌ Migration Error:', err);
        process.exit(1);
    });
}

module.exports = runMigration;
