const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Analytics & Summary available to both Admin and Leader
router.get('/analytics', authMiddleware, roleMiddleware('Admin', 'Church Leader'), financeController.getAnalytics);
router.get('/categories', authMiddleware, roleMiddleware('Admin', 'Church Leader'), financeController.getCategories);

// View transactions available to both Admin and Leader
router.get('/', authMiddleware, roleMiddleware('Admin', 'Church Leader'), financeController.getAllTransactions);
router.get('/:id', authMiddleware, roleMiddleware('Admin', 'Church Leader'), financeController.getTransactionById);

// Create, Update, Delete - ADMIN ONLY
router.post('/', authMiddleware, roleMiddleware('Admin'), financeController.createTransaction);
router.put('/:id', authMiddleware, roleMiddleware('Admin'), financeController.updateTransaction);
router.delete('/:id', authMiddleware, roleMiddleware('Admin'), financeController.deleteTransaction);

module.exports = router;