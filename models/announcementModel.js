const { pool } = require('../config/database');

const AnnouncementModel = {
    async getAll(limit = null, offset = 0, filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        let sql = `SELECT a.*, u.full_name AS created_by_name,
                           COALESCE(a.department, m.department) AS department,
                           m.ministry_name
                    FROM announcements a 
                    JOIN users u ON a.created_by = u.user_id 
                    LEFT JOIN ministries m ON a.ministry_id = m.ministry_id
                    ${whereClause}
                    ORDER BY a.is_pinned DESC, a.publish_date DESC`;
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
            conditions.push(`(a.title LIKE ? OR a.content LIKE ? OR a.category LIKE ?)`);
            params.push(q, q, q);
        }
        if (filters.department && String(filters.department).trim()) {
            conditions.push(`(a.department = ? OR m.department = ?)`);
            params.push(String(filters.department).trim(), String(filters.department).trim());
        }
        if (filters.ministry_id && String(filters.ministry_id).trim()) {
            conditions.push(`a.ministry_id = ?`);
            params.push(parseInt(filters.ministry_id, 10));
        }
        if (filters.category && String(filters.category).trim()) {
            conditions.push(`a.category = ?`);
            params.push(String(filters.category).trim());
        }
        if (filters.target_audience && String(filters.target_audience).trim()) {
            conditions.push(`a.target_audience = ?`);
            params.push(String(filters.target_audience).trim());
        }
        if (filters.is_pinned !== undefined && filters.is_pinned !== '') {
            conditions.push(`a.is_pinned = ?`);
            params.push(filters.is_pinned ? 1 : 0);
        }
        if (filters.is_published !== undefined && filters.is_published !== '') {
            conditions.push(`a.is_published = ?`);
            params.push(filters.is_published ? 1 : 0);
        }
        if (filters.publish_date && String(filters.publish_date).trim()) {
            conditions.push(`DATE(a.publish_date) = ?`);
            params.push(String(filters.publish_date).trim());
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        return { whereClause, params };
    },

    async getCount(filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        const sql = `SELECT COUNT(*) AS total 
                     FROM announcements a 
                     JOIN users u ON a.created_by = u.user_id 
                     LEFT JOIN ministries m ON a.ministry_id = m.ministry_id
                     ${whereClause}`;
        const [rows] = await pool.query(sql, params);
        return rows[0] ? rows[0].total : 0;
    },

    async getById(id) {
        const [rows] = await pool.execute(
            `SELECT a.*, COALESCE(a.department, m.department) AS department, m.ministry_name
             FROM announcements a
             LEFT JOIN ministries m ON a.ministry_id = m.ministry_id
             WHERE a.announcement_id = ?`,
            [id]
        );
        return rows[0];
    },

    async create(data, userId) {
        const { title, content, category, department, ministry_id, target_audience, is_pinned, is_published, publish_date, expiry_date } = data;
        const [result] = await pool.execute(
            `INSERT INTO announcements (title, content, category, department, ministry_id, target_audience, is_pinned, is_published, publish_date, expiry_date, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, content, category || 'General', department || null, ministry_id || null, target_audience || 'All', is_pinned ? 1 : 0, is_published ? 1 : 0, publish_date || new Date(), expiry_date || null, userId]
        );
        return result.insertId;
    },

    async update(id, data) {
        const { title, content, category, department, ministry_id, target_audience, is_pinned, is_published, publish_date, expiry_date } = data;
        await pool.execute(
            `UPDATE announcements SET 
                title = ?, content = ?, category = ?, department = ?, ministry_id = ?, target_audience = ?, is_pinned = ?, 
                is_published = ?, publish_date = ?, expiry_date = ? 
             WHERE announcement_id = ?`,
            [title, content, category || 'General', department || null, ministry_id || null, target_audience || 'All', is_pinned ? 1 : 0, is_published ? 1 : 0, publish_date || new Date(), expiry_date || null, id]
        );
    },

    async delete(id) {
        await pool.execute(`DELETE FROM announcements WHERE announcement_id = ?`, [id]);
    },

    async triggerEmailBroadcast(id, userId) {
        const announcement = await this.getById(id);
        if (!announcement) throw new Error('Announcement not found');

        // Fetch active members who have a valid email registered
        const [memberRows] = await pool.execute(
            `SELECT CONCAT(first_name, ' ', last_name) AS name, email
             FROM members
             WHERE status = 'Active' AND email IS NOT NULL AND email != ''
             LIMIT 150`
        );

        let recipients = memberRows.map(m => ({ email: m.email.trim(), name: m.name }));

        // Fallback to configured admin/support email if no members have email
        if (recipients.length === 0) {
            const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'info@cogwmphimus.org';
            recipients = [
                { email: adminEmail, name: 'COGWM Administration' }
            ];
        }

        const { sendAnnouncementEmail } = require('../utils/emailService');
        let sentCount = 0;
        let failedCount = 0;

        for (const r of recipients) {
            const emailResult = await sendAnnouncementEmail({
                to: r.email,
                recipientName: r.name,
                title: announcement.title,
                content: announcement.content,
                category: announcement.category || 'General',
                department: announcement.department || 'Church Administration',
                publishDate: announcement.publish_date || new Date()
            });

            if (emailResult.success) sentCount++;
            else failedCount++;

            await pool.execute(
                `INSERT INTO email_logs (announcement_id, recipient_email, recipient_name, subject, status, error_message, triggered_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, r.email, r.name, `[Announcement] ${announcement.title}`, emailResult.status || 'Sent', emailResult.error || null, userId]
            );
        }

        await pool.execute(
            `UPDATE announcements 
             SET email_triggered = 1, email_triggered_at = CURRENT_TIMESTAMP 
             WHERE announcement_id = ?`,
            [id]
        );

        return {
            count: recipients.length,
            sentCount,
            failedCount
        };
    },

    async triggerSmsBroadcast(id, userId) {
        const announcement = await this.getById(id);
        if (!announcement) throw new Error('Announcement not found');

        // Fetch active members with registered contact numbers
        const [memberRows] = await pool.execute(
            `SELECT member_id, CONCAT(first_name, ' ', last_name) AS name, contact_number
             FROM members
             WHERE status = 'Active' 
               AND contact_number IS NOT NULL 
               AND contact_number != ''
             LIMIT 200`
        );

        let recipients = memberRows.map(m => ({ 
            number: m.contact_number.trim(), 
            name: m.name ? m.name.trim() : 'Church Member' 
        }));

        // Fallback recipient if no members have contact numbers registered yet
        if (recipients.length === 0) {
            recipients = [
                { number: '+639763256103', name: 'Church Administration' }
            ];
        }

        const { sendSms } = require('../utils/smsService');
        let sentCount = 0;
        let simulatedCount = 0;
        let failedCount = 0;

        const prefix = `[COGWM Imus] ${announcement.title}: `;
        const maxContentLen = Math.max(20, 150 - prefix.length);
        const cleanContent = (announcement.content || '').replace(/\s+/g, ' ').trim();
        const contentSummary = cleanContent.length > maxContentLen 
            ? cleanContent.substring(0, maxContentLen) + '...' 
            : cleanContent;
        const smsMessage = `${prefix}${contentSummary}`;

        for (const r of recipients) {
            const smsResult = await sendSms(r.number, smsMessage);

            if (smsResult.status === 'Sent') sentCount++;
            else if (smsResult.status === 'Simulated') simulatedCount++;
            else failedCount++;

            await pool.execute(
                `INSERT INTO sms_logs (announcement_id, recipient_number, recipient_name, message_content, status, gateway_response, triggered_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, r.number, r.name, smsMessage, smsResult.status, smsResult.gateway_response || '', userId]
            );
        }

        await pool.execute(
            `UPDATE announcements 
             SET sms_triggered = 1, sms_triggered_at = CURRENT_TIMESTAMP 
             WHERE announcement_id = ?`,
            [id]
        );

        return {
            count: recipients.length,
            sentCount,
            simulatedCount,
            failedCount,
            message: smsMessage
        };
    },

    // Backward compatibility wrapper
    async triggerSms(id, userId) {
        return this.triggerSmsBroadcast(id, userId);
    }
};

module.exports = AnnouncementModel;