const API_BASE_URL = '/api';

function detectThemeIsDark() {
    try {
        if (typeof document !== 'undefined') {
            if (document.documentElement && (document.documentElement.classList.contains('dark-mode') || document.documentElement.getAttribute('data-theme') === 'dark')) {
                return true;
            }
            if (document.body && (document.body.classList.contains('dark-mode') || document.body.getAttribute('data-theme') === 'dark')) {
                return true;
            }
        }
        if (typeof window !== 'undefined') {
            const pathname = window.location.pathname || '';
            let portal = '';
            if (pathname.includes('admin')) portal = 'admin';
            else if (pathname.includes('leader')) portal = 'leader';
            else if (pathname.includes('member')) portal = 'member';
            
            const saved = portal ? localStorage.getItem(`church_theme_portal_${portal}`) : localStorage.getItem('church_public_theme');
            if (saved === 'dark') return true;
            if (saved === 'system') {
                const now = new Date();
                const phHours = (now.getUTCHours() + 8) % 24;
                return phHours >= 18 || phHours < 6;
            }
        }
    } catch (e) {}
    return false;
}

let _isLoggingOut = false;
let _activeRequestsCount = 0;

async function triggerConcurrentLogout(reason = 'concurrent_login') {
    if (_isLoggingOut) return;
    _isLoggingOut = true;

    sessionStorage.setItem('auth_logout_reason', reason);

    if (window.location.href.includes('login.html')) {
        sessionStorage.removeItem('church_token');
        sessionStorage.removeItem('church_user');
        localStorage.removeItem('church_token');
        localStorage.removeItem('church_user');
        return;
    }

    const isDark = detectThemeIsDark();

    let title = 'Session Terminated';
    let message = 'You have logged in from another browser or device. For your security, this session has been automatically logged out.';
    let icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
    let iconClass = 'session-icon-danger';
    let iconBg = isDark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2';
    let iconColor = isDark ? '#f87171' : '#dc2626';
    let iconBorder = isDark ? 'rgba(239, 68, 68, 0.35)' : '#fecaca';

    if (reason === 'server_offline') {
        title = 'Server Disconnected';
        message = 'The Node.js server is currently off or unreachable. For your security, this session has been automatically closed.';
        icon = '<i class="fa-solid fa-power-off"></i>';
        iconClass = 'session-icon-warning';
        iconBg = isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7';
        iconColor = isDark ? '#fbbf24' : '#d97706';
        iconBorder = isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a';
    } else if (reason === 'role_changed') {
        title = 'Account Role Updated';
        message = 'Your account role has been changed by Church Administration (e.g. Member to Leader). Please log in again to access your updated dashboard and permissions.';
        icon = '<i class="fa-solid fa-user-shield"></i>';
        iconClass = 'session-icon-role';
        iconBg = isDark ? 'rgba(37, 99, 235, 0.22)' : '#eff6ff';
        iconColor = isDark ? '#60a5fa' : '#2563eb';
        iconBorder = isDark ? 'rgba(59, 130, 246, 0.4)' : '#dbeafe';
    } else if (reason === 'password_changed') {
        title = 'Password Updated';
        message = 'Your account password has been changed. For your security, this session has been automatically logged out. Please log in again with your new credentials.';
        icon = '<i class="fa-solid fa-key"></i>';
        iconClass = 'session-icon-password';
        iconBg = isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7';
        iconColor = isDark ? '#fbbf24' : '#d97706';
        iconBorder = isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a';
    } else if (reason === 'unauthorized') {
        title = 'Session Expired';
        message = 'Your session has expired or is invalid. Please log in again to continue.';
        icon = '<i class="fa-solid fa-clock-rotate-left"></i>';
        iconClass = 'session-icon-danger';
        iconBg = isDark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2';
        iconColor = isDark ? '#f87171' : '#dc2626';
        iconBorder = isDark ? 'rgba(239, 68, 68, 0.35)' : '#fecaca';
    }

    const modalBg = isDark ? '#141A24' : '#ffffff';
    const cardBorder = isDark ? '1px solid #283548' : '1px solid #e2e8f0';
    const cardShadow = isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)' : '0 25px 50px -12px rgba(0, 0, 0, 0.28)';
    const titleColor = isDark ? '#f8fafc' : '#0f172a';
    const descColor = isDark ? '#94a3b8' : '#475569';
    const btnBg = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
    const btnShadow = isDark ? '0 4px 16px rgba(37, 99, 235, 0.45)' : '0 4px 14px rgba(37, 99, 235, 0.35)';

    let existingOverlay = document.getElementById('session-terminated-overlay');
    if (!existingOverlay) {
        const overlay = document.createElement('div');
        overlay.id = 'session-terminated-overlay';
        overlay.className = 'session-terminated-overlay';
        overlay.setAttribute('data-theme', isDark ? 'dark' : 'light');
        overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:${isDark ? 'rgba(5,9,15,0.88)' : 'rgba(15,23,42,0.82)'};z-index:9999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);font-family:Inter,system-ui,-apple-system,sans-serif;`;
        overlay.innerHTML = `
            <div class="session-terminated-card modal" style="background:${modalBg} !important;background-color:${modalBg} !important;padding:32px;border-radius:16px;max-width:440px;width:90%;text-align:center;box-shadow:${cardShadow} !important;border:${cardBorder} !important;font-family:Inter,system-ui,-apple-system,sans-serif !important;">
                <div class="session-icon-box ${iconClass}" style="width:68px;height:68px;background:${iconBg} !important;color:${iconColor} !important;border:1px solid ${iconBorder} !important;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:30px;">
                    ${icon}
                </div>
                <h3 class="session-terminated-title" style="margin:0 0 10px;font-size:20px;font-weight:700;color:${titleColor} !important;font-family:Inter,system-ui,-apple-system,sans-serif !important;letter-spacing:-0.3px;">${title}</h3>
                <p class="session-terminated-message" style="margin:0 0 22px;color:${descColor} !important;font-size:14px;line-height:1.55;font-family:Inter,system-ui,-apple-system,sans-serif !important;">${message}</p>
                <div class="session-terminated-btn" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 22px;background:${btnBg} !important;color:#ffffff !important;font-weight:600;font-size:14px;border-radius:9px;box-shadow:${btnShadow} !important;border:1px solid rgba(255,255,255,0.12) !important;font-family:Inter,system-ui,-apple-system,sans-serif !important;">
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Redirecting to Login...</span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // If an in-flight mutation/save request is running, wait for it to finish committing to the database
    if (_activeRequestsCount > 0) {
        await new Promise(resolve => {
            const startWait = Date.now();
            const checkTimer = setInterval(() => {
                if (_activeRequestsCount <= 0 || Date.now() - startWait > 3000) {
                    clearInterval(checkTimer);
                    resolve();
                }
            }, 50);
        });
    }

    sessionStorage.removeItem('church_token');
    sessionStorage.removeItem('church_user');
    localStorage.removeItem('church_token');
    localStorage.removeItem('church_user');

    setTimeout(() => {
        window.location.href = '/views/login.html';
    }, 1400);
}

let _watchdogStarted = false;
let _lastCheckTime = 0;

async function checkSessionStatus() {
    if (_isLoggingOut) return;
    const token = sessionStorage.getItem('church_token');
    if (!token) return;

    const now = Date.now();
    if (now - _lastCheckTime < 5000) return; // Throttle to at most once per 5s
    _lastCheckTime = now;

    try {
        const res = await fetch('/api/auth/check-session', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) {
            const data = await res.json().catch(() => ({}));
            const msg = data.message || '';
            if (msg.toLowerCase().includes('password')) {
                triggerConcurrentLogout('password_changed');
            } else if (msg.toLowerCase().includes('role')) {
                triggerConcurrentLogout('role_changed');
            } else if (msg.includes('another browser') || msg.includes('Session terminated')) {
                triggerConcurrentLogout('concurrent_login');
            } else {
                triggerConcurrentLogout('unauthorized');
            }
        }
    } catch (e) {
        // Transient network glitch or connection drop - do not destroy session or wipe user's input
        console.warn('[SessionWatchdog] Transient network glitch during session check:', e.message);
    }
}

function startSessionWatchdog() {
    if (_watchdogStarted) return;
    const path = window.location.pathname.toLowerCase();
    // Only run watchdog on authenticated dashboard views
    if (!path.includes('-dashboard')) return;
    if (!sessionStorage.getItem('church_token')) return;

    _watchdogStarted = true;

    // 1. Light 15-second heartbeat (reduced from 2.5s to prevent query spam)
    setInterval(checkSessionStatus, 15000);

    // 2. Tab switch / visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && (Date.now() - _lastCheckTime > 5000)) {
            checkSessionStatus();
        }
    });

    // 3. Window focus
    window.addEventListener('focus', () => {
        if (Date.now() - _lastCheckTime > 5000) {
            checkSessionStatus();
        }
    });

    // 4. Cross-tab storage change
    window.addEventListener('storage', (e) => {
        if (e.key === 'church_token' && !e.newValue) {
            triggerConcurrentLogout('unauthorized');
        }
    });

    // 5. Instant realtime force_logout listener for role changes or deactivations
    const handleForceLogoutEvent = (payload) => {
        if (!payload) return;
        const type = payload.type;
        const data = payload.data || payload;
        if (type === 'force_logout') {
            const targetUserId = data.user_id || payload.user_id;
            let currentUserId = null;
            try {
                const u = JSON.parse(sessionStorage.getItem('church_user') || '{}');
                currentUserId = u.user_id || u.id;
            } catch (err) {}
            if (currentUserId && targetUserId && String(currentUserId) === String(targetUserId)) {
                triggerConcurrentLogout(data.reason || 'role_changed');
            }
        }
    };

    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const bc = new BroadcastChannel('church_realtime_channel');
            bc.onmessage = (e) => handleForceLogoutEvent(e.data);
        } catch (bcErr) {}
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'church_realtime_ping' && e.newValue) {
            try {
                handleForceLogoutEvent(JSON.parse(e.newValue));
            } catch (err) {}
        }
    });

    if (typeof EventSource !== 'undefined') {
        try {
            const es = new EventSource('/api/realtime/stream');
            es.onmessage = (e) => {
                try {
                    handleForceLogoutEvent(JSON.parse(e.data));
                } catch (err) {}
            };
        } catch (esErr) {}
    }

    checkSessionStatus();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startSessionWatchdog);
    } else {
        startSessionWatchdog();
    }
}

function buildApiQuery(page, limit, filters = {}) {
    if (page && typeof page === 'object') {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(page)) {
            if (v !== undefined && v !== null && v !== '') {
                params.append(k, v);
            }
        }
        const str = params.toString();
        return str ? `?${str}` : '';
    }
    if (typeof page === 'string' && isNaN(page)) {
        return page.startsWith('?') ? page : (page ? `?search=${encodeURIComponent(page)}` : '');
    }
    const params = new URLSearchParams();
    if (page !== null && page !== undefined && page !== '') {
        params.append('page', page);
    }
    if (limit !== null && limit !== undefined && limit !== '') {
        params.append('limit', limit);
    }
    if (filters && typeof filters === 'object') {
        for (const [k, v] of Object.entries(filters)) {
            if (v !== undefined && v !== null && v !== '') {
                params.append(k, v);
            }
        }
    }
    const str = params.toString();
    return str ? `?${str}` : '';
}

const api = {
    startSessionWatchdog,
    async request(endpoint, method = 'GET', body = null, requiresAuth = true) {
        const headers = { 'Content-Type': 'application/json' };
        if (requiresAuth) {
            const token = sessionStorage.getItem('church_token');
            if (token) headers['Authorization'] = `Bearer ${token}`;
            else { window.location.href = '/views/login.html'; return; }
        }
        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);
        
        _activeRequestsCount++;
        let response;
        try {
            response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'An API error occurred');
            return data;
        } catch (error) {
            console.error(`[API Error] ${method} ${endpoint}:`, error.message);
            if (response && response.status === 401) {
                if (error.message && error.message.toLowerCase().includes('password')) {
                    triggerConcurrentLogout('password_changed');
                } else if (error.message && error.message.toLowerCase().includes('role')) {
                    triggerConcurrentLogout('role_changed');
                } else if (error.message && (error.message.includes('another browser or device') || error.message.includes('Session terminated'))) {
                    triggerConcurrentLogout('concurrent_login');
                } else {
                    triggerConcurrentLogout('unauthorized');
                }
            }
            throw error;
        } finally {
            _activeRequestsCount = Math.max(0, _activeRequestsCount - 1);
        }
    },

    // THIS FUNCTION IS REQUIRED FOR FILE UPLOADS AND FORM DATA
    async requestFormData(endpoint, method, formData, requiresAuth = true) {
        const headers = {};
        if (requiresAuth) {
            const token = sessionStorage.getItem('church_token');
            if (token) headers['Authorization'] = `Bearer ${token}`;
            else { window.location.href = '/views/login.html'; return; }
        }

        _activeRequestsCount++;
        let response;
        try {
            response = await fetch(`${API_BASE_URL}${endpoint}`, { method, headers, body: formData });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'An API error occurred');
            return data;
        } catch (error) {
            console.error(`[API Error] ${method} ${endpoint}:`, error.message);
            if (response && response.status === 401) {
                if (error.message && error.message.toLowerCase().includes('password')) {
                    triggerConcurrentLogout('password_changed');
                } else if (error.message && error.message.toLowerCase().includes('role')) {
                    triggerConcurrentLogout('role_changed');
                } else if (error.message && (error.message.includes('another browser or device') || error.message.includes('Session terminated'))) {
                    triggerConcurrentLogout('concurrent_login');
                } else {
                    triggerConcurrentLogout('unauthorized');
                }
            }
            throw error;
        } finally {
            _activeRequestsCount = Math.max(0, _activeRequestsCount - 1);
        }
    },

    auth: {
        login: (identifier, password) => api.request('/auth/login', 'POST', { identifier, password }, false),
        register: (data) => api.request('/auth/register', 'POST', data, false),
        logout: () => api.request('/auth/logout', 'POST'),
        checkSession: () => api.request('/auth/check-session', 'GET'),
        getMe: () => api.request('/auth/me', 'GET'),
        updatePassword: (currentPassword, newPassword) => api.request('/auth/update-password', 'PUT', { currentPassword, newPassword }),
        // Multi-Factor Authentication (MFA / 2FA)
        verifyMfa: (mfaChallengeToken, token) => api.request('/auth/mfa/verify', 'POST', { mfaChallengeToken, token }, false),
        verifyMfaRecovery: (mfaChallengeToken, recoveryCode) => api.request('/auth/mfa/recovery', 'POST', { mfaChallengeToken, recoveryCode }, false),
        getMfaStatus: () => api.request('/auth/mfa/status', 'GET'),
        startMfaEnrollment: () => api.request('/auth/mfa/enroll/start', 'POST'),
        confirmMfaEnrollment: (token) => api.request('/auth/mfa/enroll/confirm', 'POST', { token }),
        disableMfa: (data) => api.request('/auth/mfa/disable', 'POST', data),
        regenerateRecoveryCodes: (data) => api.request('/auth/mfa/recovery-codes/regenerate', 'POST', data),
        updateTheme: (theme) => api.request('/auth/theme', 'PUT', { theme })
    },
    public: {
        getBanners: () => api.request('/public/banners', 'GET', null, false),
        getSermons: (limit = 50) => api.request(`/public/sermons?limit=${limit}`, 'GET', null, false),
        getLiveStream: () => api.request('/public/livestream', 'GET', null, false),
        getLiveStreamComments: () => api.request('/public/livestream/comments', 'GET', null, false),
        postLiveStreamComment: (data) => api.request('/public/livestream/comments', 'POST', data, false),
        recordLiveStreamView: (data = {}) => api.request('/public/livestream/view', 'POST', data, false),
        sendLiveStreamHeartbeat: (data = {}) => api.request('/public/livestream/heartbeat', 'POST', data, false),
        leaveLiveStream: (data = {}) => api.request('/public/livestream/leave', 'POST', data, false),
        getEvents: () => api.request('/public/events', 'GET', null, false),
        getAlbums: () => api.request('/public/gallery', 'GET', null, false),
        getAlbumImages: (id) => api.request(`/public/gallery/${id}`, 'GET', null, false),
        getPage: (key) => api.request(`/public/pages/${key}`, 'GET', null, false),
        getWebsiteContent: (section = 'all') => api.request(`/public/website/${section || 'all'}`, 'GET', null, false),
        submitContact: (data) => api.request('/public/contact', 'POST', data, false)
    },

    users: {
        getAll: (page = null, limit = null, filters = {}) => api.request('/users' + buildApiQuery(page, limit, filters), 'GET'),
        getById: (id) => api.request(`/users/${id}`, 'GET'),
        create: (formData) => api.requestFormData('/users', 'POST', formData), // USES requestFormData
        update: (id, formData) => api.requestFormData(`/users/${id}`, 'PUT', formData), // USES requestFormData
        delete: (id) => api.request(`/users/${id}`, 'DELETE'),
        verify: (id) => api.request(`/users/${id}/verify`, 'POST'),
        resendEmail: (id) => api.request(`/users/${id}/resend-email`, 'POST')
    },
    members: {
        getAll: (page = null, limit = null, filters = {}) => api.request('/members' + buildApiQuery(page, limit, filters), 'GET'),
        getById: (id) => api.request(`/members/${id}`, 'GET'),
        create: (data) => api.request('/members', 'POST', data),
        update: (id, data) => api.request(`/members/${id}`, 'PUT', data),
        delete: (id) => api.request(`/members/${id}`, 'DELETE'),
        getMyMinistry: () => api.request('/members/me/ministry', 'GET'),
        getMyMinistryAttendance: (ministryId) => api.request(`/members/me/ministry/attendance?ministryId=${ministryId || ''}`, 'GET')
    },
    ministries: {
        getAll: (page = null, limit = null, filters = {}) => api.request('/ministries' + buildApiQuery(page, limit, filters), 'GET'),
        getDepartmentHeads: () => api.request('/ministries/department-heads', 'GET'),
        updateDepartmentHead: (department, data) => api.request('/ministries/department-heads/' + encodeURIComponent(department), 'PUT', data),
        getMyAssigned: () => api.request('/ministries/leader/my-assigned', 'GET'),
        getLeaderDepartmentOversight: () => api.request('/ministries/leader/department-oversight', 'GET'),
        getById: (id) => api.request(`/ministries/${id}`, 'GET'),
        create: (data) => api.request('/ministries', 'POST', data),
        update: (id, data) => api.request(`/ministries/${id}`, 'PUT', data),
        delete: (id) => api.request(`/ministries/${id}`, 'DELETE'),
        getMembers: (id) => api.request(`/ministries/${id}/members`, 'GET'),
        getRosterWithAttendance: (id) => api.request(`/ministries/${id}/roster-attendance`, 'GET'),
        getAttendanceSessions: (id) => api.request(`/ministries/${id}/attendance`, 'GET'),
        getAttendanceDetails: (attendanceId) => api.request(`/ministries/attendance/${attendanceId}`, 'GET'),
        recordAttendance: (id, data) => api.request(`/ministries/${id}/attendance`, 'POST', data),
        updateAttendance: (attendanceId, data) => api.request(`/ministries/attendance/${attendanceId}`, 'PUT', data),
        deleteAttendance: (attendanceId) => api.request(`/ministries/attendance/${attendanceId}`, 'DELETE'),
        getMemberAttendanceHistory: (id, memberId) => api.request(`/ministries/${id}/attendance/history/${memberId}`, 'GET'),
        addMember: (id, data) => api.request(`/ministries/${id}/members`, 'POST', data),
        removeMember: (ministry_member_id) => api.request(`/ministries/members/${ministry_member_id}`, 'DELETE')
    },
    c2s: {
        getAll: (page = null, limit = null, filters = {}) => api.request('/c2s' + buildApiQuery(page, limit, filters), 'GET'),
        getById: (id) => api.request(`/c2s/${id}`, 'GET'),
        create: (data) => api.request('/c2s', 'POST', data),
        update: (id, data) => api.request(`/c2s/${id}`, 'PUT', data),
        delete: (id) => api.request(`/c2s/${id}`, 'DELETE'),
        addMember: (id, data) => api.request(`/c2s/${id}/members`, 'POST', data),
        removeMember: (groupId, memberId) => api.request(`/c2s/${groupId}/members/${memberId}`, 'DELETE'),
        getAvailableMembers: (params = {}) => {
            const query = (params && typeof params === 'object' && Object.keys(params).length) ? '?' + new URLSearchParams(params).toString() : '';
            return api.request('/c2s/members/available' + query, 'GET');
        },
        quickCreateMember: (data, groupId = null) => api.request(groupId ? `/c2s/${groupId}/quick-member` : '/c2s/quick-member', 'POST', data)
    },
    finance: {
        getAll: (page = null, limit = null, filters = {}) => api.request('/finance' + buildApiQuery(page, limit, filters), 'GET'),
        getTransactions: (page = null, limit = null, filters = {}) => api.request('/finance' + buildApiQuery(page, limit, filters), 'GET'),
        getById: (id) => api.request(`/finance/${id}`, 'GET'),
        getCategories: () => api.request('/finance/categories', 'GET'),
        getAnalytics: () => api.request('/finance/analytics', 'GET'),
        create: (data) => api.request('/finance', 'POST', data),
        createTransaction: (data) => api.request('/finance', 'POST', data),
        update: (id, data) => api.request(`/finance/${id}`, 'PUT', data),
        updateTransaction: (id, data) => api.request(`/finance/${id}`, 'PUT', data),
        delete: (id) => api.request(`/finance/${id}`, 'DELETE'),
        deleteTransaction: (id) => api.request(`/finance/${id}`, 'DELETE')
    },
    events: {
        getAll: (page = null, limit = null, filters = {}) => api.request('/events' + buildApiQuery(page, limit, filters), 'GET'),
        getById: (id) => api.request(`/events/${id}`, 'GET'),
        create: (data) => (typeof FormData !== 'undefined' && data instanceof FormData) ? api.requestFormData('/events', 'POST', data) : api.request('/events', 'POST', data),
        update: (id, data) => (typeof FormData !== 'undefined' && data instanceof FormData) ? api.requestFormData(`/events/${id}`, 'PUT', data) : api.request(`/events/${id}`, 'PUT', data),
        delete: (id) => api.request(`/events/${id}`, 'DELETE'),
        getEnrollments: (id) => api.request(`/events/${id}/enrollments`, 'GET'),
        updateEnrollmentStatus: (enrollmentId, status) => api.request(`/events/enrollments/${enrollmentId}`, 'PUT', { status }),
        getMyEnrollments: () => api.request('/events/user/enrolled', 'GET'),
        enroll: (id, data) => api.request(`/events/${id}/enroll`, 'POST', data),
        cancelEnrollment: (id) => api.request(`/events/${id}/enroll`, 'DELETE'),
        archive: (id) => api.request(`/events/${id}/archive`, 'PUT'),
        restore: (id) => api.request(`/events/${id}/restore`, 'PUT')
    },
    announcements: {
        getAll: (page = null, limit = null, filters = {}) => api.request('/announcements' + buildApiQuery(page, limit, filters), 'GET'),
        getById: (id) => api.request(`/announcements/${id}`, 'GET'),
        create: (data) => api.request('/announcements', 'POST', data),
        update: (id, data) => api.request(`/announcements/${id}`, 'PUT', data),
        delete: (id) => api.request(`/announcements/${id}`, 'DELETE'),
        triggerEmail: (id) => api.request(`/announcements/${id}/trigger-email`, 'POST'),
        broadcast: (id) => api.request(`/announcements/${id}/trigger-email`, 'POST'),
        triggerSms: (id) => api.request(`/announcements/${id}/trigger-sms`, 'POST')
    },
    content: {
        getBanners: () => api.request('/content/banners', 'GET'),
        saveBanner: (data, id = null) => id ? api.request(`/content/banners/${id}`, 'PUT', data) : api.request('/content/banners', 'POST', data),
        deleteBanner: (id) => api.request(`/content/banners/${id}`, 'DELETE'),
        
        getSermons: (page = null, limit = null, filters = {}) => api.request('/content/sermons' + buildApiQuery(page, limit, filters), 'GET'),
        saveSermon: (data, id = null) => id ? api.request(`/content/sermons/${id}`, 'PUT', data) : api.request('/content/sermons', 'POST', data),
        deleteSermon: (id) => api.request(`/content/sermons/${id}`, 'DELETE'),
        
        getLiveStream: () => api.request('/content/livestream', 'GET'),
        saveLiveStream: (data) => api.request('/content/livestream', 'POST', data),
        toggleLiveStream: (data) => {
            let is_live = data;
            if (typeof data === 'object' && data !== null && 'is_live' in data) {
                is_live = data.is_live;
            }
            const val = (is_live === 1 || is_live === true || is_live === '1' || is_live === 'true') ? 1 : 0;
            return api.request('/content/livestream/toggle', 'POST', { is_live: val });
        },
        getBroadcastRelayStatus: () => api.request('/content/livestream/relay-status', 'GET'),
        getLiveStreamRelayStatus: () => api.request('/content/livestream/relay-status', 'GET'),
        getLiveStreamAnalytics: () => api.request('/content/livestream/analytics', 'GET'),
        logLiveStreamViews: (data) => api.request('/content/livestream/analytics/log', 'POST', data),
        getLiveStreamComments: (limit = 100) => api.request(`/content/livestream/comments?limit=${limit}`, 'GET'),
        postLiveStreamComment: (data) => api.request('/content/livestream/comments', 'POST', data),
        getLiveStreamCommentLogs: (page = null, limit = null, filters = {}) => api.request('/content/livestream/comment-logs' + buildApiQuery(page, limit, filters), 'GET'),
        deleteLiveStreamComment: (id) => api.request(`/content/livestream/comments/${id}`, 'DELETE'),
        getWebsiteContent: (section = 'all') => api.request(`/content/website/${section || 'all'}`, 'GET'),
        saveWebsiteContent: (section, data) => api.request(`/content/website/${section}`, 'PUT', data),
        uploadWebsiteVideo: (formData) => api.requestFormData('/content/upload-video', 'POST', formData),
        uploadWebsiteImage: (formData) => api.requestFormData('/content/upload-image', 'POST', formData)
    },
    audit: {
        getAll: (page = 1, filters = {}) => api.request(`/audit?` + new URLSearchParams({ page, limit: 50, ...filters }).toString(), 'GET')
    },
    attendance: {
        getAll: (page = null, limit = null, filters = {}) => api.request('/attendance' + buildApiQuery(page, limit, filters), 'GET'),
        create: (data) => api.request('/attendance', 'POST', data),
        getSummary: () => api.request('/attendance/summary', 'GET')
    },
    reports: {
        getSummary: () => api.request('/reports/summary', 'GET')
    },
    contact: {
        getAll: (page = 1) => api.request(`/contact?page=${page}&limit=50`, 'GET'),
        markAsRead: (id) => api.request(`/contact/${id}/read`, 'PATCH'),
        delete: (id) => api.request(`/contact/${id}`, 'DELETE')
    },
    gallery: {
        getAlbums: (page = null, limit = null, filters = {}) => api.request('/gallery' + buildApiQuery(page, limit, filters), 'GET'),
        createAlbum: (formData) => api.requestFormData('/gallery', 'POST', formData),
        updateAlbum: (id, formData) => api.requestFormData(`/gallery/${id}`, 'PUT', formData),
        deleteAlbum: (id) => api.request(`/gallery/${id}`, 'DELETE'),
        getImages: (albumId) => api.request(`/gallery/${albumId}/images`, 'GET'),
        uploadImage: (albumId, formData) => api.requestFormData(`/gallery/${albumId}/images`, 'POST', formData),
        deleteImage: (imageId) => api.request(`/gallery/images/${imageId}`, 'DELETE')
    },
    system: {
        backup: () => `${API_BASE_URL}/system/backup`,
        getSmsSettings: () => api.request('/system/sms-settings', 'GET'),
        updateSmsSettings: (data) => api.request('/system/sms-settings', 'PUT', data),
        sendTestSms: (data) => api.request('/system/send-test-sms', 'POST', data),
        getEmailSettings: () => api.request('/system/email-settings', 'GET')
    }
};

if (typeof window !== 'undefined') {
    window.api = api;
}