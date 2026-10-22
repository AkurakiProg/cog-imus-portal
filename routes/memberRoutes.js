const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const ministryController = require('../controllers/ministryController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Member gets their own ministry profile and attendance history
router.get('/me/ministry', authMiddleware, roleMiddleware('Church Member', 'Church Leader', 'Admin'), ministryController.getMyMinistry);
router.get('/me/ministry/attendance', authMiddleware, roleMiddleware('Church Member', 'Church Leader', 'Admin'), ministryController.getMyMinistryAttendance);

// View members available to Admin and Church Leader
router.get('/', authMiddleware, roleMiddleware('Admin', 'Church Leader'), memberController.getAllMembers);
router.get('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader'), memberController.getMemberById);

// Admin-only routes for mutating members
router.post('/', authMiddleware, roleMiddleware('Admin'), memberController.createMember);
router.put('/:id', authMiddleware, roleMiddleware('Admin'), memberController.updateMember);
router.delete('/:id', authMiddleware, roleMiddleware('Admin'), memberController.deleteMember);

module.exports = router;