const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// View announcements - Available to Admin, Leader, and Member
router.get('/', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), announcementController.getAll);
router.get('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), announcementController.getById);

// Create, Update, Delete, Email Broadcast - Admin and Church Leader
router.post('/', authMiddleware, roleMiddleware('Admin', 'Church Leader'), announcementController.create);
router.put('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader'), announcementController.update);
router.delete('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader'), announcementController.delete);
router.post('/:id/trigger-email', authMiddleware, roleMiddleware('Admin', 'Church Leader'), announcementController.triggerEmailBroadcast);
router.post('/:id/trigger-sms', authMiddleware, roleMiddleware('Admin', 'Church Leader'), announcementController.triggerSms);

module.exports = router;
