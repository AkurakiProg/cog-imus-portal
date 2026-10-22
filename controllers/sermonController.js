const sermonModel = require('../models/sermonModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');

exports.getAll = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || '',
            status: req.query.status || ''
        };

        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const sermons = await sermonModel.getAll(null, 0, filters);
            return successResponse(res, sermons, 'Sermons retrieved');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [sermons, total] = await Promise.all([
            sermonModel.getAll(limit, offset, filters),
            sermonModel.getCount(filters)
        ]);

        return paginatedResponse(res, sermons, total, page, limit, 'Sermons retrieved');
    } catch (error) {
        console.error('Get Sermons Error:', error);
        return errorResponse(res, 'Failed to retrieve sermons', 500);
    }
};

exports.saveSermon = async (req, res) => {
    try {
        const id = req.params.id;
        if (id) {
            await sermonModel.update(id, req.body);
            await userModel.logAudit(req.user.id, 'UPDATE', 'Sermons', id, null, req.body, req.ip, req.headers['user-agent']);
            return successResponse(res, null, 'Sermon updated');
        } else {
            const newId = await sermonModel.create(req.body);
            await userModel.logAudit(req.user.id, 'CREATE', 'Sermons', newId, null, req.body, req.ip, req.headers['user-agent']);
            return successResponse(res, { id: newId }, 'Sermon created', 201);
        }
    } catch (error) { return errorResponse(res, 'Failed to save sermon', 500); }
};

exports.deleteSermon = async (req, res) => {
    try {
        await sermonModel.delete(req.params.id);
        await userModel.logAudit(req.user.id, 'DELETE', 'Sermons', req.params.id, null, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Sermon deleted');
    } catch (error) { return errorResponse(res, 'Failed to delete sermon', 500); }
};