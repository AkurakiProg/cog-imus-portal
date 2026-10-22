/**
 * Multi-Factor Authentication (MFA / 2FA) Frontend Controller
 * Handles enrollment with QR codes, recovery codes, re-authentication, and status management.
 */

let _currentMfaSetupKey = '';
let _currentRecoveryCodes = [];
let _mfaReauthAction = null; // 'disable' | 'regenerate'

function showMfaModalAlert(message, type = 'error') {
    const alert = document.getElementById('mfaModalAlert');
    if (!alert) return;
    alert.textContent = message;
    alert.className = `alert alert-${type}`;
    alert.style.display = 'block';
}

function clearMfaModalAlert() {
    const alert = document.getElementById('mfaModalAlert');
    if (alert) alert.style.display = 'none';
}

function openMfaSecurityModal() {
    const modal = document.getElementById('mfaSecurityModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.style.display = 'flex';
    clearMfaModalAlert();
    loadMfaSecurityStatus();
}

function closeMfaSecurityModal() {
    const modal = document.getElementById('mfaSecurityModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = '';
    modal.style.removeProperty('display');
    clearMfaModalAlert();
}

function setMfaModalState(stateName) {
    clearMfaModalAlert();
    const states = ['mfaStateStatus', 'mfaStateEnroll', 'mfaStateRecoveryCodes', 'mfaStateReauth'];
    states.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === stateName) ? 'block' : 'none';
    });
}

async function loadMfaSecurityStatus() {
    setMfaModalState('mfaStateStatus');
    const badge = document.getElementById('mfaStatusBadge');
    const desc = document.getElementById('mfaStatusDesc');
    const enrolledDetails = document.getElementById('mfaEnrolledDetails');
    const enrolledDate = document.getElementById('mfaEnrolledDate');
    const recoveryCount = document.getElementById('mfaRecoveryCount');
    const disabledActions = document.getElementById('mfaDisabledActions');
    const enabledActions = document.getElementById('mfaEnabledActions');

    if (badge) {
        badge.textContent = 'Checking...';
        badge.style.background = '#f1f5f9';
        badge.style.color = '#64748b';
    }

    try {
        const res = await api.auth.getMfaStatus();
        const { mfaEnabled, enrolledAt, recoveryCodesRemaining } = res.data;

        if (mfaEnabled) {
            if (badge) {
                badge.innerHTML = '<i class="fa-solid fa-shield-check mr-1"></i> Active & Protected';
                badge.style.background = '#ecfdf5';
                badge.style.color = '#059669';
                badge.style.border = '1px solid #a7f3d0';
            }
            if (desc) {
                desc.textContent = 'Two-Factor Authentication is currently protecting your account. You will be prompted for an authenticator code whenever you log in.';
            }
            if (enrolledDetails) enrolledDetails.style.display = 'block';
            if (enrolledDate) {
                enrolledDate.textContent = enrolledAt ? new Date(enrolledAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Enabled';
            }
            if (recoveryCount) {
                recoveryCount.textContent = `${recoveryCodesRemaining} code(s) remaining`;
                if (recoveryCodesRemaining <= 2) {
                    recoveryCount.style.color = '#dc2626';
                    recoveryCount.textContent += ' (Low - consider regenerating)';
                } else {
                    recoveryCount.style.color = 'var(--gold-dark)';
                }
            }
            if (disabledActions) disabledActions.style.display = 'none';
            if (enabledActions) enabledActions.style.display = 'flex';
        } else {
            if (badge) {
                badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-1"></i> Disabled (Recommended to Enable)';
                badge.style.background = '#fef2f2';
                badge.style.color = '#dc2626';
                badge.style.border = '1px solid #fecaca';
            }
            if (desc) {
                desc.textContent = 'Protect your church portal account by requiring a 6-digit verification code from an authenticator app (Google Authenticator, Microsoft Authenticator, etc.) whenever you sign in.';
            }
            if (enrolledDetails) enrolledDetails.style.display = 'none';
            if (disabledActions) disabledActions.style.display = 'block';
            if (enabledActions) enabledActions.style.display = 'none';
        }
    } catch (error) {
        showMfaModalAlert('Failed to load MFA status: ' + error.message, 'error');
    }
}

async function startMfaSetup() {
    setMfaModalState('mfaStateEnroll');
    const qrLoading = document.getElementById('mfaQrLoading');
    const qrImage = document.getElementById('mfaQrImage');
    const manualKey = document.getElementById('mfaManualKey');
    const enrollInput = document.getElementById('mfaEnrollCode');

    if (qrLoading) qrLoading.style.display = 'block';
    if (qrImage) qrImage.style.display = 'none';
    if (manualKey) manualKey.textContent = 'Generating...';
    if (enrollInput) enrollInput.value = '';

    try {
        const res = await api.auth.startMfaEnrollment();
        const { qrCode, setupKey } = res.data;
        _currentMfaSetupKey = setupKey;

        if (qrImage) {
            qrImage.src = qrCode;
            qrImage.onload = () => {
                if (qrLoading) qrLoading.style.display = 'none';
                qrImage.style.display = 'block';
            };
        }
        if (manualKey) manualKey.textContent = setupKey;
        setTimeout(() => enrollInput && enrollInput.focus(), 200);

    } catch (error) {
        showMfaModalAlert(error.message || 'Failed to initiate 2FA enrollment. Please try again.', 'error');
        if (qrLoading) qrLoading.style.display = 'none';
    }
}

function copyMfaKey() {
    if (!_currentMfaSetupKey) return;
    navigator.clipboard.writeText(_currentMfaSetupKey).then(() => {
        if (typeof showToast === 'function') {
            showToast('Setup key copied to clipboard!');
        } else {
            alert('Setup key copied to clipboard!');
        }
    }).catch(() => {
        prompt('Copy your setup key manually:', _currentMfaSetupKey);
    });
}

async function confirmMfaSetup(e) {
    if (e) e.preventDefault();
    const codeInput = document.getElementById('mfaEnrollCode');
    const token = codeInput ? codeInput.value.trim() : '';

    if (!token || token.length !== 6) {
        showMfaModalAlert('Please enter the 6-digit verification code from your authenticator app.', 'error');
        return;
    }

    const submitBtn = document.getElementById('btnConfirmMfa');
    const submitText = document.getElementById('btnConfirmMfaText');
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.innerText = 'Verifying Code...';

    try {
        const res = await api.auth.confirmMfaEnrollment(token);
        _currentRecoveryCodes = res.data.recoveryCodes || [];

        renderRecoveryCodesDisplay(_currentRecoveryCodes);
        setMfaModalState('mfaStateRecoveryCodes');

        if (typeof showToast === 'function') {
            showToast('Two-Factor Authentication activated successfully!');
        }
    } catch (error) {
        showMfaModalAlert(error.message || 'Verification failed. Please verify the 6-digit code and make sure your phone clock is synced.', 'error');
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.innerText = 'Confirm & Enable 2FA';
        if (codeInput) {
            codeInput.value = '';
            codeInput.focus();
        }
    }
}

function renderRecoveryCodesDisplay(codes) {
    const grid = document.getElementById('mfaRecoveryGrid');
    if (!grid) return;
    grid.innerHTML = (codes || []).map(code => `
        <div style="background: #fff; padding: 0.5rem; border-radius: 6px; border: 1px solid #e2e8f0; letter-spacing: 1px;">
            ${code}
        </div>
    `).join('');
}

function copyRecoveryCodes() {
    if (!_currentRecoveryCodes || _currentRecoveryCodes.length === 0) return;
    const text = "CHURCH OF GOD IMUS PORTAL - BACKUP RECOVERY CODES\n" +
                 "Keep these codes in a safe place. Each code can only be used once.\n\n" +
                 _currentRecoveryCodes.join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
        if (typeof showToast === 'function') {
            showToast('All recovery codes copied to clipboard!');
        } else {
            alert('All recovery codes copied to clipboard!');
        }
    }).catch(() => {
        prompt('Copy your recovery codes:', _currentRecoveryCodes.join(' '));
    });
}

function downloadRecoveryCodes() {
    if (!_currentRecoveryCodes || _currentRecoveryCodes.length === 0) return;
    const content = "CHURCH OF GOD WORLD MISSIONS PHILIPPINES - IMUS\n" +
                    "ACCOUNT TWO-FACTOR BACKUP RECOVERY CODES\n" +
                    "Generated on: " + new Date().toLocaleString() + "\n" +
                    "--------------------------------------------------\n" +
                    "WARNING: Keep these backup recovery codes safe.\n" +
                    "If you lose access to your authenticator app, these\n" +
                    "codes are the ONLY way to recover your account.\n" +
                    "Each code can only be used once.\n" +
                    "--------------------------------------------------\n\n" +
                    _currentRecoveryCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
                    "\n\n--------------------------------------------------\n";

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `COG-Imus-Backup-Recovery-Codes-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') {
        showToast('Backup codes downloaded as text file.');
    }
}

function promptDisableMfa() {
    _mfaReauthAction = 'disable';
    setMfaModalState('mfaStateReauth');
    const title = document.getElementById('mfaReauthTitle');
    const desc = document.getElementById('mfaReauthDesc');
    const btnText = document.getElementById('btnSubmitReauthText');

    if (title) title.textContent = 'Disable Two-Factor Authentication';
    if (desc) desc.textContent = 'To disable Two-Factor Authentication, please enter your current account password or valid authenticator code.';
    if (btnText) btnText.textContent = 'Disable 2FA';

    const passInput = document.getElementById('mfaReauthPassword');
    const codeInput = document.getElementById('mfaReauthCode');
    if (passInput) passInput.value = '';
    if (codeInput) codeInput.value = '';
    setTimeout(() => passInput && passInput.focus(), 150);
}

function promptRegenerateRecoveryCodes() {
    _mfaReauthAction = 'regenerate';
    setMfaModalState('mfaStateReauth');
    const title = document.getElementById('mfaReauthTitle');
    const desc = document.getElementById('mfaReauthDesc');
    const btnText = document.getElementById('btnSubmitReauthText');

    if (title) title.textContent = 'Regenerate Backup Recovery Codes';
    if (desc) desc.textContent = 'Generating new recovery codes will immediately invalidate all previously issued backup codes. Please enter your password or authenticator code to proceed.';
    if (btnText) btnText.textContent = 'Generate New Codes';

    const passInput = document.getElementById('mfaReauthPassword');
    const codeInput = document.getElementById('mfaReauthCode');
    if (passInput) passInput.value = '';
    if (codeInput) codeInput.value = '';
    setTimeout(() => passInput && passInput.focus(), 150);
}

async function submitMfaReauth(e) {
    if (e) e.preventDefault();
    const password = document.getElementById('mfaReauthPassword')?.value || '';
    const code = document.getElementById('mfaReauthCode')?.value.trim() || '';

    if (!password && !code) {
        showMfaModalAlert('Please enter either your password or 6-digit authenticator code.', 'error');
        return;
    }

    const submitBtn = document.getElementById('btnSubmitReauth');
    const submitText = document.getElementById('btnSubmitReauthText');
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.innerText = 'Verifying...';

    try {
        if (_mfaReauthAction === 'disable') {
            await api.auth.disableMfa({ password, code });
            if (typeof showToast === 'function') {
                showToast('Two-Factor Authentication has been disabled.');
            }
            loadMfaSecurityStatus();
        } else if (_mfaReauthAction === 'regenerate') {
            const res = await api.auth.regenerateRecoveryCodes({ password, code });
            _currentRecoveryCodes = res.data.recoveryCodes || [];
            renderRecoveryCodesDisplay(_currentRecoveryCodes);
            setMfaModalState('mfaStateRecoveryCodes');
            if (typeof showToast === 'function') {
                showToast('New backup recovery codes generated!');
            }
        }
    } catch (error) {
        showMfaModalAlert(error.message || 'Authentication failed. Please verify your credentials.', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) {
            submitText.innerText = _mfaReauthAction === 'disable' ? 'Disable 2FA' : 'Generate New Codes';
        }
    }
}
