const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userAccountController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public activation link clicked from email (no authentication required)
router.get('/activate/:token', ctrl.activateAccount);

router.use(authMiddleware, roleMiddleware('Admin'));

router.route('/')
    .get(ctrl.getAll)
    .post(upload.single('profile_image'), ctrl.create);

router.route('/:id')
    .get(ctrl.getById)
    .put(upload.single('profile_image'), ctrl.update)
    .delete(ctrl.delete);

router.post('/:id/verify', ctrl.verifyUser);
router.post('/:id/resend-email', ctrl.resendVerificationEmail);

module.exports = router;