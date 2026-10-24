const assert = require('assert');
const { pool } = require('../config/database');
const contentModel = require('../models/contentModel');
const publicModel = require('../models/publicModel');
const upload = require('../middleware/uploadMiddleware');
const fs = require('fs');

async function testAll() {
    console.log('=== RUNNING COMPREHENSIVE CMS & SYSTEM VERIFICATION ===\n');

    // 1. Verify Database CMS tables and rows
    console.log('Test 1: Database content_pages schema and seeds...');
    const [rows] = await pool.query('SELECT page_key, title FROM content_pages');
    const keys = rows.map(r => r.page_key);
    assert(keys.includes('homepage'), 'homepage must exist in content_pages');
    assert(keys.includes('about_us'), 'about_us must exist in content_pages');
    assert(keys.includes('contact_us'), 'contact_us must exist in content_pages');
    assert(keys.includes('footer'), 'footer must exist in content_pages');
    assert(keys.includes('site_branding'), 'site_branding must exist in content_pages');
    console.log('✓ All 5 website CMS sections exist in database');

    // 2. Verify 0 occurrences of COGWM Imus in database
    console.log('\nTest 2: Database text replacement verification...');
    const [dbHits] = await pool.query("SELECT id FROM livestream_broadcast WHERE description LIKE '%COGWM Imus%'");
    assert.strictEqual(dbHits.length, 0, 'No rows in livestream_broadcast should contain COGWM Imus');
    console.log('✓ Database contains 0 occurrences of COGWM Imus');

    // 3. Verify Content Model CMS operations
    console.log('\nTest 3: Content Model CMS CRUD and legacy sync...');
    const hpData = await contentModel.getWebsiteSection('homepage');
    assert(hpData, 'Homepage content must be retrievable');
    assert(hpData.data.hero, 'Homepage hero must be present');
    assert(
        hpData.data.hero.heading === 'A Place to Belong, <em>A Faith to Believe.</em>' ||
        hpData.data.hero.heading === 'A Place to Belong, A Faith to Believe.',
        'Homepage hero heading must match expected title'
    );

    // Test saveWebsiteSection
    const testUpdate = { ...hpData.data };
    testUpdate.hero.badge = 'A Christ-Centered Sanctuary in Imus - Verified';
    await contentModel.saveWebsiteSection('homepage', testUpdate, 1);
    const updatedHp = await contentModel.getWebsiteSection('homepage');
    assert.strictEqual(updatedHp.data.hero.badge, 'A Christ-Centered Sanctuary in Imus - Verified');
    // Restore
    testUpdate.hero.badge = 'A Christ-Centered Sanctuary in Imus';
    await contentModel.saveWebsiteSection('homepage', testUpdate, 1);
    console.log('✓ ContentModel getWebsiteSection and saveWebsiteSection work with database persistence');

    // 4. Verify Public Model integration
    console.log('\nTest 4: Public Model website content API...');
    const allPublic = await publicModel.getWebsiteContent('all');
    assert(allPublic.homepage, 'Public all content must contain homepage');
    assert(allPublic.about_us, 'Public all content must contain about_us');
    assert(allPublic.contact_us, 'Public all content must contain contact_us');
    assert(allPublic.footer, 'Public all content must contain footer');
    console.log('✓ PublicModel.getWebsiteContent returns complete structured payload');

    // 5. Verify Video Upload Middleware 100 MB Limit
    console.log('\nTest 5: Background Video 100 MB upload limit enforcement...');
    assert.strictEqual(upload.video.limits.fileSize, 100 * 1024 * 1024, 'Video fileSize limit must be exactly 100 MB');
    console.log('✓ Multer fileSize limit strictly set to 100 MB (104,857,600 bytes)');

    // 6. Verify Scroll Mouse Pill Centering in public.css
    console.log('\nTest 6: Scroll Mouse Pill CSS Centering...');
    const publicCss = fs.readFileSync('public/css/public.css', 'utf8');
    assert(publicCss.includes('@keyframes heroFadeUpCentered'), 'heroFadeUpCentered keyframe must exist');
    assert(publicCss.includes('transform: translate(-50%, 24px)'), 'Pill entrance must preserve -50% translateX');
    assert(publicCss.includes('transform: translate(-50%, 0)'), 'Pill final position must preserve -50% translateX');
    assert(publicCss.includes('bottom: 1.5rem !important'), 'Pill must be visible and centered on tablet & mobile');
    console.log('✓ Scroll mouse pill has dedicated centered animation and responsive viewport centering');

    // 7. Verify Global Text Replacement in files
    console.log('\nTest 7: Global text replacement verification across codebase...');
    const checkFiles = [
        'public/views/index.html',
        'public/views/history.html',
        'public/views/contact.html',
        'public/views/events.html',
        'public/views/gallery.html',
        'public/views/sermons.html',
        'public/views/login.html',
        'public/views/admin-dashboard.html',
        'public/views/leader-dashboard.html',
        'public/views/member-dashboard.html',
        'utils/emailService.js',
        'controllers/systemController.js'
    ];

    for (const f of checkFiles) {
        const content = fs.readFileSync(f, 'utf8');
        assert(!content.includes('COGWM Imus'), `${f} must not contain COGWM Imus`);
        assert(content.includes('COG Imus'), `${f} must contain COG Imus`);
    }
    console.log('✓ All 12 key application files verified: 0 COGWM Imus, COG Imus present');

    console.log('\n=== ALL COMPREHENSIVE CMS & SYSTEM TESTS PASSED SUCCESSFULLY! ===');
    process.exit(0);
}

testAll().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
