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

        // Role change validation: if user's role has changed in database since JWT issuance
        if (decoded.role_id !== undefined && user.role_id !== decoded.role_id) {
            // If this is an active save mutation (POST, PUT, PATCH, DELETE), allow the authorized save to commit first
            if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
                req.user = {
                    id: user.user_id,
                    role_id: user.role_id,
                    role_name: user.role_name,
                    username: user.username,
                    full_name: user.full_name,
                    email: user.email
                };
                res.setHeader('X-Session-Terminated', 'role_changed');
                return next();
            }
            await pool.execute('UPDATE users SET current_session_token = NULL WHERE user_id = ?', [user.user_id]);
            return errorResponse(res, 'Session terminated: Your account role has been updated. Please log in again.', 401);
        }

        // Concurrent session validation: invalidate previous device/browser sessions or terminated sessions
        if (!user.current_session_token || !decoded.sessionToken || decoded.sessionToken !== user.current_session_token) {
            // If the session token was cleared due to role change or password update, allow in-flight save mutation to commit
            if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' && !user.current_session_token) {
                req.user = {
                    id: user.user_id,
                    role_id: user.role_id,
                    role_name: user.role_name,
                    username: user.username,
                    full_name: user.full_name,
                    email: user.email
                };
                res.setHeader('X-Session-Terminated', 'session_terminated');
                return next();
            }
            return errorResponse(res, 'Session terminated: You have logged in from another browser or device, or your session has expired.', 401);
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