const analyticsModel = require('../models/analyticsModel');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

exports.getDashboardAnalytics = async (req, res) => {
    try {
        const [summary, trends, breakdown, growth] = await Promise.all([
            analyticsModel.getFinanceSummary(),
            analyticsModel.getMonthlyTrends(),
            analyticsModel.getCategoryBreakdown(),
            analyticsModel.getMemberGrowth()
        ]);

        return successResponse(res, { summary, trends, breakdown, growth }, 'Analytics retrieved');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve analytics', 500);
    }
};