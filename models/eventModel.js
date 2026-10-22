const { pool } = require('../config/database');

const EventModel = {
    async getAll(limit = null, offset = 0, filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        let sql = `SELECT e.*, COALESCE(e.department, m.department) AS department, m.ministry_name 
                    FROM events e
                    LEFT JOIN ministries m ON e.ministry_id = m.ministry_id
                    ${whereClause}
                    ORDER BY e.start_datetime DESC`;
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
            conditions.push(`(e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ? OR e.organizer LIKE ?)`);
            params.push(q, q, q, q);
        }
        const typeVal = filters.type || filters.event_type;
        if (typeVal && String(typeVal).trim()) {
            conditions.push(`e.event_type = ?`);
            params.push(String(typeVal).trim());
        }
        if (filters.ministry_id && String(filters.ministry_id).trim()) {
            conditions.push(`e.ministry_id = ?`);
            params.push(parseInt(filters.ministry_id, 10));
        }
        if (filters.department && String(filters.department).trim()) {
            conditions.push(`(e.department = ? OR m.department = ?)`);
            params.push(String(filters.department).trim(), String(filters.department).trim());
        }
        if (filters.status && String(filters.status).trim()) {
            conditions.push(`e.status = ?`);
            params.push(String(filters.status).trim());
        }
        if (filters.enrollment !== undefined && filters.enrollment !== null && String(filters.enrollment).trim() !== '') {
            const enVal = String(filters.enrollment).trim().toLowerCase();
            if (enVal === 'open' || enVal === '1' || enVal === 'true') {
                conditions.push(`e.is_enrollment_open = 1`);
            } else if (enVal === 'closed' || enVal === '0' || enVal === 'false') {
                conditions.push(`e.is_enrollment_open = 0`);
            }
        }
        if (filters.date && String(filters.date).trim()) {
            conditions.push(`DATE(e.start_datetime) = ?`);
            params.push(String(filters.date).trim());
        }

        // Archive status filter: default to only active (non-archived) events
        if (filters.archived === 1 || filters.archived === '1' || filters.is_archived === 1 || filters.is_archived === '1') {
            conditions.push(`e.is_archived = 1`);
        } else if (filters.archived === 'all' || filters.is_archived === 'all') {
            // Include both active and archived
        } else {
            conditions.push(`(e.is_archived = 0 OR e.is_archived IS NULL)`);
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        return { whereClause, params };
    },

    async getCount(filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        const sql = `SELECT COUNT(*) AS total 
                     FROM events e
                     LEFT JOIN ministries m ON e.ministry_id = m.ministry_id
                     ${whereClause}`;
        const [rows] = await pool.query(sql, params);
        return rows[0] ? rows[0].total : 0;
    },

    async getById(id) {
        const [rows] = await pool.execute(
            `SELECT e.*, COALESCE(e.department, m.department) AS department, m.ministry_name 
             FROM events e 
             LEFT JOIN ministries m ON e.ministry_id = m.ministry_id
             WHERE e.event_id = ?`,
            [id]
        );
        return rows[0];
    },

    async create(data) {
        const { title, description, event_type, start_datetime, end_datetime, venue, organizer, ministry_id, department, banner_image, capacity, is_enrollment_open, is_public, is_featured, status } = data;
        const cleanMinistryId = (ministry_id && !isNaN(ministry_id) && Number(ministry_id) > 0) ? Number(ministry_id) : null;
        const cleanCapacity = (capacity && !isNaN(capacity) && Number(capacity) > 0) ? Number(capacity) : null;
        const cleanDept = (department && String(department).trim() && String(department).trim() !== 'None') ? String(department).trim() : null;
        const cleanOpen = (is_enrollment_open === 1 || is_enrollment_open === '1' || is_enrollment_open === true || is_enrollment_open === 'true') ? 1 : 0;
        const cleanPublic = (is_public === 1 || is_public === '1' || is_public === true || is_public === 'true') ? 1 : 0;
        const cleanFeatured = (is_featured === 1 || is_featured === '1' || is_featured === true || is_featured === 'true') ? 1 : 0;

        const [result] = await pool.execute(
            `INSERT INTO events (
                title, description, event_type, start_datetime, end_datetime, venue, organizer, 
                ministry_id, department, banner_image, capacity, is_enrollment_open, is_public, is_featured, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title, description || null, event_type || 'Other', start_datetime || null, end_datetime || null, 
                venue || null, organizer || null, cleanMinistryId, cleanDept, banner_image || null, cleanCapacity, 
                cleanOpen, cleanPublic, cleanFeatured, status || 'Upcoming'
            ]
        );
        return result.insertId;
    },

    async update(id, data) {
        const { title, description, event_type, start_datetime, end_datetime, venue, organizer, ministry_id, department, banner_image, capacity, is_enrollment_open, is_public, is_featured, status } = data;
        const cleanMinistryId = (ministry_id && !isNaN(ministry_id) && Number(ministry_id) > 0) ? Number(ministry_id) : null;
        const cleanCapacity = (capacity && !isNaN(capacity) && Number(capacity) > 0) ? Number(capacity) : null;
        const cleanDept = (department && String(department).trim() && String(department).trim() !== 'None') ? String(department).trim() : null;
        const cleanOpen = (is_enrollment_open === 1 || is_enrollment_open === '1' || is_enrollment_open === true || is_enrollment_open === 'true') ? 1 : 0;
        const cleanPublic = (is_public === 1 || is_public === '1' || is_public === true || is_public === 'true') ? 1 : 0;
        const cleanFeatured = (is_featured === 1 || is_featured === '1' || is_featured === true || is_featured === 'true') ? 1 : 0;

        await pool.execute(
            `UPDATE events SET 
                title = ?, description = ?, event_type = ?, start_datetime = ?, end_datetime = ?, 
                venue = ?, organizer = ?, ministry_id = ?, department = ?, banner_image = ?, capacity = ?, is_enrollment_open = ?, 
                is_public = ?, is_featured = ?, status = ?
             WHERE event_id = ?`,
            [
                title, description || null, event_type || 'Other', start_datetime, end_datetime, 
                venue || null, organizer || null, cleanMinistryId, cleanDept, banner_image || null, cleanCapacity, 
                cleanOpen, cleanPublic, cleanFeatured, status || 'Upcoming', id
            ]
        );
    },

    async archive(id) {
        await pool.execute(`UPDATE events SET is_archived = 1, archived_at = NOW() WHERE event_id = ?`, [id]);
    },

    async restore(id) {
        await pool.execute(`UPDATE events SET is_archived = 0, archived_at = NULL WHERE event_id = ?`, [id]);
    },

    async delete(id) {
        await pool.execute(`DELETE FROM events WHERE event_id = ?`, [id]);
    },

    // --- Enrollments ---
    async getEnrollments(eventId) {
        const [rows] = await pool.execute(
            `SELECT ee.enrollment_id, ee.status, ee.enrollment_date, 
                    m.member_id, m.first_name, m.last_name, m.contact_number,
                    COALESCE(u.email, m.email) AS email, u.profile_image
             FROM event_enrollments ee
             JOIN members m ON ee.member_id = m.member_id
             LEFT JOIN users u ON m.user_id = u.user_id
             WHERE ee.event_id = ?
             ORDER BY ee.enrollment_date DESC`,
            [eventId]
        );
        return rows;
    },

    async checkEnrollment(eventId, memberId) {
        const [rows] = await pool.execute(
            `SELECT * FROM event_enrollments WHERE event_id = ? AND member_id = ?`,
            [eventId, memberId]
        );
        return rows[0];
    },

    async enrollMember(eventId, memberId) {
        const [result] = await pool.execute(
            `INSERT INTO event_enrollments (event_id, member_id, status) 
             VALUES (?, ?, 'Pending')
             ON DUPLICATE KEY UPDATE status = 'Pending'`,
            [eventId, memberId]
        );
        return result.insertId;
    },

    async updateEnrollmentStatus(enrollmentId, status) {
        await pool.execute(
            `UPDATE event_enrollments SET status = ? WHERE enrollment_id = ?`,
            [status, enrollmentId]
        );
    },

    async cancelEnrollment(eventId, memberId) {
        const [result] = await pool.execute(
            `DELETE FROM event_enrollments WHERE event_id = ? AND member_id = ?`,
            [eventId, memberId]
        );
        return result.affectedRows;
    },

    async getMemberEnrollments(memberId) {
        const [rows] = await pool.execute(
            `SELECT ee.enrollment_id, ee.event_id, ee.status, ee.enrollment_date,
                    e.title, e.event_type, e.start_datetime, e.end_datetime, e.venue
             FROM event_enrollments ee
             JOIN events e ON ee.event_id = e.event_id
             WHERE ee.member_id = ?`,
            [memberId]
        );
        return rows;
    }
};

module.exports = EventModel;