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

test('Health Check: GET /api/health returns healthy JSON status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.status, 'healthy');
    assert.equal(data.version, '1.0.0');
});

test('Clean Page Routes: Root URL GET / returns 200 and index.html', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<!DOCTYPE html>/i);
    assert.match(html, /COGWM Imus/i);
});

test('Clean Page Routes: Friendly URLs resolve to correct HTML views', async () => {
    const routesToTest = [
        { path: '/login', expectedTitleSnippet: /Sign In|Portal Login/i },
        { path: '/events', expectedTitleSnippet: /Events/i },
        { path: '/sermons', expectedTitleSnippet: /Sermon/i },
        { path: '/gallery', expectedTitleSnippet: /Gallery/i },
        { path: '/history', expectedTitleSnippet: /About|History/i },
        { path: '/about', expectedTitleSnippet: /About|History/i },
        { path: '/contact', expectedTitleSnippet: /Contact/i },
        { path: '/admin-dashboard', expectedTitleSnippet: /Admin/i },
        { path: '/leader-dashboard', expectedTitleSnippet: /Leader/i },
        { path: '/member-dashboard', expectedTitleSnippet: /Member/i }
    ];

    for (const r of routesToTest) {
        const res = await fetch(`${baseUrl}${r.path}`);
        assert.equal(res.status, 200, `Path ${r.path} should return HTTP 200`);
        const html = await res.text();
        assert.match(html, /<!DOCTYPE html>/i, `Path ${r.path} should return valid HTML`);
        assert.match(html, r.expectedTitleSnippet, `Path ${r.path} should contain expected snippet`);
    }
});

test('Error Handling: Non-existent API route returns 404 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/non_existent_endpoint_xyz`);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.status, 404);
    assert.match(data.message, /Not Found/);
});

test('Error Handling: Non-existent page request returns 404 status', async () => {
    const res = await fetch(`${baseUrl}/completely_unknown_page_404_url`);
    assert.equal(res.status, 404);
});
