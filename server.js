require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { testConnection } = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// Security & Middleware
// ============================================================
app.use(compression());

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'sameorigin' }
}));

const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors({
    origin: corsOrigin && corsOrigin !== '*' 
        ? (corsOrigin.includes(',') ? corsOrigin.split(',').map(s => s.trim()) : corsOrigin)
        : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    skip: (req) => req.originalUrl && (
        req.originalUrl.includes('/check-session') ||
        req.originalUrl.includes('/realtime/stream') ||
        req.originalUrl.includes('/livestream/realtime-stream') ||
        req.originalUrl.includes('/livestream/heartbeat') ||
        req.originalUrl.includes('/livestream/leave')
    ),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes.'
    }
});
app.use('/api/', limiter);

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// ============================================================
// Static Files (Frontend with optimized caching)
// ============================================================
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0,
    etag: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.match(/\.(js|css)$/i)) {
            // HTML, JS, and CSS must always revalidate with the server so updates apply immediately
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else if (filePath.match(/\.(svg|ico|png|jpg|jpeg|webp|woff|woff2)$/i)) {
            // Static images and web fonts are safely cached
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    etag: true
}));

app.get('/favicon.ico', (req, res) => {
    res.type('image/svg+xml');
    res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

app.get('/images/default-avatar.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'images', 'default-avatar.png'));
});

// ============================================================
// Health Check
// ============================================================
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'healthy',
        message: 'Church Portal API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// ============================================================
// API Routes (placeholders - will be implemented in next modules)
// ============================================================
const userAccountRoutes = require('./routes/userAccountRoutes');
const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const ministryRoutes = require('./routes/ministryRoutes');
const financeRoutes = require('./routes/financeRoutes');
const eventRoutes = require('./routes/eventRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const contentRoutes = require('./routes/contentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const sermonRoutes = require('./routes/sermonRoutes');
const auditRoutes = require('./routes/auditRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const publicRoutes = require('./routes/publicRoutes');
const systemRoutes = require('./routes/systemRoutes');
const contactRoutes = require('./routes/contactRoutes');
const c2sRoutes = require('./routes/c2sRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');

app.use('/api/users', userAccountRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/ministries', ministryRoutes);
app.use('/api/c2s', c2sRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/sermons', sermonRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/realtime', realtimeRoutes);

// ============================================================
// Clean Page Routes (Serve views with friendly clean URLs)
// ============================================================
const VIEWS_DIR = path.join(__dirname, 'public', 'views');

app.get('/', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'login.html')));
app.get('/sermons', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'sermons.html')));
app.get('/events', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'events.html')));
app.get('/gallery', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'gallery.html')));
app.get('/history', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'history.html')));
app.get('/about', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'history.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'contact.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'admin-dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'admin-dashboard.html')));
app.get('/leader-dashboard', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'leader-dashboard.html')));
app.get('/leader', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'leader-dashboard.html')));
app.get('/member-dashboard', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'member-dashboard.html')));
app.get('/member', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'member-dashboard.html')));

// ============================================================
// Error Handling
// ============================================================
app.use(notFound);
app.use(errorHandler);

// ============================================================
// Start Server
// ============================================================
async function startServer() {
    await testConnection();

    return app.listen(PORT, () => {
        logger.info('========================================================');
        logger.info('  Church of God World Missions Philippines - Imus');
        logger.info('  Web Portal Server');
        logger.info('========================================================');
        logger.info(`Server running on port: ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`Frontend: http://localhost:${PORT}`);
        logger.info(`API Base:  http://localhost:${PORT}/api`);
        logger.info(`Health:    http://localhost:${PORT}/api/health`);
        logger.info('========================================================');
    });
}

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason.message || reason}`);
});

process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
});

if (require.main === module) {
    startServer();
}

module.exports = app;
module.exports.startServer = startServer;