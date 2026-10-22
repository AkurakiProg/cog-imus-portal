function successResponse(res, data = null, message = 'Request successful', statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        status: statusCode,
        message,
        data,
        timestamp: new Date().toISOString()
    });
}

function errorResponse(res, message = 'Request failed', statusCode = 400, errors = null) {
    const body = {
        success: false,
        status: statusCode,
        message,
        timestamp: new Date().toISOString()
    };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
}

function paginatedResponse(res, data, total, page, limit, message = 'Request successful') {
    const totalPages = Math.ceil(total / limit);
    return res.status(200).json({
        success: true,
        status: 200,
        message,
        data,
        pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        },
        timestamp: new Date().toISOString()
    });
}

module.exports = {
    successResponse,
    errorResponse,
    paginatedResponse
};