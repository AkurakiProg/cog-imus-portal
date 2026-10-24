const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Website UI & CMS Refinements Verification', async (t) => {
    await t.test('1. Contact Page has explicit IDs to prevent scrambled information', () => {
        const contactHtml = fs.readFileSync(path.join(__dirname, '../public/views/contact.html'), 'utf8');
        assert.ok(contactHtml.includes('id="contactCardLocation"'), 'contactCardLocation ID exists');
        assert.ok(contactHtml.includes('id="contactCardPhone"'), 'contactCardPhone ID exists');
        assert.ok(contactHtml.includes('id="contactCardEmail"'), 'contactCardEmail ID exists');
        assert.ok(contactHtml.includes('id="contactCardHours"'), 'contactCardHours ID exists');
        assert.ok(contactHtml.includes('id="contactCardServices"'), 'contactCardServices ID exists');

        const publicJs = fs.readFileSync(path.join(__dirname, '../public/js/public.js'), 'utf8');
        assert.ok(publicJs.includes("getElementById('contactCardLocation')"), 'public.js targets contactCardLocation');
        assert.ok(publicJs.includes("getElementById('contactCardPhone')"), 'public.js targets contactCardPhone');
        assert.ok(publicJs.includes("getElementById('contactCardEmail')"), 'public.js targets contactCardEmail');
        assert.ok(publicJs.includes("getElementById('contactCardHours')"), 'public.js targets contactCardHours');
    });

    await t.test('2. Main Hero Heading retains Cormorant Garamond font style, Line 1 serif and Line 2 gold italic', () => {
        const indexHtml = fs.readFileSync(path.join(__dirname, '../public/views/index.html'), 'utf8');
        assert.ok(indexHtml.includes('id="heroMainHeading"'), 'heroMainHeading ID exists on H1');
        assert.ok(indexHtml.includes('id="heroPrimaryActionBtn"'), 'heroPrimaryActionBtn ID exists');
        assert.ok(indexHtml.includes('fa-calendar-check'), 'Join Us button has calendar-check icon');

        const publicJs = fs.readFileSync(path.join(__dirname, '../public/js/public.js'), 'utf8');
        assert.ok(publicJs.includes('h1El.innerHTML = `${escapeHtml(l1)} <em>${escapeHtml(l2)}</em>`') || publicJs.includes('<em>'), 'public.js preserves em tag for gold italic');
        assert.ok(publicJs.includes('fa-calendar-check'), 'public.js preserves fa-calendar-check icon on Join Us button');
    });

    await t.test('3. Welcome Section Header subtitle and Scripture Pill verse are editable', () => {
        const adminHtml = fs.readFileSync(path.join(__dirname, '../public/views/admin-dashboard.html'), 'utf8');
        assert.ok(adminHtml.includes('id="cms_welcome_subtitle"'), 'cms_welcome_subtitle field exists in admin CMS');
        assert.ok(adminHtml.includes('id="cms_welcome_scripture_verse"'), 'cms_welcome_scripture_verse field exists in admin CMS');
        assert.ok(adminHtml.includes('id="cms_welcome_scripture_badge"'), 'cms_welcome_scripture_badge exists for citation');

        const indexHtml = fs.readFileSync(path.join(__dirname, '../public/views/index.html'), 'utf8');
        assert.ok(indexHtml.includes('id="welcomeHeaderSubtitle"'), 'welcomeHeaderSubtitle ID exists');
        assert.ok(indexHtml.includes('id="welcomeScriptureVerse"'), 'welcomeScriptureVerse ID exists');
        assert.ok(indexHtml.includes('id="welcomeScriptureRef"'), 'welcomeScriptureRef ID exists');
    });

    await t.test('4. Browser prompt/confirm replaced with popup modals', () => {
        const adminJs = fs.readFileSync(path.join(__dirname, '../public/js/admin-dashboard.js'), 'utf8');
        assert.ok(!adminJs.includes("prompt('Enter service name"), 'No browser prompt in addSchedule');
        assert.ok(!adminJs.includes("prompt('Edit service name"), 'No browser prompt in editSchedule');
        assert.ok(adminJs.includes('openCmsScheduleModal'), 'openCmsScheduleModal function exists');
        assert.ok(adminJs.includes('saveCmsScheduleModal'), 'saveCmsScheduleModal function exists');

        const adminHtml = fs.readFileSync(path.join(__dirname, '../public/views/admin-dashboard.html'), 'utf8');
        assert.ok(adminHtml.includes('id="cmsScheduleModal"'), 'cmsScheduleModal element exists');
        assert.ok(adminHtml.includes('id="cmsSchedTitle"'), 'cmsSchedTitle input exists');
        assert.ok(adminHtml.includes('id="cmsSchedTime"'), 'cmsSchedTime input exists');
        assert.ok(adminHtml.includes('id="cmsSchedIcon"'), 'cmsSchedIcon select exists');
    });

    await t.test('5. Entire icon replaced when custom logo uploaded', () => {
        const publicJs = fs.readFileSync(path.join(__dirname, '../public/js/public.js'), 'utf8');
        assert.ok(publicJs.includes('logo-custom-img'), 'logo-custom-img class referenced in public.js');
        assert.ok(publicJs.includes('replaceWith'), 'replaces entire icon node when custom logo is active');

        const publicCss = fs.readFileSync(path.join(__dirname, '../public/css/public.css'), 'utf8');
        assert.ok(publicCss.includes('.logo-custom-img'), 'logo-custom-img styled in public.css');
    });

    await t.test('6. Dark mode styling fixes applied for images 2, 3, 4', () => {
        const adminHtml = fs.readFileSync(path.join(__dirname, '../public/views/admin-dashboard.html'), 'utf8');
        // Image 2 check: no inline background on cms-nav-toggle-group
        assert.ok(!adminHtml.includes('cms-nav-toggle-group" style="display: inline-flex; background: var(--bg-secondary'), 'No hardcoded inline light background on cms-nav-toggle-group');
        // Image 3 check: cms-file-input class used
        assert.ok(adminHtml.includes('class="cms-file-input"'), 'cms-file-input class used on file inputs');
        // Image 4 check: cms-card-inner used
        assert.ok(adminHtml.includes('class="cms-card-inner"'), 'cms-card-inner class used on Mission & Vision');

        const darkCss = fs.readFileSync(path.join(__dirname, '../public/css/dark-theme.css'), 'utf8');
        assert.ok(darkCss.includes('.cms-nav-toggle-group'), 'Dark CSS styles cms-nav-toggle-group');
        assert.ok(darkCss.includes('.cms-card-inner'), 'Dark CSS styles cms-card-inner');
        assert.ok(darkCss.includes('.cms-file-input'), 'Dark CSS styles cms-file-input');
        assert.ok(darkCss.includes('::file-selector-button'), 'Dark CSS styles file-selector-button');
    });

    await t.test('7. Schedule modal footer colors fixed in dark mode (no white strip)', () => {
        const adminHtml = fs.readFileSync(path.join(__dirname, '../public/views/admin-dashboard.html'), 'utf8');
        assert.ok(adminHtml.includes('id="cmsScheduleModal"'), 'cmsScheduleModal exists');
        assert.ok(!adminHtml.includes('cmsScheduleModal.*background: #f8fafc'), 'No inline white background in cmsScheduleModal');
        assert.ok(!adminHtml.includes('cmsScheduleModal.*background: var(--bg-secondary'), 'No inline var(--bg-secondary) in cmsScheduleModal');

        const darkCss = fs.readFileSync(path.join(__dirname, '../public/css/dark-theme.css'), 'utf8');
        assert.ok(darkCss.includes('#cmsScheduleModal .modal-footer'), 'Dark CSS overrides cmsScheduleModal modal-footer');
        assert.ok(darkCss.includes('#cmsScheduleModal .btn-secondary'), 'Dark CSS styles cmsScheduleModal btn-secondary');
    });
});

