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
            ${isFeatured ? `<span style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); padding: 1px 8px; border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-star text-2xs"></i> Featured on Homepage</span>` : ''}
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
                            <span class="card-badge-pill badge-featured" style="position: static;"><i class="fa-solid fa-star"></i> Featured on Homepage</span>
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
    initPublicRealtimeSync();
});