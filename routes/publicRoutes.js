const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/publicController');

const { contactLimiter } = require('../middleware/rateLimiter');
const contactCtrl = require('../controllers/contactController');

// No authMiddleware here - these are public routes
router.get('/banners', ctrl.getBanners);
router.get('/sermons', ctrl.getSermons);
router.get('/livestream', ctrl.getLiveStream);
router.get('/livestream/comments', ctrl.getLiveStreamComments);
router.post('/livestream/comments', ctrl.postLiveStreamComment);
router.post('/livestream/view', ctrl.recordLiveStreamView);
router.post('/livestream/heartbeat', ctrl.heartbeatLiveStreamView);
router.post('/livestream/leave', ctrl.leaveLiveStreamView);
router.get('/events', ctrl.getEvents);
router.get('/gallery', ctrl.getGalleryAlbums);
router.get('/gallery/albums', ctrl.getGalleryAlbums);
router.get('/gallery/:id', ctrl.getAlbumImages);
router.get('/pages/:key', ctrl.getPage);
router.post('/contact', contactLimiter, contactCtrl.submitPublic);

module.exports = router;