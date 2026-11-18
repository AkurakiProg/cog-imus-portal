const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure base upload directories exist
const uploadDirs = ['profiles', 'gallery', 'banners', 'documents', 'videos', 'content', 'announcements'];
uploadDirs.forEach(dir => {
    const fullPath = path.join(__dirname, '..', 'uploads', dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// Standard General & Profile Image Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'profiles';
        if ((req.baseUrl && req.baseUrl.includes('gallery')) || file.fieldname === 'photos' || file.fieldname === 'gallery_image' || file.fieldname === 'cover_image') {
            folder = 'gallery';
        } else if ((req.baseUrl && req.baseUrl.includes('banner')) || file.fieldname === 'banner_image') {
            folder = 'banners';
        } else if ((req.baseUrl && req.baseUrl.includes('announcements')) || file.fieldname === 'announcement_image') {
            folder = 'announcements';
        } else if (file.fieldname === 'document') {
            folder = 'documents';
        } else if (file.fieldname === 'content_image' || file.fieldname === 'image' || file.fieldname === 'logo') {
            folder = 'content';
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
        const filetypes = /jpeg|jpg|png|gif|webp|svg/;
        const mimetype = /image\/(jpeg|jpg|png|gif|webp|svg\+xml)/.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase().replace('.', ''));
        if (mimetype || extname) return cb(null, true);
        cb(new Error('Only valid image files (.jpeg, .jpg, .png, .gif, .webp, .svg) are allowed!'));
    }
});

// Dedicated Video Storage (Background Video) - Strictly 100 MB Limit
const videoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'uploads', 'videos'));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `video-${uniqueSuffix}${ext}`);
    }
});

const uploadVideo = multer({
    storage: videoStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // Strictly 100 MB Maximum Limit
    fileFilter: (req, file, cb) => {
        const validMimes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
        const validExts = /\.(mp4|webm|ogv|mov)$/i;
        const mimeOk = validMimes.includes(file.mimetype);
        const extOk = validExts.test(file.originalname);

        if (mimeOk || extOk) {
            return cb(null, true);
        }
        cb(new Error('Only supported video formats (.mp4, .webm, .ogv, .mov) are allowed!'));
    }
});

// Dedicated Website Image Storage (Logo, Hero, History, Welcome) - 10 MB Limit
const websiteImageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'uploads', 'content'));
    },
    filename: function (req, file, cb) {
        const prefix = (file.fieldname || 'content').replace(/[^a-zA-Z0-9]/g, '');
        const ext = path.extname(file.originalname).toLowerCase() || '.png';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    }
});

const uploadWebsiteImage = multer({
    storage: websiteImageStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp|svg/;
        const isSvg = file.mimetype === 'image/svg+xml' || /\.svg$/i.test(file.originalname);
        const isStandardImg = /image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype) || filetypes.test(path.extname(file.originalname).toLowerCase().replace('.', ''));

        if (isSvg || isStandardImg) {
            return cb(null, true);
        }
        cb(new Error('Only valid image files (.png, .jpg, .jpeg, .webp, .svg, .gif) are allowed!'));
    }
});

// Dedicated Announcement Image Storage (.jpg, .jpeg, .png, .webp, .gif) - Strictly 10 MB Limit
const announcementImageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dest = path.join(__dirname, '..', 'uploads', 'announcements');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `ann-${uniqueSuffix}${ext}`);
    }
});

const uploadAnnouncementImage = multer({
    storage: announcementImageStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const validExt = /^\.(jpe?g|png|webp|gif)$/i;
        const validMime = /^image\/(jpeg|jpg|png|webp|gif)$/i;
        const extOk = validExt.test(path.extname(file.originalname || ''));
        const mimeOk = validMime.test(file.mimetype || '');

        if (extOk && mimeOk) {
            return cb(null, true);
        }
        cb(new Error('Only valid image files (.jpg, .jpeg, .png, .webp, .gif) are allowed for announcements.'));
    }
});

upload.video = uploadVideo;
upload.uploadWebsiteVideo = uploadVideo;
upload.websiteImage = uploadWebsiteImage;
upload.uploadWebsiteImage = uploadWebsiteImage;
upload.announcementImage = uploadAnnouncementImage;

module.exports = upload;
