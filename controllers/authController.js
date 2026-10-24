const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { generateSecret, generateURI, verifySync } = require('otplib');
const qrcode = require('qrcode');
const userModel = require('../models/userModel');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const {
    encryptSecret,
    decryptSecret,
    hashRecoveryCode,
    generateRecoveryCodes
} = require('../utils/cryptoHelper');

async function getWordaRoleForUser(userId) {
    const { pool } = require('../config/database');
    try {
        const [memberRows] = await pool.execute(
            `SELECT m.member_id, m.church_role, m.status AS member_status 
             FROM members m 
             WHERE m.user_id = ? LIMIT 1`,
            [userId]
        );

        if (memberRows.length > 0) {
            const memberId = memberRows[0].member_id;

            // 0. Check if member is appointed as a WORDA Department Head
            const [deptHeads] = await pool.execute(
                `SELECT department FROM department_heads WHERE head_member_id = ? LIMIT 1`,
                [memberId]
            );
            if (deptHeads.length > 0) {
                const dept = deptHeads[0].department;
                return {
                    worda_role: `Department Head (${dept})`,
                    worda_department: dept,
                    worda_ministry: `${dept} Department`,
                    ministry_color: '#d97706',
                    member_id: memberId,
                    church_role: memberRows[0].church_role,
                    is_department_head: true
                };
            }

            // 1. Check active ministry membership for custom/specific role
            const [minMembers] = await pool.execute(
                `SELECT mm.role_in_ministry, min.ministry_name, min.department, min.color_code,
                        (CASE WHEN min.leader_member_id = mm.member_id THEN 1 ELSE 0 END) AS is_leader
                 FROM ministry_members mm 
                 JOIN ministries min ON mm.ministry_id = min.ministry_id 
                 WHERE mm.member_id = ? AND mm.status = 'Active' 
                 ORDER BY is_leader DESC,
                          (CASE 
                            WHEN mm.role_in_ministry IS NOT NULL AND mm.role_in_ministry != '' AND mm.role_in_ministry != 'Member' THEN 1 
                            ELSE 2 
                          END) ASC,
                          mm.ministry_member_id ASC
                 LIMIT 1`,
                [memberId]
            );

            // 2. Also check if member is assigned as the designated leader in ministries
            const [ledMinistries] = await pool.execute(
                `SELECT ministry_name, department, color_code 
                 FROM ministries 
                 WHERE leader_member_id = ? AND is_active = 1 LIMIT 1`,
                [memberId]
            );

            if (minMembers.length > 0) {
                const specifiedRole = (minMembers[0].role_in_ministry || '').trim();
                let roleToDisplay = specifiedRole;
                if (!roleToDisplay || roleToDisplay.toLowerCase() === 'member') {
                    if (minMembers[0].is_leader || ledMinistries.length > 0) {
                        const minName = ledMinistries[0]?.ministry_name || minMembers[0].ministry_name;
                        roleToDisplay = `${minName} Ministry Leader`;
                    } else {
                        roleToDisplay = `${minMembers[0].ministry_name} Member`;
                    }
                }

                return {
                    worda_role: roleToDisplay,
                    worda_department: minMembers[0].department,
                    worda_ministry: minMembers[0].ministry_name,
                    ministry_color: minMembers[0].color_code || null,
                    member_id: memberId,
                    church_role: memberRows[0].church_role
                };
            }

            if (ledMinistries.length > 0) {
                return {
                    worda_role: `${ledMinistries[0].ministry_name} Ministry Leader`,
                    worda_department: ledMinistries[0].department,
                    worda_ministry: ledMinistries[0].ministry_name,
                    ministry_color: ledMinistries[0].color_code || null,
                    member_id: memberId,
                    church_role: memberRows[0].church_role
                };
            }

            return {
                worda_role: memberRows[0].church_role || null,
                worda_department: null,
                worda_ministry: null,
                ministry_color: null,
                member_id: memberId,
                church_role: memberRows[0].church_role
            };
        }
        return {
            worda_role: null,
            worda_department: null,
            worda_ministry: null,
            ministry_color: null,
            member_id: null,
            church_role: null
        };
    } catch (err) {
        console.error('getWordaRoleForUser error:', err);
        return { worda_role: null, worda_department: null, worda_ministry: null, ministry_color: null, member_id: null, church_role: null };
    }
}

exports.getWordaRoleForUser = getWordaRoleForUser;

async function completeUserLogin(user, req, res, auditAction = 'LOGIN', auditDetails = {}) {
    // Retrieve WORDA ministry role dynamically
    const wordaInfo = await getWordaRoleForUser(user.user_id);
    user.worda_role = wordaInfo.worda_role;
    user.worda_department = wordaInfo.worda_department;
    user.worda_ministry = wordaInfo.worda_ministry;
    user.ministry_name = wordaInfo.worda_ministry;
    user.role_in_ministry = wordaInfo.worda_role;
    if (wordaInfo.ministry_color) user.ministry_color = wordaInfo.ministry_color;
    if (wordaInfo.member_id) user.member_id = wordaInfo.member_id;
    if (wordaInfo.church_role) user.church_role = wordaInfo.church_role;
    user.is_department_head = !!wordaInfo.is_department_head;
    // Update last login
    await userModel.updateLastLogin(user.user_id);

    // Generate unique session token for single-session enforcement
    const sessionToken = uuidv4();
    await userModel.updateSessionToken(user.user_id, sessionToken);

    // Log audit trail
    await userModel.logAudit(
        user.user_id, auditAction, 'Auth', user.user_id, 
        null, { message: 'User logged in', ...auditDetails }, 
        req.ip, req.headers['user-agent']
    );

    // Generate JWT
    const payload = {
        id: user.user_id,
        role_id: user.role_id,
        role_name: user.role_name,
        username: user.username,
        sessionToken
    };

    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Remove sensitive data before sending response
    delete user.password_hash;
    delete user.mfa_secret;
    delete user.mfa_temp_secret;

    return { token, user };
}

exports.login = async (req, res) => {
    const identifier = (req.body.identifier || req.body.username || req.body.email || '').toString().trim();
    const password = req.body.password;

    if (!identifier || !password) {
        return errorResponse(res, 'Please provide both username/email and password.', 400);
    }

    try {
        const user = await userModel.findByUsernameOrEmail(identifier);

        if (!user) {
            return errorResponse(res, 'Invalid credentials.', 401);
        }

        // Exact case-sensitive match for username
        if (user.username !== identifier && user.email.toLowerCase() !== identifier.toLowerCase()) {
            return errorResponse(res, 'Invalid credentials.', 401);
        }

        if (!user.is_active) {
            return errorResponse(res, 'Your account has been deactivated. Please contact the administrator.', 403);
        }

        if (user.is_verified === 0) {
            return errorResponse(res, 'Your account is pending verification by an administrator.', 403);
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return errorResponse(res, 'Invalid credentials.', 401);
        }

        // Check if Multi-Factor Authentication (MFA) is enabled for this user
        if (user.mfa_enabled && user.mfa_secret) {
            const challengeId = uuidv4();
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

            await userModel.createLoginChallenge(challengeId, user.user_id, expiresAt, 5);

            const mfaChallengeToken = jwt.sign(
                { challengeId, userId: user.user_id, type: 'mfa_challenge' },
                process.env.JWT_SECRET,
                { expiresIn: '5m' }
            );

            await userModel.logAudit(
                user.user_id, 'MFA_CHALLENGE_ISSUED', 'Auth', user.user_id,
                null, { message: 'MFA challenge issued during login' },
                req.ip, req.headers['user-agent']
            );

            const maskedEmail = user.email ? user.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(Math.max(b.length, 2), 6)) + c) : '';

            return successResponse(res, {
                mfaRequired: true,
                mfaChallengeToken,
                challengeId,
                username: user.username,
                maskedEmail
            }, 'Two-factor authentication required. Please enter your 6-digit code or recovery code.');
        }

        // MFA not enabled: complete normal authentication
        const loginData = await completeUserLogin(user, req, res, 'LOGIN');
        return successResponse(res, loginData, 'Login successful');

    } catch (error) {
        console.error('Login Error:', error);
        return errorResponse(res, 'An internal server error occurred during login.', 500);
    }
};

exports.register = async (req, res) => {
    try {
        const full_name = (req.body.full_name || (req.body.first_name ? `${req.body.first_name} ${req.body.last_name || ''}`.trim() : '')).trim();
        const username = req.body.username ? req.body.username.trim() : '';
        const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
        const contact_number = req.body.contact_number ? req.body.contact_number.trim() : null;
        const password = req.body.password ? req.body.password : '';
        const confirmPassword = req.body.confirmPassword || req.body.confirm_password;

        if (!full_name || !username || !email || !password) {
            return errorResponse(res, 'Full name, username, email, and password are required.', 400);
        }

        if (username.length < 3 || username.length > 30) {
            return errorResponse(res, 'Username must be between 3 and 30 characters.', 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return errorResponse(res, 'Please provide a valid email address.', 400);
        }

        if (password.length < 6) {
            return errorResponse(res, 'Password must be at least 6 characters long.', 400);
        }

        if (confirmPassword && password !== confirmPassword) {
            return errorResponse(res, 'Passwords do not match.', 400);
        }

        // Check if username or email already exists
        const existingUser = await userModel.findByUsernameOrEmail(username);
        if (existingUser) {
            return errorResponse(res, 'Username is already registered.', 409);
        }
        const existingEmail = await userModel.findByUsernameOrEmail(email);
        if (existingEmail) {
            return errorResponse(res, 'Email address is already registered.', 409);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Role: Church Member (role_id = 3)
        const roleId = 3;
        const { pool } = require('../config/database');

        const [userResult] = await pool.execute(
            `INSERT INTO users (role_id, username, email, password_hash, full_name, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [roleId, username, email, passwordHash, full_name]
        );

        const newUserId = userResult.insertId;

        // Auto-link or create member profile
        const nameParts = full_name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || nameParts[0];

        // Check if a member record with this email already exists without a user_id
        const [existingMembers] = await pool.execute(
            `SELECT member_id FROM members WHERE email = ? AND user_id IS NULL LIMIT 1`,
            [email]
        );

        let memberId;
        if (existingMembers.length > 0) {
            memberId = existingMembers[0].member_id;
            await pool.execute(
                `UPDATE members SET user_id = ?, contact_number = COALESCE(contact_number, ?) WHERE member_id = ?`,
                [newUserId, contact_number, memberId]
            );
        } else {
            const [memberResult] = await pool.execute(
                `INSERT INTO members (user_id, first_name, last_name, contact_number, email, church_role, status, sms_notifications_enabled)
                 VALUES (?, ?, ?, ?, ?, 'Member', 'Active', 1)`,
                [newUserId, firstName, lastName, contact_number, email]
            );
            memberId = memberResult.insertId;
        }

        // Generate unique session token for single-session enforcement
        const sessionToken = uuidv4();
        await userModel.updateSessionToken(newUserId, sessionToken);

        // Generate JWT
        const payload = {
            id: newUserId,
            role_id: roleId,
            role_name: 'Church Member',
            username: username,
            sessionToken
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        // Log audit trail
        await userModel.logAudit(
            newUserId, 'REGISTER', 'Auth', newUserId,
            null, { username, email, full_name, member_id: memberId },
            req.ip, req.headers['user-agent']
        );

        const userResponse = {
            user_id: newUserId,
            username,
            email,
            full_name,
            role_id: roleId,
            role_name: 'Church Member',
            member_id: memberId
        };

        return successResponse(res, {
            token,
            user: userResponse
        }, 'Registration successful! Welcome to the Church Portal.', 201);

    } catch (error) {
        console.error('Registration Error:', error);
        return errorResponse(res, 'An error occurred during registration. Please try again.', 500);
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await userModel.findById(req.user.id);
        
        if (!user) {
            return errorResponse(res, 'User not found.', 404);
        }

                // Attach linked member info and WORDA role if available
        const wordaInfo = await getWordaRoleForUser(req.user.id);
        user.worda_role = wordaInfo.worda_role;
        user.worda_department = wordaInfo.worda_department;
        user.worda_ministry = wordaInfo.worda_ministry;
        user.ministry_name = wordaInfo.worda_ministry;
        user.role_in_ministry = wordaInfo.worda_role;
        if (wordaInfo.ministry_color) user.ministry_color = wordaInfo.ministry_color;
        if (wordaInfo.member_id) user.member_id = wordaInfo.member_id;
        if (wordaInfo.church_role) user.church_role = wordaInfo.church_role;
        user.is_department_head = !!wordaInfo.is_department_head;

        user.mfa_enabled = !!user.mfa_enabled;
        user.theme_preference = user.theme_preference || 'system';
        delete user.mfa_secret;
        delete user.mfa_temp_secret;

        return successResponse(res, user, 'User profile retrieved successfully');
    } catch (error) {
        console.error('GetMe Error:', error);
        return errorResponse(res, 'Failed to retrieve user profile.', 500);
    }
};

exports.updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return errorResponse(res, 'Please provide current and new passwords.', 400);
    }

    if (newPassword.length < 6) {
        return errorResponse(res, 'New password must be at least 6 characters long.', 400);
    }

    try {
        // Fetch user with password hash
        const userWithPass = await userModel.findByUsernameOrEmail(req.user.username);
        
        const isMatch = await bcrypt.compare(currentPassword, userWithPass.password_hash);
        if (!isMatch) {
            return errorResponse(res, 'Current password is incorrect.', 400);
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        await userModel.updatePassword(req.user.id, newHash);

        await userModel.logAudit(
            req.user.id, 'UPDATE_PASSWORD', 'Auth', req.user.id,
            { message: 'Password updated' }, null,
            req.ip, req.headers['user-agent']
        );

        return successResponse(res, null, 'Password updated successfully.');
    } catch (error) {
        console.error('UpdatePassword Error:', error);
        return errorResponse(res, 'Failed to update password.', 500);
    }
};

exports.logout = async (req, res) => {
    try {
        if (req.user && req.user.id) {
            await userModel.updateSessionToken(req.user.id, null);
            await userModel.logAudit(
                req.user.id, 'LOGOUT', 'Auth', req.user.id,
                null, { message: 'User logged out' },
                req.ip, req.headers['user-agent']
            );
        }
        return successResponse(res, null, 'Logged out successfully');
    } catch (error) {
        return errorResponse(res, 'Logout failed', 500);
    }
};

exports.checkSession = async (req, res) => {
    return successResponse(res, { active: true, user: req.user }, 'Session is active');
};

// ============================================================
// Multi-Factor Authentication (MFA / TOTP) Controllers
// ============================================================

/**
 * Verifies a 6-digit TOTP code during the login challenge.
 */
exports.verifyMfaLogin = async (req, res) => {
    const { mfaChallengeToken } = req.body;
    const rawToken = req.body.token || req.body.code;

    if (!mfaChallengeToken || !rawToken) {
        return errorResponse(res, 'Verification challenge token and 6-digit code are required.', 400);
    }

    const cleanToken = String(rawToken).trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanToken)) {
        return errorResponse(res, 'Verification code must be exactly 6 digits.', 400);
    }

    try {
        let decoded;
        try {
            decoded = jwt.verify(mfaChallengeToken, process.env.JWT_SECRET);
        } catch (jwtErr) {
            return errorResponse(res, 'Authentication challenge has expired or is invalid. Please sign in again.', 401);
        }

        if (decoded.type !== 'mfa_challenge' || !decoded.challengeId || !decoded.userId) {
            return errorResponse(res, 'Invalid authentication challenge token.', 401);
        }

        const challenge = await userModel.getLoginChallenge(decoded.challengeId);
        if (!challenge) {
            return errorResponse(res, 'Authentication challenge expired or already consumed. Please sign in again.', 401);
        }

        if (challenge.attempts >= challenge.max_attempts) {
            await userModel.deleteLoginChallenge(decoded.challengeId);
            return errorResponse(res, 'Maximum verification attempts exceeded. For your security, this challenge has been invalidated. Please sign in again.', 429);
        }

        // Increment attempts count
        await userModel.incrementChallengeAttempts(decoded.challengeId);

        const user = await userModel.findById(decoded.userId);
        if (!user || !user.is_active) {
            await userModel.deleteLoginChallenge(decoded.challengeId);
            return errorResponse(res, 'User account is deactivated or no longer exists.', 403);
        }

        if (!user.mfa_enabled || !user.mfa_secret) {
            await userModel.deleteLoginChallenge(decoded.challengeId);
            return errorResponse(res, 'Multi-Factor Authentication is not activated on this account.', 400);
        }

        // Decrypt stored TOTP secret
        let secret;
        try {
            secret = decryptSecret(user.mfa_secret);
        } catch (decErr) {
            console.error('[MFA_DECRYPT_ERROR]', decErr.message);
            return errorResponse(res, 'Security error: failed to decrypt TOTP secret. Please contact the administrator.', 500);
        }

        // Verify TOTP code with clock-skew window (epochTolerance: 30s) and replay prevention (afterTimeStep)
        const check = verifySync({
            token: cleanToken,
            secret,
            epochTolerance: 30,
            afterTimeStep: user.mfa_last_timestep || undefined
        });

        if (!check || !check.valid) {
            const remaining = Math.max(0, challenge.max_attempts - (challenge.attempts + 1));
            return errorResponse(res, `Invalid verification code. Please make sure your authenticator app is synced. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`, 401);
        }

        // TOTP verification succeeded! Update last used timestep to prevent replay
        if (check.timeStep) {
            await userModel.updateMfaLastTimestep(user.user_id, check.timeStep);
        }

        // Invalidate the challenge so it cannot be reused
        await userModel.deleteLoginChallenge(decoded.challengeId);

        // Complete login
        const loginData = await completeUserLogin(user, req, res, 'MFA_LOGIN', { method: 'authenticator_totp' });
        return successResponse(res, loginData, 'Two-factor authentication verified successfully.');

    } catch (error) {
        console.error('[MFA_VERIFY_ERROR]', error);
        return errorResponse(res, 'An error occurred during two-factor verification.', 500);
    }
};

/**
 * Authenticates using a one-time backup recovery code.
 */
exports.verifyMfaRecovery = async (req, res) => {
    const { mfaChallengeToken, recoveryCode } = req.body;

    if (!mfaChallengeToken || !recoveryCode) {
        return errorResponse(res, 'Verification challenge token and recovery code are required.', 400);
    }

    try {
        let decoded;
        try {
            decoded = jwt.verify(mfaChallengeToken, process.env.JWT_SECRET);
        } catch (jwtErr) {
            return errorResponse(res, 'Authentication challenge has expired or is invalid. Please sign in again.', 401);
        }

        if (decoded.type !== 'mfa_challenge' || !decoded.challengeId || !decoded.userId) {
            return errorResponse(res, 'Invalid authentication challenge token.', 401);
        }

        const challenge = await userModel.getLoginChallenge(decoded.challengeId);
        if (!challenge) {
            return errorResponse(res, 'Authentication challenge expired or already consumed. Please sign in again.', 401);
        }

        if (challenge.attempts >= challenge.max_attempts) {
            await userModel.deleteLoginChallenge(decoded.challengeId);
            return errorResponse(res, 'Maximum verification attempts exceeded. Challenge invalidated. Please sign in again.', 429);
        }

        await userModel.incrementChallengeAttempts(decoded.challengeId);

        const user = await userModel.findById(decoded.userId);
        if (!user || !user.is_active) {
            await userModel.deleteLoginChallenge(decoded.challengeId);
            return errorResponse(res, 'User account is deactivated or no longer exists.', 403);
        }

        const codeHash = hashRecoveryCode(recoveryCode);
        const used = await userModel.useRecoveryCode(user.user_id, codeHash);

        if (!used) {
            const remaining = Math.max(0, challenge.max_attempts - (challenge.attempts + 1));
            return errorResponse(res, `Invalid or previously used recovery code. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`, 401);
        }

        // Invalidate login challenge
        await userModel.deleteLoginChallenge(decoded.challengeId);

        const remainingCodesCount = await userModel.getRemainingRecoveryCodesCount(user.user_id);

        const loginData = await completeUserLogin(user, req, res, 'MFA_RECOVERY_LOGIN', { 
            method: 'backup_recovery_code',
            remainingCodes: remainingCodesCount 
        });

        loginData.recoveryCodesRemaining = remainingCodesCount;
        return successResponse(res, loginData, `Backup recovery code accepted. You have ${remainingCodesCount} backup code(s) remaining.`);

    } catch (error) {
        console.error('[MFA_RECOVERY_ERROR]', error);
        return errorResponse(res, 'An error occurred during recovery code verification.', 500);
    }
};

/**
 * Retrieves the current user's MFA status and remaining recovery codes count.
 */
exports.getMfaStatus = async (req, res) => {
    try {
        const user = await userModel.findById(req.user.id);
        if (!user) {
            return errorResponse(res, 'User not found.', 404);
        }

        const recoveryCodesRemaining = await userModel.getRemainingRecoveryCodesCount(req.user.id);

        return successResponse(res, {
            mfaEnabled: !!user.mfa_enabled,
            enrolledAt: user.mfa_enrolled_at || null,
            recoveryCodesRemaining
        }, 'MFA status retrieved successfully.');
    } catch (error) {
        console.error('[MFA_STATUS_ERROR]', error);
        return errorResponse(res, 'Failed to retrieve MFA status.', 500);
    }
};

/**
 * Initiates MFA enrollment: creates a pending TOTP secret, otpauth:// URI, and QR code.
 */
exports.startMfaEnrollment = async (req, res) => {
    try {
        const user = await userModel.findById(req.user.id);
        if (!user) {
            return errorResponse(res, 'User not found.', 404);
        }

        if (user.mfa_enabled) {
            return errorResponse(res, 'Two-factor authentication is already active on your account. Please disable it first if you wish to re-enroll a new device.', 400);
        }

        // Generate cryptographically random secret
        const secret = generateSecret();

        // Provisioning URI for Google Authenticator, Microsoft Authenticator, etc.
        const accountLabel = user.email || user.username;
        const issuer = 'COG Imus Portal';
        const uri = generateURI({
            issuer,
            label: accountLabel,
            secret
        });

        // Generate QR code data URL
        const qrCode = await qrcode.toDataURL(uri, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 220,
            color: {
                dark: '#0E2A4F',
                light: '#FFFFFF'
            }
        });

        // Encrypt secret with AES-256-GCM before saving into pending enrollment state
        const encryptedTempSecret = encryptSecret(secret);
        await userModel.updateMfaTempSecret(req.user.id, encryptedTempSecret);

        // Log audit
        await userModel.logAudit(
            req.user.id, 'MFA_ENROLL_START', 'Auth', req.user.id,
            null, { message: 'Initiated MFA authenticator setup' },
            req.ip, req.headers['user-agent']
        );

        return successResponse(res, {
            qrCode,
            setupKey: secret,
            issuer,
            account: accountLabel
        }, 'MFA enrollment initiated. Please scan the QR code with your authenticator app.');

    } catch (error) {
        console.error('[MFA_ENROLL_START_ERROR]', error);
        return errorResponse(res, 'Failed to initiate MFA enrollment.', 500);
    }
};

/**
 * Verifies code against pending enrollment secret, activates MFA, and generates recovery codes.
 */
exports.confirmMfaEnrollment = async (req, res) => {
    const rawToken = req.body.token || req.body.code;

    if (!rawToken) {
        return errorResponse(res, 'Please provide the 6-digit confirmation code from your authenticator app.', 400);
    }

    const cleanToken = String(rawToken).trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanToken)) {
        return errorResponse(res, 'Verification code must be exactly 6 digits.', 400);
    }

    try {
        const user = await userModel.findById(req.user.id);
        if (!user) {
            return errorResponse(res, 'User not found.', 404);
        }

        if (!user.mfa_temp_secret) {
            return errorResponse(res, 'No pending enrollment found. Please click "Enable Authenticator App" to start setup.', 400);
        }

        let secret;
        try {
            secret = decryptSecret(user.mfa_temp_secret);
        } catch (decErr) {
            return errorResponse(res, 'Failed to decrypt temporary secret. Please restart setup.', 500);
        }

        // Verify code
        const check = verifySync({
            token: cleanToken,
            secret,
            epochTolerance: 30
        });

        if (!check || !check.valid) {
            return errorResponse(res, 'Invalid verification code. Please ensure your device clock is accurate and try again.', 400);
        }

        // Activate MFA in database (last accepted login timestep initialized to null)
        await userModel.activateMfa(req.user.id, user.mfa_temp_secret, null);

        // Generate 10 backup recovery codes
        const plainRecoveryCodes = generateRecoveryCodes(10);
        const hashedCodes = plainRecoveryCodes.map(c => hashRecoveryCode(c));
        await userModel.saveRecoveryCodes(req.user.id, hashedCodes);

        // Log audit
        await userModel.logAudit(
            req.user.id, 'MFA_ENROLLED', 'Auth', req.user.id,
            null, { message: 'Two-factor authentication enabled successfully' },
            req.ip, req.headers['user-agent']
        );

        return successResponse(res, {
            recoveryCodes: plainRecoveryCodes
        }, 'Two-Factor Authentication is now ENABLED! Please save your backup recovery codes securely.');

    } catch (error) {
        console.error('[MFA_ENROLL_CONFIRM_ERROR]', error);
        return errorResponse(res, 'Failed to confirm MFA enrollment.', 500);
    }
};

/**
 * Disables MFA after reauthenticating with password or current TOTP code.
 */
exports.disableMfa = async (req, res) => {
    const { password, code } = req.body;

    if (!password && !code) {
        return errorResponse(res, 'Your current account password or authenticator code is required to disable Two-Factor Authentication.', 400);
    }

    try {
        const userWithPass = await userModel.findByUsernameOrEmail(req.user.username);
        if (!userWithPass) {
            return errorResponse(res, 'User not found.', 404);
        }

        if (!userWithPass.mfa_enabled) {
            return errorResponse(res, 'Two-factor authentication is not currently enabled.', 400);
        }

        let isAuthorized = false;

        // Option 1: verify current password
        if (password) {
            isAuthorized = await bcrypt.compare(password, userWithPass.password_hash);
        }

        // Option 2: verify current TOTP code if password wasn't provided or failed
        if (!isAuthorized && code && userWithPass.mfa_secret) {
            try {
                const secret = decryptSecret(userWithPass.mfa_secret);
                const check = verifySync({
                    token: String(code).trim(),
                    secret,
                    epochTolerance: 30
                });
                if (check && check.valid) {
                    isAuthorized = true;
                }
            } catch (e) {}
        }

        if (!isAuthorized) {
            return errorResponse(res, 'Authentication failed. Please enter your correct current password or valid authenticator code.', 401);
        }

        await userModel.disableMfa(req.user.id);

        await userModel.logAudit(
            req.user.id, 'MFA_DISABLED', 'Auth', req.user.id,
            null, { message: 'Two-factor authentication disabled' },
            req.ip, req.headers['user-agent']
        );

        return successResponse(res, null, 'Two-Factor Authentication has been successfully disabled.');

    } catch (error) {
        console.error('[MFA_DISABLE_ERROR]', error);
        return errorResponse(res, 'Failed to disable two-factor authentication.', 500);
    }
};

/**
 * Regenerates backup recovery codes after reauthenticating with password or TOTP code.
 */
exports.regenerateRecoveryCodes = async (req, res) => {
    const { password, code } = req.body;

    if (!password && !code) {
        return errorResponse(res, 'Your current account password or authenticator code is required to regenerate recovery codes.', 400);
    }

    try {
        const userWithPass = await userModel.findByUsernameOrEmail(req.user.username);
        if (!userWithPass) {
            return errorResponse(res, 'User not found.', 404);
        }

        if (!userWithPass.mfa_enabled) {
            return errorResponse(res, 'Two-factor authentication is not enabled on this account.', 400);
        }

        let isAuthorized = false;

        if (password) {
            isAuthorized = await bcrypt.compare(password, userWithPass.password_hash);
        }

        if (!isAuthorized && code && userWithPass.mfa_secret) {
            try {
                const secret = decryptSecret(userWithPass.mfa_secret);
                const check = verifySync({
                    token: String(code).trim(),
                    secret,
                    epochTolerance: 30
                });
                if (check && check.valid) {
                    isAuthorized = true;
                }
            } catch (e) {}
        }

        if (!isAuthorized) {
            return errorResponse(res, 'Authentication failed. Please verify your current password or authenticator code.', 401);
        }

        // Generate 10 new recovery codes
        const plainRecoveryCodes = generateRecoveryCodes(10);
        const hashedCodes = plainRecoveryCodes.map(c => hashRecoveryCode(c));
        await userModel.saveRecoveryCodes(req.user.id, hashedCodes);

        await userModel.logAudit(
            req.user.id, 'MFA_RECOVERY_REGENERATED', 'Auth', req.user.id,
            null, { message: 'Backup recovery codes regenerated' },
            req.ip, req.headers['user-agent']
        );

        return successResponse(res, {
            recoveryCodes: plainRecoveryCodes
        }, 'New backup recovery codes generated. All previous recovery codes have been invalidated.');

    } catch (error) {
        console.error('[MFA_REGENERATE_RECOVERY_ERROR]', error);
        return errorResponse(res, 'Failed to regenerate recovery codes.', 500);
    }
};
exports.updateThemePreference = async (req, res) => {
    try {
        const theme = (req.body.theme || req.body.theme_preference || '').toLowerCase().trim();
        const cleanTheme = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
        await userModel.updateThemePreference(req.user.id, cleanTheme);
        return successResponse(res, { theme_preference: cleanTheme }, 'Theme preference updated successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to update theme preference', 500);
    }
};
