const { pool } = require('../config/database');

const UserModel = {
    async findByUsernameOrEmail(identifier) {
        const [rows] = await pool.execute(
            `SELECT u.user_id, u.role_id, r.role_name, u.username, u.email, u.password_hash, u.full_name, 
                    u.profile_image, u.is_active, u.is_verified,
                    u.mfa_enabled, u.mfa_secret, u.mfa_temp_secret, u.mfa_enrolled_at, u.mfa_last_timestep
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE BINARY u.username = ? OR u.email = ?`,
            [identifier, identifier]
        );
        return rows[0];
    },

    async findById(userId) {
        const [rows] = await pool.execute(
            `SELECT u.user_id, u.role_id, r.role_name, u.username, u.email, u.full_name, 
                    m.contact_number, u.profile_image, u.is_active, u.is_verified, u.last_login,
                    u.mfa_enabled, u.mfa_enrolled_at, u.mfa_secret, u.mfa_temp_secret, u.mfa_last_timestep
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             LEFT JOIN members m ON u.user_id = m.user_id
             WHERE u.user_id = ?`,
            [userId]
        );
        return rows[0];
    },

    async updateLastLogin(userId) {
        await pool.execute(
            `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?`,
            [userId]
        );
    },

    async updateSessionToken(userId, sessionToken) {
        await pool.execute(
            `UPDATE users SET current_session_token = ?, activation_token = NULL, activation_token_expires = NULL WHERE user_id = ?`,
            [sessionToken, userId]
        );
    },

    async updatePassword(userId, newPasswordHash) {
        await pool.execute(
            `UPDATE users SET password_hash = ? WHERE user_id = ?`,
            [newPasswordHash, userId]
        );
    },

    // --- MFA (Multi-Factor Authentication) Methods ---

    async updateMfaTempSecret(userId, encryptedTempSecret) {
        await pool.execute(
            `UPDATE users SET mfa_temp_secret = ? WHERE user_id = ?`,
            [encryptedTempSecret, userId]
        );
    },

    async activateMfa(userId, encryptedSecret, initialTimeStep = null) {
        await pool.execute(
            `UPDATE users 
             SET mfa_enabled = 1, 
                 mfa_secret = ?, 
                 mfa_temp_secret = NULL, 
                 mfa_enrolled_at = CURRENT_TIMESTAMP, 
                 mfa_last_timestep = ? 
             WHERE user_id = ?`,
            [encryptedSecret, initialTimeStep, userId]
        );
    },

    async disableMfa(userId) {
        await pool.execute(
            `UPDATE users 
             SET mfa_enabled = 0, 
                 mfa_secret = NULL, 
                 mfa_temp_secret = NULL, 
                 mfa_enrolled_at = NULL, 
                 mfa_last_timestep = NULL 
             WHERE user_id = ?`,
            [userId]
        );
        await pool.execute(
            `DELETE FROM user_mfa_recovery_codes WHERE user_id = ?`,
            [userId]
        );
    },

    async updateMfaLastTimestep(userId, timeStep) {
        await pool.execute(
            `UPDATE users SET mfa_last_timestep = ? WHERE user_id = ?`,
            [timeStep, userId]
        );
    },

    async saveRecoveryCodes(userId, hashedCodes) {
        // Invalidate any previous codes
        await pool.execute(
            `DELETE FROM user_mfa_recovery_codes WHERE user_id = ?`,
            [userId]
        );

        if (!hashedCodes || hashedCodes.length === 0) return;

        // Bulk insert new recovery codes
        const values = [];
        const placeholders = hashedCodes.map(hash => {
            values.push(userId, hash);
            return '(?, ?, 0)';
        }).join(', ');

        await pool.execute(
            `INSERT INTO user_mfa_recovery_codes (user_id, code_hash, is_used) VALUES ${placeholders}`,
            values
        );
    },

    async getRemainingRecoveryCodesCount(userId) {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) as count FROM user_mfa_recovery_codes WHERE user_id = ? AND is_used = 0`,
            [userId]
        );
        return rows[0] ? rows[0].count : 0;
    },

    async useRecoveryCode(userId, codeHash) {
        const [rows] = await pool.execute(
            `SELECT code_id FROM user_mfa_recovery_codes 
             WHERE user_id = ? AND code_hash = ? AND is_used = 0 
             LIMIT 1`,
            [userId, codeHash]
        );

        if (rows.length === 0) {
            return false;
        }

        const codeId = rows[0].code_id;
        await pool.execute(
            `UPDATE user_mfa_recovery_codes 
             SET is_used = 1, used_at = CURRENT_TIMESTAMP 
             WHERE code_id = ?`,
            [codeId]
        );
        return true;
    },

    // --- MFA Login Challenge Methods ---

    async createLoginChallenge(challengeId, userId, expiresAt, maxAttempts = 5) {
        // Clean up expired challenges periodically
        pool.execute(`DELETE FROM mfa_login_challenges WHERE expires_at < NOW()`).catch(() => {});

        await pool.execute(
            `INSERT INTO mfa_login_challenges (challenge_id, user_id, expires_at, max_attempts) 
             VALUES (?, ?, ?, ?)`,
            [challengeId, userId, expiresAt, maxAttempts]
        );
    },

    async getLoginChallenge(challengeId) {
        const [rows] = await pool.execute(
            `SELECT challenge_id, user_id, attempts, max_attempts, expires_at 
             FROM mfa_login_challenges 
             WHERE challenge_id = ? AND expires_at > NOW()`,
            [challengeId]
        );
        return rows[0];
    },

    async incrementChallengeAttempts(challengeId) {
        await pool.execute(
            `UPDATE mfa_login_challenges SET attempts = attempts + 1 WHERE challenge_id = ?`,
            [challengeId]
        );
    },

    async deleteLoginChallenge(challengeId) {
        await pool.execute(
            `DELETE FROM mfa_login_challenges WHERE challenge_id = ?`,
            [challengeId]
        );
    },

    async logAudit(userId, action, module, recordId, oldValues, newValues, ipAddress, userAgent) {
        try {
            await pool.execute(
                `INSERT INTO audit_trail (user_id, action, module, record_id, old_values, new_values, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId !== undefined ? userId : null,
                    action !== undefined ? action : null,
                    module !== undefined ? module : null,
                    recordId !== undefined ? recordId : null,
                    (oldValues !== undefined && oldValues !== null) ? JSON.stringify(oldValues) : null,
                    (newValues !== undefined && newValues !== null) ? JSON.stringify(newValues) : null,
                    (ipAddress !== undefined && ipAddress !== null) ? String(ipAddress) : null,
                    (userAgent !== undefined && userAgent !== null) ? String(userAgent) : null
                ]
            );
        } catch (auditErr) {
            console.error('[AUDIT_ERROR] Failed to log audit trail:', auditErr.message);
        }
    }
};

module.exports = UserModel;