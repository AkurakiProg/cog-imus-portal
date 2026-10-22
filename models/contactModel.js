const { pool } = require('../config/database');

const ContactModel = {
    async create(data) {
        const { name, email, contact_number, subject, message } = data;
        const [result] = await pool.execute(
            `INSERT INTO contact_messages (name, email, contact_number, subject, message, is_read) 
             VALUES (?, ?, ?, ?, ?, 0)`,
            [name, email, contact_number || null, subject || 'General Inquiry', message]
        );
        return result.insertId;
    },

    async getAll(limit = 50, offset = 0) {
        const safeLimit = Math.max(1, parseInt(limit, 10) || 50);
        const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
        const [rows] = await pool.query(
            `SELECT * FROM contact_messages 
             ORDER BY submitted_at DESC 
             LIMIT ${safeLimit} OFFSET ${safeOffset}`
        );
        return rows;
    },

    async getCount() {
        const [rows] = await pool.execute(`SELECT COUNT(*) as total FROM contact_messages`);
        return rows[0].total;
    },

    async getUnreadCount() {
        const [rows] = await pool.execute(`SELECT COUNT(*) as unread FROM contact_messages WHERE is_read = 0`);
        return rows[0].unread;
    },

    async getById(id) {
        const [rows] = await pool.execute(`SELECT * FROM contact_messages WHERE id = ?`, [id]);
        return rows[0] || null;
    },

    async markAsRead(id) {
        const [result] = await pool.execute(`UPDATE contact_messages SET is_read = 1 WHERE id = ?`, [id]);
        return result.affectedRows > 0;
    },

    async delete(id) {
        const [result] = await pool.execute(`DELETE FROM contact_messages WHERE id = ?`, [id]);
        return result.affectedRows > 0;
    }
};

module.exports = ContactModel;
