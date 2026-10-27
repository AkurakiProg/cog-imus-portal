const { pool } = require('../config/database');

function buildUserWhere(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.search && String(filters.search).trim()) {
        const q = `%${String(filters.search).trim()}%`;
        conditions.push(`(u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)`);
        params.push(q, q, q);
    }
    if (filters.role && String(filters.role).trim()) {
        conditions.push(`r.role_name = ?`);
        params.push(String(filters.role).trim());
    }
    if (filters.status && String(filters.status).trim()) {
        const s = String(filters.status).trim();
        if (s === 'unverified') {
            conditions.push(`u.is_verified = 0`);
        } else if (s === '1' || s.toLowerCase() === 'active') {
            conditions.push(`u.is_active = 1 AND u.is_verified = 1`);
        } else if (s === '0' || s.toLowerCase() === 'inactive') {
            conditions.push(`u.is_active = 0`);
        }
    }

    const whereClause = conditions.length > 0 ? ` WHERE ` + conditions.join(' AND ') : '';
    return { whereClause, params };
}

const UserAccountModel = {
    async getAll(limit = null, offset = 0, filters = {}) {
        // Support legacy single string argument: getAll(search)
        if (typeof limit === 'string') {
            filters = { search: limit };
            limit = null;
            offset = 0;
        }
        const { whereClause, params } = buildUserWhere(filters);
        let query = `SELECT u.user_id, u.username, u.email, u.is_active, u.is_verified, r.role_name, 
                            u.full_name, u.first_name, u.middle_name, u.last_name, u.suffix, u.profile_image,
                            m.member_id, m.contact_number
                     FROM users u 
                     JOIN roles r ON u.role_id = r.role_id 
                     LEFT JOIN members m ON u.user_id = m.user_id
                     ${whereClause}
                     ORDER BY u.user_id ASC`;
        if (limit !== null && limit !== undefined) {
            query += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
        }
        const [rows] = await pool.query(query, params);
        return rows;
    },

    async getCount(filters = {}) {
        const { whereClause, params } = buildUserWhere(filters);
        const query = `SELECT COUNT(*) AS total 
                       FROM users u 
                       JOIN roles r ON u.role_id = r.role_id 
                       LEFT JOIN members m ON u.user_id = m.user_id
                       ${whereClause}`;
        const [rows] = await pool.query(query, params);
        return rows[0] ? rows[0].total : 0;
    },

    async getById(id) {
        const [rows] = await pool.execute(
            `SELECT u.user_id, u.username, u.email, u.is_active, u.is_verified, r.role_name, 
                    u.full_name, u.first_name, u.middle_name, u.last_name, u.suffix, u.profile_image,
                    m.member_id, m.contact_number
             FROM users u 
             JOIN roles r ON u.role_id = r.role_id 
             LEFT JOIN members m ON u.user_id = m.user_id
             WHERE u.user_id = ?`,
            [id]
        );
        return rows[0];
    },

    async create(data) {
        const { username, email, password_hash, full_name, first_name, middle_name, last_name, suffix, role_id, profile_image, is_verified } = data;
        const [result] = await pool.execute(
            `INSERT INTO users (role_id, username, email, password_hash, full_name, first_name, middle_name, last_name, suffix, is_active, is_verified, profile_image) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [
                role_id || 3, 
                username || null, 
                email || null, 
                password_hash, 
                full_name || null, 
                first_name || null,
                middle_name || null,
                last_name || null,
                suffix || null,
                is_verified !== undefined ? is_verified : 0, 
                profile_image || null
            ]
        );
        return result.insertId;
    },

    async verify(id) {
        await pool.execute(
            `UPDATE users SET is_verified = 1, is_active = 1, activation_token = NULL, activation_token_expires = NULL WHERE user_id = ?`,
            [id]
        );
    },

    async setActivationToken(userId, token, expires) {
        await pool.execute(
            `UPDATE users SET activation_token = ?, activation_token_expires = ? WHERE user_id = ?`,
            [token, expires, userId]
        );
    },

    async findByActivationToken(token) {
        const [rows] = await pool.execute(
            `SELECT u.user_id, u.username, u.email, u.full_name, u.is_active, u.is_verified, 
                    u.activation_token, u.activation_token_expires, r.role_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE u.activation_token = ?
             LIMIT 1`,
            [token]
        );
        return rows[0] || null;
    },

    async activateUserByToken(token) {
        const [result] = await pool.execute(
            `UPDATE users 
             SET is_verified = 1, is_active = 1 
             WHERE activation_token = ?`,
            [token]
        );
        return result.affectedRows > 0;
    },

    async activate(userId) {
        await pool.execute(
            `UPDATE users 
             SET is_verified = 1, is_active = 1, activation_token = NULL, activation_token_expires = NULL 
             WHERE user_id = ?`,
            [userId]
        );
    },

    async update(id, data) {
        const { username, email, full_name, first_name, middle_name, last_name, suffix, role_id, is_active, is_verified, profile_image } = data;
        await pool.execute(
            `UPDATE users SET 
                username = ?, email = ?, full_name = ?, 
                first_name = ?, middle_name = ?, last_name = ?, suffix = ?,
                role_id = ?, is_active = ?, 
                is_verified = COALESCE(?, is_verified),
                profile_image = COALESCE(?, profile_image) 
             WHERE user_id = ?`,
            [
                username || null, 
                email || null, 
                full_name || null, 
                first_name !== undefined ? first_name : null,
                middle_name !== undefined ? middle_name : null,
                last_name !== undefined ? last_name : null,
                suffix !== undefined ? suffix : null,
                role_id !== undefined ? role_id : 3, 
                is_active !== undefined ? is_active : 1, 
                is_verified !== undefined ? is_verified : null,
                profile_image || null, 
                id
            ]
        );
    },

    async updatePassword(id, passwordHash) {
        await pool.execute(`UPDATE users SET password_hash = ? WHERE user_id = ?`, [passwordHash, id]);
    },

    async delete(id, fallbackAdminId = 1) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Verify user exists
            const [users] = await conn.execute('SELECT user_id, username, email FROM users WHERE user_id = ?', [id]);
            if (users.length === 0) {
                await conn.rollback();
                return false;
            }

            // Ensure fallbackAdminId is valid and not the user being deleted
            let safeAdminId = parseInt(fallbackAdminId, 10);
            if (!safeAdminId || safeAdminId === id) {
                const [admins] = await conn.execute('SELECT user_id FROM users WHERE user_id != ? AND role_id = 1 LIMIT 1', [id]);
                safeAdminId = admins.length > 0 ? admins[0].user_id : 1;
            }

            // 2. Reassign historical records to preserve financial and attendance tallies without violating foreign keys
            await conn.execute('UPDATE ministry_attendance SET recorded_by = ? WHERE recorded_by = ?', [safeAdminId, id]);
            await conn.execute('UPDATE attendance_tallies SET recorded_by = ? WHERE recorded_by = ?', [safeAdminId, id]);
            await conn.execute('UPDATE announcements SET created_by = ? WHERE created_by = ?', [safeAdminId, id]);
            await conn.execute('UPDATE banners SET created_by = ? WHERE created_by = ?', [safeAdminId, id]);
            await conn.execute('UPDATE finance_transactions SET recorded_by = ? WHERE recorded_by = ?', [safeAdminId, id]);
            await conn.execute('UPDATE gallery_albums SET created_by = ? WHERE created_by = ?', [safeAdminId, id]);
            await conn.execute('UPDATE gallery_images SET uploaded_by = ? WHERE uploaded_by = ?', [safeAdminId, id]);
            await conn.execute('UPDATE sms_logs SET triggered_by = ? WHERE triggered_by = ?', [safeAdminId, id]);
            await conn.execute('UPDATE content_pages SET updated_by = ? WHERE updated_by = ?', [safeAdminId, id]);

            // 3. Unlink member records if linked
            await conn.execute('UPDATE members SET user_id = NULL WHERE user_id = ?', [id]);

            // 4. Clean user MFA challenges and recovery codes
            await conn.execute('DELETE FROM user_mfa_recovery_codes WHERE user_id = ?', [id]);
            await conn.execute('DELETE FROM mfa_login_challenges WHERE user_id = ?', [id]);

            // 5. Nullify audit trail entries
            await conn.execute('UPDATE audit_trail SET user_id = NULL WHERE user_id = ?', [id]);

            // 6. Delete user account
            await conn.execute('DELETE FROM users WHERE user_id = ?', [id]);

            await conn.commit();
            return true;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }
};

module.exports = UserAccountModel;
