const realtimeBus = require('../utils/realtimeBus');
const eventModel = require('../models/eventModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');
const { pool } = require('../config/database');

function sanitizeEventData(raw) {
    const data = { ...raw };
    if (data.title) data.title = String(data.title).trim();
    if (data.start_datetime) {
        data.start_datetime = String(data.start_datetime).replace('T', ' ');
        if (data.start_datetime.length === 16) data.start_datetime += ':00';
    }
    if (data.end_datetime) {
        data.end_datetime = String(data.end_datetime).replace('T', ' ');
        if (data.end_datetime.length === 16) data.end_datetime += ':00';
    } else {
        data.end_datetime = null;
    }

    if (data.ministry_id !== undefined) {
        const mId = parseInt(data.ministry_id, 10);
        data.ministry_id = (!isNaN(mId) && mId > 0) ? mId : null;
    }
    if (data.department !== undefined) {
        const d = String(data.department).trim();
        data.department = (d && d !== 'None' && d !== 'null') ? d : null;
    }
    if (data.capacity !== undefined) {
        const c = parseInt(data.capacity, 10);
        data.capacity = (!isNaN(c) && c > 0) ? c : null;
    }
    if (data.venue !== undefined) {
        const v = String(data.venue).trim();
        data.venue = v || null;
    }
    if (data.organizer !== undefined) {
        const o = String(data.organizer).trim();
        data.organizer = o || null;
    }
    if (data.description !== undefined) {
        const desc = String(data.description).trim();
        data.description = desc || null;
    }

    function parseBool(val) {
        if (val === 1 || val === '1' || val === true || val === 'true') return 1;
        return 0;
    }
    if (data.is_enrollment_open !== undefined) data.is_enrollment_open = parseBool(data.is_enrollment_open);
    if (data.is_public !== undefined) data.is_public = parseBool(data.is_public);
    if (data.is_featured !== undefined) data.is_featured = parseBool(data.is_featured);

    return data;
}

exports.getAllEvents = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || '',
            type: req.query.type || req.query.event_type || '',
            event_type: req.query.event_type || req.query.type || '',
            department: req.query.department || '',
            ministry_id: req.query.ministry_id || '',
            status: req.query.status || '',
            enrollment: req.query.enrollment || req.query.is_enrollment_open || '',
            date: req.query.date || '',
            archived: req.query.archived || req.query.is_archived || 0
        };

        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const events = await eventModel.getAll(null, 0, filters);
            return successResponse(res, events, 'Events retrieved successfully');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [events, total] = await Promise.all([
            eventModel.getAll(limit, offset, filters),
            eventModel.getCount(filters)
        ]);

        return paginatedResponse(res, events, total, page, limit, 'Events retrieved successfully');
    } catch (error) {
        console.error('Get Events Error:', error);
        return errorResponse(res, 'Failed to retrieve events.', 500);
    }
};

exports.getEventById = async (req, res) => {
    try {
        const event = await eventModel.getById(req.params.id);
        if (!event) return errorResponse(res, 'Event not found.', 404);
        return successResponse(res, event, 'Event retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve event.', 500);
    }
};

exports.createEvent = async (req, res) => {
    try {
        const rawData = { ...req.body };
        if (req.file) rawData.banner_image = '/uploads/banners/' + req.file.filename;
        const data = sanitizeEventData(rawData);
        const eventId = await eventModel.create(data);
        const newEvent = await eventModel.getById(eventId);
        
        await userModel.logAudit(req.user.id, 'CREATE', 'Events', eventId, null, newEvent, req.ip, req.headers['user-agent']);
        realtimeBus.broadcast('events', { action: 'created', event_id: eventId });
        return successResponse(res, newEvent, 'Event created successfully', 201);
    } catch (error) {
        console.error('Create Event Error:', error);
        return errorResponse(res, 'Failed to create event: ' + error.message, 500);
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const oldEvent = await eventModel.getById(id);
        if (!oldEvent) return errorResponse(res, 'Event not found.', 404);

        const rawData = { ...req.body };
        if (req.file) rawData.banner_image = '/uploads/banners/' + req.file.filename;

        // Allow explicit clearing of optional foreign keys and fields
        if (rawData.ministry_id === '' || rawData.ministry_id === 'null' || rawData.ministry_id === '0') {
            rawData.ministry_id = null;
        }
        if (rawData.department === '' || rawData.department === 'None' || rawData.department === 'null') {
            rawData.department = null;
        }
        if (rawData.capacity === '' || rawData.capacity === '0') {
            rawData.capacity = null;
        }

        const mergedData = sanitizeEventData({ ...oldEvent, ...rawData });
        await eventModel.update(id, mergedData);
        const updatedEvent = await eventModel.getById(id);

        await userModel.logAudit(req.user.id, 'UPDATE', 'Events', id, oldEvent, updatedEvent, req.ip, req.headers['user-agent']);
        realtimeBus.broadcast('events', { action: 'updated', event_id: id });
        return successResponse(res, updatedEvent, 'Event updated successfully');
    } catch (error) {
        console.error('Update Event Error:', error);
        return errorResponse(res, 'Failed to update event: ' + error.message, 500);
    }
};

exports.archiveEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await eventModel.getById(id);
        if (!event) return errorResponse(res, 'Event not found.', 404);

        const status = (event.status || '').trim().toLowerCase();
        if (status !== 'completed' && status !== 'cancelled') {
            return errorResponse(res, 'Only events with status Completed or Cancelled can be archived.', 400);
        }

        await eventModel.archive(id);
        await userModel.logAudit(req.user.id, 'ARCHIVE', 'Events', id, event, { is_archived: 1 }, req.ip, req.headers['user-agent']);
        realtimeBus.broadcast('events', { action: 'archived', event_id: id });
        return successResponse(res, null, 'Event archived successfully');
    } catch (error) {
        console.error('Archive Event Error:', error);
        return errorResponse(res, 'Failed to archive event: ' + error.message, 500);
    }
};

exports.restoreEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await eventModel.getById(id);
        if (!event) return errorResponse(res, 'Event not found.', 404);

        await eventModel.restore(id);
        await userModel.logAudit(req.user.id, 'RESTORE', 'Events', id, event, { is_archived: 0 }, req.ip, req.headers['user-agent']);
        realtimeBus.broadcast('events', { action: 'restored', event_id: id });
        return successResponse(res, null, 'Event restored successfully from archives');
    } catch (error) {
        console.error('Restore Event Error:', error);
        return errorResponse(res, 'Failed to restore event: ' + error.message, 500);
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await eventModel.getById(id);
        if (!event) return errorResponse(res, 'Event not found.', 404);

        await eventModel.delete(id);
        await userModel.logAudit(req.user.id, 'DELETE', 'Events', id, event, null, req.ip, req.headers['user-agent']);
        realtimeBus.broadcast('events', { action: 'deleted', event_id: id });
        return successResponse(res, null, 'Event deleted successfully');
    } catch (error) {
        console.error('Delete Event Error:', error);
        return errorResponse(res, 'Failed to delete event.', 500);
    }
};

// --- Enrollments ---
exports.getEventEnrollments = async (req, res) => {
    try {
        const enrollments = await eventModel.getEnrollments(req.params.id);
        return successResponse(res, enrollments, 'Enrollments retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve enrollments.', 500);
    }
};

exports.updateEnrollmentStatus = async (req, res) => {
    try {
        const { enrollmentId } = req.params;
        const { status } = req.body;
        if (!status) {
            return errorResponse(res, 'Status is required.', 400);
        }
        await eventModel.updateEnrollmentStatus(enrollmentId, status);
        realtimeBus.broadcast('events', { action: 'enrollment_updated', enrollment_id: enrollmentId });
        return successResponse(res, null, 'Enrollment status updated successfully.');
    } catch (error) {
        return errorResponse(res, 'Failed to update enrollment status.', 500);
    }
};

exports.enrollMember = async (req, res) => {
    try {
        const eventId = req.params.id;
        
        // Find the member_id associated with the logged-in user
        const [memberRows] = await pool.execute(
            'SELECT member_id FROM members WHERE user_id = ?', [req.user.id]
        );
        
        if (memberRows.length === 0) {
            return errorResponse(res, 'You do not have a member profile to enroll.', 400);
        }
        
        const memberId = memberRows[0].member_id;

        // Check if already enrolled
        const existing = await eventModel.checkEnrollment(eventId, memberId);
        if (existing) {
            return errorResponse(res, 'You are already enrolled in this event.', 400);
        }

        const enrollmentId = await eventModel.enrollMember(eventId, memberId);
        await userModel.logAudit(req.user.id, 'ENROLL', 'Events', eventId, null, { member_id: memberId }, req.ip, req.headers['user-agent']);
        realtimeBus.broadcast('events', { action: 'enrolled', event_id: eventId });
        
        return successResponse(res, { enrollmentId }, 'Enrolled successfully!', 201);
    } catch (error) {
        return errorResponse(res, 'Failed to enroll.', 500);
    }
};

exports.getMyEnrollments = async (req, res) => {
    try {
        const [memberRows] = await pool.execute(
            'SELECT member_id FROM members WHERE user_id = ?', [req.user.id]
        );
        if (memberRows.length === 0) {
            return successResponse(res, [], 'No member profile found');
        }
        const enrollments = await eventModel.getMemberEnrollments(memberRows[0].member_id);
        return successResponse(res, enrollments, 'Member enrollments retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve your enrollments.', 500);
    }
};

exports.cancelMyEnrollment = async (req, res) => {
    try {
        const eventId = req.params.id;
        const [memberRows] = await pool.execute(
            'SELECT member_id FROM members WHERE user_id = ?', [req.user.id]
        );
        if (memberRows.length === 0) {
            return errorResponse(res, 'Member profile required to manage enrollment.', 400);
        }
        const memberId = memberRows[0].member_id;
        await eventModel.cancelEnrollment(eventId, memberId);
        await userModel.logAudit(req.user.id, 'CANCEL_ENROLL', 'Events', eventId, null, { member_id: memberId }, req.ip, req.headers['user-agent']);
        realtimeBus.broadcast('events', { action: 'enrollment_cancelled', event_id: eventId });
        return successResponse(res, null, 'Enrollment cancelled successfully.');
    } catch (error) {
        return errorResponse(res, 'Failed to cancel enrollment: ' + error.message, 500);
    }
};