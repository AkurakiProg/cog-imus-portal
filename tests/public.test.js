const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server');
const { pool } = require('../config/database');

let server;
let baseUrl;

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

test('Public API: GET /api/public/banners returns active banners', async () => {
    const res = await fetch(`${baseUrl}/api/public/banners`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
});

test('Public API: GET /api/public/sermons returns published sermons', async () => {
    const res = await fetch(`${baseUrl}/api/public/sermons?limit=10`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    for (const sermon of data.data) {
        assert.equal(sermon.is_published, 1, 'Only published sermons should be returned');
    }
});

test('Public API: GET /api/public/livestream returns broadcast status without stream_key', async () => {
    const res = await fetch(`${baseUrl}/api/public/livestream`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    if (data.data) {
        // Critical security test: stream_key must NEVER be exposed publicly
        assert.equal(data.data.stream_key, undefined, 'stream_key must not be exposed on public route');
        assert.ok('is_live' in data.data);
    }
});

test('Public API: GET /api/public/events returns upcoming/ongoing public events', async () => {
    const res = await fetch(`${baseUrl}/api/public/events`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    for (const event of data.data) {
        assert.equal(event.is_public, 1, 'Only public events must be returned');
    }
});

test('Public API: GET /api/public/gallery returns published albums', async () => {
    const res = await fetch(`${baseUrl}/api/public/gallery`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
});

test('Public API: POST /api/public/contact validates required fields and email', async () => {
    // Missing fields
    const resEmpty = await fetch(`${baseUrl}/api/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', email: '', message: '' })
    });
    assert.equal(resEmpty.status, 400);

    // Invalid email format
    const resBadEmail = await fetch(`${baseUrl}/api/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Visitor', email: 'not-an-email', message: 'Hello church!' })
    });
    assert.equal(resBadEmail.status, 400);

    // Valid submission
    const resValid = await fetch(`${baseUrl}/api/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Unit Test Visitor',
            email: 'visitor@example.com',
            contact_number: '09171234567',
            subject: 'Worship Service Inquiry',
            message: 'Hello, what time is the Sunday youth service?'
        })
    });
    assert.equal(resValid.status, 201);
    const validData = await resValid.json();
    assert.equal(validData.success, true);
    assert.ok(validData.data.id || validData.data.message_id);

    // Clean up the created test contact message
    const msgId = validData.data.id || validData.data.message_id;
    await pool.execute('DELETE FROM contact_messages WHERE message_id = ?', [msgId]);
});
