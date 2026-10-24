// Helper: HTML Escaping for XSS Prevention
function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Mobile Navigation Toggle
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

// Close mobile menu on link click
document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-links a')) {
        const navLinks = document.querySelector('.nav-links');
        if (navLinks && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
        }
    }
});

// Navbar Scroll Effect & Active Link Highlight
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
        if (window.scrollY > 40) {
            navbar.classList.add('scrolled');
        } else {
            if (!navbar.dataset.alwaysScrolled) {
                navbar.classList.remove('scrolled');
            }
        }
    }
});

function highlightActiveNav() {
    const path = window.location.pathname;
    const links = document.querySelectorAll('.nav-links a');
    links.forEach(a => {
        const href = a.getAttribute('href');
        if (href === path || (href !== '/' && href !== '' && path.includes(href))) {
            a.classList.add('active');
        }
    });
}

// Lightbox Modal Functions
function openLightbox(src, caption = '') {
    let modal = document.getElementById('lightboxModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lightboxModal';
        modal.className = 'lightbox-modal';
        modal.innerHTML = `
            <button class="lightbox-close" onclick="closeLightbox()" aria-label="Close">&times;</button>
            <div style="text-align: center; max-width: 90vw;">
                <img id="lightboxImg" class="lightbox-img" src="" alt="Enlarged View">
                <p id="lightboxCaption" style="color: #ffffff; margin-top: 1rem; font-size: 1rem; font-weight: 500;"></p>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeLightbox();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeLightbox();
        });
    }
    const imgEl = document.getElementById('lightboxImg');
    const capEl = document.getElementById('lightboxCaption');
    if (imgEl) imgEl.src = src;
    if (capEl) capEl.textContent = caption;
    modal.classList.add('active');
}

function closeLightbox() {
    const modal = document.getElementById('lightboxModal');
    if (modal) modal.classList.remove('active');
}

// Hero Video & Motion Controller
function initHeroVideo() {
    const video = document.getElementById('heroVideo');
    const toggleBtn = document.getElementById('heroVideoControl');
    const container = document.getElementById('heroVideoContainer');
    if (!video) return;

    // Ensure muted and playsinline properties are explicitly set for browser autoplay compliance
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const updateButton = (isPlaying) => {
        if (!toggleBtn) return;
        if (isPlaying) {
            toggleBtn.innerHTML = '<i class="fa-solid fa-pause"></i><span class="video-control-text">Motion</span>';
            toggleBtn.setAttribute('aria-label', 'Pause background video');
        } else {
            toggleBtn.innerHTML = '<i class="fa-solid fa-play"></i><span class="video-control-text">Motion</span>';
            toggleBtn.setAttribute('aria-label', 'Play background video');
        }
    };

    video.addEventListener('playing', () => {
        if (container) container.classList.remove('video-fallback');
        updateButton(true);
    });

    video.addEventListener('pause', () => {
        updateButton(false);
    });

    video.addEventListener('error', (e) => {
        console.warn('Hero video failed to load, falling back to slider/poster:', e);
        if (container) container.classList.add('video-fallback');
    });

    // Respect user's reduced motion system preference
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        video.pause();
        if (container) container.classList.add('video-fallback');
        updateButton(false);
        return;
    }

    // Attempt video playback
    const startPlayback = () => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                if (container) container.classList.remove('video-fallback');
                updateButton(true);
            }).catch((err) => {
                console.log('Autoplay muted playback deferred by browser policy:', err);
                updateButton(false);
                // Listen for first interaction to resume play
                const resumeOnInteraction = () => {
                    video.play().then(() => {
                        if (container) container.classList.remove('video-fallback');
                        updateButton(true);
                    }).catch(() => {});
                    window.removeEventListener('click', resumeOnInteraction);
                    window.removeEventListener('touchstart', resumeOnInteraction);
                    window.removeEventListener('scroll', resumeOnInteraction);
                };
                window.addEventListener('click', resumeOnInteraction, { once: true, passive: true });
                window.addEventListener('touchstart', resumeOnInteraction, { once: true, passive: true });
                window.addEventListener('scroll', resumeOnInteraction, { once: true, passive: true });
            });
        }
    };

    startPlayback();

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (video.paused) {
                if (container) container.classList.remove('video-fallback');
                video.play().then(() => {
                    updateButton(true);
                }).catch((err) => {
                    console.error('Manual play failed:', err);
                });
            } else {
                video.pause();
                updateButton(false);
            }
        });
    }
}

// Scroll-Triggered Entrance Animations (Intersection Observer)
function initScrollAnimations() {
    const targets = document.querySelectorAll('.reveal, .reveal-stagger');
    if (!targets.length) return;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        targets.forEach(el => el.classList.add('active'));
        return;
    }

    if (!('IntersectionObserver' in window)) {
        targets.forEach(el => el.classList.add('active'));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                obs.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -30px 0px'
    });

    targets.forEach(el => {
        if (!el.classList.contains('active')) {
            observer.observe(el);
        }
    });
}

// Hero Slider
async function loadHero() {
    const slider = document.getElementById('heroSlider');
    if (!slider) return;

    try {
        const res = await api.public.getBanners();
        
        if (!res.data || res.data.length === 0) {
            slider.innerHTML = `<div class="hero-slide active" style="background-image: url('https://images.unsplash.com/photo-1507692049790-de58290a4334?q=80&w=1920&auto=format&fit=crop');"></div>`;
            return;
        }

        slider.innerHTML = res.data.map((b, i) => `
            <div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image: url('${encodeURI(b.image_path)}');"></div>
        `).join('');

        // Auto-rotate slides
        let current = 0;
        const slides = document.querySelectorAll('.hero-slide');
        if (slides.length > 1) {
            setInterval(() => {
                slides[current].classList.remove('active');
                current = (current + 1) % slides.length;
                slides[current].classList.add('active');
            }, 6000);
        }

    } catch (error) {
        console.error('Error loading hero:', error);
        slider.innerHTML = `<div class="hero-slide active" style="background-image: url('https://images.unsplash.com/photo-1507692049790-de58290a4334?q=80&w=1920&auto=format&fit=crop');"></div>`;
    }
}

// Helper: Extract YouTube Video ID
function extractYouTubeId(urlOrId) {
    if (!urlOrId) return '';
    const str = String(urlOrId).trim();
    const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/|shorts\/))([\w-]{11})/i);
    if (match && match[1]) return match[1];
    const clean = str.replace(/^v=/, '');
    const idMatch = clean.match(/^[\w-]{11}$/);
    if (idMatch) return idMatch[0];
    return clean.slice(0, 50);
}

// Inline Playback for Cards
function playSermonInline(targetId, videoId, title) {
    const el = document.getElementById(targetId);
    if (!el || !videoId) return;
    el.innerHTML = `
        <iframe 
            src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0" 
            title="${escapeHtml(title || 'Past Sermon')}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerpolicy="strict-origin-when-cross-origin" 
            allowfullscreen 
            style="width: 100%; height: 100%; border: none; position: absolute; top:0; left:0;">
        </iframe>
    `;
    el.style.background = '#000';
    el.onclick = null; // Prevent re-triggering once playing
}

// Public Video Theater Modal
window._publicSermonsList = [];

function openPublicSermonByIndex(index) {
    const s = window._publicSermonsList[index];
    if (!s) return;
    const videoId = extractYouTubeId(s.youtube_video_id || s.video_url || '');
    const dateStr = s.sermon_date ? new Date(s.sermon_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : 'Recent';
    openPublicVideoModal(videoId, s.title, s.preacher || 'Pastor', dateStr, s.scripture_reference || '', s.description || '', s.is_featured == 1);
}

function openPublicVideoModal(videoId, title, preacher, dateStr, scripture, description, isFeatured = false) {
    if (!videoId) return;
    let modal = document.getElementById('publicVideoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'publicVideoModal';
        modal.className = 'public-video-modal-overlay';
        modal.innerHTML = `
            <div class="public-video-modal" onclick="event.stopPropagation()">
                <div class="public-video-modal-header">
                    <div>
                        <h3 class="public-video-modal-title" id="pubModalTitle">
                            <i class="fa-brands fa-youtube" style="color: #ef4444;"></i>
                            <span>Past Sermon</span>
                        </h3>
                        <div class="public-video-modal-meta" id="pubModalMeta" style="margin-top: 4px;"></div>
                    </div>
                    <button type="button" class="public-video-modal-close" onclick="closePublicVideoModal()" title="Close Player">&times;</button>
                </div>
                <div class="public-video-modal-player" id="pubModalPlayer"></div>
                <div class="public-video-modal-footer">
                    <div id="pubModalNotes" style="font-size: 0.85rem; color: #cbd5e1; max-width: 650px; line-height: 1.5;"></div>
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-left: auto;">
                        <a id="pubModalYtLink" href="#" target="_blank" rel="noopener noreferrer" class="btn-youtube-watch" style="margin-top: 0;">
                            <i class="fa-brands fa-youtube"></i> Watch on YouTube
                        </a>
                        <button type="button" class="btn-theater-mode" onclick="closePublicVideoModal()">Close</button>
                    </div>
                </div>
            </div>
        `;
        modal.addEventListener('click', closePublicVideoModal);
        document.body.appendChild(modal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closePublicVideoModal();
        });
    }

    const titleEl = document.getElementById('pubModalTitle');
    const metaEl = document.getElementById('pubModalMeta');
    const playerEl = document.getElementById('pubModalPlayer');
    const notesEl = document.getElementById('pubModalNotes');
    const ytLink = document.getElementById('pubModalYtLink');

    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-brands fa-youtube" style="color: #ef4444;"></i> <span>${escapeHtml(title || 'Past Sermon')}</span>`;
    }

    if (metaEl) {
        metaEl.innerHTML = `
            ${isFeatured ? `<span style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); padding: 1px 8px; border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-star text-2xs"></i> Featured Sermon </span>` : ''}
            ${dateStr ? `<span><i class="fa-solid fa-calendar-day" style="color: var(--gold);"></i> ${escapeHtml(dateStr)}</span>` : ''}
            ${preacher ? `<span><i class="fa-solid fa-user-tie" style="color: var(--gold);"></i> ${escapeHtml(preacher)}</span>` : ''}
            ${scripture ? `<span style="background: rgba(255,255,255,0.1); padding: 1px 8px; border-radius: 4px; font-weight: 600;"><i class="fa-solid fa-book-bible"></i> ${escapeHtml(scripture)}</span>` : ''}
        `;
    }

    if (notesEl) {
        notesEl.textContent = description || '';
    }

    if (ytLink) {
        ytLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    }

    if (playerEl) {
        playerEl.innerHTML = `
            <iframe 
                src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0" 
                title="${escapeHtml(title || 'Sermon')}" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                referrerpolicy="strict-origin-when-cross-origin" 
                allowfullscreen>
            </iframe>
        `;
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePublicVideoModal() {
    const modal = document.getElementById('publicVideoModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
    const playerEl = document.getElementById('pubModalPlayer');
    if (playerEl) playerEl.innerHTML = '';
}

// Homepage Sermons
async function loadHomeSermons() {
    const grid = document.getElementById('sermonsGrid');
    if (!grid) return;
    try {
        const res = await api.public.getSermons();
        if (!res.data || res.data.length === 0) { 
            grid.innerHTML = '<div style="text-align: center; grid-column: 1/-1; padding: 3rem; background: var(--white); border-radius: 12px; border: 1px dashed var(--border-color); color: var(--text-muted);"><i class="fa-solid fa-video" style="font-size: 2.5rem; color: var(--gold); margin-bottom: 1rem; display: block;"></i>No past sermons available at this time. Check back soon!</div>'; 
            return; 
        }

        // Prioritize featured sermons first, then newest sermon_date
        const sorted = [...res.data].sort((a, b) => {
            const featA = a.is_featured == 1 ? 1 : 0;
            const featB = b.is_featured == 1 ? 1 : 0;
            if (featB !== featA) return featB - featA;
            return new Date(b.sermon_date) - new Date(a.sermon_date);
        });

        window._publicSermonsList = sorted.slice(0, 3);
        grid.innerHTML = window._publicSermonsList.map((s, idx) => {
            const isFeatured = s.is_featured == 1;
            const videoId = extractYouTubeId(s.youtube_video_id || s.video_url || '');
            const dateStr = s.sermon_date ? new Date(s.sermon_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : 'Recent';
            const thumbUrl = videoId ? `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1438032005730-c779502df39b?q=80&w=600&auto=format&fit=crop';
            const ytWatchUrl = videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : '#';
            return `
            <div class="card-public ${isFeatured ? 'is-featured-card' : ''}" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div class="card-public-img-wrapper" onclick="openPublicSermonByIndex(${idx})" style="cursor: pointer;" title="Play Sermon Video">
                        <img src="${thumbUrl}" alt="${escapeHtml(s.title)}" onerror="this.src='https://images.unsplash.com/photo-1438032005730-c779502df39b?q=80&w=600&auto=format&fit=crop'">
                        <div class="play-overlay-glow">
                            <div class="play-btn-circle">
                                <i class="fa-solid fa-play" style="font-size: 1.6rem; color: #ffffff; margin-left: 3px;"></i>
                            </div>
                        </div>
                        ${isFeatured ? `
                        <div style="position: absolute; top: 1rem; right: 1rem; display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; z-index: 10;">
                            <span class="card-badge-pill badge-featured" style="position: static;"><i class="fa-solid fa-star"></i> Featured Sermon</span>
                            <span class="card-badge-pill badge-youtube" style="position: static;"><i class="fa-brands fa-youtube"></i> Past Sermon</span>
                        </div>
                        ` : `
                        <span class="card-badge-pill badge-youtube"><i class="fa-brands fa-youtube"></i> Past Sermon</span>
                        `}
                    </div>
                    <div class="card-body">
                        <div class="card-meta" style="border-top: none; padding-top: 0; margin-bottom: 0.75rem;">
                            ${isFeatured ? `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 4px;"><i class="fa-solid fa-star text-2xs mr-1"></i>Featured</span>` : ''}
                            <span><i class="fa-solid fa-calendar-day"></i> ${dateStr}</span>
                            <span><i class="fa-solid fa-user-tie"></i> ${escapeHtml(s.preacher || 'Pastor')}</span>
                        </div>
                        <h3 style="cursor: pointer;" onclick="openPublicSermonByIndex(${idx})">${escapeHtml(s.title)}</h3>
                        <p>${escapeHtml(s.description) || 'Watch and be blessed by this inspiring message from God\'s Word.'}</p>
                    </div>
                </div>
                <div style="padding: 0 1.5rem 1.5rem; display: flex; align-items: center; justify-content: flex-end;">
                    <a href="${ytWatchUrl}" target="_blank" rel="noopener noreferrer" class="btn-youtube-watch" style="margin-top: 0;">
                        <i class="fa-brands fa-youtube"></i> Watch on YouTube
                    </a>
                </div>
            </div>
            `;
        }).join('');
        setTimeout(initScrollAnimations, 50);
    } catch (error) {
        console.error('Error loading sermons:', error);
        grid.innerHTML = '<p style="text-align: center; grid-column: 1/-1; color: var(--text-muted);">Unable to load sermons at this time.</p>';
    }
}

// Homepage Events
let homeEventsCache = [];

async function loadHomeEvents() {
    const grid = document.getElementById('eventsGrid');
    if (!grid) return;
    try {
        const res = await api.public.getEvents();
        window.homeEventsCache = res.data || [];
        homeEventsCache = window.homeEventsCache;
        if (!homeEventsCache || homeEventsCache.length === 0) { 
            grid.innerHTML = '<div style="text-align: center; grid-column: 1/-1; padding: 3rem; background: var(--white); border-radius: 12px; border: 1px dashed var(--border-color); color: var(--text-muted);"><i class="fa-solid fa-calendar-xmark" style="font-size: 2.5rem; color: var(--gold); margin-bottom: 1rem; display: block;"></i>No upcoming events scheduled right now. Check back soon!</div>'; 
            return; 
        }

        // Prioritize featured events first, then upcoming dates
        homeEventsCache.sort((a, b) => {
            const featA = a.is_featured == 1 ? 1 : 0;
            const featB = b.is_featured == 1 ? 1 : 0;
            if (featB !== featA) return featB - featA;
            return new Date(a.start_datetime) - new Date(b.start_datetime);
        });
        
        const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

        grid.innerHTML = homeEventsCache.slice(0, 3).map(e => {
            const isFeatured = e.is_featured == 1;
            const d = new Date(e.start_datetime);
            const mStr = monthNames[d.getMonth()] || 'EVT';
            const dStr = d.getDate() || '1';
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
            <div class="card-public card-clickable ${isFeatured ? 'is-featured-card' : ''}" onclick="openHomeEventModal(${e.event_id})" role="button" tabindex="0" title="Click to view details for ${escapeHtml(e.title)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openHomeEventModal(${e.event_id});}">
                <div class="card-public-img-wrapper" style="${e.banner_image ? `background-image: linear-gradient(to bottom, rgba(6, 23, 48, 0.35), rgba(6, 23, 48, 0.65)), url('${escapeHtml(e.banner_image)}'); background-size: cover; background-position: center;` : 'background: linear-gradient(135deg, var(--navy) 0%, #1e4976 100%);'} display: flex; align-items: center; justify-content: center; position: relative;">
                    <div class="event-date-block">
                        <div class="month">${mStr}</div>
                        <div class="day">${dStr}</div>
                    </div>
                    ${!e.banner_image ? '<i class="fa-solid fa-church" style="font-size: 4rem; color: rgba(201, 169, 97, 0.35);"></i>' : ''}
                    ${isFeatured ? `
                    <div style="position: absolute; top: 1rem; right: 1rem; display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; z-index: 10;">
                        <span class="card-badge-pill badge-featured" style="position: static;"><i class="fa-solid fa-star"></i> Featured Event</span>
                        <span class="card-badge-pill" style="position: static; font-size: 0.7rem; padding: 0.25rem 0.65rem;">${escapeHtml(e.event_type || 'Event')}</span>
                    </div>
                    ` : `
                    <span class="card-badge-pill">${escapeHtml(e.event_type || 'Event')}</span>
                    `}
                </div>
                <div class="card-body">
                    <h3>${escapeHtml(e.title)}</h3>
                    <p>${escapeHtml(e.description) || 'Join us for this special church event. Everyone is welcome!'}</p>
                    <div class="card-meta">
                        ${isFeatured ? `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 4px;"><i class="fa-solid fa-star text-2xs mr-1"></i>Featured</span>` : ''}
                        <span><i class="fa-solid fa-clock"></i> ${timeStr}</span>
                        <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(e.venue || 'COG Imus Sanctuary')}</span>
                    </div>
                    <div style="margin-top: 1.15rem; padding-top: 0.85rem; border-top: 1px solid var(--border-color, #e2e8f0); display: flex; align-items: center; justify-content: space-between; font-size: 0.825rem; font-weight: 700; color: var(--gold-dark, #b45309);">
                        <span style="display: inline-flex; align-items: center; gap: 0.4rem;">
                            <i class="fa-solid fa-circle-info" style="color: var(--gold);"></i> View Details
                        </span>
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                            <i class="fa-solid fa-arrow-right"></i>
                        </span>
                    </div>
                </div>
            </div>
            `;
        }).join('');
        setTimeout(initScrollAnimations, 50);
    } catch (error) {
        console.error('Error loading events:', error);
        grid.innerHTML = '<p style="text-align: center; grid-column: 1/-1; color: var(--text-muted);">Unable to load events at this time.</p>';
    }
}

function openHomeEventModal(eventId) {
    const e = (window.homeEventsCache || homeEventsCache || []).find(ev => ev.event_id == eventId);
    if (!e) return;
    const modal = document.getElementById('eventDetailsModal');
    if (!modal) return;

    const startDate = e.start_datetime ? new Date(e.start_datetime) : null;
    const endDate = e.end_datetime ? new Date(e.end_datetime) : null;

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

    const dateStr = startDate ? startDate.toLocaleDateString('en-US', dateOptions) : 'Date TBA';
    const startTimeStr = startDate ? startDate.toLocaleTimeString('en-US', timeOptions) : '';
    const endTimeStr = endDate ? endDate.toLocaleTimeString('en-US', timeOptions) : '';
    const timeRange = startTimeStr ? (endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr) : 'Time TBA';

    // Populate Modal Content
    const titleEl = document.getElementById('evtModalTitle');
    if (titleEl) titleEl.textContent = e.title || 'Church Event';

    const typeEl = document.getElementById('evtModalType');
    if (typeEl) typeEl.textContent = e.event_type || 'Gathering';

    const featBadge = document.getElementById('evtModalFeaturedBadge');
    if (featBadge) {
        featBadge.style.display = (e.is_featured == 1) ? 'inline-flex' : 'none';
    }

    const dateEl = document.getElementById('evtModalDate');
    if (dateEl) dateEl.textContent = dateStr;

    const timeEl = document.getElementById('evtModalTime');
    if (timeEl) timeEl.textContent = timeRange;

    const venueEl = document.getElementById('evtModalVenue');
    if (venueEl) venueEl.textContent = e.venue || 'COG Imus Sanctuary / Imus Campus';

    const descEl = document.getElementById('evtModalDesc');
    if (descEl) descEl.textContent = e.description || 'Join us for this church gathering and fellowship as we grow together in faith and community.';

    const bannerEl = document.getElementById('evtModalHeaderBanner');
    if (bannerEl) {
        if (e.banner_image) {
            bannerEl.style.backgroundImage = `linear-gradient(to bottom, rgba(6, 23, 48, 0.45), rgba(6, 23, 48, 0.85)), url('${encodeURI(e.banner_image)}')`;
            bannerEl.style.backgroundSize = 'cover';
            bannerEl.style.backgroundPosition = 'center';
        } else {
            bannerEl.style.backgroundImage = 'linear-gradient(135deg, var(--navy, #0c2340) 0%, #1e3a8a 100%)';
        }
    }

    const deptBox = document.getElementById('evtModalDeptBox');
    const deptEl = document.getElementById('evtModalDept');
    if (deptBox && deptEl) {
        const org = e.department || e.ministry_name || e.organizer;
        if (org) {
            deptBox.style.display = 'inline-flex';
            deptEl.textContent = org;
        } else {
            deptBox.style.display = 'none';
        }
    }

    const enrollBadge = document.getElementById('evtModalEnrollBadge');
    if (enrollBadge) {
        if (e.is_enrollment_open == 1) {
            enrollBadge.style.display = 'inline-flex';
            enrollBadge.style.alignItems = 'center';
            enrollBadge.style.gap = '0.4rem';
            enrollBadge.className = 'badge badge-active';
            enrollBadge.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> Registration Open';
        } else {
            enrollBadge.style.display = 'none';
        }
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeHomeEventModal(event) {
    if (event && event.target && event.target !== event.currentTarget && !event.target.classList.contains('btn-close-modal')) {
        return;
    }
    const modal = document.getElementById('eventDetailsModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Global escape key handler for modal
document.addEventListener('keydown', function(ev) {
    if (ev.key === 'Escape') {
        closeHomeEventModal();
    }
});

window.openHomeEventModal = openHomeEventModal;
window.closeHomeEventModal = closeHomeEventModal;
window.closeEventDetailsModal = closeHomeEventModal;

// Contact Form Handler
function initContactForm() {
    const form = document.getElementById('contactForm');
    const alertBox = document.getElementById('contactAlert');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('contactName').value.trim();
        const email = document.getElementById('contactEmail').value.trim();
        const contact_number = document.getElementById('contactPhone')?.value.trim() || null;
        const subject = document.getElementById('contactSubject').value.trim();
        const message = document.getElementById('contactMessage').value.trim();

        if (!name || !email || !message) {
            showContactAlert('Please fill in all required fields.', '#fee2e2', '#dc2626');
            return;
        }

        const btn = document.getElementById('btnContactSubmit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending Message...';

        try {
            await api.public.submitContact({ name, email, contact_number, subject, message });
            showContactAlert('Thank you! Your message has been received. Our ministry team will get back to you soon.', '#dcfce7', '#16a34a');
            form.reset();
        } catch (error) {
            showContactAlert(error.message || 'Failed to submit message. Please try again.', '#fee2e2', '#dc2626');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Message';
        }
    });

    function showContactAlert(msg, bgColor, textColor) {
        if (!alertBox) return;
        alertBox.textContent = msg;
        alertBox.style.backgroundColor = bgColor;
        alertBox.style.color = textColor;
        alertBox.style.display = 'block';
    }
}

// Live Stream Broadcast Alert Ribbon & Fixed Navbar Positioning
function updateLiveRibbonPosition() {
    const ribbon = document.getElementById('homeLiveRibbon');
    const navbar = document.getElementById('navbar');
    if (ribbon && navbar && ribbon.style.display !== 'none') {
        const ribbonHeight = ribbon.offsetHeight;
        navbar.style.top = ribbonHeight + 'px';
        document.body.style.paddingTop = ribbonHeight + 'px';
        document.body.classList.add('has-live-banner');
    } else if (navbar) {
        navbar.style.top = '0px';
        document.body.style.paddingTop = '0px';
        document.body.classList.remove('has-live-banner');
    }
}

function dismissLiveRibbon() {
    const ribbon = document.getElementById('homeLiveRibbon');
    if (ribbon) ribbon.style.display = 'none';
    sessionStorage.setItem('dismiss_live_ribbon', '1');
    updateLiveRibbonPosition();
}

async function checkLiveBroadcastBanner() {
    if (sessionStorage.getItem('dismiss_live_ribbon') === '1') return;
    try {
        const res = await api.public.getLiveStream();
        if (res.data && res.data.is_live == 1) {
            let ribbon = document.getElementById('homeLiveRibbon');
            if (!ribbon) {
                ribbon = document.createElement('div');
                ribbon.id = 'homeLiveRibbon';
                ribbon.className = 'home-live-ribbon';
                document.body.insertAdjacentElement('afterbegin', ribbon);
            }
            ribbon.style.display = 'flex';
            ribbon.innerHTML = `
                <div class="home-live-ribbon-content">
                    <span style="display: inline-flex; align-items: center; gap: 0.45rem; text-align: center;">
                        <i class="fa-solid fa-circle" style="color: #ffffff; font-size: 0.55rem; animation: pulseDotLive 1.4s infinite ease-in-out;"></i>
                        <span><strong>WE ARE LIVE ON FACEBOOK:</strong> ${escapeHtml(res.data.title || 'Sunday Celebration Service')}</span>
                    </span>
                    <a href="/views/sermons.html#livestream" class="btn-ribbon-watch">
                        Watch Live Media Player <i class="fa-solid fa-arrow-right" style="font-size: 0.72rem;"></i>
                    </a>
                    <button type="button" class="btn-close-ribbon" onclick="dismissLiveRibbon()" aria-label="Dismiss banner" title="Dismiss">&times;</button>
                </div>
            `;
            updateLiveRibbonPosition();
            setTimeout(updateLiveRibbonPosition, 60);
            window.addEventListener('resize', updateLiveRibbonPosition);
        } else {
            const ribbon = document.getElementById('homeLiveRibbon');
            if (ribbon) ribbon.style.display = 'none';
            updateLiveRibbonPosition();
        }
    } catch (err) {
        // Silently ignore if offline
    }
}

// ============== REALTIME SYNCHRONIZATION FOR PUBLIC CHURCHGOER ==============
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


// ==================== DYNAMIC CMS WEBSITE HYDRATION ====================
async function loadWebsiteDynamicContent() {
    try {
        const res = await api.public.getWebsiteContent('all');
        if (!res || !res.data) return;
        const data = res.data;

        // 1. Branding: Logo in Navigation Topbar & Footers
        const hp = data.homepage || {};
        const logoIcon = hp.logo_icon || data.site_branding?.top_logo;
        const logoHolders = document.querySelectorAll('.navbar .logo, .footer-logo');
        logoHolders.forEach(holder => {
            const existingIcon = holder.querySelector('.logo-icon, .logo-custom-img');
            if (logoIcon && logoIcon !== '/images/logo.png' && logoIcon !== '') {
                if (existingIcon) {
                    if (existingIcon.tagName === 'IMG') {
                        existingIcon.src = encodeURI(logoIcon);
                    } else {
                        const img = document.createElement('img');
                        img.src = encodeURI(logoIcon);
                        img.alt = 'Church Logo';
                        img.className = 'logo-custom-img';
                        existingIcon.replaceWith(img);
                    }
                }
            } else {
                if (existingIcon && existingIcon.tagName === 'IMG') {
                    const div = document.createElement('div');
                    div.className = 'logo-icon';
                    div.innerHTML = '<i class="fa-solid fa-cross"></i>';
                    existingIcon.replaceWith(div);
                }
            }
        });

        // 2. Homepage Sections (index.html)
        const path = window.location.pathname.toLowerCase();
        const isHome = path === '/' || path.endsWith('/index.html') || path === '' || path.endsWith('/');

        if (isHome) {
            // A. Hero Content
            if (hp.hero) {
                const badgeEl = document.querySelector('.hero-badge span:last-child') || document.querySelector('.hero-badge');
                if (badgeEl && hp.hero.badge) {
                    badgeEl.innerHTML = `<i class="fa-solid fa-cross"></i> ${escapeHtml(hp.hero.badge)}`;
                }

                // Preserve Cormorant Garamond typography & gold italic em accent
                const h1El = document.getElementById('heroMainHeading') || document.querySelector('.hero-content h1');
                if (h1El) {
                    const l1 = hp.hero.heading_line1;
                    const l2 = hp.hero.heading_line2;
                    if (l1 && l2) {
                        h1El.innerHTML = `${escapeHtml(l1)} <em>${escapeHtml(l2)}</em>`;
                    } else if (hp.hero.heading && hp.hero.heading.includes('<em>')) {
                        h1El.innerHTML = hp.hero.heading;
                    } else if (hp.hero.heading && hp.hero.heading.includes(',')) {
                        const parts = hp.hero.heading.split(',');
                        const first = parts[0].trim() + ',';
                        const second = parts.slice(1).join(',').trim();
                        h1El.innerHTML = `${escapeHtml(first)} <em>${escapeHtml(second)}</em>`;
                    } else if (hp.hero.heading) {
                        h1El.textContent = hp.hero.heading;
                    }
                }

                const pEl = document.getElementById('heroSubheadingText') || document.querySelector('.hero-content p');
                if (pEl && hp.hero.subheading) {
                    pEl.textContent = hp.hero.subheading;
                }

                const btn1 = document.getElementById('heroPrimaryActionBtn') || document.querySelector('.hero-actions .btn-hero-primary');
                if (btn1 && hp.hero.primary_btn_text) {
                    btn1.innerHTML = `<i class="fa-solid fa-calendar-check"></i> <span>${escapeHtml(hp.hero.primary_btn_text)}</span>`;
                    if (hp.hero.primary_btn_url) btn1.href = hp.hero.primary_btn_url;
                }

                const btn2 = document.getElementById('heroSecondaryActionBtn') || document.querySelector('.hero-actions .btn-hero-outline');
                if (btn2 && hp.hero.secondary_btn_text) {
                    btn2.innerHTML = `<i class="fa-solid fa-circle-play"></i> <span>${escapeHtml(hp.hero.secondary_btn_text)}</span>`;
                    if (hp.hero.secondary_btn_url) btn2.href = hp.hero.secondary_btn_url;
                }
            }

            // B. Background Video
            if (hp.background_video && hp.background_video.video_url) {
                const videoEl = document.getElementById('heroVideo');
                if (videoEl && videoEl.querySelector('source')) {
                    const currentSrc = videoEl.querySelector('source').getAttribute('src');
                    if (currentSrc !== hp.background_video.video_url) {
                        videoEl.innerHTML = `<source src="${encodeURI(hp.background_video.video_url)}" type="video/mp4">`;
                        videoEl.load();
                        videoEl.play().catch(() => {});
                    }
                }
            }

            // C. Weekly Worship Schedule Strip
            if (Array.isArray(hp.schedule) && hp.schedule.length > 0) {
                const schedCard = document.querySelector('.service-times-card');
                if (schedCard) {
                    schedCard.innerHTML = hp.schedule.map(s => `
                        <div class="service-time-item">
                            <div class="service-time-icon"><i class="fa-solid ${escapeHtml(s.icon || 'fa-clock')}"></i></div>
                            <div>
                                <h4>${escapeHtml(s.title || 'Worship Service')}</h4>
                                <p>${escapeHtml(s.time || '')}</p>
                            </div>
                        </div>
                    `).join('');
                }
            }

            // D. Welcome Section
            if (hp.welcome) {
                const wSubtitle = document.getElementById('welcomeHeaderSubtitle') || document.querySelector('.welcome-content .section-header p');
                if (wSubtitle && (hp.welcome.subtitle || hp.welcome.badge)) {
                    wSubtitle.textContent = hp.welcome.subtitle || hp.welcome.badge;
                }

                const wHeading = document.getElementById('welcomeHeading') || document.querySelector('.welcome-content h2');
                if (wHeading && hp.welcome.heading) wHeading.textContent = hp.welcome.heading;

                const wDesc = document.querySelector('.welcome-content > p');
                if (wDesc && hp.welcome.description) wDesc.textContent = hp.welcome.description;

                const wImg = document.querySelector('.welcome-image-card img');
                if (wImg && hp.welcome.image_url) wImg.src = hp.welcome.image_url;

                const wScriptureVerse = document.getElementById('welcomeScriptureVerse') || document.querySelector('.welcome-scripture-pill p');
                if (wScriptureVerse && hp.welcome.scripture_verse) {
                    const rawVerse = hp.welcome.scripture_verse.replace(/^[“"']+|[”"']+$/g, '');
                    wScriptureVerse.textContent = `“${rawVerse}”`;
                }

                const wScriptureRef = document.getElementById('welcomeScriptureRef') || document.querySelector('.welcome-scripture-pill span');
                if (wScriptureRef && (hp.welcome.scripture_badge || hp.welcome.scripture_reference)) {
                    const refText = hp.welcome.scripture_badge || hp.welcome.scripture_reference;
                    wScriptureRef.textContent = refText.startsWith('—') || refText.startsWith('-') ? refText : `— ${refText}`;
                }

                if (Array.isArray(hp.welcome.features) && hp.welcome.features.length > 0) {
                    const featsWrap = document.querySelector('.welcome-features');
                    if (featsWrap) {
                        featsWrap.innerHTML = hp.welcome.features.map(f => `
                            <div class="welcome-feature-item">
                                <i class="fa-solid fa-circle-check"></i>
                                <span>${escapeHtml(f)}</span>
                            </div>
                        `).join('');
                    }
                }
            }

            // E. WORDA 5-Pillar Showcase
            if (Array.isArray(hp.worda) && hp.worda.length > 0) {
                const wordaGrid = document.querySelector('.worda-grid');
                if (wordaGrid) {
                    wordaGrid.innerHTML = hp.worda.map(p => `
                        <div class="worda-card">
                            <span class="worda-number">${escapeHtml(p.number || '')} ${escapeHtml(p.name || '')}</span>
                            <div class="worda-icon"><i class="fa-solid ${escapeHtml(p.icon || 'fa-star')}"></i></div>
                            <h3>${escapeHtml(p.name || '')}</h3>
                            <p style="font-size: 0.85rem; color: var(--gold-dark); margin-bottom: 0.5rem; font-weight: 500;">
                                ${escapeHtml(p.subtitle || '')}
                            </p>
                            <p>${escapeHtml(p.description || '')}</p>
                        </div>
                    `).join('');
                }
            }

            // F. Scripture Spotlight
            if (hp.scripture) {
                const sText = document.querySelector('.scripture-text');
                if (sText && hp.scripture.text) sText.innerHTML = `&ldquo;${escapeHtml(hp.scripture.text)}&rdquo;`;

                const sRef = document.querySelector('.scripture-ref');
                if (sRef && hp.scripture.reference) sRef.innerHTML = `&mdash; ${escapeHtml(hp.scripture.reference)}`;
            }
        }

        // 3. About Us Page (history.html)
        const isAbout = path.includes('history.html') || path.includes('/about');
        if (isAbout) {
            const ab = data.about_us || {};
            if (ab.history) {
                const hHeading = document.querySelector('.history-text h3');
                if (hHeading && ab.history.heading) hHeading.textContent = ab.history.heading;

                const hBody = document.getElementById('historyText');
                if (hBody && ab.history.body) {
                    hBody.innerHTML = ab.history.body.split('\n\n').map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
                }

                const hImg = document.querySelector('.history-img-wrapper img');
                if (hImg && ab.history.image_url) hImg.src = ab.history.image_url;
            }

            if (ab.mission) {
                const mText = document.getElementById('missionText');
                if (mText && ab.mission.body) mText.textContent = ab.mission.body;
            }

            if (ab.vision) {
                const vText = document.getElementById('visionText');
                if (vText && ab.vision.body) vText.textContent = ab.vision.body;
            }
        }

        // 4. Contact Page (contact.html)
        const isContact = path.includes('contact.html') || path.includes('/contact');
        const ct = data.contact_us || {};
        if (isContact && ct) {
            const addrEl = document.getElementById('contactCardLocation') || document.querySelector('.contact-info-card .contact-info-item:nth-of-type(1) p');
            if (addrEl && ct.address) addrEl.textContent = ct.address;

            const phoneEl = document.getElementById('contactCardPhone') || document.querySelector('.contact-info-card .contact-info-item:nth-of-type(2) p');
            if (phoneEl) {
                const pParts = [];
                if (ct.phone) pParts.push(ct.phone);
                if (ct.mobile) pParts.push(ct.mobile);
                if (pParts.length > 0) {
                    phoneEl.innerHTML = pParts.map(escapeHtml).join(' &bull; ');
                }
            }

            const emailEl = document.getElementById('contactCardEmail') || document.querySelector('.contact-info-card .contact-info-item:nth-of-type(3) p');
            if (emailEl && ct.email) {
                emailEl.innerHTML = `<a href="mailto:${escapeHtml(ct.email)}" style="color: inherit; text-decoration: none;">${escapeHtml(ct.email)}</a>`;
            }

            const hoursEl = document.getElementById('contactCardHours') || document.querySelector('.contact-info-card .contact-info-item:nth-of-type(4) p');
            if (hoursEl && ct.office_hours) hoursEl.textContent = ct.office_hours;

            const servicesEl = document.getElementById('contactCardServices');
            if (servicesEl && Array.isArray(hp.schedule) && hp.schedule.length > 0) {
                servicesEl.innerHTML = hp.schedule.map(s => `<strong>${escapeHtml(s.title)}:</strong> ${escapeHtml(s.time)}`).join('<br>');
            }
        }

        // 5. Global Footer across ALL public pages
        const ft = data.footer || {};
        const footerAbout = document.querySelector('.footer-col > p');
        if (footerAbout && ft.about_text) footerAbout.textContent = ft.about_text;

        const ftBottom = document.querySelector('.footer-bottom');
        if (ftBottom) {
            const copyP = ftBottom.querySelector('p:first-child');
            if (copyP && ft.copyright_text) copyP.textContent = ft.copyright_text;
            const tagP = ftBottom.querySelector('p:last-child');
            if (tagP && ft.tagline) tagP.textContent = ft.tagline;
        }

        if (ft.social_links) {
            const fbBtn = document.querySelector('.footer-social-btn[aria-label="Facebook"]');
            if (fbBtn) {
                if (ft.social_links.facebook?.enabled && ft.social_links.facebook?.url) {
                    fbBtn.href = ft.social_links.facebook.url;
                    fbBtn.style.display = 'inline-flex';
                } else if (ft.social_links.facebook?.enabled === false) {
                    fbBtn.style.display = 'none';
                }
            }

            const ytBtn = document.querySelector('.footer-social-btn[aria-label="YouTube"]');
            if (ytBtn) {
                if (ft.social_links.youtube?.enabled && ft.social_links.youtube?.url) {
                    ytBtn.href = ft.social_links.youtube.url;
                    ytBtn.style.display = 'inline-flex';
                } else if (ft.social_links.youtube?.enabled === false) {
                    ytBtn.style.display = 'none';
                }
            }

            const emailBtn = document.querySelector('.footer-social-btn[aria-label="Email"]');
            if (emailBtn) {
                if (ft.social_links.email?.enabled && ft.social_links.email?.url) {
                    emailBtn.href = ft.social_links.email.url;
                    emailBtn.style.display = 'inline-flex';
                } else if (ft.social_links.email?.enabled === false) {
                    emailBtn.style.display = 'none';
                }
            }
        }

        if (Array.isArray(hp.schedule) && hp.schedule.length > 0) {
            const footerSchedCol = document.querySelectorAll('.footer-col')[2];
            if (footerSchedCol && footerSchedCol.querySelector('h3')?.textContent.includes('Schedule')) {
                footerSchedCol.innerHTML = `
                    <h3>Service Schedule</h3>
                    ${hp.schedule.map(s => `
                        <p><strong style="color: var(--gold-light);"><i class="fa-regular fa-calendar-check" style="margin-right: 0.35rem;"></i> ${escapeHtml(s.title)}:</strong><br>${escapeHtml(s.time)}</p>
                    `).join('')}
                `;
            }
        }

        if (ct && (ct.address || ct.phone || ct.email)) {
            const footerInfoCol = document.querySelectorAll('.footer-col')[3];
            if (footerInfoCol && footerInfoCol.querySelector('h3')?.textContent.includes('Info')) {
                const pList = footerInfoCol.querySelectorAll('p');
                if (pList.length >= 3) {
                    if (ct.address) pList[0].innerHTML = `<i class="fa-solid fa-location-dot" style="color: var(--gold); margin-right: 0.5rem;"></i> ${escapeHtml(ct.address)}`;
                    if (ct.phone || ct.mobile) pList[1].innerHTML = `<i class="fa-solid fa-phone" style="color: var(--gold); margin-right: 0.5rem;"></i> ${escapeHtml(ct.phone || ct.mobile)}`;
                    if (ct.email) pList[2].innerHTML = `<i class="fa-solid fa-envelope" style="color: var(--gold); margin-right: 0.5rem;"></i> ${escapeHtml(ct.email)}`;
                }
            }
        }

    } catch (err) {
        console.warn('loadWebsiteDynamicContent notice (using default static template):', err);
    }
}
window.loadWebsiteDynamicContent = loadWebsiteDynamicContent;

function handleRealtimePublicUpdate(eventData) {
    if (!eventData || !eventData.type || eventData.type === 'connected') return;
    const type = eventData.type;
    const path = window.location.pathname.toLowerCase();
    const isHome = path === '/' || path.endsWith('/index.html') || path === '' || path.endsWith('/');

    if (type === 'events') {
        if (typeof window.loadEvents === 'function') window.loadEvents();
        if (isHome && typeof loadHomeEvents === 'function') loadHomeEvents();
    } else if (type === 'sermons' || type === 'content') {
        if (typeof window.loadSermons === 'function') window.loadSermons();
        if (typeof window.loadLiveStream === 'function') window.loadLiveStream();
        if (isHome && typeof loadHomeSermons === 'function') loadHomeSermons();
        if (typeof checkLiveBroadcastBanner === 'function') checkLiveBroadcastBanner();
    } else if (type === 'announcements') {
        if (typeof window.loadAnnouncements === 'function') window.loadAnnouncements();
    } else if (type === 'website_content') {
        loadWebsiteDynamicContent();
        if (typeof window.loadAnnouncements === 'function') window.loadAnnouncements();
    }
}

function initPublicRealtimeSync() {
    if (churchBroadcastChannel) {
        churchBroadcastChannel.onmessage = (e) => {
            handleRealtimePublicUpdate(e.data);
        };
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'church_realtime_ping' && e.newValue) {
            try {
                const data = JSON.parse(e.newValue);
                handleRealtimePublicUpdate(data);
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
                        handleRealtimePublicUpdate(payload);
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

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    highlightActiveNav();
    initHeroVideo();
    loadHero();

    // Only run homepage 3-item snippet loaders on the homepage, preventing overwrite on events.html / sermons.html
    const path = window.location.pathname.toLowerCase();
    const isHome = path === '/' || path.endsWith('/index.html') || path === '' || path.endsWith('/');
    if (isHome) {
        loadHomeSermons();
        loadHomeEvents();
    }

    initContactForm();
    checkLiveBroadcastBanner();
    initScrollAnimations();
    loadWebsiteDynamicContent();
    initPublicRealtimeSync();
});