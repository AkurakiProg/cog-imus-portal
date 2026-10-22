const realtimeBus = require('../utils/realtimeBus');
const contentModel = require('../models/contentModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');
const FacebookService = require('../utils/facebookService');

// Banners
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

// Sermons
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

// Live Stream Broadcast (Facebook Live)
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

// --- Real-time Livestream Analytics & Concurrent Viewer Tracking ---
const activeViewers = new Map(); // viewer_id -> { lastSeen: number, ip: string }
const sseClients = new Set(); // Set of active SSE res objects

function getActiveViewerCount() {
    const now = Date.now();
    const timeout = 25000; // 25s heartbeat expiry
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

// Helper methods for viewer tracking from public routes
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

    // Send initial snapshot immediately
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

    // Keep connection alive with comment ping every 15s
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
        
        // Push updated analytics snapshot
        contentModel.getLiveStreamAnalytics()
            .then(analytics => broadcastLiveAnalytics(analytics))
            .catch(() => {});

        return successResponse(res, data, is_live ? 'Facebook Live broadcast is now active!' : 'Live broadcast has ended.');
    } catch (error) {
        return errorResponse(res, 'Failed to toggle live stream: ' + error.message, 500);
    }
};

// Livestream Analytics
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
        broadcastLiveAnalytics(data); // Real-time push to all connected admin screens
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
            // Background sync error ignored
        }
    }, 60000);
    if (fbAutoSyncInterval && fbAutoSyncInterval.unref) fbAutoSyncInterval.unref();
}
initFbAutoSync();

// Livestream Comments
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