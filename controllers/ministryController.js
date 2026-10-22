const ministryModel = require('../models/ministryModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');

exports.getAllMinistries = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || '',
            department: req.query.department || '',
            status: req.query.status || ''
        };

        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const ministries = await ministryModel.getAll(null, 0, filters);
            return successResponse(res, ministries, 'Ministries retrieved successfully');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [ministries, total] = await Promise.all([
            ministryModel.getAll(limit, offset, filters),
            ministryModel.getCount(filters)
        ]);

        return paginatedResponse(res, ministries, total, page, limit, 'Ministries retrieved successfully');
    } catch (error) {
        console.error('Get All Ministries Error:', error);
        return errorResponse(res, 'Failed to retrieve ministries.', 500);
    }
};

exports.getMyMinistry = async (req, res) => {
    try {
        const ministries = await ministryModel.getMyMinistries(req.user.id);
        if (!ministries || ministries.length === 0) {
            return successResponse(res, null, 'No ministry assigned');
        }
        const primary = {
            ...ministries[0],
            ministries
        };
        return successResponse(res, primary, 'Ministry retrieved successfully');
    } catch (error) {
        console.error('Get My Ministry Error:', error);
        return errorResponse(res, 'Failed to retrieve ministry.', 500);
    }
};

exports.getMyMinistryAttendance = async (req, res) => {
    try {
        const ministryId = req.query.ministryId || req.params.ministryId;
        if (!ministryId) {
            return errorResponse(res, 'Ministry ID is required.', 400);
        }
        const history = await ministryModel.getMemberMinistryAttendanceHistory(req.user.id, ministryId);
        return successResponse(res, history, 'Member attendance history retrieved successfully');
    } catch (error) {
        console.error('Get Member Ministry Attendance Error:', error);
        return errorResponse(res, 'Failed to retrieve attendance history.', 500);
    }
};

exports.getMinistryById = async (req, res) => {
    try {
        const ministry = await ministryModel.getById(req.params.id);
        if (!ministry) return errorResponse(res, 'Ministry not found.', 404);
        return successResponse(res, ministry, 'Ministry retrieved successfully');
    } catch (error) {
        console.error('Get Ministry Error:', error);
        return errorResponse(res, 'Failed to retrieve ministry.', 500);
    }
};

exports.createMinistry = async (req, res) => {
    try {
        const ministryId = await ministryModel.create(req.body);
        const newMinistry = await ministryModel.getById(ministryId);
        
        await userModel.logAudit(req.user.id, 'CREATE', 'Ministries', ministryId, null, newMinistry, req.ip, req.headers['user-agent']);
        return successResponse(res, newMinistry, 'Ministry created successfully', 201);
    } catch (error) {
        console.error('Create Ministry Error:', error);
        return errorResponse(res, 'Failed to create ministry. Code might already exist.', 500);
    }
};

exports.updateMinistry = async (req, res) => {
    try {
        const { id } = req.params;
        const oldMinistry = await ministryModel.getById(id);
        if (!oldMinistry) return errorResponse(res, 'Ministry not found.', 404);

        await ministryModel.update(id, req.body);
        const updatedMinistry = await ministryModel.getById(id);

        await userModel.logAudit(req.user.id, 'UPDATE', 'Ministries', id, oldMinistry, updatedMinistry, req.ip, req.headers['user-agent']);
        return successResponse(res, updatedMinistry, 'Ministry updated successfully');
    } catch (error) {
        console.error('Update Ministry Error:', error);
        return errorResponse(res, 'Failed to update ministry.', 500);
    }
};

exports.deleteMinistry = async (req, res) => {
    try {
        const { id } = req.params;
        const ministry = await ministryModel.getById(id);
        if (!ministry) return errorResponse(res, 'Ministry not found.', 404);

        await ministryModel.delete(id);
        await userModel.logAudit(req.user.id, 'DELETE', 'Ministries', id, ministry, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Ministry deleted successfully');
    } catch (error) {
        console.error('Delete Ministry Error:', error);
        return errorResponse(res, 'Failed to delete ministry.', 500);
    }
};

// --- Ministry Members ---
exports.getMinistryMembers = async (req, res) => {
    try {
        const members = await ministryModel.getMinistryMembers(req.params.id);
        return successResponse(res, members, 'Ministry members retrieved successfully');
    } catch (error) {
        console.error('Get Ministry Members Error:', error);
        return errorResponse(res, 'Failed to retrieve ministry members.', 500);
    }
};

exports.addMemberToMinistry = async (req, res) => {
    try {
        const { id } = req.params; // ministry id
        const { member_id, role_in_ministry } = req.body;
        
        const ministryMemberId = await ministryModel.addMember(id, member_id, role_in_ministry);
        await userModel.logAudit(req.user.id, 'ASSIGN', 'Ministries', id, null, { member_id, role_in_ministry }, req.ip, req.headers['user-agent']);
        
        return successResponse(res, { ministryMemberId }, 'Member added to ministry successfully', 201);
    } catch (error) {
        console.error('Add Member Error:', error);
        return errorResponse(res, 'Failed to add member to ministry.', 500);
    }
};

exports.removeMemberFromMinistry = async (req, res) => {
    try {
        const { ministry_member_id } = req.params;
        await ministryModel.removeMember(ministry_member_id);
        await userModel.logAudit(req.user.id, 'UNASSIGN', 'Ministries', ministry_member_id, null, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Member removed from ministry successfully');
    } catch (error) {
        console.error('Remove Member Error:', error);
        return errorResponse(res, 'Failed to remove member from ministry.', 500);
    }
};

// ============================================================
// Leader Assigned Ministries & Roster Attendance
// ============================================================

/**
 * Returns ministries assigned to the logged-in church leader.
 * Leaders only see their assigned ministry/ministries.
 */
exports.getLeaderAssignedMinistries = async (req, res) => {
    try {
        const assigned = await ministryModel.getAssignedMinistriesForLeader(req.user.id);
        
        // If user is Admin and has no specific leader assigned, allow viewing all ministries
        if (assigned.length === 0 && req.user.role_name === 'Admin') {
            const all = await ministryModel.getAll();
            return successResponse(res, all, 'Ministries retrieved successfully');
        }

        return successResponse(res, assigned, 'Assigned ministries retrieved successfully');
    } catch (error) {
        console.error('Get Leader Assigned Ministries Error:', error);
        return errorResponse(res, 'Failed to retrieve assigned ministries.', 500);
    }
};

/**
 * Returns the roster for a ministry along with individual attendance statistics.
 */
exports.getMinistryRosterWithAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const roster = await ministryModel.getMinistryRosterWithAttendance(id);
        return successResponse(res, roster, 'Ministry roster and attendance stats retrieved successfully');
    } catch (error) {
        console.error('Get Ministry Roster With Attendance Error:', error);
        return errorResponse(res, 'Failed to retrieve roster attendance.', 500);
    }
};

/**
 * Returns all recorded attendance sessions for a ministry.
 */
exports.getMinistryAttendanceSessions = async (req, res) => {
    try {
        const { id } = req.params;
        const sessions = await ministryModel.getMinistryAttendanceSessions(id);
        return successResponse(res, sessions, 'Ministry attendance sessions retrieved successfully');
    } catch (error) {
        console.error('Get Ministry Attendance Sessions Error:', error);
        return errorResponse(res, 'Failed to retrieve attendance sessions.', 500);
    }
};

/**
 * Returns session details and member status breakdown for a specific attendance session.
 */
exports.getAttendanceSessionDetails = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const details = await ministryModel.getAttendanceSessionDetails(attendanceId);
        if (!details) {
            return errorResponse(res, 'Attendance session not found.', 404);
        }
        return successResponse(res, {
            ...details.session,
            records: details.records
        }, 'Attendance session details retrieved successfully');
    } catch (error) {
        console.error('Get Attendance Session Details Error:', error);
        return errorResponse(res, 'Failed to retrieve session details.', 500);
    }
};

/**
 * Records a new ministry attendance session with member status breakdown.
 */
exports.recordMinistryAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { session_title, session_date } = req.body;

        if (!session_title || !session_date) {
            return errorResponse(res, 'Session title and date are required.', 400);
        }

        const attendanceId = await ministryModel.recordAttendanceSession(id, req.user.id, req.body);
        
        await userModel.logAudit(
            req.user.id, 'RECORD_ATTENDANCE', 'Ministries', id,
            null, { attendanceId, session_title, session_date },
            req.ip, req.headers['user-agent']
        );

        return successResponse(res, { attendanceId }, 'Ministry attendance session recorded successfully', 201);
    } catch (error) {
        console.error('Record Ministry Attendance Error:', error);
        return errorResponse(res, 'Failed to record ministry attendance.', 500);
    }
};

/**
 * Updates an existing ministry attendance session and member records.
 */
exports.updateMinistryAttendance = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { session_title, session_date } = req.body;

        if (!session_title || !session_date) {
            return errorResponse(res, 'Session title and date are required.', 400);
        }

        await ministryModel.updateAttendanceSession(attendanceId, req.body);

        await userModel.logAudit(
            req.user.id, 'UPDATE_ATTENDANCE', 'Ministries', attendanceId,
            null, { session_title, session_date },
            req.ip, req.headers['user-agent']
        );

        return successResponse(res, null, 'Ministry attendance session updated successfully');
    } catch (error) {
        console.error('Update Ministry Attendance Error:', error);
        return errorResponse(res, 'Failed to update attendance session.', 500);
    }
};

/**
 * Deletes a ministry attendance session.
 */
exports.deleteMinistryAttendance = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        await ministryModel.deleteAttendanceSession(attendanceId);

        await userModel.logAudit(
            req.user.id, 'DELETE_ATTENDANCE', 'Ministries', attendanceId,
            null, null, req.ip, req.headers['user-agent']
        );

        return successResponse(res, null, 'Attendance session deleted successfully');
    } catch (error) {
        console.error('Delete Ministry Attendance Error:', error);
        return errorResponse(res, 'Failed to delete attendance session.', 500);
    }
};

/**
 * Returns attendance history for a single member in a ministry.
 */
exports.getMemberAttendanceHistory = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const history = await ministryModel.getMemberAttendanceHistory(id, memberId);
        return successResponse(res, history, 'Member attendance history retrieved successfully');
    } catch (error) {
        console.error('Get Member Attendance History Error:', error);
        return errorResponse(res, 'Failed to retrieve member attendance history.', 500);
    }
};

/**
 * Returns all WORDA department heads.
 */
exports.getDepartmentHeads = async (req, res) => {
    try {
        const heads = await ministryModel.getDepartmentHeads();
        return successResponse(res, heads, 'Department heads retrieved successfully');
    } catch (error) {
        console.error('Get Department Heads Error:', error);
        return errorResponse(res, 'Failed to retrieve department heads.', 500);
    }
};

/**
 * Updates the department head of a specific WORDA department.
 */
exports.updateDepartmentHead = async (req, res) => {
    try {
        const { department } = req.params;
        const head_member_id = req.body.head_member_id !== undefined && req.body.head_member_id !== '' && req.body.head_member_id !== null
            ? (parseInt(req.body.head_member_id, 10) || null) 
            : null;

        const validDepts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        const matchedDept = validDepts.find(d => d.toLowerCase() === (department || '').toLowerCase());
        if (!matchedDept) {
            return errorResponse(res, 'Invalid WORDA department.', 400);
        }

        const oldHead = await ministryModel.getDepartmentHead(matchedDept);
        const updated = await ministryModel.updateDepartmentHead(matchedDept, head_member_id);

        await userModel.logAudit(
            req.user.id, 'UPDATE_DEPARTMENT_HEAD', 'Ministries', null,
            { department: matchedDept, old_head_id: oldHead ? oldHead.head_member_id : null },
            { department: matchedDept, new_head_id: head_member_id },
            req.ip, req.headers['user-agent']
        );

        return successResponse(res, updated, `${matchedDept} Department Head updated successfully`);
    } catch (error) {
        console.error('Update Department Head Error:', error);
        return errorResponse(res, error.message || 'Failed to update department head.', 400);
    }
};


/**
 * Returns department oversight for a leader if they are appointed as a Department Head.
 */
exports.getLeaderDepartmentOversight = async (req, res) => {
    try {
        const oversight = await ministryModel.getLeaderDepartmentOversight(req.user.id);
        return successResponse(res, oversight, 'Department oversight retrieved successfully');
    } catch (error) {
        console.error('Get Leader Department Oversight Error:', error);
        return errorResponse(res, 'Failed to retrieve department oversight.', 500);
    }
};
