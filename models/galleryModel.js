const { pool } = require('../config/database');

const GalleryModel = {
    async getAlbums(limit = null, offset = 0, filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        let sql = `SELECT a.*, (SELECT COUNT(*) FROM gallery_images WHERE album_id = a.album_id) AS image_count 
                    FROM gallery_albums a 
                    ${whereClause}
                    ORDER BY a.album_date DESC`;
        if (limit !== null && limit !== undefined) {
            sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
        }
        const [rows] = await pool.query(sql, params);
        return rows;
    },

    buildWhere(filters = {}) {
        const conditions = [];
        const params = [];

        if (filters.search && String(filters.search).trim()) {
            const q = `%${String(filters.search).trim()}%`;
            conditions.push(`(a.title LIKE ? OR a.description LIKE ? OR a.theme LIKE ?)`);
            params.push(q, q, q);
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        return { whereClause, params };
    },

    async getCount(filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        const sql = `SELECT COUNT(*) AS total FROM gallery_albums a ${whereClause}`;
        const [rows] = await pool.query(sql, params);
        return rows[0] ? rows[0].total : 0;
    },
    async getAlbumById(id) {
        const [rows] = await pool.execute(`SELECT * FROM gallery_albums WHERE album_id = ?`, [id]);
        return rows[0];
    },
    async createAlbum(data, userId) {
        const { title, description, event_id, ministry_id, theme, album_date, cover_image } = data;
        const [result] = await pool.execute(
            `INSERT INTO gallery_albums (title, description, event_id, ministry_id, theme, album_date, cover_image, is_published, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [title, description || null, event_id || null, ministry_id || null, theme || null, album_date, cover_image || null, userId]
        );
        return result.insertId;
    },
    async updateAlbum(id, data) {
        const { title, description, event_id, ministry_id, theme, album_date, cover_image } = data;
        await pool.execute(
            `UPDATE gallery_albums SET title=?, description=?, event_id=?, ministry_id=?, theme=?, album_date=?, cover_image=COALESCE(?, cover_image) WHERE album_id=?`,
            [title, description || null, event_id || null, ministry_id || null, theme || null, album_date, cover_image || null, id]
        );
    },
    async deleteAlbum(id) {
        await pool.execute(`DELETE FROM gallery_albums WHERE album_id = ?`, [id]);
    },
    async getImages(albumId) {
        const [rows] = await pool.execute(`SELECT * FROM gallery_images WHERE album_id = ? ORDER BY display_order ASC`, [albumId]);
        return rows;
    },
    async addImage(albumId, imagePath, userId) {
        const [result] = await pool.execute(
            `INSERT INTO gallery_images (album_id, image_path, uploaded_by) VALUES (?, ?, ?)`,
            [albumId, imagePath, userId]
        );
        return result.insertId;
    },
    async deleteImage(id) {
        await pool.execute(`DELETE FROM gallery_images WHERE image_id = ?`, [id]);
    }
};

/**
 * Delete multiple gallery photos in a single query, optionally scoped to an album.
 * @param {Array<number|string>} imageIds
 * @param {number|string|null} [albumId]
 * @returns {Promise<{deletedCount: number, deletedIds: number[]}>}
 */
GalleryModel.deleteImages = async function (imageIds, albumId = null) {
    const cleanIds = Array.from(new Set(
        (Array.isArray(imageIds) ? imageIds : [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
    ));
    if (cleanIds.length === 0) {
        return { deletedCount: 0, deletedIds: [] };
    }

    const placeholders = cleanIds.map(() => '?').join(', ');
    const params = [...cleanIds];
    let whereSql = `image_id IN (${placeholders})`;

    if (albumId !== null && albumId !== undefined && albumId !== '') {
        const parsedAlbumId = Number(albumId);
        if (!Number.isInteger(parsedAlbumId) || parsedAlbumId <= 0) {
            return { deletedCount: 0, deletedIds: [] };
        }
        whereSql += ' AND album_id = ?';
        params.push(parsedAlbumId);
    }

    const [existingRows] = await pool.execute(
        `SELECT image_id FROM gallery_images WHERE ${whereSql}`,
        params
    );
    const existingIds = existingRows.map((row) => row.image_id);
    if (existingIds.length === 0) {
        return { deletedCount: 0, deletedIds: [] };
    }

    const deletePlaceholders = existingIds.map(() => '?').join(', ');
    const [result] = await pool.execute(
        `DELETE FROM gallery_images WHERE image_id IN (${deletePlaceholders})`,
        existingIds
    );

    return {
        deletedCount: result.affectedRows || existingIds.length,
        deletedIds: existingIds
    };
};

module.exports = GalleryModel;