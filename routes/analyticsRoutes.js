const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware, roleMiddleware('Admin', 'Church Leader'));

router.get('/dashboard', ctrl.getDashboardAnalytics);

module.exports = router;