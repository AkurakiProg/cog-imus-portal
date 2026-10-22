document.addEventListener('DOMContentLoaded', () => {
    // Purge any lingering legacy localStorage session tokens
    localStorage.removeItem('church_token');
    localStorage.removeItem('church_user');

    // If user already has a valid token in this active tab session, redirect directly
    const token = sessionStorage.getItem('church_token');
    if (token) {
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
    const urlParams = new URLSearchParams(window.location.search);
    const verifiedStatus = urlParams.get('verified');
    if (verifiedStatus === 'success') {
        showAlert('✅ Your account has been verified and activated successfully! You may now sign in.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (verifiedStatus === 'expired') {
        showAlert('⚠️ This verification link has expired (valid for 24 hours). Please request a new activation link.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (verifiedStatus === 'invalid') {
        showAlert('❌ Invalid activation link. Please ensure you used the correct link or contact the administrator.', 'error');
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
                
                // Purge localStorage
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
});