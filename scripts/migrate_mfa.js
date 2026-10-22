const { pool } = require('../config/database');

async function migrateMfa() {
    console.log('[MIGRATION] Starting Multi-Factor Authentication (MFA) database migration...');
    try {
        // 1. Check existing columns in `users` table
        const [existingCols] = await pool.query(
            `SELECT COLUMN_NAME 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
        );
        const colNames = existingCols.map(c => c.COLUMN_NAME);

        const columnsToAdd = [
            { name: 'mfa_enabled', sql: 'ADD COLUMN `mfa_enabled` TINYINT(1) NOT NULL DEFAULT 0' },
            { name: 'mfa_secret', sql: 'ADD COLUMN `mfa_secret` TEXT DEFAULT NULL' },
            { name: 'mfa_temp_secret', sql: 'ADD COLUMN `mfa_temp_secret` TEXT DEFAULT NULL' },
            { name: 'mfa_enrolled_at', sql: 'ADD COLUMN `mfa_enrolled_at` DATETIME DEFAULT NULL' },
            { name: 'mfa_last_timestep', sql: 'ADD COLUMN `mfa_last_timestep` BIGINT DEFAULT NULL' }
        ];

        for (const col of columnsToAdd) {
            if (!colNames.includes(col.name)) {
                console.log(`[MIGRATION] Adding column '${col.name}' to 'users' table...`);
                await pool.query(`ALTER TABLE \`users\` ${col.sql}`);
            } else {
                console.log(`[MIGRATION] Column '${col.name}' already exists in 'users' table.`);
            }
        }

        // 2. Create `user_mfa_recovery_codes` table
        console.log('[MIGRATION] Ensuring `user_mfa_recovery_codes` table exists...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`user_mfa_recovery_codes\` (
                \`code_id\` INT(11) NOT NULL AUTO_INCREMENT,
                \`user_id\` INT(11) NOT NULL,
                \`code_hash\` VARCHAR(255) NOT NULL,
                \`is_used\` TINYINT(1) NOT NULL DEFAULT 0,
                \`used_at\` DATETIME DEFAULT NULL,
                \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (\`code_id\`),
                KEY \`idx_recovery_user\` (\`user_id\`, \`is_used\`),
                CONSTRAINT \`fk_recovery_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`user_id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 3. Create `mfa_login_challenges` table
        console.log('[MIGRATION] Ensuring `mfa_login_challenges` table exists...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`mfa_login_challenges\` (
                \`challenge_id\` VARCHAR(64) NOT NULL,
                \`user_id\` INT(11) NOT NULL,
                \`attempts\` INT(11) NOT NULL DEFAULT 0,
                \`max_attempts\` INT(11) NOT NULL DEFAULT 5,
                \`expires_at\` DATETIME NOT NULL,
                \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (\`challenge_id\`),
                KEY \`idx_challenge_user\` (\`user_id\`),
                KEY \`idx_challenge_expires\` (\`expires_at\`),
                CONSTRAINT \`fk_challenge_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`user_id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('[MIGRATION] Multi-Factor Authentication (MFA) migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('[MIGRATION_ERROR] MFA Migration failed:', error);
        process.exit(1);
    }
}

migrateMfa();
