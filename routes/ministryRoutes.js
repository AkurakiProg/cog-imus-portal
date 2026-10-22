const express = require('express');
const router = express.Router();
const ministryController = require('../controllers/ministryController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Leader Assigned Ministries - Leader only sees their assigned ministry
router.get('/leader/my-assigned', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.getLeaderAssignedMinistries);
router.get('/leader/department-oversight', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.getLeaderDepartmentOversight);

// View ministries and members - Available to Admin and Church Leader
router.get('/', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.getAllMinistries);

// Department Heads
router.get('/department-heads', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), ministryController.getDepartmentHeads);
router.put('/department-heads/:department', authMiddleware, roleMiddleware('Admin'), ministryController.updateDepartmentHead);
router.get('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.getMinistryById);
router.get('/:id/members', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), ministryController.getMinistryMembers);

// Ministry Roster with Attendance Stats
router.get('/:id/roster-attendance', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.getMinistryRosterWithAttendance);

// Ministry Attendance Sessions (List & History)
router.get('/:id/attendance', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.getMinistryAttendanceSessions);
router.get('/:id/attendance/history/:memberId', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.getMemberAttendanceHistory);
router.get('/attendance/:attendanceId', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.getAttendanceSessionDetails);

// Record, Update, Delete Ministry Attendance - Available to Admin and Church Leader
router.post('/:id/attendance', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.recordMinistryAttendance);
router.put('/attendance/:attendanceId', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.updateMinistryAttendance);
router.delete('/attendance/:attendanceId', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.deleteMinistryAttendance);

// Create, Update, Delete - ADMIN ONLY
router.post('/', authMiddleware, roleMiddleware('Admin'), ministryController.createMinistry);
router.put('/:id', authMiddleware, roleMiddleware('Admin'), ministryController.updateMinistry);
router.delete('/:id', authMiddleware, roleMiddleware('Admin'), ministryController.deleteMinistry);
router.post('/:id/members', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.addMemberToMinistry);
router.delete('/members/:ministry_member_id', authMiddleware, roleMiddleware('Admin', 'Church Leader'), ministryController.removeMemberFromMinistry);

module.exports = router;
