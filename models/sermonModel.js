const { pool } = require('../config/database');

const SermonModel = {
    async getAll(limit = null, offset = 0, filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        let sql = `SELECT * FROM sermons ${whereClause} ORDER BY sermon_date DESC`;
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
            conditions.push(`(title LIKE ? OR preacher LIKE ? OR series_name LIKE ? OR scripture_reference LIKE ?)`);
            params.push(q, q, q, q);
        }
        if (filters.status && String(filters.status).trim()) {
            const s = String(filters.status).trim();
            if (s === 'Published' || s === '1') {
                conditions.push(`is_published = 1`);
            } else if (s === 'Draft' || s === '0') {
                conditions.push(`is_published = 0`);
            }
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        return { whereClause, params };
    },

    async getCount(filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        const sql = `SELECT COUNT(*) AS total FROM sermons ${whereClause}`;
        const [rows] = await pool.query(sql, params);
        return rows[0] ? rows[0].total : 0;
    },
    async getById(id) {
        const [rows] = await pool.execute(`SELECT * FROM sermons WHERE sermon_id = ?`, [id]);
        return rows[0];
    },
    async create(data) {
        const { title, description, youtube_video_id, video_url, preacher, sermon_date, scripture_reference, series_name, is_live, is_featured, is_published } = data;
        const rawInput = video_url || youtube_video_id || '';
        const extractedId = extractYouTubeId(rawInput);
        const fullUrl = (rawInput && rawInput.includes('http')) ? rawInput : (extractedId ? `https://www.youtube.com/watch?v=${extractedId}` : '');
        const [result] = await pool.execute(
            `INSERT INTO sermons (title, description, youtube_video_id, video_url, preacher, sermon_date, scripture_reference, series_name, is_live, is_featured, is_published) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description || null, extractedId, fullUrl || null, preacher, sermon_date, scripture_reference || null, series_name || null, is_live ? 1 : 0, is_featured ? 1 : 0, is_published ? 1 : 0]
        );
        return result.insertId;
    },
    async update(id, data) {
        const { title, description, youtube_video_id, video_url, preacher, sermon_date, scripture_reference, series_name, is_live, is_featured, is_published } = data;
        const rawInput = video_url || youtube_video_id || '';
        const extractedId = extractYouTubeId(rawInput);
        const fullUrl = (rawInput && rawInput.includes('http')) ? rawInput : (extractedId ? `https://www.youtube.com/watch?v=${extractedId}` : '');
        await pool.execute(
            `UPDATE sermons SET title=?, description=?, youtube_video_id=?, video_url=?, preacher=?, sermon_date=?, scripture_reference=?, series_name=?, is_live=?, is_featured=?, is_published=? WHERE sermon_id=?`,
            [title, description || null, extractedId, fullUrl || null, preacher, sermon_date, scripture_reference || null, series_name || null, is_live ? 1 : 0, is_featured ? 1 : 0, is_published ? 1 : 0, id]
        );
    },
    async delete(id) {
        await pool.execute(`DELETE FROM sermons WHERE sermon_id = ?`, [id]);
    }
};

function extractYouTubeId(urlOrId) {
    if (!urlOrId) return '';
    const str = String(urlOrId).trim();
    const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/|shorts\/))([\w-]{11})/i);
    if (match && match[1]) return match[1];
    const clean = str.replace(/^v=/, '');
    const idMatch = clean.match(/^[\w-]{11}$/);
    if (idMatch) return idMatch[0];
    return clean.slice(0, 50);
}

module.exports = SermonModel;