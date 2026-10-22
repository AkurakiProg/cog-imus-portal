const db = require('../config/database');

async function migrate() {
    try {
        console.log('Starting migration...');

        // 1. Create c2s_groups
        await db.query(`
            CREATE TABLE IF NOT EXISTS c2s_groups (
                group_id INT NOT NULL AUTO_INCREMENT,
                group_name VARCHAR(150) NOT NULL,
                leader_id INT NOT NULL,
                meeting_day VARCHAR(50) DEFAULT 'Wednesday',
                meeting_time VARCHAR(50) DEFAULT '7:00 PM',
                meeting_location VARCHAR(255) DEFAULT 'Main Church Hall',
                description TEXT DEFAULT NULL,
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id),
                KEY idx_c2s_leader (leader_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('c2s_groups table ready.');

        // 2. Create c2s_group_members
        await db.query(`
            CREATE TABLE IF NOT EXISTS c2s_group_members (
                id INT NOT NULL AUTO_INCREMENT,
                group_id INT NOT NULL,
                member_id INT NOT NULL,
                notes VARCHAR(255) DEFAULT NULL,
                joined_date DATE DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_c2s_group_member (group_id, member_id),
                KEY idx_c2s_group (group_id),
                KEY idx_c2s_member (member_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('c2s_group_members table ready.');

        // 3. Create email_logs
        await db.query(`
            CREATE TABLE IF NOT EXISTS email_logs (
                email_id INT NOT NULL AUTO_INCREMENT,
                announcement_id INT DEFAULT NULL,
                recipient_email VARCHAR(150) NOT NULL,
                recipient_name VARCHAR(150) DEFAULT NULL,
                subject VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'Sent',
                error_message TEXT DEFAULT NULL,
                triggered_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (email_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('email_logs table ready.');

        // 4. Check announcements table for email_triggered columns
        const [annCols] = await db.query('DESCRIBE announcements');
        const colNames = annCols.map(c => c.Field);
        if (!colNames.includes('email_triggered')) {
            await db.query(`ALTER TABLE announcements ADD COLUMN email_triggered TINYINT(1) DEFAULT 0 AFTER sms_triggered_at`);
            console.log('Added email_triggered to announcements');
        }
        if (!colNames.includes('email_triggered_at')) {
            await db.query(`ALTER TABLE announcements ADD COLUMN email_triggered_at DATETIME NULL AFTER email_triggered`);
            console.log('Added email_triggered_at to announcements');
        }

        // 5. Populate sample C2S data if empty
        const [existingGroups] = await db.query('SELECT COUNT(*) as count FROM c2s_groups');
        if (existingGroups[0].count === 0) {
            console.log('Populating sample C2S Groups and Member Roster...');
            const [members] = await db.query("SELECT member_id, first_name, last_name FROM members WHERE status = 'Active' LIMIT 15");
            if (members.length >= 4) {
                // Member 0: Mentor of Group A
                // Member 1: Member of Group A, who also starts Group B (Secondary Mentor in Group A!)
                // Member 2, 3: Mentees in Group A
                // Member 4, 5: Mentees in Group B
                const leaderA = members[0].member_id;
                const [resA] = await db.query(
                    `INSERT INTO c2s_groups (group_name, leader_id, meeting_day, meeting_time, meeting_location, description, status)
                     VALUES (?, ?, 'Wednesday', '7:00 PM', 'Sanctuary Room 101', 'Faith Foundation and Discipleship Cell Group', 'Active')`,
                    ['C2S Grace & Truth Discipleship', leaderA]
                );
                const groupAId = resA.insertId;

                // Add members to Group A
                // Member 1 (will become leader of group B)
                await db.query(`INSERT INTO c2s_group_members (group_id, member_id, notes, joined_date) VALUES (?, ?, 'Aspiring Cell Leader', CURDATE())`, [groupAId, members[1].member_id]);
                if (members[2]) {
                    await db.query(`INSERT INTO c2s_group_members (group_id, member_id, notes, joined_date) VALUES (?, ?, 'Active Mentee', CURDATE())`, [groupAId, members[2].member_id]);
                }
                if (members[3]) {
                    await db.query(`INSERT INTO c2s_group_members (group_id, member_id, notes, joined_date) VALUES (?, ?, 'Mentee in training', CURDATE())`, [groupAId, members[3].member_id]);
                }

                // Member 1 now leads Group B! (So Member 1 is a Mentor system-wide, and a Secondary Mentor inside Group A!)
                const leaderB = members[1].member_id;
                const [resB] = await db.query(
                    `INSERT INTO c2s_groups (group_name, leader_id, meeting_day, meeting_time, meeting_location, description, status)
                     VALUES (?, ?, 'Friday', '7:30 PM', 'Fellowship Hall - West Wing', 'Youth & Young Professionals C2S Group', 'Active')`,
                    ['C2S Youth Alive Impact', leaderB]
                );
                const groupBId = resB.insertId;

                if (members[4]) {
                    await db.query(`INSERT INTO c2s_group_members (group_id, member_id, notes, joined_date) VALUES (?, ?, 'New Mentee', CURDATE())`, [groupBId, members[4].member_id]);
                }
                if (members[5]) {
                    await db.query(`INSERT INTO c2s_group_members (group_id, member_id, notes, joined_date) VALUES (?, ?, 'New Mentee', CURDATE())`, [groupBId, members[5].member_id]);
                }

                console.log('Sample C2S groups populated with Primary Mentor, Mentees, and Secondary Mentor!');
            }
        }

        console.log('Migration script finished.');
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    }
}

migrate();
