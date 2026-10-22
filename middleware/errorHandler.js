const path = require('path');

function notFound(req, res, next) {
    if (req.accepts('html') && !req.originalUrl.startsWith('/api')) {
        return res.status(404).sendFile(path.join(__dirname, '..', 'public', 'views', 'index.html'));
    }
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
}

function errorHandler(err, req, res, next) {
    const statusCode = err.status || 500;
    const response = {
        success: false,
        status: statusCode,
        message: err.message || 'Internal Server Error',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    };

    if (process.env.NODE_ENV === 'development' && statusCode === 500) {
        response.stack = err.stack;
    }

    console.error(`[ERROR ${statusCode}] ${req.method} ${req.originalUrl} - ${err.message}`);

    res.status(statusCode).json(response);
}

module.exports = {
    notFound,
    errorHandler
};
