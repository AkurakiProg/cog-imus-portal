const galleryModel = require('../models/galleryModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');

exports.getAlbums = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || ''
        };

        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const albums = await galleryModel.getAlbums(null, 0, filters);
            return successResponse(res, albums, 'Albums retrieved');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [albums, total] = await Promise.all([
            galleryModel.getAlbums(limit, offset, filters),
            galleryModel.getCount(filters)
        ]);

        return paginatedResponse(res, albums, total, page, limit, 'Albums retrieved');
    } catch (error) {
        console.error('Get Albums Error:', error);
        return errorResponse(res, 'Failed to retrieve albums', 500);
    }
};

exports.createAlbum = async (req, res) => {
    try {
        if (req.file) {
            req.body.cover_image = `/uploads/gallery/${req.file.filename}`;
        }
        if (!req.body.album_date) {
            req.body.album_date = req.body.event_date || new Date().toISOString().split('T')[0];
        }
        const id = await galleryModel.createAlbum(req.body, req.user.id);
        await userModel.logAudit(req.user.id, 'CREATE', 'Gallery', id, null, req.body, req.ip, req.headers['user-agent']);
        return successResponse(res, { id, album_id: id }, 'Album created', 201);
    } catch (error) { return errorResponse(res, 'Failed to create album', 500); }
};

exports.updateAlbum = async (req, res) => {
    try {
        if (req.file) {
            req.body.cover_image = `/uploads/gallery/${req.file.filename}`;
        }
        if (!req.body.album_date && req.body.event_date) {
            req.body.album_date = req.body.event_date;
        }
        await galleryModel.updateAlbum(req.params.id, req.body);
        await userModel.logAudit(req.user.id, 'UPDATE', 'Gallery', req.params.id, null, req.body, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Album updated');
    } catch (error) { return errorResponse(res, 'Failed to update album', 500); }
};

exports.deleteAlbum = async (req, res) => {
    try {
        await galleryModel.deleteAlbum(req.params.id);
        await userModel.logAudit(req.user.id, 'DELETE', 'Gallery', req.params.id, null, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Album deleted');
    } catch (error) { return errorResponse(res, 'Failed to delete album', 500); }
};

exports.getImages = async (req, res) => {
    try {
        const data = await galleryModel.getImages(req.params.id);
        return successResponse(res, data, 'Images retrieved');
    } catch (error) { return errorResponse(res, 'Failed to retrieve images', 500); }
};

exports.addImage = async (req, res) => {
    try {
        const files = (req.files && req.files.length > 0) ? req.files : (req.file ? [req.file] : []);
        if (files.length === 0) return errorResponse(res, 'No image file uploaded', 400);
        
        const uploadedImages = [];
        for (const file of files) {
            const imagePath = `/uploads/gallery/${file.filename}`;
            const id = await galleryModel.addImage(req.params.id, imagePath, req.user.id);
            uploadedImages.push({ id, path: imagePath, filename: file.originalname });
        }

        await userModel.logAudit(
            req.user.id, 'UPLOAD_PHOTOS', 'Gallery', req.params.id, 
            null, { album_id: req.params.id, count: uploadedImages.length }, 
            req.ip, req.headers['user-agent']
        );

        return successResponse(res, uploadedImages, `${uploadedImages.length} photo(s) uploaded successfully`, 201);
    } catch (error) { 
        console.error('Gallery addImage error:', error);
        return errorResponse(res, 'Failed to upload photo(s): ' + error.message, 500); 
    }
};

exports.deleteImage = async (req, res) => {
    try {
        await galleryModel.deleteImage(req.params.imageId);
        await userModel.logAudit(req.user.id, 'DELETE_IMAGE', 'Gallery', req.params.imageId, null, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Image deleted');
    } catch (error) { return errorResponse(res, 'Failed to delete image', 500); }
};