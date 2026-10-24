const publicModel = require('../models/publicModel');
const contentModel = require('../models/contentModel');
const contentController = require('./contentController');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

exports.getBanners = async (req, res) => {
    try {
        const data = await publicModel.getBanners();
        return successResponse(res, data, 'Banners retrieved');
    } catch (error) { return errorResponse(res, 'Failed to retrieve banners', 500); }
};

exports.getSermons = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        const data = await publicModel.getSermons(limit);
        return successResponse(res, data, 'Sermons retrieved');
    } catch (error) { return errorResponse(res, 'Failed to retrieve sermons', 500); }
};

exports.getLiveStream = async (req, res) => {
    try {
        const data = await publicModel.getLiveStream();
        return successResponse(res, data, 'Live stream retrieved');
    } catch (error) { return errorResponse(res, 'Failed to retrieve live stream', 500); }
};


exports.getEvents = async (req, res) => {
    try {
        const data = await publicModel.getEvents();
        return successResponse(res, data, 'Events retrieved');
    } catch (error) { return errorResponse(res, 'Failed to retrieve events', 500); }
};

exports.getGalleryAlbums = async (req, res) => {
    try {
        const data = await publicModel.getGalleryAlbums();
        return successResponse(res, data, 'Albums retrieved');
    } catch (error) { return errorResponse(res, 'Failed to retrieve albums', 500); }
};

exports.getAlbumImages = async (req, res) => {
    try {
        const data = await publicModel.getAlbumImages(req.params.id);
        return successResponse(res, data, 'Images retrieved');
    } catch (error) { return errorResponse(res, 'Failed to retrieve images', 500); }
};

exports.getPage = async (req, res) => {
    try {
        const data = await publicModel.getPage(req.params.key);
        if (!data) return errorResponse(res, 'Page not found', 404);
        return successResponse(res, data, 'Page retrieved');
    } catch (error) { return errorResponse(res, 'Failed to retrieve page', 500); }
};

exports.getLiveStreamComments = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
        const data = await contentModel.getLiveStreamComments(limit);
        return successResponse(res, data, 'Comments retrieved');
    } catch (error) { return errorResponse(res, 'Failed to retrieve comments: ' + error.message, 500); }
};

exports.postLiveStreamComment = async (req, res) => {
    try {
        const { author_name, comment_text } = req.body;
        if (!comment_text || !comment_text.trim()) {
            return errorResponse(res, 'Comment text cannot be empty', 400);
        }
        const data = await contentModel.postLiveStreamComment({
            author_name: (author_name || 'Online Churchgoer').trim(),
            comment_text: comment_text.trim(),
            author_badge: 'Viewer',
            is_admin: 0
        });
        return successResponse(res, data, 'Comment posted successfully', 201);
    } catch (error) { return errorResponse(res, 'Failed to post comment: ' + error.message, 500); }
};

exports.recordLiveStreamView = async (req, res) => {
    try {
        const viewerId = req.body.viewer_id || req.ip || ('v_' + Date.now());
        await contentController.registerViewerPing(viewerId, true, req.ip);
        return successResponse(res, { tracked: true }, 'View recorded');
    } catch (error) { return errorResponse(res, 'Failed to record view: ' + error.message, 500); }
};

exports.heartbeatLiveStreamView = async (req, res) => {
    try {
        const viewerId = req.body.viewer_id || req.ip || ('v_' + Date.now());
        await contentController.registerViewerPing(viewerId, false, req.ip);
        return successResponse(res, { alive: true }, 'Heartbeat recorded');
    } catch (error) { return errorResponse(res, 'Heartbeat failed', 500); }
};

exports.leaveLiveStreamView = async (req, res) => {
    try {
        const viewerId = req.body.viewer_id;
        if (viewerId) {
            contentController.removeViewer(viewerId);
        }
        return successResponse(res, { left: true }, 'Viewer left');
    } catch (error) { return errorResponse(res, 'Leave failed', 500); }
};

exports.getWebsiteContent = async (req, res) => {
    try {
        const section = req.params.section || 'all';
        const data = await publicModel.getWebsiteContent(section);
        if (!data) return errorResponse(res, 'Website content not found', 404);
        return successResponse(res, data, 'Website content retrieved successfully');
    } catch (error) {
        console.error('getWebsiteContent error:', error);
        return errorResponse(res, 'Failed to retrieve website content: ' + error.message, 500);
    }
};
