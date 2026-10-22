const { pool } = require('../config/database');

function buildAuditWhere(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.user) {
        conditions.push(`(u.full_name LIKE ? OR u.username LIKE ?)`);
        params.push(`%${filters.user}%`, `%${filters.user}%`);
    }

    if (filters.action) {
        conditions.push(`a.action = ?`);
        params.push(filters.action);
    }

    if (filters.module) {
        conditions.push(`a.module = ?`);
        params.push(filters.module);
    }

    if (filters.record_id) {
        conditions.push(`a.record_id = ?`);
        params.push(filters.record_id);
    }

    if (filters.date_from) {
        conditions.push(`a.performed_at >= ?`);
        params.push(`${filters.date_from} 00:00:00`);
    }

    if (filters.date_to) {
        conditions.push(`a.performed_at <= ?`);
        params.push(`${filters.date_to} 23:59:59`);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ` + conditions.join(' AND ') : '';
    return { whereClause, params };
}

const AuditModel = {
    async getAll(limit = 50, offset = 0, filters = {}) {
        const { whereClause, params } = buildAuditWhere(filters);
        let query = `SELECT a.audit_id, a.action, a.module, a.record_id, a.old_values, a.new_values, 
                            a.ip_address, a.user_agent, a.performed_at, 
                            u.full_name AS user_name, u.username AS user_username
                     FROM audit_trail a
                     LEFT JOIN users u ON a.user_id = u.user_id
                     ${whereClause}
                     ORDER BY a.performed_at DESC LIMIT ? OFFSET ?`;
        
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.execute(query, params);
        return rows;
    },

    async getCount(filters = {}) {
        const { whereClause, params } = buildAuditWhere(filters);
        let query = `SELECT COUNT(*) as total 
                     FROM audit_trail a
                     LEFT JOIN users u ON a.user_id = u.user_id
                     ${whereClause}`;
        const [rows] = await pool.execute(query, params);
        return rows[0].total;
    }
};

module.exports = AuditModel;