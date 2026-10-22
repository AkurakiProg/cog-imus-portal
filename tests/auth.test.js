const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server');
const { pool } = require('../config/database');
const { decryptSecret } = require('../utils/cryptoHelper');
const { generateSync } = require('otplib');

let server;
let baseUrl;
let adminToken;
let adminUser;
let mfaChallengeToken;

test.before(async () => {
    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
});

test('Auth: Missing identifier or password returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: '', password: '' })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /Please provide both/i);
});

test('Auth: Incorrect password returns 401 Invalid credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'admin', password: 'wrongpassword123' })
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /Invalid credentials/i);
});

test('Auth: Non-existent user returns 401 Invalid credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'non_existent_user_99999', password: 'password123' })
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /Invalid credentials/i);
});

test('Auth & MFA: Valid admin login triggers 2FA challenge when MFA is enabled', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'admin', password: 'admin123' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.data.mfaRequired, true, 'Admin account has 2FA enabled, mfaRequired must be true');
    assert.ok(data.data.mfaChallengeToken, 'MFA challenge token must be returned');
    assert.equal(data.data.username, 'admin');

    mfaChallengeToken = data.data.mfaChallengeToken;
});

test('Auth & MFA: MFA verification rejects invalid 6-digit TOTP code', async () => {
    assert.ok(mfaChallengeToken, 'mfaChallengeToken required');
    const res = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaChallengeToken, token: '000000' })
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /Invalid verification code/i);
});

test('Auth & MFA: Valid TOTP code completes 2FA login and returns authenticated JWT', async () => {
    assert.ok(mfaChallengeToken, 'mfaChallengeToken required');
    
    // Clear last timestep to allow clean test execution without replay collision
    await pool.query('UPDATE users SET mfa_last_timestep = NULL WHERE user_id = 1');

    // Fetch and decrypt admin MFA secret to generate valid current TOTP code
    const [rows] = await pool.query('SELECT mfa_secret FROM users WHERE user_id = 1');
    const secret = decryptSecret(rows[0].mfa_secret);
    const currentTotp = generateSync({ secret });

    const res = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaChallengeToken, token: currentTotp })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data.token, 'JWT session token must be returned upon successful MFA');
    assert.equal(data.data.user.username, 'admin');
    assert.equal(data.data.user.role_name, 'Admin');

    // Security check: password_hash and mfa secrets must NEVER be present
    assert.equal(data.data.user.password_hash, undefined);
    assert.equal(data.data.user.mfa_secret, undefined);

    adminToken = data.data.token;
    adminUser = data.data.user;
});

test('Auth: Session watchdog /api/auth/check-session validates active token', async () => {
    assert.ok(adminToken, 'Admin token required from previous test');
    const res = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.data.active, true);
    assert.equal(data.data.user.id, adminUser.user_id);
});

test('Auth: Session watchdog rejects missing or forged tokens', async () => {
    const resNoToken = await fetch(`${baseUrl}/api/auth/check-session`);
    assert.equal(resNoToken.status, 401);

    const resForged = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bogus.token' }
    });
    assert.equal(resForged.status, 401);
});

test('Auth: GET /api/auth/me returns current authenticated user profile', async () => {
    assert.ok(adminToken, 'Admin token required');
    const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.data.username, 'admin');
    assert.equal(data.data.password_hash, undefined, 'password_hash must never be exposed');
});
