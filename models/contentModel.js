const { pool } = require('../config/database');
const FacebookService = require('../utils/facebookService');

const ContentModel = {
    // --- Banners ---
    async getBanners() {
        const [rows] = await pool.execute(`SELECT * FROM banners ORDER BY display_order ASC`);
        return rows;
    },

    async createBanner(data, userId) {
        const { title, image_path, link_url, position, display_order, is_active, start_date, end_date } = data;
        const [result] = await pool.execute(
            `INSERT INTO banners (title, image_path, link_url, position, display_order, is_active, start_date, end_date, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, image_path, link_url || null, position || 'Homepage Hero', display_order || 0, is_active ? 1 : 0, start_date || null, end_date || null, userId]
        );
        return result.insertId;
    },

    async updateBanner(id, data) {
        const { title, image_path, link_url, position, display_order, is_active, start_date, end_date } = data;
        await pool.execute(
            `UPDATE banners SET title = ?, image_path = ?, link_url = ?, position = ?, display_order = ?, is_active = ?, start_date = ?, end_date = ? WHERE banner_id = ?`,
            [title, image_path, link_url || null, position || 'Homepage Hero', display_order || 0, is_active ? 1 : 0, start_date || null, end_date || null, id]
        );
    },

    async deleteBanner(id) {
        await pool.execute(`DELETE FROM banners WHERE banner_id = ?`, [id]);
    },

    // --- Sermons (Past Sermons with YouTube Links) ---
    async getSermons(limit = null, offset = 0, filters = {}) {
        let sql = `SELECT * FROM sermons`;
        const params = [];
        if (filters.search && filters.search.trim()) {
            sql += ` WHERE (title LIKE ? OR preacher LIKE ? OR scripture_reference LIKE ? OR series_name LIKE ? OR description LIKE ?)`;
            const q = `%${filters.search.trim()}%`;
            params.push(q, q, q, q, q);
        }
        sql += ` ORDER BY sermon_date DESC`;
        if (limit !== null && limit !== undefined) {
            sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
        }
        const [rows] = await pool.query(sql, params);
        return rows;
    },

    async getSermonsCount(filters = {}) {
        let sql = `SELECT COUNT(*) AS total FROM sermons`;
        const params = [];
        if (filters.search && filters.search.trim()) {
            sql += ` WHERE (title LIKE ? OR preacher LIKE ? OR scripture_reference LIKE ? OR series_name LIKE ? OR description LIKE ?)`;
            const q = `%${filters.search.trim()}%`;
            params.push(q, q, q, q, q);
        }
        const [rows] = await pool.query(sql, params);
        return rows[0] ? rows[0].total : 0;
    },

    async createSermon(data) {
        const { title, description, youtube_video_id, video_url, preacher, sermon_date, scripture_reference, series_name, is_live, is_featured, is_published } = data;
        const rawInput = video_url || youtube_video_id || '';
        const extractedId = extractYouTubeId(rawInput);
        const fullUrl = (rawInput && rawInput.includes('http')) ? rawInput : (extractedId ? `https://www.youtube.com/watch?v=${extractedId}` : '');
        const cleanLive = (is_live === 1 || is_live === '1' || is_live === true || is_live === 'true') ? 1 : 0;
        const cleanFeatured = (is_featured === 1 || is_featured === '1' || is_featured === true || is_featured === 'true') ? 1 : 0;
        const cleanPublished = (is_published === 1 || is_published === '1' || is_published === true || is_published === 'true') ? 1 : 0;
        const [result] = await pool.execute(
            `INSERT INTO sermons (title, description, youtube_video_id, video_url, preacher, sermon_date, scripture_reference, series_name, is_live, is_featured, is_published) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description || null, extractedId, fullUrl || null, preacher, sermon_date, scripture_reference || null, series_name || null, cleanLive, cleanFeatured, cleanPublished]
        );
        return result.insertId;
    },

    async updateSermon(id, data) {
        const { title, description, youtube_video_id, video_url, preacher, sermon_date, scripture_reference, series_name, is_live, is_featured, is_published } = data;
        const rawInput = video_url || youtube_video_id || '';
        const extractedId = extractYouTubeId(rawInput);
        const fullUrl = (rawInput && rawInput.includes('http')) ? rawInput : (extractedId ? `https://www.youtube.com/watch?v=${extractedId}` : '');
        const cleanLive = (is_live === 1 || is_live === '1' || is_live === true || is_live === 'true') ? 1 : 0;
        const cleanFeatured = (is_featured === 1 || is_featured === '1' || is_featured === true || is_featured === 'true') ? 1 : 0;
        const cleanPublished = (is_published === 1 || is_published === '1' || is_published === true || is_published === 'true') ? 1 : 0;
        await pool.execute(
            `UPDATE sermons SET title = ?, description = ?, youtube_video_id = ?, video_url = ?, preacher = ?, sermon_date = ?, scripture_reference = ?, series_name = ?, is_live = ?, is_featured = ?, is_published = ? WHERE sermon_id = ?`,
            [title, description || null, extractedId, fullUrl || null, preacher, sermon_date, scripture_reference || null, series_name || null, cleanLive, cleanFeatured, cleanPublished, id]
        );
    },

    async deleteSermon(id) {
        await pool.execute(`DELETE FROM sermons WHERE sermon_id = ?`, [id]);
    },

    // --- Live Stream Broadcast (Facebook Live) ---
    async getLiveStream() {
        const [rows] = await pool.execute(`SELECT * FROM livestream_broadcast ORDER BY id ASC LIMIT 1`);
        if (rows.length === 0) {
            return {
                id: 1,
                title: 'Sunday Celebration Service - Live Broadcast',
                description: 'Join us live on Facebook for praise, worship, and God\'s Word.',
                preacher: 'Pastor Juan Dela Cruz',
                platform: 'facebook',
                stream_url: 'https://www.facebook.com/facebook/videos/10153231379946729/',
                is_live: 0
            };
        }
        return rows[0];
    },

    async saveLiveStream(data, userId) {
        const { title, description, preacher, platform, stream_url, stream_key, is_live } = data;
        const current = await this.getLiveStream();
        let rawLive = is_live;
        if (typeof rawLive === 'object' && rawLive !== null && 'is_live' in rawLive) {
            rawLive = rawLive.is_live;
        }
        const liveVal = (rawLive === true || rawLive === 1 || rawLive === '1' || rawLive === 'true') ? 1 : 0;
        const startedAt = (liveVal && !current.is_live) ? new Date() : (liveVal ? (current.started_at || new Date()) : current.started_at);
        const endedAt = (!liveVal && current.is_live) ? new Date() : (!liveVal ? (current.ended_at || new Date()) : current.ended_at);

        if (!liveVal) {
            // Ending livestream: automatically archive all active comments for logs and clear active chat
            await this.archiveLivestreamComments(current);
            await this.clearActiveLivestreamComments();
        } else if (liveVal && !current.is_live) {
            // Starting new livestream: archive any past comments and clear active table for a fresh new blank chat
            await this.archiveLivestreamComments(current);
            await this.clearActiveLivestreamComments();
        }

        const effectiveKey = (stream_key !== undefined && stream_key !== null) ? stream_key.trim() : (current.stream_key || null);
        const effectiveUrl = stream_url ? stream_url.trim() : (current.stream_url || null);

        await pool.execute(
            `UPDATE livestream_broadcast 
             SET title = ?, description = ?, preacher = ?, platform = ?, stream_url = ?, stream_key = ?, is_live = ?, updated_by = ?, started_at = ?, ended_at = ?
             WHERE id = ?`,
            [
                title || 'Sunday Celebration Service - Live Broadcast',
                description || null,
                preacher || null,
                platform || 'facebook',
                effectiveUrl,
                effectiveKey,
                liveVal,
                userId || null,
                startedAt,
                endedAt,
                current.id || 1
            ]
        );
        return this.getLiveStream();
    },

    async toggleLiveStream(isLive, userId) {
        const current = await this.getLiveStream();
        let rawVal = isLive;
        if (typeof rawVal === 'object' && rawVal !== null && 'is_live' in rawVal) {
            rawVal = rawVal.is_live;
        }
        const liveVal = (rawVal === true || rawVal === 1 || rawVal === '1' || rawVal === 'true') ? 1 : 0;
        const startedAt = (liveVal && !current.is_live) ? new Date() : (liveVal ? (current.started_at || new Date()) : current.started_at);
        const endedAt = (!liveVal && current.is_live) ? new Date() : (!liveVal ? (current.ended_at || new Date()) : current.ended_at);

        if (!liveVal) {
            // Ending livestream: automatically archive all active comments for logs and clear active chat
            await this.archiveLivestreamComments(current);
            await this.clearActiveLivestreamComments();
        } else if (liveVal && !current.is_live) {
            // Starting new livestream: archive any past comments and clear active table for a fresh new blank chat
            await this.archiveLivestreamComments(current);
            await this.clearActiveLivestreamComments();
        }

        await pool.execute(
            `UPDATE livestream_broadcast 
             SET is_live = ?, updated_by = ?, started_at = ?, ended_at = ? 
             WHERE id = ?`,
            [liveVal, userId || null, startedAt, endedAt, current.id || 1]
        );
        return this.getLiveStream();
    },

    // --- Live Stream Analytics & Daily Views ---
    getTodayLocalDateStr() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    async ensureTodayRecord() {
        try {
            const todayStr = this.getTodayLocalDateStr();
            const stream = await this.getLiveStream();
            const title = (stream && stream.title) ? stream.title : 'Live Broadcast';
            await pool.execute(
                `INSERT IGNORE INTO livestream_daily_views (view_date, views_count, peak_viewers, stream_title)
                 VALUES (?, 0, 0, ?)`,
                [todayStr, title]
            );
        } catch (e) {
            console.warn('ensureTodayRecord error:', e.message);
        }
    },

    async getLiveStreamAnalytics() {
        await this.ensureTodayRecord();
        const [rows] = await pool.execute(
            `SELECT id, DATE_FORMAT(view_date, '%Y-%m-%d') as view_date, 
                    views_count, peak_viewers, 
                    COALESCE(fb_views_count, 0) as fb_views_count, 
                    COALESCE(fb_peak_viewers, 0) as fb_peak_viewers,
                    fb_synced_at,
                    stream_title, notes 
             FROM livestream_daily_views 
             ORDER BY view_date ASC`
        );
        
        const todayStr = this.getTodayLocalDateStr();
        const [todayRow] = await pool.execute(
            `SELECT views_count, peak_viewers, 
                    COALESCE(fb_views_count, 0) as fb_views_count, 
                    COALESCE(fb_peak_viewers, 0) as fb_peak_viewers,
                    fb_synced_at 
             FROM livestream_daily_views WHERE view_date = ?`,
            [todayStr]
        );
        
        const [summaryRow] = await pool.execute(
            `SELECT 
                COALESCE(SUM(views_count), 0) as total_portal_views, 
                COALESCE(SUM(fb_views_count), 0) as total_fb_views,
                COALESCE(SUM(views_count + COALESCE(fb_views_count, 0)), 0) as total_views, 
                COALESCE(MAX(peak_viewers), 0) as max_portal_peak_viewers,
                COALESCE(MAX(fb_peak_viewers), 0) as max_fb_peak_viewers,
                COALESCE(MAX(GREATEST(peak_viewers, COALESCE(fb_peak_viewers, 0))), 0) as max_peak_viewers,
                COALESCE(AVG(views_count + COALESCE(fb_views_count, 0)), 0) as avg_views,
                COUNT(id) as total_broadcast_days
             FROM livestream_daily_views`
        );

        const curYear = new Date().getFullYear();
        const curMonth = String(new Date().getMonth() + 1).padStart(2, '0');
        const monthPrefix = `${curYear}-${curMonth}`;
        const [monthRow] = await pool.execute(
            `SELECT 
                COALESCE(SUM(views_count), 0) as portal_month_views,
                COALESCE(SUM(fb_views_count), 0) as fb_month_views,
                COALESCE(SUM(views_count + COALESCE(fb_views_count, 0)), 0) as month_views, 
                COALESCE(MAX(GREATEST(peak_viewers, COALESCE(fb_peak_viewers, 0))), 0) as month_peak 
             FROM livestream_daily_views WHERE DATE_FORMAT(view_date, '%Y-%m') = ?`,
            [monthPrefix]
        );

        const stream = await this.getLiveStream();
        const fbVideoId = FacebookService.extractFacebookVideoId(stream?.stream_url || stream?.stream_key);
        const fbApiConfig = FacebookService.getApiConfig();

        const tPortalViews = todayRow.length > 0 ? Number(todayRow[0].views_count || 0) : 0;
        const tPortalPeak = todayRow.length > 0 ? Number(todayRow[0].peak_viewers || 0) : 0;
        const tFbViews = todayRow.length > 0 ? Number(todayRow[0].fb_views_count || 0) : 0;
        const tFbPeak = todayRow.length > 0 ? Number(todayRow[0].fb_peak_viewers || 0) : 0;
        const fbLiveViews = stream ? Number(stream.fb_live_views || 0) : 0;
        const fbTotalViews = stream ? Number(stream.fb_total_views || 0) : 0;
        const effectiveFbTodayViews = Math.max(tFbViews, fbTotalViews);
        const effectiveFbPeak = Math.max(tFbPeak, fbLiveViews);

        return {
            daily_views: rows.map(r => {
                const pViews = Number(r.views_count || 0);
                const fbViews = Number(r.fb_views_count || 0);
                const pPeak = Number(r.peak_viewers || 0);
                const fbPeak = Number(r.fb_peak_viewers || 0);
                return {
                    ...r,
                    views_count: pViews,
                    peak_viewers: pPeak,
                    fb_views_count: fbViews,
                    fb_peak_viewers: fbPeak,
                    total_combined_views: pViews + fbViews,
                    total_combined_peak: Math.max(pPeak, fbPeak)
                };
            }),
            facebook_connection: {
                video_id: fbVideoId,
                title: stream?.title || 'Sunday Celebration Service - Live Broadcast',
                stream_url: stream?.stream_url || '',
                stream_key: stream?.stream_key || '',
                is_live: stream ? Boolean(stream.is_live) : false,
                fb_live_views: fbLiveViews,
                fb_total_views: fbTotalViews,
                fb_synced_at: stream?.fb_synced_at || (todayRow.length > 0 ? todayRow[0].fb_synced_at : null),
                api_configured: fbApiConfig.configured
            },
            summary: {
                // Portal Website attendance
                portal_today_views: tPortalViews,
                portal_today_peak: tPortalPeak,
                portal_total_views: summaryRow.length > 0 ? Number(summaryRow[0].total_portal_views || 0) : 0,

                // Facebook Native attendance
                fb_today_views: effectiveFbTodayViews,
                fb_active_now: fbLiveViews,
                fb_today_peak: effectiveFbPeak,
                fb_total_views: summaryRow.length > 0 ? Number(summaryRow[0].total_fb_views || 0) : 0,
                fb_synced_at: stream?.fb_synced_at || null,

                // Combined Reach
                combined_today_views: tPortalViews + effectiveFbTodayViews,
                combined_peak: Math.max(tPortalPeak, effectiveFbPeak),

                // Legacy & Standard Metric compatibility
                today_views: tPortalViews,
                today_peak: tPortalPeak,
                month_views: monthRow.length > 0 ? Number(monthRow[0].month_views || 0) : 0,
                total_views: summaryRow.length > 0 ? Number(summaryRow[0].total_views || 0) : 0,
                max_peak_viewers: summaryRow.length > 0 ? Number(summaryRow[0].max_peak_viewers || 0) : 0,
                avg_views: summaryRow.length > 0 ? Math.round(Number(summaryRow[0].avg_views || 0)) : 0,
                total_broadcast_days: summaryRow.length > 0 ? Number(summaryRow[0].total_broadcast_days || 0) : 0
            }
        };
    },

    async logLiveStreamViews(data) {
        const { view_date, views_count, peak_viewers, fb_views_count, fb_peak_viewers, stream_title, notes } = data;
        if (!view_date) throw new Error('view_date is required');

        await pool.execute(
            `INSERT INTO livestream_daily_views (view_date, views_count, peak_viewers, fb_views_count, fb_peak_viewers, stream_title, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                views_count = VALUES(views_count),
                peak_viewers = VALUES(peak_viewers),
                fb_views_count = VALUES(fb_views_count),
                fb_peak_viewers = VALUES(fb_peak_viewers),
                stream_title = COALESCE(VALUES(stream_title), stream_title),
                notes = COALESCE(VALUES(notes), notes)`,
            [
                view_date, 
                parseInt(views_count, 10) || 0, 
                parseInt(peak_viewers, 10) || 0, 
                parseInt(fb_views_count, 10) || 0,
                parseInt(fb_peak_viewers, 10) || 0,
                stream_title || 'Livestream Broadcast', 
                notes || 'Livestream Daily Views'
            ]
        );

        return this.getLiveStreamAnalytics();
    },

    async recordPublicView(activeCount = 1, viewerId = null, ip = null) {
        const stream = await this.getLiveStream();
        // Do not record views when broadcast is offline
        if (!stream || !stream.is_live) {
            return this.getLiveStreamAnalytics();
        }

        const todayStr = this.getTodayLocalDateStr();
        const title = (stream && stream.title) ? stream.title : 'Live Broadcast';
        const peakVal = Math.max(1, parseInt(activeCount, 10) || 1);

        // Check if this churchgoer is watching the livestream for the first time
        let isFirstTimeViewer = true;
        if (viewerId) {
            try {
                const [insertResult] = await pool.execute(
                    `INSERT IGNORE INTO livestream_viewer_sessions (broadcast_id, view_date, viewer_id, ip_address)
                     VALUES (?, ?, ?, ?)`,
                    [stream.id || 1, todayStr, String(viewerId).substring(0, 100), ip ? String(ip).substring(0, 50) : null]
                );
                // affectedRows is 1 if newly inserted (first-time watcher), or 0 if duplicate (already watched)
                isFirstTimeViewer = insertResult.affectedRows > 0;
            } catch (err) {
                console.warn('livestream_viewer_sessions check error:', err.message);
            }
        }

        if (isFirstTimeViewer) {
            // ONLY increment views_count when the churchgoer is first time watching the livestream
            await pool.execute(
                `INSERT INTO livestream_daily_views (view_date, views_count, peak_viewers, stream_title, notes)
                 VALUES (?, 1, ?, ?, 'Connected Facebook Live Stream Views')
                 ON DUPLICATE KEY UPDATE 
                    views_count = views_count + 1,
                    peak_viewers = GREATEST(peak_viewers, ?),
                    notes = 'Connected Facebook Live Stream Views'`,
                [todayStr, peakVal, title, peakVal]
            );
        } else {
            // Already watched: DO NOT increment views_count, only update peak viewers
            await pool.execute(
                `INSERT INTO livestream_daily_views (view_date, views_count, peak_viewers, stream_title, notes)
                 VALUES (?, 0, ?, ?, 'Connected Facebook Live Stream Views')
                 ON DUPLICATE KEY UPDATE 
                    peak_viewers = GREATEST(peak_viewers, ?)`,
                [todayStr, peakVal, title, peakVal]
            );
        }
        return this.getLiveStreamAnalytics();
    },

    async updatePeakViewers(activeCount) {
        const count = parseInt(activeCount, 10) || 0;
        if (count < 1) return;
        const todayStr = this.getTodayLocalDateStr();
        const stream = await this.getLiveStream();
        const title = (stream && stream.title) ? stream.title : 'Live Broadcast';

        await pool.execute(
            `INSERT INTO livestream_daily_views (view_date, views_count, peak_viewers, stream_title)
             VALUES (?, 0, ?, ?)
             ON DUPLICATE KEY UPDATE 
                peak_viewers = GREATEST(peak_viewers, ?)`,
            [todayStr, count, title, count]
        );
    },

    // --- Live Stream Comments ---
    async getLiveStreamComments(limit = 100) {
        const [rows] = await pool.execute(
            `SELECT id, author_name, comment_text, author_badge, is_admin, 
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
             FROM livestream_comments 
             ORDER BY id DESC LIMIT ?`,
            [String(limit)]
        );
        return rows.reverse(); // Return in chronological order
    },

    async postLiveStreamComment(data) {
        const { author_name, comment_text, author_badge, is_admin } = data;
        if (!comment_text || !comment_text.trim()) {
            throw new Error('Comment text is required');
        }
        const author = (author_name && author_name.trim()) ? author_name.trim() : 'Churchgoer';
        const badge = author_badge || 'Viewer';
        const adminFlag = (is_admin === 1 || is_admin === true) ? 1 : 0;

        const [result] = await pool.execute(
            `INSERT INTO livestream_comments (author_name, comment_text, author_badge, is_admin)
             VALUES (?, ?, ?, ?)`,
            [author, comment_text.trim(), badge, adminFlag]
        );

        return {
            id: result.insertId,
            author_name: author,
            comment_text: comment_text.trim(),
            author_badge: badge,
            is_admin: adminFlag,
            created_at: new Date()
        };
    },

    async deleteLiveStreamComment(id) {
        await pool.execute(`DELETE FROM livestream_comments WHERE id = ?`, [id]);
        return { success: true };
    },

    async archiveLivestreamComments(broadcast = null) {
        try {
            const [rows] = await pool.execute(
                `SELECT id, author_name, comment_text, author_badge, is_admin, created_at 
                 FROM livestream_comments 
                 ORDER BY id ASC`
            );
            if (!rows || rows.length === 0) return 0;

            const bTitle = broadcast ? (broadcast.title || 'Livestream Broadcast') : 'Livestream Broadcast';
            const bId = broadcast ? (broadcast.id || 1) : 1;
            const startedAt = (broadcast && broadcast.started_at) ? broadcast.started_at : null;
            const endedAt = new Date();

            for (const c of rows) {
                await pool.execute(
                    `INSERT INTO livestream_comment_logs 
                     (broadcast_id, broadcast_title, author_name, comment_text, author_badge, is_admin, comment_created_at, session_started_at, session_ended_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        bId,
                        bTitle,
                        c.author_name,
                        c.comment_text,
                        c.author_badge || 'Viewer',
                        c.is_admin ? 1 : 0,
                        c.created_at || new Date(),
                        startedAt,
                        endedAt
                    ]
                );
            }
            console.log(`[Livestream Archive] Successfully archived ${rows.length} comments to logs.`);
            return rows.length;
        } catch (err) {
            console.error('Error archiving livestream comments:', err);
            return 0;
        }
    },

    async clearActiveLivestreamComments() {
        await pool.execute(`DELETE FROM livestream_comments`);
    },

    async getLivestreamCommentLogs(limit = 15, offset = 0, search = '') {
        let sql = `SELECT id, broadcast_id, broadcast_title, author_name, comment_text, author_badge, is_admin,
                          DATE_FORMAT(comment_created_at, '%Y-%m-%d %H:%i:%s') as comment_created_at,
                          DATE_FORMAT(archived_at, '%Y-%m-%d %H:%i:%s') as archived_at,
                          DATE_FORMAT(session_started_at, '%Y-%m-%d %H:%i:%s') as session_started_at,
                          DATE_FORMAT(session_ended_at, '%Y-%m-%d %H:%i:%s') as session_ended_at
                   FROM livestream_comment_logs`;
        const params = [];
        if (search && search.trim()) {
            sql += ` WHERE broadcast_title LIKE ? OR author_name LIKE ? OR comment_text LIKE ?`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q);
        }
        sql += ` ORDER BY archived_at DESC, id DESC`;
        if (limit !== null && limit !== undefined) {
            sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
        }

        const [rows] = await pool.query(sql, params);
        return rows;
    },

    async getLivestreamCommentLogsCount(search = '') {
        let sql = `SELECT COUNT(*) AS total FROM livestream_comment_logs`;
        const params = [];
        if (search && search.trim()) {
            sql += ` WHERE broadcast_title LIKE ? OR author_name LIKE ? OR comment_text LIKE ?`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q);
        }
        const [rows] = await pool.query(sql, params);
        return rows[0] ? rows[0].total : 0;
    },

    // --- Public Website Content Management (Admin CMS) ---
    async getWebsiteSection(sectionKey) {
        const [rows] = await pool.execute(
            `SELECT page_id, page_key, title, body, featured_image, updated_at 
             FROM content_pages WHERE page_key = ? LIMIT 1`,
            [sectionKey]
        );
        if (rows.length === 0) return null;
        let parsed = null;
        try {
            parsed = JSON.parse(rows[0].body);
        } catch (e) {
            parsed = { raw_body: rows[0].body };
        }
        return {
            page_id: rows[0].page_id,
            page_key: rows[0].page_key,
            title: rows[0].title,
            data: parsed,
            featured_image: rows[0].featured_image,
            updated_at: rows[0].updated_at
        };
    },

    async getAllWebsiteContent() {
        const keys = ['homepage', 'about_us', 'contact_us', 'footer', 'site_branding'];
        const [rows] = await pool.query(
            `SELECT page_id, page_key, title, body, featured_image, updated_at 
             FROM content_pages WHERE page_key IN (?)`,
            [keys]
        );
        const result = {};
        for (const r of rows) {
            try {
                result[r.page_key] = JSON.parse(r.body);
            } catch (e) {
                result[r.page_key] = { raw_body: r.body };
            }
        }
        return result;
    },

    async saveWebsiteSection(sectionKey, data, userId) {
        const validKeys = {
            homepage: 'Homepage Content',
            about_us: 'About Us Content',
            contact_us: 'Contact Us Content',
            footer: 'Footer Content',
            site_branding: 'Site Branding & Logos'
        };

        if (!validKeys[sectionKey]) {
            throw new Error(`Invalid website content section: ${sectionKey}`);
        }

        const title = validKeys[sectionKey];
        const jsonBody = typeof data === 'string' ? data : JSON.stringify(data);

        await pool.execute(
            `INSERT INTO content_pages (page_key, title, body, is_published, updated_by)
             VALUES (?, ?, ?, 1, ?)
             ON DUPLICATE KEY UPDATE 
                body = VALUES(body),
                updated_by = VALUES(updated_by),
                updated_at = CURRENT_TIMESTAMP`,
            [sectionKey, title, jsonBody, userId || null]
        );

        // Keep legacy content_pages rows synchronized
        try {
            const parsedObj = typeof data === 'object' ? data : JSON.parse(data);
            if (sectionKey === 'about_us') {
                if (parsedObj.history && parsedObj.history.body) {
                    await pool.execute(
                        `INSERT INTO content_pages (page_key, title, body, is_published, updated_by)
                         VALUES ('church_history', 'Our Church History', ?, 1, ?)
                         ON DUPLICATE KEY UPDATE body = VALUES(body), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
                        [parsedObj.history.body, userId || null]
                    );
                }
                if (parsedObj.mission && parsedObj.vision) {
                    const mvBody = `Mission:\n${parsedObj.mission.body || ''}\n\nVision:\n${parsedObj.vision.body || ''}`;
                    await pool.execute(
                        `INSERT INTO content_pages (page_key, title, body, is_published, updated_by)
                         VALUES ('mission_vision', 'Mission and Vision', ?, 1, ?)
                         ON DUPLICATE KEY UPDATE body = VALUES(body), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
                        [mvBody, userId || null]
                    );
                }
            } else if (sectionKey === 'contact_us') {
                const cBody = `${parsedObj.address || ''}\nPhone: ${parsedObj.phone || ''} / ${parsedObj.mobile || ''}\nEmail: ${parsedObj.email || ''}\nOffice Hours: ${parsedObj.office_hours || ''}`;
                await pool.execute(
                    `INSERT INTO content_pages (page_key, title, body, is_published, updated_by)
                     VALUES ('contact_info', 'Contact Information', ?, 1, ?)
                     ON DUPLICATE KEY UPDATE body = VALUES(body), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
                    [cBody, userId || null]
                );
            }
        } catch (syncErr) {
            console.warn('[CMS Sync] Notice while synchronizing legacy pages:', syncErr.message);
        }

        return this.getWebsiteSection(sectionKey);
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

function extractFacebookVideoId(urlOrKey) {
    if (!urlOrKey) return '';
    const str = String(urlOrKey).trim();
    // 1. Check for standard FB video URL: /videos/123456789/ or ?v=123456789
    const vMatch = str.match(/(?:videos\/|watch\/?\?v=|fb\.watch\/)(\d+)/i);
    if (vMatch && vMatch[1]) return vMatch[1];
    // 2. Check for Stream Key: FB-123456789-...
    const keyMatch = str.match(/^FB-(\d+)-/i);
    if (keyMatch && keyMatch[1]) return keyMatch[1];
    // 3. Fallback: sequence of 9-25 digits
    const digitsMatch = str.match(/\d{9,25}/);
    if (digitsMatch) return digitsMatch[0];
    return '';
}

module.exports = ContentModel;