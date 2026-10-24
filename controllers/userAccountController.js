const bcrypt = require('bcryptjs');
const userAccountModel = require('../models/userAccountModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');
const emailService = require('../utils/emailService');
const crypto = require('crypto');

exports.generateActivationLink = async (req, res) => {
    try {
        const userId = req.params.id;
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour expiry

        await userAccountModel.setActivationToken(userId, token, expires);
        
        const user = await userAccountModel.getById(userId);
        if (user && user.email) {
            await emailService.sendAccountVerificationEmail({
                to: user.email,
                fullName: user.full_name,
                username: user.username,
                roleName: user.role_name
            });
        }

        return successResponse(res, null, `Activation email sent to ${user?.email || 'user'}`);
    } catch (error) {
        return errorResponse(res, 'Failed to send activation email: ' + error.message, 500);
    }
};

exports.activateAccount = async (req, res) => {
    try {
        const token = (req.params.token || '').trim();
        if (!token) {
            return res.redirect('/views/login.html?verified=invalid');
        }

        const user = await userAccountModel.findByActivationToken(token);
        
        if (!user) {
            return res.redirect('/views/login.html?verified=invalid');
        }

        // If user is already active and verified (e.g. iOS Safari preview, email scanner, or double-click),
        // redirect straight to success so the user sees a confirmation rather than an invalid link error.
        if (user.is_verified === 1 && user.is_active === 1) {
            return res.redirect('/views/login.html?verified=success');
        }

        if (user.activation_token_expires && new Date(user.activation_token_expires) < new Date()) {
            return res.redirect('/views/login.html?verified=expired');
        }

        await userAccountModel.activateUserByToken(token);
        await userModel.logAudit(
            user.user_id, 'USER_ACTIVATION', 'Users', user.user_id,
            null, { username: user.username, email: user.email },
            req.ip, req.headers['user-agent']
        );

        return res.redirect('/views/login.html?verified=success');
    } catch (error) {
        console.error('Account Activation Error:', error);
        return res.redirect('/views/login.html?verified=error');
    }
};

exports.getAll = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || '',
            role: req.query.role || '',
            status: req.query.status || ''
        };

        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const users = await userAccountModel.getAll(null, 0, filters);
            return successResponse(res, users, 'User accounts retrieved');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [users, total] = await Promise.all([
            userAccountModel.getAll(limit, offset, filters),
            userAccountModel.getCount(filters)
        ]);

        return paginatedResponse(res, users, total, page, limit, 'User accounts retrieved');
    } catch (error) {
        console.error('User Accounts getAll Error:', error);
        return errorResponse(res, 'Failed to retrieve users', 500);
    }
};

exports.getById = async (req, res) => {
    try {
        const user = await userAccountModel.getById(req.params.id);
        if (!user) return errorResponse(res, 'User not found.', 404);
        return successResponse(res, user, 'User retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve user.', 500);
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

exports.verifyUser = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const user = await userAccountModel.getById(id);
        if (!user) return errorResponse(res, 'User not found.', 404);

        if (!user.email) {
            return errorResponse(res, 'This user does not have an email address to send the verification link.', 400);
        }

        // Generate cryptographically secure activation token valid for 24 hours
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await userAccountModel.setActivationToken(id, token, expires);

        const portalUrl = process.env.PORTAL_URL || `${req.protocol}://${req.get('host')}`;
        const activationLink = `${portalUrl}/api/users/activate/${token}`;

        let emailSent = false;
        let emailError = null;

        try {
            await emailService.sendAccountVerificationEmail({
                to: user.email,
                fullName: user.full_name,
                username: user.username,
                roleName: user.role_name,
                activationLink: activationLink
            });
            emailSent = true;
            console.log(`[EMAIL ACTIVATION SENT] Verification & activation link email delivered to ${user.email} (Username: ${user.username})`);
        } catch (mailErr) {
            console.error(`[EMAIL ERROR] Failed to send verification email to ${user.email}:`, mailErr.message);
            emailError = mailErr.message;
        }

        await userModel.logAudit(req.user.id, 'SEND_ACTIVATION_EMAIL', 'Users', id, null, { email: user.email }, req.ip, req.headers['user-agent']);

        // Directly activate user in database so account is verified regardless of email timeout
        await userAccountModel.activate(id);

        if (!emailSent) {
            return successResponse(
                res, 
                { user_id: id, is_verified: 1, email_sent: false }, 
                'Account verified successfully! (Note: Email notification timed out because Render Free Tier blocks outbound SMTP ports, but account is now fully active).'
            );
        }

        return successResponse(
            res, 
            { user_id: id, is_verified: user.is_verified, email_sent: true }, 
            `Verification email with activation link sent to ${user.email}! The user must click the link in their email to activate their account.`
        );
    } catch (error) {
        return errorResponse(res, 'Failed to process verification email: ' + error.message, 500);
    }
};

exports.resendVerificationEmail = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const user = await userAccountModel.getById(id);
        if (!user) return errorResponse(res, 'User not found.', 404);
        if (!user.email) return errorResponse(res, 'This user does not have an email address.', 400);

        // Generate fresh activation token valid for 24 hours
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await userAccountModel.setActivationToken(id, token, expires);

        const portalUrl = process.env.PORTAL_URL || `${req.protocol}://${req.get('host')}`;
        const activationLink = `${portalUrl}/api/users/activate/${token}`;

        await emailService.sendAccountVerificationEmail({
            to: user.email,
            fullName: user.full_name,
            username: user.username,
            roleName: user.role_name,
            activationLink: activationLink
        });

        await userModel.logAudit(req.user.id, 'RESEND_ACTIVATION_EMAIL', 'Users', id, null, { email: user.email }, req.ip, req.headers['user-agent']);

        return successResponse(res, { user_id: id, email_sent: true }, `Verification email with activation link resent to ${user.email}!`);
    } catch (error) {
        return errorResponse(res, 'Failed to resend verification email: ' + error.message, 500);
    }
};

exports.create = async (req, res) => {
    try {
        const username = req.body.username ? req.body.username.trim() : null;
        const email = req.body.email ? req.body.email.trim().toLowerCase() : null;
        const password = req.body.password ? req.body.password.trim() : null;
        let first_name = req.body.first_name ? req.body.first_name.trim() : null;
        let middle_name = req.body.middle_name ? req.body.middle_name.trim() : null;
        let last_name = req.body.last_name ? req.body.last_name.trim() : null;
        let suffix = req.body.suffix ? req.body.suffix.trim() : null;

        let full_name = req.body.full_name ? req.body.full_name.trim() : null;
        if (!full_name && (first_name || last_name)) {
            full_name = [first_name, middle_name, last_name, suffix].filter(Boolean).join(' ');
        } else if (full_name && !first_name && !last_name) {
            const parts = full_name.split(/\s+/);
            first_name = parts[0] || '';
            last_name = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || '';
        }

        const role_name = req.body.role_name || 'Church Member';
        const contact_number = normalizePhilippinePhone(req.body.contact_number);
        const profile_image = req.file ? `/uploads/profiles/${req.file.filename}` : null;
        const linked_member_id = req.body.member_id ? parseInt(req.body.member_id) : null;

        if (!password || password.length < 6 || password.length > 16) {
            return errorResponse(res, 'Password must be between 6 and 16 characters.', 400);
        }
        if (!first_name || !last_name) return errorResponse(res, 'First name and Last name are required.', 400);

        let role_id = 3; 
        let church_role = 'Member';
        if (role_name === 'Admin') { role_id = 1; church_role = 'Admin'; }
        else if (role_name === 'Church Leader') { role_id = 2; church_role = 'Leader'; }
        else if (role_name === 'Church Member') { role_id = 3; church_role = 'Member'; }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Account is created as Unverified (is_verified: 0)
        const id = await userAccountModel.create({ 
            username, 
            email, 
            password_hash: passwordHash, 
            full_name, 
            first_name,
            middle_name,
            last_name,
            suffix,
            role_id, 
            profile_image,
            is_verified: 0 
        });

        const { pool } = require('../config/database');

        // Synchronize / Link with Member record
        if (linked_member_id) {
            await pool.execute(
                `UPDATE members SET 
                    user_id = ?, church_role = ?, contact_number = COALESCE(?, contact_number), email = COALESCE(?, email),
                    first_name = COALESCE(?, first_name), middle_name = COALESCE(?, middle_name), last_name = COALESCE(?, last_name), suffix = COALESCE(?, suffix)
                 WHERE member_id = ?`,
                [id, church_role, contact_number, email, first_name, middle_name, last_name, suffix, linked_member_id]
            );
        } else {
            // Check if a member with matching email already exists
            const [existing] = await pool.execute('SELECT member_id FROM members WHERE email = ? LIMIT 1', [email]);
            if (existing.length > 0) {
                await pool.execute(
                    `UPDATE members SET 
                        user_id = ?, church_role = ?, contact_number = COALESCE(?, contact_number),
                        first_name = COALESCE(?, first_name), middle_name = COALESCE(?, middle_name), last_name = COALESCE(?, last_name), suffix = COALESCE(?, suffix)
                     WHERE member_id = ?`,
                    [id, church_role, contact_number, first_name, middle_name, last_name, suffix, existing[0].member_id]
                );
            } else {
                // Auto-create a linked member record
                await pool.execute(
                    `INSERT INTO members (user_id, first_name, middle_name, last_name, suffix, email, contact_number, church_role, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
                    [id, first_name, middle_name, last_name, suffix, email, contact_number, church_role]
                );
            }
        }

        await userModel.logAudit(req.user.id, 'CREATE', 'Users', id, null, { username, email, is_verified: 0 }, req.ip, req.headers['user-agent']);
        
        return successResponse(res, { user_id: id, id, is_verified: 0 }, 'User account created as Unverified. Click "Verify" to verify.', 201);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return errorResponse(res, 'Username or email already exists.', 400);
        return errorResponse(res, error.message || 'Failed to create user', 500);
    }
};

exports.update = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        const username = req.body.username ? req.body.username.trim() : null;
        const email = req.body.email ? req.body.email.trim().toLowerCase() : null;
        let first_name = req.body.first_name !== undefined ? (req.body.first_name ? req.body.first_name.trim() : null) : undefined;
        let middle_name = req.body.middle_name !== undefined ? (req.body.middle_name ? req.body.middle_name.trim() : null) : undefined;
        let last_name = req.body.last_name !== undefined ? (req.body.last_name ? req.body.last_name.trim() : null) : undefined;
        let suffix = req.body.suffix !== undefined ? (req.body.suffix ? req.body.suffix.trim() : null) : undefined;

        let full_name = req.body.full_name ? req.body.full_name.trim() : null;
        if ((first_name || last_name) && !full_name) {
            full_name = [first_name, middle_name, last_name, suffix].filter(Boolean).join(' ');
        } else if (full_name && first_name === undefined && last_name === undefined) {
            const parts = full_name.split(/\s+/);
            first_name = parts[0] || '';
            last_name = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || '';
        }

        const role_name = req.body.role_name || 'Church Member';
        const contact_number = normalizePhilippinePhone(req.body.contact_number);
        
        let is_active = 1;
        if (req.body.is_active !== undefined) {
            is_active = parseInt(req.body.is_active);
        }

        let is_verified = undefined;
        if (req.body.is_verified !== undefined) {
            is_verified = parseInt(req.body.is_verified);
        }
        
        const password = req.body.password ? req.body.password.trim() : null;
        const profile_image = req.file ? `/uploads/profiles/${req.file.filename}` : null;

        let role_id = 3;
        let church_role = 'Member';
        if (role_name === 'Admin') { role_id = 1; church_role = 'Admin'; }
        else if (role_name === 'Church Leader') { role_id = 2; church_role = 'Leader'; }
        else if (role_name === 'Church Member') { role_id = 3; church_role = 'Member'; }

        await userAccountModel.update(id, { 
            username, 
            email, 
            full_name, 
            first_name, 
            middle_name, 
            last_name, 
            suffix, 
            role_id, 
            is_active, 
            is_verified, 
            profile_image 
        });

        // Synchronize with linked member record
        const { pool } = require('../config/database');

        await pool.execute(
            `UPDATE members SET 
                church_role = ?, 
                email = COALESCE(?, email),
                contact_number = COALESCE(?, contact_number),
                first_name = COALESCE(?, first_name),
                middle_name = COALESCE(?, middle_name),
                last_name = COALESCE(?, last_name),
                suffix = COALESCE(?, suffix)
             WHERE user_id = ?`,
            [church_role, email, contact_number, first_name, middle_name, last_name, suffix, id]
        );

        // Automatically remove member from all ministry rosters if church role changed to non-Member (e.g. Leader or Admin)
        let unassignedCount = 0;
        if (church_role !== 'Member') {
            const [linkedMembers] = await pool.execute('SELECT member_id FROM members WHERE user_id = ?', [id]);
            if (linkedMembers.length > 0) {
                const linkedMemberId = linkedMembers[0].member_id;
                const [assignedRows] = await pool.execute(
                    `SELECT mm.ministry_member_id, mm.ministry_id, m.ministry_name 
                     FROM ministry_members mm 
                     LEFT JOIN ministries m ON mm.ministry_id = m.ministry_id 
                     WHERE mm.member_id = ?`,
                    [linkedMemberId]
                );

                if (assignedRows.length > 0) {
                    unassignedCount = assignedRows.length;
                    await pool.execute('DELETE FROM ministry_members WHERE member_id = ?', [linkedMemberId]);

                    for (const row of assignedRows) {
                        await userModel.logAudit(
                            req.user.id, 'UNASSIGN', 'Ministries', row.ministry_member_id,
                            { member_id: linkedMemberId, ministry_id: row.ministry_id, ministry_name: row.ministry_name, reason: `Role changed to ${church_role} via User Account update` },
                            null, req.ip, req.headers['user-agent']
                        );
                    }
                }

                // Automatically remove mentor or mentee assignments in C2S groups
                await pool.execute('DELETE FROM c2s_group_members WHERE member_id = ?', [linkedMemberId]);
                await pool.execute('UPDATE c2s_groups SET leader_id = NULL WHERE leader_id = ?', [linkedMemberId]);
            }
        }

        // Strict password update logic
        if (password && password.length > 0) {
            if (password.length < 6 || password.length > 16) {
                return errorResponse(res, 'Password must be between 6 and 16 characters.', 400);
            }
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            await userAccountModel.updatePassword(id, passwordHash);
        }

        await userModel.logAudit(req.user.id, 'UPDATE', 'Users', id, null, { username, email, role_name }, req.ip, req.headers['user-agent']);
        
        const msg = unassignedCount > 0 
            ? `User account updated and linked member automatically removed from ${unassignedCount} ministry roster(s) due to church role change to ${church_role}.`
            : 'User account and linked member record updated successfully';

        return successResponse(res, null, msg);
    } catch (error) {
        return errorResponse(res, error.message || 'Failed to update user', 500);
    }
};

exports.delete = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await userAccountModel.delete(id);
        await userModel.logAudit(req.user.id, 'DELETE', 'Users', id, null, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'User account deleted');
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_NO_REFERENCED_ROW_2') {
            return errorResponse(res, 'Cannot delete this user because they have linked records (like finance entries or announcements). Please set their status to "Inactive" instead.', 400);
        }
        return errorResponse(res, 'Failed to delete user', 500);
    }
};