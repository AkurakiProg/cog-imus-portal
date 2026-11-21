const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { errorResponse } = require('../utils/responseFormatter');

function handleAnnouncementImageUpload(req, res, next) {
    upload.announcementImage.single('announcement_image')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return errorResponse(res, 'Announcement image file size must not exceed 10MB.', 400);
        }
        return errorResponse(res, err.message || 'Invalid announcement image upload.', 400);
    });
}

router.get('/', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), announcementController.getAll);
router.get('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), announcementController.getById);

router.post('/', authMiddleware, roleMiddleware('Admin', 'Church Leader'), handleAnnouncementImageUpload, announcementController.create);
router.put('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader'), handleAnnouncementImageUpload, announcementController.update);
router.delete('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader'), announcementController.delete);
router.post('/:id/trigger-email', authMiddleware, roleMiddleware('Admin', 'Church Leader'), announcementController.triggerEmailBroadcast);
router.post('/:id/trigger-sms', authMiddleware, roleMiddleware('Admin', 'Church Leader'), announcementController.triggerSms);

module.exports = router;
