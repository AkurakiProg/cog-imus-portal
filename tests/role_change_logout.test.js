const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const app = require('../server');
const { pool } = require('../config/database');
const JWT_SECRET = process.env.JWT_SECRET;

let server;
let baseUrl;
let adminToken;

test.before(async () => {
    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });

    const adminSessionToken = uuidv4();
    await pool.query('UPDATE users SET current_session_token = ? WHERE user_id = 1', [adminSessionToken]);
    adminToken = jwt.sign(
        { id: 1, user_id: 1, username: 'admin', role_id: 1, role_name: 'Super Admin', sessionToken: adminSessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
});

test.after(async () => {
    // Restore user 4's role back to 3 (Member)
    await pool.query('UPDATE users SET role_id = 3 WHERE user_id = 4');
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
});

test('Role Change Auto-Logout: Normal user details update keeps active session', async () => {
    const memberSessionToken = uuidv4();
    await pool.query('UPDATE users SET current_session_token = ?, role_id = 3 WHERE user_id = 4', [memberSessionToken]);
    const memberToken = jwt.sign(
        { id: 4, user_id: 4, username: 'Akuraki', role_id: 3, role_name: 'Church Member', sessionToken: memberSessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Initial check: member is logged in
    const check1 = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(check1.status, 200);

    // Admin updates non-role info (e.g. keeping role_id = 3)
    const updateRes = await fetch(`${baseUrl}/api/users/4`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: 'Akuraki',
            email: 'jairoandreicardel54@gmail.com',
            role_id: 3,
            is_active: 1
        })
    });
    if (updateRes.status !== 200) {
        console.error('Update failed:', updateRes.status, await updateRes.text());
    }
    assert.equal(updateRes.status, 200);

    // Session token in DB must NOT be NULL
    const [rows] = await pool.query('SELECT current_session_token FROM users WHERE user_id = 4');
    assert.equal(rows[0].current_session_token, memberSessionToken);

    // Member session remains valid
    const check2 = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(check2.status, 200);
});

test('Role Change Auto-Logout: Changing role from Member to Leader automatically terminates active session', async () => {
    const memberSessionToken = uuidv4();
    await pool.query('UPDATE users SET current_session_token = ?, role_id = 3 WHERE user_id = 4', [memberSessionToken]);
    const memberToken = jwt.sign(
        { id: 4, user_id: 4, username: 'Akuraki', role_id: 3, role_name: 'Church Member', sessionToken: memberSessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Ensure session is active before role change
    const checkBefore = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(checkBefore.status, 200);

    // Admin updates user 4 role from Member (3) to Leader (2)
    const updateRes = await fetch(`${baseUrl}/api/users/4`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: 'Akuraki',
            email: 'jairoandreicardel54@gmail.com',
            role_id: 2, // Changed to Leader
            is_active: 1
        })
    });
    assert.equal(updateRes.status, 200);

    // Verify current_session_token in DB was cleared immediately
    const [rows] = await pool.query('SELECT current_session_token, role_id FROM users WHERE user_id = 4');
    assert.equal(rows[0].role_id, 2);
    assert.equal(rows[0].current_session_token, null);

    // The member token must now be rejected with 401
    const checkAfter = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert.equal(checkAfter.status, 401);
    const data = await checkAfter.json();
    assert.equal(data.success, false);
    assert.match(data.message, /role has been updated|terminated/i);
});

test('Role Change Auto-Logout: Changing member church_role via member update automatically terminates active session', async () => {
    // Set user 4 back to Leader (role_id 2, church_role 'Leader')
    const leaderSessionToken = uuidv4();
    await pool.query('UPDATE users SET current_session_token = ?, role_id = 2 WHERE user_id = 4', [leaderSessionToken]);
    await pool.query('UPDATE members SET church_role = ? WHERE member_id = ?', ['Leader', 4]);

    const leaderToken = jwt.sign(
        { id: 4, user_id: 4, username: 'Akuraki', role_id: 2, role_name: 'Church Leader', sessionToken: leaderSessionToken },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Verify session active
    const checkBefore = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${leaderToken}` }
    });
    assert.equal(checkBefore.status, 200);

    // Update member record to demote back to Member
    const updateRes = await fetch(`${baseUrl}/api/members/4`, {
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
    const [rows] = await pool.query('SELECT current_session_token, role_id FROM users WHERE user_id = 4');
    assert.equal(rows[0].role_id, 3);
    assert.equal(rows[0].current_session_token, null);

    // The leader token must now be rejected with 401
    const checkAfter = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${leaderToken}` }
    });
    assert.equal(checkAfter.status, 401);
    const data = await checkAfter.json();
    assert.equal(data.success, false);
    assert.match(data.message, /role has been updated|terminated/i);
});
