const { pool } = require('../config/database');

const FinanceModel = {
    async getAll(limit = null, offset = 0, filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        let sql = `SELECT ft.transaction_id, ft.category_id, ft.ministry_id, ft.transaction_type, ft.amount, ft.transaction_date, 
                           ft.description, ft.reference_number, ft.attachment, fc.category_name,
                           COALESCE(ft.department, min.department, 'Administration') AS department,
                           min.ministry_name,
                           u.full_name AS recorded_by_name
                    FROM finance_transactions ft
                    JOIN finance_categories fc ON ft.category_id = fc.category_id
                    JOIN users u ON ft.recorded_by = u.user_id
                    LEFT JOIN ministries min ON ft.ministry_id = min.ministry_id
                    ${whereClause}
                    ORDER BY ft.transaction_date DESC, ft.transaction_id DESC`;
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
            conditions.push(`(ft.description LIKE ? OR ft.reference_number LIKE ? OR fc.category_name LIKE ? OR u.full_name LIKE ?)`);
            params.push(q, q, q, q);
        }
        if (filters.type && String(filters.type).trim()) {
            conditions.push(`ft.transaction_type = ?`);
            params.push(String(filters.type).trim());
        }
        if (filters.category_id && String(filters.category_id).trim()) {
            conditions.push(`ft.category_id = ?`);
            params.push(parseInt(filters.category_id, 10));
        }
        if (filters.department && String(filters.department).trim()) {
            conditions.push(`(ft.department = ? OR min.department = ?)`);
            params.push(String(filters.department).trim(), String(filters.department).trim());
        }
        if (filters.ministry_id && String(filters.ministry_id).trim()) {
            conditions.push(`ft.ministry_id = ?`);
            params.push(parseInt(filters.ministry_id, 10));
        }
        if (filters.date_from && String(filters.date_from).trim()) {
            conditions.push(`DATE(ft.transaction_date) >= ?`);
            params.push(String(filters.date_from).trim());
        }
        if (filters.date_to && String(filters.date_to).trim()) {
            conditions.push(`DATE(ft.transaction_date) <= ?`);
            params.push(String(filters.date_to).trim());
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        return { whereClause, params };
    },

    async getCount(filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        const sql = `SELECT COUNT(*) AS total 
                     FROM finance_transactions ft
                     JOIN finance_categories fc ON ft.category_id = fc.category_id
                     JOIN users u ON ft.recorded_by = u.user_id
                     LEFT JOIN ministries min ON ft.ministry_id = min.ministry_id
                     ${whereClause}`;
        const [rows] = await pool.query(sql, params);
        return rows[0] ? rows[0].total : 0;
    },

    async getById(id) {
        const [rows] = await pool.execute(
            `SELECT ft.*, fc.category_name, min.ministry_name,
                    COALESCE(ft.department, min.department, 'Administration') AS department
             FROM finance_transactions ft
             JOIN finance_categories fc ON ft.category_id = fc.category_id
             LEFT JOIN ministries min ON ft.ministry_id = min.ministry_id
             WHERE ft.transaction_id = ?`,
            [id]
        );
        return rows[0];
    },

    async create(data, userId) {
        const { category_id, ministry_id, department, transaction_type, amount, transaction_date, description, reference_number, attachment } = data;
        const [result] = await pool.execute(
            `INSERT INTO finance_transactions 
                (category_id, ministry_id, department, transaction_type, amount, transaction_date, description, reference_number, attachment, recorded_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [category_id, ministry_id || null, department || null, transaction_type, amount, transaction_date, description || null, reference_number || null, attachment || null, userId]
        );
        return result.insertId;
    },

    async update(id, data) {
        const { category_id, ministry_id, department, transaction_type, amount, transaction_date, description, reference_number, attachment } = data;
        await pool.execute(
            `UPDATE finance_transactions SET 
                category_id = ?, ministry_id = ?, department = ?, transaction_type = ?, amount = ?, transaction_date = ?, 
                description = ?, reference_number = ?, attachment = ? 
             WHERE transaction_id = ?`,
            [category_id, ministry_id !== undefined ? (ministry_id || null) : null, department !== undefined ? (department || null) : null, transaction_type, amount, transaction_date, description || null, reference_number || null, attachment || null, id]
        );
    },

    async delete(id) {
        await pool.execute(`DELETE FROM finance_transactions WHERE transaction_id = ?`, [id]);
    },

    async getCategories() {
        const [rows] = await pool.execute(`SELECT * FROM finance_categories ORDER BY category_type, category_name`);
        return rows;
    },

    // --- Analytics Queries ---
    async getSummary() {
        const [rows] = await pool.execute(
            `SELECT 
                SUM(CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END) AS total_income,
                SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END) AS total_expense,
                (SUM(CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END) - 
                 SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END)) AS net_balance
             FROM finance_transactions`
        );
        return rows[0];
    },

    async getMonthlyTrends() {
        const [rows] = await pool.execute(
            `SELECT 
                DATE_FORMAT(transaction_date, '%Y-%m') as month,
                SUM(CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END) as expense
             FROM finance_transactions
             GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
             ORDER BY month ASC
             LIMIT 12`
        );
        return rows;
    },

    async getCategoryBreakdown() {
        const [rows] = await pool.execute(
            `SELECT fc.category_name, ft.transaction_type, SUM(ft.amount) as total_amount
             FROM finance_transactions ft
             JOIN finance_categories fc ON ft.category_id = fc.category_id
             GROUP BY ft.category_id, ft.transaction_type
             ORDER BY total_amount DESC`
        );
        return rows;
    }
};

module.exports = FinanceModel;