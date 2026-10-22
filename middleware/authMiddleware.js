const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/responseFormatter');
const { pool } = require('../config/database');

module.exports = async function(req, res, next) {
    const authHeader = req.header('Authorization');
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return errorResponse(res, 'Access denied. No token provided.', 401);
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        return errorResponse(res, 'Internal configuration error: JWT_SECRET not configured.', 500);
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        
        // Security check: verify user still exists and is active in database
        const [rows] = await pool.execute(
            `SELECT u.user_id, u.role_id, r.role_name, u.username, u.full_name, u.email, u.is_active, u.current_session_token
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE u.user_id = ?`,
            [decoded.id]
        );

        if (rows.length === 0) {
            return errorResponse(res, 'Invalid token. User account no longer exists.', 401);
        }

        const user = rows[0];
        if (!user.is_active) {
            return errorResponse(res, 'Your account has been deactivated. Please contact the administrator.', 403);
        }

        // Concurrent session validation: invalidate previous device/browser sessions
        if (!user.current_session_token || !decoded.sessionToken || decoded.sessionToken !== user.current_session_token) {
            return errorResponse(res, 'Session terminated: You have logged in from another browser or device.', 401);
        }

        // Attach verified user info to request object
        req.user = {
            id: user.user_id,
            role_id: user.role_id,
            role_name: user.role_name,
            username: user.username,
            full_name: user.full_name,
            email: user.email
        };
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return errorResponse(res, 'Session expired. Please log in again.', 401);
        }
        return errorResponse(res, 'Invalid or corrupted token.', 401);
    }
};