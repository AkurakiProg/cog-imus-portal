const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = require('../server');
const { pool } = require('../config/database');
const galleryModel = require('../models/galleryModel');

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-replace-in-production';

let server;
let baseUrl;
let adminToken;
let memberToken;
let originalAdminSessionToken;
let memberUserId;

const createdAlbumIds = [];
const createdAuditAlbumIds = [];

test.before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const [adminRows] = await pool.execute('SELECT current_session_token FROM users WHERE user_id = 1');
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

    const [memberRows] = await pool.execute('SELECT user_id, username, current_session_token FROM users WHERE role_id = 3 AND is_active = 1 LIMIT 1');
    if (memberRows.length > 0) {
        memberUserId = memberRows[0].user_id;
        let memSession = memberRows[0].current_session_token;
        if (!memSession) {
            memSession = uuidv4();
            await pool.execute('UPDATE users SET current_session_token = ? WHERE user_id = ?', [memSession, memberUserId]);
        }
        memberToken = jwt.sign(
            { id: memberUserId, role_id: 3, role_name: 'Member', username: memberRows[0].username, sessionToken: memSession },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
    }
});

test.after(async () => {
    try {
        if (originalAdminSessionToken !== undefined) {
            await pool.execute('UPDATE users SET current_session_token = ? WHERE user_id = 1', [originalAdminSessionToken]);
        }
        for (const aid of createdAlbumIds) {
            await pool.execute('DELETE FROM gallery_images WHERE album_id = ?', [aid]).catch(() => {});
            await pool.execute('DELETE FROM gallery_albums WHERE album_id = ?', [aid]).catch(() => {});
            await pool.execute("DELETE FROM audit_trail WHERE module = 'Gallery' AND record_id = ?", [aid]).catch(() => {});
        }
    } finally {
        await new Promise((resolve) => server.close(resolve));
        await pool.end();
    }
});

test('Gallery Bulk Delete API: enforces auth/RBAC, validates IDs, isolates album scope, and deletes multiple selected photos', async () => {
    const albumA = await galleryModel.createAlbum({
        title: `Test Bulk Delete Album A ${Date.now()}`,
        description: 'Temp album A for multi-delete test',
        album_date: '2026-11-21'
    }, 1);
    const albumB = await galleryModel.createAlbum({
        title: `Test Bulk Delete Album B ${Date.now()}`,
        description: 'Temp album B for multi-delete isolation check',
        album_date: '2026-11-21'
    }, 1);
    createdAlbumIds.push(albumA, albumB);

    const imgA1 = await galleryModel.addImage(albumA, '/uploads/gallery/test_a1.jpg', 1);
    const imgA2 = await galleryModel.addImage(albumA, '/uploads/gallery/test_a2.jpg', 1);
    const imgA3 = await galleryModel.addImage(albumA, '/uploads/gallery/test_a3.jpg', 1);
    const imgA4 = await galleryModel.addImage(albumA, '/uploads/gallery/test_a4.jpg', 1);
    const imgB1 = await galleryModel.addImage(albumB, '/uploads/gallery/test_b1.jpg', 1);

    // 1. Unauthenticated -> 401
    const noAuth = await fetch(`${baseUrl}/api/gallery/images/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds: [imgA1], albumId: albumA })
    });
    assert.equal(noAuth.status, 401);

    // 2. Member role -> 403 Forbidden
    if (memberToken) {
        const memRes = await fetch(`${baseUrl}/api/gallery/images/bulk-delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${memberToken}`
            },
            body: JSON.stringify({ imageIds: [imgA1], albumId: albumA })
        });
        assert.equal(memRes.status, 403);
    }

    // 3. Empty selection -> 400
    const emptyRes = await fetch(`${baseUrl}/api/gallery/images/bulk-delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ imageIds: [], albumId: albumA })
    });
    assert.equal(emptyRes.status, 400);

    // 4. Cross-album protection: attempting to delete imgB1 scoped to albumA -> 404 & imgB1 survives
    const crossRes = await fetch(`${baseUrl}/api/gallery/images/bulk-delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ imageIds: [imgB1], albumId: albumA })
    });
    assert.equal(crossRes.status, 404);
    const albumBImgsBefore = await galleryModel.getImages(albumB);
    assert.equal(albumBImgsBefore.length, 1);

    // 5. Admin bulk deletes 2 selected photos via POST /api/gallery/images/bulk-delete
    const bulk1 = await fetch(`${baseUrl}/api/gallery/images/bulk-delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ imageIds: [imgA1, imgA3], albumId: albumA })
    });
    assert.equal(bulk1.status, 200);
    const bulk1Json = await bulk1.json();
    assert.equal(bulk1Json.success, true);
    assert.equal(bulk1Json.data.deletedCount, 2);
    assert.deepEqual(bulk1Json.data.deletedIds.sort((a, b) => a - b), [imgA1, imgA3].sort((a, b) => a - b));

    const remainingAfter1 = await galleryModel.getImages(albumA);
    assert.deepEqual(remainingAfter1.map((r) => r.image_id).sort((a, b) => a - b), [imgA2, imgA4].sort((a, b) => a - b));

    // 6. Admin bulk deletes remaining 2 photos via DELETE /api/gallery/:id/images
    const bulk2 = await fetch(`${baseUrl}/api/gallery/${albumA}/images`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ imageIds: [imgA2, imgA4] })
    });
    assert.equal(bulk2.status, 200);
    const bulk2Json = await bulk2.json();
    assert.equal(bulk2Json.data.deletedCount, 2);

    const remainingAfter2 = await galleryModel.getImages(albumA);
    assert.equal(remainingAfter2.length, 0);

    // 7. Confirm album B photo remained completely untouched
    const albumBImgsAfter = await galleryModel.getImages(albumB);
    assert.equal(albumBImgsAfter.length, 1);
    assert.equal(albumBImgsAfter[0].image_id, imgB1);

    // 8. Verify audit log entry
    const [auditRows] = await pool.execute(
        "SELECT action, module, record_id FROM audit_trail WHERE module = 'Gallery' AND action = 'DELETE_IMAGES_BULK' AND record_id = ?",
        [albumA]
    );
    assert.ok(auditRows.length >= 2);
    createdAuditAlbumIds.push(albumA);
});

test('Frontend Multi-Select Gallery Helper: renders checkboxes, handles multi-select & shift-range & select-all, and triggers bulk delete', async () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, '../public/views/admin-dashboard.html'), 'utf8');
    const leaderHtml = fs.readFileSync(path.join(__dirname, '../public/views/leader-dashboard.html'), 'utf8');
    const adminJs = fs.readFileSync(path.join(__dirname, '../public/js/admin-dashboard.js'), 'utf8');
    const leaderJs = fs.readFileSync(path.join(__dirname, '../public/js/leader-dashboard.js'), 'utf8');
    const apiJs = fs.readFileSync(path.join(__dirname, '../public/js/api.js'), 'utf8');
    const helperCode = fs.readFileSync(path.join(__dirname, '../public/js/album-photos-helper.js'), 'utf8');

    for (const html of [adminHtml, leaderHtml]) {
        assert.match(html, /id="albumPhotosBulkToolbar"/);
        assert.match(html, /id="selectAllAlbumPhotos"/);
        assert.match(html, /id="btnDeleteSelectedPhotos"/);
        assert.match(html, /id="selectedPhotosCount"/);
        assert.match(html, /album-photos-helper\.js/);
    }
    assert.match(adminJs, /deleteSelectedAlbumPhotos/);
    assert.match(adminJs, /AlbumPhotosManager\.renderGrid/);
    assert.match(leaderJs, /deleteSelectedAlbumPhotos/);
    assert.match(leaderJs, /AlbumPhotosManager\.renderGrid/);
    assert.match(apiJs, /deleteImagesBulk/);

    const makeClassList = () => {
        const set = new Set();
        return {
            add: (c) => set.add(c),
            remove: (c) => set.delete(c),
            toggle: (c, force) => (force === undefined ? (set.has(c) ? set.delete(c) : set.add(c)) : (force ? set.add(c) : set.delete(c))),
            contains: (c) => set.has(c)
        };
    };

    const cardMocks = [];
    const makeEl = (id) => ({
        id,
        style: { display: 'none' },
        disabled: false,
        checked: false,
        indeterminate: false,
        textContent: '',
        innerHTML: '',
        classList: makeClassList(),
        querySelectorAll: (sel) => (sel === '.album-photo-card' ? cardMocks : [])
    });

    const elements = {
        albumPhotosBulkToolbar: makeEl('albumPhotosBulkToolbar'),
        albumPhotosHint: makeEl('albumPhotosHint'),
        selectAllAlbumPhotos: makeEl('selectAllAlbumPhotos'),
        albumSelectedSummary: makeEl('albumSelectedSummary'),
        btnClearPhotoSelection: makeEl('btnClearPhotoSelection'),
        btnDeleteSelectedPhotos: makeEl('btnDeleteSelectedPhotos'),
        selectedPhotosCount: makeEl('selectedPhotosCount'),
        albumPhotosGrid: makeEl('albumPhotosGrid')
    };

    const sandbox = {
        window: {},
        document: {
            getElementById: (id) => elements[id] || null
        },
        Set,
        Array,
        Number,
        Boolean,
        String
    };
    sandbox.window = sandbox;
    vm.runInNewContext(helperCode, sandbox);

    const mgr = sandbox.AlbumPhotosManager;
    assert.ok(mgr, 'AlbumPhotosManager exposed on window');

    const sampleImages = [
        { image_id: 101, image_path: '/uploads/gallery/1.jpg', caption: 'Photo 1' },
        { image_id: 102, image_path: '/uploads/gallery/2.jpg', caption: 'Photo 2' },
        { image_id: 103, image_path: '/uploads/gallery/3.jpg', caption: 'Photo 3' },
        { image_id: 104, image_path: '/uploads/gallery/4.jpg', caption: 'Photo 4' }
    ];

    // Prepare matching card DOM stubs for syncCardsDom
    cardMocks.push(...sampleImages.map((img) => {
        const cb = { checked: false };
        return {
            _id: img.image_id,
            classList: makeClassList(),
            getAttribute: (attr) => (attr === 'data-image-id' ? String(img.image_id) : ''),
            querySelector: (sel) => (sel === '.album-photo-checkbox' ? cb : null)
        };
    }));

    mgr.renderGrid(elements.albumPhotosGrid, sampleImages, (s) => String(s));

    assert.equal(elements.albumPhotosBulkToolbar.style.display, 'flex');
    assert.equal(elements.btnDeleteSelectedPhotos.disabled, true);
    assert.equal(elements.selectedPhotosCount.textContent, '0');
    assert.match(elements.albumPhotosGrid.innerHTML, /class="album-photo-checkbox"/);

    // Individual selection at index 0 + Shift+Click range selection to index 2 (selects 101, 102, 103)
    mgr.handleCardClick(101, 0, { target: { closest: () => null }, shiftKey: false });
    mgr.handleCardClick(103, 2, { target: { closest: () => null }, shiftKey: true });
    assert.deepEqual(mgr.getSelectedIds(), [101, 102, 103]);
    assert.equal(elements.selectedPhotosCount.textContent, '3');
    assert.equal(elements.btnDeleteSelectedPhotos.disabled, false);
    assert.equal(elements.selectAllAlbumPhotos.indeterminate, true);
    assert.equal(cardMocks[1].classList.contains('is-selected'), true);
    assert.equal(cardMocks[1].querySelector('.album-photo-checkbox').checked, true);

    // Select All selects remaining photo (104)
    mgr.toggleSelectAll(true);
    assert.equal(mgr.getSelectedIds().length, 4);
    assert.equal(elements.selectAllAlbumPhotos.checked, true);
    assert.equal(elements.selectAllAlbumPhotos.indeterminate, false);

    // Clear selection disables delete button
    mgr.clearSelection();
    assert.equal(mgr.getSelectedIds().length, 0);
    assert.equal(elements.btnDeleteSelectedPhotos.disabled, true);

    // Select 2 photos via checkbox click & deleteSelected
    mgr.handleCheckboxClick(101, 0, { stopPropagation: () => {}, target: { checked: true }, shiftKey: false });
    mgr.handleCheckboxClick(104, 3, { stopPropagation: () => {}, target: { checked: true }, shiftKey: false });
    assert.deepEqual(mgr.getSelectedIds(), [101, 104]);

    let bulkCallArgs = null;
    let confirmPayload = null;
    let toastText = null;
    let reloadedAlbumId = null;

    const ok = await mgr.deleteSelected({
        albumId: 55,
        apiClient: {
            gallery: {
                deleteImagesBulk: async (ids, albumId) => {
                    bulkCallArgs = { ids, albumId };
                    return { success: true, data: { deletedCount: ids.length } };
                }
            }
        },
        confirmModal: async (opts) => {
            confirmPayload = opts;
            return true;
        },
        notify: (msg) => {
            toastText = msg;
        },
        reloadPhotos: async (albumId) => {
            reloadedAlbumId = albumId;
        }
    });

    assert.equal(ok, true);
    assert.equal(confirmPayload.title, 'Delete Selected Photos');
    assert.deepEqual(bulkCallArgs, { ids: [101, 104], albumId: 55 });
    assert.equal(toastText, 'Successfully deleted 2 photos!');
    assert.equal(reloadedAlbumId, 55);
    assert.equal(mgr.getSelectedIds().length, 0);
});
