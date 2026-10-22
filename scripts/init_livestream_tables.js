const { pool } = require('../config/database');

async function init() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS livestream_daily_views (
                id INT AUTO_INCREMENT PRIMARY KEY,
                view_date DATE NOT NULL UNIQUE,
                views_count INT DEFAULT 0,
                peak_viewers INT DEFAULT 0,
                stream_title VARCHAR(255) DEFAULT 'Sunday Celebration Service - Live Broadcast',
                notes VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS livestream_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                author_name VARCHAR(100) NOT NULL,
                comment_text TEXT NOT NULL,
                author_badge VARCHAR(50) DEFAULT 'Viewer',
                is_admin TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Clean table initialization without artificial fake views
        console.log('Livestream tables verified.');

        // Seed initial friendly sample comments if empty
        const [cRows] = await pool.query('SELECT COUNT(*) as cnt FROM livestream_comments');
        if (cRows[0].cnt === 0) {
            console.log('Seeding initial livestream comments...');
            const sampleComments = [
                { name: 'Sister Maria Santos', text: 'Good morning church! Blessed to be joining online from Bacoor. Amen!', badge: 'Church Member', is_admin: 0 },
                { name: 'Brother David Tan', text: 'Praise the Lord for this message. Hallelujah!', badge: 'Church Member', is_admin: 0 },
                { name: 'COGWM Media Team', text: 'Welcome to our Facebook Live broadcast! Please feel free to share your prayer requests in the chat.', badge: 'Admin', is_admin: 1 },
                { name: 'Grace Bautista', text: 'Amen! Watching with the whole family here at home.', badge: 'Viewer', is_admin: 0 },
                { name: 'Elder Robert Ramos', text: 'God is good all the time! Powerful worship this morning.', badge: 'Leader', is_admin: 0 }
            ];

            for (const c of sampleComments) {
                await pool.query(
                    `INSERT INTO livestream_comments (author_name, comment_text, author_badge, is_admin) VALUES (?, ?, ?, ?)`,
                    [c.name, c.text, c.badge, c.is_admin]
                );
            }
        }

        console.log('Livestream database initialization finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

init();
