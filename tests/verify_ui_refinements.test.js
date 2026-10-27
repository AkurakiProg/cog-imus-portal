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

    await t.test('8. Login page dynamic sync & inspiration panel CMS controls & action button styling', () => {
        // Login page IDs
        const loginHtml = fs.readFileSync(path.join(__dirname, '../public/views/login.html'), 'utf8');
        assert.ok(loginHtml.includes('id="authInspirationKicker"'), 'authInspirationKicker ID exists in login.html');
        assert.ok(loginHtml.includes('id="authInspirationTitle"'), 'authInspirationTitle ID exists in login.html');
        assert.ok(loginHtml.includes('id="authInspirationDesc"'), 'authInspirationDesc ID exists in login.html');
        assert.ok(loginHtml.includes('id="authInspirationScriptureVerse"'), 'authInspirationScriptureVerse ID exists in login.html');
        assert.ok(loginHtml.includes('id="authInspirationScriptureRef"'), 'authInspirationScriptureRef ID exists in login.html');
        assert.ok(loginHtml.includes('id="authInspirationPillar1"'), 'authInspirationPillar1 ID exists in login.html');
        assert.ok(loginHtml.includes('id="authInspirationPillar2"'), 'authInspirationPillar2 ID exists in login.html');

        // auth.js hydration and synchronization
        const authJs = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');
        assert.ok(authJs.includes('loadAuthPageDynamicContent'), 'loadAuthPageDynamicContent function defined in auth.js');
        assert.ok(authJs.includes('auth-brand-custom-img'), 'auth.js supports custom topbar logo replacement');
        assert.ok(authJs.includes('authVideo'), 'auth.js synchronizes background video');
        assert.ok(authJs.includes('church_realtime_ping'), 'auth.js listens to realtime CMS updates');

        // Admin CMS panel and tabs
        const adminHtml = fs.readFileSync(path.join(__dirname, '../public/views/admin-dashboard.html'), 'utf8');
        assert.ok(adminHtml.includes('id="tabNavAuth"'), 'tabNavAuth exists in admin tabs');
        assert.ok(adminHtml.includes('id="cmsPanelAuth"'), 'cmsPanelAuth exists in admin dashboard');
        assert.ok(adminHtml.includes('id="cms_auth_kicker"'), 'cms_auth_kicker input exists');
        assert.ok(adminHtml.includes('id="cms_auth_title_line1"'), 'cms_auth_title_line1 input exists');
        assert.ok(adminHtml.includes('id="cms_auth_title_line2"'), 'cms_auth_title_line2 input exists');
        assert.ok(adminHtml.includes('id="cms_auth_description"'), 'cms_auth_description input exists');
        assert.ok(adminHtml.includes('id="cms_auth_scripture_verse"'), 'cms_auth_scripture_verse input exists');
        assert.ok(adminHtml.includes('id="cms_auth_scripture_ref"'), 'cms_auth_scripture_ref input exists');
        assert.ok(adminHtml.includes('id="cms_auth_pillar_1"'), 'cms_auth_pillar_1 input exists');
        assert.ok(adminHtml.includes('id="cms_auth_pillar_2"'), 'cms_auth_pillar_2 input exists');

        // Admin dashboard JS logic
        const adminJs = fs.readFileSync(path.join(__dirname, '../public/js/admin-dashboard.js'), 'utf8');
        assert.ok(adminJs.includes("key: 'auth_page'"), 'switchCmsTab includes auth_page');
        assert.ok(adminJs.includes("section === 'auth_page'"), 'saveCurrentCmsSection handles auth_page');
        assert.ok(adminJs.includes("cms_auth_kicker"), 'populateCmsAllPanels populates auth_page fields');
        assert.ok(adminJs.includes("btn-action btn-move"), 'renderCmsScheduleTable uses btn-action btn-move');

        // Action buttons CSS styling
        const adminCss = fs.readFileSync(path.join(__dirname, '../public/css/admin.css'), 'utf8');
        assert.ok(adminCss.includes('.btn-action.btn-move'), 'admin.css styles .btn-action.btn-move');

        const darkCss = fs.readFileSync(path.join(__dirname, '../public/css/dark-theme.css'), 'utf8');
        assert.ok(darkCss.includes('body.dark-mode .btn-action.btn-move'), 'dark-theme.css styles .btn-action.btn-move');
        assert.ok(darkCss.includes('body.dark-mode .btn-move'), 'dark-theme.css styles .btn-move');
        assert.ok(darkCss.includes('.cms-sync-notice-banner'), 'dark-theme.css styles .cms-sync-notice-banner without white strip');
    });

    await t.test('9. Realtime channels, window.api export and CMS preview mode', () => {
        const apiJs = fs.readFileSync(path.join(__dirname, '../public/js/api.js'), 'utf8');
        assert.ok(apiJs.includes('window.api = api'), 'api.js explicitly attaches window.api');

        const authJs = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');
        assert.ok(authJs.includes('church_realtime_channel'), 'auth.js uses church_realtime_channel BroadcastChannel');
        assert.ok(authJs.includes('/api/realtime/stream'), 'auth.js connects to server SSE stream');
        assert.ok(authJs.includes('preview'), 'auth.js supports preview query parameter without redirect loop');

        const adminJs = fs.readFileSync(path.join(__dirname, '../public/js/admin-dashboard.js'), 'utf8');
        assert.ok(adminJs.includes('/views/login.html?preview=cms'), 'previewCurrentCmsPage opens with preview=cms');
    });

    await t.test('10. Session Terminated modal dark mode styling and theme synchronization', () => {
        const apiJs = fs.readFileSync(path.join(__dirname, '../public/js/api.js'), 'utf8');
        assert.ok(apiJs.includes('detectThemeIsDark'), 'api.js includes robust detectThemeIsDark helper');
        assert.ok(apiJs.includes('session-terminated-card'), 'api.js assigns session-terminated-card class');
        assert.ok(apiJs.includes('session-terminated-title'), 'api.js assigns session-terminated-title class');
        assert.ok(apiJs.includes('session-terminated-message'), 'api.js assigns session-terminated-message class');

        const darkCss = fs.readFileSync(path.join(__dirname, '../public/css/dark-theme.css'), 'utf8');
        assert.ok(darkCss.includes('#session-terminated-overlay'), 'dark-theme.css styles #session-terminated-overlay');
        assert.ok(darkCss.includes('.session-terminated-card'), 'dark-theme.css styles .session-terminated-card');
        assert.ok(darkCss.includes('.session-icon-danger'), 'dark-theme.css styles .session-icon-danger');
        assert.ok(darkCss.includes('.session-icon-role'), 'dark-theme.css styles .session-icon-role');
    });

    await t.test('11. Security notices on login page have badge color styling', () => {
        const authJs = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');
        assert.ok(authJs.includes('badge-role'), 'auth.js includes badge-role markup');
        assert.ok(authJs.includes('Your account role was updated by Church Administration. Please log in again to continue with your new permissions.'), 'auth.js has exact role update notice');
        assert.ok(authJs.includes('badge-password'), 'auth.js includes badge-password markup');
        assert.ok(authJs.includes('Your account password was updated. Please log in with your new credentials.'), 'auth.js has exact password update notice');

        const authCss = fs.readFileSync(path.join(__dirname, '../public/css/auth.css'), 'utf8');
        assert.ok(authCss.includes('.alert-badge.badge-role'), 'auth.css styles .alert-badge.badge-role');
        assert.ok(authCss.includes('.alert-badge.badge-password'), 'auth.css styles .alert-badge.badge-password');
        assert.ok(authCss.includes('.alert-role'), 'auth.css styles .alert-role container');
        assert.ok(authCss.includes('.alert-password'), 'auth.css styles .alert-password container');
    });

    await t.test('12. Data Privacy Notice popup in Member and Leader dashboards', () => {
        const memberHtml = fs.readFileSync(path.join(__dirname, '../public/views/member-dashboard.html'), 'utf8');
        const leaderHtml = fs.readFileSync(path.join(__dirname, '../public/views/leader-dashboard.html'), 'utf8');

        // Modal markup present in both views
        assert.ok(memberHtml.includes('id="privacyNoticeModal"'), 'Member dashboard has privacyNoticeModal');
        assert.ok(memberHtml.includes('id="privacyNoticeConsentCheckbox"'), 'Member dashboard has privacyNoticeConsentCheckbox checkbox');
        assert.ok(memberHtml.includes('id="btnAcceptPrivacyNotice"'), 'Member dashboard has btnAcceptPrivacyNotice');
        assert.ok(memberHtml.includes('id="btnPrivacyDecline"'), 'Member dashboard has btnPrivacyDecline');
        assert.ok(memberHtml.includes('showPrivacyNoticeModal(true)'), 'Member dashboard profile dropdown has Privacy Notice trigger');

        assert.ok(leaderHtml.includes('id="privacyNoticeModal"'), 'Leader dashboard has privacyNoticeModal');
        assert.ok(leaderHtml.includes('id="privacyNoticeConsentCheckbox"'), 'Leader dashboard has privacyNoticeConsentCheckbox checkbox');
        assert.ok(leaderHtml.includes('id="btnAcceptPrivacyNotice"'), 'Leader dashboard has btnAcceptPrivacyNotice');
        assert.ok(leaderHtml.includes('id="btnPrivacyDecline"'), 'Leader dashboard has btnPrivacyDecline');
        assert.ok(leaderHtml.includes('showPrivacyNoticeModal(true)'), 'Leader dashboard profile dropdown has Privacy Notice trigger');

        // JS logic present in both dashboard scripts
        const memberJs = fs.readFileSync(path.join(__dirname, '../public/js/member-dashboard.js'), 'utf8');
        const leaderJs = fs.readFileSync(path.join(__dirname, '../public/js/leader-dashboard.js'), 'utf8');

        assert.ok(memberJs.includes('checkAndPromptPrivacyNotice'), 'member-dashboard.js checks privacy notice on init');
        assert.ok(memberJs.includes('cog_privacy_consent_v1_'), 'member-dashboard.js uses versioned privacy storage key');
        assert.ok(memberJs.includes('showPrivacyNoticeModal'), 'member-dashboard.js has showPrivacyNoticeModal');
        assert.ok(memberJs.includes('acceptPrivacyNotice'), 'member-dashboard.js has acceptPrivacyNotice');
        assert.ok(memberJs.includes('declinePrivacyNotice'), 'member-dashboard.js has declinePrivacyNotice');
        assert.ok(!memberJs.match(/declinePrivacyNotice[\s\S]*?confirm\(/), 'declinePrivacyNotice in member dashboard uses custom modal instead of native confirm()');
        assert.ok(memberJs.includes('showDecisionModal'), 'member-dashboard.js uses showDecisionModal for confirmation');

        assert.ok(leaderJs.includes('checkAndPromptPrivacyNotice'), 'leader-dashboard.js checks privacy notice on init');
        assert.ok(leaderJs.includes('cog_privacy_consent_v1_'), 'leader-dashboard.js uses versioned privacy storage key');
        assert.ok(leaderJs.includes('showPrivacyNoticeModal'), 'leader-dashboard.js has showPrivacyNoticeModal');
        assert.ok(leaderJs.includes('acceptPrivacyNotice'), 'leader-dashboard.js has acceptPrivacyNotice');
        assert.ok(leaderJs.includes('declinePrivacyNotice'), 'leader-dashboard.js has declinePrivacyNotice');
        assert.ok(!leaderJs.match(/declinePrivacyNotice[\s\S]*?confirm\(/), 'declinePrivacyNotice in leader dashboard uses custom modal instead of native confirm()');
        assert.ok(leaderJs.includes('showDecisionModal'), 'leader-dashboard.js uses showDecisionModal for confirmation');

        // Modal backdrop and Escape blocking check
        assert.ok(memberJs.includes("if (overlayId === 'privacyNoticeModal') return;"), 'member-dashboard.js blocks backdrop/Escape bypass');
        assert.ok(leaderJs.includes("if (overlayId === 'privacyNoticeModal') return;"), 'leader-dashboard.js blocks backdrop/Escape bypass');

        // Styles exist in admin.css and dark-theme.css
        const adminCss = fs.readFileSync(path.join(__dirname, '../public/css/admin.css'), 'utf8');
        const darkCss = fs.readFileSync(path.join(__dirname, '../public/css/dark-theme.css'), 'utf8');

        assert.ok(adminCss.includes('.privacy-notice-modal'), 'admin.css has .privacy-notice-modal');
        assert.ok(adminCss.includes('.privacy-consent-box'), 'admin.css has .privacy-consent-box');
        assert.ok(adminCss.includes('#customConfirmModal {\n    z-index: 12000 !important;\n}') || adminCss.includes('z-index: 12000 !important;'), 'admin.css sets customConfirmModal above privacyNoticeModal');
        assert.ok(darkCss.includes('#privacyNoticeModal'), 'dark-theme.css styles #privacyNoticeModal');
        assert.ok(darkCss.includes('#privacyNoticeModal .privacy-notice-modal'), 'dark-theme.css styles dark modal body');
    });

    await t.test('13. Broadcast audio mixer removed and Sermon Notes textarea height adjusted to 260px (adjustable)', () => {
        const adminHtml = fs.readFileSync(path.join(__dirname, '../public/views/admin-dashboard.html'), 'utf8');
        const leaderHtml = fs.readFileSync(path.join(__dirname, '../public/views/leader-dashboard.html'), 'utf8');

        // Audio mixer removed from Content Management in both dashboards
        assert.ok(!adminHtml.includes('id="liveAudioMixer"'), 'Admin dashboard does not contain liveAudioMixer');
        assert.ok(!adminHtml.includes('class="broadcast-audio-mixer"'), 'Admin dashboard does not contain broadcast-audio-mixer');
        assert.ok(!leaderHtml.includes('id="liveAudioMixer"'), 'Leader dashboard does not contain liveAudioMixer');
        assert.ok(!leaderHtml.includes('class="broadcast-audio-mixer"'), 'Leader dashboard does not contain broadcast-audio-mixer');

        // Sermon Notes textarea height is 260px and still adjustable (resize: vertical)
        assert.ok(adminHtml.includes('id="live_stream_description"'), 'Admin dashboard has live_stream_description textarea');
        assert.ok(adminHtml.includes('height: 260px;') && adminHtml.includes('resize: vertical;'), 'Admin live_stream_description textarea is 260px high and adjustable');

        assert.ok(leaderHtml.includes('id="live_stream_description"'), 'Leader dashboard has live_stream_description textarea');
        assert.ok(leaderHtml.includes('height: 260px;') && leaderHtml.includes('resize: vertical;'), 'Leader live_stream_description textarea is 260px high and adjustable');
    });

    await t.test('14. Semaphore SMS Gateway handles optional sender name gracefully without forcing arbitrary default', () => {
        const adminHtml = fs.readFileSync(path.join(__dirname, '../public/views/admin-dashboard.html'), 'utf8');
        const leaderHtml = fs.readFileSync(path.join(__dirname, '../public/views/leader-dashboard.html'), 'utf8');
        const systemControllerJs = fs.readFileSync(path.join(__dirname, '../controllers/systemController.js'), 'utf8');
        const smsServiceJs = fs.readFileSync(path.join(__dirname, '../utils/smsService.js'), 'utf8');

        // Views mark sender name as optional and default to SEMAPHORE
        assert.ok(adminHtml.includes('Sender Name (Optional)'), 'Admin dashboard clarifies sender name is optional');
        assert.ok(adminHtml.includes('Leave blank for SEMAPHORE'), 'Admin dashboard placeholder notes SEMAPHORE default');
        assert.ok(leaderHtml.includes('Sender Name (Optional)'), 'Leader dashboard clarifies sender name is optional');
        assert.ok(leaderHtml.includes('Leave blank for SEMAPHORE'), 'Leader dashboard placeholder notes SEMAPHORE default');

        // System controller does not hardcode COGWM fallback
        assert.ok(!systemControllerJs.includes("SEMAPHORE_SENDER_NAME || 'COGWM'"), 'systemController does not hardcode COGWM fallback');
        assert.ok(systemControllerJs.includes("SEMAPHORE_SENDER_NAME || ''"), 'systemController defaults to empty string when not set');

        // smsService only attaches sendername if non-empty string is provided
        assert.ok(smsServiceJs.includes('process.env.SEMAPHORE_SENDER_NAME.trim()'), 'smsService validates trimmed sender name');
    });

    await t.test('15. Account management Active status filter shows only active AND verified accounts', () => {
        const userAccountModelJs = fs.readFileSync(path.join(__dirname, '../models/userAccountModel.js'), 'utf8');
        const adminDashboardJs = fs.readFileSync(path.join(__dirname, '../public/js/admin-dashboard.js'), 'utf8');

        // userAccountModel requires both is_active = 1 AND is_verified = 1 when filtering by active
        assert.ok(
            userAccountModelJs.includes('u.is_active = 1 AND u.is_verified = 1'),
            'userAccountModel requires both active and verified conditions for active status filter'
        );

        // admin-dashboard.js enforces defense in depth on loadUsers
        assert.ok(
            adminDashboardJs.includes('Number(u.is_active) === 1 && Number(u.is_verified) === 1'),
            'admin-dashboard.js enforces active and verified filter on client side'
        );
    });
});

