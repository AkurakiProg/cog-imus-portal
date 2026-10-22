const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    console.log('--- Database Schema Import Tool ---');
    console.log(`Target Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
    console.log(`Target Database: ${process.env.DB_NAME || 'church_portal'}`);
    console.log(`SSL Enabled: ${process.env.DB_SSL === 'true' ? 'Yes' : 'No'}`);

    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'church_portal',
        multipleStatements: true
    };

    if (process.env.DB_SSL === 'true') {
        dbConfig.ssl = { rejectUnauthorized: false };
    }

    try {
        console.log('Connecting to database...');
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected successfully!');

        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        console.log(`Reading schema from: ${schemaPath}`);
        const sql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema import (33 tables + seed data)...');
        await connection.query(sql);
        console.log('✓ SUCCESS: Successfully imported all 33 tables and seed data!');
        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error('✗ ERROR: Import failed:', err.message);
        process.exit(1);
    }
}

run();
