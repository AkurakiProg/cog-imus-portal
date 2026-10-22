const { errorResponse } = require('../utils/responseFormatter');

module.exports = function(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role_name) {
            return errorResponse(res, 'Authentication required.', 401);
        }

        if (!allowedRoles.includes(req.user.role_name)) {
            return errorResponse(res, 'Forbidden. You do not have permission to perform this action.', 403);
        }

        next();
    };
};