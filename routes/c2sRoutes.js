const express = require('express');
const router = express.Router();
const c2sController = require('../controllers/c2sController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Viewing C2S Groups & Members - Admin, Church Leader, and Church Member
router.get('/', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), c2sController.getAllGroups);
router.get('/members/available', authMiddleware, roleMiddleware('Admin', 'Church Leader'), c2sController.getAvailableMembers);
router.get('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader', 'Church Member'), c2sController.getGroupById);

// Modifications - Admin ONLY
router.post('/', authMiddleware, roleMiddleware('Admin'), c2sController.createGroup);
router.put('/:id', authMiddleware, roleMiddleware('Admin'), c2sController.updateGroup);
router.delete('/:id', authMiddleware, roleMiddleware('Admin'), c2sController.deleteGroup);
router.post('/:id/members', authMiddleware, roleMiddleware('Admin'), c2sController.addMember);
router.delete('/:id/members/:memberId', authMiddleware, roleMiddleware('Admin'), c2sController.removeMember);
router.post('/:id/quick-member', authMiddleware, roleMiddleware('Admin'), c2sController.quickCreateMember);
router.post('/quick-member', authMiddleware, roleMiddleware('Admin'), c2sController.quickCreateMember);

module.exports = router;
