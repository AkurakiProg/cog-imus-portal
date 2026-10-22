const { pool } = require('../config/database');

const MemberModel = {
        async getAll(limit = null, offset = 0, filters = {}) {
        if (typeof limit === 'string') {
            filters = { search: limit };
            limit = null;
            offset = 0;
        }
        const { whereClause, params } = this.buildWhere(filters);
        let sql = `SELECT m.member_id, m.user_id, m.first_name, m.middle_name, m.last_name, m.suffix, 
                           m.birth_date, m.gender, m.civil_status, m.contact_number, m.email, m.address, 
                           m.membership_date, m.status, m.church_role, u.username, u.profile_image, r.role_name AS system_role
                    FROM members m 
                    LEFT JOIN users u ON m.user_id = u.user_id
                    LEFT JOIN roles r ON u.role_id = r.role_id
                    ${whereClause}
                    ORDER BY m.last_name ASC, m.first_name ASC`;
        if (limit !== null && limit !== undefined) {
            sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
        }
        const [rows] = await pool.query(sql, params);
        return rows;
    },

    buildWhere(filters = {}) {
        const conditions = [];
        const params = [];

        if (filters.search && String(filters.search).trim()) {
            const q = `%${String(filters.search).trim()}%`;
            conditions.push(`(m.first_name LIKE ? OR m.last_name LIKE ? OR IFNULL(m.middle_name, '') LIKE ? OR IFNULL(m.email, '') LIKE ? OR IFNULL(m.contact_number, '') LIKE ? OR CONCAT(m.first_name, ' ', m.last_name) LIKE ?)`);
            params.push(q, q, q, q, q, q);
        }
        if (filters.gender && String(filters.gender).trim()) {
            conditions.push(`m.gender = ?`);
            params.push(String(filters.gender).trim());
        }
        if (filters.civil_status && String(filters.civil_status).trim()) {
            conditions.push(`m.civil_status = ?`);
            params.push(String(filters.civil_status).trim());
        }
        if (filters.church_role && String(filters.church_role).trim()) {
            conditions.push(`m.church_role = ?`);
            params.push(String(filters.church_role).trim());
        }
        if (filters.status && String(filters.status).trim()) {
            conditions.push(`m.status = ?`);
            params.push(String(filters.status).trim());
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        return { whereClause, params };
    },

    async getCount(filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        const sql = `SELECT COUNT(*) AS total 
                     FROM members m 
                     LEFT JOIN users u ON m.user_id = u.user_id
                     ${whereClause}`;
        const [rows] = await pool.query(sql, params);
        return rows[0] ? rows[0].total : 0;
    },

    async getById(id) {
        const [rows] = await pool.execute(
            `SELECT m.*, u.username, u.email as user_email, u.profile_image
             FROM members m
             LEFT JOIN users u ON m.user_id = u.user_id
             WHERE m.member_id = ?`,
            [id]
        );
        return rows[0];
    },

    async findByUserId(userId) {
        const [rows] = await pool.execute(
            `SELECT m.*, u.username, u.email, u.profile_image 
             FROM members m 
             JOIN users u ON m.user_id = u.user_id 
             WHERE m.user_id = ?`,
            [userId]
        );
        return rows[0];
    },

    async getMyMinistry(userId) {
        const [rows] = await pool.execute(
            `SELECT m.ministry_id, m.ministry_name, m.ministry_code, m.description, m.meeting_schedule, m.color_code, 
                    mm.role_in_ministry, mm.joined_date, mm.status,
                    CONCAT(leader.first_name, ' ', leader.last_name) AS leader_name
             FROM ministry_members mm
             JOIN ministries m ON mm.ministry_id = m.ministry_id
             LEFT JOIN members leader ON m.leader_member_id = leader.member_id
             JOIN members mem ON mm.member_id = mem.member_id
             WHERE mem.user_id = ? AND mm.status = 'Active'`,
            [userId]
        );
        return rows[0];
    },

    async create(data) {
        const { 
            user_id, first_name, middle_name, last_name, suffix, 
            birth_date, gender, civil_status, contact_number, email, 
            address, occupation, baptized, baptism_date, membership_date, 
            emergency_contact_name, emergency_contact_number, status, church_role 
        } = data;

        const [result] = await pool.execute(
            `INSERT INTO members (
                user_id, first_name, middle_name, last_name, suffix, 
                birth_date, gender, civil_status, contact_number, email, 
                address, occupation, baptized, baptism_date, membership_date, 
                emergency_contact_name, emergency_contact_number, status, church_role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id || null, 
                first_name, 
                middle_name || null, 
                last_name, 
                suffix || null, 
                birth_date || null, 
                gender || null, 
                civil_status || null,
                contact_number || null, 
                email || null, 
                address || null, 
                occupation || null, 
                baptized ? 1 : 0, 
                baptism_date || null,
                membership_date || null, 
                emergency_contact_name || null, 
                emergency_contact_number || null, 
                status || 'Active', 
                church_role || 'Member'
            ]
        );
        return result.insertId;
    },

    async update(id, data) {
        const { 
            user_id, first_name, middle_name, last_name, suffix, 
            birth_date, gender, civil_status, contact_number, email, 
            address, occupation, baptized, baptism_date, membership_date, 
            emergency_contact_name, emergency_contact_number, status, church_role 
        } = data;

        await pool.execute(
            `UPDATE members SET 
                user_id = COALESCE(?, user_id), first_name = ?, middle_name = ?, last_name = ?, suffix = ?, 
                birth_date = ?, gender = ?, civil_status = ?, contact_number = ?, email = ?, 
                address = ?, occupation = ?, baptized = ?, baptism_date = ?, membership_date = ?, 
                emergency_contact_name = ?, emergency_contact_number = ?, status = ?, church_role = ?
             WHERE member_id = ?`,
            [
                user_id !== undefined ? user_id : null, 
                first_name, 
                middle_name || null, 
                last_name, 
                suffix || null, 
                birth_date || null, 
                gender || null, 
                civil_status || null,
                contact_number || null, 
                email || null, 
                address || null, 
                occupation || null, 
                baptized ? 1 : 0, 
                baptism_date || null,
                membership_date || null, 
                emergency_contact_name || null, 
                emergency_contact_number || null, 
                status || 'Active', 
                church_role || 'Member',
                id
            ]
        );
    },

    async linkUser(memberId, userId) {
        await pool.execute(`UPDATE members SET user_id = ? WHERE member_id = ?`, [userId, memberId]);
    },

    async delete(id) {
        await pool.execute(`DELETE FROM members WHERE member_id = ?`, [id]);
    }
};

module.exports = MemberModel;