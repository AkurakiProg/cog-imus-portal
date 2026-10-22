const financeModel = require('../models/financeModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');

exports.getAllTransactions = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || '',
            type: req.query.type || '',
            category_id: req.query.category_id || '',
            department: req.query.department || '',
            ministry_id: req.query.ministry_id || '',
            date_from: req.query.date_from || req.query.start_date || req.query.from || '',
            date_to: req.query.date_to || req.query.end_date || req.query.to || ''
        };

        if (req.query.all === 'true' || (!req.query.page && !req.query.limit)) {
            const transactions = await financeModel.getAll(null, 0, filters);
            return successResponse(res, transactions, 'Finance transactions retrieved successfully');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            financeModel.getAll(limit, offset, filters),
            financeModel.getCount(filters)
        ]);

        return paginatedResponse(res, transactions, total, page, limit, 'Finance transactions retrieved successfully');
    } catch (error) {
        console.error('Get Transactions Error:', error);
        return errorResponse(res, 'Failed to retrieve transactions.', 500);
    }
};

exports.getTransactionById = async (req, res) => {
    try {
        const transaction = await financeModel.getById(req.params.id);
        if (!transaction) return errorResponse(res, 'Transaction not found.', 404);
        return successResponse(res, transaction, 'Transaction retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve transaction.', 500);
    }
};

exports.getCategories = async (req, res) => {
    try {
        const categories = await financeModel.getCategories();
        return successResponse(res, categories, 'Categories retrieved successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve categories.', 500);
    }
};

exports.createTransaction = async (req, res) => {
    try {
        const transactionId = await financeModel.create(req.body, req.user.id);
        await userModel.logAudit(req.user.id, 'CREATE', 'Finance', transactionId, null, req.body, req.ip, req.headers['user-agent']);
        return successResponse(res, { transactionId }, 'Transaction recorded successfully', 201);
    } catch (error) {
        console.error('Create Transaction Error:', error);
        return errorResponse(res, 'Failed to record transaction.', 500);
    }
};

exports.updateTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const oldTransaction = await financeModel.getById(id);
        if (!oldTransaction) return errorResponse(res, 'Transaction not found.', 404);

        const updateData = {
            category_id: req.body.category_id ? Number(req.body.category_id) : oldTransaction.category_id,
            ministry_id: req.body.ministry_id !== undefined ? (req.body.ministry_id ? Number(req.body.ministry_id) : null) : oldTransaction.ministry_id,
            department: req.body.department !== undefined ? req.body.department : oldTransaction.department,
            transaction_type: req.body.transaction_type || oldTransaction.transaction_type,
            amount: req.body.amount !== undefined && req.body.amount !== '' ? req.body.amount : oldTransaction.amount,
            transaction_date: req.body.transaction_date ? String(req.body.transaction_date).split('T')[0] : oldTransaction.transaction_date,
            description: req.body.description !== undefined ? req.body.description : oldTransaction.description,
            reference_number: req.body.reference_number !== undefined ? req.body.reference_number : oldTransaction.reference_number,
            attachment: req.body.attachment !== undefined ? req.body.attachment : oldTransaction.attachment
        };

        await financeModel.update(id, updateData);
        await userModel.logAudit(req.user.id, 'UPDATE', 'Finance', id, oldTransaction, updateData, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Transaction updated successfully');
    } catch (error) {
        console.error('Update Transaction Error:', error);
        return errorResponse(res, error.message || 'Failed to update transaction.', 500);
    }
};

exports.deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await financeModel.getById(id);
        if (!transaction) return errorResponse(res, 'Transaction not found.', 404);

        await financeModel.delete(id);
        await userModel.logAudit(req.user.id, 'DELETE', 'Finance', id, transaction, null, req.ip, req.headers['user-agent']);
        return successResponse(res, null, 'Transaction deleted successfully');
    } catch (error) {
        return errorResponse(res, 'Failed to delete transaction.', 500);
    }
};

// --- Analytics Controller ---
exports.getAnalytics = async (req, res) => {
    try {
        const [summary, trends, breakdown] = await Promise.all([
            financeModel.getSummary(),
            financeModel.getMonthlyTrends(),
            financeModel.getCategoryBreakdown()
        ]);

        return successResponse(res, { summary, trends, breakdown }, 'Analytics data retrieved successfully');
    } catch (error) {
        console.error('Get Analytics Error:', error);
        return errorResponse(res, 'Failed to retrieve analytics.', 500);
    }
};