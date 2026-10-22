const { pool } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

exports.getSummaryReport = async (req, res) => {
    try {
        const [finance] = await pool.execute(
            `SELECT 
                SUM(CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END) AS total_income,
                SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END) AS total_expense
             FROM finance_transactions`
        );
        
        const [members] = await pool.execute(`SELECT COUNT(*) as total_members, SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_members FROM members`);
        
        const [attendance] = await pool.execute(
            `SELECT 
                SUM(adult_count) as total_adults,
                SUM(youth_count) as total_youth,
                SUM(children_count) as total_children,
                SUM(visitor_count) as total_visitors,
                SUM(total_count) as total_attendance
             FROM attendance_tallies`
        );

        const [ministries] = await pool.execute(`SELECT COUNT(*) as total_ministries FROM ministries WHERE is_active = 1`);

        const reportData = {
            finance: finance[0],
            members: members[0],
            attendance: attendance[0],
            ministries: ministries[0]
        };

        return successResponse(res, reportData, 'Summary report generated');
    } catch (error) {
        console.error('Report Error:', error);
        return errorResponse(res, 'Failed to generate report', 500);
    }
};