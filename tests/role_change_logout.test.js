const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const app = require('../server');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-replace-in-production';

let server;
let baseUrl;
let adminToken;
let originalAdminSessionToken;
let originalUser;
let testUserId;
let testUsername;
let testMemberId;

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

    // Find or create test non-admin user
    let [uRows] = await pool.query("SELECT user_id, username, email, password_hash, first_name, last_name, role_id, current_session_token FROM users WHERE user_id != 1 AND role_id IN (2, 3) LIMIT 1");
    if (uRows.length > 0) {
        testUserId = uRows[0].user_id;
        testUsername = uRows[0].username;
        originalUser = uRows[0];
    } else {
        const [ins] = await pool.query(`
            INSERT INTO users (role_id, username, email, password_hash, first_name, last_name, full_name, is_active, is_verified)
            VALUES (3, 'test_role_change_u', 'test_role_change@cogimus.local', '$2b$10$wrO8AhAQsLltZIHR/VWWc.Ut7y3byhTHTtFPcAbLTWAMhBoTXA1r.', 'Test', 'User', 'Test User', 1, 1)
        `);
        testUserId = ins.insertId;
        testUsername = 'test_role_change_u';
        const [recheck] = await pool.query('SELECT user_id, username, email, password_hash, first_name, last_name, role_id, current_session_token FROM users WHERE user_id = ?', [testUserId]);
        originalUser = recheck[0];
    }

    // Ensure member row exists for testUserId
    let [mRows] = await pool.query('SELECT member_id FROM members WHERE user_id = ?', [testUserId]);
    if (mRows.length > 0) {
        testMemberId = mRows[0].member_id;
    } else {
        const [insMem] = await pool.query(`
            INSERT INTO members (user_id, first_name, last_name, church_role, email, status)
            VALUES (?, 'Test', 'User', 'Member', 'test_role_member@cogimus.local', 'Active')
        `, [testUserId]);
        testMemberId = insMem.insertId;
    }

    const adminSessionToken = uuidv4();
    await pool.query('UPDATE users SET current_session_token = ? WHERE user_id = 1', [adminSessionToken]);
    adminToken = jwt.sign(
        { id: 1, user_id: 1, username: 'admin', role_id: 1, role_name: 'Super Admin', sessionToken: adminSessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
});

test.after(async () => {
    try {
        if (originalAdminSessionToken !== undefined) {
            await pool.query('UPDATE users SET current_session_token = ? WHERE user_id = 1', [originalAdminSessionToken]);
        }
        if (originalUser) {
            await pool.query(
                'UPDATE users SET username = ?, email = ?, password_hash = ?, first_name = ?, last_name = ?, role_id = ?, current_session_token = ? WHERE user_id = ?',
                [originalUser.username, originalUser.email, originalUser.password_hash, originalUser.first_name, originalUser.last_name, originalUser.role_id, originalUser.current_session_token, testUserId]
            );
            await pool.query(
                'UPDATE members SET first_name = ?, last_name = ?, church_role = ?, email = ? WHERE user_id = ?',
                [originalUser.first_name, originalUser.last_name, 'Member', originalUser.email, testUserId]
            );
        }
    } catch (cleanupErr) {
        console.error('Error during cleanup in test.after:', cleanupErr);
    }
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
});

test('Role Change Auto-Logout: Normal user details update keeps active session', async () => {
    const memberSessionToken = uuidv4();
    await pool.query('UPDATE users SET current_session_token = ?, role_id = 3 WHERE user_id = ?', [memberSessionToken, testUserId]);
    const memberToken = jwt.sign(
        { id: testUserId, user_id: testUserId, username: testUsername, role_id: 3, role_name: 'Church Member', sessionToken: memberSessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Verify session active
    const check1 = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(check1.status, 200);

    // Admin updates non-role info (e.g. keeping role_id = 3)
    const updateRes = await fetch(`${baseUrl}/api/users/${testUserId}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            role_id: 3,
            first_name: originalUser.first_name,
            last_name: originalUser.last_name,
            email: originalUser.email,
            is_active: 1
        })
    });
    assert.equal(updateRes.status, 200);

    // Session token in DB must NOT be NULL
    const [rows] = await pool.query('SELECT current_session_token FROM users WHERE user_id = ?', [testUserId]);
    assert.equal(rows[0].current_session_token, memberSessionToken);

    // Old token must STILL be valid
    const check2 = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(check2.status, 200);
});

test('Role Change Auto-Logout: Changing role from Member to Leader automatically terminates active session', async () => {
    const memberSessionToken = uuidv4();
    await pool.query('UPDATE users SET current_session_token = ?, role_id = 3 WHERE user_id = ?', [memberSessionToken, testUserId]);
    const memberToken = jwt.sign(
        { id: testUserId, user_id: testUserId, username: testUsername, role_id: 3, role_name: 'Church Member', sessionToken: memberSessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Verify session active
    const checkBefore = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(checkBefore.status, 200);

    // Admin updates user role from Member (3) to Leader (2)
    const updateRes = await fetch(`${baseUrl}/api/users/${testUserId}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            role_id: 2,
            first_name: originalUser.first_name,
            last_name: originalUser.last_name,
            email: originalUser.email,
            is_active: 1
        })
    });
    assert.equal(updateRes.status, 200);

    // Verify current_session_token in DB was cleared immediately
    const [rows] = await pool.query('SELECT current_session_token, role_id FROM users WHERE user_id = ?', [testUserId]);
    assert.equal(rows[0].role_id, 2);
    assert.equal(rows[0].current_session_token, null);

    // Old token must now be rejected with 401
    const checkAfter = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(checkAfter.status, 401);
    const data = await checkAfter.json();
    assert.match(data.message, /role has been updated|terminated/i);
});

test('Role Change Auto-Logout: Changing member church_role via member update automatically terminates active session', async () => {
    // Set user back to Leader (role_id 2, church_role 'Leader')
    const leaderSessionToken = uuidv4();
    await pool.query('UPDATE users SET current_session_token = ?, role_id = 2 WHERE user_id = ?', [leaderSessionToken, testUserId]);
    await pool.query('UPDATE members SET church_role = ? WHERE member_id = ?', ['Leader', testMemberId]);

    const leaderToken = jwt.sign(
        { id: testUserId, user_id: testUserId, username: testUsername, role_id: 2, role_name: 'Church Leader', sessionToken: leaderSessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Verify session active
    const checkBefore = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${leaderToken}` }
    });
    assert.equal(checkBefore.status, 200);

    // Update member record to demote back to Member
    const updateRes = await fetch(`${baseUrl}/api/members/${testMemberId}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            church_role: 'Member',
            status: 'Active'
        })
    });
    assert.equal(updateRes.status, 200);

    // Verify current_session_token in DB was cleared
    const [rows] = await pool.query('SELECT current_session_token, role_id FROM users WHERE user_id = ?', [testUserId]);
    assert.equal(rows[0].role_id, 3);
    assert.equal(rows[0].current_session_token, null);

    // Old token must now be rejected with 401
    const checkAfter = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${leaderToken}` }
    });
    assert.equal(checkAfter.status, 401);
    const data = await checkAfter.json();
    assert.match(data.message, /role has been updated|terminated/i);
});

test('Password Change Auto-Logout: Changing user password via user account update terminates active session', async () => {
    const memberSessionToken = uuidv4();
    await pool.query('UPDATE users SET current_session_token = ?, role_id = 3 WHERE user_id = ?', [memberSessionToken, testUserId]);
    const memberToken = jwt.sign(
        { id: testUserId, user_id: testUserId, username: testUsername, role_id: 3, role_name: 'Church Member', sessionToken: memberSessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Verify session active
    const checkBefore = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(checkBefore.status, 200);

    // Admin updates password (6 to 16 characters)
    const updateRes = await fetch(`${baseUrl}/api/users/${testUserId}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            password: 'AdminPass99!',
            first_name: originalUser.first_name,
            last_name: originalUser.last_name,
            email: originalUser.email,
            is_active: 1
        })
    });
    assert.equal(updateRes.status, 200);

    // Verify current_session_token in DB was cleared
    const [rows] = await pool.query('SELECT current_session_token FROM users WHERE user_id = ?', [testUserId]);
    assert.equal(rows[0].current_session_token, null);

    // Old token must now be rejected with 401
    const checkAfter = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(checkAfter.status, 401);
    const data = await checkAfter.json();
    assert.match(data.message, /password was updated|terminated/i);
});

test('Password Change Auto-Logout: User updating their own password terminates active session', async () => {
    const memberSessionToken = uuidv4();
    const currentPass = 'CurrentPass1!';
    const currentHash = await bcrypt.hash(currentPass, 10);
    await pool.query('UPDATE users SET current_session_token = ?, password_hash = ?, role_id = 3 WHERE user_id = ?', [memberSessionToken, currentHash, testUserId]);
    
    const memberToken = jwt.sign(
        { id: testUserId, user_id: testUserId, username: testUsername, role_id: 3, role_name: 'Church Member', sessionToken: memberSessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Verify session active
    const checkBefore = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(checkBefore.status, 200);

    // User updates their own password via /api/auth/update-password
    const updateRes = await fetch(`${baseUrl}/api/auth/update-password`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${memberToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            currentPassword: currentPass,
            newPassword: 'BrandNewPass1!'
        })
    });
    assert.equal(updateRes.status, 200);

    // Verify current_session_token in DB was cleared
    const [rows] = await pool.query('SELECT current_session_token FROM users WHERE user_id = ?', [testUserId]);
    assert.equal(rows[0].current_session_token, null);

    // Old token must now be rejected with 401
    const checkAfter = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(checkAfter.status, 401);
    const data = await checkAfter.json();
    assert.match(data.message, /password was updated|terminated/i);
});

test('Changes Persistence: When account role, password, and member details are updated causing force logout, all submitted data is committed and saved in the database before termination', async () => {
    const sessionToken = uuidv4();
    await pool.query('UPDATE users SET current_session_token = ?, role_id = 3 WHERE user_id = ?', [sessionToken, testUserId]);
    const memberToken = jwt.sign(
        { id: testUserId, user_id: testUserId, username: testUsername, role_id: 3, role_name: 'Church Member', sessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Update role (Member -> Leader), password, and member details simultaneously
    const newSecretPassword = 'SecurePass99!';
    const updateRes = await fetch(`${baseUrl}/api/users/${testUserId}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            role_id: 2,
            role_name: 'Church Leader',
            password: newSecretPassword,
            first_name: 'JairoSaved',
            last_name: 'CardelSaved',
            email: 'akuraki.saved@cogimus.local',
            church_role: 'Leader',
            status: 'Active',
            is_active: 1
        })
    });
    assert.equal(updateRes.status, 200);

    // 1. Verify user changes were committed to MySQL
    const [userRows] = await pool.query('SELECT user_id, role_id, email, password_hash, current_session_token FROM users WHERE user_id = ?', [testUserId]);
    assert.equal(userRows.length, 1);
    assert.equal(userRows[0].role_id, 2);
    assert.equal(userRows[0].email, 'akuraki.saved@cogimus.local');
    assert.equal(userRows[0].current_session_token, null);

    const passwordMatch = await bcrypt.compare(newSecretPassword, userRows[0].password_hash);
    assert.equal(passwordMatch, true, 'New password hash must match the submitted password');

    // 2. Verify synchronized member record was committed to MySQL
    const [memberRows] = await pool.query('SELECT member_id, first_name, last_name, church_role, email FROM members WHERE user_id = ?', [testUserId]);
    assert.equal(memberRows.length, 1);
    assert.equal(memberRows[0].church_role, 'Leader');
    assert.equal(memberRows[0].first_name, 'JairoSaved');
    assert.equal(memberRows[0].last_name, 'CardelSaved');
    assert.equal(memberRows[0].email, 'akuraki.saved@cogimus.local');

    // 3. Verify session was terminated
    const checkSession = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(checkSession.status, 401);
});
