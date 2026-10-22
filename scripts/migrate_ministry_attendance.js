const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runMigration() {
    console.log('--- STARTING MINISTRY ATTENDANCE MIGRATION ---');
    try {
        const sqlPath = path.join(__dirname, '..', 'database', 'migrations', 'add_ministry_attendance.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split queries by semicolon
        const queries = sql
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0);

        for (const query of queries) {
            await pool.execute(query);
        }
        console.log('✓ Migration tables created successfully.');

        // Ensure leader member is also in ministry_members as Leader if not present
        // 1. Ministry 5 (Musicians - Leader: Cedric Nabong member_id 5)
        await pool.execute(`
            INSERT INTO ministry_members (ministry_id, member_id, role_in_ministry, joined_date, status)
            VALUES (5, 5, 'Leader', '2026-08-01', 'Active')
            ON DUPLICATE KEY UPDATE role_in_ministry = 'Leader', status = 'Active'
        `);

        // Add member_id 16 to Ministry 5 as Member
        await pool.execute(`
            INSERT INTO ministry_members (ministry_id, member_id, role_in_ministry, joined_date, status)
            VALUES (5, 16, 'Member', '2026-09-01', 'Active')
            ON DUPLICATE KEY UPDATE status = 'Active'
        `);

        // 2. Ministry 10 (Children - Leader: Jairo Andrei Cardel member_id 4)
        await pool.execute(`
            INSERT INTO ministry_members (ministry_id, member_id, role_in_ministry, joined_date, status)
            VALUES (10, 4, 'Leader', '2026-08-01', 'Active')
            ON DUPLICATE KEY UPDATE role_in_ministry = 'Leader', status = 'Active'
        `);

        // Add member_id 14 to Ministry 10 as Assistant Leader / Teacher
        await pool.execute(`
            INSERT INTO ministry_members (ministry_id, member_id, role_in_ministry, joined_date, status)
            VALUES (10, 14, 'Assistant Leader', '2026-08-15', 'Active')
            ON DUPLICATE KEY UPDATE status = 'Active'
        `);

        // Add member_id 16 to Ministry 10 as Teacher / Member too
        await pool.execute(`
            INSERT INTO ministry_members (ministry_id, member_id, role_in_ministry, joined_date, status)
            VALUES (10, 16, 'Member', '2026-09-10', 'Active')
            ON DUPLICATE KEY UPDATE status = 'Active'
        `);

        // Check if attendance sessions already exist for Ministry 5
        const [existing5] = await pool.execute('SELECT COUNT(*) as cnt FROM ministry_attendance WHERE ministry_id = 5');
        if (existing5[0].cnt === 0) {
            console.log('Seeding initial attendance sessions for Ministry 5 (Musicians)...');
            const sessions5 = [
                { title: 'Sunday Worship Rehearsal', date: '2026-09-27', type: 'Rehearsal', notes: 'Soundcheck and praise lineup practice' },
                { title: 'Midweek Team Fellowship', date: '2026-10-04', type: 'Meeting', notes: 'Devotion and music ministry planning' },
                { title: 'Sunday Service Music Duty', date: '2026-10-11', type: 'Service Duty', notes: 'Main sanctuary worship service' },
                { title: 'Vocals & Band Tech Rehearsal', date: '2026-10-17', type: 'Rehearsal', notes: 'Acoustic and monitor setup' }
            ];

            for (const s of sessions5) {
                const [res] = await pool.execute(
                    `INSERT INTO ministry_attendance (ministry_id, session_title, session_date, session_type, recorded_by, notes)
                     VALUES (5, ?, ?, ?, 5, ?)`,
                    [s.title, s.date, s.type, s.notes]
                );
                const attId = res.insertId;

                // Records for member 5 (Leader) and member 16
                await pool.execute(
                    `INSERT INTO ministry_attendance_records (attendance_id, member_id, status, notes)
                     VALUES (?, 5, 'Present', 'On time'), (?, 16, 'Present', 'On time')`,
                    [attId, attId]
                );
            }
        }

        // Check if attendance sessions already exist for Ministry 10
        const [existing10] = await pool.execute('SELECT COUNT(*) as cnt FROM ministry_attendance WHERE ministry_id = 10');
        if (existing10[0].cnt === 0) {
            console.log('Seeding initial attendance sessions for Ministry 10 (Children)...');
            const sessions10 = [
                { title: 'Sunday School Teachers Prep', date: '2026-09-27', type: 'Training', notes: 'Curriculum review for Sunday classes' },
                { title: 'Children Ministry Sunday Service', date: '2026-10-04', type: 'Service Duty', notes: 'Kids church classes and worship' },
                { title: 'Department Coordination Meeting', date: '2026-10-11', type: 'Meeting', notes: 'Relationship department updates' },
                { title: 'Kids Church Activity & Craft Prep', date: '2026-10-18', type: 'Rehearsal', notes: 'Lesson materials and song practice' }
            ];

            for (let i = 0; i < sessions10.length; i++) {
                const s = sessions10[i];
                const [res] = await pool.execute(
                    `INSERT INTO ministry_attendance (ministry_id, session_title, session_date, session_type, recorded_by, notes)
                     VALUES (10, ?, ?, ?, 4, ?)`,
                    [s.title, s.date, s.type, s.notes]
                );
                const attId = res.insertId;

                // Leader Jairo (member_id 4) Present
                await pool.execute(
                    `INSERT INTO ministry_attendance_records (attendance_id, member_id, status, notes)
                     VALUES (?, 4, 'Present', 'Led session')`,
                    [attId]
                );

                // Member 14 (Jaren)
                const status14 = i === 1 ? 'Late' : 'Present';
                await pool.execute(
                    `INSERT INTO ministry_attendance_records (attendance_id, member_id, status, notes)
                     VALUES (?, 14, ?, ?)`,
                    [attId, status14, i === 1 ? 'Arrived at 9:15 AM' : 'On time']
                );

                // Member 16 (Test Cardel)
                const status16 = i === 2 ? 'Excused' : 'Present';
                await pool.execute(
                    `INSERT INTO ministry_attendance_records (attendance_id, member_id, status, notes)
                     VALUES (?, 16, ?, ?)`,
                    [attId, status16, i === 2 ? 'School exams' : 'On time']
                );
            }
        }

        console.log('✓ Initial attendance sessions and roster records seeded successfully!');
        process.exit(0);

    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
