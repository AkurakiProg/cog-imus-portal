const { pool } = require('../config/database');

const SystemModel = {
    async getBackupData() {
        const tables = [
            'roles',
            'users',
            'user_mfa_recovery_codes',
            'mfa_login_challenges',
            'members',
            'ministries',
            'department_heads',
            'ministry_members',
            'ministry_attendance',
            'ministry_attendance_records',
            'c2s_groups',
            'c2s_group_members',
            'finance_categories',
            'finance_transactions',
            'events',
            'event_enrollments',
            'announcements',
            'email_logs',
            'sms_logs',
            'banners',
            'sermons',
            'gallery_albums',
            'gallery_images',
            'attendance_tallies',
            'schedules',
            'contact_messages',
            'content_pages',
            'livestream_broadcast',
            'livestream_daily_views',
            'livestream_comments',
            'livestream_comment_logs',
            'livestream_viewer_sessions',
            'audit_trail'
        ];
        
        const backup = {};
        
        for (const table of tables) {
            try {
                const [rows] = await pool.query(`SELECT * FROM \`${table}\` LIMIT 5000`);
                // Sanitize temporary runtime tokens from users table in backup exports
                if (table === 'users') {
                    backup[table] = rows.map(u => {
                        const copy = { ...u };
                        delete copy.mfa_temp_secret;
                        delete copy.current_session_token;
                        return copy;
                    });
                } else {
                    backup[table] = rows;
                }
            } catch (err) {
                backup[table] = { error: `Could not backup table: ${err.message}` };
            }
        }
        
        return {
            metadata: {
                church: "Church of God World Missions Philippines - Imus",
                exported_at: new Date().toISOString(),
                version: "1.0.0",
                total_tables: tables.length
            },
            database: backup
        };
    }
};

module.exports = SystemModel;
