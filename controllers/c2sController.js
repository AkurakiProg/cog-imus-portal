const realtimeBus = require('../utils/realtimeBus');
const c2sModel = require('../models/c2sModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');

exports.getAllGroups = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || '',
            status: req.query.status || '',
            meeting_day: req.query.meeting_day || ''
        };

        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const groups = await c2sModel.getAll(null, 0, filters);
            return successResponse(res, groups, 'C2S groups retrieved successfully');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [groups, total] = await Promise.all([
            c2sModel.getAll(limit, offset, filters),
            c2sModel.getCount(filters)
        ]);

        return paginatedResponse(res, groups, total, page, limit, 'C2S groups retrieved successfully');
    } catch (error) {
        console.error('Get All C2S Groups Error:', error);
        return errorResponse(res, 'Failed to retrieve C2S groups.', 500);
    }
};

exports.getGroupById = async (req, res) => {
    try {
        const group = await c2sModel.getById(req.params.id);
        if (!group) return errorResponse(res, 'C2S group not found.', 404);
        return successResponse(res, group, 'C2S group retrieved successfully');
    } catch (error) {
        console.error('Get C2S Group Error:', error);
        return errorResponse(res, 'Failed to retrieve C2S group.', 500);
    }
};

exports.createGroup = async (req, res) => {
    try {
        const { group_name, leader_id } = req.body;
        if (!group_name || !leader_id) {
            return errorResponse(res, 'Group name and Leader (Mentor) are required.', 400);
        }

        const groupId = await c2sModel.create(req.body);
        const newGroup = await c2sModel.getById(groupId);

        await userModel.logAudit(req.user.id, 'CREATE', 'C2S_Groups', groupId, null, newGroup, req.ip, req.headers['user-agent']);
        return successResponse(res, newGroup, 'C2S group created successfully', 201);
    } catch (error) {
        console.error('Create C2S Group Error:', error);
        return errorResponse(res, error.message || 'Failed to create C2S group.', 500);
    }
};

exports.updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const oldGroup = await c2sModel.getById(id);
        if (!oldGroup) return errorResponse(res, 'C2S group not found.', 404);

        await c2sModel.update(id, req.body);
        const updatedGroup = await c2sModel.getById(id);

        await userModel.logAudit(req.user.id, 'UPDATE', 'C2S_Groups', id, oldGroup, updatedGroup, req.ip, req.headers['user-agent']);
        return successResponse(res, updatedGroup, 'C2S group updated successfully');
    } catch (error) {
        console.error('Update C2S Group Error:', error);
        return errorResponse(res, error.message || 'Failed to update C2S group.', 500);
    }
};

exports.deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const oldGroup = await c2sModel.getById(id);
        if (!oldGroup) return errorResponse(res, 'C2S group not found.', 404);

        await c2sModel.delete(id);
        await userModel.logAudit(req.user.id, 'DELETE', 'C2S_Groups', id, oldGroup, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'C2S group deleted successfully');
    } catch (error) {
        console.error('Delete C2S Group Error:', error);
        return errorResponse(res, error.message || 'Failed to delete C2S group.', 500);
    }
};

exports.addMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { member_id } = req.body;
        if (!member_id) return errorResponse(res, 'Member ID is required.', 400);

        await c2sModel.addMember(id, req.body);
        const updatedGroup = await c2sModel.getById(id);

        await userModel.logAudit(req.user.id, 'ADD_MEMBER', 'C2S_Groups', id, null, { member_id }, req.ip, req.headers['user-agent']);
        return successResponse(res, updatedGroup, 'Member added to C2S group successfully');
    } catch (error) {
        console.error('Add Member to C2S Error:', error);
        return errorResponse(res, error.message || 'Failed to add member to C2S group.', 400);
    }
};

exports.removeMember = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        await c2sModel.removeMember(id, memberId);
        const updatedGroup = await c2sModel.getById(id);

        await userModel.logAudit(req.user.id, 'REMOVE_MEMBER', 'C2S_Groups', id, { memberId }, null, req.ip, req.headers['user-agent']);
        return successResponse(res, updatedGroup, 'Member removed from C2S group successfully');
    } catch (error) {
        console.error('Remove Member from C2S Error:', error);
        return errorResponse(res, error.message || 'Failed to remove member from C2S group.', 500);
    }
};

exports.getAvailableMembers = async (req, res) => {
    try {
        const members = await c2sModel.getAvailableMembers();
        return successResponse(res, members, 'Available members retrieved successfully');
    } catch (error) {
        console.error('Get Available Members Error:', error);
        return errorResponse(res, 'Failed to retrieve members.', 500);
    }
};

exports.quickCreateMember = async (req, res) => {
    try {
        const { id } = req.params; // optional group_id
        const newMember = await c2sModel.quickCreateMember(req.body, id || null);

        await userModel.logAudit(req.user.id, 'QUICK_CREATE_MEMBER', 'C2S_Groups', id || null, null, newMember, req.ip, req.headers['user-agent']);
        return successResponse(res, newMember, 'Member created and assigned successfully', 201);
    } catch (error) {
        console.error('Quick Create Member Error:', error);
        return errorResponse(res, error.message || 'Failed to create member.', 400);
    }
};
