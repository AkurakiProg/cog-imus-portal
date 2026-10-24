const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const app = require('../server');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-replace-in-production';

let server;
let baseUrl;
let adminToken;
let memberToken;
let originalAdminSessionToken;
let testMemberId;

async function createAuthTokenForUser(userId, roleName) {
    const sessionToken = uuidv4();
    await pool.execute('UPDATE users SET current_session_token = ?, is_active = 1, is_verified = 1 WHERE user_id = ?', [sessionToken, userId]);
    return jwt.sign(
        { id: userId, sessionToken, role_name: roleName },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

test.before(async () => {
    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });

    const [adminRows] = await pool.query('SELECT current_session_token FROM users WHERE user_id = 1');
    if (adminRows.length > 0) {
        originalAdminSessionToken = adminRows[0].current_session_token;
    }

    adminToken = await createAuthTokenForUser(1, 'Admin');

    const [memberRows] = await pool.query('SELECT user_id FROM users WHERE role_id = 3 LIMIT 1');
    if (memberRows.length > 0) {
        testMemberId = memberRows[0].user_id;
    } else {
        const [newMem] = await pool.query(`
            INSERT INTO users (role_id, username, email, password_hash, first_name, last_name, full_name, is_active, is_verified)
            VALUES (3, 'temp_member_test', 'temp_member_test@cogimus.local', 'hash', 'Temp', 'Member', 'Temp Member', 1, 1)
        `);
        testMemberId = newMem.insertId;
    }
    memberToken = await createAuthTokenForUser(testMemberId, 'Church Member');
});

test.after(async () => {
    try {
        if (originalAdminSessionToken !== undefined) {
            await pool.query('UPDATE users SET current_session_token = ? WHERE user_id = 1', [originalAdminSessionToken]);
        }
    } catch (cleanupErr) {
        console.error('Error during cleanup in test.after:', cleanupErr);
    }
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
});

test('Account Deletion: Non-admin request to delete account returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/users/99999`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${memberToken}`
        }
    });
    assert.equal(res.status, 403);
});

test('Account Deletion: Deleting non-existent user returns 404 Not Found', async () => {
    const res = await fetch(`${baseUrl}/api/users/9999999`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${adminToken}`
        }
    });
    assert.equal(res.status, 404);
});

test('Account Deletion: Attempting to delete primary Super Admin (user_id = 1) returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/users/1`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${adminToken}`
        }
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Super Admin account cannot be deleted/i);
});

test('Account Deletion: Attempting to delete self active account returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/users/1`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${adminToken}`
        }
    });
    assert.equal(res.status, 400);
});

test('Account Deletion: Admin successfully deletes user with linked attendance and announcements', async () => {
    // 1. Create a dummy test user
    const [insertUser] = await pool.query(`
        INSERT INTO users (role_id, username, email, password_hash, first_name, last_name, full_name, is_active, is_verified)
        VALUES (2, 'unit_test_delete_user', 'unit_test_delete@cogimus.local', 'hash', 'Test', 'Delete', 'Test Delete Account', 1, 1)
    `);
    const testId = insertUser.insertId;

    // 2. Add linked records
    await pool.query(`
        INSERT INTO ministry_attendance (ministry_id, session_title, session_date, session_type, recorded_by)
        VALUES (10, 'Unit Test Attendance', '2026-10-25', 'Meeting', ?)
    `, [testId]);

    await pool.query(`
        INSERT INTO attendance_tallies (service_date, service_type, adult_count, youth_count, children_count, visitor_count, total_count, recorded_by)
        VALUES ('2026-10-25', 'Sunday Worship', 10, 5, 2, 1, 18, ?)
    `, [testId]);

    await pool.query(`
        INSERT INTO announcements (title, content, created_by)
        VALUES ('Unit Test Ann', 'Testing account deletion', ?)
    `, [testId]);

    await pool.query(`
        INSERT INTO members (user_id, first_name, last_name, church_role, email)
        VALUES (?, 'Test', 'DeleteMember', 'Leader', 'unit_test_member@cogimus.local')
    `, [testId]);

    // 3. Call DELETE /api/users/:id
    const res = await fetch(`${baseUrl}/api/users/${testId}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${adminToken}`
        }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.match(body.message, /deleted successfully/i);

    // 4. Verify user was deleted from users table
    const [checkUser] = await pool.query('SELECT * FROM users WHERE user_id = ?', [testId]);
    assert.equal(checkUser.length, 0, 'User must no longer exist in users table');

    // 5. Verify linked attendance and announcements were preserved under fallback admin (user 1)
    const [checkAtt] = await pool.query('SELECT recorded_by FROM ministry_attendance WHERE session_title = ?', ['Unit Test Attendance']);
    assert.equal(checkAtt.length, 1);
    assert.equal(checkAtt[0].recorded_by, 1, 'Attendance record must be preserved and reassigned to admin');

    const [checkTally] = await pool.query('SELECT recorded_by FROM attendance_tallies WHERE total_count = 18');
    assert.equal(checkTally.length, 1);
    assert.equal(checkTally[0].recorded_by, 1, 'Tally must be preserved and reassigned to admin');

    const [checkAnn] = await pool.query('SELECT created_by FROM announcements WHERE title = ?', ['Unit Test Ann']);
    assert.equal(checkAnn.length, 1);
    assert.equal(checkAnn[0].created_by, 1, 'Announcement must be preserved and reassigned to admin');

    // 6. Verify linked member row had user_id unlinked (set to NULL)
    const [checkMem] = await pool.query('SELECT user_id, first_name FROM members WHERE email = ?', ['unit_test_member@cogimus.local']);
    assert.equal(checkMem.length, 1);
    assert.equal(checkMem[0].user_id, null, 'Member user_id must be unlinked to null');

    // Clean up test rows
    await pool.query('DELETE FROM ministry_attendance WHERE session_title = ?', ['Unit Test Attendance']);
    await pool.query('DELETE FROM attendance_tallies WHERE total_count = 18');
    await pool.query('DELETE FROM announcements WHERE title = ?', ['Unit Test Ann']);
    await pool.query('DELETE FROM members WHERE email = ?', ['unit_test_member@cogimus.local']);
});
