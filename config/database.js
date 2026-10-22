const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'church_portal',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: '+08:00',
    dateStrings: true
};

// Enable SSL when requested (required for cloud MySQL like Aiven / TiDB)
if (process.env.DB_SSL === 'true') {
    dbConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(dbConfig);

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('[DATABASE] MySQL connection established successfully.');
        console.log(`[DATABASE] Connected to: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('[DATABASE] Failed to connect to MySQL database:');
        console.error(`[DATABASE] Error: ${error.message}`);
        console.error('[DATABASE] Please check your .env configuration and ensure MySQL is running.');
        process.exit(1);
    }
}

module.exports = {
    pool,
    testConnection,
    execute: (...args) => pool.execute(...args),
    query: (...args) => pool.query(...args)
};
