const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// SMS Gateway Settings & Verification / Test - Admin and Church Leader
router.get('/sms-settings', authMiddleware, roleMiddleware('Admin', 'Church Leader'), systemController.getSmsSettings);
router.put('/sms-settings', authMiddleware, roleMiddleware('Admin', 'Church Leader'), systemController.updateSmsSettings);
router.post('/send-test-sms', authMiddleware, roleMiddleware('Admin', 'Church Leader'), systemController.sendTestSms);

// Database Backup - Admin only
router.get('/backup', authMiddleware, roleMiddleware('Admin'), systemController.backupDatabase);

module.exports = router;
