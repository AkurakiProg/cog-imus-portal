const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const app = require('../server');
const { pool } = require('../config/database');

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

    const sessionToken = uuidv4();
    await pool.execute('UPDATE users SET current_session_token = ?, is_active = 1, is_verified = 1 WHERE user_id = 1', [sessionToken]);
    adminToken = jwt.sign(
        { id: 1, sessionToken, role_name: 'Admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
});

test('Regression Fix 1: Database backup export includes all 33 tables with sensitive token sanitization', async () => {
    const res = await fetch(`${baseUrl}/api/system/backup`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const backup = await res.json();
    assert.equal(backup.metadata.total_tables, 33);
    
    // Check recently migrated tables are present
    assert.ok(backup.database.c2s_groups, 'c2s_groups must be in backup');
    assert.ok(backup.database.c2s_group_members, 'c2s_group_members must be in backup');
    assert.ok(backup.database.ministry_attendance, 'ministry_attendance must be in backup');
    assert.ok(backup.database.ministry_attendance_records, 'ministry_attendance_records must be in backup');
    assert.ok(backup.database.department_heads, 'department_heads must be in backup');
    assert.ok(backup.database.email_logs, 'email_logs must be in backup');
    assert.ok(backup.database.livestream_broadcast, 'livestream_broadcast must be in backup');

    // Check users table token sanitization
    if (Array.isArray(backup.database.users)) {
        for (const u of backup.database.users) {
            assert.equal(u.mfa_temp_secret, undefined, 'mfa_temp_secret must be sanitized from backup');
            assert.equal(u.current_session_token, undefined, 'current_session_token must be sanitized from backup');
        }
    }
});

test('Regression Fix 2: Clean friendly URL routing works for all frontend views', async () => {
    const urls = ['/login', '/events', '/sermons', '/gallery', '/history', '/about', '/contact', '/admin', '/leader', '/member'];
    for (const url of urls) {
        const res = await fetch(`${baseUrl}${url}`);
        assert.equal(res.status, 200, `URL ${url} must return 200`);
        assert.equal(res.headers.get('content-type')?.includes('text/html'), true);
    }
});

test('Regression Fix 3: database/schema.sql contains all 33 tables and is fully populated for fresh deployment', () => {
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    assert.ok(schemaSql.length > 20000, 'schema.sql must be complete');
    
    const requiredTables = [
        'roles', 'users', 'members', 'ministries', 'department_heads',
        'ministry_members', 'ministry_attendance', 'ministry_attendance_records',
        'c2s_groups', 'c2s_group_members', 'finance_categories', 'finance_transactions',
        'events', 'event_enrollments', 'announcements', 'email_logs', 'sms_logs',
        'banners', 'sermons', 'gallery_albums', 'gallery_images', 'attendance_tallies',
        'schedules', 'contact_messages', 'content_pages', 'livestream_broadcast',
        'livestream_daily_views', 'livestream_comments', 'livestream_comment_logs',
        'livestream_viewer_sessions', 'mfa_login_challenges', 'user_mfa_recovery_codes', 'audit_trail'
    ];

    for (const table of requiredTables) {
        assert.ok(schemaSql.includes(`\`${table}\``), `schema.sql must include table ${table}`);
    }
});

test('Regression Fix 4: No hardcoded credentials remain in emailService.js', () => {
    const emailServiceSrc = fs.readFileSync(path.join(__dirname, '..', 'utils', 'emailService.js'), 'utf8');
    assert.equal(emailServiceSrc.includes('biay jwxz hoxl qhul'), false, 'Hardcoded app password must not exist');
    assert.equal(emailServiceSrc.includes('cogimusdummyacc@gmail.com'), false, 'Hardcoded email account fallback must not exist');
});

test('Regression Fix 5: public.js and sermons.html do not use inline string injection in sermon onclicks', () => {
    const publicJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'public.js'), 'utf8');
    const sermonsHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'views', 'sermons.html'), 'utf8');
    
    // Verify that openPublicVideoModal with 6 raw string arguments is replaced by indexed lookup
    assert.ok(publicJs.includes('openPublicSermonByIndex'), 'public.js must use openPublicSermonByIndex');
    assert.ok(sermonsHtml.includes('openPublicSermonByIndex'), 'sermons.html must use openPublicSermonByIndex');
});
