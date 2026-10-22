// Global guard: suppress benign Chrome extension message port disconnect errors (e.g. adblockers, password managers)
(function () {
    try {
        if (typeof window !== 'undefined') {
            function isExtNoise(item) {
                if (!item) return false;
                var s = typeof item === 'string' ? item : (item.message || item.stack || String(item));
                return s.indexOf('runtime.lastError') !== -1 ||
                       s.indexOf('message channel closed') !== -1 ||
                       s.indexOf('asynchronous response') !== -1 ||
                       s.indexOf('A listener indicated an asynchronous response') !== -1;
            }

            const origConsoleError = console.error;
            console.error = function (...args) {
                if (args.some(isExtNoise)) return;
                origConsoleError.apply(console, args);
            };

            const origConsoleWarn = console.warn;
            console.warn = function (...args) {
                if (args.some(isExtNoise)) return;
                origConsoleWarn.apply(console, args);
            };

            window.addEventListener('error', function (event) {
                if (event && isExtNoise(event.message)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return false;
                }
            }, true);

            window.addEventListener('unhandledrejection', function (event) {
                if (event && event.reason && isExtNoise(event.reason)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }, true);

            if (window.chrome && window.chrome.runtime) {
                try {
                    const _ = window.chrome.runtime.lastError;
                } catch (_) {}
            }
        }
    } catch (_) {}
})();

/**
 * Professional Theme & Profile System (Light / Dark / System Default)
 * Church of God World Missions Philippines - Imus
 * Compliant with WCAG 2.2 AA Contrast & Keyboard Accessibility
 */

// Immediate execution in <head> to prevent Flash of Unstyled Content (FOUC)
(function () {
    try {
        function resolveStorageKey() {
            try {
                const uStr = sessionStorage.getItem('church_user') || localStorage.getItem('church_user');
                if (uStr) {
                    const u = JSON.parse(uStr);
                    const uid = u.user_id || u.id || u.username;
                    if (uid) {
                        return `church_theme_user_${uid}`;
                    }
                }
                const p = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
                if (p.includes('admin-dashboard')) return 'church_theme_admin_guest';
                if (p.includes('leader-dashboard')) return 'church_theme_leader_guest';
                if (p.includes('member-dashboard')) return 'church_theme_member_guest';
            } catch (e) {}
            return 'church_theme_public';
        }
        const key = resolveStorageKey();
        const saved = localStorage.getItem(key) || localStorage.getItem('church_theme') || 'system';
        const sysDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const isDark = (saved === 'dark') || (saved === 'system' && sysDark);
        if (isDark) {
            document.documentElement.classList.add('dark-mode');
            document.documentElement.setAttribute('data-theme', 'dark');
            if (document.body) document.body.classList.add('dark-mode');
        } else {
            document.documentElement.classList.remove('dark-mode');
            document.documentElement.setAttribute('data-theme', 'light');
            if (document.body) document.body.classList.remove('dark-mode');
        }
    } catch (e) {
        console.warn('Theme initialization note:', e);
    }
})();

/**
 * Returns isolated storage key scoped per dashboard / portal
 */
function getThemeStorageKey() {
    try {
        const userStr = sessionStorage.getItem('church_user') || localStorage.getItem('church_user');
        if (userStr) {
            const u = JSON.parse(userStr);
            const uid = u.user_id || u.id || u.username;
            if (uid) {
                return `church_theme_user_${uid}`;
            }
        }
        const path = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
        if (path.includes('admin-dashboard')) return 'church_theme_admin_guest';
        if (path.includes('leader-dashboard')) return 'church_theme_leader_guest';
        if (path.includes('member-dashboard')) return 'church_theme_member_guest';
    } catch (e) {}
    return 'church_theme_public';
}

/**
 * Returns saved theme preference: 'light' | 'dark' | 'system'
 */
function getThemePreference() {
    try {
        const key = getThemeStorageKey();
        const scopedVal = localStorage.getItem(key);
        if (scopedVal) return scopedVal;
        return localStorage.getItem('church_theme') || 'system';
    } catch (e) {
        return 'system';
    }
}

/**
 * Returns OS system preference: 'dark' | 'light'
 */
function getSystemPreference() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}

/**
 * Sets explicit theme mode ('light', 'dark', or 'system')
 */
function setAppTheme(mode, e) {
    if (!e && typeof window !== 'undefined' && window.event) {
        e = window.event;
    }
    if (e) {
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    if (!['light', 'dark', 'system'].includes(mode)) {
        mode = 'system';
    }

    try {
        const key = getThemeStorageKey();
        localStorage.setItem(key, mode);
        // Only set global fallback if on public page
        if (key === 'church_theme_public') {
            localStorage.setItem('church_theme', mode);
        }
    } catch (err) {}

    const isDark = (mode === 'dark') || (mode === 'system' && getSystemPreference() === 'dark');

    // Prevent any animation restarts on open menus/dropdowns during theme switch
    const menu = document.getElementById('topbarProfileDropdown');
    if (menu) {
        menu.style.animation = 'none';
    }

    if (isDark) {
        document.documentElement.classList.add('dark-mode');
        document.documentElement.setAttribute('data-theme', 'dark');
        if (document.body) document.body.classList.add('dark-mode');
    } else {
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.setAttribute('data-theme', 'light');
        if (document.body) document.body.classList.remove('dark-mode');
    }

    updateThemeUi(mode, isDark);
    updateChartJsTheme(isDark);

    // Dispatch global event for other listeners
    try {
        window.dispatchEvent(new CustomEvent('church_theme_changed', { detail: { mode, isDark } }));
    } catch (err) {}
}

/**
 * Quick toggle between light and dark mode (or toggles away from current active appearance)
 */
function toggleDarkMode() {
    const isCurrentlyDark = document.documentElement.classList.contains('dark-mode') ||
                            (document.body && document.body.classList.contains('dark-mode'));
    const nextMode = isCurrentlyDark ? 'light' : 'dark';
    setAppTheme(nextMode);
}

/**
 * Updates all theme toggle icons, labels, pills, and segmented buttons
 */
function updateThemeUi(mode, isDark) {
    if (!mode) mode = getThemePreference();
    if (typeof isDark === 'undefined') {
        isDark = (mode === 'dark') || (mode === 'system' && getSystemPreference() === 'dark');
    }

    // Active Mode Label (e.g. "Dark", "Light", "Auto (System)")
    const modeLabelEl = document.getElementById('currentThemeModeLabel');
    if (modeLabelEl) {
        if (mode === 'system') {
            modeLabelEl.textContent = `Auto (${isDark ? 'Dark' : 'Light'})`;
        } else {
            modeLabelEl.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
        }
    }

    // Segmented Buttons in Profile Dropdown
    const btnLight = document.getElementById('themeBtnLight');
    const btnDark = document.getElementById('themeBtnDark');
    const btnSystem = document.getElementById('themeBtnSystem');

    if (btnLight) {
        btnLight.classList.toggle('active', mode === 'light');
        btnLight.setAttribute('aria-checked', mode === 'light' ? 'true' : 'false');
    }
    if (btnDark) {
        btnDark.classList.toggle('active', mode === 'dark');
        btnDark.setAttribute('aria-checked', mode === 'dark' ? 'true' : 'false');
    }
    if (btnSystem) {
        btnSystem.classList.toggle('active', mode === 'system');
        btnSystem.setAttribute('aria-checked', mode === 'system' ? 'true' : 'false');
    }

    // Quick toggle dropdown item if present
    const pill = document.getElementById('themeTogglePill');
    const icon = document.getElementById('themeToggleIcon');
    const label = document.getElementById('themeToggleLabel');
    const toggleBtn = document.getElementById('themeQuickToggleBtn');

    if (pill) {
        if (mode === 'system') {
            pill.textContent = isDark ? 'Auto (On)' : 'Auto (Off)';
            pill.className = isDark ? 'theme-toggle-pill active' : 'theme-toggle-pill';
        } else {
            pill.textContent = isDark ? 'On' : 'Off';
            pill.className = isDark ? 'theme-toggle-pill active' : 'theme-toggle-pill';
        }
    }
    if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun dropdown-item-icon' : 'fa-solid fa-moon dropdown-item-icon';
        icon.style.color = isDark ? '#E0BC6F' : '';
    }
    if (label) {
        label.textContent = isDark ? 'Dark Mode (Active)' : 'Dark Mode (Inactive)';
    }
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-checked', isDark ? 'true' : 'false');
        toggleBtn.setAttribute('title', isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme');
    }

    // Auth Login Page Theme Button
    const authBtn = document.querySelector('.theme-toggle-btn-auth');
    const authIcon = document.getElementById('authThemeIcon');
    if (authIcon) {
        authIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        authIcon.style.color = isDark ? '#E0BC6F' : '';
    }
    if (authBtn) {
        authBtn.setAttribute('title', isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme');
        authBtn.setAttribute('aria-label', isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme');
    }

    // Public / generic theme icons
    document.querySelectorAll('.theme-toggle-icon').forEach(el => {
        el.className = isDark ? 'fa-solid fa-sun theme-toggle-icon' : 'fa-solid fa-moon theme-toggle-icon';
        el.style.color = isDark ? '#E0BC6F' : '';
    });
}

/**
 * Updates Chart.js instances and global defaults dynamically with zero reload
 */
function updateChartJsTheme(isDark) {
    try {
        if (typeof Chart !== 'undefined') {
            const textColor = isDark ? '#CBD5E1' : '#64748b';
            const gridColor = isDark ? 'rgba(40, 53, 72, 0.7)' : 'rgba(226, 232, 240, 0.8)';
            const tooltipBg = isDark ? '#212C3D' : '#0E2A4F';
            const tooltipTitle = isDark ? '#F8FAFC' : '#ffffff';
            const tooltipBody = isDark ? '#CBD5E1' : '#ffffff';

            if (Chart.defaults) {
                Chart.defaults.color = textColor;
                Chart.defaults.borderColor = gridColor;
                if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
                    Chart.defaults.plugins.tooltip.backgroundColor = tooltipBg;
                    Chart.defaults.plugins.tooltip.titleColor = tooltipTitle;
                    Chart.defaults.plugins.tooltip.bodyColor = tooltipBody;
                    Chart.defaults.plugins.tooltip.borderColor = isDark ? '#3B82F6' : 'transparent';
                    Chart.defaults.plugins.tooltip.borderWidth = isDark ? 1 : 0;
                }
            }

            if (Chart.instances) {
                Object.values(Chart.instances).forEach(inst => {
                    if (inst && inst.options) {
                        if (inst.options.scales) {
                            ['x', 'y'].forEach(axis => {
                                if (inst.options.scales[axis]) {
                                    if (inst.options.scales[axis].ticks) {
                                        inst.options.scales[axis].ticks.color = textColor;
                                    }
                                    if (inst.options.scales[axis].grid) {
                                        inst.options.scales[axis].grid.color = gridColor;
                                    }
                                    if (inst.options.scales[axis].title) {
                                        inst.options.scales[axis].title.color = textColor;
                                    }
                                }
                            });
                        }
                        if (inst.options.plugins && inst.options.plugins.legend && inst.options.plugins.legend.labels) {
                            inst.options.plugins.legend.labels.color = textColor;
                        }
                        if (typeof inst.update === 'function') {
                            inst.update('none');
                        }
                    }
                });
            }
        }
    } catch (e) {
        // Safe failover if Chart is not loaded
    }
}

/**
 * Topbar Profile Dropdown Management
 */
function toggleProfileDropdown(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const menu = document.getElementById('topbarProfileDropdown');
    const chevron = document.getElementById('topbarProfileChevron');
    if (!menu) return;

    const isShown = menu.classList.contains('show') || menu.style.display === 'block';
    if (isShown) {
        closeProfileDropdown();
    } else {
        updateDropdownUserInfo();
        const mode = getThemePreference();
        const isDark = (mode === 'dark') || (mode === 'system' && getSystemPreference() === 'dark');
        updateThemeUi(mode, isDark);
        menu.classList.remove('menu-opening');
        menu.style.animation = '';
        void menu.offsetWidth;
        menu.classList.add('menu-opening');
        menu.classList.add('show');
        menu.style.display = 'block';
        setTimeout(() => {
            menu.classList.remove('menu-opening');
        }, 220);
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    }
}

function closeProfileDropdown() {
    const menu = document.getElementById('topbarProfileDropdown');
    const chevron = document.getElementById('topbarProfileChevron');
    if (menu) {
        menu.classList.remove('menu-opening');
        menu.classList.remove('show');
        menu.style.display = 'none';
    }
    if (chevron) chevron.style.transform = 'rotate(0deg)';
}

function openMfaFromDropdown() {
    closeProfileDropdown();
    if (typeof openMfaSecurityModal === 'function') {
        openMfaSecurityModal();
    }
}

function updateDropdownUserInfo() {
    let user = null;
    try {
        user = JSON.parse(sessionStorage.getItem('church_user') || '{}');
    } catch (e) {}
    if (!user || !user.full_name) return;

    const nameEl = document.getElementById('dropdownUserName');
    const roleEl = document.getElementById('dropdownUserRole');
    const avatarEl = document.getElementById('dropdownUserAvatar');

    if (nameEl) nameEl.textContent = user.full_name;
    if (roleEl) roleEl.textContent = user.role_name || user.role || 'Member';
    if (avatarEl) {
        if (user.profile_image) {
            avatarEl.innerHTML = `<img src="${user.profile_image}" alt="${user.full_name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null; this.parentElement.textContent='${((user.full_name || 'U').charAt(0)).toUpperCase()}';">`;
        } else {
            avatarEl.textContent = (user.full_name || 'U').charAt(0).toUpperCase();
        }
    }
}

// Global click & Escape handlers to close profile dropdown
document.addEventListener('click', function (e) {
    const wrapper = document.querySelector('.topbar-profile-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        closeProfileDropdown();
    }
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeProfileDropdown();
    }
});

// System Preference Change Listener (Pre-emptively reacts when OS changes theme)
if (window.matchMedia) {
    try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            const currentPref = getThemePreference();
            if (currentPref === 'system') {
                const isDark = e.matches;
                if (isDark) {
                    document.documentElement.classList.add('dark-mode');
                    document.documentElement.setAttribute('data-theme', 'dark');
                    if (document.body) document.body.classList.add('dark-mode');
                } else {
                    document.documentElement.classList.remove('dark-mode');
                    document.documentElement.setAttribute('data-theme', 'light');
                    if (document.body) document.body.classList.remove('dark-mode');
                }
                updateThemeUi('system', isDark);
                updateChartJsTheme(isDark);
            }
        });
    } catch (e) {}
}

// Initial hydration upon DOM Ready
document.addEventListener('DOMContentLoaded', function () {
    const mode = getThemePreference();
    const isDark = (mode === 'dark') || (mode === 'system' && getSystemPreference() === 'dark');

    if (isDark) {
        document.documentElement.classList.add('dark-mode');
        document.documentElement.setAttribute('data-theme', 'dark');
        if (document.body) document.body.classList.add('dark-mode');
    } else {
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.setAttribute('data-theme', 'light');
        if (document.body) document.body.classList.remove('dark-mode');
    }

    updateThemeUi(mode, isDark);
    updateDropdownUserInfo();
    updateChartJsTheme(isDark);
});
