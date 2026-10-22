const auditModel = require('../models/auditModel');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

exports.getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const filters = {
            user: (req.query.user || '').trim(),
            action: (req.query.action || '').trim(),
            module: (req.query.module || '').trim(),
            record_id: (req.query.record_id || '').trim(),
            date_from: (req.query.date_from || '').trim(),
            date_to: (req.query.date_to || '').trim()
        };

        const [logs, total] = await Promise.all([
            auditModel.getAll(limit, offset, filters),
            auditModel.getCount(filters)
        ]);

        return successResponse(res, { logs, total, page, limit, filters }, 'Audit logs retrieved successfully');
    } catch (error) {
        console.error('Get Audit Logs Error:', error);
        return errorResponse(res, 'Failed to retrieve audit logs.', 500);
    }
};