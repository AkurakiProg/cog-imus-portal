const { pool } = require('../config/database');

const AttendanceModel = {
    async getAll(limit = null, offset = 0, filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        let sql = `SELECT t.*, u.full_name AS recorded_by_name 
                    FROM attendance_tallies t 
                    JOIN users u ON t.recorded_by = u.user_id 
                    ${whereClause}
                    ORDER BY t.service_date DESC`;
        if (limit !== null && limit !== undefined) {
            sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
        }
        const [rows] = await pool.query(sql, params);
        return rows;
    },

    buildWhere(filters = {}) {
        const conditions = [];
        const params = [];

        if (filters.service_type && String(filters.service_type).trim()) {
            conditions.push(`t.service_type = ?`);
            params.push(String(filters.service_type).trim());
        }
        if (filters.date && String(filters.date).trim()) {
            conditions.push(`t.service_date = ?`);
            params.push(String(filters.date).trim());
        }
        if (filters.date_from && String(filters.date_from).trim()) {
            conditions.push(`t.service_date >= ?`);
            params.push(String(filters.date_from).trim());
        }
        if (filters.date_to && String(filters.date_to).trim()) {
            conditions.push(`t.service_date <= ?`);
            params.push(String(filters.date_to).trim());
        }
        if (filters.search && String(filters.search).trim()) {
            const q = `%${String(filters.search).trim()}%`;
            conditions.push(`(t.notes LIKE ? OR t.service_type LIKE ? OR u.full_name LIKE ?)`);
            params.push(q, q, q);
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        return { whereClause, params };
    },

    async getCount(filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        const sql = `SELECT COUNT(*) AS total 
                     FROM attendance_tallies t 
                     JOIN users u ON t.recorded_by = u.user_id 
                     ${whereClause}`;
        const [rows] = await pool.query(sql, params);
        return rows[0] ? rows[0].total : 0;
    },

    async create(data, userId) {
        const { service_type, service_date, adult_count, youth_count, children_count, visitor_count, notes, event_id } = data;
        const total = (parseInt(adult_count) || 0) + (parseInt(youth_count) || 0) + (parseInt(children_count) || 0) + (parseInt(visitor_count) || 0);
        
        const [result] = await pool.execute(
            `INSERT INTO attendance_tallies (event_id, service_type, service_date, adult_count, youth_count, children_count, visitor_count, total_count, recorded_by, notes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [event_id || null, service_type, service_date, adult_count || 0, youth_count || 0, children_count || 0, visitor_count || 0, total, userId, notes || null]
        );
        return result.insertId;
    },

    async getSummary() {
        const [rows] = await pool.execute(
            `SELECT 
                SUM(adult_count) as total_adults,
                SUM(youth_count) as total_youth,
                SUM(children_count) as total_children,
                SUM(visitor_count) as total_visitors,
                SUM(total_count) as total_attendance
             FROM attendance_tallies`
        );
        return rows[0];
    }
};

module.exports = AttendanceModel;