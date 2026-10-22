const rateLimit = require('express-rate-limit');

// Strict rate limiter for authentication routes (login and register)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // Limit each IP to 15 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        status: 429,
        message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
    }
});

// Rate limiter for public contact form submissions
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 submissions per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        status: 429,
        message: 'Too many contact messages sent from this IP. Please wait a few minutes before trying again.'
    }
});

// Rate limiter for MFA verification and challenge endpoints
const mfaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 MFA verification attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        status: 429,
        message: 'Too many two-factor authentication attempts from this IP. Please wait 15 minutes.'
    }
});

module.exports = {
    authLimiter,
    contactLimiter,
    mfaLimiter
};
