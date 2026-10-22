const memberModel = require('../models/memberModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');

exports.getAllMembers = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || '',
            gender: req.query.gender || '',
            civil_status: req.query.civil_status || '',
            church_role: req.query.church_role || req.query.role || '',
            status: req.query.status || ''
        };

        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const members = await memberModel.getAll(null, 0, filters);
            return successResponse(res, members, 'Members retrieved successfully');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [members, total] = await Promise.all([
            memberModel.getAll(limit, offset, filters),
            memberModel.getCount(filters)
        ]);

        return paginatedResponse(res, members, total, page, limit, 'Members retrieved successfully');
    } catch (error) {
        console.error('Get All Members Error:', error);
        return errorResponse(res, 'Failed to retrieve members.', 500);
    }
};

exports.getMemberById = async (req, res) => {
    try {
        const member = await memberModel.getById(req.params.id);
        if (!member) return errorResponse(res, 'Member not found.', 404);
        return successResponse(res, member, 'Member retrieved successfully');
    } catch (error) {
        console.error('Get Member By ID Error:', error);
        return errorResponse(res, 'Failed to retrieve member.', 500);
    }
};

function normalizePhilippinePhone(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/[^\d+]/g, '').trim();
    if (clean.startsWith('09')) {
        clean = '+63' + clean.slice(1);
    } else if (clean.startsWith('9') && clean.length === 10) {
        clean = '+63' + clean;
    } else if (clean.startsWith('639')) {
        clean = '+' + clean;
    }
    return clean;
}

async function generateUniqueUsername(pool, firstName, lastName, preferredUsername, excludeUserId = null) {
    if (preferredUsername && preferredUsername.trim()) {
        const u = preferredUsername.trim();
        const checkSql = excludeUserId
            ? 'SELECT user_id FROM users WHERE username = ? AND user_id != ? LIMIT 1'
            : 'SELECT user_id FROM users WHERE username = ? LIMIT 1';
        const params = excludeUserId ? [u, excludeUserId] : [u];
        const [rows] = await pool.execute(checkSql, params);
        if (rows.length > 0) {
            throw new Error('Username already exists. Please choose a different username.');
        }
        return u;
    }

    let base = (String(firstName || '').trim() + '.' + String(lastName || '').trim())
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '');
    if (!base || base === '.') {
        base = 'member';
    }

    let candidate = base;
    let counter = 1;
    while (true) {
        const checkSql = excludeUserId
            ? 'SELECT user_id FROM users WHERE username = ? AND user_id != ? LIMIT 1'
            : 'SELECT user_id FROM users WHERE username = ? LIMIT 1';
        const params = excludeUserId ? [candidate, excludeUserId] : [candidate];
        const [rows] = await pool.execute(checkSql, params);
        if (rows.length === 0) {
            return candidate;
        }
        candidate = `${base}${counter}`;
        counter++;
    }
}

async function validateEmailUniqueness(pool, email, excludeUserId = null) {
    if (!email || !String(email).trim()) return null;
    const cleanEmail = String(email).trim().toLowerCase();
    const checkSql = excludeUserId
        ? 'SELECT user_id FROM users WHERE email = ? AND user_id != ? LIMIT 1'
        : 'SELECT user_id FROM users WHERE email = ? LIMIT 1';
    const params = excludeUserId ? [cleanEmail, excludeUserId] : [cleanEmail];
    const [rows] = await pool.execute(checkSql, params);
    if (rows.length > 0) {
        throw new Error('Email is already linked to another user account.');
    }
    return cleanEmail;
}

exports.createMember = async (req, res) => {
    try {
        const { pool } = require('../config/database');
        const bcrypt = require('bcryptjs');

        if (req.body.contact_number) {
            req.body.contact_number = normalizePhilippinePhone(req.body.contact_number);
        }

        const username = req.body.username ? req.body.username.trim() : null;
        const password = req.body.password ? req.body.password.trim() : null;
        const email = req.body.email ? req.body.email.trim().toLowerCase() : null;

        if (password) {
            if (password.length < 6 || password.length > 16) {
                return errorResponse(res, 'Password must be between 6 and 16 characters.', 400);
            }
        }

        // Validate username uniqueness if provided
        if (username) {
            await generateUniqueUsername(pool, req.body.first_name, req.body.last_name, username);
        }

        // Validate email uniqueness if provided
        if (email) {
            await validateEmailUniqueness(pool, email);
        }

        const memberId = await memberModel.create(req.body);
        const newMember = await memberModel.getById(memberId);

        let targetUserId = newMember.user_id;

        // Role mapping
        let role_id = 3;
        if (newMember.church_role === 'Admin') role_id = 1;
        else if (newMember.church_role === 'Leader') role_id = 2;

        const fullName = [newMember.first_name, newMember.middle_name, newMember.last_name, newMember.suffix].filter(Boolean).join(' ');

        // Check if an existing unlinked user has this email
        if (!targetUserId && email) {
            const [userRows] = await pool.execute('SELECT user_id FROM users WHERE email = ? LIMIT 1', [email]);
            if (userRows.length > 0) {
                targetUserId = userRows[0].user_id;
                await pool.execute('UPDATE members SET user_id = ? WHERE member_id = ?', [targetUserId, memberId]);
            }
        }

        if (targetUserId) {
            // Update existing user credentials/details
            let updates = ['full_name = ?', 'first_name = ?', 'middle_name = ?', 'last_name = ?', 'suffix = ?', 'role_id = ?'];
            let params = [fullName, newMember.first_name, newMember.middle_name || null, newMember.last_name, newMember.suffix || null, role_id];

            if (email) {
                updates.push('email = ?');
                params.push(email);
            }
            if (username) {
                updates.push('username = ?');
                params.push(username);
            }
            if (password) {
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(password, salt);
                updates.push('password_hash = ?');
                params.push(passwordHash);
            }
            params.push(targetUserId);
            await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);
        } else {
            // Create user credentials for this member
            const finalUsername = await generateUniqueUsername(pool, newMember.first_name, newMember.last_name, username);
            const finalEmail = email || `${finalUsername}@portal.cogimus.local`;
            const passToHash = password || 'Member123!';
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(passToHash, salt);

            const [userInsert] = await pool.execute(
                `INSERT INTO users (username, email, password_hash, full_name, first_name, middle_name, last_name, suffix, role_id, is_active, is_verified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
                [finalUsername, finalEmail, passwordHash, fullName, newMember.first_name, newMember.middle_name || null, newMember.last_name, newMember.suffix || null, role_id]
            );
            targetUserId = userInsert.insertId;
            await pool.execute('UPDATE members SET user_id = ? WHERE member_id = ?', [targetUserId, memberId]);
        }

        const freshMember = await memberModel.getById(memberId);

        await userModel.logAudit(
            req.user.id, 'CREATE', 'Members', memberId,
            null, freshMember, req.ip, req.headers['user-agent']
        );

        return successResponse(res, freshMember, 'Member record and login credentials saved successfully', 201);
    } catch (error) {
        console.error('Create Member Error:', error);
        return errorResponse(res, error.message || 'Failed to create member.', 400);
    }
};

exports.updateMember = async (req, res) => {
    try {
        const { id } = req.params;
        const oldMember = await memberModel.getById(id);
        if (!oldMember) return errorResponse(res, 'Member not found.', 404);

        const { pool } = require('../config/database');
        const bcrypt = require('bcryptjs');

        if (req.body.contact_number) {
            req.body.contact_number = normalizePhilippinePhone(req.body.contact_number);
        }
        if (req.body.user_id === undefined) {
            req.body.user_id = oldMember.user_id;
        }

        const username = req.body.username ? req.body.username.trim() : null;
        const password = req.body.password ? req.body.password.trim() : null;
        const email = req.body.email ? req.body.email.trim().toLowerCase() : null;

        if (password) {
            if (password.length < 6 || password.length > 16) {
                return errorResponse(res, 'Password must be between 6 and 16 characters.', 400);
            }
        }

        // Validate username uniqueness if changing
        if (username) {
            await generateUniqueUsername(pool, req.body.first_name || oldMember.first_name, req.body.last_name || oldMember.last_name, username, oldMember.user_id);
        }

        // Validate email uniqueness if changing
        if (email) {
            await validateEmailUniqueness(pool, email, oldMember.user_id);
        }

        await memberModel.update(id, req.body);
        const updatedMember = await memberModel.getById(id);

        // Automatically remove member from all ministry rosters if church role changed to non-Member (e.g. Member to Leader/Admin)
        let unassignedCount = 0;
        if (oldMember.church_role !== updatedMember.church_role && updatedMember.church_role !== 'Member') {
            const [assignedRows] = await pool.execute(
                `SELECT mm.ministry_member_id, mm.ministry_id, m.ministry_name 
                 FROM ministry_members mm 
                 LEFT JOIN ministries m ON mm.ministry_id = m.ministry_id 
                 WHERE mm.member_id = ?`,
                [id]
            );

            if (assignedRows.length > 0) {
                unassignedCount = assignedRows.length;
                await pool.execute('DELETE FROM ministry_members WHERE member_id = ?', [id]);

                for (const row of assignedRows) {
                    await userModel.logAudit(
                        req.user.id, 'UNASSIGN', 'Ministries', row.ministry_member_id,
                        { member_id: id, ministry_id: row.ministry_id, ministry_name: row.ministry_name, reason: `Role changed from ${oldMember.church_role} to ${updatedMember.church_role}` },
                        null, req.ip, req.headers['user-agent']
                    );
                }
            }

            // Automatically remove mentor or mentee assignments in C2S groups
            await pool.execute('DELETE FROM c2s_group_members WHERE member_id = ?', [id]);
            await pool.execute('UPDATE c2s_groups SET leader_id = NULL WHERE leader_id = ?', [id]);
        }

        let role_id = 3;
        if (updatedMember.church_role === 'Admin') role_id = 1;
        else if (updatedMember.church_role === 'Leader') role_id = 2;

        const fullName = [updatedMember.first_name, updatedMember.middle_name, updatedMember.last_name, updatedMember.suffix].filter(Boolean).join(' ');
        const isActive = (updatedMember.status === 'Inactive' || updatedMember.status === 'Deceased') ? 0 : 1;

        let targetUserId = updatedMember.user_id || oldMember.user_id;

        if (targetUserId) {
            let updates = ['full_name = ?', 'first_name = ?', 'middle_name = ?', 'last_name = ?', 'suffix = ?', 'role_id = ?', 'is_active = ?'];
            let params = [fullName, updatedMember.first_name, updatedMember.middle_name || null, updatedMember.last_name, updatedMember.suffix || null, role_id, isActive];

            if (email) {
                updates.push('email = ?');
                params.push(email);
            }
            if (username) {
                updates.push('username = ?');
                params.push(username);
            }
            if (password) {
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(password, salt);
                updates.push('password_hash = ?');
                params.push(passwordHash);
            }
            params.push(targetUserId);
            await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);
        } else {
            // Check if unlinked user exists with this email or username
            let existingUserId = null;
            if (email || username) {
                const [existing] = await pool.execute(
                    'SELECT user_id FROM users WHERE (email IS NOT NULL AND email = ?) OR (username IS NOT NULL AND username = ?) LIMIT 1',
                    [email || '', username || '']
                );
                if (existing.length > 0) {
                    existingUserId = existing[0].user_id;
                }
            }

            if (existingUserId) {
                targetUserId = existingUserId;
                await pool.execute('UPDATE members SET user_id = ? WHERE member_id = ?', [targetUserId, id]);

                let updates = ['full_name = ?', 'first_name = ?', 'middle_name = ?', 'last_name = ?', 'suffix = ?', 'role_id = ?', 'is_active = ?'];
                let params = [fullName, updatedMember.first_name, updatedMember.middle_name || null, updatedMember.last_name, updatedMember.suffix || null, role_id, isActive];
                if (email) {
                    updates.push('email = ?');
                    params.push(email);
                }
                if (username) {
                    updates.push('username = ?');
                    params.push(username);
                }
                if (password) {
                    const salt = await bcrypt.genSalt(10);
                    const passwordHash = await bcrypt.hash(password, salt);
                    updates.push('password_hash = ?');
                    params.push(passwordHash);
                }
                params.push(targetUserId);
                await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);
            } else {
                // Create brand new user account for this member
                const finalUsername = await generateUniqueUsername(pool, updatedMember.first_name, updatedMember.last_name, username);
                const finalEmail = email || `${finalUsername}@portal.cogimus.local`;
                const passToHash = password || 'Member123!';
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(passToHash, salt);

                const [newUserInsert] = await pool.execute(
                    `INSERT INTO users (username, email, password_hash, full_name, first_name, middle_name, last_name, suffix, role_id, is_active, is_verified)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    [finalUsername, finalEmail, passwordHash, fullName, updatedMember.first_name, updatedMember.middle_name || null, updatedMember.last_name, updatedMember.suffix || null, role_id, isActive]
                );
                targetUserId = newUserInsert.insertId;
                await pool.execute('UPDATE members SET user_id = ? WHERE member_id = ?', [targetUserId, id]);
            }
        }

        const freshMember = await memberModel.getById(id);

        await userModel.logAudit(
            req.user.id, 'UPDATE', 'Members', id,
            oldMember, freshMember, req.ip, req.headers['user-agent']
        );

        let msg = 'Member record and credentials updated successfully';
        if (unassignedCount > 0) {
            msg += ` and automatically removed from ${unassignedCount} ministry roster(s) due to church role change to ${updatedMember.church_role}.`;
        }

        return successResponse(res, freshMember, msg);
    } catch (error) {
        console.error('Update Member Error:', error);
        return errorResponse(res, error.message || 'Failed to update member.', 400);
    }
};

exports.deleteMember = async (req, res) => {
    try {
        const { id } = req.params;
        const member = await memberModel.getById(id);
        if (!member) return errorResponse(res, 'Member not found.', 404);

        await memberModel.delete(id);

        await userModel.logAudit(
            req.user.id, 'DELETE', 'Members', id,
            member, null, req.ip, req.headers['user-agent']
        );

        return successResponse(res, null, 'Member deleted successfully');
    } catch (error) {
        console.error('Delete Member Error:', error);
        return errorResponse(res, 'Failed to delete member.', 500);
    }
};
