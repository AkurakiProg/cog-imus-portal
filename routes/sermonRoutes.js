const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sermonController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware, roleMiddleware('Admin', 'Church Leader'));

router.route('/')
    .get(ctrl.getAll)
    .post(ctrl.saveSermon);

router.route('/:id')
    .put(ctrl.saveSermon)
    .delete(ctrl.deleteSermon);

module.exports = router;