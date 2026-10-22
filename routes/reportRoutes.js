const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware, roleMiddleware('Admin', 'Church Leader'));

router.get('/summary', ctrl.getSummaryReport);

module.exports = router;