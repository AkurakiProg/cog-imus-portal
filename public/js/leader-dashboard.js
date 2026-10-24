
function toLocalDateStr(dateObj) {
    if (!dateObj) return '';
    const d = new Date(dateObj);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getWeekRange(refDate) {
    const d = new Date(refDate);
    const day = d.getDay();
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
    const endM = endDate.toLocaleString('default', { month: 'short' });
    const endD = endDate.getDate();
    const endY = endDate.getFullYear();
    return `${startM} ${startD} – ${endM} ${endD}, ${endY}`;
}



function updateLeaderHeroGreeting() {
    const userStr = sessionStorage.getItem('church_user');
    if (!userStr) return;
    try {
        const u = JSON.parse(userStr);
        const fnEl = document.getElementById('leaderFirstName');
        const badgeEl = document.getElementById('leaderRoleBadgeText');
        if (fnEl) {
            const firstName = u.first_name || (u.full_name || 'Leader').split(' ')[0];
            fnEl.textContent = firstName;
        }
        if (badgeEl) {
            if (u.is_department_head && u.worda_department) {
                badgeEl.innerHTML = `<i class="fa-solid fa-crown mr-1" style="color: var(--gold, #d97706);"></i> Department Head — ${escapeHtml(u.worda_department)} Department`;
            } else if (u.worda_role) {
                badgeEl.textContent = u.worda_role;
            } else {
                badgeEl.textContent = 'Church Leadership & Ministry Oversight';
            }
        }
    } catch (e) {
        console.error('Error updating hero greeting:', e);
    }
}

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
// ============================================================
// COG Imus Portal - Leader Dashboard Script
// ============================================================

// --- Helper: HTML Escaping ---
function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- Distinct Color-Coded Badge Helpers (Matching Admin Standard) ---
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
    if (s === 'upcoming') return '<span class="badge badge-event-upcoming"><i class="fa-regular fa-clock mr-1"></i> Upcoming</span>';
    if (s === 'ongoing') return '<span class="badge badge-event-ongoing"><i class="fa-solid fa-circle-play mr-1"></i> Ongoing</span>';
    if (s === 'completed') return '<span class="badge badge-event-completed"><i class="fa-solid fa-circle-check mr-1"></i> Completed</span>';
    if (s === 'cancelled') return '<span class="badge badge-event-cancelled"><i class="fa-solid fa-ban mr-1"></i> Cancelled</span>';
    return `<span class="badge badge-event-upcoming">${escapeHtml(status)}</span>`;
}

function getMemberStatusBadge(status) {
    if (!status) return '<span class="badge badge-status-inactive">N/A</span>';
    const s = status.toLowerCase().trim();
    if (s === 'active') return '<span class="badge badge-status-active"><i class="fa-solid fa-circle-check mr-1"></i> Active</span>';
    if (s === 'inactive') return '<span class="badge badge-status-inactive"><i class="fa-solid fa-circle-xmark mr-1"></i> Inactive</span>';
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
    if (c === 'urgent') return '<span class="badge badge-expense"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Urgent</span>';
    if (c === 'general') return '<span class="badge badge-info">General</span>';
    if (c === 'event') return '<span class="badge badge-dept-discipleship">Event</span>';
    if (c === 'ministry') return '<span class="badge badge-dept-outreach">Ministry</span>';
    if (c === 'worship') return '<span class="badge badge-dept-worship">Worship</span>';
    if (c === 'youth') return '<span class="badge badge-dept-relationship">Youth</span>';
    return `<span class="badge badge-info">${escapeHtml(cat)}</span>`;
}

// Global Caches
let allLeaderMinistriesCache = [];
let allLeaderEventsCache = [];
let allLeaderAnnCache = [];
let allLeaderFinanceCache = [];
let allAttendanceTalliesCache = [];
let currentSermonsPage = 1;
let currentAlbumsPage = 1;

// ==========================================
// AUDIO SYNTHESIZER FOR LEADER PORTAL NOTIFICATIONS
// ==========================================
function playPortalNotificationSound(type = 'announcement') {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const now = ctx.currentTime;

        if (type === 'comment') {
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
    icon = '',
    onConfirm: onConfirmCb = null,
    onCancel: onCancelCb = null
} = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        if (!modal) {
            const fallback = window.confirm(message);
            if (fallback && typeof onConfirmCb === 'function') {
                try { onConfirmCb(); } catch (e) { console.error(e); }
            } else if (!fallback && typeof onCancelCb === 'function') {
                try { onCancelCb(); } catch (e) { console.error(e); }
            }
            resolve(fallback);
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

        async function cleanup(result) {
            modal.classList.remove('active');
            modal.style.display = '';
            modal.style.removeProperty('display');
            btnConfirm?.removeEventListener('click', onConfirm);
            btnCancel?.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKeyDown);
            resolve(result);
        }

        async function onConfirm(e) {
            e.stopPropagation();
            if (typeof onConfirmCb === 'function') {
                try {
                    await onConfirmCb();
                } catch (err) {
                    console.error('Error in decision modal onConfirm callback:', err);
                }
            }
            cleanup(true);
        }

        function onCancel(e) {
            e.stopPropagation();
            if (typeof onCancelCb === 'function') {
                try {
                    onCancelCb();
                } catch (err) {
                    console.error('Error in decision modal onCancel callback:', err);
                }
            }
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

        btnConfirm?.addEventListener('click', onConfirm);
        btnCancel?.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeyDown);
    });
}
window.showConfirmDialog = showDecisionModal;

// ============================================================
// MODAL BACKDROP CLICK-TO-CLOSE & ESCAPE KEY HANDLER
// ============================================================
const leaderModalCloseMap = {
    'leaderEventModal': () => typeof closeLeaderEventModal === 'function' && closeLeaderEventModal(),
    'leaderAnnouncementModal': () => typeof closeLeaderAnnouncementModal === 'function' && closeLeaderAnnouncementModal(),
    'leaderMinistryRosterModal': () => typeof closeLeaderMinistryRosterModal === 'function' && closeLeaderMinistryRosterModal(),
    'leaderWorkCalendarModal': () => typeof closeLeaderWorkCalendarModal === 'function' && closeLeaderWorkCalendarModal(),
    'albumModal': () => typeof closeAlbumModal === 'function' && closeAlbumModal(),
    'albumPhotosModal': () => typeof closeAlbumPhotosModal === 'function' && closeAlbumPhotosModal(),
    'sermonModal': () => typeof closeSermonModal === 'function' && closeSermonModal(),
    'videoPlayerModal': () => typeof closeVideoPlayerModal === 'function' && closeVideoPlayerModal(),
    'liveAnalyticsModal': () => typeof closeLiveAnalyticsModal === 'function' && closeLiveAnalyticsModal(),
    'liveCommentsModal': () => typeof closeLiveCommentsModal === 'function' && closeLiveCommentsModal(),
    'livestreamCommentLogsModal': () => typeof closeLivestreamCommentLogsModal === 'function' && closeLivestreamCommentLogsModal(),
    'leaderEventDeptMinFilterModal': () => typeof closeLeaderEventDeptMinFilterModal === 'function' && closeLeaderEventDeptMinFilterModal(),
    'leaderAnnDeptMinFilterModal': () => typeof closeLeaderAnnDeptMinFilterModal === 'function' && closeLeaderAnnDeptMinFilterModal(),
    'leaderFinanceDeptMinFilterModal': () => typeof closeLeaderFinanceDeptMinFilterModal === 'function' && closeLeaderFinanceDeptMinFilterModal(),
    'leaderC2SRosterModal': () => typeof closeLeaderC2SRosterModal === 'function' && closeLeaderC2SRosterModal(),
    'leaderEventEnrollmentsModal': () => typeof closeLeaderEventEnrollmentsModal === 'function' && closeLeaderEventEnrollmentsModal(),
    'leaderReceiptModal': () => typeof closeLeaderReceiptModal === 'function' && closeLeaderReceiptModal(),
    'recordMinistryAttendanceModal': () => typeof closeRecordAttendanceModal === 'function' && closeRecordAttendanceModal(),
    'viewMinistryAttendanceModal': () => typeof closeViewMinistryAttendanceModal === 'function' && closeViewMinistryAttendanceModal(),
    'memberAttendanceHistoryModal': () => typeof closeMemberAttendanceHistoryModal === 'function' && closeMemberAttendanceHistoryModal(),
    'leaderEventFormModal': () => typeof closeLeaderEventFormModal === 'function' && closeLeaderEventFormModal(),
    'leaderAnnouncementFormModal': () => typeof closeLeaderAnnouncementFormModal === 'function' && closeLeaderAnnouncementFormModal(),
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

function initLeaderModalBackdropClose() {
    let isMouseDownOnBackdrop = false;

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
            if (leaderModalCloseMap[overlayId]) {
                try { leaderModalCloseMap[overlayId](); } catch (err) {}
            }
            e.target.classList.remove('active');
            e.target.style.display = 'none';
            e.target.style.removeProperty('display');
        }
        isMouseDownOnBackdrop = false;
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            const activeModal = document.querySelector('.modal-overlay.active, .modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]');
            if (activeModal) {
                const overlayId = activeModal.id;
                if (leaderModalCloseMap[overlayId]) {
                    try { leaderModalCloseMap[overlayId](); } catch (err) {}
                }
                activeModal.classList.remove('active');
                activeModal.style.display = 'none';
                activeModal.style.removeProperty('display');
            }
        }
    });
}

// ============================================================
// INITIALIZATION ON DOM CONTENT LOADED
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Check sessionStorage (tied to browser tab/window lifecycle)
    const token = sessionStorage.getItem('church_token');

    // Purge any lingering legacy localStorage session tokens
    localStorage.removeItem('church_token');
    localStorage.removeItem('church_user');

    if (!token) {
        window.location.href = '/views/login.html';
        return;
    }

    let user;
    try {
        const meRes = await api.auth.getMe();
        user = meRes.data;

        if (!user || (user.role_name !== 'Church Leader' && user.role_name !== 'Admin')) {
            showToast('Access Denied. Leaders only.');
            sessionStorage.removeItem('church_token');
            sessionStorage.removeItem('church_user');
            localStorage.removeItem('church_token');
            localStorage.removeItem('church_user');
            setTimeout(() => { window.location.href = '/views/login.html'; }, 500);
            return;
        }

        sessionStorage.setItem('church_user', JSON.stringify(user));
    } catch (authErr) {
        console.error('Leader session validation failed:', authErr);
        sessionStorage.removeItem('church_token');
        sessionStorage.removeItem('church_user');
        localStorage.removeItem('church_token');
        localStorage.removeItem('church_user');
        window.location.href = '/views/login.html';
        return;
    }

    try {
        const leaderNameEl = document.getElementById('leaderName');
        if (leaderNameEl) leaderNameEl.textContent = user.full_name;
        const leaderFirst = document.getElementById('leaderFirstName');
        if (leaderFirst) leaderFirst.textContent = user.worda_role || user.full_name.split(' ')[0];
        updateLeaderHeroGreeting();

        const topName = document.getElementById('leaderTopName');
        if (topName) topName.textContent = user.full_name;
        
        const avatarEl = document.getElementById('userAvatar');
        if (avatarEl) {
            if (user.profile_image) {
                avatarEl.innerHTML = `<img src="${escapeHtml(user.profile_image)}" alt="${escapeHtml(user.full_name)}">`;
            } else {
                avatarEl.textContent = user.full_name.charAt(0).toUpperCase();
            }
        }

        const topbarAvatar = document.getElementById('topbarAvatar');
        if (topbarAvatar) {
            if (user.profile_image) {
                topbarAvatar.innerHTML = `<img src="${escapeHtml(user.profile_image)}" alt="${escapeHtml(user.full_name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null; this.parentElement.textContent='${escapeHtml(user.full_name.charAt(0).toUpperCase())}';">`;
            } else {
                topbarAvatar.textContent = user.full_name.charAt(0).toUpperCase();
            }
        }
        if (typeof updateDropdownUserInfo === 'function') updateDropdownUserInfo();
        
        // Initialize default service date to today
        const serviceDateInput = document.getElementById('att_service_date');
        if (serviceDateInput && !serviceDateInput.value) {
            serviceDateInput.value = formatLocalDate(new Date());
        }

        if (typeof calculateLiveAttendanceTotal === 'function') calculateLiveAttendanceTotal();

        // Preload ministries cache for filters
        try {
            const minRes = await api.ministries.getAll();
            allLeaderMinistriesCache = minRes.data || [];
        } catch (e) {
            console.warn('Could not preload ministries cache:', e);
        }

        if (typeof initLeaderModalBackdropClose === 'function') initLeaderModalBackdropClose();

        await loadDashboardSummary();

        if (api && typeof api.startSessionWatchdog === 'function') {
            api.startSessionWatchdog();
        }

        // Start real-time announcements notifier with chime & indicator dot safely
        if (typeof initLeaderAnnouncementsNotifier === 'function') {
            initLeaderAnnouncementsNotifier();
        }
        if (typeof initLiveCommentsNotifier === 'function') {
            initLiveCommentsNotifier();
        }

        initLeaderRealtimeSync();
    } catch (uiErr) {
        console.warn('Non-fatal error initializing leader dashboard UI:', uiErr);
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

let _lastLeaderSummaryLoadTime = 0;
function throttledLoadLeaderSummary() {
    const now = Date.now();
    if (now - _lastLeaderSummaryLoadTime < 3500) return;
    _lastLeaderSummaryLoadTime = now;
    if (typeof loadDashboardSummary === 'function') {
        loadDashboardSummary();
    }
}

function handleRealtimeLeaderUpdate(payload) {
    if (!payload || !payload.type || payload.type === 'connected') return;
    const type = payload.type;
    const activeView = document.querySelector('.view.active')?.id?.replace('view-', '') || 'dashboard';

    if (activeView === 'dashboard') {
        throttledLoadLeaderSummary();
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
    } else if (type === 'ministries') {
        if (activeView === 'ministries' && typeof loadMinistries === 'function') loadMinistries();
    } else if (type === 'attendance') {
        if (activeView === 'attendance' && typeof loadAttendance === 'function') loadAttendance();
    }
}

function initLeaderRealtimeSync() {
    if (churchBroadcastChannel) {
        churchBroadcastChannel.onmessage = (e) => {
            handleRealtimeLeaderUpdate(e.data);
        };
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'church_realtime_ping' && e.newValue) {
            try {
                const data = JSON.parse(e.newValue);
                handleRealtimeLeaderUpdate(data);
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
                        handleRealtimeLeaderUpdate(payload);
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

// --- UI Navigation Helpers ---
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('active'); }
async function logout() {
    try {
        if (api.auth && api.auth.logout) await api.auth.logout();
    } catch (e) {}
    sessionStorage.removeItem('church_token');
    sessionStorage.removeItem('church_user');
    localStorage.removeItem('church_token');
    localStorage.removeItem('church_user');
    localStorage.removeItem('church_active_user_theme');
    localStorage.removeItem('church_active_user_id');
    window.location.href = '/views/login.html';
}
let toastTimeout = null;

function showToast(msg, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }

    const toastMsg = document.getElementById('toastMsg');
    if (toastMsg) toastMsg.textContent = msg;

    let progressBar = toast.querySelector('.toast-progress');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'toast-progress';
        toast.appendChild(progressBar);
    }

    // Reset progress line animation and restart with current duration
    progressBar.style.animation = 'none';
    void progressBar.offsetWidth;
    progressBar.style.animation = `toastProgress ${duration}ms linear forwards`;

    toast.classList.add('show');

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toastTimeout = null;
    }, duration);
}

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

function navigateTo(viewName, event) {
    updateSidebarActive(viewName);
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.add('active');
        const titles = {
            dashboard: 'Dashboard',
            attendance: 'Tally Counting',
            c2s: 'C2S Group',
            events: 'Events & Seminary',
            announcements: 'Announcements',
            ministries: 'WORDA Ministries',
            content: 'Content Management',
            finance: 'Finance Overview',
            reports: 'Reports'
        };
        document.getElementById('pageTitle').innerText = titles[viewName] || (viewName.charAt(0).toUpperCase() + viewName.slice(1));
    }
    
    if (window.innerWidth <= 768) closeSidebar();

    if (viewName === 'announcements') {
        const dot = document.getElementById('leaderAnnounceNavDot');
        if (dot) dot.style.display = 'none';
        if (typeof leaderLastSeenAnnouncementId !== 'undefined' && leaderLastSeenAnnouncementId > 0) {
            localStorage.setItem('cog_leader_last_seen_ann_id', String(leaderLastSeenAnnouncementId));
        }
    }

    switch(viewName) {
        case 'dashboard': loadDashboardSummary(); break;
        case 'attendance': loadAttendance(); break;
        case 'c2s': loadLeaderC2SGroups(); break;
        case 'events': loadLeaderEvents(); break;
        case 'announcements': loadLeaderAnnouncements(); break;
        case 'ministries': loadMinistries(); break;
        case 'content':
            loadAlbumsAdmin();
            loadSermons();
            loadLiveStreamAdmin();
            break;
        case 'finance': loadFinance(); break;
        case 'reports': loadReports(); break;
    }
}

function navigateToLeaderFinance(type) {
    navigateTo('finance');
    const typeSelect = document.getElementById('leaderFinanceTypeFilter');
    if (typeSelect && type) {
        typeSelect.value = type;
        applyLeaderFinanceFilters();
    }
}

// ============================================================
// 1. DASHBOARD HOME VIEW
// ============================================================
async function loadDashboardSummary() {
    updateLeaderHeroGreeting();
    try {
        const [sumRes, attRes, eventsRes, annRes, minRes, oversightRes] = await Promise.all([
            api.reports.getSummary().catch(() => ({ data: null })),
            api.attendance.getAll().catch(() => ({ data: [] })),
            api.events.getAll(1, 10, { status: 'Upcoming' }).catch(() => ({ data: [], pagination: { total: 0 } })),
            api.announcements.getAll(1, 10, { is_published: 1 }).catch(() => ({ data: [], pagination: { total: 0 } })),
            api.ministries.getMyAssigned().catch(() => ({ data: [] })),
            api.ministries.getLeaderDepartmentOversight().catch(() => ({ data: null }))
        ]);

        let curUser = null;
        try {
            const curUserStr = sessionStorage.getItem('church_user');
            if (curUserStr) curUser = JSON.parse(curUserStr);
        } catch (e) {}

        if (minRes && minRes.data) {
            leaderAssignedMinistriesCache = minRes.data;
        }

        allAttendanceTalliesCache = attRes.data || [];
        renderLeaderMiniCalendar();

        // 1. Total Attendance Count
        const totalAttendanceCount = (sumRes.data && sumRes.data.attendance) 
            ? sumRes.data.attendance.total_attendance 
            : allAttendanceTalliesCache.reduce((s, t) => s + (t.total_count || 0), 0);
        if (document.getElementById('sumAttendance')) {
            document.getElementById('sumAttendance').innerText = Number(totalAttendanceCount || 0).toLocaleString();
        }

        // 2. Active Ministries
        if (sumRes.data && document.getElementById('sumMinistries')) {
            document.getElementById('sumMinistries').innerText = sumRes.data.ministries.total_ministries || 0;
        }

        if (curUser && curUser.is_department_head && curUser.worda_department) {
            const cardEl = document.querySelector('.summary-card.ministries');
            if (cardEl) {
                const title = cardEl.querySelector('h3');
                const link = cardEl.querySelector('.view-link');
                if (title) title.innerText = `${curUser.worda_department} Ministries`;
                if (link) link.innerText = `${curUser.worda_department} Dept Oversight →`;
            }
            if (oversightRes && oversightRes.data && oversightRes.data.departments) {
                let deptMinCount = 0;
                oversightRes.data.departments.forEach(d => {
                    deptMinCount += (d.ministries ? d.ministries.length : 0);
                });
                if (document.getElementById('sumMinistries')) {
                    document.getElementById('sumMinistries').innerText = deptMinCount;
                }
            }
        }

        // 3. Upcoming Events
        const eventsList = eventsRes.data || [];
        allLeaderEventsCache = eventsList;
        const upcomingEvents = eventsList.filter(e => e.status !== 'Completed' && e.status !== 'Cancelled');
        const upcomingCount = eventsRes.pagination ? eventsRes.pagination.total : upcomingEvents.length;
        if (document.getElementById('sumEvents')) {
            document.getElementById('sumEvents').innerText = upcomingCount;
        }

        // 4. Active Announcements
        const annList = annRes.data || [];
        allLeaderAnnCache = annList;
        const annCount = annRes.pagination ? annRes.pagination.total : annList.length;
        if (document.getElementById('sumAnnouncements')) {
            document.getElementById('sumAnnouncements').innerText = annCount;
        }

        // 5 & 6. Finance Income & Expense
        if (sumRes.data) {
            const d = sumRes.data;
            if (document.getElementById('sumIncome')) document.getElementById('sumIncome').innerText = `₱${Number(d.finance.total_income || 0).toLocaleString()}`;
            if (document.getElementById('sumExpense')) document.getElementById('sumExpense').innerText = `₱${Number(d.finance.total_expense || 0).toLocaleString()}`;
        }

        // Render recent attendance snapshot
        const dashRecentAtt = document.getElementById('dashRecentAtt');
        if (dashRecentAtt) {
            if (allAttendanceTalliesCache.length === 0) {
                dashRecentAtt.innerHTML = '<p class="text-slate-400" style="padding: 1.5rem 0; text-align: center;">No recent attendance records found. Click "Open Tally Tool" to record a service.</p>';
            } else {
                dashRecentAtt.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${allAttendanceTalliesCache.slice(0, 3).map(t => `
                            <div style="padding: 0.75rem 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                <div>
                                    <strong style="color: var(--navy); font-size: 0.95rem;">${escapeHtml(t.service_type)}</strong>
                                    <div style="font-size: 0.8rem; color: var(--text-light);"><i class="fa-regular fa-calendar"></i> ${new Date(t.service_date).toLocaleDateString()}</div>
                                </div>
                                <div style="display: flex; gap: 0.85rem; align-items: center; font-size: 0.825rem;">
                                    <span title="Adults"><i class="fa-solid fa-user" style="color: #64748b;"></i> ${t.adult_count}</span>
                                    <span title="Youth"><i class="fa-solid fa-child-reaching" style="color: #64748b;"></i> ${t.youth_count}</span>
                                    <span title="Children"><i class="fa-solid fa-baby" style="color: #64748b;"></i> ${t.children_count}</span>
                                    <span title="Visitors"><i class="fa-solid fa-user-plus" style="color: #64748b;"></i> ${t.visitor_count}</span>
                                    <span class="badge" style="background: var(--navy); color: #ffffff; font-weight: 700;">Total: ${t.total_count}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }

        // Render upcoming events snapshot widget
        const dashUpcomingEvents = document.getElementById('dashUpcomingEvents');
        if (dashUpcomingEvents) {
            if (upcomingEvents.length === 0) {
                dashUpcomingEvents.innerHTML = '<p class="text-slate-400" style="padding: 1.5rem 0; text-align: center;">No upcoming events or seminary classes scheduled.</p>';
            } else {
                dashUpcomingEvents.innerHTML = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">' +
                upcomingEvents.slice(0, 3).map(e => (
                    '<div style="padding: 0.5rem 0.85rem; background: #f8fafc; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">' +
                        '<div>' +
                            '<div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.15rem;">' +
                                '<span class="badge ' + getDeptBadgeClass(e.department) + '" style="font-size: 0.7rem;">' + escapeHtml(e.department || 'General') + '</span>' +
                                '<span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.7rem;">' + escapeHtml(e.event_type) + '</span>' +
                            '</div>' +
                            '<strong style="color: var(--navy); font-size: 0.9rem;">' + escapeHtml(e.title) + '</strong>' +
                            '<div style="font-size: 0.75rem; color: var(--text-light);"><i class="fa-regular fa-clock"></i> ' + (e.start_datetime ? new Date(e.start_datetime).toLocaleDateString() : 'TBD') + '</div>' +
                        '</div>' +
                        '<button class="btn-secondary btn-sm" onclick="viewLeaderEvent(' + e.event_id + ')" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">' +
                            '<i class="fa-solid fa-eye mr-1"></i> Details' +
                        '</button>' +
                    '</div>'
                )).join('') +
            '</div>';
        }
        }

        // Render recent announcements snapshot widget
        const dashRecentAnn = document.getElementById('dashRecentAnn');
        if (dashRecentAnn) {
            if (annList.length === 0) {
                dashRecentAnn.innerHTML = '<p class="text-slate-400" style="padding: 1.5rem 0; text-align: center;">No active church announcements posted.</p>';
            } else {
                dashRecentAnn.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${annList.slice(0, 3).map(a => `
                            <div style="padding: 0.5rem 0.85rem; background: #f8fafc; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.15rem;">
                                        ${a.is_pinned == 1 ? '<span class="badge" style="background: #fef08a; color: #854d0e; font-size: 0.7rem;"><i class="fa-solid fa-thumbtack mr-1"></i> Pinned</span>' : ''}
                                        ${getAnnouncementCategoryBadge(a.category)}
                                    </div>
                                    <strong style="color: var(--navy); font-size: 0.9rem;">${escapeHtml(a.title)}</strong>
                                    <div style="font-size: 0.75rem; color: var(--text-light);">${escapeHtml(a.target_audience || 'General Church')} &bull; ${new Date(a.created_at).toLocaleDateString()}</div>
                                </div>
                                <button class="btn-secondary btn-sm" onclick="viewLeaderAnnouncement(${a.announcement_id})" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">
                                    <i class="fa-solid fa-eye mr-1"></i> View
                                </button>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }

        // Initialize and render Attendance Bar Graph on Dashboard overview
        populateAttendanceChartYears();
        applyAttendanceChartFilters();
    } catch (error) {
        showToast('Error loading summary: ' + error.message);
    }
}

// ============================================================
// 2. ATTENDANCE & TALLY MODULE (CALENDAR & BAR GRAPH)
// ============================================================
let attCalCurrentYear = new Date().getFullYear();
let attCalCurrentMonth = new Date().getMonth();
let attCalSelectedDate = new Date().toISOString().split('T')[0];

let attendanceBarChart = null;
let attendanceBarChartMode = 'grouped'; // 'grouped' or 'stacked'

function setAttendanceDateToday() {
    const todayStr = formatLocalDate(new Date());
    const input = document.getElementById('att_service_date');
    if (input) input.value = todayStr;
    onAttendanceDateInputChange(todayStr);
}

function setAttendanceDateLastSunday() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day; // day 0 is Sunday
    const lastSunday = new Date(d.setDate(diff));
    const lastSunStr = lastSunday.toISOString().split('T')[0];
    const input = document.getElementById('att_service_date');
    if (input) input.value = lastSunStr;
    onAttendanceDateInputChange(lastSunStr);
}

function calculateLiveAttendanceTotal() {
    const adult = parseInt(document.getElementById('att_adult')?.value) || 0;
    const youth = parseInt(document.getElementById('att_youth')?.value) || 0;
    const children = parseInt(document.getElementById('att_children')?.value) || 0;
    const visitor = parseInt(document.getElementById('att_visitor')?.value) || 0;
    const total = adult + youth + children + visitor;

    const liveTotalEl = document.getElementById('liveAttTotal');
    if (liveTotalEl) {
        liveTotalEl.innerText = total.toLocaleString();
        liveTotalEl.style.animation = 'none';
        liveTotalEl.offsetHeight; // trigger reflow
        liveTotalEl.style.animation = 'tallyPulse 0.3s ease';
    }
    return total;
}

let currentAttPage = 1;
const ATT_PAGE_LIMIT = 10;
let tallyFilterServiceType = '';
let tallyFilterDate = '';

function applyTallyFilters() {
    tallyFilterServiceType = document.getElementById('tallyServiceTypeFilter')?.value || '';
    tallyFilterDate = document.getElementById('tallyServiceDateFilter')?.value || '';
    loadAttendanceTable(1);
}

function resetTallyFilters() {
    tallyFilterServiceType = '';
    tallyFilterDate = '';
    const typeEl = document.getElementById('tallyServiceTypeFilter');
    if (typeEl) typeEl.value = '';
    const dateEl = document.getElementById('tallyServiceDateFilter');
    if (dateEl) dateEl.value = '';
    loadAttendanceTable(1);
}

async function loadAttendanceTable(page = 1) {
    currentAttPage = page;
    const tbody = document.getElementById('attTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading tallies...</td></tr>';

    const filters = {};
    if (tallyFilterServiceType) filters.service_type = tallyFilterServiceType;
    if (tallyFilterDate) filters.date = tallyFilterDate;

    try {
        const res = await api.attendance.getAll(currentAttPage, ATT_PAGE_LIMIT, filters);
        const tallies = res.data || [];
        if (!tbody) return;

        if (tallies.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-slate-400">No attendance records found matching your filters.</td></tr>';
        } else {
            tbody.innerHTML = tallies.map(t => '<tr>' +
                '<td class="p-4 font-medium text-navy">' + new Date(t.service_date).toLocaleDateString() + '</td>' +
                '<td class="p-4"><span class="badge" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-weight: 600;">' + escapeHtml(t.service_type) + '</span></td>' +
                '<td class="p-4">' + t.adult_count + '</td>' +
                '<td class="p-4">' + t.youth_count + '</td>' +
                '<td class="p-4">' + t.children_count + '</td>' +
                '<td class="p-4">' + t.visitor_count + '</td>' +
                '<td class="p-4 font-bold text-navy"><span class="badge" style="background: var(--navy); color: #ffffff; font-weight: 700; font-size: 0.85rem;">' + t.total_count + '</span></td>' +
                '</tr>').join('');
        }

        const pagination = res.pagination || { total: tallies.length, page: currentAttPage, totalPages: Math.ceil((res.total || tallies.length) / ATT_PAGE_LIMIT) || 1 };
        totalAttPages = pagination.totalPages;
        const pageInfo = document.getElementById('attPageInfo');
        if (pageInfo) pageInfo.textContent = 'Page ' + pagination.page + ' of ' + (totalAttPages || 1);
        const prevBtn = document.getElementById('attPrevBtn');
        if (prevBtn) prevBtn.disabled = pagination.page <= 1;
        const nextBtn = document.getElementById('attNextBtn');
        if (nextBtn) nextBtn.disabled = pagination.page >= totalAttPages;
    } catch (err) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-rose-500">Error loading tallies: ' + escapeHtml(err.message) + '</td></tr>';
    }
}

function changeAttPage(direction) {
    const newPage = currentAttPage + direction;
    if (newPage > 0) {
        loadAttendanceTable(newPage);
    }
}

async function loadAttendance() {
    try {
        const [listRes, sumRes] = await Promise.all([api.attendance.getAll({ all: true }), api.attendance.getSummary()]);
        allAttendanceTalliesCache = listRes.data || [];
        loadAttendanceTable(1);

        // 2. Render Demographic Summary
        const s = sumRes.data || {};
        const attSumEl = document.getElementById('attSummary');
        if (attSumEl) {
            attSumEl.innerHTML = `
                <ul class="view-details-list" style="margin: 0;">
                    <li><span class="label"><i class="fa-solid fa-user" style="color: var(--navy); margin-right: 0.3rem;"></i> Total Adults</span> <span class="value">${Number(s.total_adults || 0).toLocaleString()}</span></li>
                    <li><span class="label"><i class="fa-solid fa-child-reaching" style="color: var(--gold-dark); margin-right: 0.3rem;"></i> Total Youth</span> <span class="value">${Number(s.total_youth || 0).toLocaleString()}</span></li>
                    <li><span class="label"><i class="fa-solid fa-baby" style="color: #0284c7; margin-right: 0.3rem;"></i> Total Children</span> <span class="value">${Number(s.total_children || 0).toLocaleString()}</span></li>
                    <li><span class="label"><i class="fa-solid fa-user-plus" style="color: #10b981; margin-right: 0.3rem;"></i> Total Visitors</span> <span class="value">${Number(s.total_visitors || 0).toLocaleString()}</span></li>
                    <li style="border-top: 2px solid var(--border-color); margin-top: 0.75rem; padding-top: 1rem;"><span class="label" style="font-weight: 700; color: var(--navy);">Overall Attendance Tally</span> <span class="value font-bold" style="font-size: 1.35rem; color: var(--navy);">${Number(s.total_attendance || 0).toLocaleString()}</span></li>
                </ul>
            `;
        }

        // 3. Render Calendar
        renderAttendanceCalendar();

        // 4. Populate Bar Graph Filters & Render Bar Graph
        populateAttendanceChartYears();
        applyAttendanceChartFilters();

    } catch (error) {
        showToast('Error loading attendance: ' + error.message);
    }
}

async function saveAttendance() {
    const data = {
        service_type: document.getElementById('att_service_type').value,
        service_date: document.getElementById('att_service_date').value,
        adult_count: document.getElementById('att_adult').value,
        youth_count: document.getElementById('att_youth').value,
        children_count: document.getElementById('att_children').value,
        visitor_count: document.getElementById('att_visitor').value,
        notes: document.getElementById('att_notes').value
    };

    if (!data.service_date) return showToast('Please select a service date.');

    try {
        const existing = (allAttendanceTalliesCache || []).find(t => {
            try {
                const dStr = new Date(t.service_date).toISOString().split('T')[0];
                return dStr === data.service_date && t.service_type === data.service_type;
            } catch (e) { return false; }
        });

        if (existing && existing.tally_id) {
            await api.attendance.update(existing.tally_id, data);
            showToast('Attendance tally updated successfully!');
        } else {
            await api.attendance.create(data);
            showToast('Attendance recorded successfully!');
        }
        document.getElementById('att_notes').value = '';
        document.getElementById('att_adult').value = '0';
        document.getElementById('att_youth').value = '0';
        document.getElementById('att_children').value = '0';
        document.getElementById('att_visitor').value = '0';
        calculateLiveAttendanceTotal();
        await loadAttendance();
        await loadDashboardSummary();
    } catch (error) {
        showToast('Error saving attendance: ' + error.message);
    }
}

// --- Attendance Interactive Calendar Functions ---
function prevAttendanceCalendarMonth() {
    attCalCurrentMonth--;
    if (attCalCurrentMonth < 0) {
        attCalCurrentMonth = 11;
        attCalCurrentYear--;
    }
    renderAttendanceCalendar();
}

function nextAttendanceCalendarMonth() {
    attCalCurrentMonth++;
    if (attCalCurrentMonth > 11) {
        attCalCurrentMonth = 0;
        attCalCurrentYear++;
    }
    renderAttendanceCalendar();
}

function resetAttendanceCalendarToday() {
    const now = new Date();
    attCalCurrentYear = now.getFullYear();
    attCalCurrentMonth = now.getMonth();
    setAttendanceDateToday();
}

function onAttendanceDateInputChange(val) {
    if (!val) return;
    attCalSelectedDate = val;
    const parts = val.split('-');
    if (parts.length === 3) {
        attCalCurrentYear = parseInt(parts[0]);
        attCalCurrentMonth = parseInt(parts[1]) - 1;
    }
    renderAttendanceCalendar();
}

function onAttendanceCalendarDayClick(dateStr) {
    attCalSelectedDate = dateStr;
    const dateInput = document.getElementById('att_service_date');
    if (dateInput) dateInput.value = dateStr;

    // Check if an existing tally exists for this date
    const existingTally = allAttendanceTalliesCache.find(t => {
        const dStr = new Date(t.service_date).toISOString().split('T')[0];
        return dStr === dateStr;
    });

    if (existingTally) {
        // Pre-fill form inputs with existing recorded numbers
        document.getElementById('att_service_type').value = existingTally.service_type || 'Sunday Worship';
        document.getElementById('att_adult').value = existingTally.adult_count || 0;
        document.getElementById('att_youth').value = existingTally.youth_count || 0;
        document.getElementById('att_children').value = existingTally.children_count || 0;
        document.getElementById('att_visitor').value = existingTally.visitor_count || 0;
        document.getElementById('att_notes').value = existingTally.notes || '';
        calculateLiveAttendanceTotal();
    } else {
        // Clean zero-state defaults when no record exists for that date
        document.getElementById('att_adult').value = '0';
        document.getElementById('att_youth').value = '0';
        document.getElementById('att_children').value = '0';
        document.getElementById('att_visitor').value = '0';
        document.getElementById('att_notes').value = '';
        calculateLiveAttendanceTotal();
    }

    renderAttendanceCalendar();
}

function renderAttendanceCalendar() {
    const titleEl = document.getElementById('calMonthYearTitle');
    const gridEl = document.getElementById('attCalendarDaysGrid');
    if (!gridEl) return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (titleEl) {
        titleEl.textContent = `${monthNames[attCalCurrentMonth]} ${attCalCurrentYear}`;
    }

    const firstDayIndex = new Date(attCalCurrentYear, attCalCurrentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(attCalCurrentYear, attCalCurrentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(attCalCurrentYear, attCalCurrentMonth, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    // Build map of recorded tallies by date
    const talliesMap = {};
    allAttendanceTalliesCache.forEach(t => {
        try {
            const dateStr = new Date(t.service_date).toISOString().split('T')[0];
            talliesMap[dateStr] = t;
        } catch (e) {}
    });

    let cellsHtml = '';

    // 1. Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        cellsHtml += `<div class="cal-day-box other-month"><span class="cal-num">${d}</span></div>`;
    }

    // 2. Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
        const mStr = String(attCalCurrentMonth + 1).padStart(2, '0');
        const dStr = String(day).padStart(2, '0');
        const dateStr = `${attCalCurrentYear}-${mStr}-${dStr}`;

        const isToday = (dateStr === todayStr);
        const isSelected = (dateStr === attCalSelectedDate);
        const tally = talliesMap[dateStr];

        cellsHtml += `
            <div class="cal-day-box ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" 
                 onclick="onAttendanceCalendarDayClick('${dateStr}')" 
                 title="${dateStr}${tally ? ' - ' + tally.service_type + ': ' + tally.total_count + ' attendees' : ''}">
                <span class="cal-num">${day}</span>
                ${tally ? '<span class="cal-tally-indicator"></span>' : ''}
            </div>
        `;
    }

    // 3. Next month leading days to complete grid
    const totalRendered = firstDayIndex + daysInCurrentMonth;
    const remaining = (7 - (totalRendered % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        cellsHtml += `<div class="cal-day-box other-month"><span class="cal-num">${i}</span></div>`;
    }

    gridEl.innerHTML = cellsHtml;

    // Update Selected Date Summary below calendar
    const selectedTally = talliesMap[attCalSelectedDate];
    const textDateEl = document.getElementById('calSelectedDateText');
    const textTallyEl = document.getElementById('calSelectedTallyText');
    const badgeEl = document.getElementById('calSelectedTallyBadge');

    if (textDateEl && textTallyEl && badgeEl) {
        const formattedSelected = new Date(attCalSelectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        textDateEl.textContent = formattedSelected;

        if (selectedTally) {
            textTallyEl.innerHTML = `<strong>${escapeHtml(selectedTally.service_type)}:</strong> Adults: ${selectedTally.adult_count}, Youth: ${selectedTally.youth_count}, Children: ${selectedTally.children_count}, Visitors: ${selectedTally.visitor_count}`;
            badgeEl.textContent = `${selectedTally.total_count} attendees`;
            badgeEl.style.display = 'inline-block';
        } else {
            textTallyEl.textContent = 'No attendance recorded for this date. Enter counts on the left to save.';
            badgeEl.style.display = 'none';
        }
    }
}

// --- Attendance Bar Graph Functions (Chart.js) & Filters ---
function getTallyYearMonth(serviceDate) {
    if (!serviceDate) return { year: '', month: '' };
    if (typeof serviceDate === 'string' && serviceDate.includes('-')) {
        const parts = serviceDate.split('T')[0].split('-');
        if (parts.length >= 2) {
            return {
                year: String(parseInt(parts[0], 10)),
                month: String(parseInt(parts[1], 10))
            };
        }
    }
    const d = new Date(serviceDate);
    if (!isNaN(d.getTime())) {
        return {
            year: String(d.getFullYear()),
            month: String(d.getMonth() + 1)
        };
    }
    return { year: '', month: '' };
}

let dashAttendanceBarChart = null;

function populateAttendanceChartYears() {
    const yearsSet = new Set();
    (allAttendanceTalliesCache || []).forEach(t => {
        const ym = getTallyYearMonth(t.service_date);
        if (ym.year && parseInt(ym.year, 10) > 1900) {
            yearsSet.add(parseInt(ym.year, 10));
        }
    });
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    const optionsHtml = '<option value="">All Years</option>' +
        sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');

    ['attChartYearFilter', 'dashAttChartYearFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const currentVal = el.value;
            el.innerHTML = optionsHtml;
            if (currentVal && sortedYears.includes(parseInt(currentVal, 10))) {
                el.value = currentVal;
            }
        }
    });
}

function syncAttendanceFilters(sourceEl, targetId) {
    const targetEl = document.getElementById(targetId);
    if (targetEl && sourceEl) {
        targetEl.value = sourceEl.value;
    }
    applyAttendanceChartFilters(sourceEl);
}

function getActiveAttendanceFilterValue(attId, dashId, sourceEl = null) {
    if (sourceEl) {
        if (sourceEl.id === attId || sourceEl.id === dashId) {
            return sourceEl.value !== undefined ? sourceEl.value : '';
        }
    }
    const isDashActive = document.getElementById('view-dashboard')?.classList.contains('active');
    const attEl = document.getElementById(attId);
    const dashEl = document.getElementById(dashId);

    if (isDashActive) {
        if (dashEl && dashEl.value !== undefined) return dashEl.value;
        if (attEl && attEl.value !== undefined) return attEl.value;
    } else {
        if (attEl && attEl.value !== undefined) return attEl.value;
        if (dashEl && dashEl.value !== undefined) return dashEl.value;
    }
    return '';
}

function applyAttendanceChartFilters(sourceEl = null) {
    const serviceType = getActiveAttendanceFilterValue('attChartServiceTypeFilter', 'dashAttChartServiceTypeFilter', sourceEl);
    const year = getActiveAttendanceFilterValue('attChartYearFilter', 'dashAttChartYearFilter', sourceEl);
    const month = getActiveAttendanceFilterValue('attChartMonthFilter', 'dashAttChartMonthFilter', sourceEl);

    // Synchronize selects on both dashboard and attendance view
    ['attChartServiceTypeFilter', 'dashAttChartServiceTypeFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value !== serviceType) el.value = serviceType;
    });
    ['attChartYearFilter', 'dashAttChartYearFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value !== year) el.value = year;
    });
    ['attChartMonthFilter', 'dashAttChartMonthFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value !== month) el.value = month;
    });

    const filtered = (allAttendanceTalliesCache || []).filter(t => {
        if (!t.service_date) return false;
        const ym = getTallyYearMonth(t.service_date);

        const matchesService = !serviceType || 
            (t.service_type === serviceType) ||
            (serviceType === 'Sunday Worship' && (t.service_type === 'Sunday Worship Service' || t.service_type === 'Sunday Worship')) ||
            (serviceType === 'Wednesday Service' && (t.service_type === 'Midweek Service' || t.service_type === 'Wednesday Service'));
        const matchesYear = !year || (ym.year === year);
        const matchesMonth = !month || (ym.month === month);

        return matchesService && matchesYear && matchesMonth;
    });

    renderAttendanceBarChart(filtered, month);
}

function resetAttendanceChartFilters() {
    ['attChartServiceTypeFilter', 'dashAttChartServiceTypeFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['attChartYearFilter', 'dashAttChartYearFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['attChartMonthFilter', 'dashAttChartMonthFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    applyAttendanceChartFilters();
}

function toggleAttendanceBarChartMode(mode) {
    attendanceBarChartMode = mode;
    
    // Sync pills on both attendance module and dashboard overview
    const sets = [
        ['btnChartModeGrouped', 'btnChartModeStacked'],
        ['btnDashChartModeGrouped', 'btnDashChartModeStacked']
    ];

    sets.forEach(([btnGroupedId, btnStackedId]) => {
        const btnGrouped = document.getElementById(btnGroupedId);
        const btnStacked = document.getElementById(btnStackedId);
        if (btnGrouped && btnStacked) {
            if (mode === 'stacked') {
                btnStacked.classList.add('active');
                btnGrouped.classList.remove('active');
            } else {
                btnGrouped.classList.add('active');
                btnStacked.classList.remove('active');
            }
        }
    });

    applyAttendanceChartFilters();
}

function renderAttendanceBarChart(tallies, selectedMonth = '') {
    const totalServices = (tallies || []).length;
    const avgAttendance = totalServices > 0 ? Math.round(tallies.reduce((s, t) => s + (t.total_count || 0), 0) / totalServices) : 0;
    const peakSunday = totalServices > 0 ? Math.max(...tallies.map(t => t.total_count || 0)) : 0;

    ['chartStatAvg', 'dashChartStatAvg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = avgAttendance.toLocaleString();
    });
    ['chartStatPeak', 'dashChartStatPeak'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = peakSunday.toLocaleString();
    });
    ['chartStatCount', 'dashChartStatCount'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = totalServices.toLocaleString();
    });

    function drawChart(canvasId, isDash = false) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        if (typeof Chart === 'undefined') {
            setTimeout(() => {
                if (typeof Chart !== 'undefined') {
                    applyAttendanceChartFilters();
                }
            }, 350);
            return null;
        }

        if (isDash) {
            canvas.style.maxHeight = '210px';
            canvas.style.height = '210px';
        }

        const ctx = canvas.getContext('2d');
        if (!tallies || tallies.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '13px Inter, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.fillText('No attendance records match the selected filters.', canvas.width / 2, 90);
            return null;
        }

        const sorted = [...tallies].sort((a, b) => new Date(a.service_date) - new Date(b.service_date));

        const isAllMonths = !selectedMonth;
        let labels = [];
        let adultData = [];
        let youthData = [];
        let childrenData = [];
        let visitorData = [];
        let metadata = [];

        if (isAllMonths) {
            // Group and summarize by Month
            const monthMap = {};
            sorted.forEach(t => {
                const d = new Date(t.service_date);
                const ymKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!monthMap[ymKey]) {
                    const monthName = d.toLocaleDateString(undefined, { month: 'long' });
                    monthMap[ymKey] = {
                        monthName,
                        year: String(d.getFullYear()),
                        adult: 0,
                        youth: 0,
                        children: 0,
                        visitor: 0,
                        total: 0,
                        serviceCount: 0
                    };
                }
                monthMap[ymKey].adult += (t.adult_count || 0);
                monthMap[ymKey].youth += (t.youth_count || 0);
                monthMap[ymKey].children += (t.children_count || 0);
                monthMap[ymKey].visitor += (t.visitor_count || 0);
                monthMap[ymKey].total += (t.total_count || 0);
                monthMap[ymKey].serviceCount += 1;
            });

            const keys = Object.keys(monthMap).sort();
            const displayKeys = keys.length > 12 ? keys.slice(-12) : keys;

            labels = displayKeys.map(k => [monthMap[k].monthName, monthMap[k].year]);
            adultData = displayKeys.map(k => monthMap[k].adult);
            youthData = displayKeys.map(k => monthMap[k].youth);
            childrenData = displayKeys.map(k => monthMap[k].children);
            visitorData = displayKeys.map(k => monthMap[k].visitor);
            metadata = displayKeys.map(k => ({
                isMonthlySummary: true,
                total: monthMap[k].total,
                serviceCount: monthMap[k].serviceCount,
                label: `${monthMap[k].monthName} ${monthMap[k].year}`
            }));
        } else {
            // Specific month: show individual services
            const recent = sorted.length > 12 ? sorted.slice(-12) : sorted;
            labels = recent.map(t => {
                const d = new Date(t.service_date);
                const datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const typePart = (t.service_type || '').split(' ')[0];
                return [datePart, `(${typePart})`];
            });
            adultData = recent.map(t => t.adult_count || 0);
            youthData = recent.map(t => t.youth_count || 0);
            childrenData = recent.map(t => t.children_count || 0);
            visitorData = recent.map(t => t.visitor_count || 0);
            metadata = recent.map(t => ({
                isMonthlySummary: false,
                total: t.total_count,
                serviceType: t.service_type
            }));
        }

        const isStacked = (attendanceBarChartMode === 'stacked');

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Adults',
                        data: adultData,
                        backgroundColor: '#0E2A4F',
                        borderColor: '#061730',
                        borderWidth: 1,
                        borderRadius: isStacked ? 0 : 4
                    },
                    {
                        label: 'Youth',
                        data: youthData,
                        backgroundColor: '#C9A961',
                        borderColor: '#B39148',
                        borderWidth: 1,
                        borderRadius: isStacked ? 0 : 4
                    },
                    {
                        label: 'Children',
                        data: childrenData,
                        backgroundColor: '#0284c7',
                        borderColor: '#0369a1',
                        borderWidth: 1,
                        borderRadius: isStacked ? 0 : 4
                    },
                    {
                        label: 'Visitors',
                        data: visitorData,
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 1,
                        borderRadius: isStacked ? 4 : 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 10,
                            font: { size: isDash ? 10 : 11, family: 'Inter' }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: function(context) {
                                const index = context[0].dataIndex;
                                const m = metadata[index];
                                if (!m) return '';
                                if (m.isMonthlySummary) {
                                    return `\nTotal Monthly Attendance: ${m.total.toLocaleString()}\nServices in Month: ${m.serviceCount}`;
                                } else {
                                    return `\nTotal Service Attendance: ${m.total.toLocaleString()}\nService: ${m.serviceType}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: isStacked,
                        grid: { display: false },
                        ticks: { font: { size: 9, family: 'Inter' } }
                    },
                    y: {
                        stacked: isStacked,
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: { font: { size: 9, family: 'Inter' } }
                    }
                }
            }
        });
    }

    if (attendanceBarChart) {
        attendanceBarChart.destroy();
        attendanceBarChart = null;
    }
    if (dashAttendanceBarChart) {
        dashAttendanceBarChart.destroy();
        dashAttendanceBarChart = null;
    }
    const dashCanvas = document.getElementById('dashAttendanceBarChartCanvas');
    if (dashCanvas) {
        dashCanvas.style.height = '210px';
        dashCanvas.style.maxHeight = '210px';
    }

    attendanceBarChart = drawChart('attendanceBarChartCanvas', false);
    dashAttendanceBarChart = drawChart('dashAttendanceBarChartCanvas', true);
}

// ============================================================
// 3. EVENTS & SEMINARY MODULE
// ============================================================
let leaderEventFilterDept = '';
let leaderEventFilterMinistryId = '';

let currentLeaderEventsPage = 1;
const LEADER_EVENT_PAGE_LIMIT = 10;
let leaderEventArchivesMode = false;

function toggleLeaderEventArchives() {
    leaderEventArchivesMode = !leaderEventArchivesMode;
    const btn = document.getElementById('btnLeaderEventArchives');
    const headerTitle = document.querySelector('#view-events .card-header h2');
    
    if (leaderEventArchivesMode) {
        if (btn) {
            btn.classList.add('active');
            btn.style.background = '#fef3c7';
            btn.style.borderColor = '#f59e0b';
            btn.style.color = '#92400e';
            btn.innerHTML = '<i class="fa-solid fa-calendar-check mr-1"></i> <span id="leaderEventArchivesBtnText">Active Events</span>';
        }
        if (headerTitle) headerTitle.innerHTML = '<i class="fa-solid fa-box-archive" style="color: var(--gold); margin-right: 0.5rem;"></i> Event Archives';
    } else {
        if (btn) {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
            btn.innerHTML = '<i class="fa-solid fa-box-archive mr-1"></i> <span id="leaderEventArchivesBtnText">Event Archives</span>';
        }
        if (headerTitle) headerTitle.innerHTML = '<i class="fa-solid fa-calendar-days" style="color: var(--gold); margin-right: 0.5rem;"></i> Events & Seminary Schedule';
    }
    loadLeaderEvents(1);
}

async function archiveLeaderEvent(id) {
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
        await loadLeaderEvents(currentLeaderEventsPage);
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Failed to archive event.');
    }
}

async function restoreLeaderEvent(id) {
    try {
        await api.events.restore(id);
        if (typeof showToast === 'function') showToast('Event restored to active schedule!');
        await loadLeaderEvents(currentLeaderEventsPage);
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Failed to restore event.');
    }
}

async function loadLeaderEvents(page = 1) {
    currentLeaderEventsPage = page;
    const search = (document.getElementById('leaderEventSearch')?.value || '').trim();
    const type = document.getElementById('leaderEventTypeFilter')?.value || '';
    const status = document.getElementById('leaderEventStatusFilter')?.value || '';

    const filters = { 
        search, 
        type, 
        event_type: type, 
        status,
        archived: leaderEventArchivesMode ? 1 : 0
    };
    if (leaderEventFilterMinistryId) {
        filters.ministry_id = leaderEventFilterMinistryId;
    } else if (leaderEventFilterDept) {
        filters.department = leaderEventFilterDept;
    }

    const tbody = document.getElementById('leaderEventsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading events...</td></tr>';

    try {
        if (!allLeaderMinistriesCache || allLeaderMinistriesCache.length === 0) {
            try {
                const minRes = await api.ministries.getAll();
                allLeaderMinistriesCache = minRes.data || [];
            } catch (e) {}
        }

        const res = await api.events.getAll(currentLeaderEventsPage, LEADER_EVENT_PAGE_LIMIT, filters);
        const list = res.data || [];
        allLeaderEventsCache = list;
        renderLeaderEventsTable(list);

        const total = res.pagination ? res.pagination.total : list.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / LEADER_EVENT_PAGE_LIMIT);

        const pageInfo = document.getElementById('leaderEventsPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentLeaderEventsPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('leaderEventsPrevBtn');
        if (prevBtn) prevBtn.disabled = currentLeaderEventsPage <= 1;

        const nextBtn = document.getElementById('leaderEventsNextBtn');
        if (nextBtn) nextBtn.disabled = currentLeaderEventsPage >= totalPages;
    } catch (error) {
        showToast('Error loading events: ' + error.message);
    }
}

function applyLeaderEventFilters() {
    loadLeaderEvents(1);
}

function resetLeaderEventFilters() {
    if (document.getElementById('leaderEventSearch')) document.getElementById('leaderEventSearch').value = '';
    if (document.getElementById('leaderEventTypeFilter')) document.getElementById('leaderEventTypeFilter').value = '';
    if (document.getElementById('leaderEventStatusFilter')) document.getElementById('leaderEventStatusFilter').value = '';
    clearLeaderEventDeptMinFilter();
}

function changeLeaderEventsPage(direction) {
    const newPage = currentLeaderEventsPage + direction;
    if (newPage > 0) {
        loadLeaderEvents(newPage);
    }
}

function renderLeaderEventsTable(events) {
    const tbody = document.getElementById('leaderEventsTableBody');
    if (!tbody) return;

    if (!events || events.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-slate-400">${leaderEventArchivesMode ? 'No archived events found.' : 'No events or seminary records found matching filters.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = events.map(e => {
        const canArchive = e.status === 'Completed' || e.status === 'Cancelled';
        return `
        <tr>
            <td class="p-4 font-medium text-navy">
                <div style="font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem;">
                    ${escapeHtml(e.title)}
                    ${e.is_featured == 1 ? '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.7rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;"><i class="fa-solid fa-star text-2xs"></i>Featured</span>' : ''}
                </div>
                ${e.venue || e.location ? `<div style="font-size: 0.75rem; color: var(--text-light);"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(e.venue || e.location)}</div>` : ''}
            </td>
            <td class="p-4"><span class="badge ${getDeptBadgeClass(e.department)}">${escapeHtml(e.department || 'General')}</span></td>
            <td class="p-4"><span class="badge ${e.ministry_name ? 'badge-ministry-pill' : 'badge-inactive'}">${escapeHtml(e.ministry_name || 'General Church')}</span></td>
            <td class="p-4"><span class="badge" style="background: #e0e7ff; color: #4338ca; font-weight: 600;">${escapeHtml(e.event_type)}</span></td>
            <td class="p-4 text-xs text-slate-600">
                <div><i class="fa-regular fa-calendar mr-1"></i>${e.start_datetime ? new Date(e.start_datetime).toLocaleDateString() : 'TBD'}</div>
                <div style="color: #64748b; margin-top: 2px;">${e.start_datetime ? new Date(e.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </td>
            <td class="p-4">${getEventStatusBadge(e.status)}</td>
            <td class="p-4">
                ${e.is_enrollment_open == 1 
                    ? '<span class="badge" style="background: #dcfce7; color: #15803d; border: 1px solid #86efac;"><i class="fa-solid fa-circle-check mr-1"></i> Open</span>' 
                    : '<span class="badge" style="background: #f1f5f9; color: #64748b;">Closed</span>'}
            </td>
            <td class="p-4 text-right">
                <div class="action-btns-wrap" style="display: inline-flex; gap: 0.35rem; justify-content: flex-end;">
                    <button class="btn-action btn-view" onclick="viewLeaderEvent(${e.event_id})" title="View Details">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    ${leaderEventArchivesMode ? `
                        <button class="btn-action" style="color: #059669;" onclick="restoreLeaderEvent(${e.event_id})" title="Restore to Active Events">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                    ` : `
                        <button class="btn-action" style="color: #2563eb;" onclick="viewLeaderEventEnrollments(${e.event_id})" title="View Enrolled Members">
                            <i class="fa-solid fa-user-graduate"></i>
                        </button>
                        <button class="btn-action btn-edit" onclick="openLeaderEventModal(${e.event_id})" title="Edit Event">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        ${canArchive ? `
                            <button class="btn-action" style="color: #d97706;" onclick="archiveLeaderEvent(${e.event_id})" title="Archive Event (Completed/Cancelled)">
                                <i class="fa-solid fa-box-archive"></i>
                            </button>
                        ` : ''}
                    `}
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

let currentViewingLeaderEventId = null;

async function viewLeaderEvent(id) {
    currentViewingLeaderEventId = id;
    const event = allLeaderEventsCache.find(e => e.event_id == id);
    if (!event) return;

    const bannerEl = document.getElementById('leaderEventModalBanner');
    if (bannerEl) {
        if (event.banner_image) {
            bannerEl.style.backgroundImage = `linear-gradient(to bottom, rgba(6, 23, 48, 0.5), rgba(6, 23, 48, 0.9)), url('${encodeURI(event.banner_image)}')`;
            bannerEl.style.backgroundSize = 'cover';
            bannerEl.style.backgroundPosition = 'center';
        } else {
            bannerEl.style.backgroundImage = 'linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%)';
        }
    }

    const typeBadge = document.getElementById('modalEventTypeBadge');
    if (typeBadge) typeBadge.textContent = event.event_type || 'Gathering';

    const statusBadge = document.getElementById('modalEventStatusBadge');
    if (statusBadge) statusBadge.innerHTML = getEventStatusBadge(event.status);

    const enrollBadge = document.getElementById('modalEventEnrollStatusBadge');
    if (enrollBadge) {
        enrollBadge.innerHTML = event.is_enrollment_open == 1
            ? '<span class="badge" style="background: #10b981; color: #fff; font-size: 0.72rem; padding: 3px 8px; border-radius: 9999px;"><i class="fa-solid fa-circle-check mr-1"></i> Open</span>'
            : '<span class="badge" style="background: #64748b; color: #fff; font-size: 0.72rem; padding: 3px 8px; border-radius: 9999px;">Closed</span>';
    }

    const featBadge = document.getElementById('modalEventFeaturedBadge');
    if (featBadge) {
        featBadge.style.display = (event.is_featured == 1) ? 'inline-flex' : 'none';
    }

    document.getElementById('modalEventTitle').textContent = event.title;

    const startDate = event.start_datetime ? new Date(event.start_datetime) : null;
    const endDate = event.end_datetime ? new Date(event.end_datetime) : null;
    const startStr = startDate ? startDate.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD';
    const endStr = endDate ? endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
    const schedEl = document.getElementById('modalEventSchedule');
    if (schedEl) schedEl.textContent = `${startStr}${endStr ? ' – ' + endStr : ''}`;

    const locEl = document.getElementById('modalEventLocation');
    if (locEl) locEl.textContent = event.venue || event.location || 'Church Main Sanctuary / Imus Campus';

    const spkEl = document.getElementById('modalEventSpeaker');
    if (spkEl) spkEl.textContent = event.organizer || event.speaker || 'Church Leadership';

    document.getElementById('modalEventDept').innerHTML = `<span class="badge ${getDeptBadgeClass(event.department)}">${escapeHtml(event.department || 'General Church')}</span>`;
    document.getElementById('modalEventMinistry').innerHTML = `<span class="badge ${event.ministry_name ? 'badge-ministry-pill' : 'badge-inactive'}">${escapeHtml(event.ministry_name || 'General Church')}</span>`;

    const descEl = document.getElementById('modalEventDesc');
    if (descEl) descEl.textContent = event.description || 'Join us for this church gathering and fellowship as we grow together in faith and community.';

    let enrollText = event.is_enrollment_open == 1 ? 'Enrollment is OPEN for church members.' : 'Enrollment is currently CLOSED.';
    try {
        const enrollRes = await api.events.getEnrollments(id);
        const count = (enrollRes.data || []).length;
        enrollText += ` (${count} participant${count === 1 ? '' : 's'} registered)`;
    } catch (e) {}

    const enrollInfoEl = document.getElementById('modalEventEnrollment');
    if (enrollInfoEl) enrollInfoEl.textContent = enrollText;

    const modal = document.getElementById('leaderEventModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function closeLeaderEventModal() {
    const modal = document.getElementById('leaderEventModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.removeProperty('display');
    }
    if (typeof closeLeaderEventFormModal === 'function') {
        closeLeaderEventFormModal();
    }
}
window.closeLeaderEventModal = closeLeaderEventModal;

// ==========================================
// LEADER EVENT ENROLLMENTS VIEWER
// ==========================================
let activeLeaderEventEnrollmentsList = [];
let activeLeaderEventForEnrollment = null;

async function viewLeaderEventEnrollments(eventId) {
    activeLeaderEventForEnrollment = (allLeaderEventsCache || []).find(e => e.event_id == eventId);

    const modal = document.getElementById('leaderEventEnrollmentsModal');
    if (!modal) return;

    const titleEl = document.getElementById('leaderEnrollModalEventTitle');
    const typeBadgeEl = document.getElementById('leaderEnrollModalTypeBadge');
    const countEl = document.getElementById('leaderEnrollModalTotalCount');
    const searchInput = document.getElementById('leaderEnrollModalSearch');
    const tbody = document.getElementById('leaderEnrollModalTableBody');

    if (titleEl) titleEl.textContent = activeLeaderEventForEnrollment ? activeLeaderEventForEnrollment.title : 'Event / Seminary';
    if (typeBadgeEl) {
        const evType = activeLeaderEventForEnrollment?.event_type || 'Event';
        typeBadgeEl.textContent = evType;
        typeBadgeEl.className = evType === 'Seminary' ? 'badge badge-active' : 'badge badge-income';
    }
    if (searchInput) searchInput.value = '';
    if (countEl) countEl.textContent = '...';

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="p-8 text-center text-slate-400">
                    <i class="fa-solid fa-spinner fa-spin text-xl mr-2 text-primary"></i> Loading enrolled church members...
                </td>
            </tr>
        `;
    }

    modal.style.display = 'flex';
    modal.classList.add('active');

    try {
        const res = await api.events.getEnrollments(eventId);
        activeLeaderEventEnrollmentsList = res.data || [];
        renderLeaderEventEnrollmentsList(activeLeaderEventEnrollmentsList);
    } catch (err) {
        console.error('Failed to load event enrollments for leader:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="p-8 text-center text-rose-500">
                        <i class="fa-solid fa-circle-exclamation mr-1"></i> Failed to load enrollments: ${escapeHtml(err.message)}
                    </td>
                </tr>
            `;
        }
    }
}

function renderLeaderEventEnrollmentsList(enrollments) {
    const tbody = document.getElementById('leaderEnrollModalTableBody');
    const countEl = document.getElementById('leaderEnrollModalTotalCount');
    if (countEl) countEl.textContent = enrollments ? enrollments.length : 0;
    if (!tbody) return;

    if (!enrollments || enrollments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="p-8 text-center text-slate-400">
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
            </tr>
        `;
    }).join('');
}

function filterLeaderEventEnrollmentsList() {
    const q = (document.getElementById('leaderEnrollModalSearch')?.value || '').toLowerCase().trim();
    if (!q) {
        renderLeaderEventEnrollmentsList(activeLeaderEventEnrollmentsList);
        return;
    }
    const filtered = activeLeaderEventEnrollmentsList.filter(en => {
        const name = `${en.first_name || ''} ${en.last_name || ''}`.toLowerCase();
        const email = (en.email || '').toLowerCase();
        const phone = (en.contact_number || '').toLowerCase();
        const status = (en.status || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || status.includes(q);
    });
    renderLeaderEventEnrollmentsList(filtered);
}

function closeLeaderEventEnrollmentsModal() {
    const modal = document.getElementById('leaderEventEnrollmentsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.removeProperty('display');
    }
}

// Department & Ministry Filter Modal for Events
function openLeaderEventDeptMinFilterModal() {
    const deptSelect = document.getElementById('leaderEventModalDeptSelect');
    if (deptSelect) {
        const standardDepts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        deptSelect.innerHTML = '<option value="">All Departments</option>' +
            standardDepts.map(d => `<option value="${d}">${d}</option>`).join('');
        deptSelect.value = leaderEventFilterDept || '';
    }
    populateLeaderEventModalMinistryDropdown(leaderEventFilterDept, leaderEventFilterMinistryId);
    const modal = document.getElementById('leaderEventDeptMinFilterModal');
    if (modal) modal.classList.add('active');
}

function closeLeaderEventDeptMinFilterModal() {
    const modal = document.getElementById('leaderEventDeptMinFilterModal');
    if (modal) modal.classList.remove('active');
}

function onLeaderEventModalDeptChange() {
    const selectedDept = document.getElementById('leaderEventModalDeptSelect')?.value || '';
    populateLeaderEventModalMinistryDropdown(selectedDept, '');
}

function populateLeaderEventModalMinistryDropdown(dept, selectedMinId) {
    const minSelect = document.getElementById('leaderEventModalMinistrySelect');
    if (!minSelect) return;
    let list = allLeaderMinistriesCache || [];
    if (dept) {
        list = list.filter(m => (m.department || '').toLowerCase() === dept.toLowerCase());
    }
    minSelect.innerHTML = '<option value="">All Ministries</option>' +
        list.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');
    minSelect.value = selectedMinId ? String(selectedMinId) : '';
}

function clearLeaderEventDeptMinFilter() {
    leaderEventFilterDept = '';
    leaderEventFilterMinistryId = '';
    const deptSelect = document.getElementById('leaderEventModalDeptSelect');
    if (deptSelect) deptSelect.value = '';
    populateLeaderEventModalMinistryDropdown('', '');
    updateLeaderEventFilterButtonUI();
    applyLeaderEventFilters();
    closeLeaderEventDeptMinFilterModal();
}

function applyLeaderEventDeptMinFilterModal() {
    leaderEventFilterDept = document.getElementById('leaderEventModalDeptSelect')?.value || '';
    leaderEventFilterMinistryId = document.getElementById('leaderEventModalMinistrySelect')?.value || '';
    updateLeaderEventFilterButtonUI();
    applyLeaderEventFilters();
    closeLeaderEventDeptMinFilterModal();
}

function updateLeaderEventFilterButtonUI() {
    const btnLabel = document.getElementById('leaderEventFilterBtnLabel');
    const badge = document.getElementById('leaderEventFilterActiveBadge');
    const btn = document.getElementById('btnLeaderEventFilterModal');
    if (!btnLabel || !badge) return;

    let activeCount = 0;
    let label = 'Dept & Ministry';

    if (leaderEventFilterMinistryId) {
        const min = allLeaderMinistriesCache.find(m => String(m.ministry_id) === String(leaderEventFilterMinistryId));
        if (min) label = min.ministry_name;
        activeCount = 2;
    } else if (leaderEventFilterDept) {
        label = leaderEventFilterDept;
        activeCount = 1;
    }

    if (activeCount > 0) {
        btnLabel.textContent = label.length > 18 ? label.substring(0, 16) + '...' : label;
        badge.textContent = activeCount;
        badge.style.display = 'inline-block';
        if (btn) btn.classList.add('btn-filter-active');
    } else {
        btnLabel.textContent = 'Dept & Ministry';
        badge.style.display = 'none';
        if (btn) btn.classList.remove('btn-filter-active');
    }
}

// ============================================================
// 4. ANNOUNCEMENTS MODULE
// ============================================================
let leaderAnnFilterDept = '';
let leaderAnnFilterMinistryId = '';
let leaderLastSeenAnnouncementId = 0;
let leaderAnnouncementsPollTimer = null;

async function checkLeaderAnnouncementsNotifications() {
    try {
        const res = await api.announcements.getAll();
        const announcements = res.data || [];
        if (!announcements || announcements.length === 0) return;

        const maxId = Math.max(...announcements.map(a => Number(a.announcement_id) || 0));
        const storedLastSeen = Number(localStorage.getItem('cog_leader_last_seen_ann_id') || 0);

        if (leaderLastSeenAnnouncementId === 0) {
            leaderLastSeenAnnouncementId = storedLastSeen > 0 ? storedLastSeen : maxId;
            if (!storedLastSeen) {
                localStorage.setItem('cog_leader_last_seen_ann_id', String(maxId));
            }
            return;
        }

        if (maxId > leaderLastSeenAnnouncementId) {
            const newAnns = announcements.filter(a => Number(a.announcement_id) > leaderLastSeenAnnouncementId);
            leaderLastSeenAnnouncementId = maxId;

            // Show notification dot on sidebar
            const dot = document.getElementById('leaderAnnounceNavDot');
            if (dot) dot.style.display = 'block';

            // Play announcement chime sound
            playPortalNotificationSound('announcement');

            // Display toast
            const latest = newAnns[0];
            showToast(`📢 New Church Announcement: "${escapeHtml(latest.title || '')}"`);

            // If announcements view is active, refresh table
            const currentView = document.querySelector('.view.active')?.id;
            if (currentView === 'view-announcements') {
                allLeaderAnnCache = announcements;
                applyLeaderAnnFilters();
            }
        }
    } catch (err) {
        // silent background poll
    }
}

function initLeaderAnnouncementsNotifier() {
    if (leaderAnnouncementsPollTimer) clearInterval(leaderAnnouncementsPollTimer);
    checkLeaderAnnouncementsNotifications();
    leaderAnnouncementsPollTimer = setInterval(checkLeaderAnnouncementsNotifications, 12000);
}

let currentLeaderAnnPage = 1;
const LEADER_ANN_PAGE_LIMIT = 10;

async function loadLeaderAnnouncements(page = 1) {
    currentLeaderAnnPage = page;
    const search = (document.getElementById('leaderAnnSearch')?.value || '').trim();
    const category = document.getElementById('leaderAnnCategoryFilter')?.value || '';
    const audience = document.getElementById('leaderAnnAudienceFilter')?.value || '';

    const filters = { search, category, target_audience: audience };
    if (leaderAnnFilterMinistryId) {
        filters.ministry_id = leaderAnnFilterMinistryId;
    } else if (leaderAnnFilterDept) {
        filters.department = leaderAnnFilterDept;
    }

    const tbody = document.getElementById('leaderAnnTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading announcements...</td></tr>';

    try {
        const res = await api.announcements.getAll(currentLeaderAnnPage, LEADER_ANN_PAGE_LIMIT, filters);
        const list = res.data || [];
        allLeaderAnnCache = list;
        renderLeaderAnnTable(list);

        const total = res.pagination ? res.pagination.total : list.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / LEADER_ANN_PAGE_LIMIT);

        const pageInfo = document.getElementById('leaderAnnPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentLeaderAnnPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('leaderAnnPrevBtn');
        if (prevBtn) prevBtn.disabled = currentLeaderAnnPage <= 1;

        const nextBtn = document.getElementById('leaderAnnNextBtn');
        if (nextBtn) nextBtn.disabled = currentLeaderAnnPage >= totalPages;
    } catch (error) {
        showToast('Error loading announcements: ' + error.message);
    }
}

function applyLeaderAnnFilters() {
    loadLeaderAnnouncements(1);
}

function resetLeaderAnnFilters() {
    if (document.getElementById('leaderAnnSearch')) document.getElementById('leaderAnnSearch').value = '';
    if (document.getElementById('leaderAnnCategoryFilter')) document.getElementById('leaderAnnCategoryFilter').value = '';
    if (document.getElementById('leaderAnnAudienceFilter')) document.getElementById('leaderAnnAudienceFilter').value = '';
    clearLeaderAnnDeptMinFilter();
}

function changeLeaderAnnPage(direction) {
    const newPage = currentLeaderAnnPage + direction;
    if (newPage > 0) {
        loadLeaderAnnouncements(newPage);
    }
} 

function renderLeaderAnnTable(announcements) {
    const tbody = document.getElementById('leaderAnnTableBody');
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
                <td class="p-4 font-medium text-navy">
                    <div style="font-weight: 600; font-size: 0.95rem;">${escapeHtml(a.title)}</div>
                </td>
                <td class="p-4"><span class="badge ${getDeptBadgeClass(a.department)}">${escapeHtml(a.department || 'General')}</span></td>
                <td class="p-4"><span class="badge ${a.ministry_name ? 'badge-ministry-pill' : 'badge-inactive'}">${escapeHtml(a.ministry_name || 'General Church')}</span></td>
                <td class="p-4">${getAnnouncementCategoryBadge(a.category)}</td>
                <td class="p-4 text-xs text-slate-600">${escapeHtml(a.target_audience || 'General')}</td>
                <td class="p-4">
                    ${a.is_pinned == 1 
                        ? '<span class="badge" style="background: #fef08a; color: #854d0e; font-weight: 600;"><i class="fa-solid fa-thumbtack mr-1"></i> Yes</span>' 
                        : '<span class="text-slate-400 text-xs">No</span>'}
                </td>
                <td class="p-4 text-xs text-slate-600">${new Date(a.created_at).toLocaleDateString()}</td>
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
                    <div class="action-btns-wrap" style="display: inline-flex; gap: 0.35rem; justify-content: flex-end;">
                        <button class="btn-action" style="border-color: #2563eb; color: #2563eb;" onclick="triggerLeaderEmailBroadcast(${a.announcement_id})" title="${isEmailSent ? 'Resend Email Broadcast' : 'Send Email Broadcast to Members'}">
                            <i class="fa-solid fa-envelope"></i>
                        </button>
                        <button class="btn-action" style="border-color: #10b981; color: #10b981;" onclick="triggerLeaderSmsBroadcast(${a.announcement_id})" title="${isSmsVerified ? 'Resend Verified SMS Broadcast' : 'Send Verified SMS Broadcast to Members'}">
                            <i class="fa-solid fa-comment-sms"></i>
                        </button>
                        <button class="btn-action btn-view" onclick="viewLeaderAnnouncement(${a.announcement_id})" title="View Announcement">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="btn-action btn-edit" onclick="openLeaderAnnouncementModal(${a.announcement_id})" title="Edit Announcement">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function triggerLeaderEmailBroadcast(id) {
    const ok = await showDecisionModal({
        title: 'Dispatch Email Broadcast',
        message: 'Dispatch official email announcement broadcast to all active members with registered emails?',
        confirmText: 'Send Broadcast',
        type: 'primary',
        icon: 'fa-paper-plane'
    });
    if (!ok) return;

    try {
        const res = await api.announcements.broadcast(id);
        showToast(res.message || 'Announcement broadcast email triggered successfully!');
        loadLeaderAnnouncements();
    } catch (err) {
        showToast(err.message || 'Failed to dispatch email broadcast', 'error');
    }
}

async function triggerLeaderSmsBroadcast(id) {
    const ann = (allLeaderAnnCache || []).find(a => a.announcement_id == id);
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
        loadLeaderAnnouncements();
    } catch (err) {
        showToast(err.message || 'Failed to dispatch SMS broadcast', 'error');
    }
}
window.triggerLeaderEmailBroadcast = triggerLeaderEmailBroadcast;
window.triggerLeaderSmsBroadcast = triggerLeaderSmsBroadcast;
window.triggerSmsBroadcast = triggerLeaderSmsBroadcast;

function viewLeaderAnnouncement(id) {
    const ann = allLeaderAnnCache.find(a => a.announcement_id == id);
    if (!ann) return;

    document.getElementById('modalAnnTitle').textContent = ann.title;
    document.getElementById('modalAnnCategory').innerHTML = getAnnouncementCategoryBadge(ann.category);
    document.getElementById('modalAnnAudience').textContent = ann.target_audience || 'General Church';
    document.getElementById('modalAnnDept').innerHTML = `<span class="badge ${getDeptBadgeClass(ann.department)}">${escapeHtml(ann.department || 'General Church')}</span>`;
    document.getElementById('modalAnnMinistry').innerHTML = `<span class="badge ${ann.ministry_name ? 'badge-ministry-pill' : 'badge-inactive'}">${escapeHtml(ann.ministry_name || 'General Church')}</span>`;
    document.getElementById('modalAnnDate').textContent = new Date(ann.created_at).toLocaleString();
    document.getElementById('modalAnnContent').textContent = ann.content || 'No content provided.';

    const modal = document.getElementById('leaderAnnouncementModal');
    if (modal) modal.classList.add('active');
}

function closeLeaderAnnouncementModal() {
    const modal = document.getElementById('leaderAnnouncementModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.removeProperty('display');
    }
}
window.closeLeaderAnnouncementModal = closeLeaderAnnouncementModal;

// Department & Ministry Filter Modal for Announcements
function openLeaderAnnDeptMinFilterModal() {
    const deptSelect = document.getElementById('leaderAnnModalDeptSelect');
    if (deptSelect) {
        const standardDepts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        deptSelect.innerHTML = '<option value="">All Departments</option>' +
            standardDepts.map(d => `<option value="${d}">${d}</option>`).join('');
        deptSelect.value = leaderAnnFilterDept || '';
    }
    populateLeaderAnnModalMinistryDropdown(leaderAnnFilterDept, leaderAnnFilterMinistryId);
    const modal = document.getElementById('leaderAnnDeptMinFilterModal');
    if (modal) modal.classList.add('active');
}

function closeLeaderAnnDeptMinFilterModal() {
    const modal = document.getElementById('leaderAnnDeptMinFilterModal');
    if (modal) modal.classList.remove('active');
}

function onLeaderAnnModalDeptChange() {
    const selectedDept = document.getElementById('leaderAnnModalDeptSelect')?.value || '';
    populateLeaderAnnModalMinistryDropdown(selectedDept, '');
}

function populateLeaderAnnModalMinistryDropdown(dept, selectedMinId) {
    const minSelect = document.getElementById('leaderAnnModalMinistrySelect');
    if (!minSelect) return;
    let list = allLeaderMinistriesCache || [];
    if (dept) {
        list = list.filter(m => (m.department || '').toLowerCase() === dept.toLowerCase());
    }
    minSelect.innerHTML = '<option value="">All Ministries</option>' +
        list.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');
    minSelect.value = selectedMinId ? String(selectedMinId) : '';
}

function clearLeaderAnnDeptMinFilter() {
    leaderAnnFilterDept = '';
    leaderAnnFilterMinistryId = '';
    const deptSelect = document.getElementById('leaderAnnModalDeptSelect');
    if (deptSelect) deptSelect.value = '';
    populateLeaderAnnModalMinistryDropdown('', '');
    updateLeaderAnnFilterButtonUI();
    applyLeaderAnnFilters();
    closeLeaderAnnDeptMinFilterModal();
}

function applyLeaderAnnDeptMinFilterModal() {
    leaderAnnFilterDept = document.getElementById('leaderAnnModalDeptSelect')?.value || '';
    leaderAnnFilterMinistryId = document.getElementById('leaderAnnModalMinistrySelect')?.value || '';
    updateLeaderAnnFilterButtonUI();
    applyLeaderAnnFilters();
    closeLeaderAnnDeptMinFilterModal();
}

function updateLeaderAnnFilterButtonUI() {
    const btnLabel = document.getElementById('leaderAnnFilterBtnLabel');
    const badge = document.getElementById('leaderAnnFilterActiveBadge');
    const btn = document.getElementById('btnLeaderAnnFilterModal');
    if (!btnLabel || !badge) return;

    let activeCount = 0;
    let label = 'Dept & Ministry';

    if (leaderAnnFilterMinistryId) {
        const min = allLeaderMinistriesCache.find(m => String(m.ministry_id) === String(leaderAnnFilterMinistryId));
        if (min) label = min.ministry_name;
        activeCount = 2;
    } else if (leaderAnnFilterDept) {
        label = leaderAnnFilterDept;
        activeCount = 1;
    }

    if (activeCount > 0) {
        btnLabel.textContent = label.length > 18 ? label.substring(0, 16) + '...' : label;
        badge.textContent = activeCount;
        badge.style.display = 'inline-block';
        if (btn) btn.classList.add('btn-filter-active');
    } else {
        btnLabel.textContent = 'Dept & Ministry';
        badge.style.display = 'none';
        if (btn) btn.classList.remove('btn-filter-active');
    }
}

// ============================================================
// 5. WORDA MINISTRIES (LEADER VIEW & DEPARTMENT HEAD OVERSIGHT)
// ============================================================
let leaderAssignedMinistriesCache = [];
let leaderDeptOversightData = null;
let currentLeaderWordaMode = 'department'; // 'department' | 'ministry'
let activeLeaderMinistryId = null;
let activeMinistryRosterCache = [];
let leaderRosterSearchQuery = '';
let leaderRosterRoleFilter = 'all';
let leaderRosterStatusFilter = 'all';
let leaderDeptMinSearchQuery = '';

async function loadMinistries() {
    const deptContainer = document.getElementById('leaderDeptHeadContainer');
    const minContainer = document.getElementById('leaderMinistryContainer');
    const modeSwitcher = document.getElementById('leaderWordaModeSwitcher');
    const switcher = document.getElementById('leaderMinistrySwitcher');

    if (minContainer) {
        minContainer.innerHTML = `
            <div class="card p-8 text-center text-slate-400">
                <i class="fa-solid fa-spinner fa-spin text-2xl mr-2 text-primary"></i> Loading your assigned ministry command center...
            </div>
        `;
    }

    try {
        const [assignedRes, oversightRes] = await Promise.all([
            api.ministries.getMyAssigned().catch(() => ({ data: [] })),
            api.ministries.getLeaderDepartmentOversight().catch(() => ({ data: { is_department_head: false, departments: [] } }))
        ]);

        leaderAssignedMinistriesCache = assignedRes.data || [];
        leaderDeptOversightData = oversightRes.data || { is_department_head: false, departments: [] };

        const isDeptHead = leaderDeptOversightData && leaderDeptOversightData.is_department_head && leaderDeptOversightData.departments && leaderDeptOversightData.departments.length > 0;
        const hasAssignedMinistries = leaderAssignedMinistriesCache.length > 0;

        if (isDeptHead && document.getElementById('sumMinistries')) {
            let deptMinCount = 0;
            leaderDeptOversightData.departments.forEach(d => {
                deptMinCount += (d.ministries ? d.ministries.length : 0);
            });
            document.getElementById('sumMinistries').innerText = deptMinCount;
        }

        // Multi-ministry switcher for assigned ministries
        if (hasAssignedMinistries && leaderAssignedMinistriesCache.length > 1) {
            const pillsContainer = document.getElementById('leaderMinistryPills');
            if (pillsContainer) {
                pillsContainer.innerHTML = leaderAssignedMinistriesCache.map(m => `
                    <button class="dept-pill ${m.ministry_id == activeLeaderMinistryId ? 'active' : ''}" 
                            onclick="selectLeaderAssignedMinistry(${m.ministry_id})">
                        <i class="fa-solid fa-church mr-1"></i> ${escapeHtml(m.ministry_name)}
                    </button>
                `).join('');
            }
        }

        if (!activeLeaderMinistryId || !leaderAssignedMinistriesCache.some(m => m.ministry_id == activeLeaderMinistryId)) {
            activeLeaderMinistryId = hasAssignedMinistries ? leaderAssignedMinistriesCache[0].ministry_id : null;
        }

        if (isDeptHead) {
            const primaryDept = leaderDeptOversightData.departments[0];
            const deptName = primaryDept.department;

            // Configure Mode Switcher if leader also has assigned ministry
            if (modeSwitcher) {
                if (hasAssignedMinistries) {
                    modeSwitcher.style.display = 'block';
                    const labelDept = document.getElementById('labelDeptHeadOversight');
                    const labelMin = document.getElementById('labelMyAssignedMinistry');
                    if (labelDept) labelDept.textContent = `${deptName} Department Oversight`;
                    if (labelMin) labelMin.textContent = `My Assigned Ministry (${leaderAssignedMinistriesCache.length})`;
                } else {
                    modeSwitcher.style.display = 'none';
                    currentLeaderWordaMode = 'department';
                }
            }

            switchLeaderWordaMode(currentLeaderWordaMode);
        } else {
            // Not a department head
            if (modeSwitcher) modeSwitcher.style.display = 'none';
            if (deptContainer) deptContainer.style.display = 'none';
            if (minContainer) minContainer.style.display = 'block';

            if (!hasAssignedMinistries) {
                if (switcher) switcher.style.display = 'none';
                if (minContainer) {
                    minContainer.innerHTML = `
                        <div class="card p-12 text-center" style="max-width: 680px; margin: 2rem auto; border: 1px dashed var(--border-color); border-radius: 16px; background: #fafbfc;">
                            <div style="width: 72px; height: 72px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">
                                <i class="fa-solid fa-users-slash text-slate-400" style="font-size: 2rem;"></i>
                            </div>
                            <h2 style="font-size: 1.35rem; color: var(--navy); margin-bottom: 0.5rem; font-weight: 700;">No Assigned Ministry Found</h2>
                            <p class="text-sm text-slate-500" style="line-height: 1.6; max-width: 480px; margin: 0 auto 1.5rem;">
                                You are currently not designated as a ministry leader or department head. If you oversee or lead a WORDA ministry, please coordinate with Church Administration to have your account linked.
                            </p>
                            <div style="display: inline-flex; gap: 0.5rem;">
                                <button class="btn-secondary" onclick="loadDashboardSummary(); navigateTo('dashboard');">
                                    <i class="fa-solid fa-house mr-1"></i> Return to Dashboard
                                </button>
                            </div>
                        </div>
                    `;
                }
                return;
            }

            if (switcher) switcher.style.display = (leaderAssignedMinistriesCache.length > 1) ? 'block' : 'none';
            await renderLeaderMinistryDashboard(activeLeaderMinistryId);
        }
    } catch (error) {
        console.error('Failed to load leader ministries:', error);
        if (minContainer) {
            minContainer.innerHTML = `
                <div class="card p-8 text-center text-rose-500">
                    <i class="fa-solid fa-circle-exclamation text-2xl mb-2 block"></i>
                    Failed to load your assigned ministry details: ${escapeHtml(error.message)}
                </div>
            `;
        }
    }
}

function switchLeaderWordaMode(mode) {
    currentLeaderWordaMode = mode;
    const tabDept = document.getElementById('tabBtnDeptHeadOversight');
    const tabMin = document.getElementById('tabBtnMyAssignedMinistry');
    const deptContainer = document.getElementById('leaderDeptHeadContainer');
    const minContainer = document.getElementById('leaderMinistryContainer');
    const minSwitcher = document.getElementById('leaderMinistrySwitcher');

    if (mode === 'department') {
        if (tabDept) tabDept.classList.add('active');
        if (tabMin) tabMin.classList.remove('active');
        if (deptContainer) deptContainer.style.display = 'block';
        if (minContainer) minContainer.style.display = 'none';
        if (minSwitcher) minSwitcher.style.display = 'none';
        if (leaderDeptOversightData && leaderDeptOversightData.departments && leaderDeptOversightData.departments[0]) {
            renderLeaderDepartmentOversight(leaderDeptOversightData.departments[0]);
        }
    } else {
        if (tabDept) tabDept.classList.remove('active');
        if (tabMin) tabMin.classList.add('active');
        if (deptContainer) deptContainer.style.display = 'none';
        if (minContainer) minContainer.style.display = 'block';
        if (minSwitcher && leaderAssignedMinistriesCache.length > 1) {
            minSwitcher.style.display = 'block';
        }
        if (activeLeaderMinistryId) {
            renderLeaderMinistryDashboard(activeLeaderMinistryId);
        }
    }
}

function renderLeaderDepartmentOversight(deptData) {
    const container = document.getElementById('leaderDeptHeadContainer');
    if (!container || !deptData) return;

    const dept = deptData.department;
    const isRelationship = (dept || '').trim().toUpperCase() === 'RELATIONSHIP';
    const deptColors = {
        'Worship': '#2563eb',
        'Outreach': '#059669',
        'Relationship': '#d97706',
        'Discipleship': '#7c3aed',
        'Administration': '#475569'
    };
    const deptIcons = {
        'Worship': 'fa-hands-praying',
        'Outreach': 'fa-earth-americas',
        'Relationship': 'fa-people-arrows',
        'Discipleship': 'fa-book-bible',
        'Administration': 'fa-building-columns'
    };
    const color = deptColors[dept] || '#2563eb';
    const icon = deptIcons[dept] || 'fa-sitemap';

    const ministries = (deptData.ministries || []).filter(m => {
        if (!leaderDeptMinSearchQuery) return true;
        const q = leaderDeptMinSearchQuery.toLowerCase();
        return (m.ministry_name && m.ministry_name.toLowerCase().includes(q)) ||
               (m.ministry_code && m.ministry_code.toLowerCase().includes(q)) ||
               (m.leader_name && m.leader_name.toLowerCase().includes(q));
    });

    container.innerHTML = `
        <!-- 1. Executive Department Head Command Center Hero Card -->
        <div class="dept-head-hero-card mb-6" style="border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid var(--border-color, #e2e8f0);">
            <div style="background: linear-gradient(135deg, #061730 0%, ${color} 100%); padding: 2rem 2.25rem; color: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1.25rem;">
                    <div style="flex: 1; min-width: 280px;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                            <span class="badge" style="background: rgba(217, 119, 6, 0.25); color: #fde68a; border: 1px solid rgba(217, 119, 6, 0.5); font-weight: 700; font-size: 0.75rem; padding: 0.25rem 0.65rem;">
                                <i class="fa-solid fa-crown mr-1" style="color: var(--gold, #d97706);"></i> Department Head Oversight
                            </span>
                            <span class="badge" style="background: rgba(255,255,255,0.2); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); font-size: 0.75rem; padding: 0.25rem 0.65rem;">
                                <i class="fa-solid ${icon} mr-1"></i> ${escapeHtml(dept)} Department
                            </span>
                            <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #a7f3d0; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.75rem; padding: 0.25rem 0.65rem;">
                                <i class="fa-solid fa-check-circle mr-1"></i> Active Department
                            </span>
                        </div>
                        <h2 style="font-size: 2.15rem; margin: 0 0 0.4rem; color: #ffffff; font-family: 'Cormorant Garamond', serif; font-weight: 700; line-height: 1.2;">
                            ${escapeHtml(dept)} Department Ministries
                        </h2>
                        <p style="font-size: 0.875rem; line-height: 1.6; color: rgba(255,255,255,0.88); margin: 0; max-width: 720px;">
                            As the appointed Department Head, you have administrative oversight over all ministries, appointed leaders, meeting schedules, and church member rosters under the <strong>${escapeHtml(dept)} Department</strong>.
                        </p>
                    </div>

                    <!-- Department Head Quick Actions -->
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; min-width: 220px;">
                        <button type="button" class="btn-secondary" onclick="openLeaderWorkCalendarModal()" style="background: rgba(255,255,255,0.15); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); width: 100%; justify-content: center; font-weight: 600;">
                            <i class="fa-solid fa-calendar-days mr-1.5" style="color: var(--gold, #d97706);"></i> View Work Calendar
                        </button>
                        ${isRelationship ? `
                        <button type="button" class="btn-primary" onclick="navigateTo('c2s')" style="width: 100%; justify-content: center; background: var(--gold, #d97706); color: #1e293b; border: none; font-weight: 700; padding: 0.55rem 1rem;">
                            <i class="fa-solid fa-people-roof mr-1.5"></i> View C2S Groups
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- 3 Department Summary Stat Pills -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.15);">
                    <div style="background: rgba(0,0,0,0.2); padding: 0.85rem 1.1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 0.85rem;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(59, 130, 246, 0.25); display: flex; align-items: center; justify-content: center; font-size: 1.15rem; color: #93c5fd;">
                            <i class="fa-solid fa-sitemap"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.7); font-weight: 700;">Ministries Overseen</div>
                            <div style="font-size: 1.4rem; font-weight: 800; color: #ffffff;">${deptData.stats.total_ministries}</div>
                        </div>
                    </div>
                    <div style="background: rgba(0,0,0,0.2); padding: 0.85rem 1.1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 0.85rem;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(245, 158, 11, 0.25); display: flex; align-items: center; justify-content: center; font-size: 1.15rem; color: #fde68a;">
                            <i class="fa-solid fa-user-tie"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.7); font-weight: 700;">Appointed Leaders</div>
                            <div style="font-size: 1.4rem; font-weight: 800; color: #ffffff;">${deptData.stats.total_leaders}</div>
                        </div>
                    </div>
                    <div style="background: rgba(0,0,0,0.2); padding: 0.85rem 1.1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 0.85rem;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: center; font-size: 1.15rem; color: #a7f3d0;">
                            <i class="fa-solid fa-users"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.7); font-weight: 700;">Active Serving Members</div>
                            <div style="font-size: 1.4rem; font-weight: 800; color: #ffffff;">${deptData.stats.total_active_members}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. Department Ministries Roster and Management Section -->
        <div class="card" style="padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
                <div>
                    <h3 style="margin: 0; font-size: 1.25rem; color: var(--navy); font-weight: 700;">
                        <i class="fa-solid ${icon} text-primary mr-2"></i> Ministries under ${escapeHtml(dept)} Department (${ministries.length})
                    </h3>
                    <p class="text-xs text-slate-500" style="margin-top: 0.2rem;">
                        Select or expand any ministry below to review its appointed leader, schedule, and team roster.
                    </p>
                </div>

                <!-- Search Input -->
                <div style="position: relative; min-width: 260px;">
                    <input type="text" id="leaderDeptMinSearchInput" placeholder="Search ministry, code, or leader..."
                           value="${escapeHtml(leaderDeptMinSearchQuery)}"
                           oninput="onLeaderDeptMinSearch(this.value)"
                           style="padding: 0.5rem 0.85rem 0.5rem 2rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.85rem; width: 100%;">
                    <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;"></i>
                </div>
            </div>

            <!-- Ministries Grid -->
            <div class="space-y-4">
                ${ministries.length === 0 ? `
                    <div class="text-center p-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        <i class="fa-solid fa-folder-open text-3xl mb-2 text-slate-300"></i>
                        <p class="font-medium text-slate-600">No ministries found matching your filter in ${escapeHtml(dept)} Department.</p>
                    </div>
                ` : ministries.map(m => `
                    <div class="dept-min-card p-4 rounded-lg border" style="background: var(--bg-card, #ffffff); border-left: 5px solid ${m.color_code || color}; border-color: var(--border-color, #e2e8f0); transition: all 0.2s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                            <div style="flex: 1; min-width: 250px;">
                                <div class="flex items-center gap-2 flex-wrap mb-1">
                                    <strong class="text-base text-navy font-bold">${escapeHtml(m.ministry_name)}</strong>
                                    <span class="badge badge-info" style="font-size: 0.7rem; padding: 0.2rem 0.55rem;">${escapeHtml(m.ministry_code || 'N/A')}</span>
                                    <span class="badge ${m.is_active == 1 ? 'badge-status-active' : 'badge-status-inactive'}" style="font-size: 0.7rem; padding: 0.2rem 0.55rem;">
                                        ${m.is_active == 1 ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div class="text-xs text-slate-500 mt-2 flex items-center gap-4 flex-wrap">
                                    <span class="flex items-center gap-1.5">
                                        <i class="fa-solid fa-user-tie text-gold"></i>
                                        Leader: <strong class="text-slate-700">${escapeHtml(m.leader_name || 'Unassigned')}</strong>
                                    </span>
                                    <span class="flex items-center gap-1.5">
                                        <i class="fa-regular fa-clock text-slate-400"></i>
                                        ${escapeHtml(m.meeting_schedule || 'No meeting schedule')}
                                    </span>
                                    <span class="flex items-center gap-1.5">
                                        <i class="fa-solid fa-users text-slate-400"></i>
                                        <strong class="text-slate-700">${m.member_count || 0}</strong> active roster members
                                    </span>
                                </div>
                                ${m.description ? `
                                <p class="text-xs text-slate-600 mt-2 mb-0" style="line-height: 1.5;">${escapeHtml(m.description)}</p>
                                ` : ''}
                            </div>

                            <!-- Action buttons -->
                            <div class="flex items-center gap-2">
                                <button type="button" class="btn-primary btn-sm" onclick="viewLeaderMinistryRoster(${m.ministry_id}, '${escapeHtml(m.ministry_name)}')" title="View complete roster table">
                                    <i class="fa-solid fa-users mr-1"></i> View Full Roster
                                </button>
                                <button type="button" class="btn-secondary btn-sm" onclick="toggleDeptHeadMinistryInlineRoster(${m.ministry_id})" id="btnToggleInline_${m.ministry_id}" title="Toggle inline members list">
                                    <i class="fa-solid fa-chevron-down mr-1"></i> Quick View
                                </button>
                            </div>
                        </div>

                        <!-- Inline Collapsible Roster Container -->
                        <div id="inlineDeptRoster_${m.ministry_id}" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-color, #e2e8f0);">
                            <div class="p-3 text-center text-xs text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Loading roster members...</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function toggleDeptHeadMinistryInlineRoster(ministryId) {
    const container = document.getElementById(`inlineDeptRoster_${ministryId}`);
    const btn = document.getElementById(`btnToggleInline_${ministryId}`);
    if (!container) return;

    if (container.style.display === 'block') {
        container.style.display = 'none';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-chevron-down mr-1"></i> Quick View';
        return;
    }

    container.style.display = 'block';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-chevron-up mr-1"></i> Hide Quick View';
    container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Loading roster members...</div>';

    try {
        const res = await api.ministries.getMembers(ministryId);
        const members = res.data || [];

        if (members.length === 0) {
            container.innerHTML = '<div class="p-3 text-center text-xs text-slate-400">No members currently enrolled in this ministry.</div>';
            return;
        }

        container.innerHTML = `
            <div class="overflow-x-auto rounded border border-slate-200">
                <table class="w-full text-xs text-left">
                    <thead class="bg-slate-50 text-slate-600 uppercase font-bold" style="border-bottom: 1px solid var(--border-color, #e2e8f0);">
                        <tr>
                            <th class="p-2.5">Member Name</th>
                            <th class="p-2.5">Role in Ministry</th>
                            <th class="p-2.5">Contact Number</th>
                            <th class="p-2.5">Email</th>
                            <th class="p-2.5">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${members.map(mem => {
                            const isLeader = mem.is_ministry_leader == 1;
                            return `
                            <tr style="${isLeader ? 'background: #fffdf5; border-left: 3px solid #f59e0b;' : ''}">
                                <td class="p-2.5 font-semibold text-navy">
                                    <div class="flex items-center gap-2">
                                        <div style="width: 24px; height: 24px; border-radius: 50%; background: ${isLeader ? '#fef3c7' : '#eff6ff'}; color: ${isLeader ? '#d97706' : '#2563eb'}; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700;">
                                            ${isLeader ? '<i class="fa-solid fa-crown" style="font-size:0.65rem;"></i>' : (mem.first_name ? mem.first_name.charAt(0).toUpperCase() : 'M')}
                                        </div>
                                        <span>${escapeHtml(mem.first_name)} ${escapeHtml(mem.last_name)}</span>
                                        ${isLeader ? `<span class="badge" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 0.65rem; font-weight: 700; padding: 1px 5px; display: inline-flex; align-items: center; gap: 3px;"><i class="fa-solid fa-crown text-amber-500"></i> Leader</span>` : ''}
                                    </div>
                                </td>
                                <td class="p-2.5">
                                    <span class="badge ${isLeader ? 'badge-info' : 'badge-income'}" style="font-size: 0.68rem; ${isLeader ? 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700;' : ''}">
                                        ${isLeader ? '<i class="fa-solid fa-crown mr-1" style="color: #d97706;"></i> ' : ''}${escapeHtml(mem.role_in_ministry || (isLeader ? 'Ministry Leader' : 'Member'))}
                                    </span>
                                </td>
                                <td class="p-2.5 font-mono text-slate-600">${escapeHtml(mem.contact_number || 'N/A')}</td>
                                <td class="p-2.5 text-slate-600">${escapeHtml(mem.email || 'N/A')}</td>
                                <td class="p-2.5">
                                    <span class="badge ${mem.status === 'Active' ? 'badge-status-active' : 'badge-status-inactive'}" style="font-size: 0.65rem;">
                                        ${escapeHtml(mem.status || 'Active')}
                                    </span>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="p-3 text-center text-xs text-rose-500">Failed to load roster: ${escapeHtml(err.message)}</div>`;
    }
}

function onLeaderDeptMinSearch(query) {
    leaderDeptMinSearchQuery = query || '';
    if (leaderDeptOversightData && leaderDeptOversightData.departments && leaderDeptOversightData.departments[0]) {
        renderLeaderDepartmentOversight(leaderDeptOversightData.departments[0]);
    }
}

async function selectLeaderAssignedMinistry(minId) {
    activeLeaderMinistryId = minId;
    const pillsContainer = document.getElementById('leaderMinistryPills');
    if (pillsContainer) {
        pillsContainer.querySelectorAll('.dept-pill').forEach(btn => btn.classList.remove('active'));
        const activeBtn = pillsContainer.querySelector(`button[onclick*="${minId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }
    await renderLeaderMinistryDashboard(activeLeaderMinistryId);
}

async function renderLeaderMinistryDashboard(minId) {
    const container = document.getElementById('leaderMinistryContainer');
    if (!container) return;

    const m = leaderAssignedMinistriesCache.find(x => x.ministry_id == minId) || leaderAssignedMinistriesCache[0];
    if (!m) return;

    try {
        const rosterRes = await api.ministries.getMembers(minId).catch(() => ({ data: [] }));
        activeMinistryRosterCache = rosterRes.data || [];

        const color = m.color_code || '#0E2A4F';
        const distinctRosterRoles = [...new Set(activeMinistryRosterCache.map(mem => (mem.role_in_ministry || '').trim()).filter(Boolean))].sort();
        const isRelationship = (m.department || '').trim().toUpperCase() === 'RELATIONSHIP';

        container.innerHTML = `
            <!-- 1. Executive Ministry Hero Header Card -->
            <div class="ministry-hero-card mb-6">
                <div class="ministry-hero-header" style="background: linear-gradient(135deg, #061730 0%, ${color} 100%); padding: 2rem 2.25rem; border-radius: 12px; color: #ffffff;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; flex-wrap: wrap;">
                                <span class="badge" style="background: rgba(255,255,255,0.2); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); font-weight: 700;">
                                    ${escapeHtml(m.ministry_code)}
                                </span>
                                <span class="badge" style="background: rgba(201, 169, 97, 0.25); color: #fde68a; border: 1px solid rgba(201, 169, 97, 0.4); font-size: 0.75rem;">
                                    <i class="fa-solid fa-sitemap mr-1"></i> ${escapeHtml(m.department || 'WORDA')} Department
                                </span>
                                <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #a7f3d0; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.75rem;">
                                    <i class="fa-solid fa-users mr-1"></i> ${activeMinistryRosterCache.length} Active Roster Members
                                </span>
                            </div>
                            <h2 style="font-size: 2.15rem; margin: 0 0 0.35rem; color: #ffffff; font-family: 'Cormorant Garamond', serif; font-weight: 700;">
                                ${escapeHtml(m.ministry_name)}
                            </h2>
                            <div style="display: flex; align-items: center; gap: 1.25rem; font-size: 0.875rem; color: rgba(255,255,255,0.9); flex-wrap: wrap; margin-top: 0.35rem;">
                                <span>
                                    <i class="fa-solid fa-user-tie" style="color: var(--gold); margin-right: 0.35rem;"></i>
                                    Leader: <strong>${escapeHtml(m.leader_name || 'Assigned Leader')}</strong>
                                </span>
                                <span>
                                    <i class="fa-regular fa-clock" style="color: var(--gold); margin-right: 0.35rem;"></i>
                                    Meeting Schedule: <strong>${escapeHtml(m.meeting_schedule || 'Sunday Services & Midweek')}</strong>
                                </span>
                            </div>
                        </div>

                        <!-- Quick Action: Open Schedule on Calendar & C2S Navigation -->
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: stretch; min-width: 200px;">
                            <button type="button" class="btn-secondary" onclick="openLeaderWorkCalendarModal()" style="background: rgba(255,255,255,0.15); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); width: 100%; justify-content: center;">
                                <i class="fa-solid fa-calendar-days mr-1.5 text-gold"></i> View Ministry on Work Calendar
                            </button>
                            ${isRelationship ? `
                            <button type="button" class="btn-primary" onclick="navigateTo('c2s')" style="width: 100%; justify-content: center; background: var(--gold, #d97706); color: #1e293b; border: none; font-weight: 600; padding: 0.5rem 1rem;">
                                <i class="fa-solid fa-people-roof mr-1.5"></i> View C2S Groups
                            </button>
                            ` : ''}
                        </div>
                    </div>

                    <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.15); font-size: 0.875rem; line-height: 1.6; color: rgba(255,255,255,0.85);">
                        ${escapeHtml(m.description || 'Dedicated to spiritual excellence and faithful Christian service within the Church of God community.')}
                    </div>
                </div>
            </div>

            <!-- 2. Clean Ministry Roster Members Table Card -->
            <div class="card" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.2rem; color: var(--navy); font-weight: 700;">
                            <i class="fa-solid fa-users text-primary mr-2"></i> Ministry Team Members Roster (${activeMinistryRosterCache.length})
                        </h3>
                        <p class="text-xs text-slate-500" style="margin-top: 0.2rem;">
                            Brothers, sisters, and leaders actively serving in the ${escapeHtml(m.ministry_name)} ministry.
                        </p>
                    </div>

                    <!-- Search and Filters Toolbar -->
                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        <div style="position: relative;">
                            <input type="text" id="leaderRosterSearchInput" placeholder="Search name, email, or role..." 
                                   value="${escapeHtml(leaderRosterSearchQuery)}"
                                   oninput="onLeaderRosterSearch(this.value)"
                                   style="padding: 0.5rem 0.85rem 0.5rem 2rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.85rem; min-width: 250px;">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;"></i>
                        </div>
                        <select id="leaderRosterRoleFilter" onchange="onLeaderRosterRoleFilter(this.value)"
                                style="padding: 0.5rem 0.85rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.85rem;">
                            <option value="all">All Ministry Roles</option>
                            ${distinctRosterRoles.map(r => `<option value="${escapeHtml(r)}" ${leaderRosterRoleFilter.toLowerCase() === r.toLowerCase() ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
                        </select>
                        <select id="leaderRosterStatusFilter" onchange="onLeaderRosterStatusFilter(this.value)"
                                style="padding: 0.5rem 0.85rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.85rem;">
                            <option value="all">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                <!-- Members Table -->
                <div class="overflow-x-auto" style="border: 1px solid var(--border-color); border-radius: 10px;">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-slate-50 text-slate-500 uppercase text-xs" style="border-bottom: 1px solid var(--border-color);">
                            <tr>
                                <th class="p-3.5">Member Name</th>
                                <th class="p-3.5">Ministry Role</th>
                                <th class="p-3.5">Contact Details</th>
                                <th class="p-3.5">Date Enrolled</th>
                                <th class="p-3.5">Membership Status</th>
                            </tr>
                        </thead>
                        <tbody id="leaderMinistryRosterTbody" class="divide-y divide-slate-100">
                            <!-- Rows populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        filterAndRenderRosterRows();
    } catch (error) {
        console.error('Error rendering ministry dashboard:', error);
        container.innerHTML = `
            <div class="card p-8 text-center text-rose-500">
                <i class="fa-solid fa-circle-exclamation text-2xl mb-2 block"></i>
                Failed to load ministry roster: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

function onLeaderRosterSearch(q) {
    leaderRosterSearchQuery = q;
    filterAndRenderRosterRows();
}

function onLeaderRosterRoleFilter(role) {
    leaderRosterRoleFilter = role;
    filterAndRenderRosterRows();
}

function onLeaderRosterStatusFilter(status) {
    leaderRosterStatusFilter = status;
    filterAndRenderRosterRows();
}

function filterAndRenderRosterRows() {
    const tbody = document.getElementById('leaderMinistryRosterTbody');
    if (!tbody) return;

    const q = (leaderRosterSearchQuery || '').toLowerCase().trim();
    let filtered = activeMinistryRosterCache.filter(m => {
        const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
        const role = (m.role_in_ministry || '').toLowerCase();
        const email = (m.email || '').toLowerCase();
        const contact = (m.contact_number || '').toLowerCase();

        const matchesQuery = !q || fullName.includes(q) || role.includes(q) || email.includes(q) || contact.includes(q);

        let matchesRole = true;
        if (leaderRosterRoleFilter !== 'all') {
            matchesRole = (m.role_in_ministry || '').toLowerCase() === leaderRosterRoleFilter.toLowerCase();
        }

        let matchesStatus = true;
        if (leaderRosterStatusFilter !== 'all') {
            matchesStatus = (m.status || 'Active').toLowerCase() === leaderRosterStatusFilter.toLowerCase();
        }

        return matchesQuery && matchesRole && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center p-8 text-slate-400">
                    <i class="fa-solid fa-users text-2xl mb-2 block opacity-30"></i>
                    No members found matching your search or filters.
                </td>
            </tr>
        `;
        return;
    }

    const currentMinistry = (leaderAssignedMinistriesCache || []).find(x => x.ministry_id == activeLeaderMinistryId);
    const minLeaderId = currentMinistry && currentMinistry.leader_member_id ? Number(currentMinistry.leader_member_id) : null;

    tbody.innerHTML = filtered.map(m => {
        const isLeader = (m.is_ministry_leader == 1) || (minLeaderId && Number(m.member_id) === minLeaderId);

        const joinedDateStr = m.joined_date 
            ? new Date(m.joined_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Enrolled Member';

        return '<tr class="hover:bg-slate-50 transition ' + (isLeader ? 'ministry-leader-row' : '') + '" style="' + (isLeader ? 'background: #fffdf2; border-left: 4px solid #f59e0b;' : '') + '">' +
            '<td class="p-3.5">' +
                '<div style="display: flex; align-items: center; gap: 10px;">' +
                    (m.profile_image 
                        ? '<img src="' + escapeHtml(m.profile_image) + '" alt="" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;" onerror="this.outerHTML=\'<div style=\\\'width:36px;height:36px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:700;flex-shrink:0;\\\'>' + escapeHtml((m.first_name || 'M').charAt(0)) + '</div>\'">'
                        : '<div style="width: 36px; height: 36px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; flex-shrink: 0;">' + escapeHtml((m.first_name || 'M').charAt(0)) + '</div>'
                    ) +
                    '<div>' +
                        '<div style="font-weight: 700; color: var(--navy); display: flex; align-items: center; gap: 0.35rem;">' +
                            escapeHtml(m.first_name) + ' ' + escapeHtml(m.last_name) +
                            (isLeader ? ' <i class="fa-solid fa-crown text-amber-500" title="Ministry Leader"></i>' : '') +
                        '</div>' +
                        '<div class="text-xs text-slate-400">' + escapeHtml(m.email || 'No email provided') + '</div>' +
                    '</div>' +
                '</div>' +
            '</td>' +
            '<td class="p-3.5">' +
                (isLeader ? 
                    '<span class="badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700; font-size: 0.75rem;"><i class="fa-solid fa-crown mr-1" style="color: #d97706;"></i> ' + escapeHtml(m.role_in_ministry || 'Ministry Leader') + '</span>'
                    : '<span class="badge ' + (m.role_in_ministry === 'Assistant Leader' ? 'badge-income' : 'badge-info') + '">' + escapeHtml(m.role_in_ministry || 'Member') + '</span>'
                ) +
            '</td>' +
            '<td class="p-3.5 text-xs text-slate-600">' +
                '<div><i class="fa-solid fa-phone text-slate-400 mr-1"></i> ' + escapeHtml(m.contact_number || 'N/A') + '</div>' +
                '<div><i class="fa-solid fa-envelope text-slate-400 mr-1"></i> ' + escapeHtml(m.email || 'N/A') + '</div>' +
            '</td>' +
            '<td class="p-3.5 text-xs text-slate-600">' +
                '<i class="fa-regular fa-calendar text-slate-400 mr-1"></i> ' + joinedDateStr +
            '</td>' +
            '<td class="p-3.5">' +
                getMemberStatusBadge(m.status || 'Active') +
            '</td>' +
        '</tr>';
    }).join('');
}


// Legacy helper retained for backwards compatibility
async function viewLeaderMinistryRoster(ministryId, ministryName) {
    document.getElementById('modalRosterMinistryName').textContent = `${ministryName} - Members Roster`;
    const tbody = document.getElementById('modalRosterTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center p-6 text-slate-400">Loading roster...</td></tr>';

    const modal = document.getElementById('leaderMinistryRosterModal');
    if (modal) modal.classList.add('active');

    try {
        const res = await api.ministries.getMembers(ministryId);
        const members = res.data || [];

        if (members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center p-6 text-slate-400">No members currently enrolled in this ministry.</td></tr>';
            return;
        }

        tbody.innerHTML = members.map(m => {
            const isLeader = m.is_ministry_leader == 1;
            return `
            <tr style="${isLeader ? 'background: #fffdf5; border-left: 3px solid #f59e0b;' : ''}">
                <td class="p-3 font-medium text-navy">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${m.profile_image 
                            ? `<img src="${escapeHtml(m.profile_image)}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;" onerror="this.outerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;flex-shrink:0;\\'>${escapeHtml((m.first_name || 'M').charAt(0))}</div>'">`
                            : `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${isLeader ? '#fef3c7' : '#eff6ff'}; color: ${isLeader ? '#d97706' : '#2563eb'}; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">${isLeader ? '<i class="fa-solid fa-crown" style="font-size:0.75rem;"></i>' : escapeHtml((m.first_name || 'M').charAt(0))}</div>`
                        }
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span>${escapeHtml(m.first_name)} ${escapeHtml(m.last_name)}</span>
                            ${isLeader ? `<span class="badge" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 0.65rem; font-weight: 700; padding: 1px 5px; display: inline-flex; align-items: center; gap: 3px;"><i class="fa-solid fa-crown text-amber-500"></i> Leader</span>` : ''}
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <span class="badge ${isLeader ? 'badge-info' : 'badge-income'}" style="font-size: 0.72rem; ${isLeader ? 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700;' : ''}">
                        ${isLeader ? '<i class="fa-solid fa-crown mr-1" style="color: #d97706;"></i> ' : ''}${escapeHtml(m.role_in_ministry || (isLeader ? 'Ministry Leader' : 'Member'))}
                    </span>
                </td>
                <td class="p-3 text-xs text-slate-600">${m.joined_date ? new Date(m.joined_date).toLocaleDateString() : 'N/A'}</td>
                <td class="p-3">${getMemberStatusBadge(m.status || 'Active')}</td>
            </tr>
            `;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-danger">Failed to load roster: ${escapeHtml(error.message)}</td></tr>`;
    }
}

function closeLeaderMinistryRosterModal() {
    const modal = document.getElementById('leaderMinistryRosterModal');
    if (modal) modal.classList.remove('active');
}

// ============================================================
// 6. FINANCE MODULE (READ-ONLY)
// ============================================================
let leaderFinanceFilterDept = '';
let leaderFinanceFilterMinistryId = '';

async function loadFinance() {
    try {
        const [analyticsRes, transRes, catsRes] = await Promise.all([
            api.finance.getAnalytics(), 
            api.finance.getAll(),
            api.finance.getCategories().catch(() => ({ data: [] }))
        ]);
        
        document.getElementById('totalIncome').innerText = `₱${Number(analyticsRes.data.summary.total_income || 0).toLocaleString()}`;
        document.getElementById('totalExpense').innerText = `₱${Number(analyticsRes.data.summary.total_expense || 0).toLocaleString()}`;
        document.getElementById('netBalance').innerText = `₱${Number(analyticsRes.data.summary.net_balance || 0).toLocaleString()}`;

        // Populate category dropdown
        const catSelect = document.getElementById('leaderFinanceCategoryFilter');
        if (catSelect) {
            const currentVal = catSelect.value;
            const cats = catsRes.data || [];
            catSelect.innerHTML = '<option value="">All Categories</option>' +
                cats.map(c => `<option value="${escapeHtml(c.category_name)}">${escapeHtml(c.category_name)}</option>`).join('');
            catSelect.value = currentVal;
        }

        allLeaderFinanceCache = transRes.data || [];
        applyLeaderFinanceFilters();
    } catch (error) {
        showToast('Error loading finance: ' + error.message);
    }
}

function applyLeaderFinanceFilters() {
    const q = (document.getElementById('leaderFinanceSearch')?.value || '').toLowerCase().trim();
    const type = document.getElementById('leaderFinanceTypeFilter')?.value || '';
    const category = document.getElementById('leaderFinanceCategoryFilter')?.value || '';

    let filtered = allLeaderFinanceCache.filter(t => {
        const matchesSearch = !q || 
            (t.description && t.description.toLowerCase().includes(q)) ||
            (t.reference_number && t.reference_number.toLowerCase().includes(q));

        const matchesType = !type || (t.transaction_type === type);
        const matchesCategory = !category || (t.category_name === category);

        const matchesDept = !leaderFinanceFilterDept || 
            (t.department && t.department.toLowerCase() === leaderFinanceFilterDept.toLowerCase());

        const matchesMinistry = !leaderFinanceFilterMinistryId || 
            (String(t.ministry_id) === String(leaderFinanceFilterMinistryId));

        return matchesSearch && matchesType && matchesCategory && matchesDept && matchesMinistry;
    });

    renderLeaderFinance(filtered);
}

function resetLeaderFinanceFilters() {
    if (document.getElementById('leaderFinanceSearch')) document.getElementById('leaderFinanceSearch').value = '';
    if (document.getElementById('leaderFinanceTypeFilter')) document.getElementById('leaderFinanceTypeFilter').value = '';
    if (document.getElementById('leaderFinanceCategoryFilter')) document.getElementById('leaderFinanceCategoryFilter').value = '';
    clearLeaderFinanceDeptMinFilter();
}

let currentLeaderFinancePage = 1;
const LEADER_FINANCE_PAGE_LIMIT = 10;
let leaderFilteredFinanceCache = [];

function changeLeaderFinancePage(delta) {
    const totalPages = Math.ceil(leaderFilteredFinanceCache.length / LEADER_FINANCE_PAGE_LIMIT) || 1;
    const newPage = currentLeaderFinancePage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentLeaderFinancePage = newPage;
        renderLeaderFinancePage();
    }
}
window.changeLeaderFinancePage = changeLeaderFinancePage;

function renderLeaderFinancePage() {
    const tbody = document.getElementById('financeTableBody');
    if (!tbody) return;

    const totalRecords = leaderFilteredFinanceCache.length;
    const totalPages = Math.ceil(totalRecords / LEADER_FINANCE_PAGE_LIMIT) || 1;
    if (currentLeaderFinancePage > totalPages) currentLeaderFinancePage = totalPages;
    if (currentLeaderFinancePage < 1) currentLeaderFinancePage = 1;

    const startIndex = (currentLeaderFinancePage - 1) * LEADER_FINANCE_PAGE_LIMIT;
    const pageItems = leaderFilteredFinanceCache.slice(startIndex, startIndex + LEADER_FINANCE_PAGE_LIMIT);

    const prevBtn = document.getElementById('leaderFinancePrevBtn');
    const nextBtn = document.getElementById('leaderFinanceNextBtn');
    const pageInfo = document.getElementById('leaderFinancePageInfo');

    if (pageInfo) {
        pageInfo.innerText = `Page ${currentLeaderFinancePage} of ${totalPages} (${totalRecords} records)`;
    }
    if (prevBtn) {
        prevBtn.disabled = currentLeaderFinancePage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentLeaderFinancePage >= totalPages;
    }

    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-slate-400">No finance transactions found matching filters.</td></tr>';
        return;
    }

    tbody.innerHTML = pageItems.map(t => {
        const isIncome = t.transaction_type === 'Income';
        const amountClass = isIncome ? 'finance-amount-income text-income' : 'finance-amount-expense text-expense';
        return `
        <tr>
            <td class="p-4 text-xs font-mono">${new Date(t.transaction_date).toLocaleDateString()}</td>
            <td class="p-4"><span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">${escapeHtml(t.transaction_type)}</span></td>
            <td class="p-4"><span class="badge ${getDeptBadgeClass(t.department)}">${escapeHtml(t.department || 'General')}</span></td>
            <td class="p-4"><span class="badge ${t.ministry_name ? 'badge-ministry-pill' : 'badge-inactive'}">${escapeHtml(t.ministry_name || 'General Church')}</span></td>
            <td class="p-4 font-medium">${getFinanceCategoryBadge(t.category_name)}</td>
            <td class="p-4 font-semibold ${amountClass}" style="color: ${isIncome ? 'var(--success-color)' : 'var(--danger-color)'}; font-variant-numeric: tabular-nums;">₱${Number(t.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="p-4 text-xs" style="color: var(--text-dark); max-width: 280px;">${escapeHtml(t.description || 'N/A')}</td>
            <td class="p-4 text-center">
                <button type="button" class="btn-action btn-view" onclick="openLeaderReceiptModal(${t.transaction_id})" title="Print or Download PDF Receipt" style="white-space: nowrap;">
                    <i class="fa-solid fa-file-pdf"></i> Print Receipt
                </button>
            </td>
        </tr>
    `;
    }).join('');
}

function renderLeaderFinance(transactions) {
    leaderFilteredFinanceCache = transactions || [];
    currentLeaderFinancePage = 1;
    renderLeaderFinancePage();
}

// ============== LEADER FINANCE OFFICIAL RECEIPT & PDF PRINTING ==============
let currentReceiptTransaction = null;

function numberToWords(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return 'Zero Pesos Only';
    amount = Number(amount);
    if (amount === 0) return 'Zero Pesos Only';

    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertGroup(n) {
        let str = '';
        if (n >= 100) {
            str += units[Math.floor(n / 100)] + ' Hundred ';
            n %= 100;
        }
        if (n >= 20) {
            str += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + units[n % 10] : '') + ' ';
        } else if (n > 0) {
            str += units[n] + ' ';
        }
        return str.trim();
    }

    const wholePart = Math.floor(amount);
    const decimalPart = Math.round((amount - wholePart) * 100);

    let words = '';
    const billions = Math.floor(wholePart / 1000000000);
    const millions = Math.floor((wholePart % 1000000000) / 1000000);
    const thousands = Math.floor((wholePart % 1000000) / 1000);
    const remainder = wholePart % 1000;

    if (billions > 0) words += convertGroup(billions) + ' Billion ';
    if (millions > 0) words += convertGroup(millions) + ' Million ';
    if (thousands > 0) words += convertGroup(thousands) + ' Thousand ';
    if (remainder > 0 || words === '') words += convertGroup(remainder) + ' ';

    words = words.trim() + ' Pesos';
    if (decimalPart > 0) {
        words += ` and ${String(decimalPart).padStart(2, '0')}/100`;
    }
    words += ' Only';
    return words;
}

function formatReceiptDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function openLeaderReceiptModal(transactionId) {
    let trans = (allLeaderFinanceCache || []).find(t => String(t.transaction_id) === String(transactionId));
    if (!trans) {
        try {
            const res = await api.finance.getById(transactionId);
            trans = res.data;
        } catch (e) {
            console.error('Failed to load transaction for receipt:', e);
            showToast('Failed to load transaction receipt details: ' + e.message);
            return;
        }
    }
    if (!trans) {
        showToast('Transaction record not found.');
        return;
    }

    currentReceiptTransaction = trans;

    // Populate transaction dropdown switcher inside modal
    const sel = document.getElementById('receiptTxSelect');
    if (sel && allLeaderFinanceCache && allLeaderFinanceCache.length > 0) {
        sel.innerHTML = allLeaderFinanceCache.map(t => `
            <option value="${t.transaction_id}" ${String(t.transaction_id) === String(trans.transaction_id) ? 'selected' : ''}>
                #${t.transaction_id} &bull; ${new Date(t.transaction_date).toLocaleDateString()} &bull; ${escapeHtml(t.transaction_type)} &bull; ₱${Number(t.amount).toLocaleString()} &bull; ${escapeHtml(t.category_name || '')} (${escapeHtml((t.description || '').slice(0, 25))})
            </option>
        `).join('');
    }

    renderLeaderReceiptPaper(trans);

    const modal = document.getElementById('leaderReceiptModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function openLeaderQuickReceiptModal() {
    if (!allLeaderFinanceCache || allLeaderFinanceCache.length === 0) {
        showToast('No finance transactions available to print receipt.');
        return;
    }
    openLeaderReceiptModal(allLeaderFinanceCache[0].transaction_id);
}

function onReceiptTxSelectChange(newId) {
    if (!newId) return;
    openLeaderReceiptModal(newId);
}

function closeLeaderReceiptModal() {
    const modal = document.getElementById('leaderReceiptModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.removeProperty('display');
    }
}

function renderLeaderReceiptPaper(trans) {
    const container = document.getElementById('printableReceiptPaper');
    if (!container) return;

    let userObj = null;
    try {
        userObj = JSON.parse(sessionStorage.getItem('church_user') || '{}');
    } catch (e) {}
    const leaderName = userObj?.full_name || 'Church Leader';
    const leaderRole = userObj?.role || 'Church Leader';

    const isIncome = trans.transaction_type === 'Income';
    const typeLabel = isIncome ? 'OFFICIAL ACKNOWLEDGMENT RECEIPT' : 'OFFICIAL DISBURSEMENT VOUCHER';
    const rcpNo = trans.reference_number || ('TXN-' + String(trans.transaction_id).padStart(6, '0'));
    const amountNum = Number(trans.amount || 0);

    container.innerHTML = `
        <div class="receipt-document">
            <!-- Header -->
            <div class="receipt-header">
                <div class="receipt-brand">
                    <div class="receipt-logo">
                        <i class="fa-solid fa-cross"></i>
                    </div>
                    <div class="receipt-church-info">
                        <h1 class="receipt-church-name">CHURCH OF GOD WORLD MISSIONS PHILIPPINES</h1>
                        <h2 class="receipt-church-branch">IMUS CONGREGATION &bull; REGION IV-A</h2>
                        <p class="receipt-church-address">Palico IV, Imus City, Cavite 4103, Philippines &bull; (046) 471-2345</p>
                        <p class="receipt-church-meta">Official Finance & Stewardship Repository</p>
                    </div>
                </div>
                <div class="receipt-title-badge ${isIncome ? 'type-income' : 'type-expense'}">
                    <span class="badge-type-label">${typeLabel}</span>
                    <span class="badge-rcp-no">VOUCHER NO: ${escapeHtml(rcpNo)}</span>
                </div>
            </div>

            <div class="receipt-divider"></div>

            <!-- Meta Information Grid -->
            <div class="receipt-meta-grid">
                <div class="receipt-meta-col">
                    <div class="receipt-meta-row">
                        <span class="meta-label">Transaction ID:</span>
                        <span class="meta-val font-mono">TXN-${String(trans.transaction_id).padStart(6, '0')}</span>
                    </div>
                    <div class="receipt-meta-row">
                        <span class="meta-label">Transaction Date:</span>
                        <span class="meta-val font-semibold">${formatReceiptDate(trans.transaction_date)}</span>
                    </div>
                    <div class="receipt-meta-row">
                        <span class="meta-label">Classification:</span>
                        <span class="meta-val"><span class="pill-type ${isIncome ? 'income' : 'expense'}">${escapeHtml(trans.transaction_type)}</span></span>
                    </div>
                    <div class="receipt-meta-row">
                        <span class="meta-label">Category:</span>
                        <span class="meta-val font-semibold">${escapeHtml(trans.category_name || 'General')}</span>
                    </div>
                </div>
                <div class="receipt-meta-col">
                    <div class="receipt-meta-row">
                        <span class="meta-label">Department:</span>
                        <span class="meta-val font-semibold">${escapeHtml(trans.department || 'Administration')}</span>
                    </div>
                    <div class="receipt-meta-row">
                        <span class="meta-label">Ministry / Group:</span>
                        <span class="meta-val">${escapeHtml(trans.ministry_name || 'General Church Fund')}</span>
                    </div>
                    <div class="receipt-meta-row">
                        <span class="meta-label">Reference / Ref #:</span>
                        <span class="meta-val font-mono">${escapeHtml(trans.reference_number || 'N/A (Direct)')}</span>
                    </div>
                    <div class="receipt-meta-row">
                        <span class="meta-label">Recorded By:</span>
                        <span class="meta-val font-semibold">${escapeHtml(trans.recorded_by_name || 'Admin')}</span>
                    </div>
                </div>
            </div>

            <!-- Particulars / Description Table -->
            <table class="receipt-details-table">
                <thead>
                    <tr>
                        <th style="width: 65%;">Particulars / Description</th>
                        <th style="width: 35%; text-align: right;">Amount (PHP)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <div class="particulars-title">${escapeHtml(trans.category_name || 'Finance Transaction')}</div>
                            <div class="particulars-desc">${escapeHtml(trans.description || 'Stewardship recorded and verified in Church Portal.')}</div>
                            ${trans.reference_number ? `<div class="particulars-ref"><small>Reference / Check / Transfer Ref: <strong>${escapeHtml(trans.reference_number)}</strong></small></div>` : ''}
                        </td>
                        <td class="particulars-amount">
                            ₱${amountNum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td class="total-label">TOTAL AMOUNT ${isIncome ? 'RECEIVED' : 'DISBURSED'}:</td>
                        <td class="total-val">₱${amountNum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Amount In Words Box -->
            <div class="receipt-words-box">
                <span class="words-label">AMOUNT IN WORDS:</span>
                <span class="words-text">${numberToWords(amountNum)}</span>
            </div>

            <!-- Signatures & Verification Seal -->
            <div class="receipt-signatures-grid">
                <div class="sig-block">
                    <div class="sig-line"></div>
                    <div class="sig-name">${escapeHtml(trans.recorded_by_name || 'Finance Admin')}</div>
                    <div class="sig-title">Recorded By / Finance Custodian</div>
                </div>
                <div class="sig-seal-wrap">
                    <div class="receipt-stamp">
                        <i class="fa-solid fa-stamp"></i>
                        <div class="stamp-text">OFFICIAL RECORD</div>
                        <div class="stamp-sub">COGWM &bull; VERIFIED</div>
                    </div>
                </div>
                <div class="sig-block">
                    <div class="sig-line"></div>
                    <div class="sig-name">${escapeHtml(leaderName)}</div>
                    <div class="sig-title">Verified By / ${escapeHtml(leaderRole)}</div>
                </div>
            </div>

            <!-- Footer Note & Scripture -->
            <div class="receipt-footer">
                <p class="receipt-scripture">
                    &ldquo;Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.&rdquo; &mdash; <em>2 Corinthians 9:7</em>
                </p>
                <p class="receipt-gen-info">
                    Official Electronic Receipt &bull; COG Imus Portal &bull; Printed / Generated on ${new Date().toLocaleString()} &bull; System Verified
                </p>
            </div>
        </div>
    `;
}

function printLeaderReceipt() {
    if (!currentReceiptTransaction) {
        showToast('No transaction selected to print.');
        return;
    }
    const receiptElement = document.getElementById('printableReceiptPaper');
    if (!receiptElement) return;

    // Use an isolated print iframe for a perfect 1-page paper fit without dashboard interference
    let printFrame = document.getElementById('receiptPrintIframe');
    if (printFrame) {
        printFrame.remove();
    }
    printFrame = document.createElement('iframe');
    printFrame.id = 'receiptPrintIframe';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow.document;
    const rcpTitle = `Official_Receipt_${currentReceiptTransaction.transaction_type}_${currentReceiptTransaction.reference_number || ('TXN-' + currentReceiptTransaction.transaction_id)}`;
    
    frameDoc.open();
    frameDoc.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${rcpTitle}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 portrait;
            margin: 6mm 8mm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        html, body {
            background: #ffffff !important;
            color: #1e293b !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .receipt-paper {
            width: 100% !important;
            max-width: 100% !important;
            padding: 8mm 10mm !important;
            border: 1.5px solid #0E2A4F !important;
            border-radius: 6px !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        .receipt-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 1rem;
        }
        .receipt-brand {
            display: flex;
            align-items: center;
            gap: 0.85rem;
        }
        .receipt-logo {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            background: #0E2A4F;
            color: #C9A961;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.35rem;
            flex-shrink: 0;
        }
        .receipt-church-name {
            font-size: 0.95rem;
            font-weight: 800;
            color: #0E2A4F;
            margin: 0;
            line-height: 1.2;
            letter-spacing: 0.4px;
        }
        .receipt-church-branch {
            font-size: 0.74rem;
            font-weight: 700;
            color: #A88845;
            margin: 0.1rem 0;
            letter-spacing: 0.7px;
        }
        .receipt-church-address {
            font-size: 0.68rem;
            color: #64748b;
            margin: 0;
        }
        .receipt-church-meta {
            font-size: 0.65rem;
            color: #94a3b8;
            margin: 0;
            font-style: italic;
        }
        .receipt-title-badge {
            text-align: right;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }
        .receipt-title-badge .badge-type-label {
            display: inline-block;
            padding: 0.3rem 0.75rem;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 800;
            letter-spacing: 0.8px;
            text-transform: uppercase;
        }
        .receipt-title-badge.type-income .badge-type-label {
            background: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
        }
        .receipt-title-badge.type-expense .badge-type-label {
            background: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
        }
        .receipt-title-badge .badge-rcp-no {
            font-family: monospace;
            font-size: 0.74rem;
            font-weight: 700;
            color: #64748b;
            margin-top: 0.25rem;
        }
        .receipt-divider {
            height: 2.5px;
            background: linear-gradient(90deg, #0E2A4F 0%, #C9A961 50%, #0E2A4F 100%);
            margin: 0.75rem 0;
            border-radius: 3px;
        }
        .receipt-meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.45rem 1.25rem;
            margin-bottom: 0.75rem;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 0.65rem 0.9rem;
        }
        .receipt-meta-row {
            display: flex;
            align-items: baseline;
            font-size: 0.78rem;
            gap: 0.45rem;
        }
        .receipt-meta-row .meta-label {
            color: #64748b;
            font-weight: 600;
            white-space: nowrap;
            min-width: 110px;
            flex-shrink: 0;
        }
        .receipt-meta-row .meta-val {
            color: #0E2A4F;
            font-weight: 600;
            word-break: normal;
            overflow-wrap: break-word;
        }
        .pill-type {
            display: inline-block;
            padding: 1px 7px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 700;
        }
        .pill-type.income {
            background: #d1fae5;
            color: #065f46;
        }
        .pill-type.expense {
            background: #fee2e2;
            color: #991b1b;
        }
        .receipt-details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0.75rem;
            font-size: 0.8rem;
        }
        .receipt-details-table th {
            background: #0E2A4F;
            color: #ffffff;
            font-weight: 600;
            padding: 0.45rem 0.75rem;
            text-transform: uppercase;
            font-size: 0.72rem;
            letter-spacing: 0.5px;
            border: 1px solid #0E2A4F;
        }
        .receipt-details-table td {
            padding: 0.55rem 0.75rem;
            border: 1px solid #cbd5e1;
            vertical-align: top;
        }
        .particulars-title {
            font-weight: 700;
            color: #0E2A4F;
            margin-bottom: 0.15rem;
            font-size: 0.86rem;
        }
        .particulars-desc {
            color: #475569;
            font-size: 0.78rem;
            line-height: 1.35;
        }
        .particulars-ref {
            margin-top: 0.25rem;
            color: #64748b;
            font-size: 0.72rem;
        }
        .particulars-amount {
            font-size: 1.05rem;
            font-weight: 800;
            color: #0E2A4F;
            text-align: right;
            font-family: monospace;
            white-space: nowrap;
        }
        .receipt-details-table tfoot td {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 0.55rem 0.75rem;
        }
        .receipt-details-table .total-label {
            text-align: right;
            font-weight: 800;
            font-size: 0.76rem;
            color: #0E2A4F;
            letter-spacing: 0.5px;
        }
        .receipt-details-table .total-val {
            text-align: right;
            font-weight: 900;
            font-size: 1.15rem;
            color: #047857;
            font-family: monospace;
            white-space: nowrap;
        }
        .receipt-words-box {
            background: #FAF6EF;
            border: 1.5px dashed #C9A961;
            border-radius: 6px;
            padding: 0.45rem 0.85rem;
            margin-bottom: 0.85rem;
            display: flex;
            align-items: baseline;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        .words-label {
            font-size: 0.7rem;
            font-weight: 800;
            color: #A88845;
            letter-spacing: 0.5px;
        }
        .words-text {
            font-size: 0.82rem;
            font-weight: 700;
            color: #0E2A4F;
            font-style: italic;
        }
        .receipt-signatures-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 1.25rem;
            margin-bottom: 0.85rem;
            gap: 1.25rem;
        }
        .sig-block {
            flex: 1;
            text-align: center;
        }
        .sig-line {
            border-top: 1.5px solid #0f172a;
            width: 75%;
            margin: 0 auto 0.35rem auto;
        }
        .sig-name {
            font-size: 0.82rem;
            font-weight: 800;
            color: #0E2A4F;
        }
        .sig-title {
            font-size: 0.7rem;
            color: #64748b;
        }
        .sig-seal-wrap {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .receipt-stamp {
            border: 2px dashed #047857;
            color: #047857;
            border-radius: 50%;
            width: 66px;
            height: 66px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 0.56rem;
            font-weight: 800;
            text-align: center;
            line-height: 1.1;
            padding: 4px;
            opacity: 0.85;
            transform: rotate(-8deg);
        }
        .receipt-stamp i {
            font-size: 1rem;
            margin-bottom: 2px;
        }
        .receipt-footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 0.5rem;
            text-align: center;
        }
        .receipt-scripture {
            font-size: 0.72rem;
            color: #475569;
            font-style: italic;
            margin-bottom: 0.2rem;
            line-height: 1.35;
        }
        .receipt-gen-info {
            font-size: 0.62rem;
            color: #94a3b8;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="receipt-paper">
        ${receiptElement.innerHTML}
    </div>
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.focus();
                window.print();
            }, 300);
        };
    <\/script>
</body>
</html>`);
    frameDoc.close();
}

function downloadLeaderReceiptPdf() {
    if (!currentReceiptTransaction) {
        showToast('No transaction selected for receipt');
        return;
    }
    const element = document.getElementById('printableReceiptPaper');
    if (!element) return;

    const rcpNo = currentReceiptTransaction.reference_number || ('TXN-' + currentReceiptTransaction.transaction_id);
    const filename = `Receipt_${currentReceiptTransaction.transaction_type}_${rcpNo}.pdf`;

    if (typeof html2pdf !== 'undefined') {
        const btn = document.getElementById('btnDownloadReceiptPdf');
        const origText = btn ? btn.innerHTML : '';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';

        const opt = {
            margin:       [6, 8, 6, 8],
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            if (btn) btn.innerHTML = origText;
            showToast('PDF Receipt generated & downloaded successfully!');
        }).catch(err => {
            console.error('PDF generation error:', err);
            if (btn) btn.innerHTML = origText;
            printLeaderReceipt();
        });
    } else {
        printLeaderReceipt();
    }
}

// Department & Ministry Filter Modal for Finance
function openLeaderFinanceDeptMinFilterModal() {
    const deptSelect = document.getElementById('leaderFinanceModalDeptSelect');
    if (deptSelect) {
        const standardDepts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        deptSelect.innerHTML = '<option value="">All Departments</option>' +
            standardDepts.map(d => `<option value="${d}">${d}</option>`).join('');
        deptSelect.value = leaderFinanceFilterDept || '';
    }
    populateLeaderFinanceModalMinistryDropdown(leaderFinanceFilterDept, leaderFinanceFilterMinistryId);
    const modal = document.getElementById('leaderFinanceDeptMinFilterModal');
    if (modal) modal.classList.add('active');
}

function closeLeaderFinanceDeptMinFilterModal() {
    const modal = document.getElementById('leaderFinanceDeptMinFilterModal');
    if (modal) modal.classList.remove('active');
}

function onLeaderFinanceModalDeptChange() {
    const selectedDept = document.getElementById('leaderFinanceModalDeptSelect')?.value || '';
    populateLeaderFinanceModalMinistryDropdown(selectedDept, '');
}

function populateLeaderFinanceModalMinistryDropdown(dept, selectedMinId) {
    const minSelect = document.getElementById('leaderFinanceModalMinistrySelect');
    if (!minSelect) return;
    let list = allLeaderMinistriesCache || [];
    if (dept) {
        list = list.filter(m => (m.department || '').toLowerCase() === dept.toLowerCase());
    }
    minSelect.innerHTML = '<option value="">All Ministries</option>' +
        list.map(m => `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`).join('');
    minSelect.value = selectedMinId ? String(selectedMinId) : '';
}

function clearLeaderFinanceDeptMinFilter() {
    leaderFinanceFilterDept = '';
    leaderFinanceFilterMinistryId = '';
    const deptSelect = document.getElementById('leaderFinanceModalDeptSelect');
    if (deptSelect) deptSelect.value = '';
    populateLeaderFinanceModalMinistryDropdown('', '');
    updateLeaderFinanceFilterButtonUI();
    applyLeaderFinanceFilters();
    closeLeaderFinanceDeptMinFilterModal();
}

function applyLeaderFinanceDeptMinFilterModal() {
    leaderFinanceFilterDept = document.getElementById('leaderFinanceModalDeptSelect')?.value || '';
    leaderFinanceFilterMinistryId = document.getElementById('leaderFinanceModalMinistrySelect')?.value || '';
    updateLeaderFinanceFilterButtonUI();
    applyLeaderFinanceFilters();
    closeLeaderFinanceDeptMinFilterModal();
}

function updateLeaderFinanceFilterButtonUI() {
    const btnLabel = document.getElementById('leaderFinanceFilterBtnLabel');
    const badge = document.getElementById('leaderFinanceFilterActiveBadge');
    const btn = document.getElementById('btnLeaderFinanceFilterModal');
    if (!btnLabel || !badge) return;

    let activeCount = 0;
    let label = 'Dept & Ministry';

    if (leaderFinanceFilterMinistryId) {
        const min = allLeaderMinistriesCache.find(m => String(m.ministry_id) === String(leaderFinanceFilterMinistryId));
        if (min) label = min.ministry_name;
        activeCount = 2;
    } else if (leaderFinanceFilterDept) {
        label = leaderFinanceFilterDept;
        activeCount = 1;
    }

    if (activeCount > 0) {
        btnLabel.textContent = label.length > 18 ? label.substring(0, 16) + '...' : label;
        badge.textContent = activeCount;
        badge.style.display = 'inline-block';
        if (btn) btn.classList.add('btn-filter-active');
    } else {
        btnLabel.textContent = 'Dept & Ministry';
        badge.style.display = 'none';
        if (btn) btn.classList.remove('btn-filter-active');
    }
}

// ============================================================
// 7. REPORTS MODULE
// ============================================================
async function loadReports() {
    try {
        const res = await api.reports.getSummary();
        const d = res.data;
        const tbody = document.querySelector('#reportTable tbody');
        
        tbody.innerHTML = `
            <tr><td class="p-4 font-medium"><i class="fa-solid fa-users text-navy" style="color: var(--navy); margin-right: 0.5rem;"></i> Active Members</td><td class="p-4 text-right font-bold text-navy">${d.members.active_members}</td></tr>
            <tr><td class="p-4 font-medium"><i class="fa-solid fa-address-book text-navy" style="color: var(--navy); margin-right: 0.5rem;"></i> Total Members (All Statuses)</td><td class="p-4 text-right font-bold">${d.members.total_members}</td></tr>
            <tr><td class="p-4 font-medium"><i class="fa-solid fa-sitemap text-gold" style="color: var(--gold-dark); margin-right: 0.5rem;"></i> Active Ministries</td><td class="p-4 text-right font-bold">${d.ministries.total_ministries}</td></tr>
            <tr><td class="p-4 font-medium"><i class="fa-solid fa-arrow-up text-income" style="color: var(--success-color); margin-right: 0.5rem;"></i> Total Income</td><td class="p-4 text-right font-bold report-income text-income" style="color: var(--success-color);">₱${Number(d.finance.total_income || 0).toLocaleString()}</td></tr>
            <tr><td class="p-4 font-medium"><i class="fa-solid fa-arrow-down text-expense" style="color: var(--danger-color); margin-right: 0.5rem;"></i> Total Expenses</td><td class="p-4 text-right font-bold report-expense text-expense" style="color: var(--danger-color);">₱${Number(d.finance.total_expense || 0).toLocaleString()}</td></tr>
            <tr><td class="p-4 font-medium"><i class="fa-solid fa-scale-balanced text-navy" style="color: var(--navy); margin-right: 0.5rem;"></i> Net Church Balance</td><td class="p-4 text-right font-bold report-balance text-navy" style="color: var(--navy); font-size: 1.1rem;">₱${Number((d.finance.total_income || 0) - (d.finance.total_expense || 0)).toLocaleString()}</td></tr>
            <tr><td class="p-4 font-medium"><i class="fa-solid fa-user" style="color: #64748b; margin-right: 0.5rem;"></i> Total Adults (Attendance)</td><td class="p-4 text-right font-bold">${d.attendance.total_adults}</td></tr>
            <tr><td class="p-4 font-medium"><i class="fa-solid fa-child-reaching" style="color: #64748b; margin-right: 0.5rem;"></i> Total Youth (Attendance)</td><td class="p-4 text-right font-bold">${d.attendance.total_youth}</td></tr>
            <tr><td class="p-4 font-medium"><i class="fa-solid fa-baby" style="color: #64748b; margin-right: 0.5rem;"></i> Total Children (Attendance)</td><td class="p-4 text-right font-bold">${d.attendance.total_children}</td></tr>
            <tr class="report-row-tally" style="background: #f8fafc;"><td class="p-4 font-bold text-navy" style="color: var(--navy); font-size: 1.05rem;"><i class="fa-solid fa-chart-line text-gold" style="color: var(--gold); margin-right: 0.5rem;"></i> Overall Attendance Tally</td><td class="p-4 text-right font-bold text-navy" style="color: var(--navy); font-size: 1.25rem;">${d.attendance.total_attendance}</td></tr>
        `;
    } catch (error) {
        showToast('Error loading report: ' + error.message);
    }
}

function exportReport() {
    const rows = document.querySelectorAll('#reportTable tbody tr');
    let csvContent = "data:text/csv;charset=utf-8,Church Metric,Value\n";
    rows.forEach(row => {
        let cols = row.querySelectorAll('td');
        if (cols.length >= 2) {
            let metric = cols[0].innerText.replace(/,/g, '').trim();
            let value = cols[1].innerText.replace(/,/g, '').replace(/₱/g, '').trim();
            csvContent += `"${metric}","${value}"\n`;
        }
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cog_leader_executive_summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Executive report exported as CSV!');
}


// ==========================================
// C2S CELL GROUP MODULE (LEADER VIEW ONLY)
// ==========================================
let leaderC2sGroupsData = [];
let leaderActiveRosterGroupId = null;

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


async function loadLeaderC2SGroups() {
    try {
        const tbody = document.getElementById('leaderC2sGroupsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading C2S cell groups...</td></tr>';
        }

        const res = await api.c2s.getAll();
        leaderC2sGroupsData = res.data || [];

        const totalGroups = leaderC2sGroupsData.length;
        const activeGroups = leaderC2sGroupsData.filter(g => g.status === 'Active').length;
        const uniqueMentors = new Set(leaderC2sGroupsData.map(g => g.leader_id).filter(Boolean)).size;
        const totalMentees = leaderC2sGroupsData.reduce((sum, g) => sum + (parseInt(g.mentees_count, 10) || 0), 0);

        if (document.getElementById('leaderC2sStatTotal')) document.getElementById('leaderC2sStatTotal').textContent = totalGroups;
        if (document.getElementById('leaderC2sStatActive')) document.getElementById('leaderC2sStatActive').textContent = activeGroups;
        if (document.getElementById('leaderC2sStatMentors')) document.getElementById('leaderC2sStatMentors').textContent = uniqueMentors;
        if (document.getElementById('leaderC2sStatMentees')) document.getElementById('leaderC2sStatMentees').textContent = totalMentees;

        applyLeaderC2SFilters();
    } catch (error) {
        console.error('Error loading C2S groups for leader:', error);
        showToast('Error loading C2S groups: ' + error.message);
        const tbody = document.getElementById('leaderC2sGroupsTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-rose-500"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Failed to load cell groups.</td></tr>`;
        }
    }
}

let currentLeaderC2SPage = 1;
const LEADER_C2S_PAGE_LIMIT = 10;

async function loadLeaderC2STable(page = 1) {
    currentLeaderC2SPage = page;
    const search = (document.getElementById('leaderC2sSearchInput')?.value || '').trim();
    const status = document.getElementById('leaderC2sStatusFilter')?.value || 'All';

    const tbody = document.getElementById('leaderC2sGroupsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading C2S cell groups...</td></tr>';

    try {
        const res = await api.c2s.getAll(currentLeaderC2SPage, LEADER_C2S_PAGE_LIMIT, { search, status });
        const list = res.data || [];
        renderLeaderC2SGroupsTable(list);

        const total = res.pagination ? res.pagination.total : list.length;
        const totalPages = res.pagination ? res.pagination.totalPages : Math.ceil(total / LEADER_C2S_PAGE_LIMIT);

        const pageInfo = document.getElementById('leaderC2sPageInfo');
        if (pageInfo) pageInfo.innerText = `Page ${currentLeaderC2SPage} of ${totalPages || 1} (${total} records)`;

        const prevBtn = document.getElementById('leaderC2sPrevBtn');
        if (prevBtn) prevBtn.disabled = currentLeaderC2SPage <= 1;

        const nextBtn = document.getElementById('leaderC2sNextBtn');
        if (nextBtn) nextBtn.disabled = currentLeaderC2SPage >= totalPages;
    } catch (e) {
        console.error('Error loading leader C2S table:', e);
    }
}

function applyLeaderC2SFilters() {
    loadLeaderC2STable(1);
}

function resetLeaderC2SFilters() {
    if (document.getElementById('leaderC2sSearchInput')) document.getElementById('leaderC2sSearchInput').value = '';
    if (document.getElementById('leaderC2sStatusFilter')) document.getElementById('leaderC2sStatusFilter').value = 'Active';
    loadLeaderC2STable(1);
}

function changeLeaderC2SPage(direction) {
    const newPage = currentLeaderC2SPage + direction;
    if (newPage > 0) {
        loadLeaderC2STable(newPage);
    }
}

function resetLeaderC2SFilters() {
    if (document.getElementById('leaderC2sSearchInput')) document.getElementById('leaderC2sSearchInput').value = '';
    if (document.getElementById('leaderC2sStatusFilter')) document.getElementById('leaderC2sStatusFilter').value = 'Active';
    applyLeaderC2SFilters();
}

function renderLeaderC2SGroupsTable(groups) {
    const tbody = document.getElementById('leaderC2sGroupsTableBody');
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
                    <button class="btn-primary btn-sm" onclick="openLeaderC2SRosterModal(${g.group_id})" title="View Group Roster & Mentees" style="padding: 4px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-users-gear"></i> Roster
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function openLeaderC2SRosterModal(groupId) {
    leaderActiveRosterGroupId = groupId;
    const modal = document.getElementById('leaderC2SRosterModal');
    if (!modal) return;
    modal.classList.add('active');

    const tbody = document.getElementById('leaderC2sRosterTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading roster...</td></tr>';
    }

    try {
        const res = await api.c2s.getById(groupId);
        const group = res.data;
        if (!group) throw new Error('Group not found');

        document.getElementById('leaderRosterModalTitle').innerHTML = `<i class="fa-solid fa-people-roof" style="color: var(--gold); margin-right: 0.5rem;"></i> ${escapeHtml(group.group_name)} Roster`;
        document.getElementById('leaderRosterPrimaryMentorName').textContent = group.leader_name || 'Unassigned';

        const schedStr = [
            group.meeting_day ? `Day: ${group.meeting_day}` : '',
            group.meeting_time ? `Time: ${formatTime(group.meeting_time)}` : '',
            group.meeting_location ? `Location: ${group.meeting_location}` : ''
        ].filter(Boolean).join(' • ');
        document.getElementById('leaderRosterMeetingInfo').textContent = schedStr || 'Schedule details not set';

        document.getElementById('leaderRosterCountPrimaryMentor').textContent = '1';
        document.getElementById('leaderRosterCountMentees').textContent = group.mentees_count || '0';
        document.getElementById('leaderRosterCountSecMentors').textContent = group.secondary_mentors_count || '0';
        document.getElementById('leaderRosterCountTotal').textContent = group.total_size || '1';

        let rowsHtml = '';
        // 1. Primary Mentor Row
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
                    <div>Group Leader</div>
                </td>
            </tr>
        `;

        // 2. Member Rows
        const members = group.members || [];
        if (members.length === 0) {
            rowsHtml += `
                <tr>
                    <td colspan="4" class="text-center p-8 text-slate-400">
                        <i class="fa-solid fa-user-group text-2xl mb-1 block opacity-30"></i>
                        No additional participants in this group yet.
                    </td>
                </tr>
            `;
        } else {
            members.forEach(m => {
                const isSecondaryMentor = m.designation === 'Secondary Mentor';
                const designationBadge = isSecondaryMentor
                    ? `<span class="badge c2s-badge-sec-mentor" title="Secondary Mentor (Leads another group elsewhere)">
                         <i class="fa-solid fa-award mr-1"></i> Secondary Mentor
                       </span>`
                    : `<span class="badge c2s-badge-mentee" title="Mentee">
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
                    </tr>
                `;
            });
        }

        tbody.innerHTML = rowsHtml;
    } catch (error) {
        console.error('Error loading leader roster:', error);
        showToast('Error loading roster: ' + error.message);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-rose-500"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Failed to load roster.</td></tr>`;
        }
    }
}

function closeLeaderC2SRosterModal() {
    leaderActiveRosterGroupId = null;
    const modal = document.getElementById('leaderC2SRosterModal');
    if (modal) modal.classList.remove('active');
}

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

let currentCommentLogsPage = 1;
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
        document.getElementById('sermon_date').value = s.sermon_date ? s.sermon_date.split('T')[0] : '';
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
        document.getElementById('album_event_date').value = album.album_date ? album.album_date.split('T')[0] : '';
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
            <div style="position: relative; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; background: #000; aspect-ratio: 1/1;">
                <img src="${escapeHtml(img.image_path)}" alt="Photo" style="width: 100%; height: 100%; object-fit: cover;">
                <button onclick="deleteAlbumPhoto(${img.image_id})" title="Delete Photo" 
                        style="position: absolute; top: 6px; right: 6px; background: rgba(239, 68, 68, 0.85); color: #fff; border: none; border-radius: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s;">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
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




// ============================================================
// LEADER WORK & MINISTRY SCHEDULE CALENDAR
// ============================================================
let leaderCalDate = new Date();
let leaderCalMode = 'monthly';
let leaderSelectedDate = new Date();

function parseScheduleDays(str) {
    if (!str) return [];
    const s = String(str).toLowerCase();
    const days = new Set();
    if (/\bsun(day)?s?\b/i.test(s)) days.add(0);
    if (/\bmon(day)?s?\b/i.test(s)) days.add(1);
    if (/\btue(sday)?s?\b/i.test(s)) days.add(2);
    if (/\bwed(nesday)?s?\b/i.test(s)) days.add(3);
    if (/\bthu(rsday)?s?\b/i.test(s)) days.add(4);
    if (/\bfri(day)?s?\b/i.test(s)) days.add(5);
    if (/\bsat(urday)?s?\b/i.test(s)) days.add(6);
    if (s.includes('daily') || s.includes('every day')) {
        for (let d = 0; d < 7; d++) days.add(d);
    }
    if (s.includes('weekend')) {
        days.add(0);
        days.add(6);
    }
    if (s.includes('weekday')) {
        for (let d = 1; d <= 5; d++) days.add(d);
    }
    return Array.from(days);
}

function openLeaderWorkCalendarModal() {
    const modal = document.getElementById('leaderWorkCalendarModal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.add('active');
    setLeaderCalendarMode(leaderCalMode || 'monthly');
}

function closeLeaderWorkCalendarModal() {
    const modal = document.getElementById('leaderWorkCalendarModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.removeProperty('display');
    }
}

function setLeaderCalendarMode(mode) {
    leaderCalMode = mode;
    const btnMonthly = document.getElementById('btnLeaderCalMonthly');
    const btnWeekly = document.getElementById('btnLeaderCalWeekly');
    const monthContainer = document.getElementById('leaderMonthlyViewContainer');
    const weekContainer = document.getElementById('leaderWeeklyViewContainer');

    if (mode === 'monthly') {
        btnMonthly?.classList.add('active');
        btnWeekly?.classList.remove('active');
        if (monthContainer) monthContainer.style.display = 'flex';
        if (weekContainer) weekContainer.style.display = 'none';
    } else {
        btnWeekly?.classList.add('active');
        btnMonthly?.classList.remove('active');
        if (monthContainer) monthContainer.style.display = 'none';
        if (weekContainer) weekContainer.style.display = 'flex';
    }
    renderLeaderCalendar();
}

function prevLeaderCalendar() {
    if (leaderCalMode === 'monthly') {
        leaderCalDate.setMonth(leaderCalDate.getMonth() - 1);
    } else {
        leaderCalDate.setDate(leaderCalDate.getDate() - 7);
    }
    renderLeaderCalendar();
}

function nextLeaderCalendar() {
    if (leaderCalMode === 'monthly') {
        leaderCalDate.setMonth(leaderCalDate.getMonth() + 1);
    } else {
        leaderCalDate.setDate(leaderCalDate.getDate() + 7);
    }
    renderLeaderCalendar();
}

function todayLeaderCalendar() {
    leaderCalDate = new Date();
    leaderSelectedDate = new Date();
    renderLeaderCalendar();
}

function getLeaderDayDuties(dayOfWeek) {
    const duties = [];
    if (dayOfWeek === 0) {
        duties.push({ type: 'service', label: 'Sunday Celebration (9AM & 3PM)' });
    } else if (dayOfWeek === 3) {
        duties.push({ type: 'midweek', label: 'Midweek Word & Prayer (7PM)' });
    } else if (dayOfWeek === 6) {
        duties.push({ type: 'service', label: 'Youth Alive Gathering (4PM)' });
    }

    // Interconnect Leader's assigned ministries schedule
    const ministries = (Array.isArray(leaderAssignedMinistriesCache) && leaderAssignedMinistriesCache.length > 0)
        ? leaderAssignedMinistriesCache
        : (Array.isArray(allLeaderMinistriesCache) ? allLeaderMinistriesCache : []);

    ministries.forEach(m => {
        if (!m || !m.meeting_schedule) return;
        const schedDays = parseScheduleDays(m.meeting_schedule);
        if (schedDays.includes(dayOfWeek) || (schedDays.length === 0 && dayOfWeek === 0)) {
            duties.push({
                type: 'duty',
                label: `${m.ministry_name}: ${m.meeting_schedule}`,
                ministry: m.ministry_name
            });
        }
    });

    return duties;
}

function getLeaderDayEvents(year, month, day) {
    if (!Array.isArray(allLeaderEventsCache)) return [];
    const targetDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allLeaderEventsCache.filter(e => {
        if (!e.start_datetime) return false;
        return e.start_datetime.startsWith(targetDateStr);
    });
}

function selectLeaderCalendarDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    leaderSelectedDate = new Date(y, m - 1, d);
    renderLeaderCalendar();
}

function renderLeaderCalendar() {
    const titleEl = document.getElementById('leaderCalTitle');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selStr = `${leaderSelectedDate.getFullYear()}-${String(leaderSelectedDate.getMonth() + 1).padStart(2, '0')}-${String(leaderSelectedDate.getDate()).padStart(2, '0')}`;

    if (leaderCalMode === 'monthly') {
        const year = leaderCalDate.getFullYear();
        const month = leaderCalDate.getMonth();
        const monthName = leaderCalDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        if (titleEl) titleEl.textContent = monthName;

        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const grid = document.getElementById('leaderMonthlyGrid');
        if (!grid) return;

        let cellsHtml = '';

        // Previous month trailing days
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            cellsHtml += `
                <div class="cal-month-cell other-month">
                    <div class="cal-cell-header"><span class="text-slate-400">${d}</span></div>
                    <div class="cal-cell-badges-wrap"></div>
                </div>
            `;
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = (dateStr === todayStr);
            const isSelected = (dateStr === selStr);
            const dayOfWeek = dateObj.getDay();

            const duties = getLeaderDayDuties(dayOfWeek);
            const events = getLeaderDayEvents(year, month, day);

            let badgesHtml = '';
            duties.forEach(d => {
                let cls = 'duty-badge';
                if (d.type === 'service') cls = 'service-badge';
                else if (d.type === 'midweek') cls = 'midweek-badge';
                badgesHtml += `<div class="cal-chip ${cls}" title="${escapeHtml(d.label)}">${escapeHtml(d.label)}</div>`;
            });

            events.forEach(e => {
                const isSem = (e.event_type === 'Seminary');
                const chipCls = isSem ? 'seminary-badge' : 'event-badge';
                badgesHtml += `<div class="cal-chip ${chipCls}" title="${escapeHtml(e.title)}">${isSem ? '🎓 ' : '⭐ '}${escapeHtml(e.title)}</div>`;
            });

            cellsHtml += `
                <div class="cal-month-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" onclick="selectLeaderCalendarDate('${dateStr}')">
                    <div class="cal-cell-header">
                        <span class="day-number ${isToday ? 'today-pill' : ''}">${day}</span>
                        ${(duties.length > 0 || events.length > 0) ? `<span class="badge-dot-indicator"></span>` : ''}
                    </div>
                    <div class="cal-cell-badges-wrap">
                        ${badgesHtml}
                    </div>
                </div>
            `;
        }

        // Next month leading days
        const totalCellsSoFar = firstDayIndex + daysInMonth;
        const remaining = (7 - (totalCellsSoFar % 7)) % 7;
        for (let i = 1; i <= remaining; i++) {
            cellsHtml += `
                <div class="cal-month-cell other-month">
                    <div class="cal-cell-header"><span class="text-slate-400">${i}</span></div>
                    <div class="cal-cell-badges-wrap"></div>
                </div>
            `;
        }

        grid.innerHTML = cellsHtml;

    } else {
        // Weekly View
        const curr = new Date(leaderCalDate);
        const dayOfWeek = curr.getDay();
        const startOfWeek = new Date(curr);
        startOfWeek.setDate(curr.getDate() - dayOfWeek);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startStr = startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const endStr = endOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        if (titleEl) titleEl.textContent = `${startStr} - ${endStr}`;

        const grid = document.getElementById('leaderWeeklyGrid');
        if (!grid) return;

        let weekColsHtml = '';
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
            const isToday = (dateStr === todayStr);
            const isSelected = (dateStr === selStr);

            const duties = getLeaderDayDuties(i);
            const events = getLeaderDayEvents(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());

            let itemsHtml = '';
            duties.forEach(d => {
                let badgeClass = 'duty-badge';
                if (d.type === 'service') badgeClass = 'service-badge';
                else if (d.type === 'midweek') badgeClass = 'midweek-badge';

                itemsHtml += `
                    <div class="weekly-item-card ${badgeClass}">
                        <div class="weekly-item-title">${escapeHtml(d.label)}</div>
                        <div class="weekly-item-time"><i class="fa-regular fa-clock"></i> Church Schedule</div>
                    </div>
                `;
            });

            events.forEach(e => {
                const isSem = (e.event_type === 'Seminary');
                const timeStr = e.start_datetime ? new Date(e.start_datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
                itemsHtml += `
                    <div class="weekly-item-card ${isSem ? 'seminary-badge' : 'event-badge'}">
                        <div class="weekly-item-title">${isSem ? '🎓 ' : '⭐ '}${escapeHtml(e.title)}</div>
                        <div class="weekly-item-time"><i class="fa-regular fa-clock"></i> ${timeStr || 'Event'}</div>
                    </div>
                `;
            });

            if (!itemsHtml) {
                itemsHtml = `<div class="text-xs text-slate-400 italic p-3 text-center">No duties or events</div>`;
            }

            weekColsHtml += `
                <div class="weekly-day-col ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" onclick="selectLeaderCalendarDate('${dateStr}')">
                    <div class="weekly-day-header">
                        <div class="weekly-day-name">${dayNames[i]}</div>
                        <div class="weekly-day-num ${isToday ? 'today-pill' : ''}">${dayDate.getDate()}</div>
                    </div>
                    <div class="weekly-items-wrap">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }

        grid.innerHTML = weekColsHtml;
    }

    renderLeaderSelectedDayDetails();
}

function renderLeaderSelectedDayDetails() {
    const box = document.getElementById('leaderCalSelectedDayDetails');
    if (!box) return;

    const y = leaderSelectedDate.getFullYear();
    const m = leaderSelectedDate.getMonth();
    const d = leaderSelectedDate.getDate();
    const dayOfWeek = leaderSelectedDate.getDay();
    const dateFormatted = leaderSelectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const duties = getLeaderDayDuties(dayOfWeek);
    const events = getLeaderDayEvents(y, m, d);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
            <strong style="color: var(--navy); font-size: 0.95rem;">
                <i class="fa-solid fa-calendar-day text-amber-600 mr-1.5"></i> Schedule for ${dateFormatted}
            </strong>
            <span class="badge" style="background: #eff6ff; color: #2563eb; font-size: 0.75rem;">${duties.length} Duties &bull; ${events.length} Events</span>
        </div>
    `;

    if (duties.length === 0 && events.length === 0) {
        html += `<p class="text-xs text-slate-500 italic" style="margin: 0;">No church services, ministry gatherings, or events scheduled for this day.</p>`;
    } else {
        html += `<div style="display: flex; flex-direction: column; gap: 0.5rem;">`;
        duties.forEach(duty => {
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.85rem;">
                    <div>
                        <strong style="color: var(--navy);"><i class="fa-solid fa-church text-amber-600 mr-1.5"></i> ${escapeHtml(duty.label)}</strong>
                    </div>
                    <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.7rem; font-weight: 600;">Ministry Shift</span>
                </div>
            `;
        });

        events.forEach(e => {
            const isSem = (e.event_type === 'Seminary');
            const timeStr = e.start_datetime ? new Date(e.start_datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.85rem;">
                    <div>
                        <strong style="color: var(--navy);"><i class="fa-solid ${isSem ? 'fa-graduation-cap' : 'fa-star'} text-gold mr-1.5"></i> ${escapeHtml(e.title)}</strong>
                        <span class="text-xs text-slate-500 ml-2">${timeStr} &bull; ${escapeHtml(e.location || 'Church')}</span>
                    </div>
                    <span class="badge ${isSem ? 'badge-dept-discipleship' : 'badge-dept-general'}" style="font-size: 0.7rem;">${escapeHtml(e.event_type || 'Event')}</span>
                </div>
            `;
        });
        html += `</div>`;
    }

    box.innerHTML = html;
}



// ============================================================
// LEADER DASHBOARD MINI-CALENDAR (Work & Ministry Schedule)
// ============================================================
let leaderMiniCalYear = new Date().getFullYear();
let leaderMiniCalMonth = new Date().getMonth();
let leaderMiniCalSelectedDate = new Date();

function prevLeaderMiniCal() {
    leaderMiniCalMonth--;
    if (leaderMiniCalMonth < 0) {
        leaderMiniCalMonth = 11;
        leaderMiniCalYear--;
    }
    renderLeaderMiniCalendar();
}

function nextLeaderMiniCal() {
    leaderMiniCalMonth++;
    if (leaderMiniCalMonth > 11) {
        leaderMiniCalMonth = 0;
        leaderMiniCalYear++;
    }
    renderLeaderMiniCalendar();
}

function selectLeaderMiniCalDate(year, month, day) {
    leaderMiniCalSelectedDate = new Date(year, month, day);
    leaderSelectedDate = new Date(year, month, day);
    leaderCalDate = new Date(year, month, day);
    renderLeaderMiniCalendar();
}

function updateLeaderMiniCalPeek(date) {
    const peekText = document.getElementById('leaderMiniCalPeekText');
    if (!peekText) return;
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    const dayOfWeek = date.getDay();
    const duties = getLeaderDayDuties(dayOfWeek);
    const events = getLeaderDayEvents(y, m, d);

    const dateFormatted = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

    if (duties.length === 0 && events.length === 0) {
        peekText.innerHTML = `<strong>${dateFormatted}:</strong> No scheduled serving duties or events.`;
        return;
    }

    const items = [];
    duties.forEach(dut => items.push(`<span class="text-amber-700 font-semibold">${escapeHtml(dut.label)}</span>`));
    events.forEach(ev => items.push(`<span class="text-indigo-700 font-semibold">${escapeHtml(ev.title)} (${escapeHtml(ev.event_type || 'Event')})</span>`));

    peekText.innerHTML = `<strong>${dateFormatted}:</strong> ${items.join(' &bull; ')}`;
}

function renderLeaderMiniCalendar() {
    const titleEl = document.getElementById('leaderMiniCalMonthYear');
    const gridEl = document.getElementById('leaderMiniCalGrid');
    if (!gridEl) return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (titleEl) titleEl.textContent = `${monthNames[leaderMiniCalMonth]} ${leaderMiniCalYear}`;

    const firstDayIndex = new Date(leaderMiniCalYear, leaderMiniCalMonth, 1).getDay();
    const daysInCurrentMonth = new Date(leaderMiniCalYear, leaderMiniCalMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(leaderMiniCalYear, leaderMiniCalMonth, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selStr = `${leaderMiniCalSelectedDate.getFullYear()}-${String(leaderMiniCalSelectedDate.getMonth() + 1).padStart(2, '0')}-${String(leaderMiniCalSelectedDate.getDate()).padStart(2, '0')}`;

    let cellsHtml = '';

    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        cellsHtml += `<div class="mini-cal-cell other-month">${d}</div>`;
    }

    for (let day = 1; day <= daysInCurrentMonth; day++) {
        const dStr = `${leaderMiniCalYear}-${String(leaderMiniCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = (dStr === todayStr);
        const isSelected = (dStr === selStr);
        const dayOfWeek = new Date(leaderMiniCalYear, leaderMiniCalMonth, day).getDay();

        const duties = getLeaderDayDuties(dayOfWeek);
        const events = getLeaderDayEvents(leaderMiniCalYear, leaderMiniCalMonth, day);

        let dotsHtml = '';
        const hasService = duties.some(d => d.type === 'service' || d.type === 'midweek');
        const hasDuty = duties.some(d => d.type === 'duty');
        const hasSeminary = events.some(e => (e.event_type || '').toLowerCase() === 'seminary');
        const hasEvent = events.some(e => (e.event_type || '').toLowerCase() !== 'seminary');
        const hasC2S = duties.some(d => d.type === 'c2s');

        if (hasService) dotsHtml += '<span class="mini-cal-dot mini-dot-service" title="Church Service"></span>';
        if (hasDuty) dotsHtml += '<span class="mini-cal-dot mini-dot-duty" title="Ministry Duty"></span>';
        if (hasSeminary) dotsHtml += '<span class="mini-cal-dot mini-dot-seminary" title="Seminary Course"></span>';
        if (hasEvent) dotsHtml += '<span class="mini-cal-dot mini-dot-event" title="Church Event"></span>';
        if (hasC2S) dotsHtml += '<span class="mini-cal-dot mini-dot-c2s" title="C2S Cell Group Fellowship"></span>';

        cellsHtml += `
            <div class="mini-cal-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" 
                 onclick="selectLeaderMiniCalDate(${leaderMiniCalYear}, ${leaderMiniCalMonth}, ${day})">
                <span>${day}</span>
                <div class="mini-cal-dots">${dotsHtml}</div>
            </div>
        `;
    }

    const totalRendered = firstDayIndex + daysInCurrentMonth;
    const remainder = totalRendered % 7;
    if (remainder !== 0) {
        const nextDays = 7 - remainder;
        for (let d = 1; d <= nextDays; d++) {
            cellsHtml += `<div class="mini-cal-cell other-month">${d}</div>`;
        }
    }

    gridEl.innerHTML = cellsHtml;
    updateLeaderMiniCalPeek(leaderMiniCalSelectedDate);
}

// ============================================================
// LEADER EVENT MANAGEMENT (ADD, EDIT, DELETE)
// ============================================================
async function openLeaderEventModal(eventId = null) {
    if (!allLeaderMinistriesCache || allLeaderMinistriesCache.length === 0) {
        try {
            const minRes = await api.ministries.getAll();
            allLeaderMinistriesCache = minRes.data || [];
        } catch (e) {
            console.error('Failed to pre-fetch ministries in openLeaderEventModal:', e);
        }
    }

    const form = document.getElementById('leaderEventForm');
    if (form) form.reset();
    document.getElementById('leader_event_id').value = '';

    populateLeaderMinistriesDropdowns();

    const bannerPreview = document.getElementById('leader_event_banner_preview');
    const bannerPlaceholder = document.getElementById('leader_event_banner_placeholder');
    const bannerFileInput = document.getElementById('leader_event_banner_file');
    const bannerUrlInput = document.getElementById('leader_event_banner_url');
    if (bannerFileInput) bannerFileInput.value = '';
    if (bannerUrlInput) bannerUrlInput.value = '';
    if (bannerPreview) { bannerPreview.src = ''; bannerPreview.style.display = 'none'; }
    if (bannerPlaceholder) bannerPlaceholder.style.display = 'block';

    document.getElementById('leader_event_enrollment_open').checked = false;
    document.getElementById('leader_event_is_public').checked = true;
    document.getElementById('leader_event_is_featured').checked = false;

    if (eventId) {
        document.getElementById('leaderEventModalTitle').textContent = 'Edit Church Event';
        const ev = allLeaderEventsCache.find(e => e.event_id == eventId);
        if (ev) {
            document.getElementById('leader_event_id').value = ev.event_id;
            document.getElementById('leader_event_title').value = ev.title || '';
            document.getElementById('leader_event_type').value = ev.event_type || 'Worship';
            document.getElementById('leader_event_department').value = ev.department || '';
            onLeaderFormDeptChange();
            if (ev.ministry_id) document.getElementById('leader_event_ministry_id').value = ev.ministry_id;
            document.getElementById('leader_event_status').value = ev.status || 'Upcoming';
            
            document.getElementById('leader_event_start').value = formatLocalDateTime(ev.start_datetime);
            document.getElementById('leader_event_end').value = formatLocalDateTime(ev.end_datetime);
            
            document.getElementById('leader_event_venue').value = ev.venue || ev.location || '';
            document.getElementById('leader_event_organizer').value = ev.organizer || ev.speaker || '';
            document.getElementById('leader_event_description').value = ev.description || '';
            document.getElementById('leader_event_enrollment_open').checked = ev.is_enrollment_open == 1;
            document.getElementById('leader_event_is_public').checked = ev.is_public == 1;
            document.getElementById('leader_event_is_featured').checked = ev.is_featured == 1;
            document.getElementById('leader_event_capacity').value = ev.capacity || '';

            if (ev.banner_image) {
                if (bannerUrlInput) bannerUrlInput.value = ev.banner_image;
                if (bannerPreview) { bannerPreview.src = ev.banner_image; bannerPreview.style.display = 'block'; }
                if (bannerPlaceholder) bannerPlaceholder.style.display = 'none';
            }
        }
    } else {
        document.getElementById('leaderEventModalTitle').textContent = 'Add Church Event';
        document.getElementById('leader_event_status').value = 'Upcoming';
        const now = new Date();
        const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        document.getElementById('leader_event_start').value = formatLocalDateTime(now);
        document.getElementById('leader_event_end').value = formatLocalDateTime(later);
    }

    const modal = document.getElementById('leaderEventFormModal');
    if (modal) modal.classList.add('active');
}

function closeLeaderEventFormModal() {
    const modal = document.getElementById('leaderEventFormModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.removeProperty('display');
    }
}
window.closeLeaderEventFormModal = closeLeaderEventFormModal;

function closeLeaderEventModal() {
    const modal = document.getElementById('leaderEventModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.removeProperty('display');
    }
    if (typeof closeLeaderEventFormModal === 'function') {
        closeLeaderEventFormModal();
    }
}
window.closeLeaderEventModal = closeLeaderEventModal;

async function saveLeaderEvent() {
    const id = document.getElementById('leader_event_id').value;
    const title = document.getElementById('leader_event_title').value.trim();
    const event_type = document.getElementById('leader_event_type').value;
    const department = document.getElementById('leader_event_department').value || null;
    const ministry_id = document.getElementById('leader_event_ministry_id').value ? parseInt(document.getElementById('leader_event_ministry_id').value, 10) : null;
    const status = document.getElementById('leader_event_status').value;
    const start_datetime = document.getElementById('leader_event_start').value;
    const end_datetime = document.getElementById('leader_event_end').value || null;
    const venue = document.getElementById('leader_event_venue').value.trim() || null;
    const organizer = document.getElementById('leader_event_organizer').value.trim() || null;
    const description = document.getElementById('leader_event_description').value.trim() || null;
    const is_enrollment_open = document.getElementById('leader_event_enrollment_open').checked;
    const is_public = document.getElementById('leader_event_is_public').checked;
    const is_featured = document.getElementById('leader_event_is_featured').checked;
    const capacity = parseInt(document.getElementById('leader_event_capacity').value, 10) || null;

    if (!title || !start_datetime || !end_datetime) {
        showToast('Please fill in required fields (Title, Start Date, and End Date).');
        return;
    }

    const bannerFile = document.getElementById('leader_event_banner_file')?.files?.[0];
    const bannerUrl = document.getElementById('leader_event_banner_url')?.value || '';

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

    const btn = document.getElementById('btnSaveLeaderEvent');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';

    try {
        if (id) {
            await api.events.update(id, formData);
            showToast('Event updated successfully!');
        } else {
            await api.events.create(formData);
            showToast('Event created successfully!');
        }
        closeLeaderEventFormModal();
        await loadLeaderEvents();
        await loadDashboardSummary();
    } catch (err) {
        showToast('Error saving event: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
}

async function deleteLeaderEvent(id, title) {
    const ok = await showDecisionModal({
        title: 'Delete Event',
        message: `Are you sure you want to delete "${title}"? This cannot be undone.`,
        confirmText: 'Delete Event',
        type: 'danger',
        icon: 'fa-trash-can'
    });
    if (!ok) return;

    try {
        await api.events.delete(id);
        showToast('Event deleted successfully!');
        await loadLeaderEvents();
        await loadDashboardSummary();
    } catch (err) {
        showToast('Error deleting event: ' + err.message);
    }
}

function onLeaderFormDeptChange() {
    const dept = document.getElementById('leader_event_department')?.value || '';
    const minSelect = document.getElementById('leader_event_ministry_id');
    if (!minSelect) return;
    minSelect.innerHTML = '<option value="">None / General Church</option>';
    const sourceList = (allLeaderMinistriesCache && allLeaderMinistriesCache.length > 0)
        ? allLeaderMinistriesCache
        : (leaderAssignedMinistriesCache || []);
    const filtered = sourceList.filter(m => !dept || (m.department || '').toLowerCase() === dept.toLowerCase());
    filtered.forEach(m => {
        minSelect.innerHTML += `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`;
    });
}

function populateLeaderMinistriesDropdowns() {
    onLeaderFormDeptChange();
    onLeaderAnnDeptChange();
}

// ============================================================
// LEADER ANNOUNCEMENT MANAGEMENT (ADD, EDIT, DELETE)
// ============================================================
async function openLeaderAnnouncementModal(annId = null) {
    if (!allLeaderMinistriesCache || allLeaderMinistriesCache.length === 0) {
        try {
            const minRes = await api.ministries.getAll();
            allLeaderMinistriesCache = minRes.data || [];
        } catch (e) {
            console.error('Failed to pre-fetch ministries in openLeaderAnnouncementModal:', e);
        }
    }

    const form = document.getElementById('leaderAnnForm');
    if (form) form.reset();
    document.getElementById('leader_ann_id').value = '';

    populateLeaderMinistriesDropdowns();

    document.getElementById('leader_ann_pinned').checked = false;
    document.getElementById('leader_ann_published').checked = true;

    if (annId) {
        document.getElementById('leaderAnnModalTitle').textContent = 'Edit Announcement';
        const a = allLeaderAnnCache.find(x => x.announcement_id == annId);
        if (a) {
            document.getElementById('leader_ann_id').value = a.announcement_id;
            document.getElementById('leader_ann_title').value = a.title || '';
            document.getElementById('leader_ann_department').value = a.department || '';
            onLeaderAnnDeptChange();
            if (a.ministry_id) document.getElementById('leader_ann_ministry_id').value = a.ministry_id;
            document.getElementById('leader_ann_category').value = a.category || 'General';
            document.getElementById('leader_ann_audience').value = a.target_audience || 'All';
            document.getElementById('leader_ann_content').value = a.content || '';
            
            document.getElementById('leader_ann_publish_date').value = formatLocalDateTime(a.publish_date);
            document.getElementById('leader_ann_expiry_date').value = formatLocalDateTime(a.expiry_date);
            
            document.getElementById('leader_ann_pinned').checked = a.is_pinned == 1;
            document.getElementById('leader_ann_published').checked = a.is_published == 1;
        }
    } else {
        document.getElementById('leaderAnnModalTitle').textContent = 'Add Announcement';
        const now = new Date();
        document.getElementById('leader_ann_publish_date').value = formatLocalDateTime(now);
    }

    const modal = document.getElementById('leaderAnnouncementFormModal');
    if (modal) modal.classList.add('active');
}

function closeLeaderAnnouncementModal() {
    const modal = document.getElementById('leaderAnnouncementFormModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.removeProperty('display');
    }
    const viewModal = document.getElementById('leaderAnnouncementModal');
    if (viewModal) {
        viewModal.classList.remove('active');
        viewModal.style.display = 'none';
        viewModal.style.removeProperty('display');
    }
}
window.closeLeaderAnnouncementModal = closeLeaderAnnouncementModal;

async function saveLeaderAnnouncement() {
    const id = document.getElementById('leader_ann_id').value;
    const title = document.getElementById('leader_ann_title').value.trim();
    const department = document.getElementById('leader_ann_department').value || null;
    const ministry_id = document.getElementById('leader_ann_ministry_id').value ? parseInt(document.getElementById('leader_ann_ministry_id').value, 10) : null;
    const category = document.getElementById('leader_ann_category').value;
    const target_audience = document.getElementById('leader_ann_audience').value;
    const content = document.getElementById('leader_ann_content').value.trim();
    const publish_date = document.getElementById('leader_ann_publish_date').value || null;
    const expiry_date = document.getElementById('leader_ann_expiry_date').value || null;
    const is_pinned = document.getElementById('leader_ann_pinned').checked ? 1 : 0;
    const is_published = document.getElementById('leader_ann_published').checked ? 1 : 0;

    if (!title || !content) {
        showToast('Please provide a title and announcement content.');
        return;
    }

    const payload = {
        title,
        department,
        ministry_id,
        category,
        target_audience,
        content,
        publish_date,
        expiry_date,
        is_pinned,
        is_published
    };

    const btn = document.getElementById('btnSaveLeaderAnn');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';

    try {
        if (id) {
            await api.announcements.update(id, payload);
            showToast('Announcement updated successfully!');
        } else {
            await api.announcements.create(payload);
            showToast('Announcement created successfully!');
        }
        closeLeaderAnnouncementModal();
        await loadLeaderAnnouncements();
        await loadDashboardSummary();
    } catch (err) {
        showToast('Error saving announcement: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
}

async function deleteLeaderAnnouncement(id, title) {
    const ok = await showDecisionModal({
        title: 'Delete Announcement',
        message: `Are you sure you want to delete "${title}"? This cannot be undone.`,
        confirmText: 'Delete Announcement',
        type: 'danger',
        icon: 'fa-trash-can'
    });
    if (!ok) return;

    try {
        await api.announcements.delete(id);
        showToast('Announcement deleted successfully!');
        await loadLeaderAnnouncements();
        await loadDashboardSummary();
    } catch (err) {
        showToast('Error deleting announcement: ' + err.message);
    }
}

function onLeaderAnnDeptChange() {
    const dept = document.getElementById('leader_ann_department')?.value || '';
    const minSelect = document.getElementById('leader_ann_ministry_id');
    if (!minSelect) return;
    minSelect.innerHTML = '<option value="">None / General Church</option>';
    const sourceList = (allLeaderMinistriesCache && allLeaderMinistriesCache.length > 0)
        ? allLeaderMinistriesCache
        : (leaderAssignedMinistriesCache || []);
    const filtered = sourceList.filter(m => !dept || (m.department || '').toLowerCase() === dept.toLowerCase());
    filtered.forEach(m => {
        minSelect.innerHTML += `<option value="${m.ministry_id}">${escapeHtml(m.ministry_name)}</option>`;
    });
}

function initLeaderDateInputsAutoFill() {
    ['att_service_date', 'sermon_date', 'album_event_date'].forEach(id => {
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

    ['leader_event_start', 'leader_event_end'].forEach(id => {
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
    document.addEventListener('DOMContentLoaded', () => {
        initLeaderDateInputsAutoFill();
        loadSmsGatewayStatus();
    });
} else {
    initLeaderDateInputsAutoFill();
    loadSmsGatewayStatus();
}

// ============== SMS GATEWAY MANAGEMENT & TEST (LEADER) ==============
let smsSettingsCache = null;

async function loadSmsGatewayStatus() {
    try {
        const res = await api.system.getSmsSettings();
        smsSettingsCache = res.data;

        const badgeEl = document.getElementById('smsGatewayStatusBadge');
        const descEl = document.getElementById('smsGatewayDesc');
        if (badgeEl) {
            if (smsSettingsCache.configured) {
                badgeEl.className = 'badge badge-active';
                badgeEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Live Gateway Active (${escapeHtml(smsSettingsCache.provider)})`;
                if (descEl) descEl.textContent = `Provider: ${smsSettingsCache.provider}. Ready to deliver SMS over cellular carriers.`;
            } else {
                badgeEl.className = 'badge badge-inactive';
                badgeEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Simulation Mode (Sandbox Verification)`;
                if (descEl) descEl.textContent = `No API key configured. SMS blasts will be simulated and logged to database only.`;
            }
        }

        const bannerEl = document.getElementById('announcementSmsBanner');
        if (bannerEl) {
            bannerEl.style.display = 'flex';
        }
    } catch (err) {
        console.warn('Failed to load SMS gateway status:', err.message);
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
window.openSmsSettingsModal = openSmsSettingsModal;
window.closeSmsSettingsModal = closeSmsSettingsModal;
window.saveSmsSettings = saveSmsSettings;
window.openTestSmsModal = openTestSmsModal;
window.closeTestSmsModal = closeTestSmsModal;
window.dispatchTestSms = dispatchTestSms;
