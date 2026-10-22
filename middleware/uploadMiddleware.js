const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure base upload directories exist
['profiles', 'gallery', 'banners', 'documents'].forEach(dir => {
    const fullPath = path.join(__dirname, '..', 'uploads', dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'profiles';
        if ((req.baseUrl && req.baseUrl.includes('gallery')) || file.fieldname === 'photos' || file.fieldname === 'gallery_image' || file.fieldname === 'cover_image') {
            folder = 'gallery';
        } else if ((req.baseUrl && req.baseUrl.includes('banner')) || file.fieldname === 'banner_image') {
            folder = 'banners';
        } else if (file.fieldname === 'document') {
            folder = 'documents';
        }
        cb(null, path.join(__dirname, '..', 'uploads', folder));
    },
    filename: function (req, file, cb) {
        const prefix = (file.fieldname || 'img').replace(/[^a-zA-Z0-9]/g, '');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only valid image files (.jpeg, .jpg, .png, .gif, .webp) are allowed!'));
    }
});

module.exports = upload;