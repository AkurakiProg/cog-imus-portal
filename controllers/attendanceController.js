const realtimeBus = require('../utils/realtimeBus');
const attendanceModel = require('../models/attendanceModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');

exports.getAll = async (req, res) => {
    try {
        const filters = {
            service_type: req.query.service_type || '',
            date_from: req.query.date_from || '',
            date_to: req.query.date_to || '',
            search: req.query.search || ''
        };

        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const data = await attendanceModel.getAll(null, 0, filters);
            return successResponse(res, data, 'Attendance records retrieved');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [data, total] = await Promise.all([
            attendanceModel.getAll(limit, offset, filters),
            attendanceModel.getCount(filters)
        ]);

        return paginatedResponse(res, data, total, page, limit, 'Attendance records retrieved');
    } catch (error) {
        console.error('Get Attendance Error:', error);
        return errorResponse(res, 'Failed to retrieve attendance', 500);
    }
};

exports.create = async (req, res) => {
    try {
        const id = await attendanceModel.create(req.body, req.user.id);
        await userModel.logAudit(req.user.id, 'CREATE', 'Attendance', id, null, req.body, req.ip, req.headers['user-agent']);
        return successResponse(res, { id }, 'Attendance recorded successfully', 201);
    } catch (error) {
        return errorResponse(res, 'Failed to record attendance', 500);
    }
};

exports.getSummary = async (req, res) => {
    try {
        const data = await attendanceModel.getSummary();
        return successResponse(res, data, 'Attendance summary retrieved');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve summary', 500);
    }
};