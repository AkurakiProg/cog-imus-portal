const realtimeBus = require('../utils/realtimeBus');
const announcementModel = require('../models/announcementModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');

exports.getAll = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || '',
            department: req.query.department || '',
            ministry_id: req.query.ministry_id || '',
            category: req.query.category || '',
            target_audience: req.query.target_audience || req.query.audience || '',
            is_pinned: req.query.is_pinned,
            is_published: req.query.is_published,
            publish_date: req.query.publish_date || req.query.date || ''
        };

        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const data = await announcementModel.getAll(null, 0, filters);
            return successResponse(res, data, 'Announcements retrieved successfully');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [data, total] = await Promise.all([
            announcementModel.getAll(limit, offset, filters),
            announcementModel.getCount(filters)
        ]);

        return paginatedResponse(res, data, total, page, limit, 'Announcements retrieved successfully');
    } catch (error) {
        console.error('Get Announcements Error:', error);
        return errorResponse(res, 'Failed to retrieve announcements.', 500);
    }
};

exports.getById = async (req, res) => {
    try {
        const data = await announcementModel.getById(req.params.id);
        if (!data) return errorResponse(res, 'Announcement not found.', 404);
        return successResponse(res, data, 'Announcement retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve announcement.', 500);
    }
};

exports.create = async (req, res) => {
    try {
        const id = await announcementModel.create(req.body, req.user.id);
        await userModel.logAudit(req.user.id, 'CREATE', 'Announcements', id, null, req.body, req.ip, req.headers['user-agent']);
        return successResponse(res, { id, announcement_id: id }, 'Announcement created successfully', 201);
    } catch (error) {
        return errorResponse(res, 'Failed to create announcement.', 500);
    }
};

exports.update = async (req, res) => {
    try {
        const old = await announcementModel.getById(req.params.id);
        await announcementModel.update(req.params.id, req.body);
        await userModel.logAudit(req.user.id, 'UPDATE', 'Announcements', req.params.id, old, req.body, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Announcement updated successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to update announcement.', 500);
    }
};

exports.delete = async (req, res) => {
    try {
        const old = await announcementModel.getById(req.params.id);
        await announcementModel.delete(req.params.id);
        await userModel.logAudit(req.user.id, 'DELETE', 'Announcements', req.params.id, old, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Announcement deleted successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to delete announcement.', 500);
    }
};

exports.triggerEmailBroadcast = async (req, res) => {
    try {
        const result = await announcementModel.triggerEmailBroadcast(req.params.id, req.user.id);
        await userModel.logAudit(req.user.id, 'TRIGGER_EMAIL_BROADCAST', 'Announcements', req.params.id, null, result, req.ip, req.headers['user-agent']);
        
        let msg = `Email broadcast delivered to ${result.sentCount} of ${result.count} active member(s).`;
        if (result.failedCount > 0) msg += ` (${result.failedCount} failed delivery)`;
        
        return successResponse(res, result, msg);
    } catch (error) {
        return errorResponse(res, error.message || 'Failed to trigger email broadcast.', 500);
    }
};

exports.triggerSms = async (req, res) => {
    try {
        const result = await announcementModel.triggerSmsBroadcast(req.params.id, req.user.id);
        await userModel.logAudit(req.user.id, 'TRIGGER_SMS_BROADCAST', 'Announcements', req.params.id, null, result, req.ip, req.headers['user-agent']);
        
        let msg = `SMS broadcast dispatched to ${result.count} member(s).`;
        if (result.sentCount > 0) msg += ` (${result.sentCount} sent via carrier gateway)`;
        if (result.simulatedCount > 0) msg += ` (${result.simulatedCount} simulated / sandbox verified)`;
        if (result.failedCount > 0) msg += ` (${result.failedCount} failed)`;
        
        return successResponse(res, result, msg);
    } catch (error) {
        console.error('Trigger SMS Error:', error);
        return errorResponse(res, error.message || 'Failed to trigger SMS broadcast.', 500);
    }
};