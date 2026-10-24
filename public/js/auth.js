document.addEventListener('DOMContentLoaded', () => {
    // Purge any lingering legacy localStorage session tokens
    localStorage.removeItem('church_token');
    localStorage.removeItem('church_user');

    // Check if preview mode requested from CMS admin
    const urlParams = new URLSearchParams(window.location.search);
    const isCmsPreview = urlParams.get('preview') === 'cms' || urlParams.get('preview') === '1';

    // If user already has a valid token in this active tab session, redirect directly (unless previewing from CMS)
    const token = sessionStorage.getItem('church_token');
    if (token && !isCmsPreview) {
        redirectBasedOnRole();
    }

    const loginForm = document.getElementById('loginForm');
    const alertBox = document.getElementById('alertMessage');

    function showAlert(message, type) {
        if (!alertBox) return;
        alertBox.textContent = message;
        alertBox.className = `alert alert-${type}`;
        alertBox.style.display = 'block';
    }

    // Check if user arrived via email verification activation link
    const verifiedStatus = urlParams.get('verified');
    if (verifiedStatus === 'success') {
        showAlert('✅ Your account has been verified and activated successfully! You may now sign in.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (verifiedStatus === 'expired') {
        showAlert('⚠️ This verification link has expired (valid for 24 hours). Please request a new activation link.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (verifiedStatus === 'invalid') {
        showAlert('ℹ️ This activation link is invalid or has already been used. If your account is already active, please sign in below.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (verifiedStatus === 'error') {
        showAlert('❌ An error occurred during account activation. Please try again or contact the administrator.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if session was terminated due to concurrent login, server offline, etc.
    const logoutReason = sessionStorage.getItem('auth_logout_reason');
    if (logoutReason === 'concurrent_login') {
        sessionStorage.removeItem('auth_logout_reason');
        showAlert('Security Notice: You were logged out because your account logged in on another device or browser.', 'error');
    } else if (logoutReason === 'server_offline') {
        sessionStorage.removeItem('auth_logout_reason');
        showAlert('Notice: You were automatically logged out because the server was turned off or disconnected.', 'error');
    } else if (logoutReason === 'role_changed') {
        sessionStorage.removeItem('auth_logout_reason');
        showAlert('Security Notice: Your account role was updated by Church Administration. Please log in again to access your updated dashboard.', 'info');
    } else if (logoutReason === 'unauthorized') {
        sessionStorage.removeItem('auth_logout_reason');
        showAlert('Notice: Your session has expired. Please log in again.', 'error');
    }

    let currentMfaChallengeToken = null;
    let isRecoveryMode = false;

    const mfaContainer = document.getElementById('mfaContainer');
    const mfaForm = document.getElementById('mfaForm');
    const mfaCodeInput = document.getElementById('mfaCode');
    const mfaRecoveryInput = document.getElementById('mfaRecoveryCode');
    const mfaCodeGroup = document.getElementById('mfaCodeGroup');
    const mfaRecoveryGroup = document.getElementById('mfaRecoveryGroup');
    const toggleRecoveryLink = document.getElementById('toggleRecoveryLink');
    const cancelMfaLink = document.getElementById('cancelMfaLink');
    const btnVerifyMfa = document.getElementById('btnVerifyMfa');
    const btnVerifyText = document.getElementById('btnVerifyText');

    // --- Password Visibility Toggle ---
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            togglePasswordBtn.innerHTML = isPassword 
                ? '<i class="fa-regular fa-eye-slash"></i>' 
                : '<i class="fa-regular fa-eye"></i>';
            togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
            passwordInput.focus();
        });
    }

    // --- Cinematic Background Video & Motion Controller ---
    const authVideo = document.getElementById('authVideo');
    const authMotionBtn = document.getElementById('authMotionBtn');
    const authVideoContainer = document.getElementById('authVideoContainer');

    if (authVideo) {
        authVideo.muted = true;
        authVideo.defaultMuted = true;
        authVideo.setAttribute('playsinline', '');
        authVideo.setAttribute('webkit-playsinline', '');

        const updateMotionButton = (isPlaying) => {
            if (!authMotionBtn) return;
            if (isPlaying) {
                authMotionBtn.innerHTML = '<i class="fa-solid fa-pause"></i><span>Motion</span>';
                authMotionBtn.setAttribute('aria-label', 'Pause background video');
            } else {
                authMotionBtn.innerHTML = '<i class="fa-solid fa-play"></i><span>Motion</span>';
                authMotionBtn.setAttribute('aria-label', 'Play background video');
            }
        };

        authVideo.addEventListener('playing', () => {
            if (authVideoContainer) authVideoContainer.classList.remove('video-fallback');
            updateMotionButton(true);
        });

        authVideo.addEventListener('pause', () => {
            updateMotionButton(false);
        });

        authVideo.addEventListener('error', () => {
            if (authVideoContainer) authVideoContainer.classList.add('video-fallback');
            updateMotionButton(false);
        });

        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            authVideo.pause();
            if (authVideoContainer) authVideoContainer.classList.add('video-fallback');
            updateMotionButton(false);
        } else {
            const playPromise = authVideo.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    if (authVideoContainer) authVideoContainer.classList.remove('video-fallback');
                    updateMotionButton(true);
                }).catch(() => {
                    updateMotionButton(false);
                    const resumeOnInteraction = () => {
                        authVideo.play().then(() => {
                            if (authVideoContainer) authVideoContainer.classList.remove('video-fallback');
                            updateMotionButton(true);
                        }).catch(() => {});
                        window.removeEventListener('click', resumeOnInteraction);
                        window.removeEventListener('touchstart', resumeOnInteraction);
                    };
                    window.addEventListener('click', resumeOnInteraction, { once: true, passive: true });
                    window.addEventListener('touchstart', resumeOnInteraction, { once: true, passive: true });
                });
            }
        }

        if (authMotionBtn) {
            authMotionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (authVideo.paused) {
                    if (authVideoContainer) authVideoContainer.classList.remove('video-fallback');
                    authVideo.play().catch(() => {});
                } else {
                    authVideo.pause();
                }
            });
        }
    }

    function resetToLoginForm() {
        currentMfaChallengeToken = null;
        if (mfaContainer) mfaContainer.style.display = 'none';
        if (loginForm) loginForm.style.display = 'block';
        if (mfaCodeInput) mfaCodeInput.value = '';
        if (mfaRecoveryInput) mfaRecoveryInput.value = '';
        const submitBtn = document.getElementById('btnLogin');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Sign In to Portal</span> <i class="fa-solid fa-arrow-right-to-bracket"></i>';
        }
    }

    // Auto-format recovery code input (e.g. A1B2-C3D4)
    if (mfaRecoveryInput) {
        mfaRecoveryInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (val.length > 4) {
                val = val.slice(0, 4) + '-' + val.slice(4, 8);
            }
            e.target.value = val;
        });
    }

    // Auto-advance TOTP input when 6 digits are typed
    if (mfaCodeInput) {
        mfaCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }

    // --- Sign In Handler ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const identifier = document.getElementById('identifier').value.trim();
            const password = document.getElementById('password').value;

            if (!identifier || !password) {
                showAlert('Please fill in both identifier and password.', 'error');
                return;
            }

            const submitBtn = document.getElementById('btnLogin');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Signing In...</span>';

            try {
                const response = await api.auth.login(identifier, password);
                
                // Check if Multi-Factor Authentication (2FA) challenge is required
                if (response.data && response.data.mfaRequired) {
                    currentMfaChallengeToken = response.data.mfaChallengeToken;
                    loginForm.style.display = 'none';
                    if (mfaContainer) mfaContainer.style.display = 'block';
                    isRecoveryMode = false;
                    if (mfaCodeGroup) mfaCodeGroup.style.display = 'block';
                    if (mfaRecoveryGroup) mfaRecoveryGroup.style.display = 'none';
                    if (toggleRecoveryLink) {
                        toggleRecoveryLink.innerHTML = '<i class="fa-solid fa-key mr-1"></i> Use a backup recovery code instead';
                    }
                    if (alertBox) alertBox.style.display = 'none';
                    setTimeout(() => mfaCodeInput && mfaCodeInput.focus(), 150);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>Sign In to Portal</span> <i class="fa-solid fa-arrow-right-to-bracket"></i>';
                    return;
                }

                // Store in sessionStorage so closing the tab or browser app immediately logs out
                sessionStorage.setItem('church_token', response.data.token);
                sessionStorage.setItem('church_user', JSON.stringify(response.data.user));
                
                // Store user-scoped theme preference
                const loggedInUser = response.data.user;
                if (loggedInUser && loggedInUser.user_id) {
                    const userTheme = loggedInUser.theme_preference || localStorage.getItem(`church_theme_user_${loggedInUser.user_id}`) || 'system';
                    localStorage.setItem(`church_theme_user_${loggedInUser.user_id}`, userTheme);
                    localStorage.setItem('church_active_user_theme', userTheme);
                    localStorage.setItem('church_active_user_id', String(loggedInUser.user_id));
                }

                // Purge localStorage auth tokens
                localStorage.removeItem('church_token');
                localStorage.removeItem('church_user');
                
                showAlert('Login successful! Redirecting...', 'success');
                
                setTimeout(() => {
                    redirectBasedOnRole(response.data.user.role_name);
                }, 700);

            } catch (error) {
                showAlert(error.message || 'Login failed. Please verify your credentials.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Sign In to Portal</span> <i class="fa-solid fa-arrow-right-to-bracket"></i>';
            }
        });
    }

    // --- MFA Verification Handler ---
    if (mfaForm) {
        mfaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentMfaChallengeToken) {
                showAlert('Authentication session lost. Please sign in again.', 'error');
                resetToLoginForm();
                return;
            }

            btnVerifyMfa.disabled = true;
            if (btnVerifyText) btnVerifyText.innerText = 'Verifying...';

            try {
                let response;
                if (isRecoveryMode) {
                    const recoveryCode = mfaRecoveryInput ? mfaRecoveryInput.value.trim() : '';
                    if (!recoveryCode) {
                        showAlert('Please enter your backup recovery code.', 'error');
                        btnVerifyMfa.disabled = false;
                        if (btnVerifyText) btnVerifyText.innerText = 'Verify & Sign In';
                        return;
                    }
                    response = await api.auth.verifyMfaRecovery(currentMfaChallengeToken, recoveryCode);
                } else {
                    const code = mfaCodeInput ? mfaCodeInput.value.trim() : '';
                    if (!code || code.length !== 6) {
                        showAlert('Please enter a valid 6-digit code from your authenticator app.', 'error');
                        btnVerifyMfa.disabled = false;
                        if (btnVerifyText) btnVerifyText.innerText = 'Verify & Sign In';
                        return;
                    }
                    response = await api.auth.verifyMfa(currentMfaChallengeToken, code);
                }

                sessionStorage.setItem('church_token', response.data.token);
                sessionStorage.setItem('church_user', JSON.stringify(response.data.user));

                // Store user-scoped theme preference
                const mfaUser = response.data.user;
                if (mfaUser && mfaUser.user_id) {
                    const userTheme = mfaUser.theme_preference || localStorage.getItem(`church_theme_user_${mfaUser.user_id}`) || 'system';
                    localStorage.setItem(`church_theme_user_${mfaUser.user_id}`, userTheme);
                    localStorage.setItem('church_active_user_theme', userTheme);
                    localStorage.setItem('church_active_user_id', String(mfaUser.user_id));
                }

                localStorage.removeItem('church_token');
                localStorage.removeItem('church_user');

                showAlert('Two-factor verification successful! Redirecting...', 'success');

                setTimeout(() => {
                    redirectBasedOnRole(response.data.user.role_name);
                }, 700);

            } catch (err) {
                showAlert(err.message || 'Verification failed. Please try again.', 'error');
                btnVerifyMfa.disabled = false;
                if (btnVerifyText) btnVerifyText.innerText = 'Verify & Sign In';
                if (!isRecoveryMode && mfaCodeInput) {
                    mfaCodeInput.value = '';
                    mfaCodeInput.focus();
                }
            }
        });
    }

    if (toggleRecoveryLink) {
        toggleRecoveryLink.addEventListener('click', (e) => {
            e.preventDefault();
            isRecoveryMode = !isRecoveryMode;
            if (isRecoveryMode) {
                if (mfaCodeGroup) mfaCodeGroup.style.display = 'none';
                if (mfaRecoveryGroup) mfaRecoveryGroup.style.display = 'block';
                toggleRecoveryLink.innerHTML = '<i class="fa-solid fa-mobile-screen mr-1"></i> Use authenticator app code instead';
                if (mfaRecoveryInput) mfaRecoveryInput.focus();
            } else {
                if (mfaCodeGroup) mfaCodeGroup.style.display = 'block';
                if (mfaRecoveryGroup) mfaRecoveryGroup.style.display = 'none';
                toggleRecoveryLink.innerHTML = '<i class="fa-solid fa-key mr-1"></i> Use a backup recovery code instead';
                if (mfaCodeInput) mfaCodeInput.focus();
            }
            if (alertBox) alertBox.style.display = 'none';
        });
    }

    if (cancelMfaLink) {
        cancelMfaLink.addEventListener('click', (e) => {
            e.preventDefault();
            resetToLoginForm();
            if (alertBox) alertBox.style.display = 'none';
        });
    }

    function redirectBasedOnRole(roleName) {
        let role = roleName;
        if (!role) {
            try {
                const storedUser = JSON.parse(sessionStorage.getItem('church_user'));
                role = storedUser ? storedUser.role_name : null;
            } catch (e) {
                role = null;
            }
        }

        if (!role) {
            sessionStorage.removeItem('church_token');
            return;
        }

        switch(role) {
            case 'Admin':
                window.location.href = '/views/admin-dashboard.html';
                break;
            case 'Church Leader':
                window.location.href = '/views/leader-dashboard.html';
                break;
            case 'Church Member':
                window.location.href = '/views/member-dashboard.html';
                break;
            default:
                window.location.href = '/';
        }
    }

    // Hydrate dynamic login page content (logo, video, inspiration panel)
    loadAuthPageDynamicContent();

    // Listen for realtime storage pings from admin CMS updates
    window.addEventListener('storage', (e) => {
        if (e.key === 'church_realtime_ping' && e.newValue) {
            try {
                const pingData = JSON.parse(e.newValue);
                if (pingData.type === 'website_content' || pingData.type === 'content') {
                    loadAuthPageDynamicContent();
                }
            } catch (err) {}
        }
    });

    try {
        const authBroadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('church_realtime_channel') : null;
        if (authBroadcastChannel) {
            authBroadcastChannel.onmessage = (event) => {
                const data = event.data;
                if (data && (data.type === 'website_content' || data.type === 'content')) {
                    loadAuthPageDynamicContent();
                }
            };
        }
    } catch (e) {}

    // Also connect to server SSE stream for real-time synchronization across devices
    if (typeof EventSource !== 'undefined') {
        let authSse = null;
        function connectAuthSse() {
            try {
                authSse = new EventSource('/api/realtime/stream');
                authSse.onmessage = (e) => {
                    try {
                        const payload = JSON.parse(e.data);
                        if (payload && (payload.type === 'website_content' || payload.type === 'content')) {
                            loadAuthPageDynamicContent();
                        }
                    } catch (err) {}
                };
                authSse.onerror = () => {
                    if (authSse) { authSse.close(); authSse = null; }
                    setTimeout(connectAuthSse, 6000);
                };
            } catch (err) {}
        }
        connectAuthSse();
    }
});

// ==================== DYNAMIC CMS LOGIN PAGE HYDRATION ====================
function escapeAuthHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadAuthPageDynamicContent() {
    try {
        let data = null;
        const apiObj = (typeof window !== 'undefined' && window.api) || (typeof api !== 'undefined' ? api : null);
        if (apiObj && apiObj.public && typeof apiObj.public.getWebsiteContent === 'function') {
            try {
                const res = await apiObj.public.getWebsiteContent('all');
                data = res?.data;
            } catch (err) {
                console.warn('api.public.getWebsiteContent notice:', err);
            }
        }
        if (!data) {
            try {
                const res = await fetch('/api/public/website/all');
                if (res.ok) {
                    const json = await res.json();
                    data = json?.data;
                }
            } catch (err) {
                console.warn('Direct fetch /api/public/website/all notice:', err);
            }
        }
        if (!data) return;

        // 1. Branding: Topbar Logo Icon
        const hp = data.homepage || {};
        const logoIcon = hp.logo_icon || data.site_branding?.top_logo;
        const authBrand = document.querySelector('.auth-brand');
        if (authBrand) {
            const existingIcon = authBrand.querySelector('.auth-brand-icon, .auth-brand-custom-img, #authBrandIcon');
            if (logoIcon && logoIcon !== '/images/logo.png' && logoIcon !== '') {
                if (existingIcon) {
                    if (existingIcon.tagName === 'IMG') {
                        existingIcon.src = encodeURI(logoIcon);
                    } else {
                        const img = document.createElement('img');
                        img.id = 'authBrandIcon';
                        img.src = encodeURI(logoIcon);
                        img.alt = 'Church Logo';
                        img.className = 'auth-brand-custom-img';
                        existingIcon.replaceWith(img);
                    }
                }
            } else {
                if (existingIcon && existingIcon.tagName === 'IMG') {
                    const div = document.createElement('div');
                    div.id = 'authBrandIcon';
                    div.className = 'auth-brand-icon';
                    div.innerHTML = '<i class="fa-solid fa-cross"></i>';
                    existingIcon.replaceWith(div);
                }
            }
        }

        // 2. Cinematic Background Video
        if (hp.background_video && hp.background_video.video_url) {
            const videoEl = document.getElementById('authVideo');
            if (videoEl) {
                const sourceEl = videoEl.querySelector('source');
                const currentSrc = (sourceEl ? sourceEl.getAttribute('src') : '') || videoEl.getAttribute('src') || '';
                const targetUrl = hp.background_video.video_url;
                if (targetUrl && currentSrc !== targetUrl) {
                    videoEl.innerHTML = `<source src="${encodeURI(targetUrl)}" type="video/mp4">`;
                    videoEl.src = encodeURI(targetUrl);
                    if (hp.background_video.poster_url) {
                        videoEl.poster = encodeURI(hp.background_video.poster_url);
                    }
                    videoEl.load();
                    videoEl.play().catch(() => {});
                }
            }
        }

        // 3. Left-Side Community Inspiration & Identity Panel
        let authPage = data.auth_page || {};
        if (typeof authPage === 'string') {
            try { authPage = JSON.parse(authPage); } catch (e) { authPage = {}; }
        }
        const insp = authPage.inspiration || authPage;

        // Kicker
        const kickerEl = document.getElementById('authInspirationKicker');
        if (kickerEl && insp.kicker !== undefined && insp.kicker !== null && insp.kicker !== '') {
            kickerEl.innerHTML = `<i class="fa-solid fa-cross"></i> <span>${escapeAuthHtml(insp.kicker)}</span>`;
        }

        // Main Title (Typography: Line 1 + Line 2 with <em>)
        const titleEl = document.getElementById('authInspirationTitle');
        if (titleEl) {
            const l1 = insp.title_line1;
            const l2 = insp.title_line2;
            if (l1 && l2) {
                titleEl.innerHTML = `${escapeAuthHtml(l1)} <em>${escapeAuthHtml(l2)}</em>`;
            } else if (insp.title && insp.title.includes('<em>')) {
                titleEl.innerHTML = insp.title;
            } else if (insp.title && insp.title.includes(',')) {
                const parts = insp.title.split(',');
                const first = parts[0].trim() + ',';
                const second = parts.slice(1).join(',').trim();
                titleEl.innerHTML = `${escapeAuthHtml(first)} <em>${escapeAuthHtml(second)}</em>`;
            } else if (insp.title) {
                titleEl.textContent = insp.title;
            }
        }

        // Narrative Description
        const descEl = document.getElementById('authInspirationDesc');
        if (descEl && insp.description !== undefined && insp.description !== null) {
            descEl.textContent = insp.description;
        }

        // Scripture Verse
        const verseEl = document.getElementById('authInspirationScriptureVerse');
        if (verseEl && insp.scripture_verse !== undefined && insp.scripture_verse !== null) {
            verseEl.innerHTML = `&ldquo;${escapeAuthHtml(insp.scripture_verse)}&rdquo;`;
        }

        // Scripture Citation / Reference
        const refEl = document.getElementById('authInspirationScriptureRef');
        if (refEl && insp.scripture_reference !== undefined && insp.scripture_reference !== null) {
            refEl.innerHTML = `&mdash; ${escapeAuthHtml(insp.scripture_reference)}`;
        }

        // Trust Pillars
        const pillarsContainer = document.getElementById('authInspirationPillars');
        const p1Val = insp.trust_pillar_1 || (Array.isArray(insp.trust_pillars) ? insp.trust_pillars[0] : null);
        const p2Val = insp.trust_pillar_2 || (Array.isArray(insp.trust_pillars) ? insp.trust_pillars[1] : null);
        const p1El = document.getElementById('authInspirationPillar1');
        const p2El = document.getElementById('authInspirationPillar2');
        if (p1El && p1Val !== undefined && p1Val !== null) p1El.textContent = p1Val;
        if (p2El && p2Val !== undefined && p2Val !== null) p2El.textContent = p2Val;

    } catch (err) {
        console.warn('Failed to hydrate login dynamic content:', err);
    }
}

// Run immediately if DOM is already parsed, or when DOMContentLoaded fires
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAuthPageDynamicContent);
    } else {
        loadAuthPageDynamicContent();
    }
}
window.loadAuthPageDynamicContent = loadAuthPageDynamicContent;
