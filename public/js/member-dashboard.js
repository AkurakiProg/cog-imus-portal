// Helper: HTML Escaping
function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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
    return `<span class="badge badge-dept-general">${escapeHtml(status || 'Upcoming')}</span>`;
}

// Global Caches & State
let currentUser = null;
let allMemberEventsCache = [];
let myEnrollmentIds = new Set();
let allMemberAnnouncementsCache = [];
let myMinistryCache = null;
let allC2SGroupsCache = [];
let myC2SGroupCache = null;

// Calendar State
let memberCalDate = new Date();
let memberCalMode = 'monthly';
let memberSelectedDate = new Date();

// Mini Calendar State
let miniCalDate = new Date();
let miniCalSelectedDate = new Date();

// Events & Announcements Filter State
let currentEventFilterType = 'All';
let currentAnnCategoryFilter = '';

// ==========================================
// AUDIO SYNTHESIZER FOR MEMBER PORTAL NOTIFICATIONS
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

        btnConfirm?.addEventListener('click', onConfirm);
        btnCancel?.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeyDown);
    });
}
window.showConfirmDialog = showDecisionModal;

document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('church_token');

    // Purge any lingering legacy session tokens in localStorage
    localStorage.removeItem('church_token');
    localStorage.removeItem('church_user');

    if (!token) {
        window.location.href = '/views/login.html';
        return;
    }

    try {
        const meRes = await api.auth.getMe();
        currentUser = meRes.data;

        if (!currentUser || currentUser.role_name !== 'Church Member') {
            if (currentUser && currentUser.role_name === 'Admin') {
                window.location.href = '/views/admin-dashboard.html';
                return;
            } else if (currentUser && currentUser.role_name === 'Church Leader') {
                window.location.href = '/views/leader-dashboard.html';
                return;
            }
            showToast('Access Denied. Members only.');
            sessionStorage.removeItem('church_token');
            sessionStorage.removeItem('church_user');
            localStorage.removeItem('church_token');
            localStorage.removeItem('church_user');
            setTimeout(() => { window.location.href = '/views/login.html'; }, 500);
            return;
        }

        sessionStorage.setItem('church_user', JSON.stringify(currentUser));
        const memberNameEl = document.getElementById('memberName');
        if (memberNameEl) memberNameEl.textContent = currentUser.full_name;
        document.getElementById('memberFirstName').textContent = currentUser.worda_role || currentUser.full_name.split(' ')[0];
        const topName = document.getElementById('memberTopName');
        if (topName) topName.textContent = currentUser.full_name;

        const avatarEl = document.getElementById('userAvatar');
        if (avatarEl) {
            if (currentUser.profile_image) {
                avatarEl.innerHTML = `<img src="${escapeHtml(currentUser.profile_image)}" alt="${escapeHtml(currentUser.full_name)}">`;
            } else {
                avatarEl.textContent = currentUser.full_name.charAt(0).toUpperCase();
            }
        }
        
        const topbarAvatar = document.getElementById('topbarAvatar');
        if (topbarAvatar) {
            if (currentUser.profile_image) {
                topbarAvatar.innerHTML = `<img src="${escapeHtml(currentUser.profile_image)}" alt="${escapeHtml(currentUser.full_name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null; this.parentElement.textContent='${escapeHtml(currentUser.full_name.charAt(0).toUpperCase())}';">`;
            } else {
                topbarAvatar.textContent = currentUser.full_name.charAt(0).toUpperCase();
            }
        }
        if (typeof updateDropdownUserInfo === 'function') updateDropdownUserInfo();
        
        // Initial dashboard data load
        await loadDashboardMetrics();
        await loadDashboardMinistry();
        await loadMemberCalendarData();

        // Setup modal backdrop close handlers
        setupModalBackdrops();

        api.startSessionWatchdog();

        // Start real-time announcements notifier with chime & indicator dot
        initMemberAnnouncementsNotifier();

        initMemberRealtimeSync();
    } catch (err) {
        console.error('Session error:', err);
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

function handleRealtimeMemberUpdate(payload) {
    if (!payload || !payload.type || payload.type === 'connected') return;
    const type = payload.type;
    const activeView = document.querySelector('.view.active')?.id?.replace('view-', '') || 'dashboard';

    // Refresh member overview metrics
    if (typeof loadDashboardMetrics === 'function') {
        loadDashboardMetrics();
    }

    if (type === 'events') {
        if (typeof loadEvents === 'function') loadEvents();
        if (typeof loadMemberCalendarData === 'function') loadMemberCalendarData();
    } else if (type === 'announcements') {
        if (typeof loadAnnouncements === 'function') loadAnnouncements();
    } else if (type === 'c2s') {
        if (typeof loadMemberC2S === 'function') loadMemberC2S();
    } else if (type === 'ministries') {
        if (typeof loadMyMinistry === 'function') loadMyMinistry();
        if (typeof loadDashboardMinistry === 'function') loadDashboardMinistry();
    }
}

function initMemberRealtimeSync() {
    if (churchBroadcastChannel) {
        churchBroadcastChannel.onmessage = (e) => {
            handleRealtimeMemberUpdate(e.data);
        };
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'church_realtime_ping' && e.newValue) {
            try {
                const data = JSON.parse(e.newValue);
                handleRealtimeMemberUpdate(data);
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
                        handleRealtimeMemberUpdate(payload);
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

// --- Routing & UI Helpers ---
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

function setupModalBackdrops() {
    // Backdrop close is handled uniformly and safely by initMemberModalBackdropClose()
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
            'dashboard': 'Dashboard',
            'c2s': 'C2S Group',
            'events': 'Events & Seminary',
            'announcements': 'Announcements',
            'ministry': 'My Ministry'
        };
        document.getElementById('pageTitle').innerText = titles[viewName] || (viewName.charAt(0).toUpperCase() + viewName.slice(1));
    }
    if (viewName === 'announcements') {
        const dot = document.getElementById('memberAnnounceNavDot');
        if (dot) dot.style.display = 'none';
        if (typeof memberLastSeenAnnouncementId !== 'undefined' && memberLastSeenAnnouncementId > 0) {
            localStorage.setItem('cog_member_last_seen_ann_id', String(memberLastSeenAnnouncementId));
        }
    }

    switch(viewName) {
        case 'dashboard': 
            loadDashboardMetrics();
            loadDashboardMinistry();
            loadMemberCalendarData();
            break;
        case 'c2s':
            loadMemberC2S();
            break;
        case 'events': 
            loadEvents(); 
            break;
        case 'announcements': 
            loadAnnouncements(); 
            break;
        case 'ministry': 
            loadMyMinistry(); 
            break;
    }
}

// ============================================================
// DASHBOARD OVERVIEW & METRICS
// ============================================================
async function loadDashboardMetrics() {
    try {
        const [eventsRes, annRes, c2sRes] = await Promise.all([
            api.events.getAll().catch(() => ({ data: [] })),
            api.announcements.getAll().catch(() => ({ data: [] })),
            api.c2s.getAll().catch(() => ({ data: [] }))
        ]);

        const events = eventsRes.data || [];
        allMemberEventsCache = events.filter(e => e.status === 'Upcoming' || e.status === 'Ongoing');
        const dashEventsCount = document.getElementById('dashEventsCount');
        if (dashEventsCount) dashEventsCount.innerText = allMemberEventsCache.length;

        const announcements = annRes.data || [];
        allMemberAnnouncementsCache = announcements;
        const dashAnnCount = document.getElementById('dashAnnouncementsCount');
        if (dashAnnCount) dashAnnCount.innerText = announcements.length;

        // Resolve current member's C2S group
        allC2SGroupsCache = c2sRes.data || [];
        await resolveMyC2SGroup(allC2SGroupsCache);

        // Update C2S Stat Card
        const dashC2SName = document.getElementById('dashC2SGroupName');
        const dashC2SRole = document.getElementById('dashC2SRole');
        if (dashC2SName) {
            if (myC2SGroupCache) {
                dashC2SName.textContent = myC2SGroupCache.group_name;
                if (dashC2SRole) {
                    dashC2SRole.textContent = myC2SGroupCache.my_designation || 'Participant';
                }
            } else {
                dashC2SName.textContent = 'Not Connected';
                if (dashC2SRole) dashC2SRole.textContent = 'Find a Group \u2192';
            }
        }

        // Render top 2 recent announcements in dashboard mini-feed
        renderDashboardAnnouncements(announcements);

        // Render top 2 upcoming events in dashboard spotlight
        renderDashboardEventsSpotlight(allMemberEventsCache);

        // Render Mini Calendar
        renderMiniCalendar();
    } catch (err) {
        console.error('Error loading dashboard metrics:', err);
    }
}

function renderDashboardAnnouncements(announcements) {
    const dashAnnList = document.getElementById('dashAnnouncementsList');
    if (!dashAnnList) return;

    if (announcements.length === 0) {
        dashAnnList.innerHTML = '<p class="text-slate-400" style="font-size: 0.9rem;">No current announcements.</p>';
        return;
    }

    dashAnnList.innerHTML = announcements.slice(0, 2).map(a => {
        const isPinned = a.is_pinned == 1;
        const catClass = getCategoryClass(a.category);
        const dateStr = a.publish_date ? new Date(a.publish_date).toLocaleDateString() : '';
        return `
            <div class="announcement-card-modern" style="margin-bottom: 0.85rem; padding: 1.15rem; ${isPinned ? 'border-left: 4px solid var(--gold); background: #fffdf5;' : ''}">
                <div class="announcement-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.4rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        ${isPinned ? '<span class="badge" style="background: #fef08a; color: #854d0e; font-size: 0.72rem; font-weight: 700; border: 1px solid #fde68a;"><i class="fa-solid fa-thumbtack mr-1 text-amber-600"></i> Pinned</span>' : ''}
                        <span class="announcement-title" style="font-size: 1.05rem; font-weight: 700; color: var(--navy);">${escapeHtml(a.title)}</span>
                    </div>
                    <span class="category-pill ${catClass}">${escapeHtml(a.category || 'General')}</span>
                </div>
                <div class="announcement-meta" style="margin-bottom: 0.5rem; font-size: 0.75rem; color: var(--text-light); display: flex; gap: 0.75rem;">
                    <span><i class="fa-solid fa-calendar-day" style="color: var(--gold);"></i> ${dateStr}</span>
                    <span><i class="fa-solid fa-users text-slate-400"></i> ${escapeHtml(a.target_audience || 'All Members')}</span>
                </div>
                <p style="color: var(--text-dark); font-size: 0.875rem; line-height: 1.5; margin: 0 0 0.75rem;">
                    ${escapeHtml(a.content.length > 130 ? a.content.slice(0, 130) + '...' : a.content)}
                </p>
                <button type="button" class="btn-secondary btn-sm" onclick="openMemberAnnouncementReaderModal(${a.announcement_id})" style="padding: 0.3rem 0.75rem; font-size: 0.75rem;">
                    <i class="fa-solid fa-book-open mr-1"></i> Read Full Bulletin
                </button>
            </div>
        `;
    }).join('');
}

function renderDashboardEventsSpotlight(events) {
    const container = document.getElementById('dashEventsSpotlightList');
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = '<p class="text-slate-400" style="font-size: 0.9rem;">No upcoming events or seminary classes at this time.</p>';
        return;
    }

    container.innerHTML = events.slice(0, 2).map(e => {
        const isSeminary = (e.event_type || '').toLowerCase() === 'seminary';
        const dateStr = e.start_datetime ? new Date(e.start_datetime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBA';
        const isEnrolled = myEnrollmentIds.has(e.event_id);

        return `
            <div style="padding: 1rem; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 0.85rem;">
                    <div style="width: 40px; height: 40px; border-radius: 8px; background: ${isSeminary ? '#fef3c7' : '#eff6ff'}; color: ${isSeminary ? '#b45309' : '#2563eb'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
                        <i class="fa-solid ${isSeminary ? 'fa-graduation-cap' : 'fa-calendar-day'}"></i>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 2px;">
                            <strong style="color: var(--navy); font-size: 0.95rem;">${escapeHtml(e.title)}</strong>
                            <span class="badge" style="font-size: 0.65rem; background: ${isSeminary ? '#fffbeb' : '#f1f5f9'}; color: ${isSeminary ? '#b45309' : '#1e293b'}; border: 1px solid ${isSeminary ? '#fde68a' : '#cbd5e1'};">
                                ${escapeHtml(e.event_type || 'Event')}
                            </span>
                        </div>
                        <span class="text-xs text-slate-500" style="display: block;">
                            <i class="fa-regular fa-clock mr-1"></i> ${dateStr} &bull; <i class="fa-solid fa-location-dot ml-1 text-amber-600"></i> ${escapeHtml(e.venue || 'Sanctuary')}
                        </span>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button type="button" class="btn-secondary btn-sm" onclick="openMemberEventDetailModal(${e.event_id})" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
                        Details & Syllabus
                    </button>
                    ${isEnrolled ? `
                        <span class="badge" style="background: #ecfdf5; color: #065f46; font-size: 0.75rem; padding: 0.35rem 0.65rem;"><i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i> Enrolled</span>
                    ` : (e.is_enrollment_open == 1 ? `
                        <button type="button" class="btn-primary btn-sm" onclick="enrollEvent(${e.event_id})" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
                            Enroll
                        </button>
                    ` : '')}
                </div>
            </div>
        `;
    }).join('');
}

async function loadDashboardMinistry() {
    try {
        const res = await api.members.getMyMinistry();
        if (res.data) {
            myMinistryCache = res.data;
            myMinistriesList = res.data.ministries || [res.data];
            document.getElementById('dashMinistryName').innerText = res.data.ministry_name;
            const schedStr = res.data.meeting_schedule ? ` • ${res.data.meeting_schedule}` : '';
            document.getElementById('dashMinistryRole').innerText = `${res.data.role_in_ministry || 'Member'}${schedStr}`;
        } else {
            myMinistryCache = null;
            myMinistriesList = [];
            document.getElementById('dashMinistryName').innerText = 'Not Assigned';
            document.getElementById('dashMinistryRole').innerText = 'Explore WORDA';
        }
    } catch (error) {
        console.error('Error loading dashboard ministry:', error);
    }
}

function getCategoryClass(cat) {
    if (!cat) return 'cat-general';
    const c = cat.toLowerCase();
    if (c.includes('urgent')) return 'cat-urgent';
    if (c.includes('worship')) return 'cat-worship';
    if (c.includes('youth')) return 'cat-youth';
    if (c.includes('event')) return 'cat-event';
    if (c.includes('ministry')) return 'cat-ministry';
    return 'cat-general';
}

// ============================================================
// MINI CALENDAR (INSPECTION WIDGET ABOVE SERVICE TIMES)
// ============================================================
function prevMiniCal() {
    miniCalDate.setMonth(miniCalDate.getMonth() - 1);
    renderMiniCalendar();
}

function nextMiniCal() {
    miniCalDate.setMonth(miniCalDate.getMonth() + 1);
    renderMiniCalendar();
}

function todayMiniCal() {
    miniCalDate = new Date();
    miniCalSelectedDate = new Date();
    renderMiniCalendar();
}

function renderMiniCalendar() {
    const titleEl = document.getElementById('miniCalTitle');
    const gridEl = document.getElementById('miniCalGrid');
    if (!gridEl) return;

    const year = miniCalDate.getFullYear();
    const month = miniCalDate.getMonth();
    const monthName = miniCalDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (titleEl) titleEl.textContent = monthName;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selStr = `${miniCalSelectedDate.getFullYear()}-${String(miniCalSelectedDate.getMonth() + 1).padStart(2, '0')}-${String(miniCalSelectedDate.getDate()).padStart(2, '0')}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    let cellsHtml = '';

    // Prev month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        cellsHtml += `<div class="mini-cal-cell other-month">${d}</div>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = (dateStr === todayStr);
        const isSelected = (dateStr === selStr);
        const dayOfWeek = dateObj.getDay();

        const duties = getDayDuties(dayOfWeek);
        const events = getDayEvents(year, month, day);

        // Dot indicators
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
            <div class="mini-cal-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" onclick="selectMiniCalDate(${year}, ${month}, ${day})">
                <span>${day}</span>
                <div class="mini-cal-dots">${dotsHtml}</div>
            </div>
        `;
    }

    // Next month leading days to complete row
    const totalRendered = firstDayIndex + daysInMonth;
    const remainder = totalRendered % 7;
    if (remainder !== 0) {
        const nextDays = 7 - remainder;
        for (let d = 1; d <= nextDays; d++) {
            cellsHtml += `<div class="mini-cal-cell other-month">${d}</div>`;
        }
    }

    gridEl.innerHTML = cellsHtml;
    updateMiniCalPeek(miniCalSelectedDate);
}

function selectMiniCalDate(year, month, day) {
    miniCalSelectedDate = new Date(year, month, day);
    memberSelectedDate = new Date(year, month, day);
    memberCalDate = new Date(year, month, day);
    renderMiniCalendar();
}

function updateMiniCalPeek(dateObj) {
    const peekEl = document.getElementById('miniCalPeekText');
    if (!peekEl) return;

    const formatted = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const dayOfWeek = dateObj.getDay();
    const duties = getDayDuties(dayOfWeek);
    const events = getDayEvents(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

    const items = [];
    duties.forEach(d => items.push(d.label));
    events.forEach(e => items.push(e.title));

    if (items.length === 0) {
        peekEl.textContent = `${formatted}: No ministry duty or church events scheduled.`;
    } else {
        peekEl.textContent = `${formatted}: ${items.join(' \u2022 ')}`;
    }
}

// ============================================================
// WORK & MINISTRY CALENDAR MODAL
// ============================================================
function openMemberWorkCalendarModal() {
    const modal = document.getElementById('memberWorkCalendarModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        renderMemberCalendar();
    }
}

function closeMemberWorkCalendarModal() {
    const modal = document.getElementById('memberWorkCalendarModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.removeProperty('display');
    }
}

async function loadMemberCalendarData() {
    try {
        if (!allMemberEventsCache || allMemberEventsCache.length === 0) {
            const evRes = await api.events.getAll().catch(() => ({ data: [] }));
            allMemberEventsCache = (evRes.data || []).filter(e => e.status === 'Upcoming' || e.status === 'Ongoing');
        }
        if (!myMinistryCache) {
            const minRes = await api.members.getMyMinistry().catch(() => ({ data: null }));
            myMinistryCache = minRes.data;
        }
        if (!myC2SGroupCache) {
            if (allC2SGroupsCache && allC2SGroupsCache.length > 0) {
                await resolveMyC2SGroup(allC2SGroupsCache).catch(() => null);
            } else {
                const c2sRes = await api.c2s.getAll().catch(() => ({ data: [] }));
                allC2SGroupsCache = c2sRes.data || [];
                await resolveMyC2SGroup(allC2SGroupsCache).catch(() => null);
            }
        }
        renderMiniCalendar();
    } catch (err) {
        console.error('Error loading calendar data:', err);
    }
}

function setMemberCalendarMode(mode) {
    memberCalMode = mode;
    const btnM = document.getElementById('btnMemberCalMonthly');
    const btnW = document.getElementById('btnMemberCalWeekly');
    if (btnM && btnW) {
        if (mode === 'monthly') {
            btnM.classList.add('active');
            btnW.classList.remove('active');
            document.getElementById('memberMonthlyViewContainer').style.display = 'block';
            document.getElementById('memberWeeklyViewContainer').style.display = 'none';
        } else {
            btnW.classList.add('active');
            btnM.classList.remove('active');
            document.getElementById('memberMonthlyViewContainer').style.display = 'none';
            document.getElementById('memberWeeklyViewContainer').style.display = 'block';
        }
    }
    renderMemberCalendar();
}

function prevMemberCalendar() {
    if (memberCalMode === 'monthly') {
        memberCalDate.setMonth(memberCalDate.getMonth() - 1);
    } else {
        memberCalDate.setDate(memberCalDate.getDate() - 7);
    }
    renderMemberCalendar();
}

function nextMemberCalendar() {
    if (memberCalMode === 'monthly') {
        memberCalDate.setMonth(memberCalDate.getMonth() + 1);
    } else {
        memberCalDate.setDate(memberCalDate.getDate() + 7);
    }
    renderMemberCalendar();
}

function todayMemberCalendar() {
    memberCalDate = new Date();
    memberSelectedDate = new Date();
    renderMemberCalendar();
}

function getDayEvents(year, month, day) {
    const targetDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return (allMemberEventsCache || []).filter(e => {
        if (!e.start_datetime) return false;
        return e.start_datetime.startsWith(targetDateStr);
    });
}

function formatEventTime(dtStr) {
    if (!dtStr) return '';
    try {
        const d = new Date(dtStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

// Helper: Parse schedule day-of-week indexes (0 = Sun, 1 = Mon, ..., 6 = Sat) from natural text
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

function getDayDuties(dayOfWeek) {
    const duties = [];
    if (dayOfWeek === 0) {
        duties.push({ type: 'service', label: 'Sunday Celebration (9AM & 3PM)' });
    } else if (dayOfWeek === 3) {
        duties.push({ type: 'midweek', label: 'Midweek Word & Prayer (7PM)' });
    } else if (dayOfWeek === 6) {
        duties.push({ type: 'service', label: 'Youth Alive Gathering (4PM)' });
    }

    // Interconnect assigned ministry meeting schedules to the Work Calendar
    const ministries = Array.isArray(myMinistriesList) && myMinistriesList.length > 0 
        ? myMinistriesList 
        : (myMinistryCache ? [myMinistryCache] : []);

    ministries.forEach(m => {
        if (!m || !m.meeting_schedule) return;
        const schedDays = parseScheduleDays(m.meeting_schedule);
        if (schedDays.includes(dayOfWeek) || (schedDays.length === 0 && dayOfWeek === 0)) {
            duties.push({
                type: 'duty',
                label: `${m.ministry_name}: ${m.meeting_schedule}`,
                role: m.role_in_ministry || 'Member'
            });
        }
    });

    // Include member's C2S Group weekly fellowship meeting
    if (myC2SGroupCache && myC2SGroupCache.meeting_day) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayName = dayNames[dayOfWeek];
        const schedDay = myC2SGroupCache.meeting_day.toLowerCase();
        if (schedDay.startsWith(currentDayName.toLowerCase().slice(0, 3))) {
            const timeStr = myC2SGroupCache.meeting_time ? formatTime(myC2SGroupCache.meeting_time) : '7:00 PM';
            duties.push({
                type: 'c2s',
                label: `C2S Fellowship: ${myC2SGroupCache.group_name || 'Cell Group'}${timeStr ? ' (' + timeStr + ')' : ''}`,
                time: timeStr
            });
        }
    }

    return duties;
}

function renderMemberCalendar() {
    const titleEl = document.getElementById('memberCalTitle');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selStr = `${memberSelectedDate.getFullYear()}-${String(memberSelectedDate.getMonth() + 1).padStart(2, '0')}-${String(memberSelectedDate.getDate()).padStart(2, '0')}`;

    if (memberCalMode === 'monthly') {
        const year = memberCalDate.getFullYear();
        const month = memberCalDate.getMonth();
        const monthName = memberCalDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        if (titleEl) titleEl.textContent = monthName;

        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const grid = document.getElementById('memberMonthlyGrid');
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

            const duties = getDayDuties(dayOfWeek);
            const events = getDayEvents(year, month, day);

            let badgesHtml = '';
            duties.forEach(d => {
                const badgeClass = d.type === 'service' ? 'badge-service' : (d.type === 'midweek' ? 'badge-midweek' : (d.type === 'c2s' ? 'badge-c2s' : 'badge-duty'));
                badgesHtml += `<span class="cal-cell-badge ${badgeClass}" title="${escapeHtml(d.label)}">${escapeHtml(d.label)}</span>`;
            });

            events.forEach(e => {
                const isSeminary = (e.event_type || '').toLowerCase() === 'seminary';
                const badgeClass = isSeminary ? 'badge-seminary' : 'badge-event';
                const icon = isSeminary ? 'fa-graduation-cap' : 'fa-star';
                const timeStr = formatEventTime(e.start_datetime);
                const displayTitle = timeStr ? `${timeStr} ${e.title}` : e.title;
                badgesHtml += `<span class="cal-cell-badge ${badgeClass}" title="${escapeHtml(displayTitle)}"><i class="fa-solid ${icon} text-[8px] mr-1"></i>${escapeHtml(displayTitle)}</span>`;
            });

            cellsHtml += `
                <div class="cal-month-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" onclick="selectMemberCalendarDate(${year}, ${month}, ${day})">
                    <div class="cal-cell-header">
                        <span style="${isToday ? 'color: var(--gold-dark); font-weight: 800;' : ''}">${day}</span>
                        ${isToday ? '<span class="badge" style="background: var(--gold); color: #ffffff; font-size: 0.6rem; padding: 0 4px;">TODAY</span>' : ''}
                    </div>
                    <div class="cal-cell-badges-wrap">
                        ${badgesHtml}
                    </div>
                </div>
            `;
        }

        // Next month leading days to complete row
        const totalRendered = firstDayIndex + daysInMonth;
        const remainder = totalRendered % 7;
        if (remainder !== 0) {
            const nextDays = 7 - remainder;
            for (let d = 1; d <= nextDays; d++) {
                cellsHtml += `
                    <div class="cal-month-cell other-month">
                        <div class="cal-cell-header"><span class="text-slate-400">${d}</span></div>
                        <div class="cal-cell-badges-wrap"></div>
                    </div>
                `;
            }
        }

        grid.innerHTML = cellsHtml;
    } else {
        // WEEKLY VIEW
        const current = new Date(memberCalDate);
        const dayOfWeek = current.getDay();
        const startOfWeek = new Date(current);
        startOfWeek.setDate(current.getDate() - dayOfWeek);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startMonthStr = startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const endMonthStr = endOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        if (titleEl) titleEl.textContent = `${startMonthStr} \u2013 ${endMonthStr}`;

        const weekGrid = document.getElementById('memberWeeklyGrid');
        if (!weekGrid) return;

        let weekCardsHtml = '';
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
            const isToday = (dateStr === todayStr);
            const isSelected = (dateStr === selStr);
            const dayName = dayDate.toLocaleDateString(undefined, { weekday: 'short' });
            const dayNum = dayDate.getDate();

            const duties = getDayDuties(i);
            const events = getDayEvents(dayDate.getFullYear(), dayDate.getMonth(), dayNum);

            let slotsHtml = '';
            duties.forEach(d => {
                let bg = '#eff6ff', border = '#bfdbfe', color = '#1e40af', icon = 'fa-church';
                if (d.type === 'midweek') {
                    bg = '#fffbeb'; border = '#fde68a'; color = '#92400e'; icon = 'fa-pray';
                } else if (d.type === 'duty') {
                    bg = '#ecfdf5'; border = '#a7f3d0'; color = '#065f46'; icon = 'fa-user-check';
                } else if (d.type === 'c2s') {
                    bg = '#fef3c7'; border = '#fde68a'; color = '#92400e'; icon = 'fa-people-roof';
                }

                slotsHtml += `
                    <div class="cal-week-slot" style="background: ${bg}; border: 1px solid ${border}; color: ${color};">
                        <strong><i class="fa-solid ${icon} mr-1"></i> ${escapeHtml(d.label)}</strong>
                    </div>
                `;
            });

            events.forEach(e => {
                const isSeminary = (e.event_type || '').toLowerCase() === 'seminary';
                const bg = isSeminary ? '#fffbeb' : '#f3e8ff';
                const border = isSeminary ? '#fde68a' : '#e9d5ff';
                const color = isSeminary ? '#92400e' : '#6b21a8';
                const icon = isSeminary ? 'fa-graduation-cap' : 'fa-star';
                const timeStr = formatEventTime(e.start_datetime);

                slotsHtml += `
                    <div class="cal-week-slot" style="background: ${bg}; border: 1px solid ${border}; color: ${color};">
                        <strong><i class="fa-solid ${icon} mr-1"></i> ${escapeHtml(e.title)}</strong>
                        <div class="text-[11px] mt-0.5"><i class="fa-regular fa-clock mr-1"></i>${timeStr || 'TBA'}</div>
                    </div>
                `;
            });

            if (duties.length === 0 && events.length === 0) {
                slotsHtml = '<div class="text-xs text-slate-400 p-2 text-center italic">No scheduled ministry duties or services today.</div>';
            }

            weekCardsHtml += `
                <div class="cal-week-card ${isToday ? 'is-today' : ''}" style="${isSelected ? 'border-color: #2563eb; background: #f0f7ff;' : ''}" onclick="selectMemberCalendarDate(${dayDate.getFullYear()}, ${dayDate.getMonth()}, ${dayNum})">
                    <div class="cal-week-card-header">
                        <span class="day-name" style="${i === 0 ? 'color: #dc2626;' : ''}">${dayName}</span>
                        <span class="day-num">${dayNum}</span>
                        ${isToday ? '<span class="badge" style="background: var(--gold); color: #ffffff; font-size: 0.65rem; margin-top: 4px; display: inline-block;">TODAY</span>' : ''}
                    </div>
                    <div class="cal-week-slots">
                        ${slotsHtml}
                    </div>
                </div>
            `;
        }

        weekGrid.innerHTML = weekCardsHtml;
    }

    renderMemberSelectedDayDetails(memberSelectedDate);
}

function selectMemberCalendarDate(year, month, day) {
    memberSelectedDate = new Date(year, month, day);
    renderMemberCalendar();
}

function renderMemberSelectedDayDetails(dateObj) {
    const container = document.getElementById('memberCalSelectedDayDetails');
    if (!container) return;

    const formattedDate = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const dayOfWeek = dateObj.getDay();
    const duties = getDayDuties(dayOfWeek);
    const events = getDayEvents(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

    let itemsHtml = '';
    duties.forEach(d => {
        const bg = d.type === 'c2s' ? '#fef3c7' : '#e0f2fe';
        const color = d.type === 'c2s' ? '#92400e' : '#0369a1';
        const icon = d.type === 'c2s' ? 'fa-people-roof' : 'fa-clock';
        itemsHtml += `<span class="badge" style="background: ${bg}; color: ${color}; padding: 4px 10px; font-size: 0.78rem; font-weight: 600;"><i class="fa-solid ${icon} mr-1"></i> ${escapeHtml(d.label)}</span>`;
    });
    events.forEach(e => {
        const isSeminary = (e.event_type || '').toLowerCase() === 'seminary';
        const timeStr = formatEventTime(e.start_datetime);
        const timeBadge = timeStr ? ` [${timeStr}]` : '';
        if (isSeminary) {
            itemsHtml += `<span class="badge" style="background: #fef3c7; color: #92400e; padding: 4px 10px; font-size: 0.78rem; font-weight: 600;"><i class="fa-solid fa-graduation-cap mr-1"></i> Seminary: ${escapeHtml(e.title)}${timeBadge} (${escapeHtml(e.venue || 'Room TBA')})</span>`;
        } else {
            itemsHtml += `<span class="badge" style="background: #f3e8ff; color: #7e22ce; padding: 4px 10px; font-size: 0.78rem; font-weight: 600;"><i class="fa-solid fa-star mr-1"></i> Event: ${escapeHtml(e.title)}${timeBadge} (${escapeHtml(e.venue || 'Sanctuary')})</span>`;
        }
    });

    if (duties.length === 0 && events.length === 0) {
        itemsHtml = '<span class="text-xs text-slate-500">No scheduled church services or ministry shifts on this date.</span>';
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-regular fa-calendar-check text-primary" style="font-size: 1.2rem;"></i>
            <div>
                <strong style="color: var(--navy); font-size: 0.95rem; display: block;">${formattedDate}</strong>
                <span class="text-xs text-slate-500">Day's Agenda & Serving Shifts</span>
            </div>
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
            ${itemsHtml}
        </div>
    `;
}

// ============================================================
// C2S GROUP MODULE (CELL-TO-SMALL GROUP DISCIPLESHIP)
// ============================================================
async function resolveMyC2SGroup(groups) {
    if (!currentUser || !currentUser.member_id) return null;
    const memId = currentUser.member_id;

    // 1. Check if user is a primary mentor
    const asMentor = groups.find(g => g.leader_id === memId);
    if (asMentor) {
        try {
            const detailRes = await api.c2s.getById(asMentor.group_id);
            myC2SGroupCache = {
                ...detailRes.data,
                my_designation: 'Primary Mentor'
            };
            return myC2SGroupCache;
        } catch (e) {
            myC2SGroupCache = { ...asMentor, my_designation: 'Primary Mentor' };
            return myC2SGroupCache;
        }
    }

    // 2. Check if user is in any group's roster
    for (const g of groups) {
        try {
            const detailRes = await api.c2s.getById(g.group_id);
            const grp = detailRes.data;
            if (grp && grp.members) {
                const found = grp.members.find(m => m.member_id === memId);
                if (found) {
                    myC2SGroupCache = {
                        ...grp,
                        my_designation: found.designation || 'Mentee'
                    };
                    return myC2SGroupCache;
                }
            }
        } catch (e) {
            // continue checking other groups
        }
    }

    myC2SGroupCache = null;
    return null;
}

async function loadMemberC2S() {
    try {
        const res = await api.c2s.getAll();
        allC2SGroupsCache = res.data || [];

        await resolveMyC2SGroup(allC2SGroupsCache);

        // Update Stat Cards outside main card
        updateC2SSummaryCards();

        // Render Active Tab Content
        renderMyC2STab();
        renderMemberC2SDirectory(allC2SGroupsCache);
    } catch (err) {
        console.error('Error loading C2S groups:', err);
        showToast('Error loading C2S module: ' + err.message);
    }
}

function updateC2SSummaryCards() {
    const nameEl = document.getElementById('c2sMyGroupName');
    const mentorEl = document.getElementById('c2sMyMentorName');
    const totalEl = document.getElementById('c2sMyGroupTotal');
    const meetEl = document.getElementById('c2sMyMeetingTime');

    if (myC2SGroupCache) {
        if (nameEl) nameEl.textContent = myC2SGroupCache.group_name;
        if (mentorEl) mentorEl.textContent = myC2SGroupCache.leader_name || 'Assigned Mentor';
        const contactSub = document.getElementById('c2sMyMentorContact');
        if (contactSub && myC2SGroupCache.leader_contact) {
            contactSub.textContent = myC2SGroupCache.leader_contact;
        }
        if (totalEl) totalEl.textContent = myC2SGroupCache.total_size || (myC2SGroupCache.members ? myC2SGroupCache.members.length + 1 : 1);
        if (meetEl) meetEl.textContent = `${myC2SGroupCache.meeting_day || 'Weekly'} ${myC2SGroupCache.meeting_time ? formatTime(myC2SGroupCache.meeting_time) : ''}`;
        const venueSub = document.getElementById('c2sMyMeetingVenue');
        if (venueSub) venueSub.textContent = myC2SGroupCache.meeting_location || 'Fellowship Gathering';
    } else {
        if (nameEl) nameEl.textContent = 'Not Connected';
        if (mentorEl) mentorEl.textContent = '—';
        if (totalEl) totalEl.textContent = '0';
        if (meetEl) meetEl.textContent = '—';
    }
}

function switchMemberC2STab(tab) {
    const tabMy = document.getElementById('tabMemberC2SMy');
    const tabAll = document.getElementById('tabMemberC2SAll');
    const contentMy = document.getElementById('c2sMyGroupTabContent');
    const contentAll = document.getElementById('c2sAllGroupsTabContent');

    if (tab === 'my') {
        tabMy.classList.add('active');
        tabAll.classList.remove('active');
        contentMy.style.display = 'block';
        contentAll.style.display = 'none';
    } else {
        tabAll.classList.add('active');
        tabMy.classList.remove('active');
        contentAll.style.display = 'block';
        contentMy.style.display = 'none';
        renderMemberC2SDirectory(allC2SGroupsCache);
    }
}

function renderMyC2STab() {
    const container = document.getElementById('c2sMyGroupTabContent');
    if (!container) return;

    if (!myC2SGroupCache) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1.5rem; background: #f8fafc; border-radius: 12px; border: 1px dashed var(--border-color);">
                <div style="width: 70px; height: 70px; background: #eff6ff; color: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; font-size: 2rem;">
                    <i class="fa-solid fa-people-roof"></i>
                </div>
                <h3 style="font-size: 1.35rem; color: var(--navy); margin-bottom: 0.5rem; font-weight: 700;">Join a C2S Discipleship Cell Group</h3>
                <p style="color: #64748b; max-width: 520px; margin: 0 auto 1.5rem; line-height: 1.6; font-size: 0.95rem;">
                    At COGWM Imus, we believe spiritual growth happens in community. A C2S Group connects you with a spiritual mentor and loving brothers and sisters in Christ to grow deeper in God's Word, prayer, and accountability.
                </p>
                <button type="button" class="btn-primary" onclick="switchMemberC2STab('all')" style="padding: 0.65rem 1.25rem; font-size: 0.9rem;">
                    <i class="fa-solid fa-compass mr-1"></i> Browse Church C2S Directory & Find a Group
                </button>
            </div>
        `;
        return;
    }

    const g = myC2SGroupCache;
    const isPrimaryMentor = g.my_designation === 'Primary Mentor';
    const designationBadgeColor = isPrimaryMentor ? 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;' : 'background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;';
    const members = g.members || [];

    container.innerHTML = `
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); border-radius: 12px; padding: 1.75rem; color: #ffffff; margin-bottom: 1.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.4rem;">
                        <span class="badge" style="background: rgba(255,255,255,0.2); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); font-weight: 700;">
                            Active Cell Group
                        </span>
                        <span class="badge" style="${designationBadgeColor} font-weight: 700;">
                            My Role: ${escapeHtml(g.my_designation || 'Participant')}
                        </span>
                    </div>
                    <h2 style="font-size: 1.85rem; margin: 0 0 0.35rem; color: #ffffff; font-weight: 700;">${escapeHtml(g.group_name)}</h2>
                    <p style="color: #cbd5e1; font-size: 0.9rem; margin: 0; max-width: 650px; line-height: 1.5;">
                        ${escapeHtml(g.description || 'Committed to prayer, scripture study, and multiplying disciples for the glory of Jesus Christ.')}
                    </p>
                </div>
                <div style="text-align: right; background: rgba(255,255,255,0.08); padding: 0.85rem 1.25rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
                    <span style="font-size: 0.75rem; color: var(--gold-light); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; display: block;">Weekly Fellowship</span>
                    <strong style="font-size: 1.15rem; color: #ffffff; display: block; margin-top: 2px;">
                        <i class="fa-regular fa-clock mr-1 text-amber-400"></i> ${escapeHtml(g.meeting_day || 'Weekly')} ${g.meeting_time ? formatTime(g.meeting_time) : ''}
                    </strong>
                    <span style="font-size: 0.8rem; color: #cbd5e1; display: block; margin-top: 2px;">
                        <i class="fa-solid fa-location-dot mr-1 text-red-400"></i> ${escapeHtml(g.meeting_location || 'COGWM Sanctuary')}
                    </span>
                </div>
            </div>
        </div>

        <!-- Discipleship Details Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
            <!-- Primary Mentor Card -->
            <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 1.25rem; border-left: 4px solid #b45309;">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Group Shepherd & Primary Mentor</span>
                <div style="display: flex; align-items: center; gap: 0.85rem;">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 700; overflow: hidden; flex-shrink: 0;">
                        ${g.leader_profile_image ? `<img src="${escapeHtml(g.leader_profile_image)}" alt="" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='${g.leader_name ? g.leader_name.charAt(0).toUpperCase() : 'M'}';">` : (g.leader_name ? g.leader_name.charAt(0).toUpperCase() : 'M')}
                    </div>
                    <div>
                        <strong style="color: var(--navy); font-size: 1.05rem; display: block;">${escapeHtml(g.leader_name || 'Assigned Mentor')}</strong>
                        <span class="text-xs text-slate-500 block"><i class="fa-solid fa-phone mr-1"></i> ${escapeHtml(g.leader_contact || 'Contact available through church office')}</span>
                        ${g.leader_email ? `<span class="text-xs text-slate-500 block"><i class="fa-solid fa-envelope mr-1"></i> ${escapeHtml(g.leader_email)}</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- Group Composition Card -->
            <div class="c2s-mult-card" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 1.25rem; border-left: 4px solid #dc2626;">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">C2S Multiplication Structure</span>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <div class="c2s-mult-box c2s-mult-mentor" style="text-align: center; flex: 1; padding: 0.5rem; background: #fee2e2; border-radius: 6px; border: 1px solid #fca5a5;">
                        <span class="c2s-mult-val" style="font-size: 1.25rem; font-weight: 800; color: #dc2626; display: block;">1</span>
                        <span class="c2s-mult-lbl" style="font-size: 0.72rem; color: #dc2626; font-weight: 700;">Primary Mentor</span>
                    </div>
                    <div class="c2s-mult-box c2s-mult-mentee" style="text-align: center; flex: 1; padding: 0.5rem; background: #cffafe; border-radius: 6px; border: 1px solid #67e8f9;">
                        <span class="c2s-mult-val" style="font-size: 1.25rem; font-weight: 800; color: #0891b2; display: block;">${g.mentees_count !== undefined ? g.mentees_count : members.filter(m => m.designation !== 'Secondary Mentor').length}</span>
                        <span class="c2s-mult-lbl" style="font-size: 0.72rem; color: #06b6d4; font-weight: 700;">Mentees</span>
                    </div>
                    <div class="c2s-mult-box c2s-mult-sec-mentor" style="text-align: center; flex: 1; padding: 0.5rem; background: #fffbeb; border-radius: 6px; border: 1px solid #fde68a;">
                        <span class="c2s-mult-val" style="font-size: 1.25rem; font-weight: 800; color: #d97706; display: block;">${g.secondary_mentors_count !== undefined ? g.secondary_mentors_count : members.filter(m => m.designation === 'Secondary Mentor').length}</span>
                        <span class="c2s-mult-lbl" style="font-size: 0.72rem; color: #f59e0b; font-weight: 700;">2nd Mentors</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Participants Roster Table -->
        <div style="margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <h4 style="margin: 0; color: var(--navy); font-size: 1.1rem; font-weight: 700;">
                    <i class="fa-solid fa-users text-amber-600 mr-2"></i> Discipleship Cell Group Participants
                </h4>
                <span class="text-xs text-slate-500">${members.length + 1} Total Participants</span>
            </div>

            <div class="overflow-x-auto" style="border: 1px solid var(--border-color); border-radius: 8px;">
                <table class="w-full text-sm text-left">
                    <thead class="bg-slate-50 text-slate-600 uppercase text-xs">
                        <tr>
                            <th class="p-3">Participant</th>
                            <th class="p-3">Group Designation</th>
                            <th class="p-3">Contact</th>
                            <th class="p-3">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <!-- Primary Mentor Row -->
                        <tr style="background: #fffdf5;">
                            <td class="p-3">
                                <div style="display: flex; align-items: center; gap: 0.65rem;">
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; overflow: hidden; flex-shrink: 0;">
                                        ${g.leader_profile_image ? `<img src="${escapeHtml(g.leader_profile_image)}" alt="" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='${g.leader_name ? g.leader_name.charAt(0).toUpperCase() : 'M'}';">` : (g.leader_name ? g.leader_name.charAt(0).toUpperCase() : 'M')}
                                    </div>
                                    <div>
                                        <strong style="color: var(--navy); display: block;">${escapeHtml(g.leader_name || 'Assigned Mentor')}</strong>
                                        <span class="text-xs text-slate-400">Primary Leader & Mentor</span>
                                    </div>
                                </div>
                            </td>
                            <td class="p-3">
                                <span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 700; border: 1px solid #fde68a;">
                                    <i class="fa-solid fa-crown mr-1"></i> Primary Mentor
                                </span>
                            </td>
                            <td class="p-3 text-xs text-slate-600">
                                <div><i class="fa-solid fa-phone mr-1 text-slate-400"></i> ${escapeHtml(g.leader_contact || 'N/A')}</div>
                                <div><i class="fa-solid fa-envelope mr-1 text-slate-400"></i> ${escapeHtml(g.leader_email || 'N/A')}</div>
                            </td>
                            <td class="p-3">
                                <span class="badge" style="background: #ecfdf5; color: #059669; font-size: 0.75rem;">Active</span>
                            </td>
                        </tr>

                        <!-- Mentees & Secondary Mentors -->
                        ${members.length === 0 ? `
                            <tr><td colspan="4" class="p-4 text-center text-slate-400">No other mentees added to this group yet.</td></tr>
                        ` : members.map(m => {
                            const isSec = m.designation === 'Secondary Mentor';
                            return `
                                <tr>
                                    <td class="p-3">
                                        <div style="display: flex; align-items: center; gap: 0.65rem;">
                                            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${isSec ? '#f3e8ff' : '#f1f5f9'}; color: ${isSec ? '#7e22ce' : '#475569'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; overflow: hidden; flex-shrink: 0;">
                                                ${m.profile_image ? `<img src="${escapeHtml(m.profile_image)}" alt="" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='${m.full_name ? m.full_name.charAt(0).toUpperCase() : 'M'}';">` : (m.full_name ? m.full_name.charAt(0).toUpperCase() : 'M')}
                                            </div>
                                            <div>
                                                <strong style="color: var(--navy); display: block;">${escapeHtml(m.full_name || `${m.first_name} ${m.last_name}`)}</strong>
                                                ${isSec ? `<span class="text-xs text-purple-600 font-semibold"><i class="fa-solid fa-share-nodes mr-1"></i>Spun off: ${escapeHtml(m.leads_group_name || 'Own Cell Group')}</span>` : `<span class="text-xs text-slate-400">Mentee</span>`}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="p-3">
                                        ${isSec ? `
                                            <span class="badge" style="background: #f3e8ff; color: #6b21a8; font-weight: 700; border: 1px solid #e9d5ff;">
                                                <i class="fa-solid fa-people-arrows mr-1"></i> Secondary Mentor
                                            </span>
                                        ` : `
                                            <span class="badge" style="background: #eff6ff; color: #1e40af; font-weight: 600; border: 1px solid #bfdbfe;">
                                                <i class="fa-solid fa-user-group mr-1"></i> Mentee
                                            </span>
                                        `}
                                    </td>
                                    <td class="p-3 text-xs text-slate-600">
                                        <div><i class="fa-solid fa-phone mr-1 text-slate-400"></i> ${escapeHtml(m.contact_number || 'N/A')}</div>
                                        <div><i class="fa-solid fa-envelope mr-1 text-slate-400"></i> ${escapeHtml(m.email || 'N/A')}</div>
                                    </td>
                                    <td class="p-3">
                                        <span class="badge" style="background: #ecfdf5; color: #059669; font-size: 0.75rem;">Active</span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Discipleship Weekly Study & Prayer Guide -->
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                <h4 style="margin: 0; color: var(--navy); font-size: 1.1rem; font-weight: 700;">
                    <i class="fa-solid fa-book-bible text-amber-600 mr-2"></i> Weekly Small Group Discipleship Guide
                </h4>
                <span class="badge" style="background: #fef3c7; color: #92400e; font-weight: 700;">Lesson 4: Abiding in Christ</span>
            </div>
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem;">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Key Scripture Passage</span>
                <p style="font-size: 0.95rem; color: #1e293b; font-style: italic; margin-bottom: 0.5rem;">
                    "I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing."
                </p>
                <span class="text-xs font-semibold text-amber-700 block text-right">— John 15:5 (NIV)</span>
            </div>
            <div>
                <strong style="color: var(--navy); font-size: 0.85rem; display: block; margin-bottom: 0.4rem;">Small Group Discussion & Reflection:</strong>
                <ul style="margin: 0 0 1rem 1.25rem; font-size: 0.85rem; color: #475569; line-height: 1.7;">
                    <li>What practical spiritual habits help you abide in Christ during busy work or family weeks?</li>
                    <li>How does our C2S small group hold one another accountable in love and prayer?</li>
                    <li>Who is one unchurched friend or colleague you can invite to our next fellowship?</li>
                </ul>
            </div>
        </div>
    `;
}

function renderMemberC2SDirectory(groups) {
    const tbody = document.getElementById('memberC2SDirectoryBody');
    if (!tbody) return;

    if (groups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-slate-400">No C2S cell groups found.</td></tr>';
        return;
    }

    tbody.innerHTML = groups.map(g => {
        const timeStr = g.meeting_time ? formatTime(g.meeting_time) : '';
        const size = g.total_size || g.total_members_count || 1;
        return `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="p-4" style="vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <div style="width: 36px; height: 36px; border-radius: 8px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
                            <i class="fa-solid fa-people-roof"></i>
                        </div>
                        <div>
                            <strong style="color: var(--navy); font-size: 0.95rem; display: block;">${escapeHtml(g.group_name)}</strong>
                            <span class="text-xs text-slate-500">${escapeHtml(g.description ? g.description.slice(0, 45) + '...' : 'Discipleship cell group')}</span>
                        </div>
                    </div>
                </td>
                <td class="p-4" style="vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <div style="width: 34px; height: 34px; border-radius: 50%; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; overflow: hidden; flex-shrink: 0;">
                            ${g.leader_profile_image ? `<img src="${escapeHtml(g.leader_profile_image)}" alt="" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='${g.leader_name ? g.leader_name.charAt(0).toUpperCase() : 'M'}';">` : (g.leader_name ? g.leader_name.charAt(0).toUpperCase() : 'M')}
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--navy);">${escapeHtml(g.leader_name || 'Assigned Mentor')}</div>
                            <span class="text-xs text-slate-400">${escapeHtml(g.leader_contact || 'COGWM Imus')}</span>
                        </div>
                    </div>
                </td>
                <td class="p-4 text-xs" style="vertical-align: middle; color: #334155;">
                    <div style="font-weight: 600;"><i class="fa-regular fa-calendar mr-1 text-slate-400"></i> ${escapeHtml(g.meeting_day || 'Weekly')}</div>
                    <div><i class="fa-regular fa-clock mr-1 text-slate-400"></i> ${timeStr || 'Schedule TBA'}</div>
                </td>
                <td class="p-4 text-xs" style="vertical-align: middle; color: #475569;">
                    <i class="fa-solid fa-location-dot text-red-500 mr-1"></i> ${escapeHtml(g.meeting_location || 'COGWM Sanctuary')}
                </td>
                <td class="p-4 text-center" style="vertical-align: middle;">
                    <span class="badge" style="background: #f1f5f9; color: var(--navy); font-weight: 700; font-size: 0.8rem; padding: 3px 8px;">
                        ${size} Members
                    </span>
                </td>
                <td class="p-4 text-right" style="vertical-align: middle;">
                    <button type="button" class="btn-secondary btn-sm" onclick="openMemberC2SDetailsModal(${g.group_id})" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
                        <i class="fa-solid fa-eye mr-1"></i> View Roster
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterMemberC2SDirectory() {
    const q = (document.getElementById('memberC2SSearch')?.value || '').toLowerCase().trim();
    const day = (document.getElementById('memberC2SDayFilter')?.value || '').trim();

    let filtered = [...allC2SGroupsCache];
    if (day) {
        filtered = filtered.filter(g => g.meeting_day && g.meeting_day.toLowerCase() === day.toLowerCase());
    }
    if (q) {
        filtered = filtered.filter(g => 
            (g.group_name && g.group_name.toLowerCase().includes(q)) ||
            (g.leader_name && g.leader_name.toLowerCase().includes(q)) ||
            (g.meeting_location && g.meeting_location.toLowerCase().includes(q))
        );
    }
    renderMemberC2SDirectory(filtered);
}

async function openMemberC2SDetailsModal(groupId) {
    try {
        const res = await api.c2s.getById(groupId);
        const g = res.data;
        if (!g) return;

        document.getElementById('c2sDetailGroupName').textContent = g.group_name;
        const body = document.getElementById('c2sDetailModalBody');
        const members = g.members || [];

        body.innerHTML = `
            <div style="background: #f8fafc; border-radius: 8px; padding: 1.25rem; border: 1px solid var(--border-color); margin-bottom: 1.25rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
                    <div>
                        <span class="text-xs text-slate-400 block font-semibold mb-1">Primary Mentor</span>
                        <div style="display: flex; align-items: center; gap: 0.65rem;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; overflow: hidden; flex-shrink: 0;">
                                ${g.leader_profile_image ? `<img src="${escapeHtml(g.leader_profile_image)}" alt="" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='${g.leader_name ? g.leader_name.charAt(0).toUpperCase() : 'M'}';">` : (g.leader_name ? g.leader_name.charAt(0).toUpperCase() : 'M')}
                            </div>
                            <strong style="color: var(--navy); font-size: 0.95rem;">${escapeHtml(g.leader_name || 'Assigned Mentor')}</strong>
                        </div>
                    </div>
                    <div>
                        <span class="text-xs text-slate-400 block font-semibold mb-1">Meeting Schedule</span>
                        <strong style="color: var(--navy); font-size: 0.95rem;"><i class="fa-regular fa-clock mr-1 text-slate-500"></i> ${escapeHtml(g.meeting_day || 'Weekly')} ${g.meeting_time ? formatTime(g.meeting_time) : ''}</strong>
                    </div>
                    <div style="grid-column: span 2;">
                        <span class="text-xs text-slate-400 block font-semibold">Venue / Platform</span>
                        <span style="color: #334155;"><i class="fa-solid fa-location-dot text-red-500 mr-1"></i> ${escapeHtml(g.meeting_location || 'Sanctuary')}</span>
                    </div>
                </div>
            </div>

            <h4 style="margin: 0 0 0.5rem; color: var(--navy); font-size: 0.95rem; font-weight: 700;">Group Participants (${members.length + 1} Total)</h4>
            <div class="overflow-x-auto" style="border: 1px solid var(--border-color); border-radius: 8px; max-height: 260px;">
                <table class="w-full text-xs text-left">
                    <thead class="bg-slate-50 text-slate-600 uppercase">
                        <tr>
                            <th class="p-2.5">Name</th>
                            <th class="p-2.5">Designation</th>
                            <th class="p-2.5">Contact</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr style="background: #fffdf5;">
                            <td class="p-2.5 font-bold text-slate-900">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <div style="width: 24px; height: 24px; border-radius: 50%; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; overflow: hidden; flex-shrink: 0;">
                                        ${g.leader_profile_image ? `<img src="${escapeHtml(g.leader_profile_image)}" alt="" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='${g.leader_name ? g.leader_name.charAt(0).toUpperCase() : 'M'}';">` : (g.leader_name ? g.leader_name.charAt(0).toUpperCase() : 'M')}
                                    </div>
                                    <span>${escapeHtml(g.leader_name || 'Mentor')}</span>
                                </div>
                            </td>
                            <td class="p-2.5"><span class="badge c2s-badge-mentor">Primary Mentor</span></td>
                            <td class="p-2.5 text-slate-500">${escapeHtml(g.leader_contact || 'N/A')}</td>
                        </tr>
                        ${members.map(m => `
                            <tr>
                                <td class="p-2.5 font-medium text-slate-800">
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <div style="width: 24px; height: 24px; border-radius: 50%; background: ${m.designation === 'Secondary Mentor' ? '#fffbeb' : '#f1f5f9'}; color: ${m.designation === 'Secondary Mentor' ? '#92400e' : '#475569'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; overflow: hidden; flex-shrink: 0;">
                                            ${m.profile_image ? `<img src="${escapeHtml(m.profile_image)}" alt="" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='${m.full_name ? m.full_name.charAt(0).toUpperCase() : 'M'}';">` : (m.full_name ? m.full_name.charAt(0).toUpperCase() : 'M')}
                                        </div>
                                        <span>${escapeHtml(m.full_name || `${m.first_name} ${m.last_name}`)}</span>
                                    </div>
                                </td>
                                <td class="p-2.5">
                                    <span class="badge ${m.designation === 'Secondary Mentor' ? 'c2s-badge-sec-mentor' : 'c2s-badge-mentee'}">
                                        ${escapeHtml(m.designation || 'Mentee')}
                                    </span>
                                </td>
                                <td class="p-2.5 text-slate-500">${escapeHtml(m.contact_number || 'N/A')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const modal = document.getElementById('memberC2SDetailsModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    } catch (e) {
        showToast('Error loading group details: ' + e.message);
    }
}

function closeMemberC2SDetailsModal() {
    const m = document.getElementById('memberC2SDetailsModal');
    if (m) {
        m.classList.remove('active');
        m.style.display = '';
        m.style.removeProperty('display');
    }
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    try {
        const parts = timeStr.split(':');
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1] || '00';
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    } catch (e) {
        return timeStr;
    }
}

// ============================================================
// EVENTS & SEMINARY MODULE
// ============================================================
async function populateMemberEventMinistryFilter() {
    const select = document.getElementById('memberEventMinistryFilter');
    if (!select) return;
    try {
        const res = await api.ministries.getAll();
        const ministries = res.data || [];
        const curVal = select.value;
        let opts = '<option value="">All Ministries</option>';
        ministries.forEach(m => {
            opts += `<option value="${escapeHtml(m.ministry_name)}">${escapeHtml(m.ministry_name)}</option>`;
        });
        select.innerHTML = opts;
        select.value = curVal;
    } catch (e) {
        const unique = [...new Set(allMemberEventsCache.map(e => e.ministry_name).filter(Boolean))].sort();
        let opts = '<option value="">All Ministries</option>';
        unique.forEach(name => {
            opts += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
        });
        select.innerHTML = opts;
    }
}

let memberEventArchivesMode = false;

async function toggleMemberEventArchives(btn) {
    memberEventArchivesMode = !memberEventArchivesMode;
    const archBtn = btn || document.getElementById('btnMemberEventArchives');
    if (archBtn) {
        if (memberEventArchivesMode) {
            archBtn.parentElement.querySelectorAll('.dept-pill').forEach(p => p.classList.remove('active'));
            archBtn.classList.add('active');
            archBtn.style.background = '#0E2A4F';
            archBtn.style.color = '#ffffff';
            archBtn.style.borderColor = '#0E2A4F';
            archBtn.innerHTML = '<i class="fa-solid fa-calendar-days mr-1"></i> Active Events';
        } else {
            archBtn.classList.remove('active');
            archBtn.style.background = '';
            archBtn.style.color = '';
            archBtn.style.borderColor = '#cbd5e1';
            archBtn.innerHTML = '<i class="fa-solid fa-box-archive mr-1"></i> Event Archives';
            const allPill = document.querySelector('.dept-pills-wrap .dept-pill');
            if (allPill) allPill.classList.add('active');
        }
    }
    await loadEvents();
}

async function loadEvents() {
    try {
        const params = memberEventArchivesMode ? { archived: 1 } : {};
        const [eventsRes, enrollRes] = await Promise.all([
            api.events.getAll(params),
            api.events.getMyEnrollments().catch(() => ({ data: [] }))
        ]);

        myEnrollmentIds = new Set((enrollRes.data || []).map(en => en.event_id));
        allMemberEventsCache = eventsRes.data || [];

        // Update Stat Counters
        const totalEl = document.getElementById('eventsStatTotal');
        const semEl = document.getElementById('eventsStatSeminary');
        const enrEl = document.getElementById('eventsStatEnrolled');

        const activeUpcoming = allMemberEventsCache.filter(e => e.status === 'Upcoming' || e.status === 'Ongoing');
        if (totalEl) totalEl.textContent = activeUpcoming.length;
        if (semEl) semEl.textContent = activeUpcoming.filter(e => (e.event_type || '').toLowerCase() === 'seminary').length;
        if (enrEl) enrEl.textContent = myEnrollmentIds.size;

        await populateMemberEventMinistryFilter();
        applyMemberEventFilters();
    } catch (error) {
        showToast('Error loading events: ' + error.message);
    }
}

function filterMemberEventType(type, btnEl) {
    if (memberEventArchivesMode) {
        memberEventArchivesMode = false;
        const archBtn = document.getElementById('btnMemberEventArchives');
        if (archBtn) {
            archBtn.classList.remove('active');
            archBtn.style.background = '';
            archBtn.style.color = '';
            archBtn.style.borderColor = '#cbd5e1';
            archBtn.innerHTML = '<i class="fa-solid fa-box-archive mr-1"></i> Event Archives';
        }
        currentEventFilterType = type;
        if (btnEl) {
            btnEl.parentElement.querySelectorAll('.dept-pill').forEach(p => p.classList.remove('active'));
            btnEl.classList.add('active');
        }
        loadEvents();
        return;
    }
    currentEventFilterType = type;
    if (btnEl) {
        btnEl.parentElement.querySelectorAll('.dept-pill').forEach(p => p.classList.remove('active'));
        btnEl.classList.add('active');
    }
    applyMemberEventFilters();
}

function filterMemberEvents() {
    applyMemberEventFilters();
}

function resetMemberEventFilters() {
    const s = document.getElementById('memberEventSearch');
    const d = document.getElementById('memberEventDeptFilter');
    const m = document.getElementById('memberEventMinistryFilter');
    const st = document.getElementById('memberEventStatusFilter');
    if (s) s.value = '';
    if (d) d.value = '';
    if (m) m.value = '';
    if (st) st.value = '';
    currentEventFilterType = 'All';
    document.querySelectorAll('.dept-pills-wrap .dept-pill').forEach((btn, idx) => {
        if (idx === 0) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    applyMemberEventFilters();
}

function applyMemberEventFilters() {
    const q = (document.getElementById('memberEventSearch')?.value || '').toLowerCase().trim();
    const dept = (document.getElementById('memberEventDeptFilter')?.value || '').trim();
    const ministry = (document.getElementById('memberEventMinistryFilter')?.value || '').trim();
    const status = (document.getElementById('memberEventStatusFilter')?.value || '').trim();

    let filtered = [...allMemberEventsCache];

    // Pill Filter
    if (currentEventFilterType === 'Seminary') {
        filtered = filtered.filter(e => (e.event_type || '').toLowerCase() === 'seminary');
    } else if (currentEventFilterType === 'Worship') {
        filtered = filtered.filter(e => (e.event_type || '').toLowerCase().includes('worship'));
    } else if (currentEventFilterType === 'Enrolled') {
        filtered = filtered.filter(e => myEnrollmentIds.has(e.event_id));
    }

    // Department Filter
    if (dept) {
        filtered = filtered.filter(e => e.department && e.department.toLowerCase() === dept.toLowerCase());
    }

    // Ministry Filter
    if (ministry) {
        filtered = filtered.filter(e => e.ministry_name && e.ministry_name.toLowerCase() === ministry.toLowerCase());
    }

    // Status Filter
    if (status) {
        filtered = filtered.filter(e => (e.status || 'Upcoming').toLowerCase() === status.toLowerCase());
    }

    // Text Search
    if (q) {
        filtered = filtered.filter(e => 
            (e.title && e.title.toLowerCase().includes(q)) ||
            (e.event_type && e.event_type.toLowerCase().includes(q)) ||
            (e.venue && e.venue.toLowerCase().includes(q)) ||
            (e.speaker && e.speaker.toLowerCase().includes(q)) ||
            (e.department && e.department.toLowerCase().includes(q)) ||
            (e.ministry_name && e.ministry_name.toLowerCase().includes(q))
        );
    }

    renderMemberEvents(filtered);
}

function renderMemberEvents(events) {
    const tbody = document.getElementById('eventsTableBody');
    if (!tbody) return;

    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-slate-400">No events or seminary courses found matching your filter.</td></tr>';
        return;
    }

    tbody.innerHTML = events.map(e => {
        const isEnrolled = myEnrollmentIds.has(e.event_id);
        const isSeminary = (e.event_type || '').toLowerCase() === 'seminary';
        let actionBtn = '';

        if (isEnrolled) {
            actionBtn = `
                <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
                    <span class="badge" style="background: #ecfdf5; color: #065f46; font-size: 0.78rem; font-weight: 700; border: 1px solid #a7f3d0; padding: 3px 7px;">
                        <i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i> Enrolled
                    </span>
                    <button type="button" class="btn-secondary btn-sm" onclick="cancelEventEnrollment(${e.event_id})" title="Cancel your enrollment" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; color: #dc2626; border-color: #fca5a5;">
                        <i class="fa-solid fa-xmark mr-1"></i> Cancel
                    </button>
                </div>
            `;
        } else if (e.is_archived == 1) {
            actionBtn = '<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.75rem;"><i class="fa-solid fa-box-archive mr-1"></i> Archived</span>';
        } else if (e.is_enrollment_open == 1 && e.status !== 'Completed' && e.status !== 'Cancelled') {
            actionBtn = `<button class="btn-primary" style="padding: 0.35rem 0.85rem; font-size: 0.8rem;" onclick="enrollEvent(${e.event_id})"><i class="fa-solid fa-plus mr-1"></i> Enroll</button>`;
        } else {
            actionBtn = '<span class="badge badge-inactive">Closed</span>';
        }

        const dateStr = e.start_datetime ? new Date(e.start_datetime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBA';

        return `
            <tr style="transition: background 0.15s ease;" class="hover:bg-slate-50 border-b border-slate-100">
                <td class="p-4" style="vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 38px; height: 38px; border-radius: 8px; background: ${isSeminary ? '#fef3c7' : '#eff6ff'}; color: ${isSeminary ? '#b45309' : '#2563eb'}; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
                            <i class="fa-solid ${isSeminary ? 'fa-graduation-cap' : 'fa-calendar-day'}"></i>
                        </div>
                        <div>
                            <span style="color: var(--navy); font-size: 0.95rem; font-weight: 700; display: block;">${escapeHtml(e.title)}</span>
                            ${e.speaker ? `<span class="text-xs text-slate-500"><i class="fa-solid fa-user-tie mr-1 text-slate-400"></i>${escapeHtml(e.speaker)}</span>` : ''}
                        </div>
                    </div>
                </td>
                <td class="p-4" style="vertical-align: middle;">
                    <span class="badge ${getDeptBadgeClass(e.department)} font-medium">
                        ${escapeHtml(e.department || 'General')}
                    </span>
                </td>
                <td class="p-4" style="vertical-align: middle;">
                    <span class="badge ${e.ministry_name ? 'badge-ministry-pill' : 'badge-inactive'} font-medium">
                        ${escapeHtml(e.ministry_name || 'General Church')}
                    </span>
                </td>
                <td class="p-4" style="vertical-align: middle;">
                    <span class="badge" style="${isSeminary ? 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a;' : 'background: #f1f5f9; color: var(--navy); border: 1px solid #e2e8f0;'} font-weight: 600;">
                        ${escapeHtml(e.event_type || 'Event')}
                    </span>
                </td>
                <td class="p-4 text-xs" style="vertical-align: middle; color: var(--text-dark);">
                    <div style="font-weight: 600; color: #1e293b;"><i class="fa-regular fa-clock text-slate-400 mr-1"></i> ${dateStr}</div>
                </td>
                <td class="p-4 text-xs" style="vertical-align: middle; color: var(--text-dark);">
                    <div style="color: #475569;"><i class="fa-solid fa-location-dot text-amber-600 mr-1"></i> ${escapeHtml(e.venue || 'Sanctuary')}</div>
                </td>
                <td class="p-4" style="vertical-align: middle;">
                    ${getEventStatusBadge(e.status)}
                </td>
                <td class="p-4 text-right" style="vertical-align: middle;">
                    <div style="display: inline-flex; align-items: center; gap: 0.5rem; justify-content: flex-end;">
                        <button type="button" class="btn-secondary btn-sm" onclick="openMemberEventDetailModal(${e.event_id})" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;">
                            <i class="fa-solid fa-circle-info mr-1"></i> Details
                        </button>
                        ${actionBtn}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openMemberEventDetailModal(eventId) {
    const e = allMemberEventsCache.find(x => x.event_id === eventId);
    if (!e) return;

    const isSeminary = (e.event_type || '').toLowerCase() === 'seminary';
    const isEnrolled = myEnrollmentIds.has(e.event_id);

    const bannerEl = document.getElementById('memberEventModalBanner');
    if (bannerEl) {
        if (e.banner_image) {
            bannerEl.style.backgroundImage = `linear-gradient(to bottom, rgba(6, 23, 48, 0.5), rgba(6, 23, 48, 0.9)), url('${encodeURI(e.banner_image)}')`;
            bannerEl.style.backgroundSize = 'cover';
            bannerEl.style.backgroundPosition = 'center';
        } else {
            bannerEl.style.backgroundImage = 'linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%)';
        }
    }

    const typeBadge = document.getElementById('memberModalEventTypeBadge');
    if (typeBadge) {
        typeBadge.textContent = e.event_type || 'Gathering';
        typeBadge.style.background = isSeminary ? 'rgba(217, 119, 6, 0.95)' : 'rgba(37, 99, 235, 0.95)';
    }

    const statusBadge = document.getElementById('memberModalEventStatusBadge');
    if (statusBadge) statusBadge.innerHTML = getEventStatusBadge(e.status);

    const enrollBadge = document.getElementById('memberModalEventEnrollBadge');
    if (enrollBadge) {
        enrollBadge.innerHTML = e.is_enrollment_open == 1
            ? '<span class="badge" style="background: #10b981; color: #fff; font-size: 0.72rem; padding: 3px 8px; border-radius: 9999px;"><i class="fa-solid fa-circle-check mr-1"></i> Open</span>'
            : '<span class="badge" style="background: #64748b; color: #fff; font-size: 0.72rem; padding: 3px 8px; border-radius: 9999px;">Closed</span>';
    }

    const titleEl = document.getElementById('memberModalEventTitle');
    if (titleEl) titleEl.textContent = e.title;

    const startDate = e.start_datetime ? new Date(e.start_datetime) : null;
    const endDate = e.end_datetime ? new Date(e.end_datetime) : null;
    const startStr = startDate ? startDate.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD';
    const endStr = endDate ? endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
    const schedEl = document.getElementById('memberModalEventSchedule');
    if (schedEl) schedEl.textContent = `${startStr}${endStr ? ' - ' + endStr : ''}`;

    const locEl = document.getElementById('memberModalEventLocation');
    if (locEl) locEl.textContent = e.venue || e.location || 'Church Main Sanctuary / Imus Campus';

    const deptEl = document.getElementById('memberModalEventDept');
    if (deptEl) deptEl.innerHTML = `<span class="badge ${getDeptBadgeClass(e.department)}">${escapeHtml(e.department || 'General Church')}</span>`;

    const minEl = document.getElementById('memberModalEventMinistry');
    if (minEl) minEl.innerHTML = `<span class="badge ${e.ministry_name ? 'badge-ministry-pill' : 'badge-inactive'}">${escapeHtml(e.ministry_name || 'General Church')}</span>`;

    const spkEl = document.getElementById('memberModalEventSpeaker');
    if (spkEl) spkEl.textContent = e.organizer || e.speaker || (isSeminary ? 'Theological Instructor' : 'Church Leadership');

    const descEl = document.getElementById('memberModalEventDesc');
    if (descEl) descEl.textContent = e.description || (isSeminary ? 'Open to all church members aspiring to grow in doctrine, biblical exposition, and ministry leadership.' : 'Join us for this church gathering and fellowship as we grow together in faith and community.');

    const enrollTextEl = document.getElementById('memberModalEventEnrollmentText');
    if (enrollTextEl) {
        if (isEnrolled) {
            enrollTextEl.innerHTML = '<span style="color: #059669; font-weight: 700;"><i class="fa-solid fa-circle-check mr-1"></i> You are actively enrolled in this event/seminary.</span>';
        } else if (e.is_enrollment_open == 1 && e.status !== 'Completed' && e.status !== 'Cancelled') {
            enrollTextEl.innerHTML = 'Registration is open. Click "Confirm Enrollment" below to reserve your slot.';
        } else {
            enrollTextEl.innerHTML = 'Enrollment is currently closed for this event.';
        }
    }

    const actionSlot = document.getElementById('memberModalActionSlot');
    if (actionSlot) {
        if (isEnrolled) {
            actionSlot.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.65rem;">
                    <span class="badge" style="background: #ecfdf5; color: #065f46; font-size: 0.85rem; font-weight: 700; padding: 0.45rem 0.9rem;">
                        <i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i> You are Enrolled
                    </span>
                    <button type="button" class="btn-secondary" onclick="cancelEventEnrollment(${e.event_id})" style="color: #dc2626; border-color: #fca5a5; padding: 0.45rem 0.9rem; font-size: 0.85rem;">
                        <i class="fa-solid fa-calendar-xmark mr-1"></i> Cancel Enrollment
                    </button>
                </div>
            `;
        } else if (e.is_enrollment_open == 1 && e.status !== 'Completed' && e.status !== 'Cancelled') {
            actionSlot.innerHTML = `<button type="button" class="btn-primary" onclick="enrollEvent(${e.event_id})"><i class="fa-solid fa-calendar-plus mr-1"></i> Confirm Enrollment</button>`;
        } else {
            actionSlot.innerHTML = '<span class="badge badge-inactive">Enrollment Closed</span>';
        }
    }

    const modal = document.getElementById('memberEventDetailModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function closeMemberEventDetailModal() {
    const modal = document.getElementById('memberEventDetailModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

async function enrollEvent(id) {
    const ev = allMemberEventsCache.find(x => x.event_id === id);
    const title = ev ? ev.title : 'this event';
    const ok = await showDecisionModal({
        title: 'Enroll in Event / Seminary',
        message: `Are you sure you want to enroll in "${title}"?`,
        confirmText: 'Yes, Enroll Me',
        cancelText: 'Cancel',
        type: 'info',
        icon: 'fa-user-graduate'
    });
    if (!ok) return;

    try {
        await api.events.enroll(id, {});
        showToast('Successfully enrolled in event!');
        closeMemberEventDetailModal();
        await loadEvents();
        await loadDashboardMetrics();
    } catch (error) {
        showToast('Enrollment failed: ' + error.message);
    }
}

async function cancelEventEnrollment(id) {
    const ev = allMemberEventsCache.find(x => x.event_id === id);
    const title = ev ? ev.title : 'this event';
    const ok = await showDecisionModal({
        title: 'Cancel Enrollment',
        message: `Are you sure you want to cancel your enrollment in "${title}"?\n\nYou can re-enroll later if registration remains open.`,
        confirmText: 'Yes, Cancel Enrollment',
        cancelText: 'Keep Enrolled',
        type: 'danger',
        icon: 'fa-calendar-xmark'
    });
    if (!ok) return;

    try {
        await api.events.cancelEnrollment(id);
        showToast('Enrollment successfully cancelled.');
        closeMemberEventDetailModal();
        await loadEvents();
        await loadDashboardMetrics();
    } catch (error) {
        showToast('Failed to cancel enrollment: ' + (error.message || error));
    }
}

// ============================================================
// ANNOUNCEMENTS MODULE
// ============================================================
let memberLastSeenAnnouncementId = 0;
let memberAnnouncementsPollTimer = null;

async function checkMemberAnnouncementsNotifications() {
    try {
        const res = await api.announcements.getAll();
        const announcements = res.data || [];
        if (!announcements || announcements.length === 0) return;

        const maxId = Math.max(...announcements.map(a => Number(a.announcement_id) || 0));
        const storedLastSeen = Number(localStorage.getItem('cog_member_last_seen_ann_id') || 0);

        if (memberLastSeenAnnouncementId === 0) {
            memberLastSeenAnnouncementId = storedLastSeen > 0 ? storedLastSeen : maxId;
            if (!storedLastSeen) {
                localStorage.setItem('cog_member_last_seen_ann_id', String(maxId));
            }
            return;
        }

        if (maxId > memberLastSeenAnnouncementId) {
            const newAnns = announcements.filter(a => Number(a.announcement_id) > memberLastSeenAnnouncementId);
            memberLastSeenAnnouncementId = maxId;

            // Show notification dot on member sidebar
            const dot = document.getElementById('memberAnnounceNavDot');
            if (dot) dot.style.display = 'block';

            // Play announcement chime sound
            playPortalNotificationSound('announcement');

            // Display toast
            const latest = newAnns[0];
            showToast(`📢 New Church Announcement: "${escapeHtml(latest.title || '')}"`);

            // If announcements view is active, refresh view
            const currentView = document.querySelector('.view.active')?.id;
            if (currentView === 'view-announcements') {
                allMemberAnnouncementsCache = announcements;
                applyMemberAnnouncementFilters();
            }
        }
    } catch (err) {
        // silent background poll
    }
}

function initMemberAnnouncementsNotifier() {
    if (memberAnnouncementsPollTimer) clearInterval(memberAnnouncementsPollTimer);
    checkMemberAnnouncementsNotifications();
    memberAnnouncementsPollTimer = setInterval(checkMemberAnnouncementsNotifications, 12000);
}

async function loadAnnouncements() {
    try {
        const res = await api.announcements.getAll();
        allMemberAnnouncementsCache = res.data || [];

        // Check for urgent announcement spotlight
        const urgent = allMemberAnnouncementsCache.find(a => (a.category || '').toLowerCase().includes('urgent'));
        const spotlightEl = document.getElementById('urgentAnnouncementSpotlight');
        if (spotlightEl) {
            if (urgent) {
                spotlightEl.style.display = 'block';
                spotlightEl.innerHTML = `
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 5px solid #dc2626; border-radius: 8px; padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <div>
                            <span class="badge" style="background: #dc2626; color: #ffffff; font-weight: 700; font-size: 0.75rem; margin-bottom: 0.35rem; display: inline-block;">
                                <i class="fa-solid fa-triangle-exclamation mr-1"></i> URGENT CHURCH NOTICE
                            </span>
                            <h3 style="margin: 0 0 0.25rem; color: #991b1b; font-size: 1.15rem;">${escapeHtml(urgent.title)}</h3>
                            <p style="margin: 0; color: #7f1d1d; font-size: 0.9rem;">${escapeHtml(urgent.content.slice(0, 140))}${urgent.content.length > 140 ? '...' : ''}</p>
                        </div>
                        <button type="button" class="btn-primary" onclick="openMemberAnnouncementReaderModal(${urgent.announcement_id})" style="background: #dc2626; border-color: #dc2626; padding: 0.5rem 1rem; font-size: 0.85rem;">
                            Read Full Notice
                        </button>
                    </div>
                `;
            } else {
                spotlightEl.style.display = 'none';
            }
        }

        applyMemberAnnouncementFilters();
    } catch (error) {
        showToast('Error loading announcements: ' + error.message);
    }
}

function filterMemberAnnCategory(cat, btnEl) {
    currentAnnCategoryFilter = cat;
    if (btnEl) {
        btnEl.parentElement.querySelectorAll('.dept-pill').forEach(p => p.classList.remove('active'));
        btnEl.classList.add('active');
    }
    applyMemberAnnouncementFilters();
}

function filterMemberAnnouncements() {
    applyMemberAnnouncementFilters();
}

function applyMemberAnnouncementFilters() {
    const q = (document.getElementById('memberAnnSearch')?.value || '').toLowerCase().trim();
    let filtered = [...allMemberAnnouncementsCache];

    if (currentAnnCategoryFilter) {
        filtered = filtered.filter(a => a.category && a.category.toLowerCase().includes(currentAnnCategoryFilter.toLowerCase()));
    }

    if (q) {
        filtered = filtered.filter(a => 
            (a.title && a.title.toLowerCase().includes(q)) ||
            (a.content && a.content.toLowerCase().includes(q)) ||
            (a.department && a.department.toLowerCase().includes(q))
        );
    }

    renderMemberAnnouncements(filtered);
}

function renderMemberAnnouncements(list) {
    const container = document.getElementById('announcementsList');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = '<p class="text-slate-400" style="padding: 2.5rem 0; text-align: center;">No announcements available matching this filter.</p>';
        return;
    }

    container.innerHTML = list.map(a => {
        const isPinned = a.is_pinned == 1;
        const catClass = getCategoryClass(a.category);
        const dateStr = a.publish_date ? new Date(a.publish_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';
        return `
            <div class="announcement-card-modern" style="padding: 1.5rem; ${isPinned ? 'border-left: 4px solid var(--gold); background: #fffdf5;' : ''}">
                <div class="announcement-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                        ${isPinned ? '<span class="badge" style="background: #fef08a; color: #854d0e; font-size: 0.75rem; font-weight: 700; border: 1px solid #fde68a;"><i class="fa-solid fa-thumbtack mr-1 text-amber-600"></i> Pinned Announcement</span>' : ''}
                        <h3 class="announcement-title" style="margin: 0; font-size: 1.25rem;">${escapeHtml(a.title)}</h3>
                    </div>
                    <span class="category-pill ${catClass}">${escapeHtml(a.category || 'General')}</span>
                </div>
                <div class="announcement-meta" style="display: flex; align-items: center; gap: 1rem; font-size: 0.78rem; color: var(--text-light); margin-bottom: 0.75rem; flex-wrap: wrap;">
                    <span><i class="fa-solid fa-calendar-day" style="color: var(--gold); margin-right: 0.25rem;"></i> ${dateStr}</span>
                    <span><i class="fa-solid fa-users" style="color: #64748b; margin-right: 0.25rem;"></i> Audience: ${escapeHtml(a.target_audience || 'All Members')}</span>
                    ${a.department ? `<span><i class="fa-solid fa-building text-slate-400 mr-1"></i>${escapeHtml(a.department)}</span>` : ''}
                </div>
                <div class="announcement-body" style="font-size: 0.925rem; line-height: 1.6; color: var(--text-dark); margin-bottom: 1rem;">${escapeHtml((a.content || '').length > 250 ? (a.content || '').slice(0, 250) + '...' : (a.content || ''))}</div>
                <div>
                    <button type="button" class="btn-secondary btn-sm" onclick="openMemberAnnouncementReaderModal(${a.announcement_id})" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;">
                        <i class="fa-solid fa-book-open mr-1"></i> Read Full Bulletin
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openMemberAnnouncementReaderModal(id) {
    const a = allMemberAnnouncementsCache.find(x => x.announcement_id === id);
    if (!a) return;

    const pinnedBadgeEl = document.getElementById('annReaderPinnedBadge');
    if (pinnedBadgeEl) {
        pinnedBadgeEl.style.display = a.is_pinned == 1 ? 'inline-flex' : 'none';
    }

    document.getElementById('annReaderCatBadge').textContent = a.category || 'General';
    document.getElementById('annReaderTitle').textContent = a.title;

    const dateStr = a.publish_date ? new Date(a.publish_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';

    const bodyEl = document.getElementById('annReaderBody');
    bodyEl.innerHTML = `
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.825rem; color: var(--text-light); flex-wrap: wrap; gap: 0.5rem;">
            <div><i class="fa-solid fa-calendar-day mr-1 text-amber-600"></i> ${dateStr}</div>
            <div><i class="fa-solid fa-church mr-1 text-blue-600"></i> ${escapeHtml(a.department || 'COGWM Imus Pastoral Office')}</div>
        </div>

        <div style="font-size: 0.975rem; line-height: 1.8; color: #1e293b; white-space: pre-line; margin-bottom: 1.75rem;">${escapeHtml((a.content || '').trim())}</div>

        <div style="background: #f8fafc; border-radius: 8px; padding: 1rem; border-left: 3px solid var(--gold); font-size: 0.85rem; color: #475569;">
            <p style="margin: 0; font-style: italic;">
                "Let the word of Christ dwell in you richly, teaching and admonishing one another in all wisdom, singing psalms and hymns and spiritual songs, with thankfulness in your hearts to God." — Colossians 3:16
            </p>
        </div>
    `;

    const modal = document.getElementById('memberAnnouncementReaderModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function closeMemberAnnouncementReaderModal() {
    const modal = document.getElementById('memberAnnouncementReaderModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.removeProperty('display');
    }
}

// ============================================================
// MY MINISTRY MODULE (INTERCONNECTED WITH WORDA MINISTRY)
// ============================================================
let myMinistriesList = [];
let activeMemberMinistryId = null;
let activeMemberMinistryTeamCache = [];

async function loadMyMinistry() {
    const card = document.getElementById('ministryCard');
    const switcher = document.getElementById('memberMinistrySwitcher');
    if (!card) return;

    card.innerHTML = `
        <div class="card p-8 text-center text-slate-400">
            <i class="fa-solid fa-spinner fa-spin text-2xl mr-2 text-primary"></i> Loading your ministry information...
        </div>
    `;

    try {
        const res = await api.members.getMyMinistry();

        if (!res.data) {
            if (switcher) switcher.style.display = 'none';
            card.innerHTML = `
                <div class="card">
                    <div class="card-header"><h2><i class="fa-solid fa-sitemap" style="color: var(--gold); margin-right: 0.5rem;"></i> My Ministry</h2></div>
                    <div class="p-8 text-center">
                        <div style="width: 70px; height: 70px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: #94a3b8; font-size: 2rem;">
                            <i class="fa-solid fa-sitemap"></i>
                        </div>
                        <h3 style="color: var(--navy); margin-bottom: 0.5rem; font-size: 1.3rem;">Not Assigned to a WORDA Ministry</h3>
                        <p class="text-slate-500" style="max-width: 500px; margin: 0 auto 1.5rem; line-height: 1.6;">
                            Every member has a unique spiritual gift to serve the body of Christ. The WORDA framework encompasses Worship, Outreach, Resource, Discipleship, and Administration ministries. Reach out to your leaders or pastoral staff to join a ministry team!
                        </p>
                        <div style="display: flex; justify-content: center; gap: 0.5rem;">
                            <button type="button" class="btn-primary" onclick="showToast('Please visit the church administration office to get involved in a ministry!')">
                                Inquire to Join Ministry
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Handle both single object and list of ministries
        myMinistriesList = res.data.ministries || [res.data];
        myMinistryCache = res.data;

        // Manage multi-ministry switcher
        if (myMinistriesList.length > 1) {
            if (switcher) switcher.style.display = 'block';
            const pillsContainer = document.getElementById('memberMinistryPills');
            if (pillsContainer) {
                pillsContainer.innerHTML = myMinistriesList.map(m => `
                    <button class="dept-pill ${m.ministry_id == activeMemberMinistryId ? 'active' : ''}" 
                            onclick="selectMemberMinistry(${m.ministry_id})">
                        <i class="fa-solid fa-church mr-1"></i> ${escapeHtml(m.ministry_name)}
                    </button>
                `).join('');
            }
        } else {
            if (switcher) switcher.style.display = 'none';
        }

        // Active ministry ID
        if (!activeMemberMinistryId || !myMinistriesList.some(m => m.ministry_id == activeMemberMinistryId)) {
            activeMemberMinistryId = myMinistriesList[0].ministry_id;
        }

        await renderMemberMinistryDashboard(activeMemberMinistryId);

    } catch (error) {
        console.error('Error loading my ministry:', error);
        card.innerHTML = `
            <div class="card p-8 text-center text-rose-500">
                <i class="fa-solid fa-circle-exclamation text-2xl mb-2 block"></i>
                Failed to load your ministry details: ${escapeHtml(error.message)}
            </div>
        `;
        showToast('Error loading ministry: ' + error.message);
    }
}

async function selectMemberMinistry(minId) {
    activeMemberMinistryId = minId;
    const pillsContainer = document.getElementById('memberMinistryPills');
    if (pillsContainer) {
        pillsContainer.querySelectorAll('.dept-pill').forEach(btn => btn.classList.remove('active'));
        const activeBtn = pillsContainer.querySelector(`button[onclick*="${minId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }
    await renderMemberMinistryDashboard(activeMemberMinistryId);
}

async function renderMemberMinistryDashboard(minId) {
    const card = document.getElementById('ministryCard');
    if (!card) return;

    const m = myMinistriesList.find(x => x.ministry_id == minId) || myMinistriesList[0];
    if (!m) return;

    try {
        const teamRes = await api.ministries.getMembers(minId).catch(() => ({ data: [] }));
        activeMemberMinistryTeamCache = teamRes.data || [];

        const color = m.color_code || '#0E2A4F';
        const distinctRosterRoles = [...new Set(activeMemberMinistryTeamCache.map(mem => (mem.role_in_ministry || '').trim()).filter(Boolean))].sort();
        const isRelationship = (m.department || '').trim().toUpperCase() === 'RELATIONSHIP';

        card.innerHTML = `
            <!-- 1. Executive Ministry Hero Header Card -->
            <div class="ministry-hero-card" style="margin-bottom: 1.5rem;">
                <div class="ministry-hero-header" style="background: linear-gradient(135deg, #061730 0%, ${color} 100%); padding: 2rem 2.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; flex-wrap: wrap;">
                                <span class="badge" style="background: rgba(255,255,255,0.2); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); font-weight: 700;">
                                    ${escapeHtml(m.ministry_code)}
                                </span>
                                <span class="badge" style="background: rgba(201, 169, 97, 0.25); color: #fde68a; border: 1px solid rgba(201, 169, 97, 0.4); font-size: 0.75rem;">
                                    <i class="fa-solid fa-sitemap mr-1"></i> ${escapeHtml(m.department || 'Worship')}
                                </span>
                                <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #a7f3d0; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.75rem;">
                                    <i class="fa-solid fa-circle-check mr-1"></i> Active Member
                                </span>
                            </div>
                            <h2 style="font-size: 2rem; margin: 0 0 0.35rem; color: #ffffff; font-family: 'Cormorant Garamond', serif; font-weight: 700;">
                                ${escapeHtml(m.ministry_name)}
                            </h2>
                            <div style="display: flex; align-items: center; gap: 1.25rem; font-size: 0.875rem; color: rgba(255,255,255,0.9); flex-wrap: wrap; margin-top: 0.35rem;">
                                <span>
                                    <i class="fa-solid fa-user-tag" style="color: var(--gold); margin-right: 0.35rem;"></i>
                                    My Role: <strong>${escapeHtml(m.role_in_ministry || 'Member')}</strong>
                                </span>
                                <span>
                                    <i class="fa-solid fa-user-tie" style="color: var(--gold); margin-right: 0.35rem;"></i>
                                    Leader: <strong>${escapeHtml(m.leader_name || 'Assigned Leader')}</strong>
                                </span>
                                <span>
                                    <i class="fa-regular fa-clock" style="color: var(--gold); margin-right: 0.35rem;"></i>
                                    Schedule: <strong>${escapeHtml(m.meeting_schedule || 'Sunday Services & Midweek')}</strong>
                                </span>
                            </div>
                        </div>

                        <!-- Right Actions & Leader Quick Info -->
                        <div style="display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-end; min-width: 200px;">
                            <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem;">
                                ${m.leader_profile_image 
                                    ? `<img src="${escapeHtml(m.leader_profile_image)}" alt="" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--gold);">`
                                    : `<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--gold); color: #061730; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem;"><i class="fa-solid fa-user-tie"></i></div>`
                                }
                                <div>
                                    <div style="font-size: 0.7rem; color: var(--gold-light); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Ministry Leader</div>
                                    <div style="font-size: 0.9rem; font-weight: 700; color: #ffffff;">${escapeHtml(m.leader_name || 'Leader')}</div>
                                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.7);">${escapeHtml(m.leader_email || m.leader_contact || 'Contact Leader')}</div>
                                </div>
                            </div>
                            <button type="button" class="btn-secondary" onclick="openMemberWorkCalendarModal()" style="background: rgba(255,255,255,0.15); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); font-size: 0.8rem; padding: 0.45rem 0.9rem; width: 100%; justify-content: center;">
                                <i class="fa-solid fa-calendar-days mr-1.5 text-gold"></i> View on Work Calendar
                            </button>
                            ${isRelationship ? `
                            <button type="button" class="btn-primary" onclick="navigateTo('c2s')" style="width: 100%; justify-content: center; font-size: 0.8rem; padding: 0.45rem 0.9rem; background: var(--gold, #d97706); color: #1e293b; border: none; font-weight: 600;">
                                <i class="fa-solid fa-people-roof mr-1.5"></i> View C2S Groups
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. Ministry Overview Cards (matching Admin Dashboard Summary Cards) -->
            <div class="summary-grid mb-6">
                <div class="summary-card ministries">
                    <div class="card-icon"><i class="fa-solid fa-sitemap"></i></div>
                    <div class="summary-info">
                        <h3>WORDA Department</h3>
                        <div class="value" style="font-size: 1.25rem;">${escapeHtml(m.department || 'General')}</div>
                        <span class="view-link">${escapeHtml(m.ministry_code || 'Ministry Code')}</span>
                    </div>
                </div>
                <div class="summary-card members">
                    <div class="card-icon"><i class="fa-solid fa-user-tag"></i></div>
                    <div class="summary-info">
                        <h3>My Ministry Role</h3>
                        <div class="value" style="font-size: 1.25rem;">${escapeHtml(m.role_in_ministry || 'Member')}</div>
                        <span class="view-link">${m.joined_date ? 'Joined ' + new Date(m.joined_date).toLocaleDateString() : 'Active Member'}</span>
                    </div>
                </div>
                <div class="summary-card events">
                    <div class="card-icon"><i class="fa-solid fa-calendar-days"></i></div>
                    <div class="summary-info">
                        <h3>Regular Schedule</h3>
                        <div class="value" style="font-size: 1.1rem;">${escapeHtml(m.meeting_schedule || 'Sunday Services')}</div>
                        <span class="view-link">Imus Main Campus</span>
                    </div>
                </div>
                <div class="summary-card income">
                    <div class="card-icon"><i class="fa-solid fa-users"></i></div>
                    <div class="summary-info">
                        <h3>Ministry Members</h3>
                        <div class="value">${activeMemberMinistryTeamCache.length || 1}</div>
                        <span class="view-link">Active Teammates</span>
                    </div>
                </div>
            </div>

            <!-- Spiritual Mandate Card -->
            <div class="card mb-6" style="padding: 1.5rem;">
                <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--navy); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fa-solid fa-book-bible text-primary"></i> Ministry Overview & Spiritual Mandate
                </h4>
                <div style="font-size: 0.875rem; line-height: 1.8; color: #334155; margin-bottom: 1rem;">
                    ${escapeHtml(m.description || 'Dedicated to serving God and the congregation through faithful ministry, worship, and fellowship.')}
                </div>
                <div style="background: #fffdf5; border-left: 3px solid var(--gold); padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.85rem; color: #78350f; font-style: italic;">
                    "Whatever you do, work heartily, as for the Lord and not for men, knowing that from the Lord you will receive the inheritance as your reward. You are serving the Lord Christ." — Colossians 3:23-24
                </div>
            </div>

            <!-- 3. Clean Ministry Team Roster Table -->
            <div class="card" style="padding: 1.5rem;">
                <div class="flex justify-between items-center mb-4" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--navy); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fa-solid fa-users text-amber-600"></i> Ministry Team Members
                            <span class="badge" style="background: #eff6ff; color: #1d4ed8; font-size: 0.8rem;" id="memberRosterCountBadge">${activeMemberMinistryTeamCache.length} Members</span>
                        </h3>
                        <p class="text-xs text-slate-500" style="margin: 3px 0 0;">Complete list of brothers and sisters serving with you in this ministry.</p>
                    </div>
                </div>

                <!-- Filter Toolbar -->
                <div class="filter-toolbar mb-4" style="margin-bottom: 1.25rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                    <div class="search-box" style="flex: 1; min-width: 240px;">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" id="memberRosterSearch" placeholder="Search roster members by name, email, or role..." oninput="filterMemberMinistryRoster()">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label"><i class="fa-solid fa-filter text-slate-400"></i> Role:</label>
                        <select id="memberRosterRoleFilter" onchange="filterMemberMinistryRoster()" style="padding: 0.5rem 0.75rem; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.85rem;">
                            <option value="">All Roles</option>
                            ${distinctRosterRoles.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- Roster Table -->
                <div class="overflow-x-auto" style="border: 1px solid var(--border-color); border-radius: 10px;">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
                            <tr>
                                <th class="p-3.5">Member</th>
                                <th class="p-3.5">Contact Details</th>
                                <th class="p-3.5 text-center">Role in Ministry</th>
                                <th class="p-3.5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody id="memberRosterTableBody" class="divide-y divide-slate-100">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        renderMemberRosterRows(activeMemberMinistryTeamCache);

    } catch (error) {
        console.error('Error rendering member ministry dashboard:', error);
        card.innerHTML = `
            <div class="card p-8 text-center text-rose-500">
                <i class="fa-solid fa-circle-exclamation text-2xl mb-2 block"></i>
                Failed to load ministry details: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

function filterMemberMinistryRoster() {
    const query = (document.getElementById('memberRosterSearch')?.value || '').toLowerCase().trim();
    const roleFilter = (document.getElementById('memberRosterRoleFilter')?.value || '').toLowerCase().trim();

    const filtered = activeMemberMinistryTeamCache.filter(m => {
        const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
        const email = (m.email || '').toLowerCase();
        const role = (m.role_in_ministry || '').toLowerCase();
        const contact = (m.contact_number || '').toLowerCase();

        const matchesQuery = !query || fullName.includes(query) || email.includes(query) || role.includes(query) || contact.includes(query);
        const matchesRole = !roleFilter || role.includes(roleFilter);

        return matchesQuery && matchesRole;
    });

    renderMemberRosterRows(filtered);
}

function renderMemberRosterRows(list) {
    const tbody = document.getElementById('memberRosterTableBody');
    const badge = document.getElementById('memberRosterCountBadge');
    if (badge) badge.textContent = `${list.length} Members`;
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center p-8 text-slate-400">
                    <i class="fa-solid fa-users-slash text-2xl mb-2 block opacity-30"></i>
                    No roster members found matching your search.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(mem => {
        const role = mem.role_in_ministry || 'Member';
        const isLeader = (mem.is_ministry_leader == 1) || (myMinistryCache && Number(myMinistryCache.leader_member_id) === Number(mem.member_id));

        let roleBadge = `<span class="badge" style="background: #eff6ff; color: #2563eb; font-weight: 600; font-size: 0.75rem;">${escapeHtml(role)}</span>`;
        if (isLeader) {
            roleBadge = `<span class="badge" style="background: #fef3c7; color: #92400e; font-weight: 700; border: 1px solid #fde68a; font-size: 0.75rem;"><i class="fa-solid fa-crown mr-1" style="color: #d97706;"></i> ${escapeHtml(role || 'Ministry Leader')}</span>`;
        } else if (role.toLowerCase().includes('lead')) {
            roleBadge = `<span class="badge" style="background: #fef3c7; color: #92400e; font-weight: 700; border: 1px solid #fde68a; font-size: 0.75rem;"><i class="fa-solid fa-crown mr-1 text-amber-500"></i> ${escapeHtml(role)}</span>`;
        } else if (role.toLowerCase().includes('core') || role.toLowerCase().includes('assistant')) {
            roleBadge = `<span class="badge" style="background: #f3e8ff; color: #7e22ce; font-weight: 600; font-size: 0.75rem;"><i class="fa-solid fa-star mr-1 text-purple-500"></i> ${escapeHtml(role)}</span>`;
        }

        const isCurrent = currentUser && (mem.user_id === currentUser.user_id || mem.member_id === currentUser.member_id);

        return `
            <tr class="hover:bg-slate-50 transition ${isLeader ? 'ministry-leader-row' : ''} ${isCurrent ? 'bg-amber-50/40' : ''}" style="${isLeader ? 'background: #fffdf2; border-left: 4px solid #f59e0b;' : ''}">
                <td class="p-3.5">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${mem.profile_image 
                            ? `<img src="${escapeHtml(mem.profile_image)}" alt="" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid #cbd5e1;" onerror="this.outerHTML='<div style=\\'width:36px;height:36px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;\\'>${escapeHtml((mem.first_name || 'M').charAt(0))}</div>'">`
                            : `<div style="width: 36px; height: 36px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem;">${escapeHtml((mem.first_name || 'M').charAt(0))}</div>`
                        }
                        <div>
                            <div style="font-weight: 700; color: var(--navy); display: flex; align-items: center; gap: 6px;">
                                ${escapeHtml(mem.first_name || '')} ${escapeHtml(mem.last_name || '')}
                                ${isLeader ? '<i class="fa-solid fa-crown text-amber-500" style="color: #d97706;" title="Ministry Leader"></i>' : ''}
                                ${isCurrent ? '<span class="badge" style="background: #dbeafe; color: #1e40af; font-size: 0.65rem; padding: 1px 6px;">You</span>' : ''}
                            </div>
                            <div class="text-xs text-slate-400">ID: #${mem.member_id}</div>
                        </div>
                    </div>
                </td>
                <td class="p-3.5 text-xs text-slate-600">
                    <div>${mem.email ? `<i class="fa-regular fa-envelope mr-1 text-slate-400"></i> ${escapeHtml(mem.email)}` : '—'}</div>
                    <div class="text-slate-400 mt-0.5">${mem.contact_number ? `<i class="fa-solid fa-phone mr-1 text-slate-400"></i> ${escapeHtml(mem.contact_number)}` : ''}</div>
                </td>
                <td class="p-3.5 text-center">
                    ${roleBadge}
                </td>
                <td class="p-3.5 text-center">
                    <span class="badge ${mem.status === 'Active' || !mem.status ? 'badge-active' : 'badge-inactive'}" style="font-size: 0.75rem;">
                        ${escapeHtml(mem.status || 'Active')}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function resetMemberC2SFilters() {
    const s = document.getElementById('memberC2SSearch');
    const d = document.getElementById('memberC2SDayFilter');
    if (s) s.value = '';
    if (d) d.value = '';
    filterMemberC2SDirectory();
}

function resetMemberAnnFilters() {
    const s = document.getElementById('memberAnnSearch');
    if (s) s.value = '';
    filterMemberAnnCategory('', null);
    filterMemberAnnouncements();
}

// ============================================================
// MODAL BACKDROP CLICK-TO-CLOSE & ESCAPE KEY HANDLER
// ============================================================
const memberModalCloseMap = {
    'memberWorkCalendarModal': () => typeof closeMemberWorkCalendarModal === 'function' && closeMemberWorkCalendarModal(),
    'memberEventDetailModal': () => typeof closeMemberEventDetailModal === 'function' && closeMemberEventDetailModal(),
    'memberAnnouncementReaderModal': () => typeof closeMemberAnnouncementReaderModal === 'function' && closeMemberAnnouncementReaderModal(),
    'memberC2SDetailsModal': () => typeof closeMemberC2SDetailsModal === 'function' && closeMemberC2SDetailsModal(),
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

function initMemberModalBackdropClose() {
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
            if (memberModalCloseMap[overlayId]) {
                try { memberModalCloseMap[overlayId](); } catch (err) {}
            }
            e.target.classList.remove('active');
            e.target.style.display = '';
            e.target.style.removeProperty('display');
        }
        isMouseDownOnBackdrop = false;
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            const activeModal = document.querySelector('.modal-overlay.active, .modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]');
            if (activeModal) {
                const overlayId = activeModal.id;
                if (memberModalCloseMap[overlayId]) {
                    try { memberModalCloseMap[overlayId](); } catch (err) {}
                }
                activeModal.classList.remove('active');
                activeModal.style.display = '';
                activeModal.style.removeProperty('display');
            }
        }
    });
}
initMemberModalBackdropClose();
