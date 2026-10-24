function previewEventBanner(e, previewId, placeholderId) {
    const file = e.target.files && e.target.files[0];
    const preview = document.getElementById(previewId);
    const placeholder = document.getElementById(placeholderId);
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            if (preview) {
                preview.src = evt.target.result;
                preview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}


// ==========================================
// LOCAL TIMEZONE DATE FORMATTING HELPERS
// ==========================================
function formatLocalDate(date = new Date()) {
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatLocalDateTime(date = new Date()) {
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

let currentFinancePageTransactions = [];
// ============================================================
// COGWM Imus Portal - Admin Dashboard Script
// ============================================================

let allEventsCache = [];
let allAnnouncementsCache = [];
let allMembersCache = [];
let allMinistriesCache = [];
let allTransactionsCache = [];
let allAlbumsCache = [];

let currentMinistryId = null;
let currentAlbumId = null;
let financeAnalyticsMode = 'Income'; // 'Income' (Line Graph) or 'Expense' (Donut Graph)
let currentSermonsPage = 1;
let currentAlbumsPage = 1;
let currentCommentLogsPage = 1;
let currentAuditPage = 1;
let smsSettingsCache = null;

// Helper: Escape HTML to protect against XSS
function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Web Audio API Sound Chimes for Notifications
function playPortalNotificationSound(type = 'chime') {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const now = ctx.currentTime;

        if (type === 'comment' || type === 'chime') {
            // Elegant double bell chime: D5 (587.33Hz) -> A5 (880.00Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, now);
            gain1.gain.setValueAtTime(0.25, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.5);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880.00, now + 0.12);
            gain2.gain.setValueAtTime(0.25, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.6);
        } else if (type === 'announcement') {
            // Vibrant 3-note ascending arpeggio: C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz)
            [
                { freq: 523.25, time: 0, dur: 0.25 },
                { freq: 659.25, time: 0.1, dur: 0.25 },
                { freq: 783.99, time: 0.2, dur: 0.55 }
            ].forEach(note => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.freq, now + note.time);
                gain.gain.setValueAtTime(0.22, now + note.time);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + note.time);
                osc.stop(now + note.time + note.dur);
            });
        }
    } catch (e) {
        console.warn('Audio playback error (user interaction might be required):', e);
    }
}

// Universal Decision / Confirmation Pop-up Window
function showDecisionModal({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Yes, Proceed',
    cancelText = 'Cancel',
    type = 'danger', // 'danger' | 'warning' | 'primary' | 'info' | 'success'
    icon = ''
} = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        if (!modal) {
            resolve(window.confirm(message));
            return;
        }

        const iconWrap = document.getElementById('decisionIconWrap');
        const iconEl = document.getElementById('decisionIcon');
        const titleEl = document.getElementById('decisionTitle');
        const msgEl = document.getElementById('decisionMessage');
        const btnCancel = document.getElementById('btnDecisionCancel');
        const btnConfirm = document.getElementById('btnDecisionConfirm');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        if (btnCancel) btnCancel.textContent = cancelText;
        if (btnConfirm) btnConfirm.textContent = confirmText;

        if (btnConfirm) {
            btnConfirm.className = 'btn-primary';
            if (type === 'danger') {
                btnConfirm.classList.add('btn-decision-danger');
            } else if (type === 'warning') {
                btnConfirm.classList.add('btn-decision-warning');
            }
        }

        if (iconWrap && iconEl) {
            iconWrap.className = '';
            iconWrap.classList.add(`decision-icon-${type}`);
            let defaultIcon = 'fa-triangle-exclamation';
            if (type === 'danger') defaultIcon = 'fa-trash-can';
            else if (type === 'warning') defaultIcon = 'fa-triangle-exclamation';
            else if (type === 'primary' || type === 'info') defaultIcon = 'fa-circle-question';
            else if (type === 'success') defaultIcon = 'fa-circle-check';

            iconEl.className = `fa-solid ${icon || defaultIcon}`;
        }

        modal.style.display = 'flex';
        modal.classList.add('active');

        function cleanup(result) {
            modal.classList.remove('active');
            modal.style.display = '';
            modal.style.removeProperty('display');
            btnConfirm?.removeEventListener('click', onConfirm);
            btnCancel?.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKeyDown);
            resolve(result);
        }

        function onConfirm(e) {
            e.stopPropagation();
            cleanup(true);
        }

        function onCancel(e) {
            e.stopPropagation();
            cleanup(false);
        }

        function onBackdrop(e) {
            if (e.target === modal) {
                cleanup(false);
            }
        }

        function onKeyDown(e) {
            if (e.key === 'Escape') {
                cleanup(false);
            }
        }

        btnConfirm?.addEventListener('click', onConfirm, { once: true });
        btnCancel?.addEventListener('click', onCancel, { once: true });
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeyDown);
    });
}
window.showConfirmDialog = showDecisionModal;

// --- Distinct Color-Coded Badge Helpers ---
function getDeptBadgeClass(dept) {
    if (!dept) return 'badge-dept-general';
    const d = dept.toLowerCase().trim();
    if (d === 'worship') return 'badge-dept-worship';
    if (d === 'outreach') return 'badge-dept-outreach';
    if (d === 'relationship') return 'badge-dept-relationship';
    if (d === 'discipleship') return 'badge-dept-discipleship';
    if (d === 'administration') return 'badge-dept-administration';
    return 'badge-dept-general';
}

function getEventStatusBadge(status) {
    const s = (status || 'Upcoming').trim().toLowerCase();
    if (s === 'upcoming') return '<span class="badge badge-event-upcoming"><i class="fa-regular fa-clock"></i> Upcoming</span>';
    if (s === 'ongoing') return '<span class="badge badge-event-ongoing"><i class="fa-solid fa-circle-play"></i> Ongoing</span>';
    if (s === 'completed') return '<span class="badge badge-event-completed"><i class="fa-solid fa-circle-check"></i> Completed</span>';
    if (s === 'cancelled') return '<span class="badge badge-event-cancelled"><i class="fa-solid fa-ban"></i> Cancelled</span>';
    return `<span class="badge badge-event-upcoming">${escapeHtml(status)}</span>`;
}

function getUserStatusBadge(isActive) {
    return (isActive == 1 || isActive === true || isActive === '1')
        ? '<span class="badge badge-status-active"><i class="fa-solid fa-circle-check"></i> Active</span>'
        : '<span class="badge badge-status-inactive"><i class="fa-solid fa-circle-xmark"></i> Inactive</span>';
}

function getMemberGenderBadge(gender) {
    if (!gender) return '<span class="badge badge-gender-other">N/A</span>';
    const g = gender.toLowerCase().trim();
    if (g === 'male') return '<span class="badge badge-gender-male"><i class="fa-solid fa-mars"></i> Male</span>';
    if (g === 'female') return '<span class="badge badge-gender-female"><i class="fa-solid fa-venus"></i> Female</span>';
    return `<span class="badge badge-gender-other">${escapeHtml(gender)}</span>`;
}

function getMemberCivilStatusBadge(civilStatus) {
    if (!civilStatus) return '<span class="badge badge-civil-separated">N/A</span>';
    const cs = civilStatus.toLowerCase().trim();
    if (cs === 'single') return '<span class="badge badge-civil-single">Single</span>';
    if (cs === 'married') return '<span class="badge badge-civil-married">Married</span>';
    if (cs === 'widowed') return '<span class="badge badge-civil-widowed">Widowed</span>';
    if (cs === 'separated' || cs === 'divorced') return '<span class="badge badge-civil-separated">Separated</span>';
    return `<span class="badge badge-civil-single">${escapeHtml(civilStatus)}</span>`;
}

function getMemberStatusBadge(status) {
    if (!status) return '<span class="badge badge-status-inactive">N/A</span>';
    const s = status.toLowerCase().trim();
    if (s === 'active') return '<span class="badge badge-status-active">Active</span>';
    if (s === 'inactive') return '<span class="badge badge-status-inactive">Inactive</span>';
    if (s === 'transferred') return '<span class="badge badge-status-transferred">Transferred</span>';
    if (s === 'deceased') return '<span class="badge badge-status-deceased">Deceased</span>';
    return `<span class="badge badge-status-active">${escapeHtml(status)}</span>`;
}

function getFinanceCategoryBadge(catName) {
    if (!catName) return '<span class="badge badge-cat-general">General</span>';
    const c = catName.toLowerCase().trim();
    let badgeClass = 'badge-cat-general';
    if (c.includes('tithe')) badgeClass = 'badge-cat-tithe';
    else if (c.includes('offering')) badgeClass = 'badge-cat-offering';
    else if (c.includes('mission')) badgeClass = 'badge-cat-mission';
    else if (c.includes('love') || c.includes('gift')) badgeClass = 'badge-cat-lovegift';
    else if (c.includes('honorarium') || c.includes('speaker') || c.includes('pastor')) badgeClass = 'badge-cat-honorarium';
    else if (c.includes('utilit') || c.includes('electric') || c.includes('water')) badgeClass = 'badge-cat-utilities';
    else if (c.includes('maint') || c.includes('repair')) badgeClass = 'badge-cat-maintenance';
    else if (c.includes('building') || c.includes('project')) badgeClass = 'badge-cat-building';
    else if (c.includes('ministry')) badgeClass = 'badge-cat-ministry';
    return `<span class="badge ${badgeClass}">${escapeHtml(catName)}</span>`;
}

function getAnnouncementCategoryBadge(cat) {
    if (!cat) return '<span class="badge badge-dept-general">General</span>';
    const c = cat.toLowerCase().trim();
    if (c === 'urgent') return '<span class="badge badge-expense"><i class="fa-solid fa-triangle-exclamation"></i> Urgent</span>';
    if (c === 'general') return '<span class="badge badge-info">General</span>';
    if (c === 'event') return '<span class="badge badge-dept-discipleship">Event</span>';
    if (c === 'ministry') return '<span class="badge badge-dept-outreach">Ministry</span>';
    if (c === 'worship') return '<span class="badge badge-dept-worship">Worship</span>';
    if (c === 'youth') return '<span class="badge badge-dept-relationship">Youth</span>';
    return `<span class="badge badge-info">${escapeHtml(cat)}</span>`;
}

function populateCascadingMinistries(dept, minSelectEl, emptyLabel = 'None / General Church', selectedMinId = '') {
    if (!minSelectEl) return;
    let list = allMinistriesCache || [];
    if (dept) {
        list = list.filter(m => (m.department || '').toLowerCase() === dept.toLowerCase());
    }
    minSelectEl.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>` +
        list.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');
    if (selectedMinId && list.some(m => String(m.ministry_id) === String(selectedMinId))) {
        minSelectEl.value = String(selectedMinId);
    } else {
        minSelectEl.value = '';
    }
}

// Session verification on load
document.addEventListener('DOMContentLoaded', async () => {
    // Check sessionStorage (tied to browser tab/window lifecycle)
    const token = sessionStorage.getItem('church_token') || localStorage.getItem('church_token');

    if (!token) {
        window.location.href = '/views/login.html';
        return;
    }

    try {
        const meRes = await api.auth.getMe();
        const user = meRes.data;

        if (!user || user.role_name !== 'Admin') {
            showToast('Access Denied. Admins only.');
            sessionStorage.removeItem('church_token');
            sessionStorage.removeItem('church_user');
            localStorage.removeItem('church_token');
            localStorage.removeItem('church_user');
            setTimeout(() => { window.location.href = '/views/login.html'; }, 500);
            return;
        }

        // Keep local cache fresh with server state
        sessionStorage.setItem('church_user', JSON.stringify(user));
        localStorage.removeItem('church_user'); // Keep tabs isolated in sessionStorage
        document.querySelectorAll('#adminName, #adminTopName').forEach(el => el.textContent = user.full_name);
        
        // Connect profile image to sidebar avatar
        const avatarEl = document.getElementById('userAvatar');
        if (avatarEl) {
            if (user.profile_image) {
                avatarEl.innerHTML = `<img src="${escapeHtml(user.profile_image)}" alt="${escapeHtml(user.full_name)}">`;
            } else {
                avatarEl.textContent = (user.full_name || 'A').charAt(0).toUpperCase();
            }
        }
        
        const topbarAvatar = document.getElementById('topbarAvatar');
        if (topbarAvatar) {
            if (user.profile_image) {
                topbarAvatar.innerHTML = `<img src="${escapeHtml(user.profile_image)}" alt="${escapeHtml(user.full_name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null; this.parentElement.textContent='${escapeHtml((user.full_name || 'A').charAt(0).toUpperCase())}';">`;
            } else {
                topbarAvatar.textContent = (user.full_name || 'A').charAt(0).toUpperCase();
            }
        }
        const fnEl = document.getElementById('adminFirstName');
        if (fnEl) fnEl.textContent = user.worda_role || (user.full_name || 'Administrator').split(' ')[0];
        if (typeof updateDropdownUserInfo === 'function') updateDropdownUserInfo();

        // Add file input listener for user modal profile preview
        const profileInput = document.getElementById('user_profile_image');
        if (profileInput) {
            profileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const preview = document.getElementById('user_profile_preview');
                        if (preview) preview.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        // Load the initial dashboard summary
        await loadDashboardSummary();
        if (typeof loadSmsGatewayStatus === 'function') loadSmsGatewayStatus();
        if (typeof loadEmailServiceStatus === 'function') loadEmailServiceStatus();

        // Global single-session watchdog
        if (api && typeof api.startSessionWatchdog === 'function') api.startSessionWatchdog();

        // Initialize click-outside dismissal for all modals
        initModalBackdropClose();

        // Initialize real-time synchronization
        initDashboardRealtimeSync();
    } catch (error) {
        console.error('Session validation failed:', error.message);
        sessionStorage.removeItem('church_token');
        sessionStorage.removeItem('church_user');
        localStorage.removeItem('church_token');
        localStorage.removeItem('church_user');
        window.location.href = '/views/login.html';
    }
});

// ============== REALTIME SYNCHRONIZATION ==============
const churchBroadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('church_realtime_channel') : null;

function broadcastLocalMutation(type, action = 'update') {
    if (churchBroadcastChannel) {
        churchBroadcastChannel.postMessage({ type, action, timestamp: Date.now() });
    }
    try {
        localStorage.setItem('church_realtime_ping', JSON.stringify({ type, action, timestamp: Date.now() }));
    } catch (e) {}
}
window.broadcastLocalMutation = broadcastLocalMutation;

let _lastSummaryLoadTime = 0;
function throttledLoadDashboardSummary() {
    const now = Date.now();
    if (now - _lastSummaryLoadTime < 3500) return;
    _lastSummaryLoadTime = now;
    if (typeof loadDashboardSummary === 'function') {
        loadDashboardSummary();
    }
}

function handleRealtimeDashboardUpdate(payload) {
    if (!payload || !payload.type || payload.type === 'connected') return;
    const type = payload.type;
    const activeView = document.querySelector('.view.active')?.id?.replace('view-', '') || 'dashboard';

    if (activeView === 'dashboard') {
        throttledLoadDashboardSummary();
    }

    if (type === 'events') {
        if (activeView === 'events' && typeof loadEvents === 'function') loadEvents();
    } else if (type === 'announcements') {
        if (activeView === 'announcements' && typeof loadAnnouncements === 'function') loadAnnouncements();
    } else if (type === 'content' || type === 'sermons') {
        if (activeView === 'content') {
            if (typeof loadLiveStreamAdmin === 'function') loadLiveStreamAdmin();
            if (typeof loadSermons === 'function') loadSermons();
        }
    } else if (type === 'c2s') {
        if (activeView === 'c2s' && typeof loadC2SGroups === 'function') loadC2SGroups();
    } else if (type === 'members') {
        if (activeView === 'members' && typeof loadMembers === 'function') loadMembers();
        if (activeView === 'ministries' && typeof loadMinistries === 'function') loadMinistries();
    } else if (type === 'ministries') {
        if (typeof loadMinistries === 'function') loadMinistries();
    } else if (type === 'attendance') {
        if (activeView === 'attendance' && typeof loadAttendance === 'function') loadAttendance();
    } else if (type === 'users') {
        if (activeView === 'users' && typeof loadUsers === 'function') loadUsers();
    }
}

function initDashboardRealtimeSync() {
    if (churchBroadcastChannel) {
        churchBroadcastChannel.onmessage = (e) => {
            handleRealtimeDashboardUpdate(e.data);
        };
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'church_realtime_ping' && e.newValue) {
            try {
                const data = JSON.parse(e.newValue);
                handleRealtimeDashboardUpdate(data);
            } catch (err) {}
        }
    });

    if (typeof EventSource !== 'undefined') {
        let es = null;
        function connectSse() {
            try {
                es = new EventSource('/api/realtime/stream');
                es.onmessage = (e) => {
                    try {
                        const payload = JSON.parse(e.data);
                        handleRealtimeDashboardUpdate(payload);
                    } catch (err) {}
                };
                es.onerror = () => {
                    if (es) { es.close(); es = null; }
                    setTimeout(connectSse, 6000);
                };
            } catch (err) {
                setTimeout(connectSse, 10000);
            }
        }
        connectSse();
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const msgEl = document.getElementById('toastMsg');
    if (msgEl) msgEl.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============== SIDEBAR ACTIVE HELPER ==============
function updateSidebarActive(viewName) {
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
        a.classList.remove('active');
        const onclickAttr = a.getAttribute('onclick') || '';
        const match = onclickAttr.match(/navigateTo\(\s*['"]([^'"]+)['"]/);
        if ((match && match[1] === viewName) || a.dataset.view === viewName) {
            a.classList.add('active');
        }
    });
}

const modalCloseMap = {
    'userModal': () => typeof closeUserModal === 'function' && closeUserModal(),
    'memberModal': () => typeof closeMemberModal === 'function' && closeMemberModal(),
    'ministryModal': () => typeof closeMinistryModal === 'function' && closeMinistryModal(),
    'ministryRosterModal': () => typeof closeMinistryRosterModal === 'function' && closeMinistryRosterModal(),
    'deptHeadModal': () => typeof closeDeptHeadModal === 'function' && closeDeptHeadModal(),
    'albumModal': () => typeof closeAlbumModal === 'function' && closeAlbumModal(),
    'albumPhotosModal': () => typeof closeAlbumPhotosModal === 'function' && closeAlbumPhotosModal(),
    'financeModal': () => typeof closeFinanceModal === 'function' && closeFinanceModal(),
    'eventModal': () => typeof closeEventModal === 'function' && closeEventModal(),
    'announcementModal': () => typeof closeAnnouncementModal === 'function' && closeAnnouncementModal(),
    'sermonModal': () => typeof closeSermonModal === 'function' && closeSermonModal(),
    'videoPlayerModal': () => typeof closeVideoPlayerModal === 'function' && closeVideoPlayerModal(),
    'liveAnalyticsModal': () => typeof closeLiveAnalyticsModal === 'function' && closeLiveAnalyticsModal(),
    'liveCommentsModal': () => typeof closeLiveCommentsModal === 'function' && closeLiveCommentsModal(),
    'livestreamCommentLogsModal': () => typeof closeLivestreamCommentLogsModal === 'function' && closeLivestreamCommentLogsModal(),
    'financeDeptMinFilterModal': () => typeof closeFinanceDeptMinFilterModal === 'function' && closeFinanceDeptMinFilterModal(),
    'financeAnalyticsDeptMinFilterModal': () => typeof closeFinanceAnalyticsDeptMinFilterModal === 'function' && closeFinanceAnalyticsDeptMinFilterModal(),
    'eventDeptMinFilterModal': () => typeof closeEventDeptMinFilterModal === 'function' && closeEventDeptMinFilterModal(),
    'announcementDeptMinFilterModal': () => typeof closeAnnouncementDeptMinFilterModal === 'function' && closeAnnouncementDeptMinFilterModal(),
    'eventEnrollmentsModal': () => typeof closeEventEnrollmentsModal === 'function' && closeEventEnrollmentsModal(),
    'c2sGroupModal': () => typeof closeC2SGroupModal === 'function' && closeC2SGroupModal(),
    'c2sRosterModal': () => typeof closeC2SRosterModal === 'function' && closeC2SRosterModal(),
    'selectMentorModal': () => typeof closeSelectMentorModal === 'function' && closeSelectMentorModal(),
    'selectMenteesModal': () => typeof closeSelectMenteesModal === 'function' && closeSelectMenteesModal(),
    'selectLeaderModal': () => typeof closeSelectLeaderModal === 'function' && closeSelectLeaderModal(),
    'viewModal': () => typeof closeViewModal === 'function' && closeViewModal(),
    'mfaSecurityModal': () => typeof closeMfaSecurityModal === 'function' && closeMfaSecurityModal(),
    'customConfirmModal': () => typeof closeDecisionModal === 'function' && closeDecisionModal()
};

function closeDecisionModal() {
    const modal = document.getElementById('customConfirmModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.removeProperty('display');
    }
}

function initModalBackdropClose() {
    let isMouseDownOnBackdrop = false;

    // Track mousedown to avoid accidental closes when dragging text from inside modal to outside
    document.addEventListener('mousedown', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
            isMouseDownOnBackdrop = true;
        } else {
            isMouseDownOnBackdrop = false;
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isMouseDownOnBackdrop && e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
            const overlayId = e.target.id;
            if (modalCloseMap[overlayId]) {
                try { modalCloseMap[overlayId](); } catch (err) {}
            }
            e.target.classList.remove('active');
            e.target.style.display = '';
            e.target.style.removeProperty('display');
        }
        isMouseDownOnBackdrop = false;
    });

    // Close on Escape key press as well for improved accessibility and UX
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            const activeOverlays = document.querySelectorAll('.modal-overlay.active, .modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]');
            if (activeOverlays.length > 0) {
                const topOverlay = activeOverlays[activeOverlays.length - 1];
                const overlayId = topOverlay.id;
                if (modalCloseMap[overlayId]) {
                    try { modalCloseMap[overlayId](); } catch (err) {}
                }
                topOverlay.classList.remove('active');
                topOverlay.style.display = '';
                topOverlay.style.removeProperty('display');
            }
        }
    });
}
initModalBackdropClose();

function initDateInputsAutoFill() {
    const dateInputIds = ['transaction_date', 'album_event_date', 'sermon_date'];
    dateInputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('focus', function() {
                if (!this.value) this.value = formatLocalDate();
            });
            el.addEventListener('click', function() {
                if (!this.value) this.value = formatLocalDate();
            });
        }
    });

    const dateTimeInputIds = ['start_datetime', 'end_datetime', 'ann_publish_date', 'ann_expiry_date'];
    dateTimeInputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('focus', function() {
                if (!this.value) this.value = formatLocalDateTime();
            });
            el.addEventListener('click', function() {
                if (!this.value) this.value = formatLocalDateTime();
            });
        }
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDateInputsAutoFill);
} else {
    initDateInputsAutoFill();
}

// ============== VIEW ROUTING ==============
function navigateTo(viewName, event) {
    // Update active classes on sidebar
    updateSidebarActive(viewName);

    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Show target view
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.add('active');
        const titles = {
            'dashboard': 'Dashboard',
            'users': 'Account Management',
            'members': 'Member Records',
            'c2s': 'C2S Group',
            'ministries': 'WORDA Departments',
            'finance': 'Financial Management',
            'events': 'Events & Seminary',
            'announcements': 'Announcements',
            'content': 'Content Management',
            'audit': 'System & Audit Trail'
        };
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) pageTitle.innerText = titles[viewName] || (viewName.charAt(0).toUpperCase() + viewName.slice(1));
    }

    if (viewName !== 'content' && typeof stopLiveAnalyticsRealtimeSync === 'function') {
        stopLiveAnalyticsRealtimeSync();
    }

    // Lazy load data when view is opened
    switch(viewName) {
        case 'dashboard': loadDashboardSummary(); break;
        case 'users': loadUsers(1); break;
        case 'members': loadMembers(1); break;
        case 'c2s': 
            if (typeof loadC2STable === 'function') loadC2STable(1);
            else if (typeof loadC2SGroups === 'function') loadC2SGroups(1);
            break;
        case 'ministries': 
            if (typeof loadMinistries === 'function') loadMinistries();
            break;
        case 'finance':
            if (typeof loadFinanceAnalytics === 'function') loadFinanceAnalytics(); 
            ensureFinanceCategoriesLoaded().then(() => {
                if (typeof loadFinanceTable === 'function') loadFinanceTable(1);
            });
            break;
        case 'events': loadEvents(1); break;
        case 'announcements': 
            loadAnnouncements(1); 
            break;
        case 'content': 
            if (typeof loadAlbumsAdmin === 'function') loadAlbumsAdmin(1); 
            if (typeof loadSermons === 'function') loadSermons(1); 
            if (typeof loadLiveStreamAdmin === 'function') loadLiveStreamAdmin();
            break;
        case 'audit': 
            loadAuditTrail(1); 
            if (typeof loadSmsGatewayStatus === 'function') loadSmsGatewayStatus();
            if (typeof loadEmailServiceStatus === 'function') loadEmailServiceStatus();
            break;
    }
    
    // Close sidebar on mobile after clicking a link
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}
window.navigateTo = navigateTo;

// Shortcut routing specifically for Income / Expense cards
function navigateToFinance(mode) {
    if (mode === 'Income' || mode === 'Expense') {
        financeAnalyticsMode = mode;
        const typeSelect = document.getElementById('financeTypeFilter');
        if (typeSelect) typeSelect.value = mode;
    }
    navigateTo('finance');
    if (mode === 'Income' || mode === 'Expense') {
        if (typeof selectFinanceAnalyticsMode === 'function') {
            selectFinanceAnalyticsMode(mode);
        }
        if (typeof onFinanceTypeFilterChange === 'function') {
            onFinanceTypeFilterChange();
        }
    }
}

// ============== DASHBOARD SUMMARY ==============
async function loadDashboardSummary() {
    try {
        const userStr = sessionStorage.getItem('church_user');
        if (userStr) {
            const u = JSON.parse(userStr);
            const fnEl = document.getElementById('adminFirstName');
            if (fnEl) fnEl.textContent = u.worda_role || (u.full_name || 'Administrator').split(' ')[0];
        }
        const dateEl = document.getElementById('adminCurrentDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }

        const [membersRes, ministriesRes, finRes, eventsRes, annRes, sermonsRes] = await Promise.all([
            api.members.getAll(1, 1).catch(() => ({ pagination: { total: 0 } })),
            api.ministries.getAll({ all: true }).catch(() => ({ data: [] })),
            api.finance.getAnalytics().catch(() => ({ data: null })),
            api.events.getAll(1, 1, { status: 'Upcoming' }).catch(() => ({ pagination: { total: 0 } })),
            api.announcements.getAll(1, 5, { is_published: 1 }).catch(() => ({ data: [], pagination: { total: 0 } })),
            api.content.getSermons(1, 5).catch(() => ({ data: [] }))
        ]);

        // Populate Summary Cards
        const sumMembers = document.getElementById('sumMembers');
        if (sumMembers) sumMembers.innerText = (membersRes.pagination ? membersRes.pagination.total : (membersRes.data ? membersRes.data.length : 0));
        
        const sumMinistries = document.getElementById('sumMinistries');
        if (sumMinistries) sumMinistries.innerText = (ministriesRes.data || []).filter(m => m.is_active == 1).length;
        
        // Immediately update WORDA Department summary cards
        const wordaMinList = ministriesRes.data || [];
        const depts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        depts.forEach(dept => {
            const count = wordaMinList.filter(m => (m.department || '').toLowerCase() === dept.toLowerCase()).length;
            const elId = dept === 'Administration' ? 'sumDeptAdmin' : `sumDept${dept}`;
            const el = document.getElementById(elId);
            if (el) el.innerText = count;
        });
        
        const sumIncome = document.getElementById('sumIncome');
        if (sumIncome) sumIncome.innerText = `₱${Number(finRes.data?.summary?.total_income || 0).toLocaleString()}`;
        
        const sumExpense = document.getElementById('sumExpense');
        if (sumExpense) sumExpense.innerText = `₱${Number(finRes.data?.summary?.total_expense || 0).toLocaleString()}`;
        
        const upcomingEvents = eventsRes.pagination ? eventsRes.pagination.total : (eventsRes.data || []).filter(e => e.status === 'Upcoming').length;
        const sumEvents = document.getElementById('sumEvents');
        if (sumEvents) sumEvents.innerText = upcomingEvents;

        // Update Recent Announcements badge count
        const publishedAnnouncements = annRes.pagination ? annRes.pagination.total : (annRes.data || []).length;
        const annBadge = document.getElementById('dashAnnouncementsBadge');
        if (annBadge) annBadge.textContent = `${publishedAnnouncements} Published`;

        // Populate Recent Announcements List
        const annList = document.getElementById('dashRecentAnnouncements');
        if (annList) {
            annList.innerHTML = (annRes.data || []).slice(0, 5).map(a => {
                const dateStr = a.publish_date ? new Date(a.publish_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                return `
                <li class="activity-item">
                    <div class="activity-icon ann"><i class="fa-solid fa-bullhorn"></i></div>
                    <div class="activity-content">
                        <span class="activity-title">${escapeHtml(a.title)}</span>
                        <div class="activity-meta">
                            <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                            <span class="badge badge-info" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">${escapeHtml(a.category || 'General')}</span>
                            <span><i class="fa-solid fa-users"></i> ${escapeHtml(a.target_audience || 'All')}</span>
                        </div>
                    </div>
                    <div class="activity-badge">
                        ${a.sms_triggered == 1 ? '<span class="badge badge-active"><i class="fa-solid fa-check"></i> SMS Sent</span>' : '<span class="badge badge-inactive">No SMS</span>'}
                    </div>
                </li>
                `;
            }).join('') || '<li style="text-align: center; color: var(--text-light); padding: 1.5rem 0;">No announcements published yet.</li>';
        }

        // Populate Latest Sermons List
        const serList = document.getElementById('dashRecentSermons');
        if (serList) {
            serList.innerHTML = (sermonsRes.data || []).slice(0, 5).map(s => {
                const dateStr = s.sermon_date ? new Date(s.sermon_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                return `
                <li class="activity-item">
                    <div class="activity-icon sermon"><i class="fa-solid fa-play"></i></div>
                    <div class="activity-content">
                        <span class="activity-title">${escapeHtml(s.title)}</span>
                        <div class="activity-meta">
                            <span><i class="fa-solid fa-user-tie"></i> ${escapeHtml(s.preacher || 'Pastor')}</span>
                            <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        </div>
                    </div>
                    <div class="activity-badge">
                        ${s.is_live == 1 ? '<span class="badge badge-active" style="background: #fee2e2; color: #dc2626; border-color: #fecaca;"><i class="fa-solid fa-circle" style="font-size: 0.5rem; animation: pulseDot 1.5s infinite;"></i> LIVE</span>' : '<span class="badge badge-info"><i class="fa-solid fa-video"></i> Video</span>'}
                    </div>
                </li>
                `;
            }).join('') || '<li style="text-align: center; color: var(--text-light); padding: 1.5rem 0;">No sermons recorded yet.</li>';
        }

    } catch (error) {
        console.error('Error loading dashboard summary:', error);
    }
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('active');
}

function closeSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('active');
}

function logout() {
    sessionStorage.removeItem('church_token');
    sessionStorage.removeItem('church_user');
    localStorage.removeItem('church_token');
    localStorage.removeItem('church_user');
    localStorage.removeItem('church_active_user_theme');
    localStorage.removeItem('church_active_user_id');
    window.location.href = '/views/login.html';
}

// ============== USER ACCOUNTS MANAGEMENT ==============
let allUsersCache = [];
let currentUserPage = 1;
const USER_PAGE_LIMIT = 10;

async function loadUsers(page = 1) {
    currentUserPage = page;
    const search = (document.getElementById('userSearchInput')?.value || '').trim();
    const role = document.getElementById('userRoleFilter')?.value || '';
    const status = document.getElementById('userStatusFilter')?.value || '';

    const tbody = document.getElementById('usersTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading users...</td></tr>';

    try {
        const res = await api.users.getAll(currentUserPage, USER_PAGE_LIMIT, { search, role, status });
        const users = res.data || [];
        allUsersCache = users;
        renderUsersTable(users);

        const total = res.pagination ? res.pagination.total : users.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / USER_PAGE_LIMIT);

        const pageInfo = document.getElementById('usersPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentUserPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('usersPrevBtn');
        if (prevBtn) prevBtn.disabled = currentUserPage <= 1;

        const nextBtn = document.getElementById('usersNextBtn');
        if (nextBtn) nextBtn.disabled = currentUserPage >= totalPages;
    } catch (error) {
        showToast('Error loading users: ' + error.message);
    }
}

function applyUserFilters() {
    loadUsers(1);
}

function resetUserFilters() {
    if (document.getElementById('userSearchInput')) document.getElementById('userSearchInput').value = '';
    if (document.getElementById('userRoleFilter')) document.getElementById('userRoleFilter').value = '';
    if (document.getElementById('userStatusFilter')) document.getElementById('userStatusFilter').value = '';
    loadUsers(1);
}

function changeUsersPage(direction) {
    const newPage = currentUserPage + direction;
    if (newPage > 0) {
        loadUsers(newPage);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-slate-400">No user accounts found matching filters.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => {
        const avatarImg = u.profile_image 
            ? `<img src="${escapeHtml(u.profile_image)}" alt="${escapeHtml(u.full_name)}">`
            : escapeHtml((u.full_name || 'U').charAt(0).toUpperCase());

        const isUnverified = (u.is_verified == 0);
        const statusBadge = u.is_active == 1 
            ? '<span class="badge badge-status-active"><i class="fa-solid fa-circle-check"></i> Active</span>' 
            : '<span class="badge badge-status-inactive"><i class="fa-solid fa-circle-xmark"></i> Inactive</span>';

        const verificationBadge = isUnverified 
            ? '<span class="badge badge-warning" title="Awaiting Admin Verification"><i class="fa-solid fa-clock"></i> Unverified</span>'
            : '';

        const roleBadge = u.role_name === 'Admin' 
            ? '<span class="badge badge-active">Admin</span>' 
            : (u.role_name === 'Church Leader' ? '<span class="badge badge-info">Leader</span>' : '<span class="badge badge-inactive">Member</span>');

        const verifyButton = isUnverified 
            ? `<button class="btn-verify" onclick="verifyUser(${u.user_id})" title="Verify Account (Send Email Verification)"><i class="fa-solid fa-envelope-circle-check"></i> Verify</button>`
            : '';

        return `
            <tr>
                <td class="p-4">
                    <div class="table-avatar-cell">
                        <div class="table-avatar">${avatarImg}</div>
                        <div>
                            <div class="font-medium text-navy">${escapeHtml(u.full_name)}</div>
                            <div class="text-xs text-slate-400">${escapeHtml(u.contact_number || 'No contact')}</div>
                        </div>
                    </div>
                </td>
                <td class="p-4 font-mono text-xs text-slate-600">${escapeHtml(u.username)}</td>
                <td class="p-4 text-slate-600">${escapeHtml(u.email)}</td>
                <td class="p-4">${roleBadge}</td>
                <td class="p-4">
                    <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                        ${statusBadge}
                        ${verificationBadge}
                    </div>
                </td>
                <td class="p-4 text-right">
                    <div class="action-btns-wrap">
                        ${verifyButton}
                        <button class="btn-action btn-view" onclick="viewUser(${u.user_id})" title="View Details"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-action btn-edit" onclick="editUser(${u.user_id})" title="Edit Account"><i class="fa-solid fa-edit"></i></button>
                        <button class="btn-action btn-delete" onclick="deleteUser(${u.user_id})" title="Delete Account"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function verifyUser(id) {
    try {
        showToast('Sending verification email...');
        const res = await api.users.verify(id);
        showToast(res.message || 'Verification email sent successfully!');
        await loadUsers();
    } catch (err) {
        showToast('Verification failed: ' + err.message);
    }
}

async function resendVerificationEmail(id) {
    try {
        showToast('Sending verification email...');
        const res = await api.users.resendEmail(id);
        showToast(res.message || 'Verification email sent successfully!');
    } catch (err) {
        showToast('Failed to send email: ' + err.message);
    }
}

function openUserModal() {
    document.getElementById('userForm').reset();
    document.getElementById('user_id').value = '';
    document.getElementById('user_first_name').value = '';
    document.getElementById('user_last_name').value = '';
    document.getElementById('user_middle_name').value = '';
    document.getElementById('user_suffix').value = '';
    document.getElementById('user_password').value = '';
    document.getElementById('user_contact_number').value = '';
    document.getElementById('user_profile_preview').src = '/images/default-avatar.svg';
    document.getElementById('userModalTitle').innerText = 'Add User Account';
    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

async function editUser(id) {
    try {
        const res = await api.users.getById(id);
        const user = res.data;
        if (!user) return showToast('User not found');

        document.getElementById('userForm').reset();
        document.getElementById('user_id').value = user.user_id;

        let firstName = user.first_name || '';
        let middleName = user.middle_name || '';
        let lastName = user.last_name || '';
        let suffix = user.suffix || '';

        if (!firstName && !lastName && user.full_name) {
            const parts = user.full_name.trim().split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
        }

        document.getElementById('user_first_name').value = firstName;
        document.getElementById('user_last_name').value = lastName;
        document.getElementById('user_middle_name').value = middleName;
        document.getElementById('user_suffix').value = suffix;

        document.getElementById('user_username').value = user.username || '';
        document.getElementById('user_email').value = user.email || '';
        document.getElementById('user_contact_number').value = user.contact_number || '';
        document.getElementById('user_role').value = user.role_name || 'Church Member';
        document.getElementById('user_is_active').value = user.is_active;
        document.getElementById('user_password').value = '';
        
        if (user.profile_image) {
            document.getElementById('user_profile_preview').src = user.profile_image;
        } else {
            document.getElementById('user_profile_preview').src = '/images/default-avatar.svg';
        }

        document.getElementById('userModalTitle').innerText = 'Edit User Account';
        document.getElementById('userModal').classList.add('active');
    } catch (error) {
        showToast('Error fetching user: ' + error.message);
    }
}

async function saveUser() {
    const id = document.getElementById('user_id').value;
    
    const firstName = document.getElementById('user_first_name').value.trim();
    const lastName = document.getElementById('user_last_name').value.trim();
    const middleName = document.getElementById('user_middle_name').value.trim();
    const suffix = document.getElementById('user_suffix').value.trim();

    if (!firstName || !lastName) {
        return showToast('First Name and Last Name are required.');
    }

    const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');

    const formData = new FormData();
    formData.append('first_name', firstName);
    formData.append('last_name', lastName);
    formData.append('middle_name', middleName);
    formData.append('suffix', suffix);
    formData.append('full_name', fullName);
    formData.append('username', document.getElementById('user_username').value.trim());
    formData.append('email', document.getElementById('user_email').value.trim());
    formData.append('contact_number', document.getElementById('user_contact_number').value.trim());
    formData.append('role_name', document.getElementById('user_role').value);
    formData.append('is_active', document.getElementById('user_is_active').value);

    const password = document.getElementById('user_password').value;
    
    if (!id && !password) {
        return showToast('Password is required for new users.');
    }

    if (password) {
        if (password.length < 6 || password.length > 16) {
            return showToast('Password must be between 6 and 16 characters.');
        }
        formData.append('password', password);
    }

    const imageFile = document.getElementById('user_profile_image').files[0];
    if (imageFile) {
        formData.append('profile_image', imageFile);
    }

    try {
        if (id) {
            const res = await api.users.update(id, formData);
            showToast(res && res.message ? res.message : 'User account updated successfully!');
            
            // Check if current logged-in user changed credentials
            const currentUser = JSON.parse(sessionStorage.getItem('church_user'));
            if (currentUser && currentUser.user_id == id && password) {
                showToast('Password updated. Please log in with your new credentials.');
                setTimeout(() => {
                    sessionStorage.removeItem('church_token');
                    sessionStorage.removeItem('church_user');
                    localStorage.removeItem('church_token');
                    localStorage.removeItem('church_user');
                    window.location.href = '/views/login.html';
                }, 1500);
                return;
            }
        } else {
            await api.users.create(formData);
            showToast('User account created (starts Unverified until admin verification).');
        }
        closeUserModal();
        await loadUsers();
        await loadMembers(); // Keep member records synced
        if (typeof loadMinistries === 'function') {
            await loadMinistries(); // Keep WORDA department rosters and counts in sync
        }
    } catch (error) {
        showToast('Error saving user: ' + error.message);
    }
}

async function deleteUser(id) {
    const ok = await showDecisionModal({
        title: 'Delete User Account',
        message: 'Are you sure you want to delete this user? If they have records, consider setting status to Inactive instead.',
        confirmText: 'Delete User',
        type: 'danger'
    });
    if (!ok) return;
    try {
        await api.users.delete(id);
        showToast('User deleted successfully.');
        await loadUsers();
    } catch (error) {
        showToast('Error deleting user: ' + error.message);
    }
}

function viewUser(id) {
    const user = allUsersCache.find(u => u.user_id == id);
    if (!user) return;
    
    document.getElementById('viewModalTitle').innerText = 'User Account Profile';
    
    const avatarHtml = user.profile_image 
        ? `<img src="${escapeHtml(user.profile_image)}" alt="${escapeHtml(user.full_name)}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 0 auto 1rem auto; display: block;">`
        : `<div style="width: 100px; height: 100px; border-radius: 50%; background: #475569; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; font-weight: 700; margin: 0 auto 1rem auto;">${escapeHtml((user.full_name || 'U').charAt(0).toUpperCase())}</div>`;

    const verificationBadge = user.is_verified == 1 
        ? '<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> Verified</span>' 
        : '<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Unverified</span>';

    const statusBadge = user.is_active == 1 
        ? '<span class="badge badge-active">Active</span>' 
        : '<span class="badge badge-inactive">Inactive</span>';

    document.getElementById('viewModalBody').innerHTML = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
            ${avatarHtml}
            <h3 style="color: var(--navy); margin-bottom: 0.25rem;">${escapeHtml(user.full_name)}</h3>
            <p style="color: #64748b; font-size: 0.9rem;">${escapeHtml(user.role_name || '')}</p>
        </div>
        <ul class="view-details-list">
            <li><span class="label">Username</span> <span class="value font-mono">${escapeHtml(user.username || 'N/A')}</span></li>
            <li><span class="label">Email Address</span> <span class="value">${escapeHtml(user.email || 'N/A')}</span></li>
            <li><span class="label">Contact Number</span> <span class="value font-semibold">${escapeHtml(user.contact_number || 'N/A')}</span></li>
            <li><span class="label">Email Verification</span> <span class="value">${verificationBadge}</span></li>
            <li><span class="label">Account Status</span> <span class="value">${statusBadge}</span></li>
            <li><span class="label">System Role</span> <span class="value">${escapeHtml(user.role_name || 'N/A')}</span></li>
        </ul>
        <div style="margin-top: 1.25rem; text-align: center;">
            <button class="btn-secondary btn-sm" onclick="resendVerificationEmail(${user.user_id})" style="display: inline-flex; align-items: center; gap: 0.5rem; background: #f0fdf4; border-color: #86efac; color: #166534; font-weight: 600; padding: 0.5rem 1rem;">
                <i class="fa-solid fa-envelope-circle-check"></i> Send / Resend Verification Email
            </button>
        </div>
    `;
    document.getElementById('viewModal').classList.add('active');
}

// ============== MEMBER RECORDS MANAGEMENT ==============
let currentMembersPage = 1;
const MEMBER_PAGE_LIMIT = 10;

async function loadMembers(page = 1) {
    currentMembersPage = page;
    const search = (document.getElementById('memberSearchInput')?.value || '').trim();
    const role = document.getElementById('memberRoleFilter')?.value || '';
    const status = document.getElementById('memberStatusFilter')?.value || '';
    const gender = document.getElementById('memberGenderFilter')?.value || '';
    const civilStatus = document.getElementById('memberCivilStatusFilter')?.value || '';

    const tbody = document.getElementById('membersTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading members...</td></tr>';

    try {
        const res = await api.members.getAll(currentMembersPage, MEMBER_PAGE_LIMIT, { search, role, status, gender, civil_status: civilStatus });
        const members = res.data || [];
        allMembersCache = members;
        renderMembersTable(members);

        const total = res.pagination ? res.pagination.total : members.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / MEMBER_PAGE_LIMIT);

        const pageInfo = document.getElementById('membersPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentMembersPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('membersPrevBtn');
        if (prevBtn) prevBtn.disabled = currentMembersPage <= 1;

        const nextBtn = document.getElementById('membersNextBtn');
        if (nextBtn) nextBtn.disabled = currentMembersPage >= totalPages;
    } catch (error) {
        showToast('Error loading members: ' + error.message);
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-rose-500">Failed to load members.</td></tr>';
    }
}

function applyMemberFilters() {
    loadMembers(1);
}

function resetMemberFilters() {
    if (document.getElementById('memberSearchInput')) document.getElementById('memberSearchInput').value = '';
    if (document.getElementById('memberRoleFilter')) document.getElementById('memberRoleFilter').value = '';
    if (document.getElementById('memberStatusFilter')) document.getElementById('memberStatusFilter').value = '';
    if (document.getElementById('memberGenderFilter')) document.getElementById('memberGenderFilter').value = '';
    if (document.getElementById('memberCivilStatusFilter')) document.getElementById('memberCivilStatusFilter').value = '';
    loadMembers(1);
}

function changeMembersPage(direction) {
    const newPage = currentMembersPage + direction;
    if (newPage > 0) {
        loadMembers(newPage);
    }
}

function renderMembersTable(members) {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-slate-400">No members found matching filters.</td></tr>';
        return;
    }

    tbody.innerHTML = members.map(m => `
        <tr>
            <td class="p-4 font-medium text-navy">
                ${escapeHtml(m.first_name)} ${m.middle_name ? escapeHtml(m.middle_name.charAt(0)) + '.' : ''} ${escapeHtml(m.last_name)} ${escapeHtml(m.suffix || '')}
            </td>
            <td class="p-4 font-mono text-xs text-slate-600">${escapeHtml(m.contact_number || 'N/A')}</td>
            <td class="p-4"><span class="badge ${m.church_role === 'Admin' ? 'badge-active' : (m.church_role === 'Leader' ? 'badge-info' : 'badge-inactive')}">${escapeHtml(m.church_role || 'Member')}</span></td>
            <td class="p-4">${getMemberGenderBadge(m.gender)}</td>
            <td class="p-4">${getMemberCivilStatusBadge(m.civil_status)}</td>
            <td class="p-4">${m.membership_date ? new Date(m.membership_date).toLocaleDateString() : 'N/A'}</td>
            <td class="p-4">${getMemberStatusBadge(m.status)}</td>
            <td class="p-4 text-right">
                <div class="action-btns-wrap">
                    <button class="btn-action btn-view" onclick="viewMember(${m.member_id})" title="View"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-action btn-edit" onclick="editMember(${m.member_id})" title="Edit"><i class="fa-solid fa-edit"></i></button>
                    <button class="btn-action btn-delete" onclick="deleteMember(${m.member_id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ===================================================
// AGE & AGE GROUP CALCULATION UTILITIES
// ===================================================
function calculateAge(birthDateString) {
    if (!birthDateString) return null;
    const str = String(birthDateString).split('T')[0];
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    let age = currentYear - year;
    if (currentMonth < month || (currentMonth === month && currentDay < day)) {
        age--;
    }
    return age >= 0 && age <= 130 ? age : null;
}

function getMemberAge(member) {
    if (!member) return null;
    if (member.birth_date) {
        return calculateAge(member.birth_date);
    }
    if (member.age !== undefined && member.age !== null && member.age !== '') {
        const a = parseInt(member.age, 10);
        return isNaN(a) ? null : a;
    }
    return null;
}

function getAgeGroupFromValues(age, gender, civilStatus) {
    if (age === null || age === undefined || isNaN(age)) return '';

    const g = (gender || '').trim().toLowerCase();
    const cs = (civilStatus || '').trim().toLowerCase();
    const isMarried = cs === 'married';
    const isMale = g === 'male';
    const isFemale = g === 'female';

    if (age <= 12) return 'Childrens';
    if (age <= 16) return 'J12';
    if (age <= 20) return 'Youth';
    if (age <= 25) return 'Young Adult';

    // 26 years old and above
    if (isMale && isMarried) return 'Mens';
    if (isFemale && isMarried) return 'Ladies';
    if (cs === 'single') return 'Single Adult';
    if (isMarried) return 'Married Adult';
    return isMale ? 'Mens (Single)' : (isFemale ? 'Ladies (Single)' : 'Adult (26+)');
}

function getMemberAgeGroup(member) {
    if (!member) return 'Unspecified';
    const age = getMemberAge(member);
    if (age === null) return 'Unspecified';
    return getAgeGroupFromValues(age, member.gender, member.civil_status) || 'Unspecified';
}

function matchesAgeGroupFilter(member, filterGroup) {
    if (!filterGroup) return true;
    const age = getMemberAge(member);
    if (age === null) return false;

    const g = (member.gender || '').trim().toLowerCase();
    const cs = (member.civil_status || '').trim().toLowerCase();
    const isMarried = cs === 'married';
    const isMale = g === 'male';
    const isFemale = g === 'female';

    switch (filterGroup) {
        case 'Childrens':
            // Childrens (12 years old and below)
            return age <= 12;
        case 'J12':
            // J12 (12 years old to 16 years old)
            return age >= 12 && age <= 16;
        case 'Youth':
            // Youth (17 years old to 20 years old)
            return age >= 17 && age <= 20;
        case 'Young Adult':
            // Young Adult (21 years old to 25 old)
            return age >= 21 && age <= 25;
        case 'Mens':
            // Mens (26 years old and above, Male, and Married)
            return age >= 26 && isMale && isMarried;
        case 'Ladies':
            // Ladies (26 years old and above, Female and Married)
            return age >= 26 && isFemale && isMarried;
        default:
            return true;
    }
}

function onMemberBirthDateChange() {
    const birthVal = document.getElementById('birth_date')?.value;
    const ageInput = document.getElementById('member_age');
    if (!birthVal) {
        if (ageInput) ageInput.value = '';
        updateMemberAgeGroup();
        return;
    }
    const age = calculateAge(birthVal);
    if (ageInput) {
        ageInput.value = age !== null ? age : '';
    }
    updateMemberAgeGroup();
}

function onMemberAgeInput(val) {
    const birthInput = document.getElementById('birth_date');
    if (val === '' || val === null || val === undefined) {
        if (birthInput) birthInput.value = '';
        updateMemberAgeGroup();
        return;
    }

    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0 || num > 130) {
        updateMemberAgeGroup();
        return;
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    if (birthInput) {
        let monthStr = '01';
        let dayStr = '01';
        if (birthInput.value) {
            const parts = birthInput.value.split('-');
            if (parts.length === 3) {
                monthStr = parts[1];
                dayStr = parts[2];
            }
        }

        const m = parseInt(monthStr, 10) || 1;
        const d = parseInt(dayStr, 10) || 1;
        let birthYear = currentYear - num;
        if (currentMonth < m || (currentMonth === m && currentDay < d)) {
            birthYear = currentYear - num - 1;
        }

        birthInput.value = `${birthYear}-${String(monthStr).padStart(2, '0')}-${String(dayStr).padStart(2, '0')}`;
    }

    updateMemberAgeGroup();
}

function updateMemberAgeGroup() {
    const ageInput = document.getElementById('member_age');
    const genderSelect = document.getElementById('gender');
    const civilStatusSelect = document.getElementById('civil_status');
    const ageGroupInput = document.getElementById('member_age_group');
    if (!ageGroupInput) return;

    let age = null;
    if (ageInput && ageInput.value !== '') {
        age = parseInt(ageInput.value, 10);
        if (isNaN(age)) age = null;
    } else {
        const birthVal = document.getElementById('birth_date')?.value;
        age = calculateAge(birthVal);
    }

    const gender = genderSelect ? genderSelect.value : '';
    const civilStatus = civilStatusSelect ? civilStatusSelect.value : '';
    const group = getAgeGroupFromValues(age, gender, civilStatus);
    ageGroupInput.value = group;
}

function openMemberModal(member = null) {
    const form = document.getElementById('memberForm');
    form.reset();
    document.getElementById('memberId').value = '';

    if (member) {
        document.getElementById('modalTitle').textContent = 'Edit Member';
        document.getElementById('memberId').value = member.member_id;
        document.getElementById('first_name').value = member.first_name || '';
        document.getElementById('middle_name').value = member.middle_name || '';
        document.getElementById('last_name').value = member.last_name || '';
        document.getElementById('suffix').value = member.suffix || '';
        document.getElementById('contact_number').value = member.contact_number || '';
        document.getElementById('member_email').value = member.email || '';

        const birthDateStr = member.birth_date ? member.birth_date.split('T')[0] : '';
        document.getElementById('birth_date').value = birthDateStr;
        document.getElementById('gender').value = member.gender || '';
        document.getElementById('civil_status').value = member.civil_status || '';
        document.getElementById('membership_date').value = member.membership_date ? member.membership_date.split('T')[0] : '';
        document.getElementById('church_role').value = member.church_role || 'Member';
        document.getElementById('status').value = member.status || 'Active';
        document.getElementById('address').value = member.address || '';

        // Calculate and display Age Info & Age Group
        const age = getMemberAge(member);
        const ageInput = document.getElementById('member_age');
        if (ageInput) ageInput.value = age !== null ? age : '';
        if (!birthDateStr && age !== null) {
            onMemberAgeInput(age);
        }
        updateMemberAgeGroup();
    } else {
        document.getElementById('modalTitle').textContent = 'Add New Member';
        document.getElementById('status').value = 'Active';
        document.getElementById('church_role').value = 'Member';
        const ageInput = document.getElementById('member_age');
        if (ageInput) ageInput.value = '';
        const ageGroupInput = document.getElementById('member_age_group');
        if (ageGroupInput) ageGroupInput.value = '';
    }
    document.getElementById('memberModal').classList.add('active');
}

function closeMemberModal() {
    document.getElementById('memberModal').classList.remove('active');
}

async function editMember(id) {
    try {
        const response = await api.members.getById(id);
        openMemberModal(response.data);
    } catch (error) {
        showToast('Error fetching member details: ' + error.message);
    }
}

async function saveMember() {
    const id = document.getElementById('memberId').value;
    const data = {
        first_name: document.getElementById('first_name').value.trim(),
        middle_name: document.getElementById('middle_name').value.trim(),
        last_name: document.getElementById('last_name').value.trim(),
        suffix: document.getElementById('suffix').value.trim(),
        contact_number: document.getElementById('contact_number').value.trim(),
        email: document.getElementById('member_email').value.trim(),
        birth_date: document.getElementById('birth_date').value,
        gender: document.getElementById('gender').value,
        civil_status: document.getElementById('civil_status').value,
        membership_date: document.getElementById('membership_date').value,
        church_role: document.getElementById('church_role').value,
        status: document.getElementById('status').value,
        address: document.getElementById('address').value.trim()
    };

    if (!data.first_name || !data.last_name) {
        return showToast('First Name and Last Name are required.');
    }

    // If birth date is empty but age was entered, estimate birth date
    if (!data.birth_date && document.getElementById('member_age')?.value) {
        const a = parseInt(document.getElementById('member_age').value, 10);
        if (!isNaN(a) && a >= 0) {
            data.birth_date = `${new Date().getFullYear() - a}-01-01`;
        }
    }

    try {
        if (id) {
            const res = await api.members.update(id, data);
            showToast(res && res.message ? res.message : 'Member record updated successfully!');
        } else {
            const res = await api.members.create(data);
            showToast(res && res.message ? res.message : 'Member record added successfully!');
        }
        closeMemberModal();
        await loadMembers();
        await loadUsers(); // Keep users table in sync
        if (typeof loadMinistries === 'function') {
            await loadMinistries(); // Keep WORDA department rosters and counts in sync
        }
    } catch (error) {
        showToast('Error saving member: ' + error.message);
    }
}

async function deleteMember(id) {
    const ok = await showDecisionModal({
        title: 'Delete Member Record',
        message: 'Are you sure you want to delete this member? This action cannot be undone.',
        confirmText: 'Delete Member',
        type: 'danger'
    });
    if (!ok) return;

    try {
        await api.members.delete(id);
        showToast('Member deleted successfully!');
        await loadMembers();
        if (typeof loadMinistries === 'function') {
            await loadMinistries();
        }
    } catch (error) {
        showToast('Error deleting member: ' + error.message);
    }
}

async function viewMember(id) {
    let member = allMembersCache.find(m => m.member_id == id);
    if (!member) {
        try {
            const res = await api.members.getById(id);
            member = res.data;
        } catch (error) {
            return showToast('Error fetching member details: ' + error.message);
        }
    }
    
    if (!member) return showToast('Member not found.');
    
    const age = getMemberAge(member);
    const ageGroup = getMemberAgeGroup(member);

    document.getElementById('viewModalTitle').innerText = 'Member Profile Details';
    document.getElementById('viewModalBody').innerHTML = `
        <ul class="view-details-list">
            <li><span class="label">Full Name</span> <span class="value font-semibold text-navy">${escapeHtml(member.first_name)} ${member.middle_name ? escapeHtml(member.middle_name.charAt(0))+'.' : ''} ${escapeHtml(member.last_name)} ${escapeHtml(member.suffix || '')}</span></li>
            <li><span class="label">Contact (+63)</span> <span class="value font-mono">${escapeHtml(member.contact_number || 'N/A')}</span></li>
            <li><span class="label">Email</span> <span class="value">${escapeHtml(member.email || 'N/A')}</span></li>
            <li><span class="label">Portal Username</span> <span class="value font-mono font-semibold text-primary">${escapeHtml(member.username || 'Not assigned')}</span></li>
            <li><span class="label">Account Status</span> <span class="value">${member.user_id ? '<span class="badge badge-active"><i class="fa-solid fa-circle-check mr-1"></i> Account Linked</span>' : '<span class="badge badge-inactive"><i class="fa-solid fa-circle-xmark mr-1"></i> No Account</span>'}</span></li>
            <li><span class="label">Church Role</span> <span class="value">${escapeHtml(member.church_role || 'Member')}</span></li>
            <li><span class="label">Status</span> <span class="value"><span class="badge ${member.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(member.status)}</span></span></li>
            <li><span class="label">Birth Date</span> <span class="value">${member.birth_date ? new Date(member.birth_date).toLocaleDateString() : 'N/A'}</span></li>
            <li><span class="label">Age</span> <span class="value font-semibold text-navy">${age !== null ? `${age} years old` : 'N/A'}</span></li>
            <li><span class="label">Age Group</span> <span class="value"><span class="badge badge-info" style="font-weight: 600;">${escapeHtml(ageGroup)}</span></span></li>
            <li><span class="label">Gender</span> <span class="value">${escapeHtml(member.gender || 'N/A')}</span></li>
            <li><span class="label">Civil Status</span> <span class="value">${escapeHtml(member.civil_status || 'N/A')}</span></li>
            <li><span class="label">Membership Date</span> <span class="value">${member.membership_date ? new Date(member.membership_date).toLocaleDateString() : 'N/A'}</span></li>
            <li><span class="label">Address</span> <span class="value">${escapeHtml(member.address || 'N/A')}</span></li>
        </ul>
    `;
    document.getElementById('viewModal').classList.add('active');
}

// ============== WORDA DEPARTMENTS & MINISTRIES ==============
let selectedWordaDept = null;
let departmentHeadsCache = [];
let activeMinistryAccordionId = null;
let ministryRosterCache = {};

async function loadMinistries() {
    try {
        ministryRosterCache = {};
        const [minRes, headsRes] = await Promise.all([
            api.ministries.getAll({ all: true }),
            api.ministries.getDepartmentHeads()
        ]);
        
        allMinistriesCache = minRes.data || [];
        departmentHeadsCache = (headsRes && headsRes.data) ? headsRes.data : [];

        // Update WORDA department summary cards
        const depts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        depts.forEach(dept => {
            const count = allMinistriesCache.filter(m => (m.department || '').toLowerCase() === dept.toLowerCase()).length;
            const elId = dept === 'Administration' ? 'sumDeptAdmin' : `sumDept${dept}`;
            const el = document.getElementById(elId);
            if (el) el.innerText = count;
        });

        // Also update Active Ministries card on main Dashboard view
        const sumMinistries = document.getElementById('sumMinistries');
        if (sumMinistries) {
            sumMinistries.innerText = allMinistriesCache.filter(m => m.is_active == 1).length;
        }

        // If a department is currently opened inline, refresh its ministries list
        if (selectedWordaDept) {
            renderWordaDeptInlineDetails(selectedWordaDept);
        }

        // Keep all ministry select dropdowns in Finance & Events synchronized
        populateAllMinistrySelects();

        applyMinistryFilters();
    } catch (error) {
        showToast('Error loading WORDA departments: ' + error.message);
    }
}

async function selectWordaDepartment(deptName) {
    if (selectedWordaDept && selectedWordaDept.toLowerCase() === deptName.toLowerCase()) {
        // Clicking same department card toggles it closed
        closeWordaDeptInlineDetails();
        const deptFilter = document.getElementById('ministryDeptFilter');
        if (deptFilter) {
            deptFilter.value = '';
            applyMinistryFilters();
        }
        return;
    }
    selectedWordaDept = deptName;

    // Synchronize the table filter dropdown below so table matches clicked card
    const deptFilter = document.getElementById('ministryDeptFilter');
    if (deptFilter) {
        deptFilter.value = deptName;
        applyMinistryFilters();
    }

    if (!allMinistriesCache || allMinistriesCache.length === 0) {
        await loadMinistries();
    }

    // Update active highlight on summary cards
    const depts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
    depts.forEach(d => {
        const card = document.getElementById(`wordaCard${d}`);
        if (card) {
            if (d.toLowerCase() === deptName.toLowerCase()) {
                card.classList.add('active-dept-card');
            } else {
                card.classList.remove('active-dept-card');
            }
        }
    });

    renderWordaDeptInlineDetails(deptName);

    const container = document.getElementById('wordaDeptInlineDetails');
    if (container) {
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function closeWordaDeptInlineDetails() {
    selectedWordaDept = null;
    activeMinistryAccordionId = null;
    const container = document.getElementById('wordaDeptInlineDetails');
    if (container) container.style.display = 'none';

    const btnManageC2S = document.getElementById('btnManageC2SFromWorda');
    if (btnManageC2S) btnManageC2S.style.display = 'none';

    const depts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
    depts.forEach(d => {
        const card = document.getElementById(`wordaCard${d}`);
        if (card) card.classList.remove('active-dept-card');
    });
}

function renderWordaDeptInlineDetails(deptName) {
    const titleEl = document.getElementById('wordaDeptTitle');
    const subtitleEl = document.getElementById('wordaDeptSubtitle');
    const badgeIconEl = document.getElementById('wordaDeptIconBadge');
    const countBadgeEl = document.getElementById('wordaDeptCountBadge');
    const accordionListEl = document.getElementById('wordaDeptMinistriesAccordion');
    const btnManageC2S = document.getElementById('btnManageC2SFromWorda');
    const btnManageDeptHead = document.getElementById('btnManageDeptHead');

    if (btnManageDeptHead) {
        btnManageDeptHead.onclick = () => openManageDeptHeadModal(deptName);
    }

    if (btnManageC2S) {
        btnManageC2S.style.display = ((deptName || '').toLowerCase() === 'relationship') ? 'inline-flex' : 'none';
    }

    // Render Department Head Banner
    const bannerEl = document.getElementById('wordaDeptHeadBanner');
    if (bannerEl) {
        const currentHead = (departmentHeadsCache || []).find(h => (h.department || '').toLowerCase() === (deptName || '').toLowerCase());
        if (currentHead && currentHead.head_member_id) {
            bannerEl.innerHTML = `
                <div class="head-assigned-card flex items-center justify-between flex-wrap gap-3 p-3.5 rounded-lg border" style="background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.25);">
                    <div class="flex items-center gap-3">
                        ${currentHead.head_profile_image 
                            ? `<img src="${escapeHtml(currentHead.head_profile_image)}" alt="" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--gold, #d97706); box-shadow: 0 2px 6px rgba(0,0,0,0.1);" onerror="this.outerHTML='<div class=\\\'flex items-center justify-center rounded-full text-blue-600 bg-blue-100 font-bold\\\' style=\\\width:44px;height:44px;font-size:1.1rem;\\\'><i class=\\\'fa-solid fa-user-tie\\\'></i></div>'">`
                            : `<div class="flex items-center justify-center rounded-full text-blue-600 bg-blue-100 font-bold" style="width: 44px; height: 44px; font-size: 1.2rem; border: 2px solid rgba(59,130,246,0.3);"><i class="fa-solid fa-user-tie"></i></div>`
                        }
                        <div>
                            <div class="text-xs uppercase font-bold text-slate-500 tracking-wider">Department Head</div>
                            <div class="flex items-center gap-2 mt-0.5">
                                <strong class="text-base text-navy font-bold">${escapeHtml(currentHead.head_name || 'Assigned')}</strong>
                                <span class="badge ${currentHead.church_role === 'Admin' ? 'badge-primary' : 'badge-gold'}" style="font-size: 0.7rem; padding: 0.15rem 0.55rem; font-weight: 700;">
                                    <i class="fa-solid fa-crown mr-1"></i>${escapeHtml(currentHead.church_role === 'Admin' ? 'Church Admin' : 'Church Leader')}
                                </span>
                            </div>
                            <div class="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                                ${currentHead.email ? `<span><i class="fa-regular fa-envelope text-slate-400 mr-1"></i>${escapeHtml(currentHead.email)}</span>` : ''}
                                ${currentHead.contact_number ? `<span class="font-mono"><i class="fa-solid fa-phone text-slate-400 mr-1"></i>${escapeHtml(currentHead.contact_number)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn-secondary btn-sm" onclick="openManageDeptHeadModal('${escapeHtml(deptName)}')" title="Change Department Head">
                        <i class="fa-solid fa-pen-to-square mr-1"></i> Change Head
                    </button>
                </div>
            `;
        } else {
            bannerEl.innerHTML = `
                <div class="head-unassigned-card flex items-center justify-between flex-wrap gap-3 p-3.5 rounded-lg border border-dashed border-amber-300" style="background: rgba(245, 158, 11, 0.06);">
                    <div class="flex items-center gap-3">
                        <div class="flex items-center justify-center rounded-full text-amber-700 bg-amber-100 font-bold" style="width: 44px; height: 44px; font-size: 1.2rem;">
                            <i class="fa-solid fa-user-tie"></i>
                        </div>
                        <div>
                            <div class="text-xs uppercase font-bold text-slate-500 tracking-wider">Department Head</div>
                            <div class="text-sm font-bold text-amber-800">No Department Head Assigned</div>
                            <div class="text-xs text-slate-500 mt-0.5">Assign a Church Leader or Church Admin to oversee all ministries in this department.</div>
                        </div>
                    </div>
                    <button type="button" class="btn-primary btn-sm" onclick="openManageDeptHeadModal('${escapeHtml(deptName)}')" title="Assign Department Head">
                        <i class="fa-solid fa-user-plus mr-1"></i> Assign Head
                    </button>
                </div>
            `;
        }
    }

    if (!accordionListEl) return;

    if (titleEl) titleEl.textContent = `${deptName} Department Ministries`;
    if (subtitleEl) subtitleEl.textContent = `Click any ministry below to expand its leader, meeting schedule, and complete member roster with roles and status.`;

    const icons = {
        'Worship': '<i class="fa-solid fa-hands-praying" style="color: #3b82f6;"></i>',
        'Outreach': '<i class="fa-solid fa-earth-americas" style="color: #10b981;"></i>',
        'Relationship': '<i class="fa-solid fa-people-arrows" style="color: #f59e0b;"></i>',
        'Discipleship': '<i class="fa-solid fa-book-bible" style="color: #8b5cf6;"></i>',
        'Administration': '<i class="fa-solid fa-building-columns" style="color: #64748b;"></i>'
    };
    if (badgeIconEl) badgeIconEl.innerHTML = icons[deptName] || '<i class="fa-solid fa-church"></i>';

    const deptMinistries = allMinistriesCache.filter(m => (m.department || '').toLowerCase() === deptName.toLowerCase());
    if (countBadgeEl) countBadgeEl.textContent = `${deptMinistries.length} ${deptMinistries.length === 1 ? 'ministry' : 'ministries'}`;

    if (deptMinistries.length === 0) {
        accordionListEl.innerHTML = `
            <div class="text-center p-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <i class="fa-solid fa-folder-open text-3xl mb-2 text-slate-300"></i>
                <p class="font-medium text-slate-600">No ministries found in the ${escapeHtml(deptName)} Department.</p>
                <p class="text-xs text-slate-400 mt-1">Click the button below to add the first ministry to this department.</p>
                <button class="btn-primary btn-sm mt-3" onclick="openMinistryModal()"><i class="fa-solid fa-plus"></i> Add Ministry</button>
            </div>
        `;
        return;
    }

    accordionListEl.innerHTML = deptMinistries.map(m => `
        <div class="dept-accordion-item ${activeMinistryAccordionId === m.ministry_id ? 'is-open' : ''}" id="deptMinAccordion_${m.ministry_id}" style="border-left: 4px solid ${m.color_code || '#3b82f6'};">
            <div class="dept-accordion-header" onclick="toggleMinistryAccordion(${m.ministry_id})">
                <div class="flex items-center gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <strong class="text-navy text-sm font-semibold">${escapeHtml(m.ministry_name)}</strong>
                            <span class="badge badge-info" style="font-size: 0.7rem; margin-left: 0.35rem; padding: 0.2rem 0.6rem;">${escapeHtml(m.ministry_code || 'N/A')}</span>
                            <span class="badge ${m.is_active == 1 ? 'badge-status-active' : 'badge-status-inactive'}" style="font-size: 0.7rem; padding: 0.2rem 0.6rem;">${m.is_active == 1 ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div class="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                            <span><i class="fa-solid fa-user-tie text-gold mr-1"></i> Leader: <strong class="text-slate-700">${escapeHtml(m.leader_name || 'Unassigned')}</strong></span>
                            <span><i class="fa-regular fa-clock text-slate-400 mr-1"></i> ${escapeHtml(m.meeting_schedule || 'No schedule set')}</span>
                            <span><i class="fa-solid fa-users text-slate-400 mr-1"></i> <strong class="text-slate-700">${m.member_count || 0}</strong> assigned</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); openMinistryRosterModal(${m.ministry_id})" title="Manage Roster">
                        <i class="fa-solid fa-user-gear"></i> Manage
                    </button>
                    <span class="dept-accordion-chevron"><i class="fa-solid fa-chevron-down"></i></span>
                </div>
            </div>
            <div class="dept-accordion-body" id="deptMinAccordionBody_${m.ministry_id}">
                <div class="dept-leader-box">
                    <div>
                        <div class="text-xs uppercase font-bold text-slate-500 mb-0.5">Ministry Leader</div>
                        <div class="flex items-center gap-2 mt-1">
                            ${m.leader_profile_image 
                                ? `<img src="${escapeHtml(m.leader_profile_image)}" alt="" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #cbd5e1;" onerror="this.outerHTML='<i class=\\'fa-solid fa-crown text-gold mr-1\\'></i>'">`
                                : `<i class="fa-solid fa-crown text-gold mr-1"></i>`
                            }
                            <div class="font-bold text-navy text-sm">${escapeHtml(m.leader_name || 'No leader assigned')}</div>
                        </div>
                    </div>
                    <div>
                        <div class="text-xs uppercase font-bold text-slate-500 mb-0.5">Meeting Schedule</div>
                        <div class="text-xs font-semibold text-slate-700"><i class="fa-regular fa-calendar-days text-slate-500 mr-1"></i> ${escapeHtml(m.meeting_schedule || 'Not specified')}</div>
                    </div>
                    <div style="flex-basis: 100%; margin-top: 0.25rem;">
                        <div class="text-xs uppercase font-bold text-slate-500 mb-0.5">Description & Purpose</div>
                        <div class="text-xs text-slate-600">${escapeHtml(m.description || 'No description provided for this ministry.')}</div>
                    </div>
                </div>

                <!-- Member Roster Header & Table -->
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-bold text-navy text-xs uppercase tracking-wide">
                        <i class="fa-solid fa-users text-gold mr-1"></i> Assigned Members Roster
                    </h4>
                </div>
                <div class="overflow-x-auto rounded border border-slate-200" id="deptRosterContainer_${m.ministry_id}">
                    <div class="p-4 text-center text-slate-400 text-xs"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Loading roster...</div>
                </div>
            </div>
        </div>
    `).join('');

    if (activeMinistryAccordionId) {
        loadDeptMinistryRoster(activeMinistryAccordionId);
    }
}

async function toggleMinistryAccordion(ministryId) {
    const itemEl = document.getElementById(`deptMinAccordion_${ministryId}`);
    if (!itemEl) return;

    const isOpen = itemEl.classList.contains('is-open');

    // Close any other open accordion
    const allItems = document.querySelectorAll('.dept-accordion-item');
    allItems.forEach(it => it.classList.remove('is-open'));

    if (!isOpen) {
        itemEl.classList.add('is-open');
        activeMinistryAccordionId = ministryId;
        await loadDeptMinistryRoster(ministryId);
    } else {
        activeMinistryAccordionId = null;
    }
}

async function loadDeptMinistryRoster(ministryId) {
    const container = document.getElementById(`deptRosterContainer_${ministryId}`);
    if (!container) return;

    try {
        let members = ministryRosterCache[ministryId];
        if (!members) {
            const res = await api.ministries.getMembers(ministryId);
            members = res.data || [];
            ministryRosterCache[ministryId] = members;
        }

        if (members.length === 0) {
            container.innerHTML = `
                <div class="p-6 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-user-slash text-2xl text-slate-300 mb-1"></i>
                    <p>No members currently assigned to this ministry.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="dept-roster-table">
                <thead>
                    <tr>
                        <th>Member Name</th>
                        <th>Role in Ministry</th>
                        <th>Status</th>
                        <th>Contact Number</th>
                        <th>Email</th>
                    </tr>
                </thead>
                <tbody>
                    ${members.map(mem => {
                        const isLeader = mem.is_ministry_leader == 1;
                        return `
                        <tr style="${isLeader ? 'background: #fffdf5; border-left: 3px solid #f59e0b;' : ''}">
                            <td class="font-semibold text-navy">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    ${mem.profile_image 
                                        ? `<img src="${escapeHtml(mem.profile_image)}" alt="" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;" onerror="this.outerHTML='<i class=\\'fa-solid fa-user text-slate-400 mr-1.5 text-xs\\'></i>'">`
                                        : `<i class="fa-solid fa-user text-slate-400 mr-1.5 text-xs"></i>`
                                    }
                                    <span>${escapeHtml(mem.first_name)} ${escapeHtml(mem.last_name)}</span>
                                    ${isLeader ? `<span class="badge" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 0.68rem; font-weight: 700; padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-crown text-amber-500"></i> Leader</span>` : ''}
                                </div>
                            </td>
                            <td>
                                <span class="badge ${isLeader ? 'badge-info' : 'badge-income'}" style="font-size: 0.72rem; ${isLeader ? 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700;' : ''}">
                                    ${isLeader ? '<i class="fa-solid fa-crown mr-1" style="color: #d97706;"></i> ' : ''}${escapeHtml(mem.role_in_ministry || (isLeader ? 'Ministry Leader' : 'Member'))}
                                </span>
                            </td>
                            <td>
                                <span class="badge ${mem.status === 'Active' ? 'badge-active' : 'badge-inactive'}" style="font-size: 0.72rem;">
                                    ${escapeHtml(mem.status || 'Active')}
                                </span>
                            </td>
                            <td class="text-xs text-slate-600">${escapeHtml(mem.contact_number || 'N/A')}</td>
                            <td class="text-xs text-slate-600">${escapeHtml(mem.email || 'N/A')}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = `<div class="p-4 text-center text-red-500 text-xs">Error loading roster: ${escapeHtml(error.message)}</div>`;
    }
}

let currentMinistriesPage = 1;
const MINISTRY_PAGE_LIMIT = 10;

async function loadMinistriesTable(page = 1) {
    currentMinistriesPage = page;
    const search = (document.getElementById('ministrySearchInput')?.value || '').trim();
    const dept = document.getElementById('ministryDeptFilter')?.value || '';
    const status = document.getElementById('ministryStatusFilter')?.value || '';

    const tbody = document.getElementById('ministriesTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading ministries...</td></tr>';

    try {
        const res = await api.ministries.getAll(currentMinistriesPage, MINISTRY_PAGE_LIMIT, { search, department: dept, status });
        const list = res.data || [];
        renderMinistriesTable(list);

        const total = res.pagination ? res.pagination.total : list.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / MINISTRY_PAGE_LIMIT);

        const pageInfo = document.getElementById('ministriesPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentMinistriesPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('ministriesPrevBtn');
        if (prevBtn) prevBtn.disabled = currentMinistriesPage <= 1;

        const nextBtn = document.getElementById('ministriesNextBtn');
        if (nextBtn) nextBtn.disabled = currentMinistriesPage >= totalPages;
    } catch (e) {
        console.error('Error loading ministries table:', e);
    }
}

function applyMinistryFilters() {
    loadMinistriesTable(1);
}

function resetMinistryFilters() {
    if (document.getElementById('ministrySearchInput')) document.getElementById('ministrySearchInput').value = '';
    if (document.getElementById('ministryDeptFilter')) document.getElementById('ministryDeptFilter').value = '';
    if (document.getElementById('ministryStatusFilter')) document.getElementById('ministryStatusFilter').value = '';
    loadMinistriesTable(1);
}

function changeMinistriesPage(direction) {
    const newPage = currentMinistriesPage + direction;
    if (newPage > 0) {
        loadMinistriesTable(newPage);
    }
}

function renderMinistriesTable(ministries) {
    const tbody = document.getElementById('ministriesTableBody');
    if (!tbody) return;

    if (ministries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-slate-400">No ministries found matching criteria.</td></tr>';
        return;
    }

    tbody.innerHTML = ministries.map(m => `
        <tr>
            <td class="p-4 font-medium text-navy">${escapeHtml(m.ministry_name)}</td>
            <td class="p-4"><span class="badge ${getDeptBadgeClass(m.department)}">${escapeHtml(m.department || 'N/A')}</span></td>
            <td class="p-4 font-mono text-xs text-slate-600">${escapeHtml(m.ministry_code || 'N/A')}</td>
            <td class="p-4">${escapeHtml(m.leader_name || 'Unassigned')}</td>
            <td class="p-4 text-xs text-slate-500">${escapeHtml(m.meeting_schedule || 'N/A')}</td>
            <td class="p-4"><span class="font-semibold text-slate-700">${m.member_count || 0}</span> members</td>
            <td class="p-4"><span class="badge ${m.is_active == 1 ? 'badge-status-active' : 'badge-status-inactive'}">${m.is_active == 1 ? 'Active' : 'Inactive'}</span></td>
            <td class="p-4 text-right">
                <div class="action-btns-wrap">
                    <button class="btn-action btn-view" onclick="openMinistryRosterModal(${m.ministry_id})" title="Manage Members Roster"><i class="fa-solid fa-users"></i> Roster</button>
                    <button class="btn-action btn-edit" onclick="editMinistry(${m.ministry_id})" title="Edit Ministry"><i class="fa-solid fa-edit"></i></button>
                    <button class="btn-action btn-delete" onclick="deleteMinistry(${m.ministry_id})" title="Delete Ministry"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function syncMinistryMeetingSchedule() {
    const day = document.getElementById('ministry_meeting_day')?.value || '';
    const timeVal = document.getElementById('ministry_meeting_time')?.value || '';
    let timeStr = '';
    if (timeVal) {
        const parts = timeVal.split(':');
        let hour = parseInt(parts[0], 10);
        const mins = parts[1] || '00';
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        timeStr = `${hour}:${mins} ${ampm}`;
    }
    const combined = [day, timeStr].filter(Boolean).join(' ');
    const schedInput = document.getElementById('meeting_schedule');
    if (schedInput && combined) {
        schedInput.value = combined;
    }
}

function openMinistryModal(ministry = null) {
    const form = document.getElementById('ministryForm');
    form.reset();
    document.getElementById('ministryId').value = '';

    const daySelect = document.getElementById('ministry_meeting_day');
    const timeInput = document.getElementById('ministry_meeting_time');
    if (daySelect) daySelect.value = '';
    if (timeInput) timeInput.value = '';

    if (ministry) {
        document.getElementById('ministryModalTitle').textContent = 'Edit Ministry';
        document.getElementById('ministryId').value = ministry.ministry_id;
        document.getElementById('ministry_name').value = ministry.ministry_name;
        document.getElementById('ministry_department').value = ministry.department || 'Worship';
        document.getElementById('ministry_code').value = ministry.ministry_code || '';
        document.getElementById('description').value = ministry.description || '';
        const sched = ministry.meeting_schedule || '';
        document.getElementById('meeting_schedule').value = sched;

        // Auto parse day and time from schedule string if possible
        if (sched && daySelect && timeInput) {
            const days = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Weekly', 'Monthly'];
            const matchedDay = days.find(d => sched.toLowerCase().includes(d.toLowerCase().slice(0, 3)));
            if (matchedDay) daySelect.value = matchedDay;

            const timeMatch = sched.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (timeMatch) {
                let hh = parseInt(timeMatch[1], 10);
                const mm = timeMatch[2];
                const ap = (timeMatch[3] || '').toUpperCase();
                if (ap === 'PM' && hh < 12) hh += 12;
                if (ap === 'AM' && hh === 12) hh = 0;
                timeInput.value = `${String(hh).padStart(2, '0')}:${mm}`;
            }
        }

        if (ministry.leader_member_id) {
            selectLeaderForMinistry(ministry.leader_member_id, ministry.leader_name || 'Assigned Leader');
        } else {
            clearSelectedLeader();
        }
        const activeSelect = document.getElementById('ministry_is_active') || document.getElementById('is_active');
        if (activeSelect) activeSelect.value = String(ministry.is_active !== undefined ? ministry.is_active : 1);
    } else {
        document.getElementById('ministryModalTitle').textContent = 'Add New Ministry';
        clearSelectedLeader();
        const activeSelect = document.getElementById('ministry_is_active') || document.getElementById('is_active');
        if (activeSelect) activeSelect.value = '1';
    }
    document.getElementById('ministryModal').classList.add('active');
}

function closeMinistryModal() {
    document.getElementById('ministryModal').classList.remove('active');
}

async function editMinistry(id) {
    const ministry = allMinistriesCache.find(m => m.ministry_id == id);
    if (ministry) {
        openMinistryModal(ministry);
    } else {
        try {
            const res = await api.ministries.getById(id);
            openMinistryModal(res.data);
        } catch (e) {
            showToast('Error loading ministry: ' + e.message);
        }
    }
}

async function saveMinistry() {
    const id = document.getElementById('ministryId').value;
    const deptName = document.getElementById('ministry_department').value;
    const deptColors = {
        'Worship': '#3b82f6',
        'Outreach': '#10b981',
        'Relationship': '#f59e0b',
        'Discipleship': '#8b5cf6',
        'Administration': '#64748b'
    };

    const activeEl = document.getElementById('ministry_is_active') || document.getElementById('is_active');
    const data = {
        ministry_name: document.getElementById('ministry_name').value.trim(),
        department: deptName,
        ministry_code: document.getElementById('ministry_code').value.trim(),
        description: document.getElementById('description').value.trim(),
        meeting_schedule: document.getElementById('meeting_schedule').value.trim(),
        leader_member_id: document.getElementById('leader_member_id').value || null,
        color_code: deptColors[deptName] || '#3b82f6',
        is_active: activeEl ? activeEl.value : '1'
    };

    if (!data.ministry_name || !data.ministry_code) {
        return showToast('Ministry Name and Ministry Code are required.');
    }

    try {
        if (id) {
            await api.ministries.update(id, data);
            showToast('Ministry updated successfully!');
        } else {
            await api.ministries.create(data);
            showToast('Ministry created successfully!');
        }
        closeMinistryModal();
        await loadMinistries();
    } catch (error) {
        showToast('Error saving ministry: ' + error.message);
    }
}

async function deleteMinistry(id) {
    const ok = await showDecisionModal({
        title: 'Delete Ministry',
        message: 'Are you sure you want to delete this ministry? Member assignments will be unlinked.',
        confirmText: 'Delete Ministry',
        type: 'danger'
    });
    if (!ok) return;
    try {
        await api.ministries.delete(id);
        showToast('Ministry deleted successfully.');
        await loadMinistries();
    } catch (error) {
        showToast('Error deleting ministry: ' + error.message);
    }
}

// ===================================================
// MINISTRY ROSTER MANAGEMENT (WORDA DEPARTMENT)
// ===================================================
let currentRosterMinistryId = null;
let currentRosterAssignedMembers = [];
let rosterCurrentTab = 'all'; // 'all' | 'assigned' | 'unassigned'
let rosterSearchQuery = '';
let isRelationshipDept = false;
let selectedRosterAgeGroup = '';

async function openMinistryRosterModal(ministryId) {
    currentMinistryId = ministryId;
    currentRosterMinistryId = ministryId;
    let ministry = (allMinistriesCache || []).find(m => m.ministry_id == ministryId);
    if (!ministry) {
        try {
            const mRes = await api.ministries.getById(ministryId);
            ministry = mRes.data;
        } catch (e) {
            console.error('Failed to get ministry:', e);
        }
    }
    if (!ministry) {
        showToast('Ministry details not found.');
        return;
    }

    // Check if this ministry belongs to the Relationship Department
    isRelationshipDept = (ministry.department || '').trim().toLowerCase() === 'relationship';
    selectedRosterAgeGroup = '';

    const titleEl = document.getElementById('rosterModalTitle');
    const subtitleEl = document.getElementById('rosterModalSubtitle');
    if (titleEl) titleEl.innerText = `${ministry.ministry_name} Roster`;
    if (subtitleEl) subtitleEl.innerText = `${ministry.department} Department • Leader: ${ministry.leader_name || 'Unassigned'}`;

    // Configure Relationship Department Age Group Filter visibility
    const ageFilterContainer = document.getElementById('rosterAgeGroupFilterContainer');
    if (ageFilterContainer) {
        ageFilterContainer.style.display = isRelationshipDept ? 'block' : 'none';
    }
    const ageSelect = document.getElementById('rosterAgeGroupSelect');
    if (ageSelect) ageSelect.value = '';
    const resetAgeBtn = document.getElementById('rosterResetAgeFilterBtn');
    if (resetAgeBtn) resetAgeBtn.style.display = 'none';

    // Reset search query and filter tab
    rosterSearchQuery = '';
    rosterCurrentTab = 'all';
    const searchInput = document.getElementById('rosterMemberSearchInput');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('rosterSearchClearBtn');
    if (clearBtn) clearBtn.style.display = 'none';

    ['all', 'assigned', 'unassigned'].forEach(tab => {
        const btn = document.getElementById(`rosterFilterTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        if (btn) btn.classList.toggle('active', tab === 'all');
    });

    // Ensure all church members are fresh in cache
    try {
        const memRes = await api.members.getAll();
        allMembersCache = memRes.data || [];
    } catch (e) {
        console.error('Failed to load church members for roster:', e);
    }

    // Display modal
    document.getElementById('ministryRosterModal').classList.add('active');

    // Show initial loading skeleton in list
    const listEl = document.getElementById('rosterActiveMembersList');
    if (listEl) {
        listEl.innerHTML = '<div class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-primary"></i><p class="text-sm">Loading active church members...</p></div>';
    }

    // Load ministry roster assignments
    await loadMinistryRoster(ministryId);
}

function closeMinistryRosterModal() {
    const modal = document.getElementById('ministryRosterModal');
    if (modal) modal.classList.remove('active');
}

function onRosterAgeGroupFilterChange(val) {
    selectedRosterAgeGroup = val || '';
    const resetAgeBtn = document.getElementById('rosterResetAgeFilterBtn');
    if (resetAgeBtn) {
        resetAgeBtn.style.display = selectedRosterAgeGroup ? 'inline-flex' : 'none';
    }
    renderRosterMembersList();
}

function resetRosterAgeFilter() {
    selectedRosterAgeGroup = '';
    const ageSelect = document.getElementById('rosterAgeGroupSelect');
    if (ageSelect) ageSelect.value = '';
    const resetAgeBtn = document.getElementById('rosterResetAgeFilterBtn');
    if (resetAgeBtn) resetAgeBtn.style.display = 'none';
    renderRosterMembersList();
}

async function loadMinistryRoster(minId) {
    try {
        const targetId = minId || currentMinistryId;
        if (!targetId) return;
        const res = await api.ministries.getMembers(targetId);
        currentRosterAssignedMembers = res.data || [];

        const countEl = document.getElementById('rosterCount');
        if (countEl) countEl.innerText = currentRosterAssignedMembers.length;

        renderRosterMembersList();
    } catch (err) {
        console.error('Error loading ministry roster:', err);
        showToast('Error loading roster: ' + err.message);
        const listEl = document.getElementById('rosterActiveMembersList');
        if (listEl) {
            listEl.innerHTML = `<div class="text-center p-6 text-red-500 text-sm">Failed to load roster: ${escapeHtml(err.message)}</div>`;
        }
    }
}

function onRosterMemberSearchInput(val) {
    rosterSearchQuery = val || '';
    const clearBtn = document.getElementById('rosterSearchClearBtn');
    if (clearBtn) {
        clearBtn.style.display = rosterSearchQuery.trim().length > 0 ? 'inline-flex' : 'none';
    }
    renderRosterMembersList();
}

function clearRosterMemberSearch() {
    rosterSearchQuery = '';
    const searchInput = document.getElementById('rosterMemberSearchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    const clearBtn = document.getElementById('rosterSearchClearBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    renderRosterMembersList();
}

function setRosterTab(tab) {
    rosterCurrentTab = tab;
    ['all', 'assigned', 'unassigned'].forEach(t => {
        const btn = document.getElementById(`rosterFilterTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    renderRosterMembersList();
}

function renderRosterMembersList() {
    const listEl = document.getElementById('rosterActiveMembersList');
    if (!listEl) return;

    // Ministry and Leader identification
    const ministry = (allMinistriesCache || []).find(min => min.ministry_id == currentMinistryId);
    const minLeaderId = ministry && ministry.leader_member_id ? Number(ministry.leader_member_id) : null;

    // Assigned members lookup map: member_id -> assignment record
    const assignedMap = new Map();
    (currentRosterAssignedMembers || []).forEach(am => {
        assignedMap.set(Number(am.member_id), am);
    });

    // Helper: checks if a member is currently assigned to this ministry (including the designated ministry leader)
    const isMemberAssigned = (memId) => {
        if (memId == null) return false;
        if (minLeaderId && Number(memId) === minLeaderId) return true;
        return assignedMap.has(Number(memId));
    };

    const activeMembers = (allMembersCache || []).filter(m => {
        const isActive = (m.status || 'Active').trim().toLowerCase() === 'active';
        return isActive;
    });

    // Counts strictly calculated from active church members
    const totalActiveCount = activeMembers.length;
    const assignedCount = activeMembers.filter(m => isMemberAssigned(m.member_id)).length;
    const unassignedCount = activeMembers.filter(m => !isMemberAssigned(m.member_id)).length;

    const elAll = document.getElementById('rosterAllCount');
    const elAssigned = document.getElementById('rosterAssignedCount');
    const elUnassigned = document.getElementById('rosterUnassignedCount');
    if (elAll) elAll.innerText = totalActiveCount;
    if (elAssigned) elAssigned.innerText = assignedCount;
    if (elUnassigned) elUnassigned.innerText = unassignedCount;

    // Filter by Tab, Relationship Age Group, and Search Query
    const q = (rosterSearchQuery || '').trim().toLowerCase();

    let displayMembers = activeMembers.filter(m => {
        const isAssigned = isMemberAssigned(m.member_id);
        if (rosterCurrentTab === 'assigned' && !isAssigned) return false;
        if (rosterCurrentTab === 'unassigned' && isAssigned) return false;

        // Apply Relationship Department Age Group Filter if active
        if (isRelationshipDept && selectedRosterAgeGroup) {
            if (!matchesAgeGroupFilter(m, selectedRosterAgeGroup)) return false;
        }

        if (!q) return true;
        const fullName = `${m.first_name || ''} ${m.middle_name || ''} ${m.last_name || ''} ${m.suffix || ''}`.toLowerCase();
        const contact = (m.contact_number || '').toLowerCase();
        const email = (m.email || '').toLowerCase();
        const churchRole = (m.church_role || '').toLowerCase();
        const assignedRec = assignedMap.get(Number(m.member_id));
        const roleInMin = (assignedRec?.role_in_ministry || '').toLowerCase();
        const ageGroup = (getMemberAgeGroup(m) || '').toLowerCase();

        return fullName.includes(q) || contact.includes(q) || email.includes(q) || churchRole.includes(q) || roleInMin.includes(q) || ageGroup.includes(q);
    });

    // Sort: Ministry Leader first, then assigned members, then unassigned church leaders, then unassigned members
    displayMembers.sort((a, b) => {
        const aIsLeader = minLeaderId && Number(a.member_id) === minLeaderId ? 0 : 1;
        const bIsLeader = minLeaderId && Number(b.member_id) === minLeaderId ? 0 : 1;
        if (aIsLeader !== bIsLeader) return aIsLeader - bIsLeader;

        const aAssigned = isMemberAssigned(a.member_id) ? 0 : 1;
        const bAssigned = isMemberAssigned(b.member_id) ? 0 : 1;
        if (aAssigned !== bAssigned) return aAssigned - bAssigned;

        const aIsChurchLeader = (a.church_role || '').toLowerCase() === 'leader' || (a.system_role || '').toLowerCase() === 'church leader' ? 0 : 1;
        const bIsChurchLeader = (b.church_role || '').toLowerCase() === 'leader' || (b.system_role || '').toLowerCase() === 'church leader' ? 0 : 1;
        if (aIsChurchLeader !== bIsChurchLeader) return aIsChurchLeader - bIsChurchLeader;

        const aName = `${a.last_name || ''} ${a.first_name || ''}`;
        const bName = `${b.last_name || ''} ${b.first_name || ''}`;
        return aName.localeCompare(bName);
    });

    const showingEl = document.getElementById('rosterShowingCount');
    if (showingEl) {
        if (q) {
            showingEl.innerText = `Showing ${displayMembers.length} matching church members`;
        } else if (isRelationshipDept && selectedRosterAgeGroup) {
            showingEl.innerText = `Showing ${displayMembers.length} in ${selectedRosterAgeGroup} age group`;
        } else if (rosterCurrentTab === 'assigned') {
            showingEl.innerText = `Showing ${displayMembers.length} assigned church members`;
        } else if (rosterCurrentTab === 'unassigned') {
            showingEl.innerText = `Showing ${displayMembers.length} unassigned church members`;
        } else {
            showingEl.innerText = `Showing ${displayMembers.length} of ${totalActiveCount} active church members`;
        }
    }

    if (displayMembers.length === 0) {
        let msg = 'No active church members found.';
        if (q) {
            msg = `No active church members match "<strong>${escapeHtml(q)}</strong>".`;
        } else if (isRelationshipDept && selectedRosterAgeGroup) {
            msg = `No active church members match the "<strong>${escapeHtml(selectedRosterAgeGroup)}</strong>" age group.`;
        } else if (rosterCurrentTab === 'assigned') {
            msg = 'No church members currently assigned to this ministry roster.';
        } else if (rosterCurrentTab === 'unassigned') {
            msg = 'All active church members are already assigned to this ministry!';
        }
        listEl.innerHTML = `
            <div class="text-center p-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <i class="fa-solid fa-users-slash text-3xl mb-2 text-slate-300"></i>
                <p class="text-sm font-medium text-slate-600">${msg}</p>
                ${(q || selectedRosterAgeGroup) ? `<button type="button" class="btn-secondary btn-sm mt-3" onclick="clearRosterMemberSearch(); resetRosterAgeFilter();"><i class="fa-solid fa-rotate-left"></i> Reset Filters</button>` : ''}
            </div>
        `;
        return;
    }

    listEl.innerHTML = displayMembers.map(m => {
        const isMinLeader = minLeaderId && Number(m.member_id) === minLeaderId;
        const isAssigned = assignedMap.has(Number(m.member_id)) || isMinLeader;
        const assignedRec = assignedMap.get(Number(m.member_id));
        const initials = ((m.first_name?.[0] || '') + (m.last_name?.[0] || '')).toUpperCase() || 'M';
        const currentRole = assignedRec 
            ? (assignedRec.role_in_ministry || (isMinLeader ? 'Ministry Leader' : 'Member')) 
            : (isMinLeader ? 'Ministry Leader' : 'Member');
        const fullName = `${escapeHtml(m.first_name)} ${m.middle_name ? escapeHtml(m.middle_name.charAt(0)) + '.' : ''} ${escapeHtml(m.last_name)} ${escapeHtml(m.suffix || '')}`.trim();
        const safeMemberName = `${escapeHtml(m.first_name)} ${escapeHtml(m.last_name)}`.replace(/'/g, "\\'");
        const memberAgeGroup = getMemberAgeGroup(m);
        const isChurchLeader = (m.church_role || '').toLowerCase() === 'leader' || (m.system_role || '').toLowerCase() === 'church leader';
        const isAdminUser = (m.church_role || '').toLowerCase() === 'admin' || (m.system_role || '').toLowerCase() === 'admin';

        return `
            <div class="roster-member-row ${isMinLeader ? 'is-ministry-leader' : ''} ${isAssigned ? 'is-assigned' : ''}" id="rosterRow_${m.member_id}" style="${isMinLeader ? 'background: #fffdf2; border-left: 4px solid #f59e0b; box-shadow: 0 1px 3px rgba(245, 158, 11, 0.15);' : ''}">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="roster-member-avatar ${isAssigned ? 'assigned-avatar' : ''}">
                        ${m.profile_image 
                            ? `<img src="${escapeHtml(m.profile_image)}" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.outerHTML='${escapeHtml(initials)}'">`
                            : escapeHtml(initials)
                        }
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-semibold text-navy text-sm">${fullName}</span>
        ${isMinLeader ? `
            <span class="badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700; font-size: 0.72rem;">
                <i class="fa-solid fa-crown text-amber-500 mr-1"></i> Ministry Leader
            </span>
        ` : (isChurchLeader ? `
            <span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.7rem; font-weight: 600;">
                <i class="fa-solid fa-user-tie mr-1"></i> Church Leader
            </span>
        ` : (isAdminUser ? `
            <span class="badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-size: 0.7rem; font-weight: 600;">
                <i class="fa-solid fa-shield-halved mr-1"></i> Admin
            </span>
        ` : ''))}
                            ${isRelationshipDept ? `
                                <span class="badge" style="background: #e0f2fe; color: #0284c7; font-size: 0.65rem; padding: 0.15rem 0.5rem; font-weight: 600;" title="Age Group: ${escapeHtml(memberAgeGroup)}">
                                    <i class="fa-solid fa-people-arrows mr-1 text-[9px]"></i>${escapeHtml(memberAgeGroup)}
                                </span>
                            ` : ''}
                            ${isAssigned ? `
                                <span class="roster-status-chip assigned">
                                    <i class="fa-solid fa-circle-check"></i> Assigned (${escapeHtml(currentRole)})
                                </span>
                            ` : `
                                <span class="roster-status-chip unassigned">
                                    <i class="fa-regular fa-circle"></i> Unassigned
                                </span>
                            `}
                        </div>
                        <div class="roster-contact-info">
                            ${m.contact_number ? `
                                <span class="roster-contact-item" title="Contact Number">
                                    <i class="fa-solid fa-phone"></i>
                                    <span>${escapeHtml(m.contact_number)}</span>
                                </span>
                            ` : ''}
                            ${m.email ? `
                                <span class="roster-contact-item" title="Email Address">
                                    <i class="fa-regular fa-envelope"></i>
                                    <span>${escapeHtml(m.email)}</span>
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                    <div class="flex flex-col">
                        <input type="text" 
                               id="rosterRole_${m.member_id}" 
                               class="roster-role-input" 
                               value="${escapeHtml(currentRole)}" 
                               placeholder="Ministry Role" 
                               title="Specify role in this ministry (e.g. Vocalist, Usher, Member)"
                               onkeydown="if(event.key==='Enter'){ addMemberToRoster(${m.member_id}); }">
                    </div>

                    <div class="roster-actions">
                        <button type="button" 
                                class="btn-roster-icon btn-add ${isAssigned ? 'is-update' : ''}" 
                                onclick="addMemberToRoster(${m.member_id})" 
                                title="${isAssigned ? 'Update Ministry Role' : 'Assign to Ministry'}">
                            <i class="fa-solid ${isAssigned ? 'fa-pen-to-square' : 'fa-user-plus'}"></i>
                        </button>
                        
                        ${isAssigned ? `
                            <button type="button" 
                                    class="btn-roster-icon btn-remove" 
                                    onclick="removeMemberFromRoster(${assignedRec.ministry_member_id}, '${safeMemberName}')" 
                                    title="Remove from Ministry">
                                <i class="fa-solid fa-user-minus"></i>
                            </button>
                        ` : `
                            <button type="button" 
                                    class="btn-roster-icon btn-remove is-disabled" 
                                    disabled 
                                    title="Member is not assigned to this ministry">
                                <i class="fa-solid fa-user-minus"></i>
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function addMemberToRoster(memberId) {
    if (!currentMinistryId) {
        showToast('No ministry selected.');
        return;
    }

    let targetMemberId = memberId;
    let role = 'Member';

    // Support caller with memberId
    if (targetMemberId) {
        const roleInput = document.getElementById(`rosterRole_${targetMemberId}`);
        role = roleInput ? roleInput.value.trim() || 'Member' : 'Member';
    } else {
        // Fallback if ever called without argument
        const select = document.getElementById('rosterAddMemberSelect');
        targetMemberId = select ? select.value : null;
        const roleInput = document.getElementById('rosterAddMemberRole');
        role = roleInput ? roleInput.value.trim() || 'Member' : 'Member';
    }

    if (!targetMemberId) {
        showToast('Please select a member first.');
        return;
    }

    const member = (allMembersCache || []).find(m => m.member_id == targetMemberId);
    const memberName = member ? `${member.first_name} ${member.last_name}` : 'Member';

    try {
        await api.ministries.addMember(currentMinistryId, { member_id: targetMemberId, role_in_ministry: role });
        delete ministryRosterCache[currentMinistryId];
        showToast(`${memberName} assigned as "${role}"!`);
        await loadMinistryRoster(currentMinistryId);
        await loadMinistries(); // update member count in main table and WORDA department accordion
    } catch (err) {
        showToast('Error assigning member: ' + err.message);
    }
}

async function removeMemberFromRoster(mmId, memberName) {
    const confirmName = memberName || 'this member';
    const ok = await showDecisionModal({
        title: 'Remove Ministry Member',
        message: `Are you sure you want to remove ${confirmName} from this ministry roster?`,
        confirmText: 'Remove Member',
        type: 'danger'
    });
    if (!ok) return;
    try {
        await api.ministries.removeMember(mmId);
        delete ministryRosterCache[currentMinistryId];
        showToast(`${confirmName} removed from ministry.`);
        await loadMinistryRoster(currentMinistryId);
        await loadMinistries();
    } catch (err) {
        showToast('Error removing member: ' + err.message);
    }
}


// ===================================================
// DEPARTMENT HEAD MANAGEMENT (WORDA DEPARTMENTS)
// ===================================================
function openManageDeptHeadModal(deptName = null) {
    const targetDept = deptName || selectedWordaDept;
    if (!targetDept) {
        return showToast('Please select a WORDA department first.');
    }

    document.getElementById('deptHeadDepartment').value = targetDept;
    document.getElementById('deptHeadModalTitle').textContent = `Manage Department Head — ${targetDept} Department`;
    document.getElementById('deptHeadModalSubtitle').textContent = `Assign or update the head leader of the ${targetDept} Department`;

    // Filter ALL active members who are Church Leaders or Church Admins ONLY
    const eligibleMembers = (allMembersCache || []).filter(m => {
        const role = (m.church_role || '').trim().toLowerCase();
        const isEligible = role === 'leader' || role === 'admin' || role === 'church leader' || role === 'church admin';
        const isActive = (m.status === 'Active' || m.status == 1);
        return isEligible && isActive;
    });

    // Sort alphabetically by first_name, last_name
    eligibleMembers.sort((a, b) => {
        const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
        const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // Current assigned head
    const currentHead = (departmentHeadsCache || []).find(h => (h.department || '').toLowerCase() === targetDept.toLowerCase());
    const currentHeadId = currentHead ? currentHead.head_member_id : null;

    // Render current head info box
    const currentBox = document.getElementById('deptHeadCurrentBox');
    if (currentBox) {
        if (currentHead && currentHead.head_member_id) {
            currentBox.innerHTML = `
                <div class="flex items-center gap-3 w-full">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 1rem;"><i class="fa-solid fa-crown text-gold"></i></div>
                    <div class="flex-1">
                        <div class="text-xs text-slate-500 font-medium">Current Department Head</div>
                        <div class="font-bold text-navy text-sm">${escapeHtml(currentHead.head_name || 'Assigned')} <span class="badge ${currentHead.church_role === 'Admin' ? 'badge-primary' : 'badge-gold'}" style="font-size: 0.65rem;">${escapeHtml(currentHead.church_role === 'Admin' ? 'Church Admin' : 'Church Leader')}</span></div>
                    </div>
                </div>
            `;
        } else {
            currentBox.innerHTML = `
                <div class="flex items-center gap-3 w-full text-amber-800">
                    <i class="fa-solid fa-circle-exclamation text-amber-600 text-lg"></i>
                    <div>
                        <div class="text-xs text-slate-500 font-medium">Current Status</div>
                        <div class="font-semibold text-xs">Currently unassigned. No department head selected.</div>
                    </div>
                </div>
            `;
        }
    }

    // Populate dropdown with Church Leaders & Church Admins ONLY
    const selectEl = document.getElementById('deptHeadSelect');
    if (selectEl) {
        let html = '<option value="">-- No Department Head (Unassigned) --</option>';
        if (eligibleMembers.length === 0) {
            html += '<option value="" disabled>No eligible Church Leaders or Admins found</option>';
        } else {
            eligibleMembers.forEach(mem => {
                const isSelected = (currentHeadId && currentHeadId == mem.member_id) ? 'selected' : '';
                const roleLabel = mem.church_role === 'Admin' ? 'Church Admin' : 'Church Leader';
                const fullName = [mem.first_name, mem.middle_name ? mem.middle_name.charAt(0) + '.' : '', mem.last_name, mem.suffix].filter(Boolean).join(' ');
                html += `<option value="${mem.member_id}" ${isSelected}>${escapeHtml(fullName)} (${roleLabel})</option>`;
            });
        }
        selectEl.innerHTML = html;
    }

    document.getElementById('deptHeadModal').classList.add('active');
}

function closeDeptHeadModal() {
    const modal = document.getElementById('deptHeadModal');
    if (modal) modal.classList.remove('active');
}

async function saveDepartmentHead() {
    const department = document.getElementById('deptHeadDepartment').value;
    const selectEl = document.getElementById('deptHeadSelect');
    const headMemberId = selectEl && selectEl.value ? parseInt(selectEl.value, 10) : null;
    const saveBtn = document.getElementById('btnSaveDeptHead');

    if (!department) {
        return showToast('No department specified.');
    }

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';
        }

        const res = await api.ministries.updateDepartmentHead(department, { head_member_id: headMemberId });
        showToast(res && res.message ? res.message : `${department} Department Head saved successfully!`);

        // Refresh cache and summary counts immediately
        await loadMinistries();

        // Re-render inline view
        if (selectedWordaDept && selectedWordaDept.toLowerCase() === department.toLowerCase()) {
            renderWordaDeptInlineDetails(selectedWordaDept);
        }

        closeDeptHeadModal();
    } catch (error) {
        showToast('Error saving department head: ' + error.message);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Save Department Head';
        }
    }
}


// ============== FINANCE & ANALYTICS ==============
// financeAnalyticsMode initialized globally ('Income')
let financeAnalyticsDept = '';
let financeAnalyticsMinistryId = '';
let financeCalCurrentDate = new Date();
let financeCalSelectedDate = null; // 'YYYY-MM-DD'
let financeChartTimeframe = 'monthly'; // 'weekly' or 'monthly'
let financeChartRefDate = new Date(); // Reference date for weekly calculation
let financeInteractiveChartInstance = null;
let allCategories = [];

// ============== FINANCE ANALYTICS DEPARTMENT & MINISTRY FILTER MODAL ==============
function openFinanceAnalyticsDeptMinFilterModal() {
    const deptSelect = document.getElementById('financeAnalyticsModalDeptSelect');
    if (deptSelect) {
        const standardDepts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        const existingDepts = [...new Set((allMinistriesCache || []).map(m => m.department).filter(Boolean))];
        const allDepts = [...new Set([...standardDepts, ...existingDepts])];

        deptSelect.innerHTML = '<option value="">All Departments</option>' +
            allDepts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)} Department</option>`).join('');

        deptSelect.value = financeAnalyticsDept || '';
    }

    populateFinanceAnalyticsModalMinistryDropdown(financeAnalyticsDept, financeAnalyticsMinistryId);

    const modal = document.getElementById('financeAnalyticsDeptMinFilterModal');
    if (modal) modal.classList.add('active');
}

function closeFinanceAnalyticsDeptMinFilterModal() {
    const modal = document.getElementById('financeAnalyticsDeptMinFilterModal');
    if (modal) modal.classList.remove('active');
}

function onFinanceAnalyticsModalDeptChange() {
    const selectedDept = document.getElementById('financeAnalyticsModalDeptSelect')?.value || '';
    populateFinanceAnalyticsModalMinistryDropdown(selectedDept, '');
}

function populateFinanceAnalyticsModalMinistryDropdown(dept, selectedMinId) {
    const minSelect = document.getElementById('financeAnalyticsModalMinistrySelect');
    const helpEl = document.getElementById('financeAnalyticsModalMinistryHelp');
    if (!minSelect) return;

    let availableMinistries = allMinistriesCache || [];
    if (dept) {
        availableMinistries = availableMinistries.filter(m => (m.department || '').toLowerCase() === dept.toLowerCase());
        if (helpEl) helpEl.textContent = `Showing ${availableMinistries.length} ministries under the ${dept} Department.`;
    } else {
        if (helpEl) helpEl.textContent = `Showing all ${availableMinistries.length} church ministries across all departments.`;
    }

    minSelect.innerHTML = '<option value="">All Ministries / Church-wide</option>' +
        availableMinistries.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');

    if (selectedMinId && availableMinistries.some(m => String(m.ministry_id) === String(selectedMinId))) {
        minSelect.value = String(selectedMinId);
    } else {
        minSelect.value = '';
    }
}

function clearFinanceAnalyticsDeptMinFilter() {
    financeAnalyticsDept = '';
    financeAnalyticsMinistryId = '';

    const deptSelect = document.getElementById('financeAnalyticsModalDeptSelect');
    if (deptSelect) deptSelect.value = '';
    populateFinanceAnalyticsModalMinistryDropdown('', '');

    updateFinanceAnalyticsFilterButtonUI();
    renderFinanceInteractiveChart();
    renderFinanceCalendar();
    if (financeCalSelectedDate) showFinanceCalendarDateDetails(financeCalSelectedDate);
    closeFinanceAnalyticsDeptMinFilterModal();
}

function applyFinanceAnalyticsDeptMinFilterModal() {
    financeAnalyticsDept = document.getElementById('financeAnalyticsModalDeptSelect')?.value || '';
    financeAnalyticsMinistryId = document.getElementById('financeAnalyticsModalMinistrySelect')?.value || '';

    updateFinanceAnalyticsFilterButtonUI();
    renderFinanceInteractiveChart();
    renderFinanceCalendar();
    if (financeCalSelectedDate) showFinanceCalendarDateDetails(financeCalSelectedDate);
    closeFinanceAnalyticsDeptMinFilterModal();
}

function updateFinanceAnalyticsFilterButtonUI() {
    const btnLabel = document.getElementById('financeAnalyticsFilterBtnLabel');
    const badge = document.getElementById('financeAnalyticsFilterActiveBadge');
    const btn = document.getElementById('btnFinanceAnalyticsFilterModal');
    if (!btnLabel || !badge) return;

    let activeCount = 0;
    let labelParts = [];

    if (financeAnalyticsDept) {
        activeCount++;
        labelParts.push(financeAnalyticsDept);
    }

    if (financeAnalyticsMinistryId) {
        activeCount++;
        const minObj = (allMinistriesCache || []).find(m => String(m.ministry_id) === String(financeAnalyticsMinistryId));
        if (minObj) {
            labelParts.push(minObj.ministry_name);
        } else {
            labelParts.push('Ministry');
        }
    }

    if (activeCount > 0) {
        btnLabel.textContent = labelParts.join(' • ');
        badge.textContent = activeCount;
        badge.style.display = 'inline-block';
        if (btn) btn.style.borderColor = 'var(--primary)';
    } else {
        btnLabel.textContent = 'Dept & Ministry';
        badge.style.display = 'none';
        if (btn) btn.style.borderColor = '';
    }
}

function populateAllMinistrySelects() {
    // 1. Finance Analytics Ministry modal
    populateFinanceAnalyticsModalMinistryDropdown(financeAnalyticsDept, financeAnalyticsMinistryId);

    // 2. Finance Records Ministry filter
    const fmSelect = document.getElementById('financeMinistryFilter');
    if (fmSelect) {
        const curVal = fmSelect.value;
        fmSelect.innerHTML = '<option value="">All Ministries</option>' +
            allMinistriesCache.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');
        if (curVal && allMinistriesCache.some(m => String(m.ministry_id) === String(curVal))) {
            fmSelect.value = curVal;
        }
    }

    // 3. Finance Modal Ministry Select
    const tmSelect = document.getElementById('transaction_ministry_id');
    if (tmSelect) {
        const curVal = tmSelect.value;
        tmSelect.innerHTML = '<option value="">None / General Church</option>' +
            allMinistriesCache.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');
        if (curVal && allMinistriesCache.some(m => String(m.ministry_id) === String(curVal))) {
            tmSelect.value = curVal;
        }
    }

    // 4. Events Filter Ministry
    const emSelect = document.getElementById('eventMinistryFilter');
    if (emSelect) {
        const curVal = emSelect.value;
        emSelect.innerHTML = '<option value="">All Ministries</option>' +
            allMinistriesCache.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');
        if (curVal && allMinistriesCache.some(m => String(m.ministry_id) === String(curVal))) {
            emSelect.value = curVal;
        }
    }

    // 5. Events Modal Ministry
    const emModalSelect = document.getElementById('ministry_id_event');
    if (emModalSelect) {
        const curVal = emModalSelect.value;
        emModalSelect.innerHTML = '<option value="">None</option>' +
            allMinistriesCache.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');
        if (curVal && allMinistriesCache.some(m => String(m.ministry_id) === String(curVal))) {
            emModalSelect.value = curVal;
        }
    }
}

function selectFinanceAnalyticsMode(mode) {
    financeAnalyticsMode = mode;

    // Highlight card active state
    const cardIncome = document.getElementById('cardIncome');
    const cardExpense = document.getElementById('cardExpense');
    if (cardIncome) cardIncome.classList.toggle('active-mode-income', mode === 'Income');
    if (cardExpense) cardExpense.classList.toggle('active-mode-expense', mode === 'Expense');

    // Update buttons
    const btnInc = document.getElementById('btnModeIncome');
    const btnExp = document.getElementById('btnModeExpense');
    if (btnInc) btnInc.classList.toggle('active', mode === 'Income');
    if (btnExp) btnExp.classList.toggle('active', mode === 'Expense');

    // Update graph and calendar titles
    const graphTitle = document.getElementById('financeGraphTitle');
    const calTitle = document.getElementById('financeCalendarTitle');

    if (mode === 'Income') {
        if (graphTitle) graphTitle.textContent = (financeChartTimeframe === 'weekly') ? 'Income Trends (Weekly Line Graph)' : 'Income Trends (Monthly Line Graph)';
        if (calTitle) calTitle.textContent = 'Income Calendar Tracker';
    } else {
        if (graphTitle) graphTitle.textContent = (financeChartTimeframe === 'weekly') ? 'Expense Breakdown (Weekly Donut Graph)' : 'Expense Breakdown (Monthly Donut Graph)';
        if (calTitle) calTitle.textContent = 'Expense Calendar Tracker';
    }

    renderFinanceInteractiveChart();
    renderFinanceCalendar();
}

function setFinanceTimeframe(timeframe) {
    financeChartTimeframe = timeframe;
    
    const btnWeekly = document.getElementById('btnTimeframeWeekly');
    const btnMonthly = document.getElementById('btnTimeframeMonthly');
    const weekNav = document.getElementById('financeWeeklyNav');
    const totalLabel = document.getElementById('financeFilteredTotalLabel');
    const graphTitle = document.getElementById('financeGraphTitle');

    if (btnWeekly) btnWeekly.classList.toggle('active', timeframe === 'weekly');
    if (btnMonthly) btnMonthly.classList.toggle('active', timeframe === 'monthly');
    if (weekNav) weekNav.style.display = (timeframe === 'weekly') ? 'flex' : 'none';
    if (totalLabel) totalLabel.textContent = (timeframe === 'weekly') ? 'Weekly Total' : 'Monthly Total';

    if (graphTitle) {
        if (financeAnalyticsMode === 'Income') {
            graphTitle.textContent = (timeframe === 'weekly') ? 'Income Trends (Weekly Line Graph)' : 'Income Trends (Monthly Line Graph)';
        } else {
            graphTitle.textContent = (timeframe === 'weekly') ? 'Expense Breakdown (Weekly Donut Graph)' : 'Expense Breakdown (Monthly Donut Graph)';
        }
    }

    renderFinanceInteractiveChart();
    renderFinanceCalendar();
}

function toLocalDateStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getWeekRange(refDate) {
    const d = new Date(refDate);
    const day = d.getDay(); // 0 is Sunday
    const sun = new Date(d);
    sun.setDate(d.getDate() - day);
    sun.setHours(0, 0, 0, 0);

    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    sat.setHours(23, 59, 59, 999);

    return { start: sun, end: sat };
}

function formatWeekLabel(startDate, endDate) {
    const startM = startDate.toLocaleString('default', { month: 'short' });
    const startD = startDate.getDate();
    const startY = startDate.getFullYear();

    const endM = endDate.toLocaleString('default', { month: 'short' });
    const endD = endDate.getDate();
    const endY = endDate.getFullYear();

    if (startY !== endY) {
        return `${startM} ${startD}, ${startY} – ${endM} ${endD}, ${endY}`;
    } else if (startM !== endM) {
        return `${startM} ${startD} – ${endM} ${endD}, ${endY}`;
    } else {
        return `${startM} ${startD} – ${endD}, ${endY}`;
    }
}

function changeFinanceWeek(deltaWeeks) {
    financeChartRefDate.setDate(financeChartRefDate.getDate() + (deltaWeeks * 7));
    const weekRange = getWeekRange(financeChartRefDate);
    const midWeek = new Date(weekRange.start);
    midWeek.setDate(midWeek.getDate() + 3);
    if (financeCalCurrentDate.getMonth() !== midWeek.getMonth() || financeCalCurrentDate.getFullYear() !== midWeek.getFullYear()) {
        financeCalCurrentDate = new Date(midWeek.getFullYear(), midWeek.getMonth(), 1);
    }
    renderFinanceInteractiveChart();
    renderFinanceCalendar();
}

function resetFinanceWeekToCurrent() {
    financeChartRefDate = new Date();
    financeCalCurrentDate = new Date();
    renderFinanceInteractiveChart();
    renderFinanceCalendar();
}

function onFinanceAnalyticsMinistryChange() {
    financeAnalyticsMinistryId = document.getElementById('financeAnalyticsMinistryFilter')?.value || '';
    renderFinanceInteractiveChart();
    renderFinanceCalendar();
    if (financeCalSelectedDate) {
        showFinanceCalendarDateDetails(financeCalSelectedDate);
    }
}

function changeFinanceCalendarMonth(delta) {
    financeCalCurrentDate.setMonth(financeCalCurrentDate.getMonth() + delta);
    // Note: Do not change financeChartRefDate when weekly is selected so the chosen week is preserved across month navigations
    renderFinanceCalendar();
    renderFinanceInteractiveChart();
    if (financeCalSelectedDate) {
        const selYear = parseInt(financeCalSelectedDate.slice(0, 4), 10);
        const selMonth = parseInt(financeCalSelectedDate.slice(5, 7), 10) - 1;
        if (selYear !== financeCalCurrentDate.getFullYear() || selMonth !== financeCalCurrentDate.getMonth()) {
            clearFinanceCalendarDate();
        } else {
            showFinanceCalendarDateDetails(financeCalSelectedDate);
        }
    }
}

function onFinanceCalendarDateClick(dateStr) {
    if (financeCalSelectedDate === dateStr) {
        clearFinanceCalendarDate();
        return;
    }

    financeCalSelectedDate = dateStr;
    if (financeChartTimeframe === 'weekly') {
        financeChartRefDate = new Date(dateStr + 'T00:00:00');
    }

    const tag = document.getElementById('selectedDateDisplayTag');
    const txt = document.getElementById('selectedDateText');
    if (tag && txt) {
        const dObj = new Date(dateStr + 'T00:00:00');
        txt.textContent = dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        tag.style.display = 'inline-flex';
    }

    renderFinanceCalendar();
    renderFinanceInteractiveChart();
    showFinanceCalendarDateDetails(dateStr);
}

function clearFinanceCalendarDate(e) {
    if (e) e.stopPropagation();
    financeCalSelectedDate = null;
    const tag = document.getElementById('selectedDateDisplayTag');
    if (tag) tag.style.display = 'none';

    const detailsBox = document.getElementById('calendarDateDetails');
    if (detailsBox) detailsBox.style.display = 'none';

    renderFinanceCalendar();
    renderFinanceInteractiveChart();
}

function showFinanceCalendarDateDetails(dateStr) {
    const detailsBox = document.getElementById('calendarDateDetails');
    const titleEl = document.getElementById('calDetailsDateTitle');
    const dayIncEl = document.getElementById('calDetailsDayIncome');
    const dayExpEl = document.getElementById('calDetailsDayExpense');
    const listEl = document.getElementById('calDetailsList');

    if (!detailsBox || !listEl) return;

    let dayTxs = allTransactionsCache.filter(t => {
        const tDate = t.transaction_date ? String(t.transaction_date).split('T')[0] : '';
        return tDate === dateStr;
    });

    if (financeAnalyticsDept) {
        dayTxs = dayTxs.filter(t => (t.department || '').toLowerCase() === financeAnalyticsDept.toLowerCase());
    }
    if (financeAnalyticsMinistryId) {
        dayTxs = dayTxs.filter(t => String(t.ministry_id) === String(financeAnalyticsMinistryId));
    }

    const dObj = new Date(dateStr + 'T00:00:00');
    if (titleEl) {
        titleEl.textContent = dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const dayIncome = dayTxs.filter(t => t.transaction_type === 'Income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const dayExpense = dayTxs.filter(t => t.transaction_type === 'Expense').reduce((s, t) => s + Number(t.amount || 0), 0);

    if (dayIncEl) dayIncEl.textContent = `₱${dayIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (dayExpEl) dayExpEl.textContent = `₱${dayExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (dayTxs.length === 0) {
        listEl.innerHTML = `<div style="padding: 0.75rem 0.5rem; text-align: center; color: #94a3b8; font-size: 0.82rem; font-style: italic;">No transactions recorded on this date.</div>`;
    } else {
        listEl.innerHTML = dayTxs.map(t => `
            <div class="cal-tx-item py-1.5 flex justify-between items-center text-xs">
                <div class="flex-1 min-w-0 pr-2">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="badge ${t.transaction_type === 'Income' ? 'badge-income' : 'badge-expense'}" style="font-size: 0.68rem; padding: 0.15rem 0.4rem;">
                            ${t.transaction_type}
                        </span>
                        <strong class="text-navy truncate">${escapeHtml(t.category_name || 'General')}</strong>
                        ${t.ministry_name ? `<span class="badge badge-info" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">${escapeHtml(t.ministry_name)}</span>` : ''}
                    </div>
                    ${t.description ? `<p class="text-slate-500 text-xs truncate mt-0.5" style="margin: 0;">${escapeHtml(t.description)}</p>` : ''}
                </div>
                <div class="font-bold text-right ${t.transaction_type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}" style="white-space: nowrap;">
                    ${t.transaction_type === 'Income' ? '+' : '-'}₱${Number(t.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
            </div>
        `).join('');
    }

    detailsBox.style.display = 'block';
}

function renderFinanceInteractiveChart() {
    const canvas = document.getElementById('financeInteractiveChart');
    if (!canvas) return;

    if (financeInteractiveChartInstance) {
        financeInteractiveChartInstance.destroy();
        financeInteractiveChartInstance = null;
    }

    const curYear = financeCalCurrentDate.getFullYear();
    const curMonth = financeCalCurrentDate.getMonth(); // 0-indexed
    const monthName = financeCalCurrentDate.toLocaleString('default', { month: 'long' });
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();

    const totalEl = document.getElementById('financeFilteredTotal');
    const totalLabel = document.getElementById('financeFilteredTotalLabel');
    const subTitleEl = document.getElementById('financeGraphSubtitle');
    const weekNav = document.getElementById('financeWeeklyNav');
    const weekLabelEl = document.getElementById('financeWeekLabel');

    if (weekNav) {
        weekNav.style.display = (financeChartTimeframe === 'weekly') ? 'flex' : 'none';
    }
    if (totalLabel) {
        totalLabel.textContent = (financeChartTimeframe === 'weekly') ? 'Weekly Total' : 'Monthly Total';
    }

    // -------------------------------------------------------------------------
    // A. WEEKLY VIEW
    // -------------------------------------------------------------------------
    if (financeChartTimeframe === 'weekly') {
        const { start: weekStart, end: weekEnd } = getWeekRange(financeChartRefDate);
        const weekLabelStr = formatWeekLabel(weekStart, weekEnd);
        if (weekLabelEl) weekLabelEl.textContent = weekLabelStr;

        // Generate 7 days (Sun through Sat)
        const dayDates = [];
        const dayLabels = [];
        const dayDateStrings = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            dayDates.push(d);
            const dayName = d.toLocaleString('default', { weekday: 'short' });
            const dayNum = d.getDate();
            dayLabels.push(`${dayName} (${dayNum})`);
            dayDateStrings.push(toLocalDateStr(d));
        }

        const weekStartStr = dayDateStrings[0];
        const weekEndStr = dayDateStrings[6];

        // Filter transactions for this 7-day range
        let txs = allTransactionsCache.filter(t => {
            if (!t.transaction_date) return false;
            const tDate = String(t.transaction_date).split('T')[0];
            return tDate >= weekStartStr && tDate <= weekEndStr;
        });

        if (financeAnalyticsDept) {
            txs = txs.filter(t => (t.department || '').toLowerCase() === financeAnalyticsDept.toLowerCase());
        }
        if (financeAnalyticsMinistryId) {
            txs = txs.filter(t => String(t.ministry_id) === String(financeAnalyticsMinistryId));
        }

        if (financeAnalyticsMode === 'Income') {
            // --- WEEKLY INCOME (LINE GRAPH) ---
            if (subTitleEl) subTitleEl.textContent = `Weekly trajectory: ${weekLabelStr}`;
            
            const incomeTxs = txs.filter(t => t.transaction_type === 'Income');
            const dailyIncome = new Array(7).fill(0);

            incomeTxs.forEach(t => {
                const tDate = String(t.transaction_date).split('T')[0];
                const idx = dayDateStrings.indexOf(tDate);
                if (idx !== -1) {
                    dailyIncome[idx] += Number(t.amount || 0);
                }
            });

            const totalIncome = incomeTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
            if (totalEl) {
                totalEl.style.color = '#10b981';
                totalEl.textContent = `₱${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }

            // Highlight selected day on line chart if picked
            let selIdx = -1;
            if (financeCalSelectedDate) {
                selIdx = dayDateStrings.indexOf(financeCalSelectedDate);
            }

            const pointRadii = dailyIncome.map((val, idx) => (idx === selIdx ? 8 : (val > 0 ? 5 : 3)));
            const pointBgColors = dailyIncome.map((val, idx) => (idx === selIdx ? '#0f172a' : '#10b981'));

            const ctx = canvas.getContext('2d');
            financeInteractiveChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dayLabels,
                    datasets: [{
                        label: 'Income (₱)',
                        data: dailyIncome,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.14)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2.5,
                        pointRadius: pointRadii,
                        pointBackgroundColor: pointBgColors,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: (items) => {
                                    const idx = items[0].dataIndex;
                                    return dayDates[idx].toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
                                },
                                label: (ctx) => `Income: ₱${Number(ctx.raw).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            title: { display: true, text: `Week: ${weekLabelStr}` }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (v) => v >= 1000 ? '₱' + (v / 1000).toFixed(0) + 'k' : '₱' + v
                            }
                        }
                    }
                }
            });

        } else {
            // --- WEEKLY EXPENSE (DONUT GRAPH) ---
            if (subTitleEl) subTitleEl.textContent = `Weekly expense breakdown: ${weekLabelStr}`;

            let expenseTxs = txs.filter(t => t.transaction_type === 'Expense');

            if (financeCalSelectedDate && dayDateStrings.includes(financeCalSelectedDate)) {
                expenseTxs = expenseTxs.filter(t => String(t.transaction_date).split('T')[0] === financeCalSelectedDate);
            }

            const totalExpense = expenseTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
            if (totalEl) {
                totalEl.style.color = '#ef4444';
                totalEl.textContent = `₱${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }

            const catMap = {};
            expenseTxs.forEach(t => {
                const cat = t.category_name || 'Uncategorized';
                catMap[cat] = (catMap[cat] || 0) + Number(t.amount || 0);
            });

            const labels = Object.keys(catMap);
            const dataValues = Object.values(catMap);
            const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#64748b', '#06b6d4'];

            const ctx = canvas.getContext('2d');
            if (labels.length === 0) {
                financeInteractiveChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['No Expenses Recorded This Week'],
                        datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: { enabled: false }
                        }
                    }
                });
            } else {
                financeInteractiveChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: dataValues,
                            backgroundColor: colors.slice(0, labels.length)
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.label}: ₱${Number(ctx.raw).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                }
                            }
                        }
                    }
                });
            }
        }

    // -------------------------------------------------------------------------
    // B. MONTHLY VIEW
    // -------------------------------------------------------------------------
    } else {
        // Filter transactions for current month
        let txs = allTransactionsCache.filter(t => {
            if (!t.transaction_date) return false;
            const d = new Date(String(t.transaction_date).split('T')[0] + 'T00:00:00');
            return d.getFullYear() === curYear && d.getMonth() === curMonth;
        });

        if (financeAnalyticsDept) {
            txs = txs.filter(t => (t.department || '').toLowerCase() === financeAnalyticsDept.toLowerCase());
        }
        if (financeAnalyticsMinistryId) {
            txs = txs.filter(t => String(t.ministry_id) === String(financeAnalyticsMinistryId));
        }

        if (financeAnalyticsMode === 'Income') {
            // --- MONTHLY INCOME (LINE GRAPH) ---
            if (subTitleEl) subTitleEl.textContent = `Monthly trajectory for ${monthName} ${curYear}`;

            const incomeTxs = txs.filter(t => t.transaction_type === 'Income');
            const dailyIncome = new Array(daysInMonth).fill(0);

            incomeTxs.forEach(t => {
                const d = new Date(String(t.transaction_date).split('T')[0] + 'T00:00:00');
                const dayNum = d.getDate();
                if (dayNum >= 1 && dayNum <= daysInMonth) {
                    dailyIncome[dayNum - 1] += Number(t.amount || 0);
                }
            });

            const totalIncome = incomeTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
            if (totalEl) {
                totalEl.style.color = '#10b981';
                totalEl.textContent = `₱${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }

            const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

            let selDayIndex = -1;
            if (financeCalSelectedDate) {
                const selDateObj = new Date(financeCalSelectedDate + 'T00:00:00');
                if (selDateObj.getFullYear() === curYear && selDateObj.getMonth() === curMonth) {
                    selDayIndex = selDateObj.getDate() - 1;
                }
            }

            const pointRadii = dailyIncome.map((val, idx) => (idx === selDayIndex ? 8 : (val > 0 ? 4 : 2)));
            const pointBgColors = dailyIncome.map((val, idx) => (idx === selDayIndex ? '#0f172a' : '#10b981'));

            const ctx = canvas.getContext('2d');
            financeInteractiveChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Income (₱)',
                        data: dailyIncome,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2.5,
                        pointRadius: pointRadii,
                        pointBackgroundColor: pointBgColors,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: (items) => {
                                    const day = items[0].label;
                                    return `${monthName} ${day}, ${curYear}`;
                                },
                                label: (ctx) => `Income: ₱${Number(ctx.raw).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            title: { display: true, text: `Day of ${monthName} ${curYear}` }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (v) => v >= 1000 ? '₱' + (v / 1000).toFixed(0) + 'k' : '₱' + v
                            }
                        }
                    }
                }
            });

        } else {
            // --- MONTHLY EXPENSE (DONUT GRAPH) ---
            if (subTitleEl) subTitleEl.textContent = `Monthly expense breakdown for ${monthName} ${curYear}`;

            let expenseTxs = txs.filter(t => t.transaction_type === 'Expense');

            if (financeCalSelectedDate) {
                expenseTxs = expenseTxs.filter(t => {
                    const tDate = t.transaction_date ? String(t.transaction_date).split('T')[0] : '';
                    return tDate === financeCalSelectedDate;
                });
            }

            const totalExpense = expenseTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
            if (totalEl) {
                totalEl.style.color = '#ef4444';
                totalEl.textContent = `₱${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }

            const catMap = {};
            expenseTxs.forEach(t => {
                const cat = t.category_name || 'Uncategorized';
                catMap[cat] = (catMap[cat] || 0) + Number(t.amount || 0);
            });

            const labels = Object.keys(catMap);
            const dataValues = Object.values(catMap);
            const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#64748b', '#06b6d4'];

            const ctx = canvas.getContext('2d');
            if (labels.length === 0) {
                financeInteractiveChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['No Expenses Recorded This Month'],
                        datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: { enabled: false }
                        }
                    }
                });
            } else {
                financeInteractiveChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: dataValues,
                            backgroundColor: colors.slice(0, labels.length)
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.label}: ₱${Number(ctx.raw).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                }
                            }
                        }
                    }
                });
            }
        }
    }
}

function renderFinanceCalendar() {
    const grid = document.getElementById('financeCalendarDaysGrid');
    const label = document.getElementById('financeCalMonthLabel');
    if (!grid) return;

    const year = financeCalCurrentDate.getFullYear();
    const month = financeCalCurrentDate.getMonth();

    if (label) {
        label.textContent = financeCalCurrentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Active week range for calendar highlight when in weekly mode
    let weekStartStr = '';
    let weekEndStr = '';
    if (financeChartTimeframe === 'weekly') {
        const { start: wStart, end: wEnd } = getWeekRange(financeChartRefDate);
        weekStartStr = toLocalDateStr(wStart);
        weekEndStr = toLocalDateStr(wEnd);
    }

    // Map which dates have income and expenses
    const incomeDates = new Set();
    const expenseDates = new Set();

    allTransactionsCache.forEach(t => {
        if (!t.transaction_date) return;
        if (financeAnalyticsDept && (t.department || '').toLowerCase() !== financeAnalyticsDept.toLowerCase()) {
            return;
        }
        if (financeAnalyticsMinistryId && String(t.ministry_id) !== String(financeAnalyticsMinistryId)) {
            return;
        }

        const datePart = String(t.transaction_date).split('T')[0];
        const [tY, tM] = datePart.split('-').map(Number);
        if (tY === year && tM === (month + 1)) {
            if (t.transaction_type === 'Income') incomeDates.add(datePart);
            if (t.transaction_type === 'Expense') expenseDates.add(datePart);
        }
    });

    const todayStr = toLocalDateStr(new Date());
    let html = '';

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const prevDay = daysInPrevMonth - i;
        html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${prevDay}</span></div>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasInc = incomeDates.has(dStr);
        const hasExp = expenseDates.has(dStr);
        const isToday = dStr === todayStr;
        const isSelected = dStr === financeCalSelectedDate;
        const inActiveWeek = (financeChartTimeframe === 'weekly' && dStr >= weekStartStr && dStr <= weekEndStr);

        html += `
            <div class="cal-day-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${inActiveWeek ? 'in-active-week' : ''}" 
                 onclick="onFinanceCalendarDateClick('${dStr}')" 
                 title="${dStr}: ${hasInc ? 'Income recorded ' : ''}${hasExp ? 'Expense recorded' : ''}">
                <span class="cal-day-num">${day}</span>
                <div class="cal-day-dots">
                    ${hasInc ? '<span class="cal-dot income" title="Has Income"></span>' : ''}
                    ${hasExp ? '<span class="cal-dot expense" title="Has Expense"></span>' : ''}
                </div>
            </div>
        `;
    }

    // Next month filler days to complete grid of 35 or 42
    const totalRendered = firstDayIndex + daysInMonth;
    const nextDays = totalRendered <= 35 ? (35 - totalRendered) : (42 - totalRendered);
    for (let j = 1; j <= nextDays; j++) {
        html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${j}</span></div>`;
    }

    grid.innerHTML = html;
}

async function loadFinanceAnalytics() {
    try {
        const res = await api.finance.getAnalytics();
        const data = res.data;

        // Update Summary Cards
        document.getElementById('totalIncome').textContent = `₱${Number(data.summary.total_income || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById('totalExpense').textContent = `₱${Number(data.summary.total_expense || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById('netBalance').textContent = `₱${Number(data.summary.net_balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

        selectFinanceAnalyticsMode(financeAnalyticsMode);
    } catch (error) {
        console.error('Error loading finance analytics:', error);
    }
}

async function loadFinanceTransactions() {
    try {
        const [transRes, catRes] = await Promise.all([
            (api.finance.getTransactions ? api.finance.getTransactions() : api.finance.getAll()),
            api.finance.getCategories()
        ]);
        allTransactionsCache = transRes.data || [];
        allCategories = catRes.data || [];

        populateAllMinistrySelects();
        populateFinanceCategoryFilter();
        applyFinanceFilters();
        renderFinanceCalendar();
        renderFinanceInteractiveChart();
    } catch (error) {
        console.error('Error loading finance transactions:', error);
    }
}


async function ensureFinanceCategoriesLoaded() {
    if (!allCategories || allCategories.length === 0) {
        try {
            const catRes = await api.finance.getCategories();
            allCategories = catRes.data || [];
        } catch (e) {
            console.error('Failed to load finance categories:', e);
        }
    }
    await populateFinanceCategoryFilter();
}

async function populateFinanceCategoryFilter() {
    const catSelect = document.getElementById('financeCategoryFilter');
    if (!catSelect) return;

    if (!allCategories || allCategories.length === 0) {
        try {
            const catRes = await api.finance.getCategories();
            allCategories = catRes.data || [];
        } catch (e) {
            console.error('Failed to load categories for filter:', e);
        }
    }

    const currentVal = catSelect.value;
    const typeFilter = document.getElementById('financeTypeFilter')?.value || '';

    let cats = allCategories || [];
    if (typeFilter) {
        cats = cats.filter(c => c.category_type === typeFilter);
    }

    catSelect.innerHTML = '<option value="">All Categories</option>' + 
        cats.map(c => `<option value="${c.category_id}">${escapeHtml(c.category_name)}</option>`).join('');

    if (currentVal && cats.some(c => c.category_id == currentVal)) {
        catSelect.value = currentVal;
    }
}

function onFinanceTypeFilterChange() {
    populateFinanceCategoryFilter();
    applyFinanceFilters();
}

// ============== FINANCE DEPARTMENT & MINISTRY FILTER MODAL ==============
let financeFilterDept = '';
let financeFilterMinistryId = '';

function openFinanceDeptMinFilterModal() {
    const deptSelect = document.getElementById('financeModalDeptSelect');
    if (deptSelect) {
        const standardDepts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        const existingDepts = [...new Set((allMinistriesCache || []).map(m => m.department).filter(Boolean))];
        const allDepts = [...new Set([...standardDepts, ...existingDepts])];

        deptSelect.innerHTML = '<option value="">All Departments</option>' +
            allDepts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)} Department</option>`).join('');

        deptSelect.value = financeFilterDept || '';
    }

    populateFinanceModalMinistryDropdown(financeFilterDept, financeFilterMinistryId);

    const modal = document.getElementById('financeDeptMinFilterModal');
    if (modal) modal.classList.add('active');
}

function closeFinanceDeptMinFilterModal() {
    const modal = document.getElementById('financeDeptMinFilterModal');
    if (modal) modal.classList.remove('active');
}

function onFinanceModalDeptChange() {
    const selectedDept = document.getElementById('financeModalDeptSelect')?.value || '';
    populateFinanceModalMinistryDropdown(selectedDept, '');
}

function populateFinanceModalMinistryDropdown(dept, selectedMinId) {
    const minSelect = document.getElementById('financeModalMinistrySelect');
    const helpEl = document.getElementById('financeModalMinistryHelp');
    if (!minSelect) return;

    let availableMinistries = allMinistriesCache || [];
    if (dept) {
        availableMinistries = availableMinistries.filter(m => (m.department || '').toLowerCase() === dept.toLowerCase());
        if (helpEl) helpEl.textContent = `Showing ${availableMinistries.length} ministries under the ${dept} Department.`;
    } else {
        if (helpEl) helpEl.textContent = `Showing all ${availableMinistries.length} church ministries across all departments.`;
    }

    minSelect.innerHTML = '<option value="">All Ministries</option>' +
        availableMinistries.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');

    if (selectedMinId && availableMinistries.some(m => String(m.ministry_id) === String(selectedMinId))) {
        minSelect.value = String(selectedMinId);
    } else {
        minSelect.value = '';
    }
}

function clearFinanceDeptMinFilter() {
    financeFilterDept = '';
    financeFilterMinistryId = '';

    const deptSelect = document.getElementById('financeModalDeptSelect');
    if (deptSelect) deptSelect.value = '';
    populateFinanceModalMinistryDropdown('', '');

    updateFinanceFilterButtonUI();
    applyFinanceFilters();
    closeFinanceDeptMinFilterModal();
}

function applyFinanceDeptMinFilterModal() {
    financeFilterDept = document.getElementById('financeModalDeptSelect')?.value || '';
    financeFilterMinistryId = document.getElementById('financeModalMinistrySelect')?.value || '';

    updateFinanceFilterButtonUI();
    applyFinanceFilters();
    closeFinanceDeptMinFilterModal();
}

function updateFinanceFilterButtonUI() {
    const btnLabel = document.getElementById('financeFilterBtnLabel');
    const badge = document.getElementById('financeFilterActiveBadge');
    const btn = document.getElementById('btnFinanceFilterModal');

    let activeCount = 0;
    let label = 'Dept & Ministry';

    if (financeFilterMinistryId) {
        activeCount = 2;
        const m = (allMinistriesCache || []).find(min => String(min.ministry_id) === String(financeFilterMinistryId));
        label = m ? m.ministry_name : 'Ministry Filtered';
    } else if (financeFilterDept) {
        activeCount = 1;
        label = `${financeFilterDept} Dept`;
    }

    if (btnLabel) btnLabel.textContent = label;

    if (badge) {
        if (activeCount > 0) {
            badge.textContent = activeCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    if (btn) {
        btn.classList.toggle('active', activeCount > 0);
    }
}

let currentFinancePage = 1;
const FINANCE_PAGE_LIMIT = 10;

async function loadFinanceTable(page = 1) {
    currentFinancePage = page;
    const search = (document.getElementById('financeSearchInput')?.value || '').trim();
    const type = document.getElementById('financeTypeFilter')?.value || '';
    const categoryId = document.getElementById('financeCategoryFilter')?.value || '';
    const dateFrom = document.getElementById('financeDateFrom')?.value || '';
    const dateTo = document.getElementById('financeDateTo')?.value || '';

    const filters = { search, type, category_id: categoryId, start_date: dateFrom, end_date: dateTo, date_from: dateFrom, date_to: dateTo };
    if (financeFilterMinistryId) {
        filters.ministry_id = financeFilterMinistryId;
    } else if (financeFilterDept) {
        filters.department = financeFilterDept;
    }

    const tbody = document.getElementById('financeTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading transactions...</td></tr>';

    try {
        const res = await api.finance.getAll(currentFinancePage, FINANCE_PAGE_LIMIT, filters);
        const list = res.data || [];
        currentFinancePageTransactions = list;
        list.forEach(item => {
            const idx = allTransactionsCache.findIndex(x => x.transaction_id === item.transaction_id);
            if (idx >= 0) allTransactionsCache[idx] = item;
            else allTransactionsCache.push(item);
        });
        renderFinanceTable(list);

        const total = res.pagination ? res.pagination.total : list.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / FINANCE_PAGE_LIMIT);

        const pageInfo = document.getElementById('financePageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentFinancePage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('financePrevBtn');
        if (prevBtn) prevBtn.disabled = currentFinancePage <= 1;

        const nextBtn = document.getElementById('financeNextBtn');
        if (nextBtn) nextBtn.disabled = currentFinancePage >= totalPages;
    } catch (e) {
        console.error('Error loading finance table:', e);
    }
}

function applyFinanceFilters() {
    loadFinanceTable(1);
}

function resetFinanceFilters() {
    if (document.getElementById('financeSearchInput')) document.getElementById('financeSearchInput').value = '';
    if (document.getElementById('financeTypeFilter')) document.getElementById('financeTypeFilter').value = '';
    if (document.getElementById('financeCategoryFilter')) document.getElementById('financeCategoryFilter').value = '';
    if (document.getElementById('financeDateFrom')) document.getElementById('financeDateFrom').value = '';
    if (document.getElementById('financeDateTo')) document.getElementById('financeDateTo').value = '';
    clearFinanceDeptMinFilter();
}

function changeFinancePage(direction) {
    const newPage = currentFinancePage + direction;
    if (newPage > 0) {
        loadFinanceTable(newPage);
    }
}



function renderFinanceTable(transactions) {
    const tbody = document.getElementById('financeTableBody');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center p-8 text-slate-400">No finance records found matching filters.</td></tr>';
        return;
    }

    tbody.innerHTML = transactions.map(t => {
        const isIncome = t.transaction_type === 'Income';
        const amountClass = isIncome ? 'finance-amount-income text-income' : 'finance-amount-expense text-expense';
        return `
        <tr>
            <td class="p-4">${new Date(t.transaction_date).toLocaleDateString()}</td>
            <td class="p-4"><span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">${t.transaction_type}</span></td>
            <td class="p-4">${getFinanceCategoryBadge(t.category_name)}</td>
            <td class="p-4"><span class="badge ${getDeptBadgeClass(t.department)}">${escapeHtml(t.department || 'General')}</span></td>
            <td class="p-4"><span class="text-xs text-slate-600 font-medium">${escapeHtml(t.ministry_name || 'General')}</span></td>
            <td class="p-4 text-right font-semibold ${amountClass}" style="color: ${isIncome ? 'var(--success-color)' : 'var(--danger-color)'}; font-variant-numeric: tabular-nums;">₱${Number(t.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="p-4 text-slate-600">${escapeHtml(t.description || 'N/A')}</td>
            <td class="p-4 text-slate-500 text-xs">${escapeHtml(t.recorded_by_name || 'Admin')}</td>
            <td class="p-4 text-right">
                <div class="action-btns-wrap">
                    <button class="btn-action btn-edit" onclick="editTransaction(${t.transaction_id})" title="Edit"><i class="fa-solid fa-edit"></i></button>
                    <button class="btn-action btn-delete" onclick="deleteTransaction(${t.transaction_id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function onFinanceFormDeptChange() {
    const dept = document.getElementById('transaction_department')?.value || '';
    const minSelect = document.getElementById('transaction_ministry_id');
    populateCascadingMinistries(dept, minSelect, 'None / General Church', '');
}

function openFinanceModal(trans = null) {
    const form = document.getElementById('financeForm');
    form.reset();
    document.getElementById('transaction_id').value = '';

    const deptSelect = document.getElementById('transaction_department');
    const minSelect = document.getElementById('transaction_ministry_id');
    filterCategories();

    if (trans) {
        document.getElementById('financeModalTitle').textContent = 'Edit Transaction';
        document.getElementById('transaction_id').value = trans.transaction_id;
        document.getElementById('transaction_type').value = trans.transaction_type;
        filterCategories();
        if (trans.category_id) {
            document.getElementById('category_id').value = trans.category_id;
        } else if (allCategories && allCategories.length > 0) {
            const match = allCategories.find(c => c.category_name === trans.category_name);
            if (match) document.getElementById('category_id').value = match.category_id;
        }

        if (deptSelect) deptSelect.value = trans.department || '';
        populateCascadingMinistries(trans.department || '', minSelect, 'None / General Church', trans.ministry_id || '');

        document.getElementById('amount').value = trans.amount;
        document.getElementById('transaction_date').value = trans.transaction_date ? formatLocalDate(trans.transaction_date) : '';
        document.getElementById('finance_description').value = trans.description || '';
        document.getElementById('reference_number').value = trans.reference_number || '';
    } else {
        document.getElementById('financeModalTitle').textContent = 'Add Transaction';
        document.getElementById('transaction_date').value = formatLocalDate();
        if (deptSelect) deptSelect.value = '';
        populateCascadingMinistries('', minSelect, 'None / General Church', '');
        filterCategories();
    }
    document.getElementById('financeModal').classList.add('active');
}

function closeFinanceModal() {
    document.getElementById('financeModal').classList.remove('active');
}

function filterCategories() {
    const type = document.getElementById('transaction_type').value;
    const catSelect = document.getElementById('category_id');
    catSelect.innerHTML = '';
    
    const filteredCats = allCategories.filter(c => c.category_type === type);
    filteredCats.forEach(c => {
        catSelect.innerHTML += `<option value="${c.category_id}">${escapeHtml(c.category_name)}</option>`;
    });
}

async function editTransaction(id) {
    let trans = (currentFinancePageTransactions || []).find(t => t.transaction_id == id) || (allTransactionsCache || []).find(t => t.transaction_id == id);
    if (!trans) {
        try {
            const res = await api.finance.getById(id);
            trans = res.data;
        } catch (err) {
            console.error('Failed to fetch transaction details:', err);
        }
    }
    if (trans) {
        openFinanceModal(trans);
    } else {
        showToast('Transaction details could not be loaded.');
    }
}

async function saveTransaction() {
    const id = document.getElementById('transaction_id').value;
    const deptSelect = document.getElementById('transaction_department');
    const minSelect = document.getElementById('transaction_ministry_id');
    const data = {
        transaction_type: document.getElementById('transaction_type').value,
        category_id: document.getElementById('category_id').value,
        department: deptSelect && deptSelect.value ? deptSelect.value : null,
        ministry_id: minSelect && minSelect.value ? Number(minSelect.value) : null,
        amount: document.getElementById('amount').value,
        transaction_date: document.getElementById('transaction_date').value,
        description: document.getElementById('finance_description').value,
        reference_number: document.getElementById('reference_number').value
    };

    if (!data.category_id) {
        showToast('Please select a Category.');
        return;
    }

    if (!data.amount || !data.transaction_date) {
        showToast('Amount and Date are required.');
        return;
    }

    try {
        if (id) {
            const updateFn = api.finance.updateTransaction || api.finance.update;
            await updateFn(id, data);
            showToast('Transaction updated successfully!');
        } else {
            const createFn = api.finance.createTransaction || api.finance.create;
            await createFn(data);
            showToast('Transaction recorded successfully!');
        }
        closeFinanceModal();
        await loadFinanceAnalytics();
        await loadFinanceTransactions();
    } catch (error) {
        showToast('Error saving transaction: ' + error.message);
    }
}

async function deleteTransaction(id) {
    const ok = await showDecisionModal({
        title: 'Delete Financial Record',
        message: 'Are you sure you want to delete this transaction record?',
        confirmText: 'Delete Transaction',
        type: 'danger'
    });
    if (!ok) return;
    try {
        const delFn = api.finance.deleteTransaction || api.finance.delete;
        await delFn(id);
        showToast('Transaction deleted successfully!');
        await loadFinanceAnalytics();
        await loadFinanceTransactions();
    } catch (error) {
        showToast('Error deleting transaction: ' + error.message);
    }
}

// ============== EVENTS & SEMINARY ==============
// ============== EVENTS DEPARTMENT & MINISTRY FILTER MODAL ==============
let eventFilterDept = '';
let eventFilterMinistryId = '';

async function openEventDeptMinFilterModal() {
    if (!allMinistriesCache || allMinistriesCache.length === 0) {
        try {
            const minRes = await api.ministries.getAll();
            allMinistriesCache = minRes.data || [];
        } catch (e) {}
    }
    const deptSelect = document.getElementById('eventModalDeptSelect');
    if (deptSelect) {
        const standardDepts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        const existingDepts = [...new Set((allMinistriesCache || []).map(m => m.department).filter(Boolean))];
        const allDepts = [...new Set([...standardDepts, ...existingDepts])];

        deptSelect.innerHTML = '<option value="">All Departments</option>' +
            allDepts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)} Department</option>`).join('');

        deptSelect.value = eventFilterDept || '';
    }

    populateEventModalMinistryDropdown(eventFilterDept, eventFilterMinistryId);

    const modal = document.getElementById('eventDeptMinFilterModal');
    if (modal) modal.classList.add('active');
}

function closeEventDeptMinFilterModal() {
    const modal = document.getElementById('eventDeptMinFilterModal');
    if (modal) modal.classList.remove('active');
}

function onEventModalDeptChange() {
    const selectedDept = document.getElementById('eventModalDeptSelect')?.value || '';
    populateEventModalMinistryDropdown(selectedDept, '');
}

function populateEventModalMinistryDropdown(dept, selectedMinId) {
    const minSelect = document.getElementById('eventModalMinistrySelect');
    const helpEl = document.getElementById('eventModalMinistryHelp');
    if (!minSelect) return;

    let availableMinistries = allMinistriesCache || [];
    if (dept) {
        availableMinistries = availableMinistries.filter(m => (m.department || '').toLowerCase() === dept.toLowerCase());
        if (helpEl) helpEl.textContent = `Showing ${availableMinistries.length} ministries under the ${dept} Department.`;
    } else {
        if (helpEl) helpEl.textContent = `Showing all ${availableMinistries.length} church ministries across all departments.`;
    }

    minSelect.innerHTML = '<option value="">All Ministries</option>' +
        availableMinistries.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');

    if (selectedMinId && availableMinistries.some(m => String(m.ministry_id) === String(selectedMinId))) {
        minSelect.value = String(selectedMinId);
    } else {
        minSelect.value = '';
    }
}

function clearEventDeptMinFilter() {
    eventFilterDept = '';
    eventFilterMinistryId = '';

    const deptSelect = document.getElementById('eventModalDeptSelect');
    if (deptSelect) deptSelect.value = '';
    populateEventModalMinistryDropdown('', '');

    updateEventFilterButtonUI();
    applyEventFilters();
    closeEventDeptMinFilterModal();
}

function applyEventDeptMinFilterModal() {
    eventFilterDept = document.getElementById('eventModalDeptSelect')?.value || '';
    eventFilterMinistryId = document.getElementById('eventModalMinistrySelect')?.value || '';

    updateEventFilterButtonUI();
    applyEventFilters();
    closeEventDeptMinFilterModal();
}

function updateEventFilterButtonUI() {
    const btnLabel = document.getElementById('eventFilterBtnLabel');
    const badge = document.getElementById('eventFilterActiveBadge');
    const btn = document.getElementById('btnEventFilterModal');
    if (!btnLabel || !badge) return;

    let activeCount = 0;
    let label = 'Dept & Ministry';

    if (eventFilterMinistryId) {
        activeCount = 2;
        const m = (allMinistriesCache || []).find(min => String(min.ministry_id) === String(eventFilterMinistryId));
        label = m ? m.ministry_name : 'Ministry Filtered';
    } else if (eventFilterDept) {
        activeCount = 1;
        label = `${eventFilterDept} Dept`;
    }

    btnLabel.textContent = label;

    if (badge) {
        if (activeCount > 0) {
            badge.textContent = activeCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    if (btn) {
        btn.classList.toggle('active', activeCount > 0);
    }
}

let currentEventsPage = 1;
const EVENT_PAGE_LIMIT = 10;
let adminEventArchivesMode = false;

function toggleAdminEventArchives() {
    adminEventArchivesMode = !adminEventArchivesMode;
    const btn = document.getElementById('btnAdminEventArchives');
    const headerTitle = document.querySelector('#view-events .card-header h2');
    
    if (adminEventArchivesMode) {
        if (btn) {
            btn.classList.add('active');
            btn.style.background = '#fef3c7';
            btn.style.borderColor = '#f59e0b';
            btn.style.color = '#92400e';
            btn.innerHTML = '<i class="fa-solid fa-calendar-check mr-1"></i> <span id="adminEventArchivesBtnText">Active Events</span>';
        }
        if (headerTitle) headerTitle.innerHTML = '<i class="fa-solid fa-box-archive" style="color: var(--gold); margin-right: 0.5rem;"></i> Event Archives';
    } else {
        if (btn) {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
            btn.innerHTML = '<i class="fa-solid fa-box-archive mr-1"></i> <span id="adminEventArchivesBtnText">Event Archives</span>';
        }
        if (headerTitle) headerTitle.innerHTML = '<i class="fa-solid fa-calendar-plus" style="color: var(--gold); margin-right: 0.5rem;"></i> Events & Seminary';
    }
    loadEvents(1);
}

async function archiveEvent(id) {
    const ok = await showDecisionModal({
        title: 'Archive Event',
        message: 'Are you sure you want to archive this event? Archived events can be restored at any time from Event Archives.',
        confirmText: 'Archive Event',
        type: 'warning'
    });
    if (!ok) return;

    try {
        await api.events.archive(id);
        if (typeof showToast === 'function') showToast('Event archived successfully!');
        await loadEvents(currentEventsPage);
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Failed to archive event.');
    }
}

async function restoreEvent(id) {
    try {
        await api.events.restore(id);
        if (typeof showToast === 'function') showToast('Event restored to active schedule!');
        await loadEvents(currentEventsPage);
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Failed to restore event.');
    }
}

async function loadEvents(page = 1) {
    currentEventsPage = page;
    const search = (document.getElementById('eventSearchInput')?.value || '').trim();
    const type = document.getElementById('eventTypeFilter')?.value || '';
    const status = document.getElementById('eventStatusFilter')?.value || '';
    const enrollment = document.getElementById('eventEnrollmentFilter')?.value || '';
    const eventDate = document.getElementById('eventDateFilter')?.value || '';

    const filters = { 
        search, 
        type, 
        event_type: type, 
        status, 
        enrollment, 
        date: eventDate,
        archived: adminEventArchivesMode ? 1 : 0
    };
    if (eventFilterMinistryId) {
        filters.ministry_id = eventFilterMinistryId;
    } else if (eventFilterDept) {
        filters.department = eventFilterDept;
    }

    const tbody = document.getElementById('eventsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading events...</td></tr>';

    try {
        if (!allMinistriesCache || allMinistriesCache.length === 0) {
            try {
                const minRes = await api.ministries.getAll();
                allMinistriesCache = minRes.data || [];
                populateAllMinistrySelects();
            } catch (e) {}
        }

        const res = await api.events.getAll(currentEventsPage, EVENT_PAGE_LIMIT, filters);
        const list = res.data || [];
        allEventsCache = list;
        populateAllMinistrySelects();
        renderEventsTable(list);

        const total = res.pagination ? res.pagination.total : list.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / EVENT_PAGE_LIMIT);

        const pageInfo = document.getElementById('eventsPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentEventsPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('eventsPrevBtn');
        if (prevBtn) prevBtn.disabled = currentEventsPage <= 1;

        const nextBtn = document.getElementById('eventsNextBtn');
        if (nextBtn) nextBtn.disabled = currentEventsPage >= totalPages;
    } catch (e) {
        console.error('Error loading events:', e);
    }
}

function applyEventFilters() {
    loadEvents(1);
}

function resetEventFilters() {
    if (document.getElementById('eventSearchInput')) document.getElementById('eventSearchInput').value = '';
    if (document.getElementById('eventTypeFilter')) document.getElementById('eventTypeFilter').value = '';
    if (document.getElementById('eventStatusFilter')) document.getElementById('eventStatusFilter').value = '';
    if (document.getElementById('eventEnrollmentFilter')) document.getElementById('eventEnrollmentFilter').value = '';
    if (document.getElementById('eventDateFilter')) document.getElementById('eventDateFilter').value = '';
    clearEventDeptMinFilter();
}

function changeEventsPage(direction) {
    const newPage = currentEventsPage + direction;
    if (newPage > 0) {
        loadEvents(newPage);
    }
}

function renderEventsTable(events) {
    const tbody = document.getElementById('eventsTableBody');
    if (!tbody) return;

    if (!events || events.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-slate-400">${adminEventArchivesMode ? 'No archived events found.' : 'No events found matching filters.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = events.map(e => {
        const canArchive = e.status === 'Completed' || e.status === 'Cancelled';
        return `
        <tr>
            <td class="p-4 font-medium text-navy">
                ${escapeHtml(e.title)}
                ${e.is_featured == 1 ? '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.7rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; margin-left: 6px;"><i class="fa-solid fa-star text-2xs"></i>Featured</span>' : ''}
            </td>
            <td class="p-4"><span class="badge ${getDeptBadgeClass(e.department)}">${escapeHtml(e.department || 'General')}</span></td>
            <td class="p-4"><span class="badge ${e.ministry_name ? 'badge-ministry-pill' : 'badge-inactive'}">${escapeHtml(e.ministry_name || 'General Church')}</span></td>
            <td class="p-4"><span class="badge ${e.event_type === 'Seminary' ? 'badge-active' : 'badge-income'}">${escapeHtml(e.event_type)}</span></td>
            <td class="p-4 text-xs text-slate-600">${e.start_datetime ? new Date(e.start_datetime).toLocaleDateString() : 'N/A'}</td>
            <td class="p-4">${getEventStatusBadge(e.status)}</td>
            <td class="p-4">${e.is_enrollment_open == 1 ? '<span style="color:var(--success-color); font-weight: 600;">Open</span>' : '<span class="text-slate-400">Closed</span>'}</td>
            <td class="p-4 text-right">
                <div class="action-btns-wrap">
                    <button class="btn-action btn-view" onclick="viewEvent(${e.event_id})" title="View Details"><i class="fa-solid fa-eye"></i></button>
                    ${adminEventArchivesMode ? `
                        <button class="btn-action" style="color: #059669;" onclick="restoreEvent(${e.event_id})" title="Restore to Active Events"><i class="fa-solid fa-rotate-left"></i></button>
                    ` : `
                        <button class="btn-action" style="color: #2563eb;" onclick="viewEventEnrollments(${e.event_id})" title="View Enrolled Members"><i class="fa-solid fa-user-graduate"></i></button>
                        <button class="btn-action btn-edit" onclick="editEvent(${e.event_id})" title="Edit"><i class="fa-solid fa-edit"></i></button>
                        ${canArchive ? `
                            <button class="btn-action" style="color: #d97706;" onclick="archiveEvent(${e.event_id})" title="Archive Event (Completed/Cancelled)"><i class="fa-solid fa-box-archive"></i></button>
                        ` : ''}
                    `}
                    <button class="btn-action btn-delete" onclick="deleteEvent(${e.event_id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

function onEventFormDeptChange() {
    const dept = document.getElementById('event_department')?.value || '';
    const minSelect = document.getElementById('ministry_id_event');
    populateCascadingMinistries(dept, minSelect, 'None', '');
}

async function openEventModal(event = null) {
    if (!allMinistriesCache || allMinistriesCache.length === 0) {
        try {
            const minRes = await api.ministries.getAll();
            allMinistriesCache = minRes.data || [];
            populateAllMinistrySelects();
        } catch (e) {}
    }

    const form = document.getElementById('eventForm');
    form.reset();
    document.getElementById('event_id').value = '';

    const deptSelect = document.getElementById('event_department');
    const ministrySelect = document.getElementById('ministry_id_event');
    const statusSelect = document.getElementById('event_status') || document.getElementById('status');

    document.getElementById('is_enrollment_open').checked = false;
    document.getElementById('is_public').checked = true;
    document.getElementById('is_featured').checked = false;

    const bannerPreview = document.getElementById('event_banner_preview');
    const bannerPlaceholder = document.getElementById('event_banner_placeholder');
    const bannerFileInput = document.getElementById('event_banner_file');
    const bannerUrlInput = document.getElementById('event_banner_url');
    if (bannerFileInput) bannerFileInput.value = '';
    if (bannerUrlInput) bannerUrlInput.value = (event && event.banner_image) ? event.banner_image : '';
    if (event && event.banner_image) {
        if (bannerPreview) {
            bannerPreview.src = event.banner_image;
            bannerPreview.style.display = 'block';
        }
        if (bannerPlaceholder) bannerPlaceholder.style.display = 'none';
    } else {
        if (bannerPreview) {
            bannerPreview.src = '';
            bannerPreview.style.display = 'none';
        }
        if (bannerPlaceholder) bannerPlaceholder.style.display = 'block';
    }

    if (event) {
        document.getElementById('eventModalTitle').textContent = 'Edit Event';
        document.getElementById('event_id').value = event.event_id;
        document.getElementById('title').value = event.title;
        document.getElementById('event_type').value = event.event_type;
        if (statusSelect) statusSelect.value = event.status || 'Upcoming';
        document.getElementById('start_datetime').value = formatLocalDateTime(event.start_datetime);
        document.getElementById('end_datetime').value = formatLocalDateTime(event.end_datetime);
        document.getElementById('venue').value = event.venue || '';
        document.getElementById('organizer').value = event.organizer || '';
        document.getElementById('capacity').value = event.capacity || '';

        if (deptSelect) deptSelect.value = event.department || '';
        populateCascadingMinistries(event.department || '', ministrySelect, 'None', event.ministry_id || '');

        document.getElementById('event_description').value = event.description || '';
        document.getElementById('is_enrollment_open').checked = event.is_enrollment_open == 1;
        document.getElementById('is_public').checked = event.is_public == 1;
        document.getElementById('is_featured').checked = event.is_featured == 1;
    } else {
        document.getElementById('eventModalTitle').textContent = 'Add Event';
        if (statusSelect) statusSelect.value = 'Upcoming';
        const now = new Date();
        const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        document.getElementById('start_datetime').value = formatLocalDateTime(now);
        document.getElementById('end_datetime').value = formatLocalDateTime(later);

        if (deptSelect) deptSelect.value = '';
        populateCascadingMinistries('', ministrySelect, 'None', '');
    }
    
    document.getElementById('eventModal').classList.add('active');
}

function closeEventModal() {
    document.getElementById('eventModal').classList.remove('active');
}

async function editEvent(id) {
    try {
        const res = await api.events.getById(id);
        await openEventModal(res.data);
    } catch (error) {
        showToast('Error fetching event details: ' + error.message);
    }
}

async function saveEvent() {
    const id = document.getElementById('event_id').value;
    const statusSelect = document.getElementById('event_status') || document.getElementById('status');
    const deptSelect = document.getElementById('event_department');
    const minSelect = document.getElementById('ministry_id_event');

    const title = document.getElementById('title').value;
    const event_type = document.getElementById('event_type').value;
    const status = statusSelect ? statusSelect.value : 'Upcoming';
    const start_datetime = document.getElementById('start_datetime').value;
    const end_datetime = document.getElementById('end_datetime').value;
    const department = deptSelect && deptSelect.value ? deptSelect.value : '';
    const venue = document.getElementById('venue').value;
    const organizer = document.getElementById('organizer').value;
    const capacity = document.getElementById('capacity').value;
    const ministry_id = minSelect && minSelect.value ? minSelect.value : '';
    const description = document.getElementById('event_description').value;
    const is_enrollment_open = document.getElementById('is_enrollment_open').checked;
    const is_public = document.getElementById('is_public').checked;
    const is_featured = document.getElementById('is_featured').checked;

    if (!title || !start_datetime || !end_datetime) {
        showToast('Title, Start Date, and End Date are required.');
        return;
    }

    const bannerFile = document.getElementById('event_banner_file')?.files?.[0];
    const bannerUrl = document.getElementById('event_banner_url')?.value || '';

    const formData = new FormData();
    formData.append('title', title);
    formData.append('event_type', event_type);
    formData.append('status', status);
    formData.append('start_datetime', start_datetime);
    formData.append('end_datetime', end_datetime);
    formData.append('department', department || '');
    formData.append('venue', venue || '');
    formData.append('organizer', organizer || '');
    formData.append('capacity', capacity || '');
    formData.append('ministry_id', ministry_id || '');
    formData.append('description', description || '');
    formData.append('is_enrollment_open', is_enrollment_open ? '1' : '0');
    formData.append('is_public', is_public ? '1' : '0');
    formData.append('is_featured', is_featured ? '1' : '0');

    if (bannerFile) {
        formData.append('banner_image', bannerFile);
    } else if (bannerUrl) {
        formData.append('banner_image', bannerUrl);
    }

    try {
        if (id) {
            await api.events.update(id, formData);
            showToast('Event updated successfully!');
        } else {
            await api.events.create(formData);
            showToast('Event created successfully!');
        }
        closeEventModal();
        await loadEvents(currentEventsPage);
    } catch (error) {
        showToast('Error saving event: ' + error.message);
    }
}

async function deleteEvent(id) {
    const ok = await showDecisionModal({
        title: 'Delete Event / Seminary',
        message: 'Are you sure you want to delete this event? All enrollments will also be removed.',
        confirmText: 'Delete Event',
        type: 'danger'
    });
    if (!ok) return;
    try {
        await api.events.delete(id);
        showToast('Event deleted successfully!');
        await loadEvents();
    } catch (error) {
        showToast('Error deleting event: ' + error.message);
    }
}

// ==========================================
// EVENT ENROLLMENTS VIEWER & MANAGEMENT (ADMIN)
// ==========================================
let activeEventEnrollmentsList = [];
let activeEventForEnrollment = null;

async function viewEventEnrollments(eventId) {
    activeEventForEnrollment = (allEventsCache || []).find(e => e.event_id == eventId);
    
    const modal = document.getElementById('eventEnrollmentsModal');
    if (!modal) return;

    const titleEl = document.getElementById('enrollModalEventTitle');
    const typeBadgeEl = document.getElementById('enrollModalTypeBadge');
    const countEl = document.getElementById('enrollModalTotalCount');
    const searchInput = document.getElementById('enrollModalSearch');
    const tbody = document.getElementById('enrollModalTableBody');

    if (titleEl) titleEl.textContent = activeEventForEnrollment ? activeEventForEnrollment.title : 'Event / Seminary';
    if (typeBadgeEl) {
        const evType = activeEventForEnrollment?.event_type || 'Event';
        typeBadgeEl.textContent = evType;
        typeBadgeEl.className = evType === 'Seminary' ? 'badge badge-active' : 'badge badge-income';
    }
    if (searchInput) searchInput.value = '';
    if (countEl) countEl.textContent = '...';

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-slate-400">
                    <i class="fa-solid fa-spinner fa-spin text-xl mr-2 text-primary"></i> Loading enrolled members...
                </td>
            </tr>
        `;
    }

    modal.style.display = 'flex';
    modal.classList.add('active');

    try {
        const res = await api.events.getEnrollments(eventId);
        activeEventEnrollmentsList = res.data || [];
        renderEventEnrollmentsList(activeEventEnrollmentsList);
    } catch (err) {
        console.error('Failed to load event enrollments:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-8 text-center text-rose-500">
                        <i class="fa-solid fa-circle-exclamation mr-1"></i> Failed to load enrollments: ${escapeHtml(err.message)}
                    </td>
                </tr>
            `;
        }
    }
}

function renderEventEnrollmentsList(enrollments) {
    const tbody = document.getElementById('enrollModalTableBody');
    const countEl = document.getElementById('enrollModalTotalCount');
    if (countEl) countEl.textContent = enrollments ? enrollments.length : 0;
    if (!tbody) return;

    if (!enrollments || enrollments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-slate-400">
                    <i class="fa-regular fa-folder-open text-2xl block mb-2 text-slate-300"></i>
                    No church members enrolled yet for this event or seminary.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = enrollments.map(en => {
        const fullName = `${en.first_name || ''} ${en.last_name || ''}`.trim() || 'Unknown Member';
        const avatarSrc = en.profile_image 
            ? (en.profile_image.startsWith('/') ? en.profile_image : '/' + en.profile_image)
            : '/images/default-avatar.svg';
        const dateStr = en.enrollment_date ? new Date(en.enrollment_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
        
        let statusBadge = '<span class="badge badge-warning">Pending</span>';
        if (en.status === 'Confirmed') {
            statusBadge = '<span class="badge badge-active" style="background:#dcfce7; color:#15803d; border:1px solid #86efac;">Confirmed</span>';
        } else if (en.status === 'Attended') {
            statusBadge = '<span class="badge" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;">Attended</span>';
        } else if (en.status === 'Cancelled') {
            statusBadge = '<span class="badge badge-inactive">Cancelled</span>';
        }

        return `
            <tr class="hover:bg-slate-50">
                <td class="p-3">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <img src="${avatarSrc}" alt="${escapeHtml(fullName)}" 
                             onerror="this.src='/images/default-avatar.svg'"
                             style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid #e2e8f0; flex-shrink: 0;">
                        <div>
                            <div style="font-weight: 600; color: var(--navy); font-size: 0.9rem;">${escapeHtml(fullName)}</div>
                            <div style="font-size: 0.725rem; color: #64748b;">Member ID: #${en.member_id}</div>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <div style="font-size: 0.8rem; color: var(--navy);"><i class="fa-regular fa-envelope text-slate-400 mr-1"></i>${escapeHtml(en.email || 'No email')}</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;"><i class="fa-solid fa-phone text-slate-400 mr-1"></i>${escapeHtml(en.contact_number || 'No contact')}</div>
                </td>
                <td class="p-3 text-xs text-slate-600">
                    ${dateStr}
                </td>
                <td class="p-3">
                    ${statusBadge}
                </td>
                <td class="p-3 text-right">
                    <select onchange="updateEventEnrollmentStatusAdmin(${en.enrollment_id}, this.value, ${en.event_id || (activeEventForEnrollment?.event_id)})" 
                            style="padding: 0.3rem 0.5rem; font-size: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: #fff; cursor: pointer;">
                        <option value="Pending" ${en.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Confirmed" ${en.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="Attended" ${en.status === 'Attended' ? 'selected' : ''}>Attended</option>
                        <option value="Cancelled" ${en.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

function filterEventEnrollmentsList() {
    const q = (document.getElementById('enrollModalSearch')?.value || '').toLowerCase().trim();
    if (!q) {
        renderEventEnrollmentsList(activeEventEnrollmentsList);
        return;
    }
    const filtered = activeEventEnrollmentsList.filter(en => {
        const name = `${en.first_name || ''} ${en.last_name || ''}`.toLowerCase();
        const email = (en.email || '').toLowerCase();
        const phone = (en.contact_number || '').toLowerCase();
        const status = (en.status || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || status.includes(q);
    });
    renderEventEnrollmentsList(filtered);
}

function closeEventEnrollmentsModal() {
    const modal = document.getElementById('eventEnrollmentsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.removeProperty('display');
    }
}

async function updateEventEnrollmentStatusAdmin(enrollmentId, newStatus, eventId) {
    try {
        await api.events.updateEnrollmentStatus(enrollmentId, newStatus);
        showToast(`Enrollment status updated to "${newStatus}"`);
        const item = activeEventEnrollmentsList.find(x => x.enrollment_id == enrollmentId);
        if (item) item.status = newStatus;
        filterEventEnrollmentsList();
    } catch (err) {
        showToast('Failed to update enrollment status: ' + err.message);
    }
}

// ============== ANNOUNCEMENTS ==============
// ============== ANNOUNCEMENTS DEPARTMENT & MINISTRY FILTER MODAL ==============
let announcementFilterDept = '';
let announcementFilterMinistryId = '';

function openAnnouncementDeptMinFilterModal() {
    const deptSelect = document.getElementById('announcementModalDeptSelect');
    if (deptSelect) {
        const standardDepts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        const existingDepts = [...new Set((allMinistriesCache || []).map(m => m.department).filter(Boolean))];
        const allDepts = [...new Set([...standardDepts, ...existingDepts])];

        deptSelect.innerHTML = '<option value="">All Departments</option>' +
            allDepts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)} Department</option>`).join('');

        deptSelect.value = announcementFilterDept || '';
    }

    populateAnnouncementModalMinistryDropdown(announcementFilterDept, announcementFilterMinistryId);

    const modal = document.getElementById('announcementDeptMinFilterModal');
    if (modal) modal.classList.add('active');
}

function closeAnnouncementDeptMinFilterModal() {
    const modal = document.getElementById('announcementDeptMinFilterModal');
    if (modal) modal.classList.remove('active');
}

function onAnnouncementModalDeptChange() {
    const selectedDept = document.getElementById('announcementModalDeptSelect')?.value || '';
    populateAnnouncementModalMinistryDropdown(selectedDept, '');
}

function populateAnnouncementModalMinistryDropdown(dept, selectedMinId) {
    const minSelect = document.getElementById('announcementModalMinistrySelect');
    const helpEl = document.getElementById('announcementModalMinistryHelp');
    if (!minSelect) return;

    let availableMinistries = allMinistriesCache || [];
    if (dept) {
        availableMinistries = availableMinistries.filter(m => (m.department || '').toLowerCase() === dept.toLowerCase());
        if (helpEl) helpEl.textContent = `Showing ${availableMinistries.length} ministries under the ${dept} Department.`;
    } else {
        if (helpEl) helpEl.textContent = `Showing all ${availableMinistries.length} church ministries across all departments.`;
    }

    minSelect.innerHTML = '<option value="">All Ministries</option>' +
        availableMinistries.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');

    if (selectedMinId && availableMinistries.some(m => String(m.ministry_id) === String(selectedMinId))) {
        minSelect.value = String(selectedMinId);
    } else {
        minSelect.value = '';
    }
}

function clearAnnouncementDeptMinFilter() {
    announcementFilterDept = '';
    announcementFilterMinistryId = '';

    const deptSelect = document.getElementById('announcementModalDeptSelect');
    if (deptSelect) deptSelect.value = '';
    populateAnnouncementModalMinistryDropdown('', '');

    updateAnnouncementFilterButtonUI();
    applyAnnouncementFilters();
    closeAnnouncementDeptMinFilterModal();
}

function applyAnnouncementDeptMinFilterModal() {
    announcementFilterDept = document.getElementById('announcementModalDeptSelect')?.value || '';
    announcementFilterMinistryId = document.getElementById('announcementModalMinistrySelect')?.value || '';

    updateAnnouncementFilterButtonUI();
    applyAnnouncementFilters();
    closeAnnouncementDeptMinFilterModal();
}

function updateAnnouncementFilterButtonUI() {
    const btnLabel = document.getElementById('announcementFilterBtnLabel');
    const badge = document.getElementById('announcementFilterActiveBadge');
    const btn = document.getElementById('btnAnnouncementFilterModal');
    if (!btnLabel || !badge) return;

    let activeCount = 0;
    let label = 'Dept & Ministry';

    if (announcementFilterMinistryId) {
        activeCount = 2;
        const m = (allMinistriesCache || []).find(min => String(min.ministry_id) === String(announcementFilterMinistryId));
        label = m ? m.ministry_name : 'Ministry Filtered';
    } else if (announcementFilterDept) {
        activeCount = 1;
        label = `${announcementFilterDept} Dept`;
    }

    btnLabel.textContent = label;

    if (badge) {
        if (activeCount > 0) {
            badge.textContent = activeCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    if (btn) {
        btn.classList.toggle('active', activeCount > 0);
    }
}

let currentAnnouncementsPage = 1;
const ANNOUNCEMENT_PAGE_LIMIT = 10;

async function loadAnnouncements(page = 1) {
    currentAnnouncementsPage = page;
    const search = (document.getElementById('announcementSearchInput')?.value || '').trim();
    const category = document.getElementById('announcementCategoryFilter')?.value || '';
    const audience = document.getElementById('announcementAudienceFilter')?.value || '';
    const active = document.getElementById('announcementActiveFilter')?.value || '';
    const pinned = document.getElementById('announcementPinnedFilter')?.value || '';
    const emailed = document.getElementById('announcementEmailFilter')?.value || '';
    const publish_date = document.getElementById('announcementPublishDateFilter')?.value || '';

    const filters = { search, category, target_audience: audience, is_active: active, is_pinned: pinned, is_emailed: emailed, publish_date };
    if (announcementFilterMinistryId) {
        filters.ministry_id = announcementFilterMinistryId;
    } else if (announcementFilterDept) {
        filters.department = announcementFilterDept;
    }

    const tbody = document.getElementById('announcementsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading announcements...</td></tr>';

    try {
        const res = await api.announcements.getAll(currentAnnouncementsPage, ANNOUNCEMENT_PAGE_LIMIT, filters);
        const list = res.data || [];
        allAnnouncementsCache = list;
        renderAnnouncementsTable(list);

        const total = res.pagination ? res.pagination.total : list.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / ANNOUNCEMENT_PAGE_LIMIT);

        const pageInfo = document.getElementById('announcementsPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentAnnouncementsPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('announcementsPrevBtn');
        if (prevBtn) prevBtn.disabled = currentAnnouncementsPage <= 1;

        const nextBtn = document.getElementById('announcementsNextBtn');
        if (nextBtn) nextBtn.disabled = currentAnnouncementsPage >= totalPages;
    } catch (e) {
        console.error('Error loading announcements:', e);
    }
}

function applyAnnouncementFilters() {
    loadAnnouncements(1);
}

function resetAnnouncementFilters() {
    if (document.getElementById('announcementSearchInput')) document.getElementById('announcementSearchInput').value = '';
    if (document.getElementById('announcementCategoryFilter')) document.getElementById('announcementCategoryFilter').value = '';
    if (document.getElementById('announcementAudienceFilter')) document.getElementById('announcementAudienceFilter').value = '';
    if (document.getElementById('announcementActiveFilter')) document.getElementById('announcementActiveFilter').value = '';
    if (document.getElementById('announcementPinnedFilter')) document.getElementById('announcementPinnedFilter').value = '';
    if (document.getElementById('announcementEmailFilter')) document.getElementById('announcementEmailFilter').value = '';
    if (document.getElementById('announcementPublishDateFilter')) document.getElementById('announcementPublishDateFilter').value = '';
    clearAnnouncementDeptMinFilter();
}

function changeAnnouncementsPage(direction) {
    const newPage = currentAnnouncementsPage + direction;
    if (newPage > 0) {
        loadAnnouncements(newPage);
    }
}



function renderAnnouncementsTable(announcements) {
    const tbody = document.getElementById('announcementsTableBody');
    if (!tbody) return;

    if (!announcements || announcements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center p-8 text-slate-400">No announcements found matching filters.</td></tr>';
        return;
    }

    tbody.innerHTML = announcements.map(a => {
        const isEmailSent = a.email_triggered == 1;
        const isSmsVerified = a.sms_triggered == 1;
        return `
            <tr>
                <td class="p-4 font-medium text-navy">${escapeHtml(a.title)}</td>
                <td class="p-4"><span class="badge ${getDeptBadgeClass(a.department)}">${escapeHtml(a.department || 'General')}</span></td>
                <td class="p-4"><span class="badge ${a.ministry_name ? 'badge-ministry-pill' : 'badge-inactive'}">${escapeHtml(a.ministry_name || 'General Church')}</span></td>
                <td class="p-4">${getAnnouncementCategoryBadge(a.category)}</td>
                <td class="p-4 text-xs text-slate-600">${escapeHtml(a.target_audience)}</td>
                <td class="p-4 text-xs text-slate-600">${a.publish_date ? new Date(a.publish_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '<span class="text-slate-400 italic">Unpublished</span>'}</td>
                <td class="p-4">${a.is_pinned == 1 ? '<span style="color:var(--secondary-color); font-weight: 600;"><i class="fa-solid fa-thumbtack mr-1"></i>Yes</span>' : '<span class="text-slate-400">No</span>'}</td>
                <td class="p-4">
                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                        ${isEmailSent 
                            ? '<span class="badge" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:0.7rem; padding:2px 6px;"><i class="fa-solid fa-envelope mr-1"></i>Email Sent</span>' 
                            : '<span class="badge" style="background:#f8fafc; color:#94a3b8; border:1px solid #e2e8f0; font-size:0.7rem; padding:2px 6px;"><i class="fa-regular fa-envelope mr-1"></i>Email Pending</span>'}
                        ${isSmsVerified 
                            ? '<span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-size:0.7rem; padding:2px 6px;"><i class="fa-solid fa-circle-check mr-1"></i>SMS Verified</span>' 
                            : '<span class="badge" style="background:#fffbeb; color:#b45309; border:1px solid #fef3c7; font-size:0.7rem; padding:2px 6px;"><i class="fa-solid fa-clock mr-1"></i>SMS Pending</span>'}
                    </div>
                </td>
                <td class="p-4 text-right">
                    <div class="action-btns-wrap">
                        <button class="btn-action" style="border-color: #2563eb; color: #2563eb;" onclick="triggerEmailBroadcast(${a.announcement_id})" title="${isEmailSent ? 'Resend Email Broadcast' : 'Send Email Broadcast to Members'}"><i class="fa-solid fa-envelope"></i></button>
                        <button class="btn-action" style="border-color: #10b981; color: #10b981;" onclick="triggerSmsBroadcast(${a.announcement_id})" title="${isSmsVerified ? 'Resend Verified SMS Broadcast' : 'Send Verified SMS Broadcast to Members'}"><i class="fa-solid fa-comment-sms"></i></button>
                        <button class="btn-action btn-view" onclick="viewAnnouncement(${a.announcement_id})" title="View"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-action btn-edit" onclick="editAnnouncement(${a.announcement_id})" title="Edit"><i class="fa-solid fa-edit"></i></button>
                        <button class="btn-action btn-delete" onclick="deleteAnnouncement(${a.announcement_id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function onAnnFormDeptChange() {
    const dept = document.getElementById('ann_department')?.value || '';
    const minSelect = document.getElementById('ann_ministry_id');
    populateCascadingMinistries(dept, minSelect, 'None / General Church', '');
}

function openAnnouncementModal(a = null) {
    const form = document.getElementById('announcementForm');
    form.reset();
    document.getElementById('announcement_id').value = '';

    const deptSelect = document.getElementById('ann_department');
    const minSelect = document.getElementById('ann_ministry_id');

    if (a) {
        document.getElementById('announcementModalTitle').textContent = 'Edit Announcement';
        document.getElementById('announcement_id').value = a.announcement_id;
        document.getElementById('ann_title').value = a.title;
        document.getElementById('ann_category').value = a.category;
        document.getElementById('ann_target').value = a.target_audience;

        if (deptSelect) deptSelect.value = a.department || '';
        populateCascadingMinistries(a.department || '', minSelect, 'None / General Church', a.ministry_id || '');

        document.getElementById('ann_content').value = a.content;
        document.getElementById('ann_publish_date').value = a.publish_date ? formatLocalDateTime(a.publish_date) : '';
        document.getElementById('ann_expiry_date').value = a.expiry_date ? formatLocalDateTime(a.expiry_date) : '';
        document.getElementById('ann_is_pinned').checked = a.is_pinned == 1;
        document.getElementById('ann_is_published').checked = a.is_published == 1;
    } else {
        document.getElementById('announcementModalTitle').textContent = 'Add Announcement';
        document.getElementById('ann_publish_date').value = formatLocalDateTime(new Date());
        document.getElementById('ann_is_published').checked = true;

        if (deptSelect) deptSelect.value = '';
        populateCascadingMinistries('', minSelect, 'None / General Church', '');
    }
    document.getElementById('announcementModal').classList.add('active');
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.remove('active');
}

async function editAnnouncement(id) {
    try {
        const res = await api.announcements.getById(id);
        openAnnouncementModal(res.data);
    } catch (error) {
        showToast('Error fetching announcement: ' + error.message);
    }
}

async function saveAnnouncement() {
    const id = document.getElementById('announcement_id').value;
    const deptSelect = document.getElementById('ann_department');
    const minSelect = document.getElementById('ann_ministry_id');

    const data = {
        title: document.getElementById('ann_title').value,
        department: deptSelect && deptSelect.value ? deptSelect.value : null,
        ministry_id: minSelect && minSelect.value ? Number(minSelect.value) : null,
        category: document.getElementById('ann_category').value,
        target_audience: document.getElementById('ann_target').value,
        content: document.getElementById('ann_content').value,
        publish_date: document.getElementById('ann_publish_date').value,
        expiry_date: document.getElementById('ann_expiry_date').value,
        is_pinned: document.getElementById('ann_is_pinned').checked,
        is_published: document.getElementById('ann_is_published').checked
    };

    if (!data.title || !data.content) {
        showToast('Title and Content are required.');
        return;
    }

    try {
        if (id) {
            await api.announcements.update(id, data);
            showToast('Announcement updated successfully!');
        } else {
            await api.announcements.create(data);
            showToast('Announcement created successfully!');
        }
        closeAnnouncementModal();
        await loadAnnouncements();
    } catch (error) {
        showToast('Error saving announcement: ' + error.message);
    }
}

async function deleteAnnouncement(id) {
    const ok = await showDecisionModal({
        title: 'Delete Announcement',
        message: 'Are you sure you want to delete this church announcement?',
        confirmText: 'Delete Announcement',
        type: 'danger'
    });
    if (!ok) return;
    try {
        await api.announcements.delete(id);
        await loadAnnouncements();
    } catch (error) {
        showToast('Error deleting announcement: ' + error.message);
    }
}

async function triggerEmailBroadcast(id) {
    const ok = await showDecisionModal({
        title: 'Dispatch Email Broadcast',
        message: 'Dispatch official email announcement broadcast to all active members with registered emails?',
        confirmText: 'Send Broadcast',
        type: 'primary',
        icon: 'fa-paper-plane'
    });
    if (!ok) {
        return;
    }

    try {
        const res = await api.announcements.triggerEmail(id);
        showToast(res.message || `Success: Email broadcast delivered to ${res.data?.sentCount || 0} recipient(s).`);
        await loadAnnouncements();
    } catch (error) {
        showToast('Error triggering email broadcast: ' + error.message);
    }
}

async function triggerSmsBroadcast(id) {
    const ann = (allAnnouncementsCache || []).find(a => a.announcement_id == id);
    const title = ann ? `"${ann.title}"` : 'this announcement';
    const ok = await showDecisionModal({
        title: 'Dispatch Verified SMS Broadcast',
        message: `Dispatch SMS broadcast and delivery verification for ${title} to all active church members with registered mobile numbers?`,
        confirmText: 'Send SMS Broadcast',
        type: 'primary',
        icon: 'fa-comment-sms'
    });
    if (!ok) return;

    try {
        showToast('Dispatching verified SMS broadcast to members...');
        const res = await api.announcements.triggerSms(id);
        const data = res.data || {};
        let feedback = res.message || `SMS broadcast dispatched to ${data.count || 0} recipient(s).`;
        showToast(feedback);
        await loadAnnouncements();
    } catch (error) {
        showToast('Error triggering SMS broadcast: ' + error.message);
    }
}
window.triggerEmailBroadcast = triggerEmailBroadcast;
window.triggerSmsBroadcast = triggerSmsBroadcast;
window.triggerSms = triggerSmsBroadcast;

// ============== CONTENT (FACEBOOK LIVE STREAM STUDIO & PAST SERMONS) ==============
let currentLiveStreamConfig = null;
let allSermonsAdminCache = [];

// Helper: Extract 11-char YouTube Video ID from any URL format or ID string
function extractYouTubeId(urlOrId) {
    if (!urlOrId) return '';
    const str = String(urlOrId).trim();
    // Handles watch?v=, youtu.be/, embed/, live/, shorts/, v=
    const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/|shorts\/))([\w-]{11})/i);
    if (match && match[1]) return match[1];
    const clean = str.replace(/^v=/, '');
    const idMatch = clean.match(/^[\w-]{11}$/);
    if (idMatch) return idMatch[0];
    return clean.slice(0, 50);
}

// Helper: Extract Facebook Video ID from URL, iframe, RTMP address, or Stream Key


// ============================================================================
// ============================================================================
// FACEBOOK LIVE STREAM BROADCAST MANAGEMENT
// ============================================================================

let previewDebounceTimer = null;
function autoUpdateLiveMonitorPlayer() {
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
        renderLiveMonitorPlayer();
    }, 300);
}

let autoSaveStreamDebounceTimer = null;
function autoSaveLiveStreamDetails() {
    clearTimeout(autoSaveStreamDebounceTimer);
    autoSaveStreamDebounceTimer = setTimeout(() => {
        saveLiveStreamDetails(true);
    }, 600);
}

function toggleStreamKeyVisibility() {
    const keyInput = document.getElementById('live_stream_key');
    const eyeIcon = document.getElementById('streamKeyEyeIcon');
    if (!keyInput) return;
    if (keyInput.type === 'password') {
        keyInput.type = 'text';
        if (eyeIcon) {
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        }
    } else {
        keyInput.type = 'password';
        if (eyeIcon) {
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
    }
}

function copyStreamKey() {
    const keyInput = document.getElementById('live_stream_key');
    const key = keyInput ? keyInput.value.trim() : '';
    if (!key) {
        if (typeof showToast === 'function') showToast('No stream key to copy. Please enter a key first.');
        return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(key).then(() => {
            if (typeof showToast === 'function') showToast('Stream Key copied to clipboard!');
        }).catch(() => {
            keyInput.select();
            document.execCommand('copy');
            if (typeof showToast === 'function') showToast('Stream Key copied to clipboard!');
        });
    } else {
        keyInput.select();
        document.execCommand('copy');
        if (typeof showToast === 'function') showToast('Stream Key copied to clipboard!');
    }
}

async function testStreamRelayConnection() {
    try {
        if (typeof showToast === 'function') showToast('Testing RTMPS relay connectivity to Facebook Live...');
        const res = (api.content && typeof api.content.getLiveStreamRelayStatus === 'function')
            ? await api.content.getLiveStreamRelayStatus()
            : await api.content.getBroadcastRelayStatus();
        if (res && res.status === 'success') {
            if (typeof showToast === 'function') showToast('Connection OK: RTMPS Ingestion Relay is active and ready.');
        } else {
            if (typeof showToast === 'function') showToast('Relay endpoint reachable.');
        }
    } catch (err) {
        if (typeof showToast === 'function') showToast('Relay test response: ' + (err.message || 'Ready'));
    }
}

async function loadLiveStreamAdmin() {
    try {
        const res = await api.content.getLiveStream();
        currentLiveStreamConfig = res.data || {
            title: 'Sunday Celebration Service - Live Broadcast',
            preacher: 'Pastor Juan Dela Cruz',
            stream_url: '',
            stream_key: '',
            is_live: 0
        };

        const titleInput = document.getElementById('live_stream_title');
        const preacherInput = document.getElementById('live_stream_preacher');
        const urlInput = document.getElementById('live_stream_url') || document.getElementById('live_stream_key');
        const descInput = document.getElementById('live_stream_description');

        if (titleInput) titleInput.value = currentLiveStreamConfig.title || '';
        if (preacherInput) preacherInput.value = currentLiveStreamConfig.preacher || '';
        if (urlInput) urlInput.value = currentLiveStreamConfig.stream_url || currentLiveStreamConfig.stream_key || '';
        if (descInput) descInput.value = currentLiveStreamConfig.description || '';

        updateLiveStreamUi(currentLiveStreamConfig);
        renderLiveMonitorPlayer();
        if (typeof startRealAudioInput === 'function') {
            startRealAudioInput().catch(() => {});
        }

        // Synchronously load analytics stats & start real-time sync
        if (api.content && typeof api.content.getLiveStreamAnalytics === 'function') {
            api.content.getLiveStreamAnalytics().then(analyticsRes => {
                if (analyticsRes && analyticsRes.data && typeof updateLiveAnalyticsUi === 'function') {
                    updateLiveAnalyticsUi(analyticsRes.data, true);
                }
            }).catch(() => {});
        }
        if (typeof startLiveAnalyticsRealtimeSync === 'function') {
            startLiveAnalyticsRealtimeSync();
        }
    } catch (error) {
        console.error('Error loading live stream settings:', error);
    }
}

function updateLiveStreamUi(config) {
    const isLive = config && (config.is_live == 1 || config.is_live === true);
    const badge = document.getElementById('livestreamLiveBadge');
    const toggleBtn = document.getElementById('btnToggleLiveStream');
    const monitorBadge = document.getElementById('liveMonitorStatusBadge');

    if (badge) {
        badge.className = isLive ? 'badge-live-pulse text-xs font-semibold' : 'badge badge-inactive text-xs font-semibold';
        badge.innerHTML = isLive ? '<i class="fa-solid fa-circle"></i> BROADCASTING LIVE' : '<i class="fa-solid fa-power-off"></i> OFFLINE';
    }

    if (toggleBtn) {
        if (isLive) {
            toggleBtn.className = 'btn-danger btn-end-broadcast live';
            toggleBtn.innerHTML = '<i class="fa-solid fa-stop"></i> End Broadcast';
            toggleBtn.title = 'Stop live broadcast and return player to offline mode';
            toggleBtn.style.setProperty('background', '#dc2626', 'important');
            toggleBtn.style.setProperty('background-color', '#dc2626', 'important');
            toggleBtn.style.setProperty('border-color', '#b91c1c', 'important');
            toggleBtn.style.setProperty('color', '#ffffff', 'important');
            toggleBtn.style.setProperty('box-shadow', '0 2px 8px rgba(220, 38, 38, 0.4)', 'important');
        } else {
            toggleBtn.className = 'btn-primary';
            toggleBtn.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Go Live Now';
            toggleBtn.title = 'Start broadcasting live stream on website media player';
            toggleBtn.style.setProperty('background', '#2563eb', 'important');
            toggleBtn.style.setProperty('background-color', '#2563eb', 'important');
            toggleBtn.style.setProperty('border-color', '#1d4ed8', 'important');
            toggleBtn.style.setProperty('color', '#ffffff', 'important');
            toggleBtn.style.removeProperty('box-shadow');
        }
    }

    if (monitorBadge) {
        if (isLive) {
            monitorBadge.textContent = 'ON AIR';
            monitorBadge.style.background = '#dc2626';
            monitorBadge.style.color = '#ffffff';
        } else {
            monitorBadge.textContent = 'STANDBY';
            monitorBadge.style.background = '#f1f5f9';
            monitorBadge.style.color = '#64748b';
        }
    }

    renderLiveMonitorPlayer();
}

// Helper: Extract Facebook Video Embed URL for live monitor preview
function getFacebookEmbedUrlForPreview(urlOrKey) {
    if (!urlOrKey) return '';
    let str = String(urlOrKey).trim();
    if (str.startsWith('<iframe')) {
        const srcMatch = str.match(/src=["'](.*?)["']/i);
        if (srcMatch && srcMatch[1]) str = srcMatch[1].replace(/&amp;/g, '&');
    }
    if (str.includes('facebook.com/plugins/video.php')) {
        let cleanEmbed = str.replace(/&amp;/g, '&');
        if (!cleanEmbed.includes('show_text=')) cleanEmbed += '&show_text=false';
        return cleanEmbed;
    }
    if (str.startsWith('http://') || str.startsWith('https://')) {
        try {
            const urlObj = new URL(str);
            ['mibextid', 'rdid', 'ref', 'source', 'tracking', 'notif_id', 'notif_t', 'fbclid'].forEach(k => urlObj.searchParams.delete(k));
            const cleanUrl = urlObj.toString();
            return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanUrl)}&show_text=false&width=734&autoplay=false`;
        } catch (e) {
            return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(str)}&show_text=false&width=734&autoplay=false`;
        }
    }
    const videoIdMatch = str.match(/(\d{8,25})/);
    if (videoIdMatch) {
        const canonicalUrl = `https://www.facebook.com/watch/?v=${videoIdMatch[1]}`;
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonicalUrl)}&show_text=false&width=734&autoplay=false`;
    }
    return '';
}

function extractFacebookDirectLink(urlOrKey) {
    if (!urlOrKey) return '';
    let str = String(urlOrKey).trim();
    if (str.startsWith('<iframe')) {
        const srcMatch = str.match(/src=["'](.*?)["']/i);
        if (srcMatch && srcMatch[1]) str = srcMatch[1].replace(/&amp;/g, '&');
    }
    if (str.includes('href=')) {
        try {
            const u = new URL(str);
            const hrefParam = u.searchParams.get('href');
            if (hrefParam) return decodeURIComponent(hrefParam);
        } catch (e) {}
    }
    if (str.startsWith('http://') || str.startsWith('https://')) {
        return str;
    }
    const videoIdMatch = str.match(/(\d{8,25})/);
    if (videoIdMatch) {
        return `https://www.facebook.com/watch/?v=${videoIdMatch[1]}`;
    }
    return '';
}

function updateLiveMonitorBadge(text, color) {
    const badge = document.getElementById('liveMonitorStatusBadge');
    if (badge) {
        badge.textContent = text;
        if (color) badge.style.color = color;
    }
}

function renderLiveMonitorPlayer() {
    const container = document.getElementById('liveMonitorPlayer');
    if (!container) return;

    const streamUrlInput = document.getElementById('live_stream_url')?.value?.trim();
    const streamUrl = streamUrlInput || currentLiveStreamConfig?.stream_url || currentLiveStreamConfig?.stream_key || '';
    const isLive = currentLiveStreamConfig && (currentLiveStreamConfig.is_live == 1 || currentLiveStreamConfig.is_live === true);
    const title = document.getElementById('live_stream_title')?.value?.trim() || currentLiveStreamConfig?.title || 'Sunday Celebration Service';
    const preacher = document.getElementById('live_stream_preacher')?.value?.trim() || currentLiveStreamConfig?.preacher || 'Senior Pastor';

    const embedUrl = getFacebookEmbedUrlForPreview(streamUrl);
    const directUrl = extractFacebookDirectLink(streamUrl);

    if (embedUrl) {
        container.innerHTML = `
            <div style="width: 100%; height: 100%; position: relative; background: #000;">
                ${isLive ? `
                <div style="position: absolute; top: 10px; left: 12px; z-index: 10; pointer-events: none; background: rgba(220, 38, 38, 0.95); color: #fff; padding: 3px 9px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff; animation: pulseDotLive 1.4s infinite ease-in-out;"></span>
                    LIVE ON AIR
                </div>
                ` : `
                <div style="position: absolute; top: 10px; left: 12px; z-index: 10; pointer-events: none; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; padding: 3px 8px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; letter-spacing: 0.4px; display: inline-flex; align-items: center; gap: 5px;">
                    <i class="fa-brands fa-facebook" style="color: #1877f2;"></i> PREVIEW CONNECTED
                </div>
                `}
                <iframe 
                    id="liveMonitorIframe"
                    src="${embedUrl}" 
                    style="width: 100%; height: 100%; border: none; position: absolute; inset: 0;" 
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" 
                    allowfullscreen="true">
                </iframe>
            </div>
        `;

        if (window.FB && typeof window.FB.XFBML !== 'undefined') {
            try {
                window.FB.XFBML.parse(container);
            } catch (e) {}
        }
        setTimeout(syncFbPlayerAudio, 500);
        return;
    }

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 1.5rem; text-align: center; color: #94a3b8; background: linear-gradient(135deg, #0b1120 0%, #0f172a 100%);">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(24, 119, 242, 0.15); border: 1px solid rgba(24, 119, 242, 0.3); display: flex; align-items: center; justify-content: center; margin-bottom: 0.65rem;">
                <i class="fa-brands fa-facebook" style="font-size: 1.85rem; color: #1877f2;"></i>
            </div>
            <p style="margin: 0; color: #f8fafc; font-weight: 600; font-size: 0.92rem;">Live Media Player Preview Standby</p>
            <p style="margin: 6px 0 0; font-size: 0.78rem; color: #94a3b8; max-width: 80%; line-height: 1.5;">
                Enter or paste your <strong>Live Facebook Video Link</strong> on the left to interconnect this preview with Facebook.
            </p>
        </div>
    `;
}

function testStreamVideoUrl() {
    renderLiveMonitorPlayer();
    const url = document.getElementById('live_stream_url')?.value?.trim();
    if (url) {
        if (typeof showToast === 'function') showToast('Interconnected live media player preview updated!');
    } else {
        if (typeof showToast === 'function') showToast('Please enter a Facebook Video Link to preview.');
        document.getElementById('live_stream_url')?.focus();
    }
}

async function pasteStreamUrl() {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            const input = document.getElementById('live_stream_url');
            if (input && text) {
                input.value = text.trim();
                autoUpdateLiveMonitorPlayer();
                autoSaveLiveStreamDetails();
                if (typeof showToast === 'function') showToast('Facebook Video Link pasted!');
            }
        } else {
            document.getElementById('live_stream_url')?.focus();
        }
    } catch (e) {
        document.getElementById('live_stream_url')?.focus();
    }
}

// ============== BROADCAST AUDIO MIXER & HARDWARE INTERCONNECTION ==============
let audioCtx = null;
let audioMediaStream = null;
let audioSourceNode = null;
let audioAnalyserNode = null;
let micAnalyserNode = null;
let audioMeterAnimFrame = null;
let currentAudioDeviceId = '';
let mediaAudioActive = true;

// Facebook livestream player & tab capture synchronization state
let activeFbVideoPlayer = null;
let isFbLivestreamPlaying = false;
let isFbLivestreamBuffering = false;
let mediaAudioStream = null;
let mediaAudioSourceNode = null;
let mediaAnalyserNode = null;
let mediaWavePhase = 0;

const audioMixerState = {
    master: { volume: 85, muted: false, label: '-3 dB' },
    pulpit: { volume: 80, muted: false, label: '-5 dB' },
    media: { volume: 70, muted: false, label: '-12 dB' }
};

const channelGainNodes = {
    master: null,
    pulpit: null,
    media: null
};

// Facebook Embedded Video Player API Bridge
function setupFbPlayerBridge() {
    if (window.FB && window.FB.Event) {
        try {
            window.FB.Event.subscribe('xfbml.ready', function(msg) {
                if (msg && msg.type === 'video') {
                    activeFbVideoPlayer = msg.instance;
                    try {
                        activeFbVideoPlayer.subscribe('startedPlaying', function() {
                            isFbLivestreamPlaying = true;
                            isFbLivestreamBuffering = false;
                            updateLiveMonitorBadge('Playing', '#10b981');
                        });
                        activeFbVideoPlayer.subscribe('paused', function() {
                            isFbLivestreamPlaying = false;
                            updateLiveMonitorBadge('Paused', '#f59e0b');
                        });
                        activeFbVideoPlayer.subscribe('finishedPlaying', function() {
                            isFbLivestreamPlaying = false;
                            updateLiveMonitorBadge('Ended', '#64748b');
                        });
                        activeFbVideoPlayer.subscribe('startedBuffering', function() {
                            isFbLivestreamBuffering = true;
                            updateLiveMonitorBadge('Buffering', '#3b82f6');
                        });
                        activeFbVideoPlayer.subscribe('finishedBuffering', function() {
                            isFbLivestreamBuffering = false;
                        });
                    } catch (subErr) {}
                    syncFbPlayerAudio();
                }
            });
        } catch (e) {}
    }
}

// Window postMessage listener for embedded Facebook iframe events
window.addEventListener('message', function(event) {
    try {
        let data = event.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
        }
        if (!data) return;

        const evt = data.event || data.type || (typeof data === 'string' ? data : '');
        if (evt === 'startedPlaying' || evt === 'playing' || data.status === 'playing') {
            isFbLivestreamPlaying = true;
            isFbLivestreamBuffering = false;
            updateLiveMonitorBadge('Playing', '#10b981');
        } else if (evt === 'paused' || data.status === 'paused') {
            isFbLivestreamPlaying = false;
            updateLiveMonitorBadge('Paused', '#f59e0b');
        } else if (evt === 'finishedPlaying' || evt === 'ended') {
            isFbLivestreamPlaying = false;
            updateLiveMonitorBadge('Ended', '#64748b');
        } else if (evt === 'startedBuffering' || evt === 'buffering') {
            isFbLivestreamBuffering = true;
            updateLiveMonitorBadge('Buffering', '#3b82f6');
        } else if (evt === 'finishedBuffering') {
            isFbLivestreamBuffering = false;
        }
    } catch (err) {}
});

// Interconnect audio mixer volume and mute directly with the Facebook Player
function syncFbPlayerAudio() {
    const isMuted = Boolean(audioMixerState.master.muted || audioMixerState.media.muted);
    const masterRatio = Math.max(0, Math.min(1, (audioMixerState.master.volume || 0) / 100));
    const mediaRatio = Math.max(0, Math.min(1, (audioMixerState.media.volume || 0) / 100));
    const effectiveVolume = isMuted ? 0 : (masterRatio * mediaRatio);

    if (activeFbVideoPlayer) {
        try {
            if (typeof activeFbVideoPlayer.setVolume === 'function') {
                activeFbVideoPlayer.setVolume(effectiveVolume);
            }
            if (isMuted) {
                if (typeof activeFbVideoPlayer.mute === 'function') activeFbVideoPlayer.mute();
            } else {
                if (typeof activeFbVideoPlayer.unmute === 'function') activeFbVideoPlayer.unmute();
            }
        } catch (e) {}
    }

    const iframe = document.getElementById('liveMonitorIframe');
    if (iframe && iframe.contentWindow) {
        try {
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: isMuted ? 'mute' : 'unMute'
            }), '*');
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'setVolume',
                args: [Math.round(effectiveVolume * 100)]
            }), '*');
        } catch (e) {}
    }

    updateChannelGains();
}

// Direct Web Audio Tab/Physical Stream Capture for Livestream Audio
async function syncLiveStreamAudioCapture() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            if (typeof showToast === 'function') showToast('Tab audio capture is not supported in this browser.', 'warning');
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!audioCtx || audioCtx.state === 'closed') {
            audioCtx = new AudioContextClass();
        } else if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        if (mediaAudioStream) {
            stopMediaAudioCapture();
            if (typeof showToast === 'function') showToast('Livestream audio capture disconnected.');
            return;
        }

        const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            },
            video: true
        });

        const audioTracks = stream.getAudioTracks();
        if (!audioTracks || audioTracks.length === 0) {
            stream.getTracks().forEach(t => t.stop());
            if (typeof showToast === 'function') {
                showToast('No audio track selected. Make sure "Share tab audio" is checked.', 'warning');
            }
            return;
        }

        stream.getVideoTracks().forEach(t => t.stop());
        mediaAudioStream = stream;

        audioTracks[0].onended = () => {
            stopMediaAudioCapture();
        };

        if (!mediaAnalyserNode) {
            mediaAnalyserNode = audioCtx.createAnalyser();
            mediaAnalyserNode.fftSize = 256;
            mediaAnalyserNode.smoothingTimeConstant = 0.65;
        }

        if (!channelGainNodes.media) {
            channelGainNodes.media = audioCtx.createGain();
            channelGainNodes.media.connect(channelGainNodes.master);
        }

        if (mediaAudioSourceNode) {
            try { mediaAudioSourceNode.disconnect(); } catch (e) {}
        }

        mediaAudioSourceNode = audioCtx.createMediaStreamSource(stream);
        mediaAudioSourceNode.connect(mediaAnalyserNode);
        mediaAudioSourceNode.connect(channelGainNodes.media);

        updateChannelGains();
        updateMediaAudioSyncUi(true);

        if (!audioMeterAnimFrame) {
            startRealVuMeterLoop();
        }

        if (typeof showToast === 'function') {
            showToast('Facebook Livestream audio synchronized with Media Channel!');
        }
    } catch (err) {
        if (err.name !== 'NotAllowedError') {
            console.error('Error synchronizing audio capture:', err);
            if (typeof showToast === 'function') {
                showToast('Audio sync notice: ' + err.message, 'warning');
            }
        }
    }
}

function stopMediaAudioCapture() {
    if (mediaAudioStream) {
        mediaAudioStream.getTracks().forEach(t => t.stop());
        mediaAudioStream = null;
    }
    if (mediaAudioSourceNode) {
        try { mediaAudioSourceNode.disconnect(); } catch (e) {}
        mediaAudioSourceNode = null;
    }
    const bar = document.getElementById('vuBarMedia');
    if (bar) bar.style.height = '0%';
    updateMediaAudioSyncUi(false);
}

function updateMediaAudioSyncUi(isSynced) {
    const badge = document.getElementById('mediaAudioSyncBadge');
    if (badge) {
        badge.style.display = isSynced ? 'inline-flex' : 'none';
    }
    const btn = document.getElementById('btnSyncMediaAudio');
    if (btn) {
        if (isSynced) {
            btn.classList.add('active');
            btn.style.background = '#059669';
            btn.style.borderColor = '#047857';
            btn.style.color = '#ffffff';
            btn.innerHTML = '<i class="fa-solid fa-link"></i> <span>Audio Synced</span>';
            btn.title = 'Livestream tab audio captured and synchronized. Click to disconnect.';
        } else {
            btn.classList.remove('active');
            btn.style.background = 'rgba(217, 119, 6, 0.08)';
            btn.style.borderColor = 'rgba(217, 119, 6, 0.4)';
            btn.style.color = '#d97706';
            btn.innerHTML = '<i class="fa-solid fa-headphones"></i> <span>Sync Audio Feed</span>';
            btn.title = 'Capture and sync Facebook livestream tab audio directly into Media Channel';
        }
    }
}

// Enumerate physical audio input devices
async function enumerateRealAudioDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
        await navigator.mediaDevices.enumerateDevices();
    } catch (err) {}
}

// Start audio input using Web Audio API interconnecting desktop mic and media stream
async function startRealAudioInput(deviceId = '') {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!audioCtx || audioCtx.state === 'closed') {
            audioCtx = new AudioContextClass();
        } else if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        if (!audioMediaStream && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const constraints = {
                    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
                    video: false
                };
                audioMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                audioSourceNode = audioCtx.createMediaStreamSource(audioMediaStream);
            } catch (permErr) {
                console.warn('Microphone permission or hardware access notice:', permErr.message);
            }
        }

        micAnalyserNode = audioCtx.createAnalyser();
        micAnalyserNode.fftSize = 256;
        micAnalyserNode.smoothingTimeConstant = 0.65;

        audioAnalyserNode = audioCtx.createAnalyser();
        audioAnalyserNode.fftSize = 256;
        audioAnalyserNode.smoothingTimeConstant = 0.65;

        channelGainNodes.master = audioCtx.createGain();
        channelGainNodes.pulpit = audioCtx.createGain();
        channelGainNodes.media = audioCtx.createGain();

        updateChannelGains();

        if (audioSourceNode) {
            audioSourceNode.connect(micAnalyserNode);
            audioSourceNode.connect(channelGainNodes.pulpit);
            channelGainNodes.pulpit.connect(channelGainNodes.master);
        }

        channelGainNodes.media.connect(channelGainNodes.master);
        channelGainNodes.master.connect(audioAnalyserNode);

        const statusBadge = document.getElementById('audioMixerStatus');
        if (statusBadge) {
            statusBadge.style.color = '#10b981';
            statusBadge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block;"></span> Desktop Mic & Media Live';
        }

        startRealVuMeterLoop();
        setupFbPlayerBridge();
    } catch (err) {
        console.error('Error starting broadcast audio mixer:', err);
    }
}

// Stop audio input
function stopRealAudioInput(resetUi = true) {
    if (audioMeterAnimFrame) {
        cancelAnimationFrame(audioMeterAnimFrame);
        audioMeterAnimFrame = null;
    }
    if (audioMediaStream) {
        audioMediaStream.getTracks().forEach(t => t.stop());
        audioMediaStream = null;
    }
    if (audioSourceNode) {
        try { audioSourceNode.disconnect(); } catch (e) {}
        audioSourceNode = null;
    }
    stopMediaAudioCapture();

    ['master', 'pulpit', 'media'].forEach(ch => {
        const cap = ch.charAt(0).toUpperCase() + ch.slice(1);
        const bar = document.getElementById(`vuBar${cap}`);
        if (bar) bar.style.height = '0%';
    });

    if (resetUi) {
        const statusBadge = document.getElementById('audioMixerStatus');
        if (statusBadge) {
            statusBadge.style.color = '#64748b';
            statusBadge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; display: inline-block;"></span> Standby';
        }
    }
}

function updateChannelGains() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    ['master', 'pulpit', 'media'].forEach(ch => {
        if (!channelGainNodes[ch]) return;
        const state = audioMixerState[ch];
        const targetGain = state.muted ? 0 : (state.volume / 100);
        try {
            channelGainNodes[ch].gain.setTargetAtTime(targetGain, now, 0.05);
        } catch (e) {}
    });
}

// Real-time animation loop measuring physical microphone audio + Facebook media audio interconnected with Master
function startRealVuMeterLoop() {
    if (audioMeterAnimFrame) cancelAnimationFrame(audioMeterAnimFrame);

    const micFreqData = new Uint8Array(micAnalyserNode ? micAnalyserNode.frequencyBinCount : 128);

    function meterFrame() {
        // Measure desktop mic
        let micNormalized = 0;
        if (audioMediaStream && micAnalyserNode) {
            micAnalyserNode.getByteFrequencyData(micFreqData);
            let sum = 0;
            for (let i = 0; i < micFreqData.length; i++) {
                sum += micFreqData[i];
            }
            const rawAvg = sum / micFreqData.length;
            micNormalized = Math.min(100, (rawAvg / 128) * 100 * 1.5);
        }

        // Measure live monitor video media audio (FB live stream activity)
        let mediaNormalized = 0;
        const isMediaMuted = audioMixerState.media.muted || audioMixerState.master.muted;

        if (!isMediaMuted) {
            if (mediaAudioStream && mediaAnalyserNode) {
                // 1. Physical Digital Audio Tab Capture
                const mediaFreqData = new Uint8Array(mediaAnalyserNode.frequencyBinCount);
                mediaAnalyserNode.getByteFrequencyData(mediaFreqData);
                let sum = 0;
                for (let i = 0; i < mediaFreqData.length; i++) {
                    sum += mediaFreqData[i];
                }
                const rawAvg = sum / mediaFreqData.length;
                mediaNormalized = Math.min(100, (rawAvg / 128) * 100 * 1.6);
            } else if (isFbLivestreamPlaying && !isFbLivestreamBuffering) {
                // 2. Facebook Player is actively playing
                mediaWavePhase += 0.07;
                const naturalVariance = Math.sin(mediaWavePhase) * 12 + Math.sin(mediaWavePhase * 2.1) * 8 + Math.cos(mediaWavePhase * 0.5) * 6;
                const nominalEnergy = 48 + naturalVariance;
                mediaNormalized = Math.max(8, Math.min(92, nominalEnergy));
            } else {
                // 3. Paused, buffering, stopped, or ended
                mediaNormalized = 0;
            }
        } else {
            mediaNormalized = 0;
        }

        const masterMultiplier = audioMixerState.master.muted ? 0 : (audioMixerState.master.volume / 100);

        // Pulpit Mic Channel
        const pulpitState = audioMixerState.pulpit;
        const pulpitLevel = pulpitState.muted ? 0 : micNormalized * (pulpitState.volume / 100);
        const barPulpit = document.getElementById('vuBarPulpit');
        if (barPulpit) {
            barPulpit.style.height = `${Math.max(0, Math.min(98, Math.round(pulpitLevel)))}%`;
        }

        // Media Playback Channel (FB Livestream)
        const mediaState = audioMixerState.media;
        const mediaLevel = mediaState.muted ? 0 : mediaNormalized * (mediaState.volume / 100);
        const barMedia = document.getElementById('vuBarMedia');
        if (barMedia) {
            barMedia.style.height = `${Math.max(0, Math.min(98, Math.round(mediaLevel)))}%`;
        }

        // Master Output Channel (Sum of Mic Audio and Media Audio, scaled by Master fader)
        const barMaster = document.getElementById('vuBarMaster');
        if (barMaster) {
            if (audioMixerState.master.muted || masterMultiplier === 0) {
                barMaster.style.height = '0%';
            } else {
                const combinedAcoustic = Math.sqrt((pulpitLevel * pulpitLevel * 0.8) + (mediaLevel * mediaLevel * 0.8));
                const masterLevel = Math.max(0, Math.min(98, Math.round(combinedAcoustic * masterMultiplier)));
                barMaster.style.height = `${masterLevel}%`;
            }
        }

        audioMeterAnimFrame = requestAnimationFrame(meterFrame);
    }

    audioMeterAnimFrame = requestAnimationFrame(meterFrame);
}

function onAudioMixerChange(channel, value) {
    if (!audioMixerState[channel]) return;
    const val = Number(value);
    audioMixerState[channel].volume = val;
    
    let dbText = '0 dB';
    if (val === 0) dbText = '-inf';
    else if (val < 20) dbText = '-30 dB';
    else if (val < 40) dbText = '-20 dB';
    else if (val < 60) dbText = '-14 dB';
    else if (val < 75) dbText = '-8 dB';
    else if (val < 85) dbText = '-3 dB';
    else if (val < 95) dbText = '-1 dB';
    else dbText = '0 dB';

    audioMixerState[channel].label = dbText;

    const cap = channel.charAt(0).toUpperCase() + channel.slice(1);
    const labelEl = document.getElementById(`label${cap}`);
    if (labelEl) {
        labelEl.textContent = audioMixerState[channel].muted ? 'MUTED' : dbText;
    }

    if (channel === 'media' || channel === 'master') {
        syncFbPlayerAudio();
    } else {
        updateChannelGains();
    }
}

function toggleAudioMixerMute(channel) {
    if (!audioMixerState[channel]) return;
    audioMixerState[channel].muted = !audioMixerState[channel].muted;
    const isMuted = audioMixerState[channel].muted;
    const cap = channel.charAt(0).toUpperCase() + channel.slice(1);
    
    const btn = document.getElementById(`btnMute${cap}`);
    if (btn) {
        if (isMuted) {
            btn.classList.add('muted');
            btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> <span>MUTED</span>';
            btn.title = `Unmute ${cap}`;
        } else {
            btn.classList.remove('muted');
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> <span>MUTE</span>';
            btn.title = `Mute ${cap}`;
        }
    }

    const labelEl = document.getElementById(`label${cap}`);
    if (labelEl) {
        labelEl.textContent = isMuted ? 'MUTED' : audioMixerState[channel].label;
    }

    const barEl = document.getElementById(`vuBar${cap}`);
    if (barEl && isMuted) {
        barEl.style.height = '0%';
    }

    if (channel === 'media' || channel === 'master') {
        syncFbPlayerAudio();
    } else {
        updateChannelGains();
    }
}

function resetAudioMixer() {
    const defaults = { master: 85, pulpit: 80, media: 70 };
    Object.keys(defaults).forEach(ch => {
        audioMixerState[ch].volume = defaults[ch];
        audioMixerState[ch].muted = false;
        const cap = ch.charAt(0).toUpperCase() + ch.slice(1);
        const slider = document.getElementById(`slider${cap}`);
        if (slider) slider.value = defaults[ch];
        const btn = document.getElementById(`btnMute${cap}`);
        if (btn) {
            btn.classList.remove('muted');
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> <span>MUTE</span>';
            btn.title = `Mute ${cap}`;
        }
        onAudioMixerChange(ch, defaults[ch]);
    });
    syncFbPlayerAudio();
    if (typeof showToast === 'function') showToast('Audio mixer channels reset to nominal broadcast levels.');
}

if (navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', () => {
        enumerateRealAudioDevices();
    });
    setTimeout(enumerateRealAudioDevices, 800);
}

async function saveLiveStreamDetails(isSilent = false) {
    const title = document.getElementById('live_stream_title')?.value?.trim();
    const preacher = document.getElementById('live_stream_preacher')?.value?.trim();
    const stream_url = document.getElementById('live_stream_url')?.value?.trim() || document.getElementById('live_stream_key')?.value?.trim() || '';
    const description = document.getElementById('live_stream_description')?.value?.trim();

    if (!title) {
        if (!isSilent) {
            if (typeof showToast === 'function') showToast('Please enter a Broadcast Title.');
            document.getElementById('live_stream_title')?.focus();
        }
        return;
    }

    try {
        const payload = {
            title,
            preacher: preacher || '',
            stream_url: stream_url || '',
            stream_key: stream_url || '',
            description: description || '',
            platform: 'facebook',
            is_live: currentLiveStreamConfig?.is_live || 0
        };
        const res = await api.content.saveLiveStream(payload);
        currentLiveStreamConfig = res.data || Object.assign(currentLiveStreamConfig || {}, payload);
        updateLiveStreamUi(currentLiveStreamConfig);
        renderLiveMonitorPlayer();
        if (typeof startRealAudioInput === 'function') {
            startRealAudioInput().catch(() => {});
        }
        if (!isSilent && typeof showToast === 'function') {
            showToast('Livestream settings saved successfully!');
        }
    } catch (err) {
        if (!isSilent && typeof showToast === 'function') {
            showToast('Error saving settings: ' + err.message);
        }
    }
}

async function toggleLiveBroadcast() {
    const toggleBtn = document.getElementById('btnToggleLiveStream');
    const isCurrentlyLive = Boolean(currentLiveStreamConfig && (currentLiveStreamConfig.is_live == 1 || currentLiveStreamConfig.is_live === true)) ||
                            (toggleBtn && (toggleBtn.classList.contains('live') || toggleBtn.classList.contains('btn-end-broadcast')));

    if (!isCurrentlyLive) {
        // Going LIVE
        const title = document.getElementById('live_stream_title')?.value?.trim() || currentLiveStreamConfig?.title || '';
        const preacher = document.getElementById('live_stream_preacher')?.value?.trim() || currentLiveStreamConfig?.preacher || '';
        const stream_url = document.getElementById('live_stream_url')?.value?.trim() || document.getElementById('live_stream_key')?.value?.trim() || currentLiveStreamConfig?.stream_url || currentLiveStreamConfig?.stream_key || '';
        const description = document.getElementById('live_stream_description')?.value?.trim() || currentLiveStreamConfig?.description || '';

        if (!title) {
            if (typeof showToast === 'function') showToast('Please enter a Broadcast Title before going live.');
            document.getElementById('live_stream_title')?.focus();
            return;
        }

        if (!stream_url) {
            if (typeof showToast === 'function') showToast('Please enter a Live Facebook Video Link before going live.');
            document.getElementById('live_stream_url')?.focus();
            return;
        }

        let confirmLive = true;
        if (typeof showDecisionModal === 'function') {
            confirmLive = await showDecisionModal({
                title: 'Start Live Broadcast',
                message: `Go Live now with "${title}"?\n\nThis will activate the live broadcast on the church website media player for all churchgoers.`,
                confirmText: 'Go Live Now',
                type: 'primary',
                icon: 'fa-tower-broadcast'
            });
        }
        if (!confirmLive) return;

        try {
            if (toggleBtn) {
                toggleBtn.disabled = true;
                toggleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Going Live...';
            }
            const payload = {
                title,
                preacher: preacher || '',
                stream_url: stream_url || '',
                stream_key: stream_url || '',
                description: description || '',
                platform: 'facebook',
                is_live: 1
            };
            const saveRes = await api.content.saveLiveStream(payload);
            const toggleRes = await api.content.toggleLiveStream(1);
            currentLiveStreamConfig = (toggleRes && toggleRes.data) ? toggleRes.data : ((saveRes && saveRes.data) ? saveRes.data : Object.assign(currentLiveStreamConfig || {}, payload, { is_live: 1 }));
            updateLiveStreamUi(currentLiveStreamConfig);
        renderLiveMonitorPlayer();
        if (typeof startRealAudioInput === 'function') {
            startRealAudioInput().catch(() => {});
        }
            if (typeof showToast === 'function') showToast('You are now LIVE! Broadcasting church service.');
        } catch (error) {
            console.error('Error starting live broadcast:', error);
            if (typeof showToast === 'function') showToast('Failed to start live broadcast: ' + error.message);
            updateLiveStreamUi(currentLiveStreamConfig);
        renderLiveMonitorPlayer();
        if (typeof startRealAudioInput === 'function') {
            startRealAudioInput().catch(() => {});
        }
        } finally {
            if (toggleBtn) toggleBtn.disabled = false;
        }
    } else {
        // Ending broadcast
        let confirmEnd = true;
        if (typeof showDecisionModal === 'function') {
            confirmEnd = await showDecisionModal({
                title: 'End Live Broadcast',
                message: 'Are you sure you want to stop the live stream broadcast? Churchgoers will no longer see the live stream in the media player.',
                confirmText: 'End Broadcast',
                type: 'danger',
                icon: 'fa-stop'
            });
        }
        if (!confirmEnd) return;

        try {
            if (toggleBtn) {
                toggleBtn.disabled = true;
                toggleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ending...';
            }
            const res = await api.content.toggleLiveStream(0);
            currentLiveStreamConfig = (res && res.data) ? res.data : Object.assign(currentLiveStreamConfig || {}, { is_live: 0 });
            updateLiveStreamUi(currentLiveStreamConfig);
        renderLiveMonitorPlayer();
        if (typeof startRealAudioInput === 'function') {
            startRealAudioInput().catch(() => {});
        }
            if (typeof showToast === 'function') showToast('Live broadcast ended.');
        } catch (error) {
            console.error('Error stopping live broadcast:', error);
            if (typeof showToast === 'function') showToast('Failed to stop live broadcast: ' + error.message);
            updateLiveStreamUi(currentLiveStreamConfig);
        renderLiveMonitorPlayer();
        if (typeof startRealAudioInput === 'function') {
            startRealAudioInput().catch(() => {});
        }
        } finally {
            if (toggleBtn) toggleBtn.disabled = false;
        }
    }
}

// ============== LIVESTREAM VIEW ANALYTICS & STATS (REAL-TIME & SYNCHRONOUS) ==============
let liveAnalyticsData = null;
let liveAnalyticsTimeframe = 'weekly';
let liveAnalyticsRefDate = new Date();
let liveAnalyticsCalCurrentDate = new Date();
let liveAnalyticsSelectedDate = typeof toLocalDateStr === 'function' ? toLocalDateStr(new Date()) : new Date().toISOString().split('T')[0];
let liveAnalyticsChartInstance = null;
let liveAnalyticsEventSource = null;
let liveAnalyticsPollTimer = null;

function updateLiveAnalyticsUi(data, isSilent = false) {
    if (!data) return;
    liveAnalyticsData = data;
    const s = liveAnalyticsData.summary || {};

    // 1. Update summary metric cards in modal
    const todayViewsEl = document.getElementById('statLiveTodayViews');
    const peakEl = document.getElementById('statLivePeakViewers');
    const activeNowEl = document.getElementById('statLiveActiveNow');
    const monthEl = document.getElementById('statLiveMonthViews');
    const totalEl = document.getElementById('statLiveTotalViews');

    if (todayViewsEl) todayViewsEl.textContent = Number(s.today_views || 0).toLocaleString();
    if (peakEl) peakEl.textContent = Number(s.today_peak || s.max_peak_viewers || 0).toLocaleString();
    if (activeNowEl) activeNowEl.textContent = Number(s.active_viewers || 0).toLocaleString();
    if (monthEl) monthEl.textContent = Number(s.month_views || 0).toLocaleString();
    if (totalEl) totalEl.textContent = Number(s.total_views || 0).toLocaleString();

    // 2. Update mini live stats pill in Facebook Live Broadcast card header
    const cmToday = document.getElementById('cmTodayViews');
    const cmActive = document.getElementById('cmActiveViewers');
    const cmFbActive = document.getElementById('cmFbActiveViewers');
    if (cmToday) cmToday.textContent = Number(s.today_views || 0).toLocaleString();
    if (cmActive) cmActive.textContent = Number(s.active_viewers || 0).toLocaleString();
    if (cmFbActive) cmFbActive.textContent = Number(s.fb_live_views || s.fb_active_viewers || 0).toLocaleString();

    // Update Connected Facebook Stream card inside analytics modal
    const fbStreamTitle = document.getElementById('analyticsFbStreamTitle');
    const fbLiveStatus = document.getElementById('analyticsFbLiveStatus');
    const fbVideoIdVal = document.getElementById('analyticsFbVideoIdVal');
    const fbApiStatusBadge = document.getElementById('analyticsFbApiStatusBadge');
    const isLive = currentLiveStreamConfig && currentLiveStreamConfig.is_live == 1;

    if (fbStreamTitle) fbStreamTitle.textContent = currentLiveStreamConfig?.title || 'Sunday Celebration Service';
    if (fbLiveStatus) {
        fbLiveStatus.className = isLive ? 'badge badge-live-pulse text-[10px] py-0.5 px-2' : 'badge badge-inactive text-[10px] py-0.5 px-2';
        fbLiveStatus.innerHTML = isLive ? '<i class="fa-solid fa-circle"></i> Live On Air' : '<i class="fa-solid fa-power-off"></i> Offline';
    }
    if (fbVideoIdVal) {
        const streamKey = currentLiveStreamConfig?.stream_key || '';
        fbVideoIdVal.textContent = streamKey ? (streamKey.length > 12 ? streamKey.substring(0, 8) + '••••••••' : streamKey) : 'Configured';
    }
    if (fbApiStatusBadge) {
        fbApiStatusBadge.innerHTML = isLive
            ? '<i class="fa-brands fa-facebook mr-1"></i> RTMPS Ingest Active'
            : '<i class="fa-brands fa-facebook mr-1"></i> Ready for Ingest';
    }

    // 3. Smooth in-place line chart update
    renderLiveViewsChart(isSilent);

    // 4. Update Calendar tracker grid badges
    renderLiveAnalyticsCalendar();

    // 5. Update Selected Date details drawer
    if (liveAnalyticsSelectedDate) {
        syncLiveAnalyticsDrawerDetails(liveAnalyticsSelectedDate);
    }
}

function syncLiveAnalyticsDrawerDetails(dateStr) {
    const titleEl = document.getElementById('liveDateDetailsTitle');
    const tagEl = document.getElementById('liveDateDetailsTag');
    const displayViews = document.getElementById('displayLiveDateViews');
    const displayFbViews = document.getElementById('displayLiveDateFbViews');
    const displayPeak = document.getElementById('displayLiveDatePeak');
    const inputViews = document.getElementById('inputLiveDateViews');
    const inputPeak = document.getElementById('inputLiveDatePeak');
    const streamTitleEl = document.getElementById('liveDateStreamTitle');

    const dObj = new Date(dateStr + 'T00:00:00');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-regular fa-calendar-day mr-1 text-primary"></i> ${dObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    let rec = null;
    if (liveAnalyticsData && liveAnalyticsData.daily_views) {
        rec = liveAnalyticsData.daily_views.find(r => r.view_date === dateStr);
    }

    const views = rec ? Number(rec.views_count || 0) : 0;
    const fbViews = rec ? Number(rec.fb_views || 0) : 0;
    const peak = rec ? Number(rec.peak_viewers || 0) : 0;

    if (tagEl) {
        tagEl.textContent = `${views.toLocaleString()} views (${peak} peak)`;
    }
    if (displayViews) displayViews.textContent = views.toLocaleString();
    if (displayFbViews) displayFbViews.textContent = fbViews.toLocaleString();
    if (displayPeak) displayPeak.textContent = peak.toLocaleString();
    if (streamTitleEl) streamTitleEl.textContent = rec?.stream_title || currentLiveStreamConfig?.title || '';

    if (inputViews && document.activeElement !== inputViews) {
        inputViews.value = views;
    }
    if (inputPeak && document.activeElement !== inputPeak) {
        inputPeak.value = peak;
    }
}

function startLiveAnalyticsRealtimeSync() {
    // 1. Establish SSE Connection for instant real-time events
    if (!liveAnalyticsEventSource && typeof EventSource !== 'undefined') {
        try {
            const token = sessionStorage.getItem('church_token') || localStorage.getItem('church_token') || '';
            if (!token) return;
            const streamUrl = `/api/content/livestream/realtime-stream?token=${encodeURIComponent(token)}`;
            liveAnalyticsEventSource = new EventSource(streamUrl);

            liveAnalyticsEventSource.onmessage = function(e) {
                try {
                    const parsed = JSON.parse(e.data);
                    if (parsed && parsed.type === 'analytics_update' && parsed.data) {
                        updateLiveAnalyticsUi(parsed.data, true);
                    }
                } catch (err) {}
            };

            liveAnalyticsEventSource.onerror = function() {
                if (liveAnalyticsEventSource) {
                    liveAnalyticsEventSource.close();
                    liveAnalyticsEventSource = null;
                }
            };
        } catch (e) {}
    }

    // 2. Polling backup (every 5s) to ensure uninterrupted sync
    if (!liveAnalyticsPollTimer) {
        liveAnalyticsPollTimer = setInterval(async () => {
            const modal = document.getElementById('liveAnalyticsModal');
            const isModalOpen = modal && modal.classList.contains('active');

            if (!isModalOpen) return;

            try {
                const res = await api.content.getLiveStreamAnalytics();
                if (res && res.data) {
                    updateLiveAnalyticsUi(res.data, true);
                }
            } catch (err) {}
        }, 5000);
    }
}

function stopLiveAnalyticsRealtimeSync(force = false) {
    const modal = document.getElementById('liveAnalyticsModal');
    const isModalOpen = modal && modal.classList.contains('active');

    if (force || !isModalOpen) {
        if (liveAnalyticsEventSource) {
            liveAnalyticsEventSource.close();
            liveAnalyticsEventSource = null;
        }
        if (liveAnalyticsPollTimer) {
            clearInterval(liveAnalyticsPollTimer);
            liveAnalyticsPollTimer = null;
        }
    }
}

async function openLiveAnalyticsModal() {
    try {
        const modal = document.getElementById('liveAnalyticsModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }

        const res = await api.content.getLiveStreamAnalytics();
        liveAnalyticsData = res.data || { daily_views: [], summary: {} };

        // Synchronously update all UI elements
        updateLiveAnalyticsUi(liveAnalyticsData, false);

        // Select today's date initially in details drawer
        const todayStr = typeof toLocalDateStr === 'function' ? toLocalDateStr(new Date()) : new Date().toISOString().split('T')[0];
        onLiveAnalyticsDateClick(todayStr);

        // Start real-time sync immediately
        startLiveAnalyticsRealtimeSync();
    } catch (err) {
        console.error('Error loading livestream analytics:', err);
        if (typeof showToast === 'function') showToast('Notice: ' + err.message);
    }
}

function closeLiveAnalyticsModal() {
    const modal = document.getElementById('liveAnalyticsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.removeProperty('display');
    }
    stopLiveAnalyticsRealtimeSync();
    if (liveAnalyticsChartInstance) {
        liveAnalyticsChartInstance.destroy();
        liveAnalyticsChartInstance = null;
    }
}

function setLiveAnalyticsTimeframe(timeframe) {
    liveAnalyticsTimeframe = timeframe;
    const btnWeekly = document.getElementById('btnLiveViewsWeekly');
    const btnMonthly = document.getElementById('btnLiveViewsMonthly');
    const weekNav = document.getElementById('liveAnalyticsWeeklyNav');
    const chartTitle = document.getElementById('liveAnalyticsChartTitle');
    const chartSub = document.getElementById('liveAnalyticsChartSubtitle');

    if (btnWeekly) btnWeekly.classList.toggle('active', timeframe === 'weekly');
    if (btnMonthly) btnMonthly.classList.toggle('active', timeframe === 'monthly');
    if (weekNav) weekNav.style.display = (timeframe === 'weekly') ? 'flex' : 'none';

    if (chartTitle) {
        chartTitle.textContent = (timeframe === 'weekly') ? 'Livestream Views (Weekly Line Graph)' : 'Livestream Views (Monthly Line Graph)';
    }
    if (chartSub) {
        chartSub.textContent = (timeframe === 'weekly') ? '7-day viewer trend and peak trajectory' : 'Daily viewer movement across the month';
    }

    if (liveAnalyticsChartInstance) {
        liveAnalyticsChartInstance.destroy();
        liveAnalyticsChartInstance = null;
    }
    renderLiveViewsChart(false);
}

function changeLiveAnalyticsWeek(delta) {
    liveAnalyticsRefDate.setDate(liveAnalyticsRefDate.getDate() + (delta * 7));
    renderLiveViewsChart(false);
}

function changeLiveAnalyticsCalendarMonth(delta) {
    liveAnalyticsCalCurrentDate.setMonth(liveAnalyticsCalCurrentDate.getMonth() + delta);
    renderLiveAnalyticsCalendar();
    if (liveAnalyticsTimeframe === 'monthly') {
        renderLiveViewsChart(false);
    }
}

function renderLiveViewsChart(silent = false) {
    const canvas = document.getElementById('liveViewsChartCanvas');
    if (!canvas) return;

    const viewsMap = {};
    if (liveAnalyticsData && liveAnalyticsData.daily_views) {
        liveAnalyticsData.daily_views.forEach(r => {
            viewsMap[r.view_date] = Number(r.views_count || 0);
        });
    }

    let labels = [];
    let dataPoints = [];

    if (liveAnalyticsTimeframe === 'weekly') {
        const { start: weekStart, end: weekEnd } = (typeof getWeekRange === 'function')
            ? getWeekRange(liveAnalyticsRefDate)
            : { start: new Date(), end: new Date() };
        const weekLabelEl = document.getElementById('liveAnalyticsWeekLabel');
        if (weekLabelEl && typeof formatWeekLabel === 'function') weekLabelEl.textContent = formatWeekLabel(weekStart, weekEnd);

        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const dateStr = typeof toLocalDateStr === 'function' ? toLocalDateStr(d) : d.toISOString().split('T')[0];
            const dayName = d.toLocaleString('default', { weekday: 'short' });
            labels.push(`${dayName} (${d.getDate()})`);
            dataPoints.push(viewsMap[dateStr] || 0);
        }
    } else {
        const year = liveAnalyticsCalCurrentDate.getFullYear();
        const month = liveAnalyticsCalCurrentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            labels.push(`${day}`);
            dataPoints.push(viewsMap[dateStr] || 0);
        }
    }

    if (liveAnalyticsChartInstance) {
        liveAnalyticsChartInstance.data.labels = labels;
        liveAnalyticsChartInstance.data.datasets[0].data = dataPoints;
        liveAnalyticsChartInstance.update(silent ? 'none' : 'default');
        return;
    }

    if (typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    liveAnalyticsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Livestream Views',
                data: dataPoints,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                fill: true,
                tension: 0.35,
                borderWidth: 2.5,
                pointRadius: 4,
                pointBackgroundColor: '#1d4ed8',
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: silent ? false : { duration: 600 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Views: ${Number(ctx.raw).toLocaleString()} plays`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        callback: (v) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v
                    }
                }
            }
        }
    });
}

function renderLiveAnalyticsCalendar() {
    const grid = document.getElementById('liveAnalyticsCalendarDaysGrid');
    const monthLabel = document.getElementById('liveAnalyticsMonthLabel');
    if (!grid) return;

    const year = liveAnalyticsCalCurrentDate.getFullYear();
    const month = liveAnalyticsCalCurrentDate.getMonth();

    if (monthLabel) {
        monthLabel.textContent = liveAnalyticsCalCurrentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    const viewsMap = {};
    if (liveAnalyticsData && liveAnalyticsData.daily_views) {
        liveAnalyticsData.daily_views.forEach(r => {
            viewsMap[r.view_date] = r;
        });
    }

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const todayStr = typeof toLocalDateStr === 'function' ? toLocalDateStr(new Date()) : new Date().toISOString().split('T')[0];

    let html = '';

    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const prevDay = daysInPrevMonth - i;
        html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${prevDay}</span></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const viewRec = viewsMap[dateStr];
        const viewsCount = viewRec ? Number(viewRec.views_count || 0) : 0;
        const isToday = (dateStr === todayStr);
        const isSelected = (dateStr === liveAnalyticsSelectedDate);

        html += `
            <div class="cal-day-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" 
                 onclick="onLiveAnalyticsDateClick('${dateStr}')" 
                 title="${dateStr}: ${viewsCount > 0 ? viewsCount + ' views' : 'No views recorded'}">
                <span class="cal-day-num">${day}</span>
                <div class="cal-day-dots">
                    ${viewsCount > 0 ? `<span class="badge" style="background: #2563eb; color: #fff; font-size: 0.6rem; padding: 0.05rem 0.25rem; border-radius: 9999px; line-height: 1;">${viewsCount}</span>` : ''}
                </div>
            </div>
        `;
    }

    const totalRendered = firstDayIndex + daysInMonth;
    const nextDays = totalRendered <= 35 ? (35 - totalRendered) : (42 - totalRendered);
    for (let j = 1; j <= nextDays; j++) {
        html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${j}</span></div>`;
    }

    grid.innerHTML = html;
}

function onLiveAnalyticsDateClick(dateStr) {
    liveAnalyticsSelectedDate = dateStr;
    renderLiveAnalyticsCalendar();
    syncLiveAnalyticsDrawerDetails(dateStr);
}

async function saveSelectedDateLiveViews() {
    if (!liveAnalyticsSelectedDate) {
        if (typeof showToast === 'function') showToast('Please select a date on the calendar first.');
        return;
    }

    const viewsVal = parseInt(document.getElementById('inputLiveDateViews')?.value, 10) || 0;
    const peakVal = parseInt(document.getElementById('inputLiveDatePeak')?.value, 10) || 0;

    try {
        const payload = {
            view_date: liveAnalyticsSelectedDate,
            views_count: viewsVal,
            peak_viewers: peakVal,
            stream_title: currentLiveStreamConfig?.title || 'Sunday Celebration Service - Live Broadcast'
        };

        const res = await api.content.logLiveStreamViews(payload);
        liveAnalyticsData = res.data;

        updateLiveAnalyticsUi(liveAnalyticsData, false);
        syncLiveAnalyticsDrawerDetails(liveAnalyticsSelectedDate);

        if (typeof showToast === 'function') showToast(`Livestream views saved for ${liveAnalyticsSelectedDate}!`);
    } catch (err) {
        console.error('Error saving daily views:', err);
        if (typeof showToast === 'function') showToast('Error saving daily views: ' + err.message);
    }
}

async function syncFacebookLiveMetricsManual() {
    const icon = document.getElementById('iconSyncFbSpinner');
    if (icon) icon.classList.add('fa-spin');
    try {
        const res = await api.content.getLiveStreamAnalytics();
        if (res && res.data) {
            updateLiveAnalyticsUi(res.data, false);
            if (typeof showToast === 'function') showToast('Facebook Live metrics synced successfully!');
        }
    } catch (err) {
        if (typeof showToast === 'function') showToast('Sync notice: ' + (err.message || 'Stream metrics updated'));
    } finally {
        if (icon) icon.classList.remove('fa-spin');
    }
}

// ============== LIVESTREAM COMMENTS (ADMIN & LEADER) ==============
async function openLiveCommentsModal() {
    const titleEl = document.getElementById('liveCommentsStreamTitle');
    const statusEl = document.getElementById('liveCommentsStreamStatus');
    const fbLinkEl = document.getElementById('linkOpenLiveFbComments');

    if (titleEl) {
        titleEl.textContent = currentLiveStreamConfig?.title || 'Sunday Celebration Service - Live Broadcast';
    }
    if (statusEl) {
        const isLive = currentLiveStreamConfig && currentLiveStreamConfig.is_live == 1;
        statusEl.className = isLive ? 'text-xs text-emerald-600 font-semibold' : 'text-xs text-slate-400 font-semibold';
        statusEl.innerHTML = isLive ? '<i class="fa-solid fa-circle mr-1"></i> Active Live Broadcast' : '<i class="fa-solid fa-power-off mr-1"></i> Offline Broadcast';
    }
    if (fbLinkEl) {
        fbLinkEl.href = 'https://facebook.com';
    }

    const modal = document.getElementById('liveCommentsModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
    if (typeof loadLiveCommentsAdmin === 'function') {
        await loadLiveCommentsAdmin();
    }
}

function closeLiveCommentsModal() {
    const modal = document.getElementById('liveCommentsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.removeProperty('display');
    }
}

function toggleRealAudioInput() {}
function changeAudioInputDevice() {}

// Global window bindings
window.toggleLiveBroadcast = toggleLiveBroadcast;
window.saveLiveStreamDetails = saveLiveStreamDetails;
window.autoSaveLiveStreamDetails = autoSaveLiveStreamDetails;
window.testStreamVideoUrl = testStreamVideoUrl;
window.pasteStreamUrl = pasteStreamUrl;
window.onAudioMixerChange = onAudioMixerChange;
window.toggleAudioMixerMute = toggleAudioMixerMute;
window.resetAudioMixer = resetAudioMixer;
window.syncLiveStreamAudioCapture = syncLiveStreamAudioCapture;
window.stopMediaAudioCapture = stopMediaAudioCapture;
window.syncFbPlayerAudio = syncFbPlayerAudio;
window.enumerateRealAudioDevices = typeof enumerateRealAudioDevices === 'function' ? enumerateRealAudioDevices : function() {};
window.toggleRealAudioInput = toggleRealAudioInput;
window.changeAudioInputDevice = changeAudioInputDevice;
window.toggleStreamKeyVisibility = toggleStreamKeyVisibility;
window.copyStreamKey = copyStreamKey;
window.testStreamRelayConnection = testStreamRelayConnection;
window.testStreamUrlLink = testStreamRelayConnection;
window.autoUpdateLiveMonitorPlayer = autoUpdateLiveMonitorPlayer;
window.renderLiveMonitorPlayer = renderLiveMonitorPlayer;
window.loadLiveStreamAdmin = loadLiveStreamAdmin;
window.openLiveAnalyticsModal = openLiveAnalyticsModal;
window.closeLiveAnalyticsModal = closeLiveAnalyticsModal;
window.setLiveAnalyticsTimeframe = setLiveAnalyticsTimeframe;
window.changeLiveAnalyticsWeek = changeLiveAnalyticsWeek;
window.changeLiveAnalyticsCalendarMonth = changeLiveAnalyticsCalendarMonth;
window.renderLiveViewsChart = renderLiveViewsChart;
window.renderLiveAnalyticsCalendar = renderLiveAnalyticsCalendar;
window.onLiveAnalyticsDateClick = onLiveAnalyticsDateClick;
window.saveSelectedDateLiveViews = saveSelectedDateLiveViews;
window.syncFacebookLiveMetricsManual = syncFacebookLiveMetricsManual;
window.openLiveCommentsModal = openLiveCommentsModal;
window.closeLiveCommentsModal = closeLiveCommentsModal;


window.loadLiveCommentsAdmin = loadLiveCommentsAdmin;
async function loadLiveCommentsAdmin() {
    const container = document.getElementById('liveAdminCommentsContainer');
    if (!container) return;

    container.innerHTML = '<div class="text-center p-6 text-slate-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading live comments...</div>';

    try {
        const res = await api.content.getLiveStreamComments();
        const comments = res.data || [];

        if (comments.length === 0) {
            container.innerHTML = `
                <div class="text-center p-8 text-slate-400">
                    <i class="fa-regular fa-comments text-3xl mb-2 text-slate-300 block"></i>
                    <p class="text-sm font-semibold text-slate-600">No comments received yet.</p>
                    <p class="text-xs text-slate-400 mt-1">Comments from viewers on the website and Facebook Live will appear here.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = comments.map(c => {
            const isAdmin = c.is_admin == 1;
            const badgeClass = isAdmin ? 'badge-primary' : (c.author_badge === 'Church Member' ? 'badge-success' : 'badge-info');
            return `
                <div class="p-3 rounded-lg border ${isAdmin ? 'bg-blue-50/70 border-blue-200' : 'bg-slate-50 border-slate-200'} text-xs">
                    <div class="flex justify-between items-center mb-1">
                        <div class="flex items-center gap-2">
                            <strong class="text-navy font-bold">${escapeHtml(c.author_name)}</strong>
                            <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 1px 6px;">${escapeHtml(c.author_badge || 'Viewer')}</span>
                            ${isAdmin ? '<span class="badge" style="background:#2563eb; color:#fff; font-size:0.62rem; padding:1px 5px;"><i class="fa-solid fa-shield-halved mr-0.5"></i> Admin</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2 text-slate-400">
                            <span>${c.created_at || 'Just now'}</span>
                            <button type="button" class="text-rose-500 hover:text-rose-700 ml-2" onclick="deleteLiveCommentAdmin(${c.id})" title="Delete Comment">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-slate-700 text-sm mt-1 mb-0" style="word-break: break-word;">${escapeHtml(c.comment_text)}</p>
                </div>
            `;
        }).join('');

        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        console.error('Error loading comments:', err);
        container.innerHTML = `<div class="text-center p-6 text-rose-500 text-sm">Failed to load comments: ${escapeHtml(err.message)}</div>`;
    }
}

async function submitAdminLiveComment() {
    const input = document.getElementById('adminCommentInput');
    const text = input ? input.value.trim() : '';
    if (!text) return showToast('Please enter a comment first.');

    try {
        await api.content.postLiveStreamComment({
            comment_text: text,
            author_badge: 'Admin'
        });
        if (input) input.value = '';
        showToast('Comment posted to livestream!');
        await loadLiveCommentsAdmin();
    } catch (err) {
        showToast('Error posting comment: ' + err.message);
    }
}

async function deleteLiveCommentAdmin(commentId) {
    const ok = await showDecisionModal({
        title: 'Delete Livestream Comment',
        message: 'Are you sure you want to delete this livestream comment?',
        confirmText: 'Delete Comment',
        type: 'danger',
        icon: 'fa-trash-can'
    });
    if (!ok) return;
    try {
        await api.content.deleteLiveStreamComment(commentId);
        showToast('Comment removed.');
        await loadLiveCommentsAdmin();
    } catch (err) {
        showToast('Error deleting comment: ' + err.message);
    }
}

// ---- Past Livestream Chat Logs (Archived Comments) ----
let allLivestreamCommentLogsCache = [];

function openLivestreamCommentLogsModal() {
    const modal = document.getElementById('livestreamCommentLogsModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
    const searchInput = document.getElementById('commentLogsSearch');
    if (searchInput) searchInput.value = '';
    loadCommentLogsAdmin();
}

function closeLivestreamCommentLogsModal() {
    const modal = document.getElementById('livestreamCommentLogsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.removeProperty('display');
    }
}

function getCommentLogsTbody() {
    return document.getElementById('commentLogsTableBody') || document.getElementById('livestreamCommentLogsTableBody');
}

currentCommentLogsPage = 1;
const COMMENT_LOGS_LIMIT = 15;

async function loadCommentLogsAdmin(page = 1) {
    currentCommentLogsPage = page;
    const tbody = getCommentLogsTbody();
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading archived comments...</td></tr>';

    const search = (document.getElementById('commentLogsSearch')?.value || '').trim();

    try {
        const res = await api.content.getLiveStreamCommentLogs(currentCommentLogsPage, COMMENT_LOGS_LIMIT, { search });
        allLivestreamCommentLogsCache = res.data || [];
        renderCommentLogsTable(allLivestreamCommentLogsCache);

        const total = res.pagination ? res.pagination.total : allLivestreamCommentLogsCache.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / COMMENT_LOGS_LIMIT);

        const countEl = document.getElementById('commentLogsCount');
        if (countEl) countEl.textContent = total;

        const pageInfo = document.getElementById('commentLogsPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentCommentLogsPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('commentLogsPrevBtn');
        if (prevBtn) prevBtn.disabled = currentCommentLogsPage <= 1;

        const nextBtn = document.getElementById('commentLogsNextBtn');
        if (nextBtn) nextBtn.disabled = currentCommentLogsPage >= totalPages;
    

    } catch (err) {
        console.error('Error loading comment logs:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-rose-500">Failed to load comment logs: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function filterCommentLogsList() {
    loadCommentLogsAdmin(1);
}

function changeCommentLogsPage(direction) {
    const newPage = currentCommentLogsPage + direction;
    if (newPage > 0) {
        loadCommentLogsAdmin(newPage);
    }
}

function renderCommentLogsTable(logs) {
    const tbody = getCommentLogsTbody();
    const countEl = document.getElementById('commentLogsCount');
    if (countEl) countEl.textContent = logs.length;
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-regular fa-folder-open text-2xl mb-2 text-slate-300 block"></i>No archived comment logs found.</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(c => {
        const isAdmin = c.is_admin == 1;
        const badgeClass = isAdmin ? 'badge-primary' : (c.author_badge === 'Church Member' ? 'badge-success' : 'badge-info');
        return `
            <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                <td class="p-3" style="width: 25%; min-width: 180px; vertical-align: top;">
                    <strong class="text-navy block leading-snug" style="word-break: break-word;" title="${escapeHtml(c.broadcast_title || 'Livestream Broadcast')}">${escapeHtml(c.broadcast_title || 'Livestream Broadcast')}</strong>
                    ${c.session_started_at ? `<span class="text-slate-400 text-[11px] block mt-0.5"><i class="fa-solid fa-tower-broadcast mr-1 text-slate-400"></i>Stream: ${escapeHtml(c.session_started_at)}</span>` : ''}
                </td>
                <td class="p-3" style="width: 18%; min-width: 150px; vertical-align: top;">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <strong class="text-slate-800">${escapeHtml(c.author_name || 'Anonymous')}</strong>
                        <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 1px 6px;">${escapeHtml(c.author_badge || 'Viewer')}</span>
                        ${isAdmin ? '<span class="badge" style="background:#2563eb; color:#fff; font-size:0.62rem; padding:1px 5px;"><i class="fa-solid fa-shield-halved mr-0.5"></i> Admin</span>' : ''}
                    </div>
                </td>
                <td class="p-3" style="width: 33%; min-width: 240px; vertical-align: top; word-break: break-word;">
                    <p class="text-slate-700 m-0 leading-relaxed font-normal">${escapeHtml(c.comment_text || '')}</p>
                </td>
                <td class="p-3 text-slate-500 whitespace-nowrap" style="width: 12%; min-width: 130px; vertical-align: top;">
                    <span class="font-mono text-xs">${c.comment_created_at || '—'}</span>
                </td>
                <td class="p-3 text-slate-400 whitespace-nowrap" style="width: 12%; min-width: 130px; vertical-align: top;">
                    <span class="font-mono text-xs text-slate-500">${c.archived_at || '—'}</span>
                </td>
            </tr>
        `;
    }).join('');
}

// ---- Past Sermons Archive (YouTube Videos) ----
currentSermonsPage = 1;
const SERMON_PAGE_LIMIT = 10;

async function loadSermons(page = 1) {
    currentSermonsPage = page;
    const query = (document.getElementById('sermonSearchInput')?.value || '').trim();

    const tbody = document.getElementById('sermonsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading sermons archive...</td></tr>';

    try {
        const res = await api.content.getSermons(currentSermonsPage, SERMON_PAGE_LIMIT, { search: query });
        allSermonsAdminCache = res.data || [];
        renderSermonsTable(allSermonsAdminCache);

        const total = res.pagination ? res.pagination.total : allSermonsAdminCache.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / SERMON_PAGE_LIMIT);

        const pageInfo = document.getElementById('sermonsPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentSermonsPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('sermonsPrevBtn');
        if (prevBtn) prevBtn.disabled = currentSermonsPage <= 1;

        const nextBtn = document.getElementById('sermonsNextBtn');
        if (nextBtn) nextBtn.disabled = currentSermonsPage >= totalPages;
    } catch (error) {
        console.error('Error loading sermons:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-rose-500">Failed to load sermons.</td></tr>';
    }
}

function applySermonFilters() {
    loadSermons(1);
}

function resetSermonFilters() {
    const input = document.getElementById('sermonSearchInput');
    if (input) input.value = '';
    loadSermons(1);
}

function changeSermonsPage(direction) {
    const newPage = currentSermonsPage + direction;
    if (newPage > 0) {
        loadSermons(newPage);
    }
}

function renderSermonsTable(sermons) {
    const tbody = document.getElementById('sermonsTableBody');
    if (!tbody) return;

    if (sermons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-slate-400">No past sermons found. Click "+ Add Past Sermon" to add recorded YouTube videos.</td></tr>';
        return;
    }

    tbody.innerHTML = sermons.map(s => {
        const videoId = extractYouTubeId(s.youtube_video_id || s.video_url || '');
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg` : '/images/sermon-placeholder.jpg';
        const ytWatchUrl = videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : '#';
        const formattedDate = s.sermon_date ? new Date(s.sermon_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

        return `
            <tr class="hover:bg-slate-50/60 transition-colors">
                <td class="p-4" style="vertical-align: middle;">
                    <div class="sermon-thumb-wrap" onclick="previewSermonVideo('${escapeHtml(videoId)}', '${escapeHtml(s.title)}')" title="Click to Watch / Preview">
                        <img src="${thumbUrl}" alt="${escapeHtml(s.title)}" onerror="this.src='https://images.unsplash.com/photo-1438032005730-c779502df39b?q=80&w=300&auto=format&fit=crop'">
                        <div class="sermon-thumb-play"><i class="fa-solid fa-play"></i></div>
                    </div>
                </td>
                <td class="p-4" style="vertical-align: middle;">
                    <div class="font-semibold text-navy hover:text-blue-600 cursor-pointer" onclick="previewSermonVideo('${escapeHtml(videoId)}', '${escapeHtml(s.title)}')">${escapeHtml(s.title)}</div>
                    <div class="flex items-center gap-2 mt-1 text-2xs text-slate-500">
                        ${s.scripture_reference ? `<span class="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium"><i class="fa-solid fa-book-bible mr-1 text-gold"></i>${escapeHtml(s.scripture_reference)}</span>` : ''}
                        ${s.series_name ? `<span class="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">${escapeHtml(s.series_name)}</span>` : ''}
                    </div>
                </td>
                <td class="p-4 text-slate-700 text-xs font-medium" style="vertical-align: middle;">
                    <i class="fa-solid fa-user-tie text-slate-400 mr-1.5"></i>${escapeHtml(s.preacher || 'Pastor')}
                </td>
                <td class="p-4 text-xs text-slate-600 whitespace-nowrap" style="vertical-align: middle;">
                    <i class="fa-regular fa-calendar text-slate-400 mr-1.5"></i>${formattedDate}
                </td>
                <td class="p-4" style="vertical-align: middle;">
                    ${videoId ? `
                        <a href="${ytWatchUrl}" target="_blank" rel="noopener noreferrer" class="btn-youtube-link" title="Open Video on YouTube">
                            <i class="fa-brands fa-youtube"></i> Watch on YT
                        </a>
                    ` : '<span class="text-xs text-slate-400 italic">No link</span>'}
                </td>
                <td class="p-4 text-xs" style="vertical-align: middle;">
                    ${s.is_published == 1 ? '<span class="badge badge-active text-2xs">Published</span>' : '<span class="badge badge-inactive text-2xs">Draft</span>'}
                    ${s.is_featured == 1 ? '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.7rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; margin-left: 4px;"><i class="fa-solid fa-star text-2xs"></i>Featured</span>' : ''}
                </td>
                <td class="p-4 text-right" style="vertical-align: middle;">
                    <div class="action-btns-wrap" style="justify-content: flex-end;">
                        <button class="btn-action btn-view" onclick="previewSermonVideo('${escapeHtml(videoId)}', '${escapeHtml(s.title)}')" title="Watch Video Preview"><i class="fa-solid fa-play"></i></button>
                        <button class="btn-action btn-edit" onclick="editSermon(${s.sermon_id})" title="Edit Sermon"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-action btn-delete" onclick="deleteSermon(${s.sermon_id})" title="Delete Sermon"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Live YouTube input feedback and embed preview in Add/Edit modal
function onSermonYoutubeInput(val) {
    const videoId = extractYouTubeId(val);
    const feedback = document.getElementById('sermonYoutubeFeedback');
    const previewBox = document.getElementById('sermonPreviewBox');

    if (!val || !val.trim()) {
        if (feedback) feedback.innerHTML = '<span class="text-slate-500">Paste any YouTube URL (e.g. watch link, youtu.be, or ID). Churchgoers will watch this on the website.</span>';
        if (previewBox) {
            previewBox.classList.add('hidden');
            previewBox.innerHTML = '';
        }
        return;
    }

    if (videoId && videoId.length === 11) {
        if (feedback) feedback.innerHTML = `<span class="text-emerald-600 font-semibold"><i class="fa-solid fa-circle-check"></i> Valid YouTube Video Detected (ID: ${escapeHtml(videoId)})</span>`;
        if (previewBox) {
            previewBox.classList.remove('hidden');
            previewBox.innerHTML = `
                <iframe 
                    src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0" 
                    title="YouTube Preview" 
                    style="width: 100%; height: 100%; border: none;" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    referrerpolicy="strict-origin-when-cross-origin"
                    allowfullscreen>
                </iframe>
            `;
        }
    } else {
        if (feedback) feedback.innerHTML = '<span class="text-amber-600"><i class="fa-solid fa-triangle-exclamation"></i> Could not detect an 11-character YouTube video ID yet. Keep typing or paste full URL.</span>';
        if (previewBox) {
            previewBox.classList.add('hidden');
            previewBox.innerHTML = '';
        }
    }
}

function openSermonModal(s = null) {
    const form = document.getElementById('sermonForm');
    if (form) form.reset();
    document.getElementById('sermon_id').value = '';

    const previewBox = document.getElementById('sermonPreviewBox');
    if (previewBox) {
        previewBox.classList.add('hidden');
        previewBox.innerHTML = '';
    }

    if (s) {
        document.getElementById('sermonModalTitle').textContent = 'Edit Past Sermon';
        document.getElementById('sermon_id').value = s.sermon_id;
        document.getElementById('sermon_title').value = s.title || '';
        
        const videoInputVal = s.video_url || (s.youtube_video_id ? `https://www.youtube.com/watch?v=${s.youtube_video_id}` : '');
        document.getElementById('sermon_youtube_id').value = videoInputVal;
        document.getElementById('sermon_preacher').value = s.preacher || '';
        document.getElementById('sermon_date').value = s.sermon_date ? formatLocalDate(s.sermon_date) : '';
        document.getElementById('sermon_scripture').value = s.scripture_reference || '';
        const seriesInput = document.getElementById('sermon_series');
        if (seriesInput) seriesInput.value = s.series_name || '';
        document.getElementById('sermon_description').value = s.description || '';
        document.getElementById('sermon_is_featured').checked = s.is_featured == 1;
        document.getElementById('sermon_is_published').checked = s.is_published == 1;

        onSermonYoutubeInput(videoInputVal);
    } else {
        document.getElementById('sermonModalTitle').textContent = 'Add Past Sermon';
        document.getElementById('sermon_date').value = formatLocalDate(new Date());
        document.getElementById('sermon_is_published').checked = true;
        document.getElementById('sermon_is_featured').checked = false;
        onSermonYoutubeInput('');
    }
    document.getElementById('sermonModal').classList.add('active');
}

function closeSermonModal() {
    const modal = document.getElementById('sermonModal');
    if (modal) modal.classList.remove('active');
    const previewBox = document.getElementById('sermonPreviewBox');
    if (previewBox) {
        previewBox.classList.add('hidden');
        previewBox.innerHTML = '';
    }
}

async function editSermon(id) {
    let sermon = allSermonsAdminCache.find(s => s.sermon_id == id);
    if (!sermon) {
        try {
            const res = await api.content.getSermons();
            allSermonsAdminCache = res.data || [];
            sermon = allSermonsAdminCache.find(s => s.sermon_id == id);
        } catch (e) {
            return showToast('Failed to fetch sermon: ' + e.message);
        }
    }
    if (sermon) openSermonModal(sermon);
}

async function saveSermon() {
    const id = document.getElementById('sermon_id').value;
    const title = document.getElementById('sermon_title').value.trim();
    const rawYt = document.getElementById('sermon_youtube_id').value.trim();
    const preacher = document.getElementById('sermon_preacher').value.trim();
    const sermon_date = document.getElementById('sermon_date').value;
    const scripture_reference = document.getElementById('sermon_scripture').value.trim();
    const series_name = document.getElementById('sermon_series') ? document.getElementById('sermon_series').value.trim() : '';
    const description = document.getElementById('sermon_description').value.trim();
    const is_featured = document.getElementById('sermon_is_featured').checked;
    const is_published = document.getElementById('sermon_is_published').checked;

    if (!title || !rawYt || !preacher || !sermon_date) {
        showToast('Please fill in all required fields (Title, YouTube Link, Preacher, Date).');
        return;
    }

    const videoId = extractYouTubeId(rawYt);
    if (!videoId) {
        showToast('Could not extract a valid YouTube video ID from the provided link. Please check the URL.');
        return;
    }

    const fullUrl = rawYt.includes('http') ? rawYt : `https://www.youtube.com/watch?v=${videoId}`;

    const data = {
        title,
        youtube_video_id: videoId,
        video_url: fullUrl,
        preacher,
        sermon_date,
        scripture_reference,
        series_name,
        description,
        is_live: 0,
        is_featured,
        is_published
    };

    try {
        await api.content.saveSermon(data, id || null);
        showToast(id ? 'Sermon updated successfully!' : 'Past sermon added to archive successfully!');
        closeSermonModal();
        await loadSermons();
    } catch (error) {
        showToast('Error saving sermon: ' + error.message);
    }
}

async function deleteSermon(id) {
    const ok = await showDecisionModal({
        title: 'Delete Past Sermon',
        message: 'Are you sure you want to delete this sermon from the archive?',
        confirmText: 'Delete Sermon',
        type: 'danger',
        icon: 'fa-trash-can'
    });
    if (!ok) return;
    try {
        await api.content.deleteSermon(id);
        showToast('Sermon deleted.');
        await loadSermons();
    } catch (error) {
        showToast('Error deleting sermon: ' + error.message);
    }
}

// Quick Video Theater Preview Modal
function previewSermonVideo(youtubeId, title) {
    if (!youtubeId) return showToast('No YouTube video ID available for preview.');
    const modal = document.getElementById('videoPlayerModal');
    const titleEl = document.getElementById('videoPlayerTitle');
    const bodyEl = document.getElementById('videoPlayerBody');
    const iconEl = document.getElementById('videoPlayerIcon');
    const extBtn = document.getElementById('videoPlayerExternalBtn');
    const noteEl = document.getElementById('videoPlayerNote');

    if (titleEl) titleEl.textContent = title || 'Past Sermon Video Preview';
    if (iconEl) iconEl.innerHTML = '<i class="fa-brands fa-youtube text-red-500 text-lg"></i>';

    if (extBtn) {
        extBtn.href = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
        extBtn.innerHTML = '<i class="fa-brands fa-youtube"></i> Watch on YouTube';
        extBtn.style.display = 'inline-flex';
    }

    if (noteEl) {
        noteEl.style.display = 'none';
    }

    if (bodyEl) {
        bodyEl.innerHTML = `
            <iframe 
                src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0" 
                title="${escapeHtml(title)}" 
                style="width: 100%; height: 100%; border: none; position: absolute; top:0; left:0;" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen>
            </iframe>
        `;
    }

    if (modal) modal.classList.add('active');
}

function closeVideoPlayerModal() {
    const modal = document.getElementById('videoPlayerModal');
    const bodyEl = document.getElementById('videoPlayerBody');
    if (modal) modal.classList.remove('active');
    if (bodyEl) bodyEl.innerHTML = '';
}


// ============== PHOTO ALBUMS & GALLERY MANAGEMENT ==============
currentAlbumsPage = 1;
const ALBUM_PAGE_LIMIT = 10;

async function loadAlbumsAdmin(page = 1) {
    currentAlbumsPage = page;
    const tbody = document.getElementById('albumsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading albums...</td></tr>';

    try {
        const res = await api.gallery.getAlbums(currentAlbumsPage, ALBUM_PAGE_LIMIT);
        allAlbumsCache = res.data || [];
        if (!tbody) return;

        if (allAlbumsCache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-slate-400">No photo albums found. Click "+ Create Album" to create one.</td></tr>';
        } else {
            tbody.innerHTML = allAlbumsCache.map(a => {
                const coverImg = a.cover_image 
                    ? `<img src="${escapeHtml(a.cover_image)}" alt="${escapeHtml(a.title)}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; display: block; margin: 0 auto;">`
                    : `<div style="width: 48px; height: 48px; background: #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #94a3b8; margin: 0 auto;"><i class="fa-solid fa-image"></i></div>`;
                const albumDate = a.album_date ? new Date(a.album_date).toLocaleDateString() : 'N/A';
                return `
                    <tr>
                        <td class="p-4 text-center" style="vertical-align: middle;">${coverImg}</td>
                        <td class="p-4 font-semibold text-navy" style="vertical-align: middle;">${escapeHtml(a.title)}</td>
                        <td class="p-4 text-xs text-slate-500" style="vertical-align: middle; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(a.description || 'No description')}</td>
                        <td class="p-4 text-xs font-mono" style="vertical-align: middle;">${albumDate}</td>
                        <td class="p-4 text-center" style="vertical-align: middle;"><span class="badge badge-info"><i class="fa-solid fa-images mr-1"></i> ${a.image_count || 0} photos</span></td>
                        <td class="p-4 text-right" style="vertical-align: middle;">
                            <div class="action-btns-wrap" style="justify-content: flex-end; display: inline-flex; gap: 6px;">
                                <button class="btn-action" style="color: #2563eb; border: 1px solid #bfdbfe; background: #eff6ff; padding: 4px 9px; border-radius: 6px; font-size: 0.78rem; font-weight: 500; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" onclick="openAlbumPhotosModal(${a.album_id})" title="Manage Photos">
                                    <i class="fa-solid fa-photo-film"></i> Photos (${a.image_count || 0})
                                </button>
                                <button class="btn-action btn-edit" onclick="editAlbum(${a.album_id})" title="Edit Album"><i class="fa-solid fa-pen-to-square"></i></button>
                                <button class="btn-action btn-delete" onclick="deleteAlbum(${a.album_id})" title="Delete Album"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const total = res.pagination ? res.pagination.total : allAlbumsCache.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / ALBUM_PAGE_LIMIT);

        const pageInfo = document.getElementById('albumsPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentAlbumsPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('albumsPrevBtn');
        if (prevBtn) prevBtn.disabled = currentAlbumsPage <= 1;

        const nextBtn = document.getElementById('albumsNextBtn');
        if (nextBtn) nextBtn.disabled = currentAlbumsPage >= totalPages;
    } catch (error) {
        console.error('Error loading albums:', error);
        showToast('Error loading albums: ' + error.message);
    }
}

function changeAlbumsPage(direction) {
    const newPage = currentAlbumsPage + direction;
    if (newPage > 0) {
        loadAlbumsAdmin(newPage);
    }
}

function openAlbumModal(album = null) {
    const form = document.getElementById('albumForm');
    if (form) form.reset();
    document.getElementById('album_id').value = '';

    if (album) {
        document.getElementById('albumModalTitle').textContent = 'Edit Photo Album';
        document.getElementById('album_id').value = album.album_id;
        document.getElementById('album_title').value = album.title;
        document.getElementById('album_event_date').value = album.album_date ? formatLocalDate(album.album_date) : '';
        document.getElementById('album_description').value = album.description || '';
    } else {
        document.getElementById('albumModalTitle').textContent = 'Create Photo Album';
        document.getElementById('album_event_date').value = formatLocalDate(new Date());
    }
    document.getElementById('albumModal').classList.add('active');
}

function closeAlbumModal() {
    document.getElementById('albumModal').classList.remove('active');
}

async function editAlbum(id) {
    const album = allAlbumsCache.find(a => a.album_id == id);
    if (album) openAlbumModal(album);
}

async function saveAlbum() {
    const id = document.getElementById('album_id').value;
    const title = document.getElementById('album_title').value.trim();
    const albumDate = document.getElementById('album_event_date').value;
    const description = document.getElementById('album_description').value.trim();
    const coverFile = document.getElementById('album_cover_file')?.files[0];

    if (!title) {
        showToast('Album Title is required.');
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    if (albumDate) formData.append('album_date', albumDate);
    if (description) formData.append('description', description);
    if (coverFile) formData.append('cover_image', coverFile);

    try {
        if (id) {
            await api.gallery.updateAlbum(id, formData);
            showToast('Album updated successfully!');
        } else {
            await api.gallery.createAlbum(formData);
            showToast('Album created successfully!');
        }
        closeAlbumModal();
        await loadAlbumsAdmin();
    } catch (error) {
        showToast('Error saving album: ' + error.message);
    }
}

async function deleteAlbum(id) {
    const ok = await showDecisionModal({
        title: 'Delete Photo Album',
        message: 'Are you sure you want to delete this album and all its photos? This action cannot be undone.',
        confirmText: 'Delete Album',
        type: 'danger',
        icon: 'fa-trash-can'
    });
    if (!ok) return;
    try {
        await api.gallery.deleteAlbum(id);
        showToast('Album deleted successfully!');
        await loadAlbumsAdmin();
    } catch (error) {
        showToast('Error deleting album: ' + error.message);
    }
}

// Manage Photos Modal
async function openAlbumPhotosModal(albumId) {
    currentAlbumId = albumId;
    const album = allAlbumsCache.find(a => a.album_id == albumId);
    if (album) {
        document.getElementById('albumPhotosTitle').textContent = `Manage Photos: ${album.title}`;
    }
    const photoInput = document.getElementById('photo_file');
    if (photoInput) photoInput.value = '';
    const captionInput = document.getElementById('photo_caption');
    if (captionInput) captionInput.value = '';

    await loadAlbumPhotos(albumId);
    document.getElementById('albumPhotosModal').classList.add('active');
}

function closeAlbumPhotosModal() {
    document.getElementById('albumPhotosModal').classList.remove('active');
    loadAlbumsAdmin(); // Refresh album image counts
}

async function loadAlbumPhotos(albumId) {
    try {
        const res = await api.gallery.getImages(albumId);
        const images = res.data || [];
        const countEl = document.getElementById('albumPhotosCount');
        if (countEl) countEl.innerText = images.length;

        const grid = document.getElementById('albumPhotosGrid');
        if (!grid) return;

        if (images.length === 0) {
            grid.innerHTML = '<p class="text-slate-400 p-4 col-span-full">No photos in this album yet. Select image files above to upload.</p>';
            return;
        }

        grid.innerHTML = images.map(img => `
            <div class="album-photo-card">
                <img src="${escapeHtml(img.image_path)}" alt="${escapeHtml(img.caption || 'Album Photo')}" loading="lazy">
                <div class="album-photo-overlay">
                    <span class="text-xs text-white truncate" style="max-width: 110px; font-weight: 500;">${escapeHtml(img.caption || '')}</span>
                    <button type="button" onclick="deleteAlbumPhoto(${img.image_id})" title="Delete this photo" 
                            style="background: rgba(239, 68, 68, 0.9); color: #ffffff; border: none; border-radius: 6px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s;">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading album photos:', error);
        showToast('Error loading photos: ' + error.message);
    }
}

async function uploadPhotoToAlbum() {
    if (!currentAlbumId) {
        showToast('No album selected.');
        return;
    }

    const fileInput = document.getElementById('photo_file');
    const files = fileInput?.files;
    if (!files || files.length === 0) {
        showToast('Please select at least one photo file to upload.');
        return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('photos', files[i]);
    }
    const caption = document.getElementById('photo_caption')?.value?.trim();
    if (caption) formData.append('caption', caption);

    showToast(`Uploading ${files.length} photo(s)...`);
    try {
        await api.gallery.uploadImage(currentAlbumId, formData);
        showToast(`Successfully uploaded ${files.length} photo(s)!`);
        fileInput.value = '';
        if (document.getElementById('photo_caption')) document.getElementById('photo_caption').value = '';
        await loadAlbumPhotos(currentAlbumId);
    } catch (error) {
        console.error('Error uploading photo:', error);
        showToast('Failed to upload photos: ' + error.message);
    }
}

async function deleteAlbumPhoto(imageId) {
    const ok = await showDecisionModal({
        title: 'Delete Photo',
        message: 'Are you sure you want to delete this photo from the album?',
        confirmText: 'Delete Photo',
        type: 'danger',
        icon: 'fa-trash-can'
    });
    if (!ok) return;
    try {
        await api.gallery.deleteImage(imageId);
        showToast('Photo deleted successfully!');
        if (currentAlbumId) await loadAlbumPhotos(currentAlbumId);
    } catch (error) {
        showToast('Error deleting photo: ' + error.message);
    }
}

// ============== AUDIT TRAIL ==============
currentAuditPage = 1;

function getAuditFilterParams() {
    const filters = {};
    const user = document.getElementById('auditUserFilter')?.value?.trim();
    const action = document.getElementById('auditActionFilter')?.value;
    const module = document.getElementById('auditModuleFilter')?.value;
    const recordId = document.getElementById('auditRecordIdFilter')?.value?.trim();
    const dateFrom = document.getElementById('auditDateFrom')?.value;
    const dateTo = document.getElementById('auditDateTo')?.value;

    if (user) filters.user = user;
    if (action) filters.action = action;
    if (module) filters.module = module;
    if (recordId) filters.record_id = recordId;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;

    return filters;
}

let auditDebounceTimeout = null;
function applyAuditFilters() {
    clearTimeout(auditDebounceTimeout);
    auditDebounceTimeout = setTimeout(() => {
        loadAuditTrail(1);
    }, 250);
}

function resetAuditFilters() {
    if (document.getElementById('auditUserFilter')) document.getElementById('auditUserFilter').value = '';
    if (document.getElementById('auditActionFilter')) document.getElementById('auditActionFilter').value = '';
    if (document.getElementById('auditModuleFilter')) document.getElementById('auditModuleFilter').value = '';
    if (document.getElementById('auditRecordIdFilter')) document.getElementById('auditRecordIdFilter').value = '';
    if (document.getElementById('auditDateFrom')) document.getElementById('auditDateFrom').value = '';
    if (document.getElementById('auditDateTo')) document.getElementById('auditDateTo').value = '';
    loadAuditTrail(1);
}

async function loadAuditTrail(page = 1) {
    try {
        const filters = getAuditFilterParams();
        const res = await api.audit.getAll(page, filters);
        const { logs, total, limit } = res.data;
        const tbody = document.getElementById('auditTableBody');
        
        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-slate-400">No audit logs found matching filters.</td></tr>';
            document.getElementById('auditPageInfo').innerText = `Page 1 of 1 (0 total)`;
            document.getElementById('auditPrevBtn').disabled = true;
            document.getElementById('auditNextBtn').disabled = true;
            return;
        }

        const actionBadge = (action) => {
            const colors = {
                'CREATE': 'bg-green-100 text-green-700',
                'UPDATE': 'bg-blue-100 text-blue-700',
                'DELETE': 'bg-red-100 text-red-700',
                'LOGIN': 'bg-slate-100 text-slate-700',
                'LOGOUT': 'bg-slate-200 text-slate-600',
                'TRIGGER_SMS': 'bg-purple-100 text-purple-700',
                'UPLOAD': 'bg-amber-100 text-amber-700',
                'UPLOAD_PHOTOS': 'bg-amber-100 text-amber-700',
                'ENROLL': 'bg-indigo-100 text-indigo-700'
            };
            return colors[action] || 'bg-slate-100 text-slate-700';
        };

        tbody.innerHTML = logs.map(log => {
            const dt = new Date(log.performed_at);
            const formattedTimestamp = isNaN(dt.getTime())
                ? escapeHtml(log.performed_at || 'N/A')
                : `${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`;

            return `
                <tr class="hover:bg-slate-50">
                    <td class="p-4 font-medium text-navy">${escapeHtml(log.user_name || log.user_username || 'System')}</td>
                    <td class="p-4">
                        <span class="px-2 py-1 text-xs rounded ${actionBadge(log.action)}">${escapeHtml((log.action || '').replace('_', ' '))}</span>
                    </td>
                    <td class="p-4 text-slate-600 font-semibold">${escapeHtml(log.module || '')}</td>
                    <td class="p-4 text-slate-500 font-mono text-xs">${escapeHtml(log.record_id !== null && log.record_id !== undefined ? String(log.record_id) : 'N/A')}</td>
                    <td class="p-4 text-xs font-mono" style="white-space: nowrap; color: var(--text-dark);">${formattedTimestamp}</td>
                </tr>
            `;
        }).join('');

        currentAuditPage = page;
        const totalPages = Math.ceil(total / limit);
        document.getElementById('auditPageInfo').innerText = `Page ${page} of ${totalPages || 1} (${total} records)`;
        
        document.getElementById('auditPrevBtn').disabled = page <= 1;
        document.getElementById('auditNextBtn').disabled = page >= totalPages;

    } catch (error) {
        showToast('Error loading audit logs: ' + error.message);
    }
}

function changeAuditPage(direction) {
    const newPage = currentAuditPage + direction;
    if (newPage > 0) {
        loadAuditTrail(newPage);
    }
}

// ============== SYSTEM BACKUP ==============
async function runBackup() {
    const btn = document.getElementById('backupBtn');
    const originalHtml = btn.innerHTML;
    
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Backing up...`;
    btn.disabled = true;

    try {
        const token = sessionStorage.getItem('church_token');
        const response = await fetch(api.system.backup(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Backup failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `church_portal_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showToast('System backup downloaded successfully!');
        await loadAuditTrail(1);
    } catch (error) {
        showToast('Error generating backup: ' + error.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ============== VIEW DETAILS HELPERS ==============
function closeViewModal() {
    document.getElementById('viewModal').classList.remove('active');
}

function viewEvent(id) {
    const event = allEventsCache.find(e => e.event_id == id);
    if (!event) return;
    
    document.getElementById('viewModalTitle').innerText = 'Event Details';
    document.getElementById('viewModalBody').innerHTML = `
        <ul class="view-details-list">
            <li><span class="label">Title</span> <span class="value">${escapeHtml(event.title)}</span></li>
            <li><span class="label">Type</span> <span class="value">${escapeHtml(event.event_type)}</span></li>
            <li><span class="label">Status</span> <span class="value">${escapeHtml(event.status)}</span></li>
            <li><span class="label">Starts</span> <span class="value">${new Date(event.start_datetime).toLocaleString()}</span></li>
            <li><span class="label">Ends</span> <span class="value">${new Date(event.end_datetime).toLocaleString()}</span></li>
            <li><span class="label">Venue</span> <span class="value">${escapeHtml(event.venue || 'N/A')}</span></li>
            <li><span class="label">Organizer</span> <span class="value">${escapeHtml(event.organizer || 'N/A')}</span></li>
            <li><span class="label">Capacity</span> <span class="value">${event.capacity || 'Unlimited'}</span></li>
            <li><span class="label">Featured Event?</span> <span class="value">${event.is_featured == 1 ? '<span style="color: #d97706; font-weight: 700;"><i class="fa-solid fa-star mr-1"></i>Yes (Featured)</span>' : 'No'}</span></li>
            <li><span class="label">Public Event?</span> <span class="value">${event.is_public == 1 ? 'Yes' : 'No'}</span></li>
            <li><span class="label">Enrollment Open?</span> <span class="value">${event.is_enrollment_open == 1 ? 'Yes' : 'No'}</span></li>
            <li><span class="label">Description</span> <span class="value" style="max-width: 300px; white-space: pre-wrap;">${escapeHtml(event.description || 'N/A')}</span></li>
        </ul>
        <div style="margin-top: 1.25rem; display: flex; justify-content: flex-end;">
            <button type="button" class="btn btn-primary" onclick="closeViewModal(); viewEventEnrollments(${event.event_id});" style="display: inline-flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-user-graduate"></i> View Enrolled Members
            </button>
        </div>
    `;
    document.getElementById('viewModal').classList.add('active');
}

function viewAnnouncement(id) {
    const ann = allAnnouncementsCache.find(a => a.announcement_id == id);
    if (!ann) return;
    
    document.getElementById('viewModalTitle').innerText = 'Announcement Details';
    document.getElementById('viewModalBody').innerHTML = `
        <ul class="view-details-list">
            <li><span class="label">Title</span> <span class="value">${escapeHtml(ann.title)}</span></li>
            <li><span class="label">Category</span> <span class="value">${escapeHtml(ann.category)}</span></li>
            <li><span class="label">Target Audience</span> <span class="value">${escapeHtml(ann.target_audience)}</span></li>
            <li><span class="label">Pinned?</span> <span class="value">${ann.is_pinned == 1 ? 'Yes' : 'No'}</span></li>
            <li><span class="label">Email Broadcast?</span> <span class="value">${ann.email_triggered == 1 ? '<span class="badge" style="background:#eff6ff; color:#1d4ed8;"><i class="fa-solid fa-envelope mr-1"></i>Sent' + (ann.email_triggered_at ? ' (' + new Date(ann.email_triggered_at).toLocaleString() + ')' : '') + '</span>' : '<span class="badge badge-inactive">Pending</span>'}</span></li>
            <li><span class="label">SMS Verification?</span> <span class="value">${ann.sms_triggered == 1 ? '<span class="badge" style="background:#f0fdf4; color:#15803d;"><i class="fa-solid fa-circle-check mr-1"></i>Verified & Sent' + (ann.sms_triggered_at ? ' (' + new Date(ann.sms_triggered_at).toLocaleString() + ')' : '') + '</span>' : '<span class="badge badge-inactive">Pending</span>'}</span></li>
            <li><span class="label">Publish Date</span> <span class="value">${new Date(ann.publish_date).toLocaleString()}</span></li>
            <li><span class="label">Content</span> <span class="value" style="max-width: 300px; white-space: pre-wrap;">${escapeHtml(ann.content)}</span></li>
        </ul>
    `;
    document.getElementById('viewModal').classList.add('active');
}

// ============== SMS GATEWAY MANAGEMENT & TEST ==============
smsSettingsCache = null;

async function loadSmsGatewayStatus() {
    try {
        const res = await api.system.getSmsSettings();
        smsSettingsCache = res.data;

        // Update Audit view badge (single badge instance, no nested badge spans)
        const badgeEl = document.getElementById('smsGatewayStatusBadge');
        const descEl = document.getElementById('smsGatewayDesc');
        if (badgeEl) {
            if (smsSettingsCache.configured) {
                badgeEl.className = 'badge badge-active';
                badgeEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Live Gateway Active (${escapeHtml(smsSettingsCache.provider)})`;
                if (descEl) descEl.textContent = `Provider: ${smsSettingsCache.provider}. Ready to deliver SMS over cellular carriers.`;
            } else {
                badgeEl.className = 'badge badge-inactive';
                badgeEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Simulation Mode (No API Key)`;
                if (descEl) descEl.textContent = `No API key configured. SMS blasts will be simulated and logged to database only.`;
            }
        }

        // Update Announcements view banner
        const bannerEl = document.getElementById('announcementSmsBanner');
        if (bannerEl) {
            if (!smsSettingsCache.configured) {
                bannerEl.style.display = 'flex';
            } else {
                bannerEl.style.display = 'none';
            }
        }
    } catch (err) {
        console.warn('Failed to load SMS gateway status:', err.message);
    }
}

async function loadEmailServiceStatus() {
    try {
        const badgeEl = document.getElementById('emailServiceStatusBadge');
        const descEl = document.getElementById('emailServiceDesc');
        if (!badgeEl) return;
        const res = await api.system.getEmailSettings();
        if (res && res.data) {
            const info = res.data;
            if (info.configured) {
                badgeEl.innerHTML = `<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> Active (${escapeHtml(info.label)})</span>`;
                if (descEl) {
                    descEl.textContent = info.provider === 'resend'
                        ? 'Delivers official church announcements, member verifications, and pastoral alerts via Resend.com HTTPS API (Port 443).'
                        : 'Delivers official church announcements, member verifications, and pastoral alerts directly to member inboxes.';
                }
            } else {
                badgeEl.innerHTML = `<span class="badge badge-inactive"><i class="fa-solid fa-triangle-exclamation"></i> Simulation Mode (No API Key)</span>`;
                if (descEl) {
                    descEl.textContent = 'No Resend or SMTP credentials configured. Verification emails will be simulated and logged in database only.';
                }
            }
        }
    } catch (err) {
        console.warn('Failed to load email service status:', err.message);
    }
}

async function openSmsSettingsModal() {
    try {
        const res = await api.system.getSmsSettings();
        smsSettingsCache = res.data;

        const badge = document.getElementById('modalSmsStatusBadge');
        const provText = document.getElementById('modalSmsProviderText');
        
        // TextBee
        const tbDevice = document.getElementById('sms_textbee_device_id');
        const tbDeviceHint = document.getElementById('sms_textbee_device_hint');
        const tbKey = document.getElementById('sms_textbee_api_key');
        const tbKeyHint = document.getElementById('sms_textbee_key_hint');

        // Semaphore
        const semKey = document.getElementById('sms_semaphore_api_key');
        const keyHint = document.getElementById('sms_semaphore_key_hint');
        const semSender = document.getElementById('sms_semaphore_sender_name');

        // Textbelt
        const textbeltFree = document.getElementById('sms_use_textbelt_free');
        const textbeltKey = document.getElementById('sms_textbelt_api_key');
        const textbeltKeyHint = document.getElementById('sms_textbelt_key_hint');

        // Twilio
        const twilioSid = document.getElementById('sms_twilio_account_sid');
        const twilioPhone = document.getElementById('sms_twilio_phone_number');

        if (badge) {
            badge.innerHTML = smsSettingsCache.configured
                ? `<span class="badge badge-active">Live Connected</span>`
                : `<span class="badge badge-inactive">Simulation Mode</span>`;
        }
        if (provText) provText.textContent = smsSettingsCache.provider;

        // Populate TextBee
        if (tbDevice && smsSettingsCache.textbee_device_id_masked) {
            tbDevice.placeholder = smsSettingsCache.textbee_device_id_masked;
            if (tbDeviceHint) tbDeviceHint.textContent = `Configured: ${smsSettingsCache.textbee_device_id_masked}`;
        }
        if (tbKey && smsSettingsCache.textbee_api_key_masked) {
            tbKey.placeholder = smsSettingsCache.textbee_api_key_masked;
            if (tbKeyHint) tbKeyHint.textContent = `Current key: ${smsSettingsCache.textbee_api_key_masked} (Leave blank to keep)`;
        }

        // Populate Semaphore
        if (keyHint && smsSettingsCache.semaphore_api_key_masked) {
            keyHint.textContent = `Current key: ${smsSettingsCache.semaphore_api_key_masked} (Leave input blank to keep existing key)`;
        } else if (keyHint) {
            keyHint.textContent = 'No key configured. Real cellular delivery requires a Semaphore or TextBee API Key.';
        }
        if (semSender) semSender.value = smsSettingsCache.semaphore_sender_name || '';

        // Populate Textbelt
        if (textbeltFree) textbeltFree.checked = Boolean(smsSettingsCache.use_textbelt_free);
        if (textbeltKey && smsSettingsCache.textbelt_api_key_masked) {
            textbeltKey.placeholder = smsSettingsCache.textbelt_api_key_masked;
            if (textbeltKeyHint) textbeltKeyHint.textContent = `Current key: ${smsSettingsCache.textbelt_api_key_masked}`;
        }

        // Populate Twilio
        if (twilioSid && smsSettingsCache.twilio_account_sid_masked) twilioSid.placeholder = smsSettingsCache.twilio_account_sid_masked;
        if (twilioPhone) twilioPhone.value = smsSettingsCache.twilio_phone_number || '';

        document.getElementById('smsSettingsModal').classList.add('active');
    } catch (error) {
        showToast('Error loading SMS settings: ' + error.message);
    }
}

function closeSmsSettingsModal() {
    document.getElementById('smsSettingsModal').classList.remove('active');
    document.getElementById('smsSettingsForm').reset();
}

async function saveSmsSettings() {
    // TextBee
    const tbDevice = document.getElementById('sms_textbee_device_id')?.value.trim();
    const tbKey = document.getElementById('sms_textbee_api_key')?.value.trim();

    // Semaphore
    const semKey = document.getElementById('sms_semaphore_api_key')?.value.trim();
    const semSender = document.getElementById('sms_semaphore_sender_name')?.value.trim();

    // Textbelt
    const textbeltFree = document.getElementById('sms_use_textbelt_free')?.checked;
    const textbeltKey = document.getElementById('sms_textbelt_api_key')?.value.trim();

    // Twilio
    const twilioSid = document.getElementById('sms_twilio_account_sid')?.value.trim();
    const twilioToken = document.getElementById('sms_twilio_auth_token')?.value.trim();
    const twilioPhone = document.getElementById('sms_twilio_phone_number')?.value.trim();

    const payload = {};
    if (tbDevice) payload.textbee_device_id = tbDevice;
    if (tbKey) payload.textbee_api_key = tbKey;
    if (semKey) payload.semaphore_api_key = semKey;
    if (semSender !== undefined) payload.semaphore_sender_name = semSender;
    if (textbeltFree !== undefined) payload.use_textbelt_free = textbeltFree;
    if (textbeltKey) payload.textbelt_api_key = textbeltKey;
    if (twilioSid) payload.twilio_account_sid = twilioSid;
    if (twilioToken) payload.twilio_auth_token = twilioToken;
    if (twilioPhone !== undefined) payload.twilio_phone_number = twilioPhone;

    try {
        const res = await api.system.updateSmsSettings(payload);
        showToast(res.message || 'SMS settings saved successfully!');
        closeSmsSettingsModal();
        await loadSmsGatewayStatus();
    } catch (error) {
        showToast('Error saving SMS settings: ' + error.message);
    }
}

function openTestSmsModal() {
    const resultBox = document.getElementById('testSmsResultBox');
    if (resultBox) resultBox.style.display = 'none';

    // Auto-fill with current user's contact number if available
    const user = JSON.parse(sessionStorage.getItem('church_user') || '{}');
    const recipientInput = document.getElementById('test_sms_recipient');
    if (recipientInput && user.contact_number) {
        recipientInput.value = user.contact_number;
    }

    document.getElementById('testSmsModal').classList.add('active');
}

function closeTestSmsModal() {
    document.getElementById('testSmsModal').classList.remove('active');
}

async function dispatchTestSms() {
    const recipient = document.getElementById('test_sms_recipient').value.trim();
    const message = document.getElementById('test_sms_message').value.trim();
    const btn = document.getElementById('btnSendTestSms');
    const resultBox = document.getElementById('testSmsResultBox');
    const titleEl = document.getElementById('testSmsResultTitle');
    const msgEl = document.getElementById('testSmsResultMsg');
    const rawEl = document.getElementById('testSmsResultRaw');

    if (!recipient) {
        alert('Please enter a recipient mobile number (+63).');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    resultBox.style.display = 'none';

    try {
        const res = await api.system.sendTestSms({ recipient_number: recipient, message });
        resultBox.style.display = 'block';

        if (res.data?.status === 'Sent') {
            resultBox.style.background = '#f0fdf4';
            resultBox.style.border = '1px solid #bbf7d0';
            resultBox.style.color = '#15803d';
            titleEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Live SMS Dispatched!';
            msgEl.textContent = res.message || 'Message delivered to cellular gateway.';
        } else if (res.data?.status === 'Simulated') {
            resultBox.style.background = '#fffbeb';
            resultBox.style.border = '1px solid #fde68a';
            resultBox.style.color = '#92400e';
            titleEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Simulation Mode';
            msgEl.textContent = 'No SMS API Key is configured in .env. The message was logged to the database, but was not transmitted over cellular carriers. Configure a Semaphore API Key to receive real SMS on your mobile phone.';
        } else {
            resultBox.style.background = '#fef2f2';
            resultBox.style.border = '1px solid #fecaca';
            resultBox.style.color = '#b91c1c';
            titleEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Gateway Delivery Error';
            msgEl.textContent = res.message || 'The gateway returned an error.';
        }

        if (res.data?.gateway_response) {
            rawEl.style.display = 'block';
            rawEl.textContent = typeof res.data.gateway_response === 'string' 
                ? res.data.gateway_response 
                : JSON.stringify(res.data.gateway_response, null, 2);
        } else {
            rawEl.style.display = 'none';
        }

        await loadSmsGatewayStatus();
    } catch (error) {
        resultBox.style.display = 'block';
        resultBox.style.background = '#fef2f2';
        resultBox.style.border = '1px solid #fecaca';
        resultBox.style.color = '#b91c1c';
        titleEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Error';
        msgEl.textContent = error.message;
        rawEl.style.display = 'none';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Test SMS';
    }
}

window.loadSmsGatewayStatus = loadSmsGatewayStatus;
window.loadEmailServiceStatus = loadEmailServiceStatus;
window.openSmsSettingsModal = openSmsSettingsModal;
window.closeSmsSettingsModal = closeSmsSettingsModal;
window.saveSmsSettings = saveSmsSettings;
window.openTestSmsModal = openTestSmsModal;
window.closeTestSmsModal = closeTestSmsModal;
window.dispatchTestSms = dispatchTestSms;


// ==========================================
// C2S CELL GROUP MODULE
// ==========================================
let c2sGroupsData = [];
let activeRosterGroupId = null;

function formatTime(timeStr) {
    if (!timeStr) return '';
    if (typeof timeStr !== 'string') timeStr = String(timeStr);
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
}


async function loadC2SGroups() {
    try {
        const tbody = document.getElementById('c2sGroupsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading C2S cell groups...</td></tr>';
        }

        const res = await api.c2s.getAll();
        c2sGroupsData = res.data || [];

        // Update stats
        const totalGroups = c2sGroupsData.length;
        const activeGroups = c2sGroupsData.filter(g => g.status === 'Active').length;
        const uniqueMentors = new Set(c2sGroupsData.map(g => g.leader_id).filter(Boolean)).size;
        const totalMentees = c2sGroupsData.reduce((sum, g) => sum + (parseInt(g.mentees_count, 10) || 0), 0);

        if (document.getElementById('c2sStatTotal')) document.getElementById('c2sStatTotal').textContent = totalGroups;
        if (document.getElementById('c2sStatActive')) document.getElementById('c2sStatActive').textContent = activeGroups;
        if (document.getElementById('c2sStatMentors')) document.getElementById('c2sStatMentors').textContent = uniqueMentors;
        if (document.getElementById('c2sStatMentees')) document.getElementById('c2sStatMentees').textContent = totalMentees;

        applyC2SFilters();
    } catch (error) {
        console.error('Error loading C2S groups:', error);
        showToast('Error loading C2S groups: ' + error.message);
        const tbody = document.getElementById('c2sGroupsTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-rose-500"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Failed to load cell groups.</td></tr>`;
        }
    }
}

let currentC2SPage = 1;
const C2S_PAGE_LIMIT = 10;

async function loadC2STable(page = 1) {
    currentC2SPage = page;
    const search = (document.getElementById('c2sSearchInput')?.value || '').trim();
    const status = document.getElementById('c2sStatusFilter')?.value || 'All';

    const tbody = document.getElementById('c2sGroupsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading C2S cell groups...</td></tr>';

    try {
        const res = await api.c2s.getAll(currentC2SPage, C2S_PAGE_LIMIT, { search, status });
        const list = res.data || [];
        renderC2SGroupsTable(list);

        const total = res.pagination ? res.pagination.total : list.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / C2S_PAGE_LIMIT);

        const pageInfo = document.getElementById('c2sPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentC2SPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('c2sPrevBtn');
        if (prevBtn) prevBtn.disabled = currentC2SPage <= 1;

        const nextBtn = document.getElementById('c2sNextBtn');
        if (nextBtn) nextBtn.disabled = currentC2SPage >= totalPages;
    } catch (e) {
        console.error('Error loading C2S table:', e);
    }
}

function applyC2SFilters() {
    loadC2STable(1);
}

function resetC2SFilters() {
    if (document.getElementById('c2sSearchInput')) document.getElementById('c2sSearchInput').value = '';
    if (document.getElementById('c2sStatusFilter')) document.getElementById('c2sStatusFilter').value = 'Active';
    loadC2STable(1);
}

function changeC2SPage(direction) {
    const newPage = currentC2SPage + direction;
    if (newPage > 0) {
        loadC2STable(newPage);
    }
}

function renderC2SGroupsTable(groups) {
    const tbody = document.getElementById('c2sGroupsTableBody');
    if (!tbody) return;

    if (!groups || groups.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center p-8 text-slate-400">
                    <i class="fa-solid fa-people-roof text-3xl mb-2 block opacity-40"></i>
                    No cell groups found matching your criteria.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = groups.map(g => {
        const totalSize = parseInt(g.total_size, 10) || 1;
        const menteesCount = parseInt(g.mentees_count, 10) || 0;
        const secMentorsCount = parseInt(g.secondary_mentors_count, 10) || 0;
        const statusBadge = g.status === 'Active'
            ? `<span class="badge" style="background: #ecfdf5; color: #059669; font-weight:600;"><i class="fa-solid fa-circle-check mr-1"></i> Active</span>`
            : `<span class="badge" style="background: #f1f5f9; color: #64748b; font-weight:600;"><i class="fa-solid fa-pause mr-1"></i> Inactive</span>`;

        const schedInfo = [
            g.meeting_day ? `<i class="fa-regular fa-calendar-days text-slate-400 mr-1"></i>${g.meeting_day}` : '',
            g.meeting_time ? `<i class="fa-regular fa-clock text-slate-400 ml-2 mr-1"></i>${formatTime(g.meeting_time)}` : ''
        ].filter(Boolean).join(' ');

        return `
            <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                <td class="p-4">
                    <div style="font-weight: 700; color: var(--navy); font-size: 0.95rem;">${escapeHtml(g.group_name)}</div>
                    ${g.description ? `<div class="text-xs text-slate-500 mt-1 line-clamp-1">${escapeHtml(g.description)}</div>` : ''}
                </td>
                <td class="p-4">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${g.leader_profile_image 
                            ? `<img src="${escapeHtml(g.leader_profile_image)}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;" onerror="this.outerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;\\'>${escapeHtml((g.leader_name || 'L').charAt(0))}</div>'">`
                            : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;">${escapeHtml((g.leader_name || 'L').charAt(0))}</div>`
                        }
                        <div>
                            <div style="font-weight: 600; color: #1e293b;">${escapeHtml(g.leader_name || 'Unassigned')}</div>
                            <span class="badge c2s-badge-mentor" style="font-size: 0.7rem; padding: 1px 6px;">
                                <i class="fa-solid fa-crown mr-1"></i> Primary Mentor
                            </span>
                        </div>
                    </div>
                </td>
                <td class="p-4 text-xs text-slate-600">
                    <div>${schedInfo || '<span class="text-slate-400">Schedule TBD</span>'}</div>
                    ${g.meeting_location ? `<div class="text-slate-500 mt-1"><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>${escapeHtml(g.meeting_location)}</div>` : ''}
                </td>
                <td class="p-4 text-center">
                    <span class="badge" style="background: #eff6ff; color: #1d4ed8; font-size: 0.85rem; font-weight: 700; padding: 4px 10px; border-radius: 9999px;">
                        <i class="fa-solid fa-users mr-1"></i> ${totalSize} ${totalSize === 1 ? 'person' : 'people'}
                    </span>
                    <div class="text-[11px] text-slate-400 mt-1 font-medium">1 Mentor + ${totalSize - 1} Members</div>
                </td>
                <td class="p-4 text-center">
                    <div style="display: inline-flex; gap: 4px; flex-wrap: wrap; justify-content: center;">
                        <span class="badge c2s-badge-mentor" style="font-size: 0.72rem;" title="Primary Mentor (Leader)">
                            1 Mentor
                        </span>
                        <span class="badge c2s-badge-mentee" style="font-size: 0.72rem;" title="Mentees who do not lead groups">
                            ${menteesCount} ${menteesCount === 1 ? 'Mentee' : 'Mentees'}
                        </span>
                        ${secMentorsCount > 0 ? `
                            <span class="badge c2s-badge-sec-mentor" style="font-size: 0.72rem; font-weight: 600;" title="Secondary Mentors who lead their own group elsewhere">
                                ${secMentorsCount} Sec. Mentor${secMentorsCount > 1 ? 's' : ''}
                            </span>
                        ` : ''}
                    </div>
                </td>
                <td class="p-4">
                    ${statusBadge}
                </td>
                <td class="p-4 text-right">
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button class="btn-primary btn-sm" onclick="openC2SRosterModal(${g.group_id})" title="Manage Group Roster & Mentees" style="padding: 4px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-users-gear"></i> Roster
                        </button>
                        <button class="btn-action btn-edit" onclick="openC2SGroupModal(${g.group_id})" title="Edit Cell Group" style="padding: 4px 9px; font-size: 0.78rem;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="deleteC2SGroup(${g.group_id}, '${escapeHtml(g.group_name)}')" title="Delete Cell Group" style="padding: 4px 9px; font-size: 0.78rem;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function openC2SGroupModal(groupId = null) {
    const form = document.getElementById('c2sGroupForm');
    if (form) form.reset();
    document.getElementById('c2s_group_id').value = '';

    if (groupId) {
        document.getElementById('c2sGroupModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square" style="color: var(--primary);"></i> Edit C2S Group';
        document.getElementById('btnSaveC2SGroup').innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Update Cell Group';

        const group = c2sGroupsData.find(g => g.group_id === groupId);
        if (group) {
            document.getElementById('c2s_group_id').value = group.group_id;
            document.getElementById('c2s_group_name').value = group.group_name || '';
            if (group.leader_id) {
                selectMentorForC2S(group.leader_id, group.leader_name || 'Assigned Mentor', group.leader_church_role || 'Member');
            } else {
                clearSelectedMentor();
            }
            document.getElementById('c2s_meeting_day').value = group.meeting_day || 'Wednesday';
            document.getElementById('c2s_meeting_time').value = group.meeting_time ? group.meeting_time.slice(0, 5) : '';
            document.getElementById('c2s_meeting_location').value = group.meeting_location || '';
            document.getElementById('c2s_status').value = group.status || 'Active';
            document.getElementById('c2s_description').value = group.description || '';
        }
    } else {
        document.getElementById('c2sGroupModalTitle').innerHTML = '<i class="fa-solid fa-people-roof" style="color: var(--primary);"></i> Add C2S Group';
        document.getElementById('btnSaveC2SGroup').innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Save Cell Group';
        document.getElementById('c2s_meeting_day').value = 'Wednesday';
        document.getElementById('c2s_status').value = 'Active';
        clearSelectedMentor();
    }

    document.getElementById('c2sGroupModal').classList.add('active');
}

function closeC2SGroupModal() {
    const modal = document.getElementById('c2sGroupModal');
    if (modal) modal.classList.remove('active');
}

async function saveC2SGroup() {
    const id = document.getElementById('c2s_group_id').value;
    const group_name = document.getElementById('c2s_group_name').value.trim();
    const leader_id = document.getElementById('c2s_leader_id').value;
    const meeting_day = document.getElementById('c2s_meeting_day').value;
    const meeting_time = document.getElementById('c2s_meeting_time').value;
    const meeting_location = document.getElementById('c2s_meeting_location').value.trim();
    const status = document.getElementById('c2s_status').value;
    const description = document.getElementById('c2s_description').value.trim();

    if (!group_name) {
        showToast('Please enter a cell group name.');
        return;
    }
    if (!leader_id) {
        showToast('Please select a Primary Mentor / Leader.');
        return;
    }

    const payload = {
        group_name,
        leader_id: parseInt(leader_id, 10),
        meeting_day,
        meeting_time: meeting_time || null,
        meeting_location: meeting_location || null,
        status,
        description: description || null
    };

    const btn = document.getElementById('btnSaveC2SGroup');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';

    try {
        if (id) {
            await api.c2s.update(id, payload);
            showToast('C2S Cell Group updated successfully!');
        } else {
            await api.c2s.create(payload);
            showToast('C2S Cell Group created successfully!');
        }
        closeC2SGroupModal();
        await loadC2SGroups();
    } catch (error) {
        showToast('Error saving C2S Group: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function deleteC2SGroup(groupId, groupName) {
    const ok = await showDecisionModal({
        title: 'Delete C2S Group',
        message: `Are you sure you want to delete "${groupName}"? This will remove all group participant assignments.`,
        confirmText: 'Delete Group',
        type: 'danger',
        icon: 'fa-trash-can'
    });
    if (!ok) return;

    try {
        await api.c2s.delete(groupId);
        showToast(`Cell group "${groupName}" deleted.`);
        await loadC2SGroups();
    } catch (error) {
        showToast('Error deleting cell group: ' + error.message);
    }
}

// Roster Management
async function openC2SRosterModal(groupId) {
    activeRosterGroupId = groupId;
    const modal = document.getElementById('c2sRosterModal');
    if (!modal) return;
    modal.classList.add('active');

    await loadC2SRosterDetails();
}

function closeC2SRosterModal() {
    activeRosterGroupId = null;
    const modal = document.getElementById('c2sRosterModal');
    if (modal) modal.classList.remove('active');
}

async function loadC2SRosterDetails() {
    if (!activeRosterGroupId) return;

    const tbody = document.getElementById('c2sRosterTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading roster...</td></tr>';
    }

    try {
        const res = await api.c2s.getById(activeRosterGroupId);
        const group = res.data;
        if (!group) throw new Error('Group not found');

        // Update modal title and info
        document.getElementById('c2sRosterModalTitle').innerHTML = `<i class="fa-solid fa-people-roof" style="color: var(--gold); margin-right: 0.5rem;"></i> ${escapeHtml(group.group_name)} Roster`;
        document.getElementById('rosterPrimaryMentorName').textContent = group.leader_name || 'Unassigned';
        
        const schedStr = [
            group.meeting_day ? `Day: ${group.meeting_day}` : '',
            group.meeting_time ? `Time: ${formatTime(group.meeting_time)}` : '',
            group.meeting_location ? `Location: ${group.meeting_location}` : ''
        ].filter(Boolean).join(' • ');
        document.getElementById('rosterMeetingInfo').textContent = schedStr || 'Schedule details not set';

        // Update 4 hierarchy stats
        document.getElementById('rosterCountPrimaryMentor').textContent = '1';
        document.getElementById('rosterCountMentees').textContent = group.mentees_count || '0';
        document.getElementById('rosterCountSecMentors').textContent = group.secondary_mentors_count || '0';
        document.getElementById('rosterCountTotal').textContent = group.total_size || '1';

        // Reset selected mentee selection
        clearSelectedMentee();

        renderC2SRosterTable(group);
    } catch (error) {
        console.error('Error loading roster:', error);
        showToast('Error loading roster: ' + error.message);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-rose-500"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Failed to load roster.</td></tr>`;
        }
    }
}

function renderC2SRosterTable(group) {
    const tbody = document.getElementById('c2sRosterTableBody');
    if (!tbody) return;

    let rowsHtml = '';

    // 1. Leader (Primary Mentor) Row
    rowsHtml += `
        <tr style="background: #fffbeb;" class="border-b border-amber-200">
            <td class="p-3">
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${group.leader_profile_image 
                        ? `<img src="${escapeHtml(group.leader_profile_image)}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #fde68a;" onerror="this.outerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:#fef3c7;color:#b45309;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;flex-shrink:0;\\'>${escapeHtml((group.leader_name || 'L').charAt(0))}</div>'">`
                        : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">${escapeHtml((group.leader_name || 'L').charAt(0))}</div>`
                    }
                    <div>
                        <div style="font-weight: 700; color: #92400e; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-crown text-amber-500"></i> ${escapeHtml(group.leader_name || 'Unassigned')}
                        </div>
                        <div class="text-xs text-amber-700">Cell Group Leader</div>
                    </div>
                </div>
            </td>
            <td class="p-3 text-xs text-slate-600">
                <div>${escapeHtml(group.leader_email || '—')}</div>
                <div class="text-slate-400">${escapeHtml(group.leader_contact || '—')}</div>
            </td>
            <td class="p-3 text-center">
                <span class="badge c2s-badge-mentor">
                    <i class="fa-solid fa-user-tie mr-1"></i> Primary Mentor
                </span>
            </td>
            <td class="p-3 text-xs text-slate-500">
                <div>Leader of this cell group</div>
            </td>
            <td class="p-3 text-right">
                <span class="text-xs text-slate-400 font-medium italic">Leader (Immutable here)</span>
            </td>
        </tr>
    `;

    // 2. Member Rows (Mentees and Secondary Mentors)
    const members = group.members || [];
    if (members.length === 0) {
        rowsHtml += `
            <tr>
                <td colspan="5" class="text-center p-8 text-slate-400">
                    <i class="fa-solid fa-user-group text-2xl mb-1 block opacity-30"></i>
                    No additional mentees or participants yet. Use the bar above to add members.
                </td>
            </tr>
        `;
    } else {
        members.forEach(m => {
            const isSecondaryMentor = m.designation === 'Secondary Mentor';
            const designationBadge = isSecondaryMentor
                ? `<span class="badge c2s-badge-sec-mentor" title="This mentee has stepped up and now leads their own cell group elsewhere! System designation: Mentor.">
                     <i class="fa-solid fa-award mr-1"></i> Secondary Mentor
                   </span>`
                : `<span class="badge c2s-badge-mentee" title="Active Mentee under this cell group">
                     <i class="fa-solid fa-user-graduate mr-1"></i> Mentee
                   </span>`;

            const joinedStr = m.joined_date ? new Date(m.joined_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

            rowsHtml += `
                <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                    <td class="p-3">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${m.profile_image 
                                ? `<img src="${escapeHtml(m.profile_image)}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;" onerror="this.outerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;flex-shrink:0;\\'>${escapeHtml((m.first_name || 'M').charAt(0))}</div>'">`
                                : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">${escapeHtml((m.first_name || 'M').charAt(0))}</div>`
                            }
                            <div>
                                <div style="font-weight: 600; color: #1e293b;">${escapeHtml(m.full_name)}</div>
                                <div class="text-xs text-slate-400">ID: #${m.member_id}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-3 text-xs text-slate-600">
                        <div>${escapeHtml(m.email || '—')}</div>
                        <div class="text-slate-400">${escapeHtml(m.contact_number || '—')}</div>
                    </td>
                    <td class="p-3 text-center">
                        ${designationBadge}
                    </td>
                    <td class="p-3 text-xs text-slate-600">
                        <div>Joined: ${joinedStr}</div>
                        ${m.notes ? `<div class="text-slate-500 italic mt-0.5">"${escapeHtml(m.notes)}"</div>` : ''}
                    </td>
                    <td class="p-3 text-right">
                        <button class="btn-secondary btn-sm text-rose-600 hover:bg-rose-50" onclick="removeMemberFromC2SGroup(${m.member_id}, '${escapeHtml(m.full_name)}')" title="Remove member from this cell group" style="padding: 4px 8px; font-size: 0.78rem;">
                            <i class="fa-solid fa-user-minus mr-1"></i> Remove
                        </button>
                    </td>
                </tr>
            `;
        });
    }

    tbody.innerHTML = rowsHtml;
}

async function addMemberToC2SGroup() {
    if (!activeRosterGroupId) return;

    const menteeIdInput = document.getElementById('c2sSelectedMenteeId');
    const notesInput = document.getElementById('c2sMemberNotes');
    const member_id = menteeIdInput?.value;
    const notes = notesInput?.value.trim() || null;

    if (!member_id) {
        showToast('Please click "Select Mentees" to choose a church member.');
        return;
    }

    try {
        await api.c2s.addMember(activeRosterGroupId, { member_id: parseInt(member_id, 10), notes });
        showToast('Member successfully added to cell group!');
        clearSelectedMentee();
        if (notesInput) notesInput.value = '';
        await loadC2SRosterDetails();
        await loadC2SGroups();
    } catch (error) {
        showToast('Error adding member: ' + error.message);
    }
}

async function removeMemberFromC2SGroup(memberId, memberName) {
    if (!activeRosterGroupId) return;

    const ok = await showDecisionModal({
        title: 'Remove Member from Cell Group',
        message: `Are you sure you want to remove ${memberName} from this cell group?`,
        confirmText: 'Remove Member',
        type: 'danger',
        icon: 'fa-user-minus'
    });
    if (!ok) return;

    try {
        await api.c2s.removeMember(activeRosterGroupId, memberId);
        showToast(`${memberName} removed from cell group.`);
        await loadC2SRosterDetails();
        await loadC2SGroups();
    } catch (error) {
        showToast('Error removing member: ' + error.message);
    }
}


// ==========================================
// 1. SELECT MENTOR LOGIC (RELATIONSHIP DEPT LEADERS & MEMBERS ONLY)
// ==========================================
let mentorSelectionCache = [];

async function openSelectMentorModal() {
    const listContainer = document.getElementById('mentorModalListContainer');
    const searchInput = document.getElementById('mentorModalSearchInput');
    const ageFilterSelect = document.getElementById('mentorModalAgeGroupFilter');
    if (searchInput) searchInput.value = '';
    if (ageFilterSelect) ageFilterSelect.value = '';

    if (listContainer) {
        listContainer.innerHTML = '<div class="p-6 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading eligible Relationship Department church members & leaders...</div>';
    }

    const modal = document.getElementById('selectMentorModal');
    if (modal) modal.classList.add('active');

    try {
        const res = await api.c2s.getAvailableMembers();
        const rawMembers = res.data || [];
        // Include eligible Church Members and Church Leaders assigned to Relationship Department!
        mentorSelectionCache = rawMembers.filter(m => {
            const role = (m.church_role || '').toLowerCase();
            return role !== 'admin';
        });
        applyMentorModalFilters();
    } catch (err) {
        console.error('Failed to load mentors:', err);
        if (listContainer) {
            listContainer.innerHTML = '<div class="p-6 text-center text-rose-500"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Failed to load members.</div>';
        }
    }
}

function closeSelectMentorModal() {
    const modal = document.getElementById('selectMentorModal');
    if (modal) modal.classList.remove('active');
}

function renderMentorModalList(members) {
    const container = document.getElementById('mentorModalListContainer');
    if (!container) return;

    if (members.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-slate-400"><i class="fa-solid fa-user-slash mr-2"></i> No eligible church leaders or members found in Relationship Department matching criteria.</div>';
        return;
    }

    const currentSelectedId = document.getElementById('c2s_leader_id')?.value;

    container.innerHTML = `
        <table class="w-full text-sm text-left modal-select-table">
            <thead class="bg-slate-50 text-slate-500 uppercase text-xs sticky top-0">
                <tr>
                    <th class="p-3">Member / Leader</th>
                    <th class="p-3">Age Group & Ministry</th>
                    <th class="p-3">C2S Status</th>
                    <th class="p-3">Contact</th>
                    <th class="p-3 text-right">Action</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                ${members.map(m => {
                    const isSelected = String(m.member_id) === String(currentSelectedId);
                    const desigBadge = m.system_designation === 'Mentor'
                        ? `<span class="badge" style="background: #fef3c7; color: #b45309; font-size: 0.7rem;"><i class="fa-solid fa-crown mr-1"></i> Already Mentor (${escapeHtml(m.led_group_name || 'Group')})</span>`
                        : (m.system_designation === 'Mentee'
                            ? `<span class="badge" style="background: #ecfdf5; color: #059669; font-size: 0.7rem;"><i class="fa-solid fa-user-group mr-1"></i> Current Mentee</span>`
                            : `<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.7rem;">Available Member</span>`);

                    const age = getMemberAge(m);
                    const ageGroup = getMemberAgeGroup(m);
                    const ageDisplay = age !== null ? `${age} yrs &bull; ${ageGroup}` : (ageGroup !== 'Unspecified' ? ageGroup : 'Age N/A');
                    const relMinistry = m.relationship_ministries || 'Relationship Dept';

                    return `
                        <tr class="hover:bg-slate-50 transition modal-select-row ${isSelected ? 'bg-amber-50/50' : ''}">
                            <td class="p-3">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    ${m.profile_image 
                                        ? `<img src="${escapeHtml(m.profile_image)}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;" onerror="this.outerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;flex-shrink:0;\\'>${escapeHtml((m.first_name || 'M').charAt(0))}</div>'">`
                                        : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">${escapeHtml((m.first_name || 'M').charAt(0))}</div>`
                                    }
                                    <div>
                                        <div class="modal-person-name" style="font-weight: 600; color: #1e293b;">${escapeHtml(m.full_name)}</div>
                                        <span class="badge" style="font-size: 0.68rem; padding: 1px 6px; ${m.church_role === 'Leader' ? 'background: #e0e7ff; color: #3730a3;' : 'background: #f1f5f9; color: #475569;'}">${m.church_role === 'Leader' ? 'Church Leader' : 'Church Member'}</span>
                                    </div>
                                </div>
                            </td>
                            <td class="p-3">
                                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                                    <span class="badge" style="background: rgba(99, 102, 241, 0.12); color: #4338ca; border: 1px solid rgba(99, 102, 241, 0.25); font-size: 0.68rem; padding: 1px 6px;">
                                        <i class="fa-solid fa-cake-candles mr-1"></i> ${escapeHtml(ageDisplay)}
                                    </span>
                                    <span class="badge" style="background: rgba(245, 158, 11, 0.12); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.68rem; padding: 1px 6px;" title="Assigned Ministry under Relationship Department">
                                        <i class="fa-solid fa-people-arrows mr-1"></i> ${escapeHtml(relMinistry)}
                                    </span>
                                </div>
                            </td>
                            <td class="p-3">${desigBadge}</td>
                            <td class="p-3 text-xs text-slate-500">
                                <div class="modal-person-contact">${escapeHtml(m.email || '—')}</div>
                                <div class="text-slate-400">${escapeHtml(m.contact_number || '—')}</div>
                            </td>
                            <td class="p-3 text-right">
                                <button type="button" class="btn-${isSelected ? 'primary' : 'secondary'} btn-sm" onclick="selectMentorForC2S('${m.member_id}', '${escapeHtml(m.full_name).replace(/'/g, "\\'")}', '${m.system_designation || 'Member'}')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; white-space: nowrap;">
                                    ${isSelected ? '<i class="fa-solid fa-check mr-1"></i> Selected' : 'Select Mentor'}
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function applyMentorModalFilters() {
    const q = (document.getElementById('mentorModalSearchInput')?.value || '').toLowerCase().trim();
    const ageFilter = document.getElementById('mentorModalAgeGroupFilter')?.value || '';

    let filtered = mentorSelectionCache;
    if (ageFilter) {
        filtered = filtered.filter(m => matchesAgeGroupFilter(m, ageFilter));
    }
    if (q) {
        filtered = filtered.filter(m => 
            (m.full_name && m.full_name.toLowerCase().includes(q)) ||
            (m.email && m.email.toLowerCase().includes(q)) ||
            (m.contact_number && m.contact_number.toLowerCase().includes(q)) ||
            (m.relationship_ministries && m.relationship_ministries.toLowerCase().includes(q))
        );
    }
    renderMentorModalList(filtered);
}

function filterMentorModalList(query) {
    applyMentorModalFilters();
}

function selectMentorForC2S(memberId, memberName, designation = '') {
    const input = document.getElementById('c2s_leader_id');
    const textEl = document.getElementById('selectedMentorText');
    const clearBtn = document.getElementById('btnClearSelectedMentor');

    if (input) input.value = memberId;
    if (textEl) {
        textEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: #fef3c7; color: #b45309; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">
                    ${escapeHtml(memberName.charAt(0))}
                </span>
                <strong style="color: var(--navy);">${escapeHtml(memberName)}</strong>
                <span class="badge" style="background: #fef3c7; color: #b45309; font-size: 0.7rem; padding: 1px 6px;">Mentor</span>
            </div>
        `;
    }
    if (clearBtn) clearBtn.style.display = 'inline-block';
    closeSelectMentorModal();
}

function clearSelectedMentor() {
    const input = document.getElementById('c2s_leader_id');
    const textEl = document.getElementById('selectedMentorText');
    const clearBtn = document.getElementById('btnClearSelectedMentor');
    if (input) input.value = '';
    if (textEl) textEl.innerHTML = '<i class="fa-regular fa-user mr-1 text-slate-400"></i> No mentor selected';
    if (clearBtn) clearBtn.style.display = 'none';
}


// ==========================================
// 2. SELECT MENTEES LOGIC (RELATIONSHIP DEPT LEADERS & MEMBERS ONLY)
// ==========================================
let menteesSelectionCache = [];

async function openSelectMenteesModal() {
    const listContainer = document.getElementById('menteesModalListContainer');
    const searchInput = document.getElementById('menteesModalSearchInput');
    const ageFilterSelect = document.getElementById('menteesModalAgeGroupFilter');
    if (searchInput) searchInput.value = '';
    if (ageFilterSelect) ageFilterSelect.value = '';

    if (listContainer) {
        listContainer.innerHTML = '<div class="p-6 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading eligible Relationship Department church members & leaders...</div>';
    }

    const modal = document.getElementById('selectMenteesModal');
    if (modal) modal.classList.add('active');

    try {
        const res = await api.c2s.getAvailableMembers({ excludeGroupId: activeRosterGroupId });
        const rawMembers = res.data || [];
        // Include eligible Church Members and Church Leaders assigned to Relationship Department!
        menteesSelectionCache = rawMembers.filter(m => {
            const role = (m.church_role || '').toLowerCase();
            return role !== 'admin';
        });
        applyMenteesModalFilters();
    } catch (err) {
        console.error('Failed to load mentees:', err);
        if (listContainer) {
            listContainer.innerHTML = '<div class="p-6 text-center text-rose-500"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Failed to load members.</div>';
        }
    }
}

function closeSelectMenteesModal() {
    const modal = document.getElementById('selectMenteesModal');
    if (modal) modal.classList.remove('active');
}

function renderMenteesModalList(members) {
    const container = document.getElementById('menteesModalListContainer');
    if (!container) return;

    if (members.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-slate-400"><i class="fa-solid fa-user-slash mr-2"></i> No eligible church leaders or members found in Relationship Department matching criteria.</div>';
        return;
    }

    const currentSelectedId = document.getElementById('c2sSelectedMenteeId')?.value;

    container.innerHTML = `
        <table class="w-full text-sm text-left modal-select-table">
            <thead class="bg-slate-50 text-slate-500 uppercase text-xs sticky top-0">
                <tr>
                    <th class="p-3">Member / Leader</th>
                    <th class="p-3">Age Group & Ministry</th>
                    <th class="p-3">Discipleship Status</th>
                    <th class="p-3">Contact</th>
                    <th class="p-3 text-right" style="width: 190px;">Action</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                ${members.map(m => {
                    const isSelected = String(m.member_id) === String(currentSelectedId);
                    const desigBadge = m.system_designation === 'Mentor'
                        ? `<span class="badge c2s-badge-sec-mentor" style="background: #fffbeb; color: #92400e; border: 1px solid #fde68a; font-size: 0.7rem; font-weight: 600;"><i class="fa-solid fa-crown mr-1"></i> Secondary Mentor</span>`
                        : `<span class="badge" style="background: #ecfdf5; color: #059669; font-size: 0.7rem;"><i class="fa-solid fa-user-group mr-1"></i> Mentee</span>`;

                    const age = getMemberAge(m);
                    const ageGroup = getMemberAgeGroup(m);
                    const ageDisplay = age !== null ? `${age} yrs &bull; ${ageGroup}` : (ageGroup !== 'Unspecified' ? ageGroup : 'Age N/A');
                    const relMinistry = m.relationship_ministries || 'Relationship Dept';

                    return `
                        <tr class="hover:bg-slate-50 transition modal-select-row ${isSelected ? 'bg-blue-50/50' : ''}">
                            <td class="p-3">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    ${m.profile_image 
                                        ? `<img src="${escapeHtml(m.profile_image)}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;" onerror="this.outerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;flex-shrink:0;\\'>${escapeHtml((m.first_name || 'M').charAt(0))}</div>'">`
                                        : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">${escapeHtml((m.first_name || 'M').charAt(0))}</div>`
                                    }
                                    <div>
                                        <div class="modal-person-name" style="font-weight: 600; color: #1e293b;">${escapeHtml(m.full_name)}</div>
                                        <span class="badge" style="font-size: 0.68rem; padding: 1px 6px; ${m.church_role === 'Leader' ? 'background: #e0e7ff; color: #3730a3;' : 'background: #f1f5f9; color: #475569;'}">${m.church_role === 'Leader' ? 'Church Leader' : 'Church Member'}</span>
                                    </div>
                                </div>
                            </td>
                            <td class="p-3">
                                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                                    <span class="badge" style="background: rgba(99, 102, 241, 0.12); color: #4338ca; border: 1px solid rgba(99, 102, 241, 0.25); font-size: 0.68rem; padding: 1px 6px;">
                                        <i class="fa-solid fa-cake-candles mr-1"></i> ${escapeHtml(ageDisplay)}
                                    </span>
                                    <span class="badge" style="background: rgba(245, 158, 11, 0.12); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.68rem; padding: 1px 6px;" title="Assigned Ministry under Relationship Department">
                                        <i class="fa-solid fa-people-arrows mr-1"></i> ${escapeHtml(relMinistry)}
                                    </span>
                                </div>
                            </td>
                            <td class="p-3">${desigBadge}</td>
                            <td class="p-3 text-xs text-slate-500">
                                <div class="modal-person-contact">${escapeHtml(m.email || '—')}</div>
                                <div class="text-slate-400">${escapeHtml(m.contact_number || '—')}</div>
                            </td>
                            <td class="p-3 text-right" style="white-space: nowrap; width: 190px;">
                                <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px;">
                                    <button type="button" class="btn-primary btn-sm" onclick="selectMenteeForC2S('${m.member_id}', '${escapeHtml(m.full_name).replace(/'/g, "\\'")}', '${m.system_designation || 'Mentee'}')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; white-space: nowrap;">
                                        <i class="fa-solid fa-check mr-1"></i> Select
                                    </button>
                                    <button type="button" class="btn-secondary btn-sm" onclick="quickAddMenteeDirectly('${m.member_id}', '${escapeHtml(m.full_name).replace(/'/g, "\\'")}')" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; white-space: nowrap;" title="Add directly to cell group now">
                                        <i class="fa-solid fa-plus text-primary mr-1"></i> Add Now
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function applyMenteesModalFilters() {
    const q = (document.getElementById('menteesModalSearchInput')?.value || '').toLowerCase().trim();
    const ageFilter = document.getElementById('menteesModalAgeGroupFilter')?.value || '';

    let filtered = menteesSelectionCache;
    if (ageFilter) {
        filtered = filtered.filter(m => matchesAgeGroupFilter(m, ageFilter));
    }
    if (q) {
        filtered = filtered.filter(m => 
            (m.full_name && m.full_name.toLowerCase().includes(q)) ||
            (m.email && m.email.toLowerCase().includes(q)) ||
            (m.contact_number && m.contact_number.toLowerCase().includes(q)) ||
            (m.relationship_ministries && m.relationship_ministries.toLowerCase().includes(q))
        );
    }
    renderMenteesModalList(filtered);
}

function filterMenteesModalList(query) {
    applyMenteesModalFilters();
}

function selectMenteeForC2S(memberId, memberName, designation = '') {
    const input = document.getElementById('c2sSelectedMenteeId');
    const textEl = document.getElementById('selectedMenteeText');
    const clearBtn = document.getElementById('btnClearSelectedMentee');

    if (input) input.value = memberId;
    if (textEl) {
        textEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 22px; height: 22px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: inline-flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700;">
                    ${escapeHtml(memberName.charAt(0))}
                </span>
                <strong style="color: var(--navy); font-size: 0.85rem;">${escapeHtml(memberName)}</strong>
                <span class="badge" style="background: #ecfdf5; color: #059669; font-size: 0.68rem; padding: 1px 6px;">Mentee</span>
            </div>
        `;
    }
    if (clearBtn) clearBtn.style.display = 'inline-block';
    closeSelectMenteesModal();
}

async function quickAddMenteeDirectly(memberId, memberName) {
    if (!activeRosterGroupId) return;
    try {
        await api.c2s.addMember(activeRosterGroupId, { member_id: parseInt(memberId, 10), notes: null });
        showToast(`${memberName} added directly to cell group!`);
        closeSelectMenteesModal();
        clearSelectedMentee();
        await loadC2SRosterDetails();
        await loadC2SGroups();
    } catch (error) {
        showToast('Error adding mentee: ' + error.message);
    }
}

function clearSelectedMentee() {
    const input = document.getElementById('c2sSelectedMenteeId');
    const textEl = document.getElementById('selectedMenteeText');
    const clearBtn = document.getElementById('btnClearSelectedMentee');
    if (input) input.value = '';
    if (textEl) textEl.innerHTML = '<i class="fa-regular fa-user mr-1 text-slate-400"></i> No mentee selected';
    if (clearBtn) clearBtn.style.display = 'none';
}


// ==========================================
// 3. SELECT LEADERS LOGIC (CHURCH LEADERS ONLY)
// ==========================================
let leaderSelectionCache = [];

async function openSelectLeaderModal() {
    const listContainer = document.getElementById('leaderModalListContainer');
    const searchInput = document.getElementById('leaderModalSearchInput');
    if (searchInput) searchInput.value = '';

    if (listContainer) {
        listContainer.innerHTML = '<div class="p-6 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading church leaders...</div>';
    }

    const modal = document.getElementById('selectLeaderModal');
    if (modal) modal.classList.add('active');

    try {
        if (!allMembersCache || allMembersCache.length === 0) {
            const res = await api.members.getAll();
            allMembersCache = res.data || [];
        }

        // Filter church leaders only!
        leaderSelectionCache = (allMembersCache || []).filter(m => {
            const churchRole = (m.church_role || '').toLowerCase();
            const systemRole = (m.system_role || '').toLowerCase();
            return churchRole === 'leader' || churchRole === 'admin' || systemRole === 'admin' || systemRole === 'church leader';
        });

        renderLeaderModalList(leaderSelectionCache);
    } catch (err) {
        console.error('Failed to load leaders:', err);
        if (listContainer) {
            listContainer.innerHTML = '<div class="p-6 text-center text-rose-500"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Failed to load leaders.</div>';
        }
    }
}

function closeSelectLeaderModal() {
    const modal = document.getElementById('selectLeaderModal');
    if (modal) modal.classList.remove('active');
}

function renderLeaderModalList(leaders) {
    const container = document.getElementById('leaderModalListContainer');
    if (!container) return;

    if (leaders.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-slate-400">No designated church leaders found.</div>';
        return;
    }

    const currentSelectedId = document.getElementById('leader_member_id')?.value;

    container.innerHTML = `
        <table class="w-full text-sm text-left">
            <thead class="bg-slate-50 text-slate-500 uppercase text-xs sticky top-0">
                <tr>
                    <th class="p-3">Leader</th>
                    <th class="p-3">Role</th>
                    <th class="p-3">Contact</th>
                    <th class="p-3 text-right">Action</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                ${leaders.map(l => {
                    const isSelected = String(l.member_id) === String(currentSelectedId);
                    const fullName = `${l.first_name || ''} ${l.last_name || ''}`.trim();

                    return `
                        <tr class="hover:bg-slate-50 transition ${isSelected ? 'bg-amber-50/50' : ''}">
                            <td class="p-3">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    ${l.profile_image 
                                        ? `<img src="${escapeHtml(l.profile_image)}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #fde68a;" onerror="this.outerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:#fef3c7;color:#b45309;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;\\'>${escapeHtml(fullName.charAt(0) || 'L')}</div>'">`
                                        : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">${escapeHtml(fullName.charAt(0) || 'L')}</div>`
                                    }
                                    <div>
                                        <div style="font-weight: 600; color: #1e293b;">${escapeHtml(fullName)}</div>
                                        <span class="text-xs text-slate-400">${escapeHtml(l.status || 'Active')}</span>
                                    </div>
                                </div>
                            </td>
                            <td class="p-3">
                                <span class="badge" style="${(l.church_role || '').toLowerCase() === 'admin' || (l.system_role || '').toLowerCase() === 'admin' ? 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;' : 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;'} font-weight: 600; font-size: 0.72rem;">
        <i class="fa-solid ${(l.church_role || '').toLowerCase() === 'admin' || (l.system_role || '').toLowerCase() === 'admin' ? 'fa-shield-halved' : 'fa-crown'} mr-1"></i> ${escapeHtml(l.church_role || (l.system_role === 'Admin' ? 'Admin' : 'Leader'))}
    </span>
                            </td>
                            <td class="p-3 text-xs text-slate-500">
                                <div>${escapeHtml(l.email || '—')}</div>
                                <div class="text-slate-400">${escapeHtml(l.contact_number || '—')}</div>
                            </td>
                            <td class="p-3 text-right">
                                <button type="button" class="btn-${isSelected ? 'primary' : 'secondary'} btn-sm" onclick="selectLeaderForMinistry('${l.member_id}', '${escapeHtml(fullName).replace(/'/g, "\\'")}')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
                                    ${isSelected ? '<i class="fa-solid fa-check mr-1"></i> Selected' : 'Assign Leader'}
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function filterLeaderModalList(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
        renderLeaderModalList(leaderSelectionCache);
        return;
    }
    const filtered = leaderSelectionCache.filter(l => {
        const fullName = `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase();
        return fullName.includes(q) ||
            (l.email && l.email.toLowerCase().includes(q)) ||
            (l.contact_number && l.contact_number.toLowerCase().includes(q));
    });
    renderLeaderModalList(filtered);
}

function selectLeaderForMinistry(memberId, memberName) {
    const input = document.getElementById('leader_member_id');
    const textEl = document.getElementById('selectedLeaderText');
    const clearBtn = document.getElementById('btnClearSelectedLeader');

    if (input) input.value = memberId;
    if (textEl) {
        textEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: #fef3c7; color: #b45309; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">
                    ${escapeHtml(memberName.charAt(0))}
                </span>
                <strong style="color: var(--navy);">${escapeHtml(memberName)}</strong>
                <span class="badge" style="background: #fef3c7; color: #b45309; font-size: 0.7rem; padding: 1px 6px;">Ministry Leader</span>
            </div>
        `;
    }
    if (clearBtn) clearBtn.style.display = 'inline-block';
    closeSelectLeaderModal();
}

function clearSelectedLeader() {
    const input = document.getElementById('leader_member_id');
    const textEl = document.getElementById('selectedLeaderText');
    const clearBtn = document.getElementById('btnClearSelectedLeader');
    if (input) input.value = '';
    if (textEl) textEl.innerHTML = '<i class="fa-regular fa-user mr-1 text-slate-400"></i> No leader assigned';
    if (clearBtn) clearBtn.style.display = 'none';
}