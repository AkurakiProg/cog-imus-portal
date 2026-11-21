const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = require('../server');
const { pool } = require('../config/database');
const { ACCOUNT_SWITCHED_MESSAGE } = require('../utils/browserSessionManager');

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-replace-in-production';
const VALID_PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
const VALID_JPEG_BYTES = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');

let server;
let baseUrl;
let adminToken;
let originalAdminSessionToken;

const createdUserIds = [];
const createdMemberIds = [];
const createdMinistryIds = [];
const createdAnnouncementIds = [];
const createdUploadFiles = [];

function trackUploadPath(relPath) {
    if (!relPath) return;
    const abs = path.join(__dirname, '..', relPath.replace(/^\/+/, ''));
    createdUploadFiles.push(abs);
}

async function createTestUser({ roleId, churchRole, prefix }) {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const username = `${prefix}_${uniq}`;
    const email = `${username}@cogimus.test`;
    const password = 'TestPassword123!';
    const passwordHash = await bcrypt.hash(password, 10);
    const fullName = `Test ${prefix} ${uniq}`;

    const [uRes] = await pool.execute(
        `INSERT INTO users (role_id, username, email, password_hash, first_name, last_name, full_name, is_active, is_verified, mfa_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0)`,
        [roleId, username, email, passwordHash, 'Test', prefix, fullName]
    );
    const userId = uRes.insertId;
    createdUserIds.push(userId);

    const [mRes] = await pool.execute(
        `INSERT INTO members (user_id, first_name, last_name, church_role, email, status)
         VALUES (?, ?, ?, ?, ?, 'Active')`,
        [userId, 'Test', `${prefix}_${uniq}`, churchRole, email]
    );
    const memberId = mRes.insertId;
    createdMemberIds.push(memberId);

    return { userId, memberId, username, email, password, roleId };
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
    const adminSession = uuidv4();
    await pool.execute('UPDATE users SET current_session_token = ?, is_active = 1, is_verified = 1 WHERE user_id = 1', [adminSession]);
    adminToken = jwt.sign(
        { id: 1, role_id: 1, role_name: 'Admin', username: 'admin', sessionToken: adminSession },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
});

test.after(async () => {
    try {
        if (originalAdminSessionToken !== undefined) {
            await pool.query('UPDATE users SET current_session_token = ? WHERE user_id = 1', [originalAdminSessionToken]);
        }
        for (const annId of createdAnnouncementIds) {
            await pool.execute('DELETE FROM announcements WHERE announcement_id = ?', [annId]).catch(() => {});
        }
        for (const minId of createdMinistryIds) {
            await pool.execute('DELETE FROM ministries WHERE ministry_id = ?', [minId]).catch(() => {});
        }
        for (const memId of createdMemberIds) {
            await pool.execute('DELETE FROM ministry_members WHERE member_id = ?', [memId]).catch(() => {});
            await pool.execute('DELETE FROM members WHERE member_id = ?', [memId]).catch(() => {});
        }
        for (const uid of createdUserIds) {
            await pool.execute('DELETE FROM audit_trail WHERE user_id = ?', [uid]).catch(() => {});
            await pool.execute('DELETE FROM users WHERE user_id = ?', [uid]).catch(() => {});
        }
        for (const absPath of createdUploadFiles) {
            if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        }
    } finally {
        await new Promise((resolve) => server.close(resolve));
        await pool.end();
    }
});

// =========================================================================
// 5.A — LEADER MINISTRY ASSIGNMENT SYNCHRONIZATION
// =========================================================================

test('5.A Ministry Sync: Assigning leader as Member or custom role reflects immediately in Leader Dashboard WORDA Ministries', async () => {
    const leaderA = await createTestUser({ roleId: 2, churchRole: 'Leader', prefix: 'leader_sync_a' });
    const leaderB = await createTestUser({ roleId: 2, churchRole: 'Leader', prefix: 'leader_sync_b' });

    // Login Leader A & Leader B
    const loginARes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Browser-Context': 'ctx_min_sync_a' },
        body: JSON.stringify({ identifier: leaderA.username, password: leaderA.password })
    });
    assert.equal(loginARes.status, 200);
    const tokenA = (await loginARes.json()).data.token;

    const loginBRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Browser-Context': 'ctx_min_sync_b' },
        body: JSON.stringify({ identifier: leaderB.username, password: leaderB.password })
    });
    assert.equal(loginBRes.status, 200);
    const tokenB = (await loginBRes.json()).data.token;

    // Create two ministries (Discipleship + Worship)
    const code1 = `TESTD${Date.now().toString().slice(-5)}`;
    const minRes1 = await fetch(`${baseUrl}/api/ministries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
            ministry_name: 'Test Discipleship Ministry',
            ministry_code: code1,
            department: 'Discipleship',
            description: 'Test ministry for leader assignment sync'
        })
    });
    assert.equal(minRes1.status, 201);
    const min1 = (await minRes1.json()).data;
    createdMinistryIds.push(min1.ministry_id);

    const code2 = `TESTW${Date.now().toString().slice(-5)}`;
    const minRes2 = await fetch(`${baseUrl}/api/ministries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
            ministry_name: 'Test Worship Ministry',
            ministry_code: code2,
            department: 'Worship',
            leader_member_id: leaderA.memberId,
            description: 'Test ministry where Leader A is designated ministry head on creation'
        })
    });
    assert.equal(minRes2.status, 201);
    const min2 = (await minRes2.json()).data;
    createdMinistryIds.push(min2.ministry_id);

    // 1. Assign Leader A to Discipleship Ministry using default 'Member' role (the prior broken case)
    const assignRes1 = await fetch(`${baseUrl}/api/ministries/${min1.ministry_id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ member_id: leaderA.memberId, role_in_ministry: 'Member' })
    });
    assert.equal(assignRes1.status, 201);
    const mmId1 = (await assignRes1.json()).data.ministryMemberId;

    // 2. Verify Leader A sees BOTH Discipleship Ministry (assigned as Member) AND Worship Ministry (head on create)
    const leaderAMinsRes = await fetch(`${baseUrl}/api/ministries/leader/my-assigned`, {
        headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(leaderAMinsRes.status, 200);
    const assignedA = (await leaderAMinsRes.json()).data;
    assert.equal(assignedA.length, 2, 'Leader A must see both assigned ministries');
    const discipleshipEntry = assignedA.find(m => m.ministry_id === min1.ministry_id);
    const worshipEntry = assignedA.find(m => m.ministry_id === min2.ministry_id);
    assert.ok(discipleshipEntry, 'Discipleship Ministry must appear in Leader A assigned ministries');
    assert.equal(discipleshipEntry.my_role_in_ministry, 'Member');
    assert.ok(worshipEntry, 'Worship Ministry must appear via leader_member_id sync on create');

    // 3. Re-assign with custom role ('Discipleship Mentor') without creating duplicates
    const updateRoleRes = await fetch(`${baseUrl}/api/ministries/${min1.ministry_id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ member_id: leaderA.memberId, role_in_ministry: 'Discipleship Mentor' })
    });
    assert.equal(updateRoleRes.status, 201);

    const leaderAMinsAfterRole = await (await fetch(`${baseUrl}/api/ministries/leader/my-assigned`, {
        headers: { Authorization: `Bearer ${tokenA}` }
    })).json();
    assert.equal(leaderAMinsAfterRole.data.length, 2, 'No duplicate ministry entries allowed');
    assert.equal(
        leaderAMinsAfterRole.data.find(m => m.ministry_id === min1.ministry_id).my_role_in_ministry,
        'Discipleship Mentor'
    );

    // 4. Verify non-assigned Leader B does NOT see Leader A's ministries
    const leaderBMinsRes = await fetch(`${baseUrl}/api/ministries/leader/my-assigned`, {
        headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.equal(leaderBMinsRes.status, 200);
    const assignedB = (await leaderBMinsRes.json()).data;
    assert.equal(assignedB.length, 0, 'Unassigned Leader B must not see unassigned ministries');

    // 5. Remove Leader A from Discipleship Ministry roster -> disappears cleanly
    const removeRes = await fetch(`${baseUrl}/api/ministries/members/${mmId1}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(removeRes.status, 200);

    const leaderAMinsAfterRemove = await (await fetch(`${baseUrl}/api/ministries/leader/my-assigned`, {
        headers: { Authorization: `Bearer ${tokenA}` }
    })).json();
    assert.equal(leaderAMinsAfterRemove.data.length, 1);
    assert.equal(leaderAMinsAfterRemove.data[0].ministry_id, min2.ministry_id);
});

test('5.A Ministry Sync: Auto-heals leader member link by email when members.user_id is NULL', async () => {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `unlinked_leader_${uniq}@cogimus.test`;
    const username = `unlinked_${uniq}`;
    const password = 'TestPassword123!';
    const hash = await bcrypt.hash(password, 10);

    const [uRes] = await pool.execute(
        `INSERT INTO users (role_id, username, email, password_hash, first_name, last_name, full_name, is_active, is_verified)
         VALUES (2, ?, ?, ?, 'Unlinked', 'Leader', 'Unlinked Leader', 1, 1)`,
        [username, email, hash]
    );
    const userId = uRes.insertId;
    createdUserIds.push(userId);

    // Insert member row intentionally with user_id = NULL
    const [mRes] = await pool.execute(
        `INSERT INTO members (user_id, first_name, last_name, church_role, email, status)
         VALUES (NULL, 'Unlinked', 'Leader', 'Leader', ?, 'Active')`,
        [email]
    );
    const memberId = mRes.insertId;
    createdMemberIds.push(memberId);

    const minRes = await fetch(`${baseUrl}/api/ministries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
            ministry_name: 'Unlinked Sync Ministry',
            ministry_code: `USM${uniq.slice(-6)}`,
            department: 'Outreach'
        })
    });
    const min = (await minRes.json()).data;
    createdMinistryIds.push(min.ministry_id);

    await fetch(`${baseUrl}/api/ministries/${min.ministry_id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ member_id: memberId, role_in_ministry: 'Member' })
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Browser-Context': `ctx_unlink_${uniq}` },
        body: JSON.stringify({ identifier: username, password })
    });
    const token = (await loginRes.json()).data.token;

    const assignedRes = await fetch(`${baseUrl}/api/ministries/leader/my-assigned`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(assignedRes.status, 200);
    const assigned = (await assignedRes.json()).data;
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].ministry_id, min.ministry_id);

    // Verify user_id was auto-linked in members table
    const [memCheck] = await pool.execute('SELECT user_id FROM members WHERE member_id = ?', [memberId]);
    assert.equal(memCheck[0].user_id, userId);
});

// =========================================================================
// 5.B — REQUIRED ANNOUNCEMENT IMAGE UPLOADS (ADMIN & LEADER)
// =========================================================================

test('5.B Announcements: Enforces required valid image upload on create and edit across Admin & Leader', async () => {
    const leaderUser = await createTestUser({ roleId: 2, churchRole: 'Leader', prefix: 'ann_leader' });
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Browser-Context': 'ctx_ann_leader' },
        body: JSON.stringify({ identifier: leaderUser.username, password: leaderUser.password })
    });
    const leaderToken = (await loginRes.json()).data.token;

    // 1. Creating without an image (JSON) must return 400
    const noImgAdminRes = await fetch(`${baseUrl}/api/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ title: 'No Image Test', content: 'Should fail', category: 'General', target_audience: 'All' })
    });
    assert.equal(noImgAdminRes.status, 400);
    const noImgAdminJson = await noImgAdminRes.json();
    assert.match(noImgAdminJson.message, /image is required/i);

    // 2. Creating by Leader without image must also return 400
    const noImgForm = new FormData();
    noImgForm.append('title', 'Leader No Image');
    noImgForm.append('content', 'Should fail');
    const noImgLeaderRes = await fetch(`${baseUrl}/api/announcements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${leaderToken}` },
        body: noImgForm
    });
    assert.equal(noImgLeaderRes.status, 400);

    // 3. Uploading spoofed/corrupted PNG file must return 400 and delete temp file
    const annDir = path.join(__dirname, '..', 'uploads', 'announcements');
    const filesBeforeSpoof = new Set(fs.existsSync(annDir) ? fs.readdirSync(annDir) : []);

    const spoofForm = new FormData();
    spoofForm.append('title', 'Spoofed Image Announcement');
    spoofForm.append('content', 'Should reject fake bytes');
    spoofForm.append('announcement_image', new Blob([Buffer.from('NOT_A_REAL_PNG_FILE')], { type: 'image/png' }), 'spoof.png');
    const spoofRes = await fetch(`${baseUrl}/api/announcements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: spoofForm
    });
    assert.equal(spoofRes.status, 400);
    const spoofJson = await spoofRes.json();
    assert.match(spoofJson.message, /Invalid or corrupted/i);

    const filesAfterSpoof = fs.existsSync(annDir) ? fs.readdirSync(annDir) : [];
    const leftoverFiles = filesAfterSpoof.filter(f => !filesBeforeSpoof.has(f));
    assert.equal(leftoverFiles.length, 0, 'Corrupted uploaded temp file must be removed on rejection');

    // 4. Reject disallowed non-image file extension (.txt)
    const txtForm = new FormData();
    txtForm.append('title', 'Bad File Ext');
    txtForm.append('content', 'Text file upload');
    txtForm.append('announcement_image', new Blob([Buffer.from('hello')], { type: 'text/plain' }), 'notes.txt');
    const txtRes = await fetch(`${baseUrl}/api/announcements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: txtForm
    });
    assert.equal(txtRes.status, 400);

    // 5. Admin creates announcement with valid PNG image -> succeeds 201 and persists file
    const createAdminForm = new FormData();
    createAdminForm.append('title', 'Admin Image Announcement');
    createAdminForm.append('content', 'Valid PNG bulletin');
    createAdminForm.append('category', 'General');
    createAdminForm.append('target_audience', 'All');
    createAdminForm.append('is_pinned', '1');
    createAdminForm.append('is_published', '1');
    createAdminForm.append('announcement_image', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), 'bulletin.png');

    const createAdminRes = await fetch(`${baseUrl}/api/announcements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: createAdminForm
    });
    assert.equal(createAdminRes.status, 201);
    const createdAdminData = (await createAdminRes.json()).data;
    createdAnnouncementIds.push(createdAdminData.announcement_id);
    trackUploadPath(createdAdminData.image_path);
    assert.ok(createdAdminData.image_path.startsWith('/uploads/announcements/'));
    const savedAdminAbs = path.join(__dirname, '..', createdAdminData.image_path.replace(/^\/+/, ''));
    assert.equal(fs.existsSync(savedAdminAbs), true, 'Uploaded announcement PNG must exist on disk');

    // Verify GET returns persisted image_path
    const getRes = await fetch(`${baseUrl}/api/announcements/${createdAdminData.announcement_id}`, {
        headers: { Authorization: `Bearer ${leaderToken}` }
    });
    assert.equal(getRes.status, 200);
    const fetchedAnn = (await getRes.json()).data;
    assert.equal(fetchedAnn.image_path, createdAdminData.image_path);

    // 6. Edit retaining existing image (no new file uploaded) succeeds & preserves image_path
    const editRetainForm = new FormData();
    editRetainForm.append('title', 'Admin Image Announcement Updated');
    editRetainForm.append('content', 'Updated body retaining image');
    const editRetainRes = await fetch(`${baseUrl}/api/announcements/${createdAdminData.announcement_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: editRetainForm
    });
    assert.equal(editRetainRes.status, 200);
    const editRetainData = (await editRetainRes.json()).data;
    assert.equal(editRetainData.image_path, createdAdminData.image_path);
    assert.equal(fs.existsSync(savedAdminAbs), true);

    // 7. Edit attempting to remove image without uploading replacement fails 400
    const editRemoveForm = new FormData();
    editRemoveForm.append('title', 'Attempt Remove Image');
    editRemoveForm.append('content', 'Should fail');
    editRemoveForm.append('remove_image', '1');
    const editRemoveRes = await fetch(`${baseUrl}/api/announcements/${createdAdminData.announcement_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: editRemoveForm
    });
    assert.equal(editRemoveRes.status, 400);

    // 8. Leader replaces image on edit -> succeeds 200, updates image_path, removes old file
    const editReplaceForm = new FormData();
    editReplaceForm.append('title', 'Leader Replaced Image');
    editReplaceForm.append('content', 'Replaced with JPEG');
    editReplaceForm.append('announcement_image', new Blob([VALID_JPEG_BYTES], { type: 'image/jpeg' }), 'updated.jpg');
    const editReplaceRes = await fetch(`${baseUrl}/api/announcements/${createdAdminData.announcement_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${leaderToken}` },
        body: editReplaceForm
    });
    assert.equal(editReplaceRes.status, 200);
    const editReplaceData = (await editReplaceRes.json()).data;
    trackUploadPath(editReplaceData.image_path);
    assert.notEqual(editReplaceData.image_path, createdAdminData.image_path);
    assert.equal(fs.existsSync(savedAdminAbs), false, 'Replaced old image file should be unlinked');
    assert.equal(fs.existsSync(path.join(__dirname, '..', editReplaceData.image_path.replace(/^\/+/, ''))), true);

    // 9. Leader creates brand-new announcement with JPEG -> succeeds 201
    const createLeaderForm = new FormData();
    createLeaderForm.append('title', 'Leader Created Announcement');
    createLeaderForm.append('content', 'Created with JPEG');
    createLeaderForm.append('announcement_image', new Blob([VALID_JPEG_BYTES], { type: 'image/jpeg' }), 'leader.jpg');
    const createLeaderRes = await fetch(`${baseUrl}/api/announcements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${leaderToken}` },
        body: createLeaderForm
    });
    assert.equal(createLeaderRes.status, 201);
    const createdLeaderData = (await createLeaderRes.json()).data;
    createdAnnouncementIds.push(createdLeaderData.announcement_id);
    trackUploadPath(createdLeaderData.image_path);

    // 10. UI checks in HTML/JS files for required announcement image inputs
    const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'views', 'admin-dashboard.html'), 'utf8');
    const leaderHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'views', 'leader-dashboard.html'), 'utf8');
    assert.ok(adminHtml.includes('id="ann_image"'), 'Admin modal has announcement file input');
    assert.ok(leaderHtml.includes('id="leader_ann_image"'), 'Leader modal has announcement file input');
});

// =========================================================================
// 5.C — CROSS-TAB BROWSER SESSION SYNCHRONIZATION (SCENARIOS 1-5)
// =========================================================================

test('5.C Cross-Tab Session Sync: Scenario 1, 2, 5 — Account B login in same browser invalidates Account A immediately (DB + 401 on GET & POST)', async () => {
    const adminAcc = await createTestUser({ roleId: 1, churchRole: 'Admin', prefix: 'tab_admin' });
    const leaderAcc = await createTestUser({ roleId: 2, churchRole: 'Leader', prefix: 'tab_leader' });
    const memberAcc = await createTestUser({ roleId: 3, churchRole: 'Member', prefix: 'tab_member' });

    const browserCtx = `browser_ctx_${Date.now()}`;

    // Tab 1: Admin logs in
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Browser-Context': browserCtx },
        body: JSON.stringify({ identifier: adminAcc.username, password: adminAcc.password })
    });
    assert.equal(res1.status, 200);
    const tokenAdmin = (await res1.json()).data.token;
    const checkAdmin1 = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${tokenAdmin}`, 'X-Browser-Context': browserCtx }
    });
    assert.equal(checkAdmin1.status, 200);

    // Tab 2: Leader logs in from another tab in the SAME browser
    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Browser-Context': browserCtx },
        body: JSON.stringify({ identifier: leaderAcc.username, password: leaderAcc.password, previousToken: tokenAdmin })
    });
    assert.equal(res2.status, 200);
    const tokenLeader = (await res2.json()).data.token;

    // Admin's DB session token must now be NULL (invalidated)
    const [dbAdmin] = await pool.execute('SELECT current_session_token FROM users WHERE user_id = ?', [adminAcc.userId]);
    assert.equal(dbAdmin[0].current_session_token, null, 'Previous account DB current_session_token must be cleared on cross-tab account switch');

    // Tab 1 (Admin) check-session fails with 401 + exact message
    const checkAdminAfter = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${tokenAdmin}`, 'X-Browser-Context': browserCtx }
    });
    assert.equal(checkAdminAfter.status, 401);
    assert.equal(checkAdminAfter.headers.get('X-Session-Terminated'), 'account_switched');
    const checkAdminJson = await checkAdminAfter.json();
    assert.equal(checkAdminJson.message, ACCOUNT_SWITCHED_MESSAGE);

    // Scenario 5: Tab 1 (Admin) attempts a protected POST mutation after being replaced by Leader -> MUST reject 401 (even without X-Browser-Context header!)
    const staleMutationForm = new FormData();
    staleMutationForm.append('title', 'Stale Admin Mutation');
    staleMutationForm.append('content', 'Must be rejected');
    staleMutationForm.append('announcement_image', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), 'stale.png');
    const stalePostRes = await fetch(`${baseUrl}/api/announcements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        body: staleMutationForm
    });
    assert.equal(stalePostRes.status, 401, 'Superseded account must NOT execute POST/PUT actions');
    const stalePostJson = await stalePostRes.json();
    assert.equal(stalePostJson.message, ACCOUNT_SWITCHED_MESSAGE);

    // Tab 2 (Leader) is currently active
    const checkLeader1 = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${tokenLeader}`, 'X-Browser-Context': browserCtx }
    });
    assert.equal(checkLeader1.status, 200);

    // Tab 3 (Scenario 2): Member logs in on Tab 3 in same browser -> invalidates Leader in Tab 2
    const res3 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Browser-Context': browserCtx },
        body: JSON.stringify({ identifier: memberAcc.username, password: memberAcc.password })
    });
    assert.equal(res3.status, 200);
    const tokenMember = (await res3.json()).data.token;

    const checkLeaderAfter = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${tokenLeader}`, 'X-Browser-Context': browserCtx }
    });
    assert.equal(checkLeaderAfter.status, 401);
    assert.equal((await checkLeaderAfter.json()).message, ACCOUNT_SWITCHED_MESSAGE);

    const checkMember = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${tokenMember}`, 'X-Browser-Context': browserCtx }
    });
    assert.equal(checkMember.status, 200);
});

test('5.C Cross-Tab Session Sync: Scenario 3 & 4 — Re-logging same account on another tab invalidates prior tab & logout invalidates active session', async () => {
    const userA = await createTestUser({ roleId: 2, churchRole: 'Leader', prefix: 'same_acct_tabs' });
    const browserCtx = `browser_same_${Date.now()}`;

    // Tab 1 login
    const login1 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Browser-Context': browserCtx },
        body: JSON.stringify({ identifier: userA.username, password: userA.password })
    });
    assert.equal(login1.status, 200);
    const tokenTab1 = (await login1.json()).data.token;

    // Tab 2 logs in again with SAME account in another browser tab -> Tab 1 MUST be invalidated (401), Tab 2 active (200)!
    const login2 = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Browser-Context': browserCtx },
        body: JSON.stringify({ identifier: userA.username, password: userA.password, previousToken: tokenTab1 })
    });
    assert.equal(login2.status, 200);
    const tokenTab2 = (await login2.json()).data.token;

    const check1 = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${tokenTab1}`, 'X-Browser-Context': browserCtx }
    });
    const check2 = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${tokenTab2}`, 'X-Browser-Context': browserCtx }
    });
    assert.equal(check1.status, 401, 'Previous Tab 1 of same account must be logged out automatically after new tab login');
    assert.equal(check2.status, 200, 'Newly logged-in Tab 2 must remain active');

    // Separate independent device WITHOUT same browserCtx logging in DOES invalidate Tab 2
    const remoteLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: userA.username, password: userA.password })
    });
    assert.equal(remoteLogin.status, 200);
    const tokenRemote = (await remoteLogin.json()).data.token;

    const checkTab2AfterRemote = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${tokenTab2}` }
    });
    assert.equal(checkTab2AfterRemote.status, 401, 'Remote login from another browser/device invalidates old session');

    // Scenario 4: Explicit logout clears session and rejects subsequent requests
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenRemote}` }
    });
    assert.equal(logoutRes.status, 200);

    const checkAfterLogout = await fetch(`${baseUrl}/api/auth/check-session`, {
        headers: { Authorization: `Bearer ${tokenRemote}` }
    });
    assert.equal(checkAfterLogout.status, 401);
});

test('5.C Frontend Client Sync Simulation: api.js authSessionSync synchronizes tabs & omits secrets from BroadcastChannel payloads', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'api.js'), 'utf8');

    const postedMessages = [];
    const makeStorage = () => {
        const map = new Map();
        return {
            getItem: (k) => (map.has(k) ? map.get(k) : null),
            setItem: (k, v) => map.set(k, String(v)),
            removeItem: (k) => map.delete(k)
        };
    };

    const sharedLocal = makeStorage();

    function createBrowserTabSandbox(pathname) {
        const tabSession = makeStorage();
        const sandbox = {
            window: {
                location: { pathname, href: pathname, replace: (u) => { sandbox.redirectedTo = u; }, assign: (u) => { sandbox.redirectedTo = u; } },
                addEventListener: () => {}
            },
            document: {
                readyState: 'complete',
                addEventListener: () => {},
                querySelectorAll: () => [],
                getElementById: () => null,
                body: { appendChild: () => {}, classList: { contains: () => false } },
                documentElement: { classList: { contains: () => false }, getAttribute: () => 'light' },
                createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} })
            },
            localStorage: sharedLocal,
            sessionStorage: tabSession,
            BroadcastChannel: function(name) {
                return {
                    name,
                    postMessage: (msg) => postedMessages.push({ channel: name, msg }),
                    onmessage: null
                };
            },
            console,
            setTimeout: () => 0,
            setInterval: () => 0,
            clearInterval: () => {},
            EventSource: undefined,
            redirectedTo: null
        };
        sandbox.window.localStorage = sharedLocal;
        sandbox.window.sessionStorage = tabSession;
        vm.createContext(sandbox);
        vm.runInContext(apiCode, sandbox);
        return sandbox;
    }

    // Tab 1 (Admin logged in as User 10)
    const tab1 = createBrowserTabSandbox('/views/admin-dashboard.html');
    const adminUser = { user_id: 10, role_name: 'Admin', email: 'secret@cog.local', password_hash: 'hidden' };
    tab1.window.authSessionSync.recordBrowserLogin('jwt-secret-token-A', adminUser, 'sync-A');
    tab1.window.authSessionSync.bindTabUser(adminUser);

    // Tab 2 opens same dashboard directly without logging in -> hydrates User 10 seamlessly
    const tab2 = createBrowserTabSandbox('/views/admin-dashboard.html');
    const hyd = tab2.window.authSessionSync.hydrateTabSessionIfNeeded();
    assert.equal(hyd.hydrated, true);
    assert.equal(tab2.sessionStorage.getItem('church_token'), 'jwt-secret-token-A');

    // Tab 4 logs in freshly to the SAME Admin account (User 10) from another tab -> MUST log out Tab 1!
    const tab4 = createBrowserTabSandbox('/views/login.html');
    tab4.window.authSessionSync.recordBrowserLogin('jwt-secret-token-A2', adminUser, 'sync-A2');
    const sameAccountSwitchMsg = postedMessages[postedMessages.length - 1].msg;
    tab1.window.authSessionSync.handleCrossTabAuthSyncEvent(sameAccountSwitchMsg);
    assert.equal(tab1.sessionStorage.getItem('church_token'), null, 'Previous Tab 1 of same account must clear token immediately on new tab login');
    assert.equal(tab1.sessionStorage.getItem('auth_logout_reason'), 'concurrent_login');
    assert.equal(tab4.window.authSessionSync.checkForAccountSwitchConflict(), false, 'Newly logged-in Tab 4 must stay active');

    // Tab 3 logs in as DIFFERENT account (Leader User 20)
    const tab3 = createBrowserTabSandbox('/views/login.html');
    const leaderUser = { user_id: 20, role_name: 'Church Leader', email: 'leader@cog.local' };
    tab3.window.authSessionSync.recordBrowserLogin('jwt-secret-token-B', leaderUser, 'sync-B');

    // Verify BroadcastChannel payloads NEVER include JWT token or email/password
    assert.ok(postedMessages.length >= 2);
    for (const p of postedMessages) {
        const json = JSON.stringify(p.msg);
        assert.equal(json.includes('jwt-secret-token'), false, 'BroadcastChannel must NOT leak raw JWT token');
        assert.equal(json.includes('@cog.local'), false, 'BroadcastChannel must NOT leak email');
        assert.equal(json.includes('password'), false, 'BroadcastChannel must NOT leak password');
    }

    // Deliver switch broadcast event to Tab 2 (still holding User 10) -> Tab 2 immediately clears session & stores exact message
    const lastSwitchMsg = postedMessages[postedMessages.length - 1].msg;
    tab2.window.authSessionSync.handleCrossTabAuthSyncEvent(lastSwitchMsg);
    assert.equal(tab2.sessionStorage.getItem('church_token'), null, 'Tab 2 must clear previous account token immediately');
    assert.equal(tab2.sessionStorage.getItem('auth_logout_reason'), 'account_switched');
    assert.equal(tab2.sessionStorage.getItem('session_terminated_message'), ACCOUNT_SWITCHED_MESSAGE);
});

test('5.D Voluntary Button Logout sets self_logout (not tab_logout) while notifying sibling tabs', async () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'api.js'), 'utf8');
    const authCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'auth.js'), 'utf8');

    const makeStorage = () => {
        const map = new Map();
        return {
            getItem: (k) => (map.has(k) ? map.get(k) : null),
            setItem: (k, v) => map.set(k, String(v)),
            removeItem: (k) => map.delete(k)
        };
    };
    const sharedLocal = makeStorage();
    const postedBroadcasts = [];
    const sseInstances = [];
    let logoutEndpointCalled = 0;

    function createTab(pathname) {
        const tabSession = makeStorage();
        const sandbox = {
            window: {
                location: { pathname, href: pathname, replace: (u) => { sandbox.redirectedTo = u; } },
                addEventListener: () => {}
            },
            document: {
                readyState: 'complete',
                addEventListener: () => {},
                querySelectorAll: () => [],
                getElementById: () => null,
                body: { appendChild: () => {}, classList: { contains: () => false } },
                documentElement: { classList: { contains: () => false }, getAttribute: () => 'light' },
                createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} })
            },
            localStorage: sharedLocal,
            sessionStorage: tabSession,
            BroadcastChannel: function(name) {
                return {
                    name,
                    postMessage: (msg) => postedBroadcasts.push({ channel: name, msg }),
                    onmessage: null
                };
            },
            EventSource: function(url) {
                const esObj = {
                    url,
                    closed: false,
                    onmessage: null,
                    close: () => { esObj.closed = true; }
                };
                sseInstances.push(esObj);
                return esObj;
            },
            fetch: async (url) => {
                if (String(url).includes('/api/auth/logout')) {
                    logoutEndpointCalled++;
                    // Simulate backend SSE broadcast firing right as /auth/logout runs
                    for (const es of sseInstances) {
                        if (!es.closed && typeof es.onmessage === 'function') {
                            es.onmessage({ data: JSON.stringify({ type: 'force_logout', data: { user_id: 30, reason: 'explicit_logout' } }) });
                        }
                    }
                }
                return { ok: true, status: 200, headers: { get: () => '' }, json: async () => ({ success: true }) };
            },
            console,
            setTimeout: () => 0,
            setInterval: () => 0,
            clearInterval: () => {},
            redirectedTo: null
        };
        sandbox.window.localStorage = sharedLocal;
        sandbox.window.sessionStorage = tabSession;
        sandbox.window.location = new Proxy(sandbox.window.location, {
            set(target, prop, val) {
                target[prop] = val;
                if (prop === 'href') sandbox.redirectedTo = val;
                return true;
            }
        });
        vm.createContext(sandbox);
        vm.runInContext(apiCode, sandbox);
        return sandbox;
    }

    const tabA = createTab('/views/leader-dashboard.html');
    const tabB = createTab('/views/leader-dashboard.html');
    const userObj = { user_id: 30, role_name: 'Church Leader', full_name: 'Leader Test' };
    tabA.window.authSessionSync.recordBrowserLogin('tok-30', userObj, 'sync-30');
    tabA.window.authSessionSync.bindTabUser(userObj);
    tabB.window.authSessionSync.recordBrowserLogin('tok-30', userObj, 'sync-30');
    tabB.window.authSessionSync.bindTabUser(userObj);

    // User clicks Logout button in Tab A
    await tabA.window.authSessionSync.performLogout();

    assert.equal(logoutEndpointCalled, 1, 'POST /api/auth/logout must still execute on server');
    assert.equal(tabA.sessionStorage.getItem('auth_logout_reason'), 'self_logout', 'Tab A must set self_logout instead of tab_logout');
    assert.equal(tabA.window.location.href, '/views/login.html');

    // Sibling Tab B receives the broadcast and treats it as tab_logout
    const logoutBroadcast = postedBroadcasts.find(p => p.msg && p.msg.type === 'SESSION_LOGOUT');
    assert.ok(logoutBroadcast, 'SESSION_LOGOUT must still be broadcast to sibling tabs');
    tabB.window.authSessionSync.handleCrossTabAuthSyncEvent(logoutBroadcast.msg);
    assert.equal(tabB.sessionStorage.getItem('auth_logout_reason'), 'tab_logout', 'Sibling Tab B still sees tab_logout');

    // Login page renders calm self_logout notice instead of "another tab"
    assert.ok(authCode.includes("logoutReason === 'self_logout'"), 'auth.js handles self_logout explicitly');
    assert.ok(authCode.includes('You have been signed out successfully.'), 'auth.js displays clear voluntary sign-out message');
});
