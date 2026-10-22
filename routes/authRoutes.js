const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter, mfaLimiter } = require('../middleware/rateLimiter');

// Login and Registration
router.post('/login', authLimiter, authController.login);
router.post('/register', authLimiter, authController.register);
router.post('/logout', authMiddleware, authController.logout);
router.get('/check-session', authMiddleware, authController.checkSession);
router.get('/me', authMiddleware, authController.getMe);
router.put('/update-password', authMiddleware, authController.updatePassword);

// Multi-Factor Authentication (MFA) Routes
router.post('/mfa/verify', mfaLimiter, authController.verifyMfaLogin);
router.post('/mfa/recovery', mfaLimiter, authController.verifyMfaRecovery);
router.get('/mfa/status', authMiddleware, authController.getMfaStatus);
router.post('/mfa/enroll/start', authMiddleware, mfaLimiter, authController.startMfaEnrollment);
router.post('/mfa/enroll/confirm', authMiddleware, mfaLimiter, authController.confirmMfaEnrollment);
router.post('/mfa/disable', authMiddleware, mfaLimiter, authController.disableMfa);
router.post('/mfa/recovery-codes/regenerate', authMiddleware, mfaLimiter, authController.regenerateRecoveryCodes);

module.exports = router;