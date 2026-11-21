const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        status: 429,
        message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
    }
});

const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        status: 429,
        message: 'Too many contact messages sent from this IP. Please wait a few minutes before trying again.'
    }
});

const mfaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
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
