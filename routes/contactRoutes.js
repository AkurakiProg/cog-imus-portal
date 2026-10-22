const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Admin only routes for managing inquiries
router.use(authMiddleware, roleMiddleware('Admin'));

router.get('/', contactController.getAll);
router.patch('/:id/read', contactController.markAsRead);
router.delete('/:id', contactController.delete);

module.exports = router;
