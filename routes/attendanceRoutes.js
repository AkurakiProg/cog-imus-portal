const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware, roleMiddleware('Admin', 'Church Leader'));

router.route('/')
    .get(ctrl.getAll)
    .post(ctrl.create);

router.get('/summary', ctrl.getSummary);

module.exports = router;