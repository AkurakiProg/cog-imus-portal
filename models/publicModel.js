const { pool } = require('../config/database');

const PublicModel = {
    async getBanners() {
        const [rows] = await pool.execute(
            `SELECT * FROM banners WHERE is_active = 1 AND position = 'Homepage Hero' ORDER BY display_order ASC LIMIT 5`
        );
        return rows;
    },

    async getSermons(limit = 50) {
        if (limit) {
            const [rows] = await pool.execute(
                `SELECT * FROM sermons WHERE is_published = 1 ORDER BY is_featured DESC, sermon_date DESC LIMIT ?`,
                [String(limit)]
            );
            return rows;
        }
        const [rows] = await pool.execute(
            `SELECT * FROM sermons WHERE is_published = 1 ORDER BY is_featured DESC, sermon_date DESC`
        );
        return rows;
    },

    async getLiveStream() {
        const [rows] = await pool.execute(
            `SELECT id, title, description, preacher, platform, stream_url, is_live, started_at, ended_at, updated_at, fb_live_views, fb_total_views 
             FROM livestream_broadcast 
             ORDER BY id ASC LIMIT 1`
        );
        return rows[0] || null;
    },

    async getEvents(limit = 100) {
        const [rows] = await pool.execute(
            `SELECT * FROM events WHERE is_public = 1 AND status IN ('Upcoming', 'Ongoing') ORDER BY is_featured DESC, start_datetime ASC LIMIT ?`,
            [String(limit)]
        );
        return rows;
    },

    async getGalleryAlbums() {
        const [rows] = await pool.execute(
            `SELECT a.album_id, a.title, a.description, a.album_date, a.cover_image, 
                    (SELECT COUNT(*) FROM gallery_images WHERE album_id = a.album_id) AS image_count 
             FROM gallery_albums a 
             WHERE a.is_published = 1 
             ORDER BY a.album_date DESC LIMIT 6`
        );
        return rows;
    },

    async getAlbumImages(albumId) {
        const [rows] = await pool.execute(
            `SELECT * FROM gallery_images WHERE album_id = ? ORDER BY display_order ASC`,
            [albumId]
        );
        return rows;
    },

    async getPage(pageKey) {
        const [rows] = await pool.execute(
            `SELECT * FROM content_pages WHERE page_key = ? AND is_published = 1`,
            [pageKey]
        );
        return rows[0];
    }
};

module.exports = PublicModel;
