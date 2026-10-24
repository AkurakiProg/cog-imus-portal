const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Mobile Responsiveness Audit & Layout Verification', async (t) => {
    const adminHtml = fs.readFileSync(path.join(__dirname, '../public/views/admin-dashboard.html'), 'utf8');
    const leaderHtml = fs.readFileSync(path.join(__dirname, '../public/views/leader-dashboard.html'), 'utf8');
    const memberHtml = fs.readFileSync(path.join(__dirname, '../public/views/member-dashboard.html'), 'utf8');
    const adminCss = fs.readFileSync(path.join(__dirname, '../public/css/admin.css'), 'utf8');
    const darkThemeCss = fs.readFileSync(path.join(__dirname, '../public/css/dark-theme.css'), 'utf8');

    await t.test('1. Viewport Meta Tags present across all dashboard HTML pages', () => {
        const metaTag = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
        assert.ok(adminHtml.includes(metaTag), 'admin-dashboard.html has viewport meta tag');
        assert.ok(leaderHtml.includes(metaTag), 'leader-dashboard.html has viewport meta tag');
        assert.ok(memberHtml.includes(metaTag), 'member-dashboard.html has viewport meta tag');
    });

    await t.test('2. Base CSS Box Sizing, Viewport Width, and Image Containment', () => {
        assert.ok(adminCss.includes('box-sizing: border-box;'), 'admin.css sets box-sizing: border-box on universal selector');
        assert.ok(adminCss.includes('overflow-x: hidden;'), 'admin.css sets overflow-x: hidden on html/body');
        assert.ok(adminCss.includes('max-width: 100%;'), 'admin.css sets max-width: 100% on html/body');
        assert.ok(adminCss.includes('img, video, iframe, canvas'), 'admin.css defines responsive media rules');
        assert.ok(adminCss.includes('height: auto;'), 'media tags have height: auto for proportional scaling');
    });

    await t.test('3. Universal Responsive Table Architecture (.overflow-x-auto & .table-responsive)', () => {
        assert.ok(adminCss.includes('.overflow-x-auto') && adminCss.includes('.table-responsive'), '.overflow-x-auto and .table-responsive exist in admin.css');
        assert.ok(adminCss.includes('-webkit-overflow-scrolling: touch;'), 'Touch momentum scrolling enabled for iOS Safari');
        assert.ok(adminCss.includes('overflow-x: auto !important;'), 'Horizontal scrolling explicitly enabled');
        assert.ok(adminCss.includes('min-width: 660px;') || adminCss.includes('min-width: 700px;'), 'Tables maintain readability with min-width rather than squeezing columns');
    });

    await t.test('4. All tables in all 3 dashboards are wrapped in responsive overflow containers', () => {
        const dashboards = [
            { name: 'Admin Dashboard', content: adminHtml },
            { name: 'Leader Dashboard', content: leaderHtml },
            { name: 'Member Dashboard', content: memberHtml }
        ];

        dashboards.forEach(({ name, content }) => {
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('<table')) {
                    const prevLines = lines.slice(Math.max(0, idx - 5), idx).join(' ');
                    const hasWrapper = prevLines.includes('overflow-x-auto') ||
                                       prevLines.includes('table-responsive') ||
                                       prevLines.includes('overflow-x: auto') ||
                                       prevLines.includes('overflow-x:auto') ||
                                       prevLines.includes('overflow: auto') ||
                                       prevLines.includes('overflow:auto');
                    assert.ok(
                        hasWrapper,
                        `${name} table at line ${idx + 1} (${line.trim().slice(0, 50)}) MUST be wrapped in a responsive overflow container`
                    );
                }
            });
        });
    });

    await t.test('5. Mobile Sidebar Backdrop Overlay and Drawer Integration', () => {
        assert.ok(adminHtml.includes('id="sidebarOverlay"') && adminHtml.includes('sidebar-overlay'), 'admin-dashboard has #sidebarOverlay');
        assert.ok(leaderHtml.includes('id="sidebarOverlay"') && leaderHtml.includes('sidebar-overlay'), 'leader-dashboard has #sidebarOverlay');
        assert.ok(memberHtml.includes('id="sidebarOverlay"') && memberHtml.includes('sidebar-overlay'), 'member-dashboard has #sidebarOverlay');
        assert.ok(adminCss.includes('.sidebar-overlay'), 'admin.css defines .sidebar-overlay');
        assert.ok(adminCss.includes('.sidebar-overlay.active'), 'admin.css defines .sidebar-overlay.active');
    });

    await t.test('6. Mobile Modal, Form, and Header Adaptations', () => {
        assert.ok(adminCss.includes('@media (max-width: 768px)'), 'admin.css includes 768px breakpoint');
        assert.ok(adminCss.includes('@media (max-width: 480px)'), 'admin.css includes 480px breakpoint');
        assert.ok(adminCss.includes('font-size: 16px !important;'), 'admin.css includes 16px font-size to prevent iOS Safari auto-zoom on inputs');
        assert.ok(adminCss.includes('flex-direction: column-reverse;'), 'modal-footer stacks cleanly with primary button on mobile');
        assert.ok(adminCss.includes('.topbar-user-text'), 'topbar-user-text is controlled on mobile');
    });

    await t.test('7. Dark Theme Scrollbar and Overlay Styling', () => {
        assert.ok(darkThemeCss.includes('body.dark-mode .overflow-x-auto'), 'dark-theme.css styles .overflow-x-auto');
        assert.ok(darkThemeCss.includes('body.dark-mode .sidebar-overlay'), 'dark-theme.css styles .sidebar-overlay');
    });

    await t.test('8. Critical Media Assets physically exist without broken images', () => {
        const assets = [
            'public/images/logo.png',
            'public/images/logos/logo.png',
            'public/images/sermon-placeholder.jpg',
            'public/images/default-avatar.svg'
        ];

        assets.forEach(assetPath => {
            const fullPath = path.join(__dirname, '..', assetPath);
            assert.ok(fs.existsSync(fullPath), `Asset ${assetPath} must exist on disk`);
            const stat = fs.statSync(fullPath);
            assert.ok(stat.size > 0, `Asset ${assetPath} must have non-zero size (got ${stat.size} bytes)`);
        });
    });
});
