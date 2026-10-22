const { pool } = require('../config/database');

const AnalyticsModel = {
    async getFinanceSummary() {
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
            `SELECT DATE_FORMAT(transaction_date, '%Y-%m') as month,
                    SUM(CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END) as income,
                    SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END) as expense
             FROM finance_transactions GROUP BY month ORDER BY month ASC LIMIT 12`
        );
        return rows;
    },
    async getCategoryBreakdown() {
        const [rows] = await pool.execute(
            `SELECT fc.category_name, ft.transaction_type, SUM(ft.amount) as total_amount
             FROM finance_transactions ft JOIN finance_categories fc ON ft.category_id = fc.category_id
             GROUP BY ft.category_id, ft.transaction_type ORDER BY total_amount DESC`
        );
        return rows;
    },
    async getMemberGrowth() {
        const [rows] = await pool.execute(
            `SELECT DATE_FORMAT(membership_date, '%Y-%m') as month, COUNT(*) as new_members
             FROM members WHERE membership_date IS NOT NULL GROUP BY month ORDER BY month ASC LIMIT 12`
        );
        return rows;
    }
};

module.exports = AnalyticsModel;