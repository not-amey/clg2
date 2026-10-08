const multer = require('multer');
const path = require('path');

// Memory storage for serverless environments (Vercel) & direct Supabase upload
const storage = multer.memoryStorage();

// Allowed MIME types and extensions mapping
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx'];

// File Filter Function
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;

    if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIME_TYPES.includes(mime)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Only images (JPG, PNG), PDFs, and Word documents are permitted. Got extension: ${ext}`), false);
    }
};

// Multer Instance
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024 // Default 10MB
    }
});

module.exports = upload;
