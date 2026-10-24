const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const app = require('../server');
const { pool } = require('../config/database');

let server;
let baseUrl;

let adminToken;
let leaderToken;
let memberToken;

async function createAuthTokenForUser(userId, roleName) {
    const sessionToken = uuidv4();
    await pool.execute('UPDATE users SET current_session_token = ?, is_active = 1, is_verified = 1 WHERE user_id = ?', [sessionToken, userId]);
    return jwt.sign(
        { id: userId, sessionToken, role_name: roleName },
        process.env.JWT_SECRET,
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

    const [adminRow] = await pool.query('SELECT user_id FROM users WHERE role_id = 1 LIMIT 1');
    const [leaderRow] = await pool.query('SELECT user_id FROM users WHERE role_id = 2 LIMIT 1');
    const [memberRow] = await pool.query('SELECT user_id FROM users WHERE role_id = 3 LIMIT 1');

    adminToken = await createAuthTokenForUser(adminRow[0]?.user_id || 1, 'Admin');
    leaderToken = await createAuthTokenForUser(leaderRow[0]?.user_id || 46, 'Church Leader');
    memberToken = await createAuthTokenForUser(memberRow[0]?.user_id || 53, 'Church Member');
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
});

test('RBAC Audit Trail: Unauthenticated request to /api/audit returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/audit`);
    assert.equal(res.status, 401);
});

test('RBAC Audit Trail: Member request to /api/audit returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/audit`, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.message, /Forbidden/i);
});

test('RBAC Audit Trail: Leader request to /api/audit returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/audit`, {
        headers: { 'Authorization': `Bearer ${leaderToken}` }
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.message, /Forbidden/i);
});

test('RBAC Audit Trail: Admin request to /api/audit succeeds with 200', async () => {
    const res = await fetch(`${baseUrl}/api/audit`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data.logs));
});

test('RBAC Finance: Member cannot access finance routes (403)', async () => {
    const res = await fetch(`${baseUrl}/api/finance`, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
    });
    assert.equal(res.status, 403);
});

test('RBAC Finance: Leader can view finance transactions (200)', async () => {
    const res = await fetch(`${baseUrl}/api/finance`, {
        headers: { 'Authorization': `Bearer ${leaderToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
});

test('RBAC Finance: Leader CANNOT create finance transaction (403 Admin Only)', async () => {
    const res = await fetch(`${baseUrl}/api/finance`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${leaderToken}`
        },
        body: JSON.stringify({
            category_id: 1,
            amount: 500,
            transaction_type: 'Income',
            description: 'Unauthorized Leader Attempt'
        })
    });
    assert.equal(res.status, 403);
});

test('RBAC System Backup: Admin can access backup data, Member/Leader cannot', async () => {
    const resMember = await fetch(`${baseUrl}/api/system/backup`, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
    });
    assert.equal(resMember.status, 403);

    const resLeader = await fetch(`${baseUrl}/api/system/backup`, {
        headers: { 'Authorization': `Bearer ${leaderToken}` }
    });
    assert.equal(resLeader.status, 403);

    const resAdmin = await fetch(`${baseUrl}/api/system/backup`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(resAdmin.status, 200);
    const backupJson = await resAdmin.json();
    assert.ok(backupJson.metadata, 'Backup should contain metadata');
    assert.ok(backupJson.database, 'Backup should contain database tables');
    assert.equal(backupJson.metadata.total_tables, 33, 'Backup must contain all 33 tables');
});
