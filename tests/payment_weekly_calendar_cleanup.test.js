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
const contentModel = require('../models/contentModel');

const ROOT = path.join(__dirname, '..');

let server;
let baseUrl;
let adminToken;
let leaderToken;
let memberToken;
let originalContactRow = null;
const uploadedTestFiles = [];

// Minimal valid 1x1 PNG binary
const VALID_PNG_BYTES = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
    'hex'
);

async function issueToken(userId, roleName) {
    const sessionToken = uuidv4();
    await pool.execute(
        'UPDATE users SET current_session_token = ?, is_active = 1, is_verified = 1 WHERE user_id = ?',
        [sessionToken, userId]
    );
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
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });

    const [adminRow] = await pool.query('SELECT user_id FROM users WHERE role_id = 1 LIMIT 1');
    const [leaderRow] = await pool.query('SELECT user_id FROM users WHERE role_id = 2 LIMIT 1');
    const [memberRow] = await pool.query('SELECT user_id FROM users WHERE role_id = 3 LIMIT 1');

    adminToken = await issueToken(adminRow[0].user_id, 'Admin');
    leaderToken = await issueToken(leaderRow[0].user_id, 'Church Leader');
    memberToken = await issueToken(memberRow[0].user_id, 'Church Member');

    const [rows] = await pool.query("SELECT page_key, body, updated_by FROM content_pages WHERE page_key = 'contact_us' LIMIT 1");
    if (rows.length > 0) {
        originalContactRow = rows[0];
    }
});

test.after(async () => {
    if (originalContactRow) {
        await pool.execute(
            "UPDATE content_pages SET body = ?, updated_by = ? WHERE page_key = 'contact_us'",
            [originalContactRow.body, originalContactRow.updated_by]
        );
    } else {
        await pool.execute("DELETE FROM content_pages WHERE page_key = 'contact_us'");
    }

    for (const urlPath of uploadedTestFiles) {
        const diskPath = path.join(ROOT, urlPath.replace(/^\//, ''));
        if (fs.existsSync(diskPath)) {
            try { fs.unlinkSync(diskPath); } catch (e) {}
        }
    }

    await new Promise((resolve) => server.close(resolve));
    await pool.end();
});

test('1. Public Contact Page Payment Section Markup & Safe Sample Placeholder', () => {
    const svgPath = path.join(ROOT, 'public/images/sample-qr-placeholder.svg');
    assert.ok(fs.existsSync(svgPath), 'sample-qr-placeholder.svg must exist');
    const svg = fs.readFileSync(svgPath, 'utf8');
    assert.ok(svg.includes('SAMPLE QR'), 'SVG must clearly identify itself as a SAMPLE QR');
    assert.ok(svg.includes('NOT AN ACTIVE PAYMENT ACCOUNT'), 'SVG must warn visitors it is not an active payment account');

    const contactHtml = fs.readFileSync(path.join(ROOT, 'public/views/contact.html'), 'utf8');
    assert.ok(contactHtml.includes('id="payment-info"'), '#payment-info section exists');
    const paymentIdx = contactHtml.indexOf('id="payment-info"');
    const infoCardIdx = contactHtml.indexOf('class="contact-info-card');
    assert.ok(paymentIdx > 0 && infoCardIdx > paymentIdx, 'Payment cards sit to the left of Church Information inside .contact-grid');
    assert.ok(!contactHtml.includes('Stewardship &amp; Giving'), 'Header copy removed as requested');
    assert.ok(!contactHtml.includes('Sample Placeholder Notice:'), 'Sample Placeholder Notice banner removed as requested');
    assert.ok(!contactHtml.includes('Sample instruction:'), 'Sample instruction text removed as requested');
    assert.ok(contactHtml.includes('id="paymentCardGcash"'), 'GCash card rendered');
    assert.ok(contactHtml.includes('id="paymentCardBpi"'), 'BPI card rendered');
    assert.ok(contactHtml.includes('id="paymentCardBdo"'), 'BDO card rendered');
    assert.ok(contactHtml.includes('id="paymentQrModal"'), 'Enlargeable QR lightbox modal present');
    assert.ok(contactHtml.includes('id="paymentEmptyState"'), 'Graceful empty state element present');
    assert.ok(contactHtml.includes('object-fit: contain'), 'QR preserves aspect ratio without cropping/stretching');
    assert.ok(contactHtml.includes('height: 115px'), 'Prayer request textarea height is 115px');
    assert.ok(contactHtml.includes('contact-info-items-wrap') && contactHtml.includes('align-items: stretch'), 'Columns match height evenly on desktop');

    const adminHtml = fs.readFileSync(path.join(ROOT, 'public/views/admin-dashboard.html'), 'utf8');
    assert.ok(adminHtml.includes('id="cmsPaymentInfoCard"'), 'Admin CMS payment card exists inside Contact CMS panel');
    assert.ok(!adminHtml.includes('Preview Payment Information'), 'Duplicate Preview Payment Information button removed');
    assert.ok(!adminHtml.includes('Save Payment &amp; Contact Changes'), 'Duplicate Save Payment & Contact Changes footer bar removed');
    assert.ok(!adminHtml.includes('Public Contact Page</span>'), 'Public Contact Page badge removed from payment card header');
    for (const provider of ['gcash', 'bpi', 'bdo']) {
        assert.ok(adminHtml.includes(`id="cms_payment_${provider}_enabled"`), `${provider} enabled toggle exists`);
        assert.ok(adminHtml.includes(`id="cms_payment_${provider}_qr_file"`), `${provider} QR file input exists`);
        assert.ok(adminHtml.includes(`id="cms_payment_${provider}_account_name"`), `${provider} account name field exists`);
        assert.ok(adminHtml.includes(`id="cms_payment_${provider}_account_number"`), `${provider} account number field exists`);
    }
    assert.ok(adminHtml.includes('id="cms_payment_bpi_branch"'), 'BPI optional branch field exists');
    assert.ok(adminHtml.includes('id="cms_payment_bdo_branch"'), 'BDO optional branch field exists');
});

test('2. RBAC & Security Controls for Payment Content & QR Image Uploads', async () => {
    // Unauthenticated requests blocked (401)
    const unauthPut = await fetch(`${baseUrl}/api/content/website/contact_us`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ church_name: 'COG Imus', address: 'Imus' })
    });
    assert.equal(unauthPut.status, 401);

    // Member and Leader blocked from saving Website CMS (403)
    for (const token of [memberToken, leaderToken]) {
        const forbiddenPut = await fetch(`${baseUrl}/api/content/website/contact_us`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ church_name: 'COG Imus', address: 'Imus' })
        });
        assert.equal(forbiddenPut.status, 403);

        const fd = new FormData();
        fd.append('image', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), 'qr.png');
        const forbiddenUpload = await fetch(`${baseUrl}/api/content/upload-image?type=payment_qr`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd
        });
        assert.equal(forbiddenUpload.status, 403);
    }

    // Invalid corrupted binary claiming image/png must be rejected with 400
    const spoofFd = new FormData();
    spoofFd.append('image', new Blob([Buffer.from('NOT_A_REAL_PNG_FILE_CONTENT')], { type: 'image/png' }), 'spoof.png');
    const spoofRes = await fetch(`${baseUrl}/api/content/upload-image?type=payment_qr`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: spoofFd
    });
    assert.equal(spoofRes.status, 400);
    const spoofJson = await spoofRes.json();
    assert.match(spoofJson.message, /Invalid QR code image/i);

    // SVG rejected in strict payment_qr mode with 400
    const svgFd = new FormData();
    svgFd.append('image', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'bad.svg');
    const svgRes = await fetch(`${baseUrl}/api/content/upload-image?type=payment_qr`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: svgFd
    });
    assert.equal(svgRes.status, 400);

    // Non-image MIME rejected with 400 (not 500)
    const txtFd = new FormData();
    txtFd.append('image', new Blob(['hello text'], { type: 'text/plain' }), 'notes.txt');
    const txtRes = await fetch(`${baseUrl}/api/content/upload-image?type=payment_qr`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: txtFd
    });
    assert.equal(txtRes.status, 400);
});

test('3. End-to-End Admin QR Upload, Payment Persistence, Validation, & No-Cache Public Sync', async () => {
    // 1. Upload valid PNG QR as Admin
    const uploadFd = new FormData();
    uploadFd.append('image', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), 'gcash-qr.png');
    const uploadRes = await fetch(`${baseUrl}/api/content/upload-image?type=payment_qr`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: uploadFd
    });
    assert.equal(uploadRes.status, 200);
    const uploadData = await uploadRes.json();
    const uploadedUrl = uploadData.data.url;
    assert.ok(uploadedUrl.startsWith('/uploads/content/'));
    uploadedTestFiles.push(uploadedUrl);
    assert.ok(fs.existsSync(path.join(ROOT, uploadedUrl.replace(/^\//, ''))), 'Uploaded QR must exist on disk');

    // 2. Reject enabled provider with missing required account_number
    const invalidSaveRes = await fetch(`${baseUrl}/api/content/website/contact_us`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            church_name: 'COG Imus',
            address: 'Imus, Cavite',
            payment_info: {
                gcash: { enabled: true, account_name: 'COG Imus Treasury', account_number: '', qr_image_url: uploadedUrl }
            }
        })
    });
    assert.equal(invalidSaveRes.status, 400);

    // 3. Save full payment configuration (GCash verified with QR, BPI verified without QR, BDO disabled)
    const validSaveRes = await fetch(`${baseUrl}/api/content/website/contact_us`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            church_name: 'COG Imus',
            email: 'info@cogwmphimus.org',
            phone: '+63 900 000 0000',
            mobile: '0900 000 0000',
            address: 'Imus, Cavite, Philippines',
            office_hours: 'Tue-Sat 9AM-5PM',
            payment_info: {
                gcash: {
                    enabled: true,
                    account_name: 'COG Imus Stewardship',
                    account_number: '0917-000-0001 (Test)',
                    instructions: 'Include Tithes or Offerings in message note.',
                    qr_image_url: uploadedUrl,
                    is_sample: false
                },
                bpi: {
                    enabled: true,
                    account_name: 'COG Imus BPI Test',
                    account_number: '0000-0000-01 (Test)',
                    branch: 'Imus Branch',
                    instructions: 'Send deposit slip via church email.',
                    qr_image_url: '',
                    is_sample: false
                },
                bdo: {
                    enabled: false,
                    account_name: 'Hidden BDO Account',
                    account_number: '0000-0000-0002',
                    branch: 'Imus Aguinaldo',
                    instructions: '',
                    qr_image_url: '/images/sample-qr-placeholder.svg',
                    is_sample: true
                }
            }
        })
    });
    assert.equal(validSaveRes.status, 200);

    // 4. Verify public endpoint returns no-cache headers and persisted payment data immediately
    const publicRes = await fetch(`${baseUrl}/api/public/website/contact_us`);
    assert.equal(publicRes.status, 200);
    assert.match(publicRes.headers.get('cache-control') || '', /no-store/i);
    assert.equal(publicRes.headers.get('pragma'), 'no-cache');

    const publicJson = await publicRes.json();
    const savedPayment = publicJson.data.data.payment_info;
    assert.equal(savedPayment.gcash.enabled, true);
    assert.equal(savedPayment.gcash.account_name, 'COG Imus Stewardship');
    assert.equal(savedPayment.gcash.qr_image_url, uploadedUrl);
    assert.equal(savedPayment.gcash.is_sample, false);
    assert.equal(savedPayment.bpi.enabled, true);
    assert.equal(savedPayment.bpi.branch, 'Imus Branch');
    assert.equal(savedPayment.bpi.qr_image_url, '');
    assert.equal(savedPayment.bdo.enabled, false);

    // 5. Verify missing QR file on disk gracefully falls back without throwing
    const sectionBeforeCleanup = await contentModel.getWebsiteSection('contact_us');
    assert.equal(sectionBeforeCleanup.data.payment_info.gcash.qr_image_url, uploadedUrl);
    fs.unlinkSync(path.join(ROOT, uploadedUrl.replace(/^\//, '')));
    const sectionAfterMissingFile = await contentModel.getWebsiteSection('contact_us');
    assert.equal(sectionAfterMissingFile.data.payment_info.gcash.qr_image_url, '');
});

test('4. Leaders Work Weekly Calendar CSS/DOM Alignment & Mobile Scroll Protection', () => {
    const leaderJs = fs.readFileSync(path.join(ROOT, 'public/js/leader-dashboard.js'), 'utf8');
    const leaderCss = fs.readFileSync(path.join(ROOT, 'public/css/leader.css'), 'utf8');
    const darkCss = fs.readFileSync(path.join(ROOT, 'public/css/dark-theme.css'), 'utf8');

    const requiredWeeklyClasses = [
        '.weekly-day-col',
        '.weekly-day-col.is-today',
        '.weekly-day-col.is-selected',
        '.weekly-day-header',
        '.weekly-day-name',
        '.weekly-day-num',
        '.weekly-day-num.today-pill',
        '.weekly-items-wrap',
        '.weekly-item-card',
        '.weekly-item-card.service-badge',
        '.weekly-item-card.midweek-badge',
        '.weekly-item-card.duty-badge',
        '.weekly-item-card.seminary-badge',
        '.weekly-item-card.event-badge',
        '.weekly-item-title',
        '.weekly-item-time',
        '.weekly-empty-slot'
    ];

    for (const cls of requiredWeeklyClasses) {
        assert.ok(leaderCss.includes(cls), `leader.css must define ${cls}`);
    }

    const requiredDarkClasses = [
        'body.dark-mode .weekly-day-col',
        'body.dark-mode .weekly-day-header',
        'body.dark-mode .weekly-item-card',
        'body.dark-mode .weekly-empty-slot'
    ];
    for (const cls of requiredDarkClasses) {
        assert.ok(darkCss.includes(cls), `dark-theme.css must define ${cls}`);
    }

    assert.ok(leaderCss.includes('#leaderWeeklyViewContainer') && leaderCss.includes('overflow-x: auto'), 'Weekly container enables horizontal scroll on smaller viewports');
    assert.ok(leaderJs.includes('weekly-empty-slot'), 'leader-dashboard.js uses .weekly-empty-slot');
    assert.ok(leaderJs.includes('e.venue || e.location'), 'leader-dashboard.js renders event venue cleanly in selected day details');
});

test('5. Comment Cleanup Safety & Security Documentation Preserved', () => {
    const cryptoJs = fs.readFileSync(path.join(ROOT, 'utils/cryptoHelper.js'), 'utf8');
    const sessionMgr = fs.readFileSync(path.join(ROOT, 'utils/browserSessionManager.js'), 'utf8');
    const authMw = fs.readFileSync(path.join(ROOT, 'middleware/authMiddleware.js'), 'utf8');
    const publicJs = fs.readFileSync(path.join(ROOT, 'public/js/public.js'), 'utf8');
    const adminJs = fs.readFileSync(path.join(ROOT, 'public/js/admin-dashboard.js'), 'utf8');

    assert.ok(cryptoJs.includes('AES-256-GCM'), 'cryptoHelper JSDoc preserved');
    assert.ok(sessionMgr.includes('33 MySQL table count'), 'browserSessionManager invariant comment preserved');
    assert.ok(authMw.includes('Security check: verify user still exists'), 'authMiddleware security comment preserved');
    assert.ok(publicJs.includes('Security: Escape HTML to prevent XSS'), 'public.js XSS security comment preserved');
    assert.ok(adminJs.includes('Escape HTML to protect against XSS'), 'admin-dashboard.js XSS security comment preserved');
    assert.ok(!adminJs.includes('// ============================================================\n'), 'No noisy ASCII banner comment boxes left in admin-dashboard.js');
});

test('6. Frontend JS Functional Execution: Public Payment Hydration, Empty States & Leader Weekly Grid', () => {
    const publicJs = fs.readFileSync(path.join(ROOT, 'public/js/public.js'), 'utf8');
    const makeEl = (id) => ({
        id,
        style: {},
        innerHTML: '',
        textContent: '',
        src: '',
        alt: '',
        className: '',
        classList: {
            _set: new Set(),
            add(...cls) { cls.forEach((c) => this._set.add(c)); },
            remove(...cls) { cls.forEach((c) => this._set.delete(c)); },
            contains(c) { return this._set.has(c); }
        },
        getAttribute(attr) { return this[attr] || ''; }
    });

    const ids = [
        'paymentCardsGrid', 'paymentEmptyState',
        'paymentQrModal', 'paymentQrModalImg', 'paymentQrModalTitle', 'paymentQrModalSub', 'paymentQrModalNum'
    ];
    for (const suf of ['Gcash', 'Bpi', 'Bdo']) {
        ids.push(
            `paymentCard${suf}`, `paymentBadge${suf}`, `paymentQrWrap${suf}`,
            `paymentQrImg${suf}`, `paymentAccName${suf}`, `paymentAccNum${suf}`, `paymentInst${suf}`
        );
    }
    ids.push('paymentBranchRowBpi', 'paymentBranchBpi', 'paymentBranchRowBdo', 'paymentBranchBdo');

    const domMap = new Map(ids.map((id) => [id, makeEl(id)]));
    const sandbox = {
        window: { location: { pathname: '/views/contact.html' }, addEventListener: () => {}, removeEventListener: () => {} },
        document: {
            readyState: 'loading',
            getElementById: (id) => domMap.get(id) || null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {}
        },
        navigator: {},
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        BroadcastChannel: undefined,
        EventSource: undefined,
        console,
        setTimeout,
        clearTimeout
    };
    vm.runInNewContext(publicJs, sandbox);

    // Case A: Sample state renders 3 cards without banner or empty state
    sandbox.window.renderPublicPaymentInfo({
        gcash: { enabled: true, account_name: 'Sample Church', account_number: '09XX-XXX-XXXX', qr_image_url: '/images/sample-qr-placeholder.svg', is_sample: true },
        bpi: { enabled: true, account_name: 'Sample BPI', account_number: 'XXXX-XX', branch: 'Imus', qr_image_url: '/images/sample-qr-placeholder.svg', is_sample: true },
        bdo: { enabled: true, account_name: 'Sample BDO', account_number: 'XXXX-XXXX', branch: 'Imus', qr_image_url: '/images/sample-qr-placeholder.svg', is_sample: true }
    });
    assert.equal(domMap.get('paymentBadgeGcash').textContent, 'Sample Placeholder');
    assert.equal(domMap.get('paymentEmptyState').style.display, 'none');

    // Case B: Verified GCash + BPI without QR + BDO disabled
    sandbox.window.renderPublicPaymentInfo({
        gcash: { enabled: true, account_name: 'COG Official', account_number: '0917-123-4567', qr_image_url: '/uploads/content/qr1.png', is_sample: false },
        bpi: { enabled: true, account_name: 'COG BPI', account_number: '1111-2222-33', branch: '', qr_image_url: '', is_sample: false },
        bdo: { enabled: false, account_name: 'Off', account_number: '0', is_sample: false }
    });
    assert.equal(domMap.get('paymentCardBdo').style.display, 'none');
    assert.equal(domMap.get('paymentCardsGrid').style.display, 'grid');
    assert.equal(domMap.get('paymentBadgeGcash').textContent, 'Official Account');
    assert.ok(domMap.get('paymentQrWrapBpi').innerHTML.includes('payment-qr-empty'));
    assert.equal(domMap.get('paymentBranchRowBpi').style.display, 'none');

    // Lightbox enlarge + close
    sandbox.window.openPaymentQrModal('gcash');
    assert.equal(domMap.get('paymentQrModalImg').src, '/uploads/content/qr1.png');
    assert.ok(domMap.get('paymentQrModal').classList.contains('active'));
    sandbox.window.closePaymentQrModal();
    assert.equal(domMap.get('paymentQrModal').classList.contains('active'), false);

    // Case C: All disabled displays graceful empty notice
    sandbox.window.renderPublicPaymentInfo({
        gcash: { enabled: false },
        bpi: { enabled: false },
        bdo: { enabled: false }
    });
    assert.equal(domMap.get('paymentCardsGrid').style.display, 'none');
    assert.equal(domMap.get('paymentEmptyState').style.display, 'block');

    // Case D: Leader Weekly Calendar functional rendering (7 columns, cards & empty slots)
    const leaderJs = fs.readFileSync(path.join(ROOT, 'public/js/leader-dashboard.js'), 'utf8');
    const leaderDom = new Map([
        ['leaderCalMonthBtn', makeEl('leaderCalMonthBtn')],
        ['leaderCalWeekBtn', makeEl('leaderCalWeekBtn')],
        ['leaderMonthlyViewContainer', makeEl('leaderMonthlyViewContainer')],
        ['leaderWeeklyViewContainer', makeEl('leaderWeeklyViewContainer')],
        ['leaderCalTitle', makeEl('leaderCalTitle')],
        ['leaderWeeklyGrid', makeEl('leaderWeeklyGrid')],
        ['leaderCalSelectedDayDetails', makeEl('leaderCalSelectedDayDetails')]
    ]);
    const leaderSandbox = {
        window: { location: { pathname: '/views/leader-dashboard.html' }, addEventListener: () => {}, matchMedia: () => ({ matches: false }) },
        document: {
            readyState: 'loading',
            getElementById: (id) => leaderDom.get(id) || null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            body: makeEl('body')
        },
        navigator: {},
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        BroadcastChannel: undefined,
        EventSource: undefined,
        console,
        setTimeout,
        clearTimeout,
        Chart: undefined
    };
    const leaderCtx = vm.createContext(leaderSandbox);
    vm.runInContext(leaderJs, leaderCtx);
    vm.runInContext(`
        leaderCalDate = new Date('2026-11-21T10:00:00');
        leaderSelectedDate = new Date('2026-11-21T10:00:00');
        allLeaderEventsCache = [
            { event_id: 1, title: 'Wednesday Prayer Meeting', start_datetime: '2026-11-21T08:33:00', venue: 'Main Sanctuary', event_type: 'Worship' }
        ];
        leaderAssignedMinistriesCache = [
            { ministry_id: 1, ministry_name: 'Dancers', meeting_schedule: 'Mondays 6:00 AM' }
        ];
        setLeaderCalendarMode('weekly');
    `, leaderCtx);

    const renderedWeekHtml = leaderDom.get('leaderWeeklyGrid').innerHTML;
    assert.equal((renderedWeekHtml.match(/class="weekly-day-col/g) || []).length, 7, 'Must render 7 weekly day columns');
    assert.ok(renderedWeekHtml.includes('class="weekly-day-header"'), 'Must render weekly day headers');
    assert.ok(renderedWeekHtml.includes('class="weekly-items-wrap"'), 'Must render scrollable weekly item container');
    assert.ok(renderedWeekHtml.includes('class="weekly-item-card service-badge"'), 'Must render styled Sunday service card');
    assert.ok(renderedWeekHtml.includes('class="weekly-item-card event-badge"'), 'Must render styled event card');
    assert.ok(renderedWeekHtml.includes('class="weekly-empty-slot"'), 'Must render styled empty slot placeholder');
    assert.ok(leaderDom.get('leaderCalSelectedDayDetails').innerHTML.includes('Main Sanctuary'), 'Selected day details uses event venue');
});

test('7. Leader Attendance Bar Graph Renders Chart Axes, Legend & Notice When Filter Matches 0 Records', () => {
    const leaderJs = fs.readFileSync(path.join(ROOT, 'public/js/leader-dashboard.js'), 'utf8');
    const createdCharts = [];

    class MockChart {
        constructor(ctx, config) {
            this.ctx = ctx;
            this.config = config;
            this.destroyed = false;
            createdCharts.push(this);
        }
        destroy() {
            this.destroyed = true;
        }
    }

    const makeChartCanvas = (id) => ({
        id,
        style: {},
        width: 600,
        height: 280,
        getContext: () => ({
            canvas: { id },
            clearRect: () => {},
            save: () => {},
            restore: () => {},
            beginPath: () => {},
            rect: () => {},
            roundRect: () => {},
            fill: () => {},
            stroke: () => {},
            measureText: () => ({ width: 220 }),
            fillText: () => {}
        })
    });

    const elMap = new Map([
        ['attendanceBarChartCanvas', makeChartCanvas('attendanceBarChartCanvas')],
        ['dashAttendanceBarChartCanvas', makeChartCanvas('dashAttendanceBarChartCanvas')],
        ['attChartServiceTypeFilter', { id: 'attChartServiceTypeFilter', value: "Couples' Fellowship" }],
        ['dashAttChartServiceTypeFilter', { id: 'dashAttChartServiceTypeFilter', value: "Couples' Fellowship" }],
        ['attChartYearFilter', { id: 'attChartYearFilter', value: '' }],
        ['dashAttChartYearFilter', { id: 'dashAttChartYearFilter', value: '' }],
        ['attChartMonthFilter', { id: 'attChartMonthFilter', value: '10' }],
        ['dashAttChartMonthFilter', { id: 'dashAttChartMonthFilter', value: '10' }],
        ['chartStatAvg', { textContent: '' }],
        ['dashChartStatAvg', { textContent: '' }],
        ['chartStatPeak', { textContent: '' }],
        ['dashChartStatPeak', { textContent: '' }],
        ['chartStatCount', { textContent: '' }],
        ['dashChartStatCount', { textContent: '' }],
        ['view-dashboard', { classList: { contains: () => false } }]
    ]);

    const sandbox = {
        window: { location: { pathname: '/views/leader-dashboard.html' }, addEventListener: () => {}, matchMedia: () => ({ matches: false }) },
        document: {
            readyState: 'loading',
            getElementById: (id) => elMap.get(id) || null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            body: { classList: { contains: () => false } }
        },
        navigator: {},
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        BroadcastChannel: undefined,
        EventSource: undefined,
        Chart: MockChart,
        console,
        setTimeout,
        clearTimeout
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(leaderJs, ctx);

    // Filter matching 0 records in October (e.g. Couples' Fellowship / All Years / October)
    vm.runInContext(`
        allAttendanceTalliesCache = [
            { service_date: '2026-11-01', service_type: 'Sunday Worship', adult_count: 50, youth_count: 20, children_count: 10, visitor_count: 5, total_count: 85 }
        ];
        applyAttendanceChartFilters();
    `, ctx);

    assert.equal(createdCharts.length, 2, 'Must instantiate Chart.js bar graphs on both Attendance and Dashboard canvases even with 0 matching records');
    const attChart = JSON.parse(JSON.stringify(createdCharts[0].config));
    const attPlugins = createdCharts[0].config.plugins;
    assert.equal(attChart.type, 'bar');
    assert.equal(attChart.data.datasets.length, 4, 'Must retain Adults, Youth, Children, and Visitors datasets');
    assert.deepEqual(attChart.data.datasets.map(d => d.label), ['Adults', 'Youth', 'Children', 'Visitors']);
    assert.equal(attChart.data.labels.length, 4, 'Specific month with 0 rows displays Week 1..Week 4 X-axis labels');
    assert.deepEqual(attChart.data.labels[0], ['Week 1', 'Oct (All Years)']);
    assert.deepEqual(attChart.data.datasets[0].data, [0, 0, 0, 0]);
    assert.equal(attChart.options.scales.y.suggestedMax, 10);
    assert.ok(attPlugins.some(p => p.id === 'emptyAttendanceOverlay'), 'Registers overlay notice plugin inside the rendered bar graph');

    // Verify plugin draws without throwing
    const mockCtx2d = elMap.get('attendanceBarChartCanvas').getContext();
    assert.doesNotThrow(() => {
        attPlugins[0].afterDraw({ chartArea: { left: 40, right: 560, top: 30, bottom: 240 }, ctx: mockCtx2d });
    });

    // Also verify All Months + 0 matching records displays Jan..Dec baseline graph
    createdCharts.length = 0;
    vm.runInContext(`renderAttendanceBarChart([], '', { year: '2026', serviceType: "Couples' Fellowship" });`, ctx);
    assert.equal(createdCharts.length, 2);
    const allMonthsConfig = JSON.parse(JSON.stringify(createdCharts[0].config));
    assert.equal(allMonthsConfig.data.labels.length, 12, 'All Months with 0 rows displays all 12 calendar months');
    assert.deepEqual(allMonthsConfig.data.labels[9], ['Oct', '2026']);
});
