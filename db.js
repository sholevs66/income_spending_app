/**
 * SQLite Database Layer
 * Stores transactions from Israeli banks
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'finance.db');
const db = new Database(DB_PATH);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    memo TEXT,
    account TEXT NOT NULL,
    type TEXT,
    scraped_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6366f1',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS category_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description_pattern TEXT NOT NULL UNIQUE,
    category_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_account ON transactions(account);
`);

// Add columns if they don't exist (for existing databases)
try {
  db.exec(`ALTER TABLE transactions ADD COLUMN category_id TEXT`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE transactions ADD COLUMN is_transfer INTEGER DEFAULT 0`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE transactions ADD COLUMN is_investment INTEGER DEFAULT 0`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE transactions ADD COLUMN user_comment TEXT`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE transactions ADD COLUMN is_occasional_income INTEGER DEFAULT 0`);
} catch (e) { /* column already exists */ }

// Create index on category_id (after column exists)
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_category ON transactions(category_id)`);
} catch (e) { /* index already exists or column missing */ }

// Patterns for automatic exclusion from balance (transfers, CC lump sums from bank)
const TRANSFER_PATTERNS = [
  'כרטיסי אשראי ל',  // Visa Cal lump sum charge in Hapoalim (we have detailed transactions from Cal)
];

/**
 * Check if a transaction description matches transfer patterns
 */
function isTransfer(description) {
  if (!description) return false;
  const lower = description.toLowerCase();
  return TRANSFER_PATTERNS.some(p => description.includes(p) || lower.includes(p.toLowerCase()));
}

/**
 * Insert or update transactions (preserves category_id and is_transfer if already set)
 */
function upsertTransactions(transactions, account) {
  // Check if transaction exists
  const checkStmt = db.prepare('SELECT id, category_id, is_transfer FROM transactions WHERE id = ?');
  
  // Insert new transaction
  const insertStmt = db.prepare(`
    INSERT INTO transactions (id, date, amount, description, memo, account, type, is_transfer, scraped_at)
    VALUES (@id, @date, @amount, @description, @memo, @account, @type, @is_transfer, datetime('now'))
  `);
  
  // Update existing transaction (preserve category_id and is_transfer)
  const updateStmt = db.prepare(`
    UPDATE transactions 
    SET date = @date, amount = @amount, description = @description, memo = @memo, 
        account = @account, type = @type, scraped_at = datetime('now')
    WHERE id = @id
  `);

  const upsertMany = db.transaction((txns) => {
    for (const txn of txns) {
      const existing = checkStmt.get(txn.id);
      
      if (existing) {
        // Update but keep category_id and is_transfer
        updateStmt.run({
          id: txn.id,
          date: txn.date,
          amount: txn.amount,
          description: txn.description || '',
          memo: txn.memo || '',
          account: account,
          type: txn.amount > 0 ? 'income' : 'expense',
        });
      } else {
        // New transaction - auto-detect if it's a transfer
        const transfer = isTransfer(txn.description) ? 1 : 0;
        insertStmt.run({
          id: txn.id,
          date: txn.date,
          amount: txn.amount,
          description: txn.description || '',
          memo: txn.memo || '',
          account: account,
          type: txn.amount > 0 ? 'income' : 'expense',
          is_transfer: transfer,
        });
      }
    }
  });

  upsertMany(transactions);
  return transactions.length;
}

// Patterns for salary (income that should shift to previous month)
const SALARY_PATTERNS = [
  'משכורת',
  'שכר',
  'זיכוי מלאומי',
  'העברת משכורת',
];

// Patterns for credit card charges (expenses that should shift to previous month)
const CREDIT_CARD_PATTERNS = [
  'מסטרקרד',
  'ויזה',
  'כרטיסי אשראי',
  'ישראכרט',
  'אמריקן אקספרס',
  'דיינרס',
  'לאומי קארד',
];

/**
 * Check if transaction matches salary patterns
 */
function isSalaryTransaction(description, amount) {
  if (amount <= 0) return false;
  if (!description) return false;
  return SALARY_PATTERNS.some(p => description.includes(p));
}

/**
 * Check if transaction matches credit card patterns
 */
function isCreditCardTransaction(description) {
  if (!description) return false;
  return CREDIT_CARD_PATTERNS.some(p => description.includes(p));
}

/**
 * Get all transactions for a specific Israeli-style month
 * 
 * Logic:
 * - Include all transactions from the 1st to last day of the month
 * - ALSO include salary/credit card from the 1st-10th of NEXT month (these are for this month)
 * - EXCLUDE salary/credit card from the 1st-10th of THIS month (these belong to previous month)
 */
function getTransactionsByIsraeliMonth(year, month) {
  // Get the full month range plus early next month
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`;
  
  // Calculate next month for early transactions
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }
  const earlyNextMonthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-10`;

  // Get all transactions from month start to early next month
  const stmt = db.prepare(`
    SELECT * FROM transactions 
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
  `);

  const allTransactions = stmt.all(monthStart, earlyNextMonthEnd);
  
  // Filter based on Israeli logic
  return allTransactions.filter(txn => {
    const date = new Date(txn.date);
    const txnMonth = date.getMonth() + 1; // 1-based
    const txnDay = date.getDate();
    const txnYear = date.getFullYear();
    
    // Check if this is from the target month
    const isTargetMonth = (txnYear === year && txnMonth === month);
    
    // Salary/CC bills come on the 1st-3rd of the month
    const BILL_CUTOFF_DAY = 3;
    
    // Check if this is from early next month (1st-3rd only for bills)
    const isEarlyNextMonth = (
      (txnYear === nextYear && txnMonth === nextMonth && txnDay <= BILL_CUTOFF_DAY) ||
      (nextMonth === 1 && txnYear === nextYear && txnMonth === 1 && txnDay <= BILL_CUTOFF_DAY)
    );
    
    if (isTargetMonth) {
      // For transactions IN the target month
      if (txnDay <= BILL_CUTOFF_DAY) {
        // Very early in the month (1st-3rd) - only include if NOT salary/CC (those belong to previous month)
        const isSalary = isSalaryTransaction(txn.description, txn.amount);
        const isCC = isCreditCardTransaction(txn.description);
        return !isSalary && !isCC;
      } else {
        // After the 3rd - always include
        return true;
      }
    } else if (isEarlyNextMonth) {
      // For transactions from 1st-3rd of next month - only include salary/CC (monthly bills)
      const isSalary = isSalaryTransaction(txn.description, txn.amount);
      const isCC = isCreditCardTransaction(txn.description);
      return isSalary || isCC;
    }
    
    return false;
  });
}

/**
 * Get monthly summary (Israeli-style)
 */
function getMonthlySummary(year, month) {
  const allTransactions = getTransactionsByIsraeliMonth(year, month);
  
  let income = 0;
  let expenses = 0;
  let transfersIn = 0;
  let transfersOut = 0;
  let investmentTotal = 0;
  
  const transactions = [];
  const transfers = [];
  const investments = [];

  for (const txn of allTransactions) {
    if (txn.is_transfer) {
      transfers.push(txn);
      if (txn.amount > 0) {
        transfersIn += txn.amount;
      } else {
        transfersOut += Math.abs(txn.amount);
      }
    } else if (txn.is_investment) {
      investments.push(txn);
      investmentTotal += Math.abs(txn.amount);
    } else {
      transactions.push(txn);
      if (txn.amount > 0) {
        income += txn.amount;
      } else {
        expenses += Math.abs(txn.amount);
      }
    }
  }

  // Group transactions by category
  const byCategory = {};
  for (const txn of transactions) {
    const catId = txn.category_id || 'uncategorized';
    if (!byCategory[catId]) {
      byCategory[catId] = { income: 0, expenses: 0, transactions: [] };
    }
    if (txn.amount > 0) {
      byCategory[catId].income += txn.amount;
    } else {
      byCategory[catId].expenses += Math.abs(txn.amount);
    }
    byCategory[catId].transactions.push(txn);
  }

  return {
    year,
    month,
    income,
    expenses,
    balance: income - expenses,
    transfersIn,
    transfersOut,
    transfersNet: transfersIn - transfersOut,
    investmentTotal,
    transactionCount: transactions.length,
    transactions,
    transfers,
    investments,
    byCategory,
  };
}

/**
 * Get all available months
 */
function getAvailableMonths() {
  const stmt = db.prepare(`
    SELECT DISTINCT substr(date, 1, 7) as month 
    FROM transactions 
    ORDER BY month DESC
  `);
  
  const rows = stmt.all();
  
  // Convert to Israeli months
  const israeliMonths = new Set();
  for (const row of rows) {
    const [year, month] = row.month.split('-').map(Number);
    // Add both the current month and previous month as potential Israeli months
    israeliMonths.add(`${year}-${String(month).padStart(2, '0')}`);
    if (month === 1) {
      israeliMonths.add(`${year - 1}-12`);
    } else {
      israeliMonths.add(`${year}-${String(month - 1).padStart(2, '0')}`);
    }
  }
  
  return Array.from(israeliMonths).sort().reverse();
}

/**
 * Get transaction count
 */
function getTransactionCount() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM transactions');
  return stmt.get().count;
}

// ===========================================
// CATEGORY FUNCTIONS
// ===========================================

/**
 * Get all categories
 */
function getCategories() {
  const stmt = db.prepare('SELECT * FROM categories ORDER BY name');
  return stmt.all();
}

/**
 * Create a new category
 */
function createCategory(name, color = '#6366f1') {
  const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const stmt = db.prepare('INSERT INTO categories (id, name, color) VALUES (?, ?, ?)');
  stmt.run(id, name, color);
  return { id, name, color };
}

/**
 * Delete a category (and its rules, unset from all transactions)
 */
function deleteCategory(id) {
  // First, unset this category from all transactions
  db.prepare('UPDATE transactions SET category_id = NULL WHERE category_id = ?').run(id);
  // Delete all rules for this category
  db.prepare('DELETE FROM category_rules WHERE category_id = ?').run(id);
  // Then delete the category
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

/**
 * Set category for a transaction AND create an auto-rule for the description
 */
function setTransactionCategory(transactionId, categoryId) {
  // Update this transaction
  const stmt = db.prepare('UPDATE transactions SET category_id = ? WHERE id = ?');
  stmt.run(categoryId, transactionId);
  
  // Get the transaction's description to create a rule
  const txn = db.prepare('SELECT description FROM transactions WHERE id = ?').get(transactionId);
  if (txn && txn.description && categoryId) {
    // Create or update the rule for this description pattern
    const ruleStmt = db.prepare(`
      INSERT INTO category_rules (description_pattern, category_id) 
      VALUES (?, ?)
      ON CONFLICT(description_pattern) DO UPDATE SET category_id = ?
    `);
    ruleStmt.run(txn.description, categoryId, categoryId);
    
    // Apply this rule to all other transactions with the same description
    const applyStmt = db.prepare(`
      UPDATE transactions 
      SET category_id = ? 
      WHERE description = ? AND (category_id IS NULL OR category_id = '')
    `);
    applyStmt.run(categoryId, txn.description);
  }
  
  // If clearing category, also remove the rule
  if (!categoryId && transactionId) {
    const txnForRule = db.prepare('SELECT description FROM transactions WHERE id = ?').get(transactionId);
    if (txnForRule && txnForRule.description) {
      db.prepare('DELETE FROM category_rules WHERE description_pattern = ?').run(txnForRule.description);
    }
  }
}

/**
 * Mark/unmark a transaction as transfer
 */
function setTransactionTransfer(transactionId, isTransfer) {
  const stmt = db.prepare('UPDATE transactions SET is_transfer = ? WHERE id = ?');
  stmt.run(isTransfer ? 1 : 0, transactionId);
}

/**
 * Re-detect transfers for all transactions
 */
function redetectTransfers() {
  const allTxns = db.prepare('SELECT id, description FROM transactions').all();
  const stmt = db.prepare('UPDATE transactions SET is_transfer = ? WHERE id = ?');
  
  const update = db.transaction(() => {
    for (const txn of allTxns) {
      const transfer = isTransfer(txn.description) ? 1 : 0;
      stmt.run(transfer, txn.id);
    }
  });
  
  update();
  return allTxns.length;
}

/**
 * Get Year-to-Date summary (Israeli logic)
 * - Salary/CC on Jan 1-3 counts for PREVIOUS year
 * - Salary/CC on Jan 1-3 of NEXT year counts for THIS year
 * - Investments are tracked separately (not income/expense)
 */
function getYearToDateSummary(year) {
  // Get all transactions that could belong to this Israeli year
  const earlyThisYear = `${year}-01-01`;
  const endDate = `${year + 1}-01-03`;
  
  // Get all transactions in the range (excluding transfers)
  const allTxns = db.prepare(`
    SELECT * FROM transactions 
    WHERE date >= ? AND date <= ? AND is_transfer = 0
  `).all(earlyThisYear, endDate);
  
  let income = 0;
  let expenses = 0;
  let investmentTotal = 0;
  let count = 0;
  
  for (const txn of allTxns) {
    const date = new Date(txn.date);
    const txnYear = date.getFullYear();
    const txnMonth = date.getMonth() + 1;
    const txnDay = date.getDate();
    
    // Check if this is early January (1st-3rd)
    const isEarlyJan = txnMonth === 1 && txnDay <= 3;
    
    // Determine which Israeli year this belongs to
    let belongsToYear;
    if (isEarlyJan) {
      // Early Jan transactions: check if salary/CC (belongs to previous year)
      const isSalary = isSalaryTransaction(txn.description, txn.amount);
      const isCC = isCreditCardTransaction(txn.description);
      if (isSalary || isCC) {
        belongsToYear = txnYear - 1; // Belongs to previous year
      } else {
        belongsToYear = txnYear;
      }
    } else {
      belongsToYear = txnYear;
    }
    
    // Only count if it belongs to the requested year
    if (belongsToYear === year) {
      count++;
      
      if (txn.is_investment) {
        // Investments tracked separately (always positive total)
        investmentTotal += Math.abs(txn.amount);
      } else if (txn.amount > 0) {
        income += txn.amount;
      } else {
        expenses += Math.abs(txn.amount);
      }
    }
  }
  
  return {
    year,
    income,
    expenses,
    balance: income - expenses,
    investmentTotal,
    transactionCount: count,
  };
}

/**
 * Mark/unmark a transaction as investment
 */
function setTransactionInvestment(transactionId, isInvestment) {
  const stmt = db.prepare('UPDATE transactions SET is_investment = ?, is_transfer = 0 WHERE id = ?');
  stmt.run(isInvestment ? 1 : 0, transactionId);
}

/**
 * Mark/unmark a transaction as occasional income (gift, tax return, etc.)
 */
function setTransactionOccasionalIncome(transactionId, isOccasional) {
  const stmt = db.prepare('UPDATE transactions SET is_occasional_income = ? WHERE id = ?');
  stmt.run(isOccasional ? 1 : 0, transactionId);
}

/**
 * Get category average over last N months (excluding current month)
 */
function getCategoryAverage(categoryId, currentYear, currentMonth, numMonths = 3) {
  const totals = [];
  
  let year = currentYear;
  let month = currentMonth;
  
  // Go back numMonths months (excluding current)
  for (let i = 0; i < numMonths; i++) {
    // Move to previous month
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    
    // Get that month's summary
    const summary = getMonthlySummary(year, month);
    
    // Find this category's total
    let categoryTotal = 0;
    if (summary.byCategory && summary.byCategory[categoryId]) {
      const catData = summary.byCategory[categoryId];
      categoryTotal = catData.expenses; // We track expenses (positive number)
    }
    
    totals.push(categoryTotal);
  }
  
  // Calculate average (only if we have data)
  const nonZeroTotals = totals.filter(t => t > 0);
  if (nonZeroTotals.length === 0) return 0;
  
  const sum = nonZeroTotals.reduce((a, b) => a + b, 0);
  return Math.round(sum / nonZeroTotals.length);
}

/**
 * Get all category averages for display
 */
function getAllCategoryAverages(currentYear, currentMonth) {
  const categories = getCategories();
  const averages = {};
  
  for (const cat of categories) {
    averages[cat.id] = getCategoryAverage(cat.id, currentYear, currentMonth, 3);
  }
  
  // Also get uncategorized average
  averages['uncategorized'] = getCategoryAverage('uncategorized', currentYear, currentMonth, 3);
  
  return averages;
}

/**
 * Get a setting value
 */
function getSetting(key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

/**
 * Set a setting value
 */
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

/**
 * Get savings goal for a specific month (in agorot)
 * Falls back to default if no month-specific goal set
 */
function getSavingsGoal(year = null, month = null) {
  if (year && month) {
    const monthKey = `savings_goal_${year}_${month}`;
    const monthValue = getSetting(monthKey, null);
    if (monthValue !== null) {
      return parseInt(monthValue) || 0;
    }
  }
  // Fall back to default savings goal
  const value = getSetting('savings_goal', '0');
  return parseInt(value) || 0;
}

/**
 * Set savings goal for a specific month (in agorot)
 */
function setSavingsGoal(amount, year = null, month = null) {
  if (year && month) {
    const monthKey = `savings_goal_${year}_${month}`;
    setSetting(monthKey, String(amount));
  } else {
    setSetting('savings_goal', String(amount));
  }
}

/**
 * Get default savings goal (in agorot)
 */
function getDefaultSavingsGoal() {
  const value = getSetting('savings_goal', '0');
  return parseInt(value) || 0;
}

/**
 * Get expected income (user override, in agorot)
 */
function getExpectedIncome() {
  const value = getSetting('expected_income', '0');
  return parseInt(value) || 0;
}

/**
 * Set expected income (in agorot)
 */
function setExpectedIncome(amount) {
  setSetting('expected_income', String(amount));
}

/**
 * Calculate average REGULAR income from last N months
 * Excludes occasional income (gifts, tax returns, etc.)
 */
function getAverageRegularIncome(currentYear, currentMonth, numMonths = 3) {
  const incomes = [];
  
  let year = currentYear;
  let month = currentMonth;
  
  for (let i = 0; i < numMonths; i++) {
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    
    const summary = getMonthlySummary(year, month);
    // Calculate regular income (exclude occasional)
    let regularIncome = 0;
    for (const txn of summary.transactions) {
      if (txn.amount > 0 && !txn.is_occasional_income) {
        regularIncome += txn.amount;
      }
    }
    
    if (regularIncome > 0) {
      incomes.push(regularIncome);
    }
  }
  
  if (incomes.length === 0) return 0;
  const sum = incomes.reduce((a, b) => a + b, 0);
  return Math.round(sum / incomes.length);
}

/**
 * Get actual occasional income for a specific month
 */
function getOccasionalIncomeForMonth(year, month) {
  const summary = getMonthlySummary(year, month);
  let occasionalIncome = 0;
  
  for (const txn of summary.transactions) {
    if (txn.amount > 0 && txn.is_occasional_income) {
      occasionalIncome += txn.amount;
    }
  }
  
  return occasionalIncome;
}

/**
 * Get regular income for a specific month (excludes occasional)
 */
function getRegularIncomeForMonth(year, month) {
  const summary = getMonthlySummary(year, month);
  let regularIncome = 0;
  
  for (const txn of summary.transactions) {
    if (txn.amount > 0 && !txn.is_occasional_income) {
      regularIncome += txn.amount;
    }
  }
  
  return regularIncome;
}

// Keep old function for backwards compatibility
function getAverageIncome(currentYear, currentMonth, numMonths = 3) {
  return getAverageRegularIncome(currentYear, currentMonth, numMonths);
}

/**
 * Calculate available budget for variable expenses
 * 
 * Formula:
 * Available = Expected Income - Savings Goal - Fixed Expenses
 * 
 * Where:
 * - Expected Income = MAX(actual regular income, user expected income, average regular income) + actual occasional income
 * - Regular income = salary (excluding gifts, tax returns, etc.)
 * - Occasional income = gifts, tax returns, etc. (only included if already received this month)
 * - Fixed Expenses for each category (except הוצאות משתנות):
 *   Use MAX(actual spending this month, 3-month average)
 */
function calculateAvailableBudget(year, month) {
  const summary = getMonthlySummary(year, month);
  const averages = getAllCategoryAverages(year, month);
  const savingsGoal = getSavingsGoal(year, month);
  
  // Calculate regular income (excluding occasional)
  const actualRegularIncome = getRegularIncomeForMonth(year, month);
  const userExpectedIncome = getExpectedIncome();  // User's expected regular salary
  const averageRegularIncome = getAverageRegularIncome(year, month, 3);
  
  // Get actual occasional income received this month
  const actualOccasionalIncome = getOccasionalIncomeForMonth(year, month);
  
  // Expected regular income = MAX(actual regular, user expected, average regular)
  const expectedRegularIncome = Math.max(actualRegularIncome, userExpectedIncome, averageRegularIncome);
  
  // Total expected income = expected regular + actual occasional (only what we've already received)
  const expectedIncome = expectedRegularIncome + actualOccasionalIncome;
  const income = expectedIncome;
  
  // Total actual income for display purposes
  const actualIncome = summary.income;  // This includes both regular and occasional
  
  // Find the variable expenses category ID
  const variableCategory = getCategories().find(c => c.name === 'הוצאות משתנות');
  const variableCategoryId = variableCategory ? variableCategory.id : null;
  
  // Calculate fixed expenses (all categories except variable expenses)
  let fixedExpenses = 0;
  let variableActual = 0;
  
  for (const [catId, data] of Object.entries(summary.byCategory)) {
    if (catId === variableCategoryId) {
      // Track variable expenses separately
      variableActual = data.expenses;
      continue;
    }
    
    const actual = data.expenses;
    const average = averages[catId] || 0;
    
    // Use the higher of actual or average (be conservative)
    fixedExpenses += Math.max(actual, average);
  }
  
  // Calculate available for variable expenses
  const availableForVariable = income - savingsGoal - fixedExpenses;
  const remainingForVariable = availableForVariable - variableActual;
  
  return {
    income,
    actualIncome,
    expectedIncome,
    expectedRegularIncome,
    actualRegularIncome,
    actualOccasionalIncome,
    userExpectedIncome,
    averageIncome: averageRegularIncome,
    savingsGoal,
    fixedExpenses,
    availableForVariable,
    variableActual,
    remainingForVariable,
    // Breakdown for display
    breakdown: {
      totalBudget: income,
      minusSavings: savingsGoal,
      minusFixed: fixedExpenses,
      equalsVariable: availableForVariable,
      alreadySpent: variableActual,
      stillAvailable: remainingForVariable,
    }
  };
}

/**
 * Set user comment for a transaction
 */
function setTransactionComment(transactionId, comment) {
  const stmt = db.prepare('UPDATE transactions SET user_comment = ? WHERE id = ?');
  stmt.run(comment || null, transactionId);
}

/**
 * Exclude all transactions in a month from balance
 */
function excludeAllInMonth(year, month) {
  const transactions = getTransactionsByIsraeliMonth(year, month);
  const stmt = db.prepare('UPDATE transactions SET is_transfer = 1 WHERE id = ?');
  
  let count = 0;
  for (const txn of transactions) {
    if (!txn.is_transfer) {
      stmt.run(txn.id);
      count++;
    }
  }
  return count;
}

/**
 * Apply all category rules to uncategorized transactions
 * Called after scraping to auto-categorize new transactions
 */
function applyCategoryRules() {
  const rules = db.prepare('SELECT * FROM category_rules').all();
  let applied = 0;
  
  for (const rule of rules) {
    const result = db.prepare(`
      UPDATE transactions 
      SET category_id = ? 
      WHERE description = ? AND (category_id IS NULL OR category_id = '')
    `).run(rule.category_id, rule.description_pattern);
    applied += result.changes;
  }
  
  return applied;
}

/**
 * Get all category rules
 */
function getCategoryRules() {
  return db.prepare(`
    SELECT r.*, c.name as category_name, c.color as category_color
    FROM category_rules r
    JOIN categories c ON r.category_id = c.id
    ORDER BY r.description_pattern
  `).all();
}

module.exports = {
  upsertTransactions,
  getTransactionsByIsraeliMonth,
  getMonthlySummary,
  getAvailableMonths,
  getTransactionCount,
  getCategories,
  createCategory,
  deleteCategory,
  setTransactionCategory,
  setTransactionTransfer,
  redetectTransfers,
  getYearToDateSummary,
  setTransactionInvestment,
  setTransactionOccasionalIncome,
  applyCategoryRules,
  getCategoryRules,
  excludeAllInMonth,
  setTransactionComment,
  getAllCategoryAverages,
  getSavingsGoal,
  setSavingsGoal,
  getDefaultSavingsGoal,
  getExpectedIncome,
  setExpectedIncome,
  getAverageIncome,
  getAverageRegularIncome,
  getOccasionalIncomeForMonth,
  calculateAvailableBudget,
};
