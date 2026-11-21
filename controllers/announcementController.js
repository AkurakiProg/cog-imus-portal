const fs = require('fs');
const path = require('path');
const realtimeBus = require('../utils/realtimeBus');
const announcementModel = require('../models/announcementModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');

const ANNOUNCEMENTS_UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads', 'announcements');

function validateUploadedImageFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return false;
    try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile() || stats.size < 8) return false;

        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(12);
        const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
        fs.closeSync(fd);
        if (bytesRead < 4) return false;

        if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
        if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
        if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
        if (bytesRead >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return true;

        return false;
    } catch (e) {
        return false;
    }
}

function safeUnlinkAnnouncementFile(fileOrRelativePath) {
    if (!fileOrRelativePath) return;
    try {
        const raw = String(fileOrRelativePath);
        const resolved = raw.startsWith('/uploads/announcements/')
            ? path.resolve(__dirname, '..', raw.replace(/^\/+/, ''))
            : path.resolve(raw);
        if (!resolved.startsWith(ANNOUNCEMENTS_UPLOAD_DIR + path.sep)) return;
        if (fs.existsSync(resolved)) {
            fs.unlinkSync(resolved);
        }
    } catch (e) {}
}

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
        const title = (req.body.title || '').toString().trim();
        const content = (req.body.content || '').toString().trim();

        if (!title || !content) {
            if (req.file && req.file.path) safeUnlinkAnnouncementFile(req.file.path);
            return errorResponse(res, 'Announcement title and content are required.', 400);
        }

        if (!req.file) {
            return errorResponse(res, 'Announcement image is required. Please upload a valid image (.jpg, .jpeg, .png, .webp, .gif).', 400);
        }

        if (!validateUploadedImageFile(req.file.path)) {
            safeUnlinkAnnouncementFile(req.file.path);
            return errorResponse(res, 'Invalid or corrupted image file. Please upload a valid image (.jpg, .jpeg, .png, .webp, .gif).', 400);
        }

        const imagePath = `/uploads/announcements/${req.file.filename}`;
        const createPayload = {
            ...req.body,
            title,
            content,
            image_path: imagePath
        };

        const id = await announcementModel.create(createPayload, req.user.id);
        await userModel.logAudit(req.user.id, 'CREATE', 'Announcements', id, null, createPayload, req.ip, req.headers['user-agent']);
        realtimeBus.broadcast('announcements', { action: 'create', id });
        return successResponse(res, { id, announcement_id: id, image_path: imagePath }, 'Announcement created successfully', 201);
    } catch (error) {
        if (req.file && req.file.path) safeUnlinkAnnouncementFile(req.file.path);
        console.error('Create Announcement Error:', error);
        return errorResponse(res, 'Failed to create announcement.', 500);
    }
};

exports.update = async (req, res) => {
    try {
        const old = await announcementModel.getById(req.params.id);
        if (!old) {
            if (req.file && req.file.path) safeUnlinkAnnouncementFile(req.file.path);
            return errorResponse(res, 'Announcement not found.', 404);
        }

        const title = (req.body.title !== undefined ? req.body.title : old.title || '').toString().trim();
        const content = (req.body.content !== undefined ? req.body.content : old.content || '').toString().trim();
        if (!title || !content) {
            if (req.file && req.file.path) safeUnlinkAnnouncementFile(req.file.path);
            return errorResponse(res, 'Announcement title and content are required.', 400);
        }

        const removeRequested = req.body.remove_image === '1' || req.body.remove_image === 'true' || req.body.remove_image === true;
        let finalImagePath = null;

        if (req.file) {
            if (!validateUploadedImageFile(req.file.path)) {
                safeUnlinkAnnouncementFile(req.file.path);
                return errorResponse(res, 'Invalid or corrupted image file. Please upload a valid image (.jpg, .jpeg, .png, .webp, .gif).', 400);
            }
            finalImagePath = `/uploads/announcements/${req.file.filename}`;
        } else if (!removeRequested && old.image_path && String(old.image_path).trim()) {
            finalImagePath = old.image_path;
        } else {
            return errorResponse(res, 'Announcement image is required. Please upload an image to save this announcement.', 400);
        }

        const updatePayload = {
            title,
            content,
            image_path: finalImagePath,
            category: req.body.category !== undefined ? req.body.category : old.category,
            department: req.body.department !== undefined ? req.body.department : old.department,
            ministry_id: req.body.ministry_id !== undefined ? req.body.ministry_id : old.ministry_id,
            target_audience: req.body.target_audience !== undefined ? req.body.target_audience : old.target_audience,
            is_pinned: req.body.is_pinned !== undefined ? req.body.is_pinned : old.is_pinned,
            is_published: req.body.is_published !== undefined ? req.body.is_published : old.is_published,
            publish_date: req.body.publish_date !== undefined ? req.body.publish_date : old.publish_date,
            expiry_date: req.body.expiry_date !== undefined ? req.body.expiry_date : old.expiry_date
        };

        await announcementModel.update(req.params.id, updatePayload);
        await userModel.logAudit(req.user.id, 'UPDATE', 'Announcements', req.params.id, old, updatePayload, req.ip, req.headers['user-agent']);

        if (req.file && old.image_path && old.image_path !== finalImagePath) {
            safeUnlinkAnnouncementFile(old.image_path);
        }

        realtimeBus.broadcast('announcements', { action: 'update', id: Number(req.params.id) });
        return successResponse(res, { id: Number(req.params.id), announcement_id: Number(req.params.id), image_path: finalImagePath }, 'Announcement updated successfully');
    } catch (error) {
        if (req.file && req.file.path) safeUnlinkAnnouncementFile(req.file.path);
        console.error('Update Announcement Error:', error);
        return errorResponse(res, 'Failed to update announcement.', 500);
    }
};

exports.delete = async (req, res) => {
    try {
        const old = await announcementModel.getById(req.params.id);
        await announcementModel.delete(req.params.id);
        await userModel.logAudit(req.user.id, 'DELETE', 'Announcements', req.params.id, old, null, req.ip, req.headers['user-agent']);
        if (old && old.image_path) {
            safeUnlinkAnnouncementFile(old.image_path);
        }
        realtimeBus.broadcast('announcements', { action: 'delete', id: Number(req.params.id) });
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