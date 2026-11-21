const fs = require('fs');
const path = require('path');
const realtimeBus = require('../utils/realtimeBus');
const contentModel = require('../models/contentModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');
const FacebookService = require('../utils/facebookService');

const inspectImageFileSignature = (filePath) => {
    const fd = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(512);
        const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
        const head = buffer.subarray(0, bytesRead);

        if (bytesRead >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
        if (bytesRead >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png';
        const ascii6 = head.subarray(0, 6).toString('ascii');
        if (ascii6 === 'GIF87a' || ascii6 === 'GIF89a') return 'gif';
        if (bytesRead >= 12 && head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
        // SVG: text XML/svg without inline script tags
        const textHead = head.toString('utf8').trimStart();
        if (/^(<\?xml[\s\S]*?)?<svg[\s>]/i.test(textHead)) {
            const fullContent = fs.readFileSync(filePath, 'utf8');
            if (/<script[\s>]/i.test(fullContent) || /on\w+\s*=/i.test(fullContent)) {
                return null;
            }
            return 'svg';
        }
        return null;
    } finally {
        fs.closeSync(fd);
    }
};

exports.getBanners = async (req, res) => {
    try {
        const data = await contentModel.getBanners();
        return successResponse(res, data, 'Banners retrieved successfully');
    } catch (error) { return errorResponse(res, 'Failed to retrieve banners.', 500); }
};

exports.saveBanner = async (req, res) => {
    try {
        const id = req.params.id;
        if (id) {
            await contentModel.updateBanner(id, req.body);
            await userModel.logAudit(req.user.id, 'UPDATE', 'Banners', id, null, req.body, req.ip, req.headers['user-agent']);
            return successResponse(res, null, 'Banner updated successfully');
        } else {
            const newId = await contentModel.createBanner(req.body, req.user.id);
            await userModel.logAudit(req.user.id, 'CREATE', 'Banners', newId, null, req.body, req.ip, req.headers['user-agent']);
            return successResponse(res, { id: newId }, 'Banner created successfully', 201);
        }
    } catch (error) { return errorResponse(res, 'Failed to save banner.', 500); }
};

exports.deleteBanner = async (req, res) => {
    try {
        await contentModel.deleteBanner(req.params.id);
        await userModel.logAudit(req.user.id, 'DELETE', 'Banners', req.params.id, null, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Banner deleted successfully');
    } catch (error) { return errorResponse(res, 'Failed to delete banner.', 500); }
};

exports.getSermons = async (req, res) => {
    try {
        const filters = { search: req.query.search || '' };
        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const data = await contentModel.getSermons(null, 0, filters);
            return successResponse(res, data, 'Sermons retrieved successfully');
        }
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const [data, total] = await Promise.all([
            contentModel.getSermons(limit, offset, filters),
            contentModel.getSermonsCount(filters)
        ]);
        return paginatedResponse(res, data, total, page, limit, 'Sermons retrieved successfully');
    } catch (error) {
        console.error('getSermons error:', error);
        return errorResponse(res, 'Failed to retrieve sermons.', 500);
    }
};

exports.saveSermon = async (req, res) => {
    try {
        const id = req.params.id;
        if (id) {
            await contentModel.updateSermon(id, req.body);
            await userModel.logAudit(req.user.id, 'UPDATE', 'Sermons', id, null, req.body, req.ip, req.headers['user-agent']);
            return successResponse(res, null, 'Sermon updated successfully');
        } else {
            const newId = await contentModel.createSermon(req.body);
            await userModel.logAudit(req.user.id, 'CREATE', 'Sermons', newId, null, req.body, req.ip, req.headers['user-agent']);
            return successResponse(res, { id: newId }, 'Sermon created successfully', 201);
        }
    } catch (error) { return errorResponse(res, 'Failed to save sermon.', 500); }
};

exports.deleteSermon = async (req, res) => {
    try {
        await contentModel.deleteSermon(req.params.id);
        await userModel.logAudit(req.user.id, 'DELETE', 'Sermons', req.params.id, null, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Sermon deleted successfully');
    } catch (error) { return errorResponse(res, 'Failed to delete sermon.', 500); }
};

exports.getLiveStream = async (req, res) => {
    try {
        const data = await contentModel.getLiveStream();
        return successResponse(res, data, 'Live stream status retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve live stream status: ' + error.message, 500);
    }
};

exports.saveLiveStream = async (req, res) => {
    try {
        const data = await contentModel.saveLiveStream(req.body, req.user ? req.user.id : null);
        const safeAuditBody = { ...req.body };
        if (safeAuditBody.stream_key) {
            safeAuditBody.stream_key = safeAuditBody.stream_key.slice(0, 4) + '****' + safeAuditBody.stream_key.slice(-4);
        }
        await userModel.logAudit(req.user.id, 'UPDATE', 'LiveStream', 1, null, safeAuditBody, req.ip, req.headers['user-agent']);
        return successResponse(res, data, 'Live stream configuration saved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to save live stream configuration: ' + error.message, 500);
    }
};

exports.getBroadcastRelayStatus = async (req, res) => {
    try {
        const stream = await contentModel.getLiveStream();
        const hasKey = Boolean(stream && stream.stream_key && stream.stream_key.trim().length > 5);
        return successResponse(res, {
            is_live: Boolean(stream && stream.is_live == 1),
            has_stream_key: hasKey,
            ingest_endpoint: 'rtmps://live-api-s.facebook.com:443/rtmp/',
            ingest_port: 443,
            protocol: 'RTMPS',
            studio_mode_supported: true,
            server_time: new Date().toISOString()
        }, 'Broadcast relay status retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve relay status: ' + error.message, 500);
    }
};

const activeViewers = new Map();
const sseClients = new Set();

function getActiveViewerCount() {
    const now = Date.now();
    const timeout = 25000;
    for (const [id, data] of activeViewers.entries()) {
        if (now - data.lastSeen > timeout) {
            activeViewers.delete(id);
        }
    }
    return activeViewers.size;
}

function broadcastLiveAnalytics(analyticsData) {
    if (!analyticsData) return;
    const activeCount = getActiveViewerCount();
    const payload = JSON.stringify({
        type: 'analytics_update',
        data: {
            ...analyticsData,
            summary: {
                ...analyticsData.summary,
                active_viewers: activeCount
            }
        }
    });

    for (const client of sseClients) {
        try {
            client.write(`data: ${payload}\n\n`);
        } catch (e) {
            sseClients.delete(client);
        }
    }
}

exports.registerViewerPing = async (viewerId, isInitial = false, ip = '') => {
    if (!viewerId) return;
    const isAlreadyActive = activeViewers.has(viewerId);
    activeViewers.set(viewerId, { lastSeen: Date.now(), ip });
    const activeCount = getActiveViewerCount();

    try {
        if (isInitial && !isAlreadyActive) {
            const analytics = await contentModel.recordPublicView(activeCount, viewerId, ip);
            broadcastLiveAnalytics(analytics);
        } else {
            await contentModel.updatePeakViewers(activeCount);
            const analytics = await contentModel.getLiveStreamAnalytics();
            broadcastLiveAnalytics(analytics);
        }
    } catch (err) {
        console.error('Error during viewer ping processing:', err);
    }
};

exports.removeViewer = (viewerId) => {
    if (!viewerId) return;
    activeViewers.delete(viewerId);
    contentModel.getLiveStreamAnalytics()
        .then(analytics => broadcastLiveAnalytics(analytics))
        .catch(() => {});
};

exports.streamLiveAnalytics = async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    try {
        const analytics = await contentModel.getLiveStreamAnalytics();
        const activeCount = getActiveViewerCount();
        const payload = JSON.stringify({
            type: 'analytics_update',
            data: {
                ...analytics,
                summary: {
                    ...analytics.summary,
                    active_viewers: activeCount
                }
            }
        });
        res.write(`data: ${payload}\n\n`);
    } catch (e) {
        console.error('Initial SSE analytics error:', e);
    }

    const keepAliveTimer = setInterval(() => {
        try {
            res.write(': keep-alive\n\n');
        } catch (e) {
            clearInterval(keepAliveTimer);
            sseClients.delete(res);
        }
    }, 15000);

    sseClients.add(res);

    req.on('close', () => {
        clearInterval(keepAliveTimer);
        sseClients.delete(res);
    });
};

exports.toggleLiveStream = async (req, res) => {
    try {
        let is_live = req.body.is_live;
        if (typeof is_live === 'object' && is_live !== null && 'is_live' in is_live) {
            is_live = is_live.is_live;
        }
        const numericLive = (is_live === true || is_live === 1 || is_live === '1' || is_live === 'true') ? 1 : 0;
        const data = await contentModel.toggleLiveStream(numericLive, req.user ? req.user.id : null);
        const action = numericLive ? 'START_BROADCAST' : 'END_BROADCAST';
        await userModel.logAudit(req.user.id, action, 'LiveStream', 1, null, { is_live: numericLive }, req.ip, req.headers['user-agent']);
        
        contentModel.getLiveStreamAnalytics()
            .then(analytics => broadcastLiveAnalytics(analytics))
            .catch(() => {});

        return successResponse(res, data, is_live ? 'Facebook Live broadcast is now active!' : 'Live broadcast has ended.');
    } catch (error) {
        return errorResponse(res, 'Failed to toggle live stream: ' + error.message, 500);
    }
};

exports.getLiveStreamAnalytics = async (req, res) => {
    try {
        const data = await contentModel.getLiveStreamAnalytics();
        data.summary.active_viewers = getActiveViewerCount();
        return successResponse(res, data, 'Livestream analytics retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve livestream analytics: ' + error.message, 500);
    }
};

exports.logLiveStreamViews = async (req, res) => {
    try {
        const data = await contentModel.logLiveStreamViews(req.body);
        data.summary.active_viewers = getActiveViewerCount();
        await userModel.logAudit(req.user.id, 'UPDATE', 'LiveStreamAnalytics', null, null, req.body, req.ip, req.headers['user-agent']);
        broadcastLiveAnalytics(data);
        return successResponse(res, data, 'Livestream views saved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to save livestream views: ' + error.message, 500);
    }
};

exports.syncFacebookLiveStream = async (req, res) => {
    try {
        const stream = await contentModel.getLiveStream();
        const syncResult = await FacebookService.syncFacebookMetrics(stream);
        const analytics = await contentModel.getLiveStreamAnalytics();
        analytics.summary.active_viewers = getActiveViewerCount();
        broadcastLiveAnalytics(analytics);

        if (!syncResult.configured) {
            return res.json({
                success: false,
                notConfigured: true,
                message: syncResult.message,
                data: analytics
            });
        }

        if (!syncResult.success) {
            return res.json({
                success: false,
                error: syncResult.error || syncResult.message,
                message: syncResult.message,
                data: analytics
            });
        }

        return successResponse(res, {
            analytics,
            syncResult
        }, syncResult.message || 'Facebook Live metrics synchronized successfully!');
    } catch (error) {
        return errorResponse(res, 'Failed to sync Facebook Live stream: ' + error.message, 500);
    }
};

// Automatic 60s background sync for Facebook Live when broadcast is live and token is configured
let fbAutoSyncInterval = null;
function initFbAutoSync() {
    if (fbAutoSyncInterval) return;
    fbAutoSyncInterval = setInterval(async () => {
        try {
            if (!FacebookService.isConfigured()) return;
            const stream = await contentModel.getLiveStream();
            if (stream && stream.is_live) {
                const res = await FacebookService.syncFacebookMetrics(stream);
                if (res && res.success) {
                    const analytics = await contentModel.getLiveStreamAnalytics();
                    analytics.summary.active_viewers = getActiveViewerCount();
                    broadcastLiveAnalytics(analytics);
                }
            }
        } catch (e) {
        }
    }, 60000);
    if (fbAutoSyncInterval && fbAutoSyncInterval.unref) fbAutoSyncInterval.unref();
}
initFbAutoSync();

exports.getLiveStreamComments = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
        const data = await contentModel.getLiveStreamComments(limit);
        return successResponse(res, data, 'Livestream comments retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve livestream comments: ' + error.message, 500);
    }
};

exports.postLiveStreamComment = async (req, res) => {
    try {
        const commentData = {
            author_name: req.body.author_name || (req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'COGWM Admin'),
            comment_text: req.body.comment_text,
            author_badge: req.user ? 'Admin' : (req.body.author_badge || 'Viewer'),
            is_admin: 1
        };
        const data = await contentModel.postLiveStreamComment(commentData);
        return successResponse(res, data, 'Comment posted successfully', 201);
    } catch (error) {
        return errorResponse(res, 'Failed to post comment: ' + error.message, 500);
    }
};

exports.deleteLiveStreamComment = async (req, res) => {
    try {
        await contentModel.deleteLiveStreamComment(req.params.id);
        await userModel.logAudit(req.user.id, 'DELETE', 'LiveStreamComment', req.params.id, null, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Comment deleted successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to delete comment: ' + error.message, 500);
    }
};

exports.getLiveStreamCommentLogs = async (req, res) => {
    try {
        const search = req.query.search || '';
        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const data = await contentModel.getLivestreamCommentLogs(null, 0, search);
            return successResponse(res, data, 'Livestream comment logs retrieved successfully');
        }
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 15;
        const offset = (page - 1) * limit;
        const [data, total] = await Promise.all([
            contentModel.getLivestreamCommentLogs(limit, offset, search),
            contentModel.getLivestreamCommentLogsCount(search)
        ]);
        return paginatedResponse(res, data, total, page, limit, 'Livestream comment logs retrieved successfully');
    } catch (error) {
        console.error('getLiveStreamCommentLogs error:', error);
        return errorResponse(res, 'Failed to retrieve comment logs: ' + error.message, 500);
    }
};

exports.getWebsiteSection = async (req, res) => {
    try {
        const section = req.params.section;
        if (section === 'all') {
            const all = await contentModel.getAllWebsiteContent();
            return successResponse(res, all, 'All website content retrieved');
        }
        const data = await contentModel.getWebsiteSection(section);
        if (!data) {
            return errorResponse(res, `Website content section not found: ${section}`, 404);
        }
        return successResponse(res, data, `Website section '${section}' retrieved`);
    } catch (error) {
        console.error('getWebsiteSection error:', error);
        return errorResponse(res, 'Failed to retrieve website content section: ' + error.message, 500);
    }
};

exports.saveWebsiteSection = async (req, res) => {
    try {
        const section = req.params.section;
        const payload = req.body;
        if (!payload || (typeof payload !== 'object' && typeof payload !== 'string')) {
            return errorResponse(res, 'Invalid content data payload', 400);
        }

        if (section === 'contact_us' && payload && typeof payload === 'object' && payload.payment_info) {
            const providers = [
                { key: 'gcash', label: 'GCash' },
                { key: 'bpi', label: 'BPI' },
                { key: 'bdo', label: 'BDO' }
            ];
            for (const p of providers) {
                const entry = payload.payment_info[p.key];
                if (!entry || typeof entry !== 'object') continue;
                if (entry.enabled !== false) {
                    const accName = String(entry.account_name || '').trim();
                    const accNum = String(entry.account_number || '').trim();
                    if (!accName || !accNum) {
                        return errorResponse(
                            res,
                            `${p.label} payment method is enabled and requires both an account name and account/mobile number.`,
                            400
                        );
                    }
                }
                if (entry.qr_image_url) {
                    const qrUrl = String(entry.qr_image_url).trim();
                    const safeQr = qrUrl.startsWith('/uploads/content/') || qrUrl === '/images/sample-qr-placeholder.svg';
                    if (!safeQr) {
                        return errorResponse(res, `Invalid QR image path provided for ${p.label}.`, 400);
                    }
                }
            }
        }

        const saved = await contentModel.saveWebsiteSection(section, payload, req.user ? req.user.id : null);
        
        await userModel.logAudit(
            req.user ? req.user.id : null,
            'UPDATE',
            'WebsiteContent',
            saved.page_id || 0,
            null,
            { section },
            req.ip,
            req.headers['user-agent']
        );

        try {
            realtimeBus.broadcast('website_content', {
                section,
                action: 'update',
                timestamp: Date.now()
            });
        } catch (busErr) {
            console.warn('RealtimeBus broadcast error:', busErr.message);
        }

        return successResponse(res, saved, `Website section '${section}' saved successfully`);
    } catch (error) {
        console.error('saveWebsiteSection error:', error);
        return errorResponse(res, 'Failed to save website content: ' + error.message, 500);
    }
};

exports.uploadWebsiteVideo = async (req, res) => {
    try {
        if (!req.file) {
            return errorResponse(res, 'No video file uploaded', 400);
        }
        const fileUrl = '/uploads/videos/' + req.file.filename;
        const fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(2);

        await userModel.logAudit(
            req.user ? req.user.id : null,
            'UPLOAD',
            'WebsiteVideo',
            0,
            null,
            { filename: req.file.filename, size: req.file.size },
            req.ip,
            req.headers['user-agent']
        );

        return successResponse(res, {
            url: fileUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            sizeMb: fileSizeMb
        }, 'Background video uploaded successfully');
    } catch (error) {
        console.error('uploadWebsiteVideo error:', error);
        return errorResponse(res, 'Failed to upload background video: ' + error.message, 500);
    }
};

exports.uploadWebsiteImage = async (req, res) => {
    try {
        if (!req.file) {
            return errorResponse(res, 'No image file uploaded', 400);
        }

        const detectedType = req.file.path ? inspectImageFileSignature(req.file.path) : null;
        const uploadContext = String(req.query.type || req.body?.upload_context || '').toLowerCase();
        const isQrContext = uploadContext === 'payment_qr';
        const allowedForContext = isQrContext ? ['png', 'jpeg', 'webp', 'gif'] : ['png', 'jpeg', 'webp', 'gif', 'svg'];

        if (!detectedType || !allowedForContext.includes(detectedType)) {
            if (req.file.path && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (unlinkErr) {}
            }
            const msg = isQrContext
                ? 'Invalid QR code image. Please upload a genuine PNG, JPG/JPEG, WEBP, or GIF image.'
                : 'Uploaded file is not a valid or safe image.';
            return errorResponse(res, msg, 400);
        }

        const fileUrl = '/uploads/content/' + req.file.filename;

        await userModel.logAudit(
            req.user ? req.user.id : null,
            'UPLOAD',
            'WebsiteImage',
            0,
            null,
            { filename: req.file.filename, size: req.file.size, context: uploadContext || 'cms' },
            req.ip,
            req.headers['user-agent']
        );

        return successResponse(res, {
            url: fileUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimeDetected: detectedType
        }, 'Image uploaded successfully');
    } catch (error) {
        console.error('uploadWebsiteImage error:', error);
        return errorResponse(res, 'Failed to upload image: ' + error.message, 500);
    }
};
