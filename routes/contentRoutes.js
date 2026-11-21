const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { errorResponse } = require('../utils/responseFormatter');

const handleWebsiteImageUpload = (req, res, next) => {
    upload.websiteImage.single('image')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return errorResponse(res, 'Image file size exceeds the 10MB maximum limit.', 400);
            }
            return errorResponse(res, err.message || 'Invalid image upload.', 400);
        }
        next();
    });
};

router.use(authMiddleware, roleMiddleware('Admin', 'Church Leader'));

router.route('/banners')
    .get(contentController.getBanners)
    .post(contentController.saveBanner);

router.route('/banners/:id')
    .put(contentController.saveBanner)
    .delete(contentController.deleteBanner);

router.route('/sermons')
    .get(contentController.getSermons)
    .post(contentController.saveSermon);

router.route('/sermons/:id')
    .put(contentController.saveSermon)
    .delete(contentController.deleteSermon);

router.route('/livestream')
    .get(contentController.getLiveStream)
    .post(contentController.saveLiveStream);

router.post('/livestream/toggle', contentController.toggleLiveStream);
router.get('/livestream/relay-status', contentController.getBroadcastRelayStatus);

router.get('/livestream/analytics', contentController.getLiveStreamAnalytics);
router.get('/livestream/realtime-stream', contentController.streamLiveAnalytics);
router.post('/livestream/analytics/log', contentController.logLiveStreamViews);
router.post('/livestream/sync-facebook', contentController.syncFacebookLiveStream);

router.route('/livestream/comments')
    .get(contentController.getLiveStreamComments)
    .post(contentController.postLiveStreamComment);

router.delete('/livestream/comments/:id', contentController.deleteLiveStreamComment);
router.get('/livestream/comment-logs', contentController.getLiveStreamCommentLogs);

router.get('/website/:section', contentController.getWebsiteSection);
router.put('/website/:section', roleMiddleware('Admin'), contentController.saveWebsiteSection);
router.post('/upload-video', roleMiddleware('Admin'), upload.video.single('video'), contentController.uploadWebsiteVideo);
router.post('/upload-image', roleMiddleware('Admin'), handleWebsiteImageUpload, contentController.uploadWebsiteImage);

module.exports = router;
