const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), eventController.getAllEvents);
router.get('/user/enrolled', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), eventController.getMyEnrollments);
router.get('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), eventController.getEventById);

router.get('/:id/enrollments', authMiddleware, roleMiddleware('Admin', 'Church Leader'), eventController.getEventEnrollments);
router.post('/:id/enroll', authMiddleware, roleMiddleware('Admin', 'Church Member'), eventController.enrollMember);
router.delete('/:id/enroll', authMiddleware, roleMiddleware('Admin', 'Church Member', 'Church Leader'), eventController.cancelMyEnrollment);
router.put('/enrollments/:enrollmentId', authMiddleware, roleMiddleware('Admin'), eventController.updateEnrollmentStatus);

router.put('/:id/archive', authMiddleware, roleMiddleware('Admin', 'Church Leader'), eventController.archiveEvent);
router.put('/:id/restore', authMiddleware, roleMiddleware('Admin', 'Church Leader'), eventController.restoreEvent);

router.post('/', authMiddleware, roleMiddleware('Admin', 'Church Leader'), upload.single('banner_image'), eventController.createEvent);
router.put('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader'), upload.single('banner_image'), eventController.updateEvent);
router.delete('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader'), eventController.deleteEvent);

module.exports = router;
