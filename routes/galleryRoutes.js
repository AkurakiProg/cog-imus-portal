const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/galleryController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(authMiddleware, roleMiddleware('Admin', 'Church Leader'));

router.route('/')
    .get(ctrl.getAlbums)
    .post(upload.single('cover_image'), ctrl.createAlbum);

router.route('/:id')
    .put(upload.single('cover_image'), ctrl.updateAlbum)
    .delete(ctrl.deleteAlbum);

router.route('/:id/images')
    .get(ctrl.getImages)
    .post(upload.any(), ctrl.addImage);

router.delete('/images/:imageId', ctrl.deleteImage);

module.exports = router;