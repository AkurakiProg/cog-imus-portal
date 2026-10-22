const { pool } = require('../config/database');

async function run() {
    try {
        // 1. finance_transactions
        try {
            await pool.query(`ALTER TABLE finance_transactions ADD COLUMN department VARCHAR(100) NULL AFTER ministry_id`);
            console.log('Added department to finance_transactions');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('department already exists in finance_transactions');
            } else {
                throw e;
            }
        }

        // 2. events
        try {
            await pool.query(`ALTER TABLE events ADD COLUMN department VARCHAR(100) NULL AFTER ministry_id`);
            console.log('Added department to events');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('department already exists in events');
            } else {
                throw e;
            }
        }

        // 3. announcements
        try {
            await pool.query(`ALTER TABLE announcements ADD COLUMN department VARCHAR(100) NULL AFTER category`);
            console.log('Added department to announcements');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('department already exists in announcements');
            } else {
                throw e;
            }
        }

        try {
            await pool.query(`ALTER TABLE announcements ADD COLUMN ministry_id INT NULL AFTER department`);
            console.log('Added ministry_id to announcements');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ministry_id already exists in announcements');
            } else {
                throw e;
            }
        }

        // Populate existing department fields from ministries where ministry_id is set
        await pool.query(`
            UPDATE finance_transactions ft 
            JOIN ministries m ON ft.ministry_id = m.ministry_id 
            SET ft.department = m.department 
            WHERE ft.department IS NULL
        `);

        await pool.query(`
            UPDATE events e 
            JOIN ministries m ON e.ministry_id = m.ministry_id 
            SET e.department = m.department 
            WHERE e.department IS NULL
        `);

        // Give any existing announcements a default department so they display nicely in tables
        await pool.query(`
            UPDATE announcements 
            SET department = CASE 
                WHEN category = 'Worship' THEN 'Worship'
                WHEN category = 'Youth' THEN 'Relationship'
                WHEN category = 'Event' THEN 'Outreach'
                WHEN category = 'Ministry' THEN 'Discipleship'
                ELSE 'Administration'
            END
            WHERE department IS NULL
        `);

        console.log('Database columns updated and existing records populated successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

run();
