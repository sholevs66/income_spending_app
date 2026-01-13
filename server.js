/**
 * Finance Dashboard API Server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===========================================
// API ROUTES
// ===========================================

/**
 * Get available months
 */
app.get('/api/months', (req, res) => {
  try {
    const months = db.getAvailableMonths();
    res.json({ months });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get monthly summary
 */
app.get('/api/summary/:year/:month', (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    const summary = db.getMonthlySummary(year, month);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get transaction count
 */
app.get('/api/stats', (req, res) => {
  try {
    const count = db.getTransactionCount();
    res.json({ transactionCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Year-to-Date summary
 */
app.get('/api/ytd/:year', (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (isNaN(year)) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    const summary = db.getYearToDateSummary(year);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// CATEGORY ROUTES
// ===========================================

/**
 * Get all categories
 */
app.get('/api/categories', (req, res) => {
  try {
    const categories = db.getCategories();
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new category
 */
app.post('/api/categories', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const category = db.createCategory(name, color);
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a category
 */
app.delete('/api/categories/:id', (req, res) => {
  try {
    db.deleteCategory(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get category rules (for management UI)
 */
app.get('/api/categories/rules', (req, res) => {
  try {
    const rules = db.getCategoryRules();
    res.json({ rules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Set category for a transaction
 */
app.post('/api/transactions/category', (req, res) => {
  try {
    const { transactionId, categoryId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID required' });
    }
    db.setTransactionCategory(transactionId, categoryId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting category:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Toggle transfer status for a transaction
 */
app.post('/api/transactions/transfer', (req, res) => {
  try {
    const { transactionId, isTransfer } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID required' });
    }
    db.setTransactionTransfer(transactionId, isTransfer);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting transfer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Re-detect transfers for all transactions
 */
app.post('/api/redetect-transfers', (req, res) => {
  try {
    const count = db.redetectTransfers();
    res.json({ success: true, processed: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mark transaction as investment
 */
app.post('/api/transactions/investment', (req, res) => {
  try {
    const { transactionId, isInvestment } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID required' });
    }
    db.setTransactionInvestment(transactionId, isInvestment);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting investment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Exclude all transactions in a month from balance
 */
app.post('/api/exclude-month', (req, res) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month required' });
    }
    const count = db.excludeAllInMonth(year, month);
    res.json({ success: true, excluded: count });
  } catch (error) {
    console.error('Error excluding month:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Set user comment for a transaction
 */
app.post('/api/transactions/comment', (req, res) => {
  try {
    const { transactionId, comment } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID required' });
    }
    db.setTransactionComment(transactionId, comment);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting comment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get category averages for a month
 */
app.get('/api/category-averages/:year/:month', (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const averages = db.getAllCategoryAverages(year, month);
    res.json({ averages });
  } catch (error) {
    console.error('Error getting averages:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get savings goal (default)
 */
app.get('/api/savings-goal', (req, res) => {
  try {
    const goal = db.getDefaultSavingsGoal();
    res.json({ goal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get savings goal for specific month
 */
app.get('/api/savings-goal/:year/:month', (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const goal = db.getSavingsGoal(year, month);
    const defaultGoal = db.getDefaultSavingsGoal();
    res.json({ goal, defaultGoal, isCustom: goal !== defaultGoal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Set savings goal (default or for specific month)
 */
app.post('/api/savings-goal', (req, res) => {
  try {
    const { goal, year, month } = req.body;
    db.setSavingsGoal(goal, year, month);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get expected income
 */
app.get('/api/expected-income', (req, res) => {
  try {
    const income = db.getExpectedIncome();
    res.json({ income });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Set expected income
 */
app.post('/api/expected-income', (req, res) => {
  try {
    const { income } = req.body;
    db.setExpectedIncome(income);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get available budget calculation
 */
app.get('/api/available-budget/:year/:month', (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const budget = db.calculateAvailableBudget(year, month);
    res.json(budget);
  } catch (error) {
    console.error('Error calculating budget:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log(`\n🚀 Finance Dashboard running at http://localhost:${PORT}`);
  console.log(`📊 Database has ${db.getTransactionCount()} transactions\n`);
});
