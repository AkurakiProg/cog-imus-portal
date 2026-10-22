const { pool } = require('../config/database');

function extractFacebookVideoId(urlOrKey) {
    if (!urlOrKey) return '';
    const str = String(urlOrKey).trim();
    // 1. Direct Video URL: /videos/123456789/ or watch/?v=123456789 or fb.watch/123456789
    const vMatch = str.match(/(?:videos\/|watch\/?\?v=|fb\.watch\/)(\d+)/i);
    if (vMatch && vMatch[1]) return vMatch[1];
    // 2. Stream Key pattern: FB-123456789-...
    const keyMatch = str.match(/^FB-(\d+)-/i);
    if (keyMatch && keyMatch[1]) return keyMatch[1];
    // 3. Fallback: isolated sequence of 9-25 digits
    const digitsMatch = str.match(/\b\d{9,25}\b/);
    if (digitsMatch) return digitsMatch[0];
    return '';
}

function getTodayLocalDateStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const FacebookService = {
    extractFacebookVideoId,

    isConfigured() {
        const token = process.env.FB_PAGE_ACCESS_TOKEN;
        return Boolean(token && token.trim().length > 10);
    },

    getApiConfig() {
        return {
            configured: this.isConfigured(),
            hasToken: Boolean(process.env.FB_PAGE_ACCESS_TOKEN),
            apiVersion: 'v19.0'
        };
    },

    /**
     * Query Facebook Meta Graph API for a video or live_video object
     * @param {string} videoId 
     * @param {string} [token] 
     * @returns {Promise<Object>}
     */
    async fetchVideoMetrics(videoId, token = null) {
        const accessToken = token || process.env.FB_PAGE_ACCESS_TOKEN;
        if (!accessToken || !accessToken.trim()) {
            return {
                configured: false,
                success: false,
                error: 'Facebook Page Access Token (FB_PAGE_ACCESS_TOKEN) is not configured in .env'
            };
        }

        if (!videoId) {
            return {
                configured: true,
                success: false,
                error: 'No Facebook video ID provided to query Graph API'
            };
        }

        const cleanId = String(videoId).trim();
        const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(cleanId)}?fields=id,live_views,views,status,title,description&access_token=${encodeURIComponent(accessToken.trim())}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            const resp = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeout);
            const data = await resp.json();

            if (data.error) {
                return {
                    configured: true,
                    success: false,
                    error: data.error.message || 'Facebook Graph API returned an error',
                    code: data.error.code,
                    fbError: data.error
                };
            }

            return {
                configured: true,
                success: true,
                video_id: data.id || cleanId,
                live_views: Number(data.live_views || 0),
                views: Number(data.views || 0),
                status: data.status || 'UNKNOWN',
                title: data.title || ''
            };
        } catch (err) {
            clearTimeout(timeout);
            const isTimeout = err.name === 'AbortError';
            return {
                configured: true,
                success: false,
                error: isTimeout ? 'Facebook Graph API request timed out (10s)' : (err.message || 'Network error connecting to Facebook Graph API')
            };
        }
    },

    /**
     * Synchronize Facebook live views & total views into MySQL database
     * @param {Object} [stream] - current livestream broadcast object
     * @returns {Promise<Object>}
     */
    async syncFacebookMetrics(stream = null) {
        if (!this.isConfigured()) {
            return {
                configured: false,
                success: false,
                message: 'Facebook Page Access Token (FB_PAGE_ACCESS_TOKEN) is not configured in .env'
            };
        }

        let targetStream = stream;
        if (!targetStream) {
            const [rows] = await pool.execute(`SELECT * FROM livestream_broadcast ORDER BY id ASC LIMIT 1`);
            targetStream = rows[0] || null;
        }

        if (!targetStream) {
            return {
                configured: true,
                success: false,
                message: 'No broadcast configuration found in database.'
            };
        }

        const videoId = extractFacebookVideoId(targetStream.stream_url || targetStream.stream_key);
        if (!videoId) {
            return {
                configured: true,
                success: false,
                message: 'Could not extract a valid Facebook video ID from current stream URL or stream key.'
            };
        }

        const metrics = await this.fetchVideoMetrics(videoId);
        if (!metrics.success) {
            return {
                configured: true,
                success: false,
                message: metrics.error || 'Failed to fetch Facebook metrics.',
                error: metrics.error,
                code: metrics.code
            };
        }

        const todayStr = getTodayLocalDateStr();
        const liveViews = Number(metrics.live_views || 0);
        const totalViews = Number(metrics.views || 0);

        try {
            // Update today's record in livestream_daily_views
            await pool.execute(
                `INSERT INTO livestream_daily_views (view_date, views_count, peak_viewers, fb_views_count, fb_peak_viewers, fb_synced_at, stream_title, notes)
                 VALUES (?, 0, 0, ?, ?, NOW(), ?, 'Facebook Live Metrics Synced')
                 ON DUPLICATE KEY UPDATE 
                    fb_views_count = GREATEST(fb_views_count, VALUES(fb_views_count)),
                    fb_peak_viewers = GREATEST(fb_peak_viewers, VALUES(fb_peak_viewers)),
                    fb_synced_at = NOW()`,
                [todayStr, totalViews, liveViews, targetStream.title || 'Livestream Broadcast']
            );

            // Update livestream_broadcast table
            await pool.execute(
                `UPDATE livestream_broadcast 
                 SET fb_live_views = ?, fb_total_views = ?, fb_synced_at = NOW()
                 WHERE id = ?`,
                [liveViews, totalViews, targetStream.id || 1]
            );

            return {
                configured: true,
                success: true,
                video_id: videoId,
                live_views: liveViews,
                views: totalViews,
                status: metrics.status,
                synced_at: new Date().toISOString(),
                message: `Successfully synchronized Facebook metrics: ${liveViews} live viewers, ${totalViews} total views.`
            };
        } catch (dbErr) {
            console.error('Error updating DB with Facebook metrics:', dbErr);
            return {
                configured: true,
                success: false,
                message: 'Failed to update database with Facebook metrics: ' + dbErr.message
            };
        }
    }
};

module.exports = FacebookService;
