/**
 * Finance Dashboard - Frontend App
 */

const API_BASE = '';

// Hebrew month names
const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

// State
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let availableMonths = [];
let categories = [];
let currentSummary = null;
let selectedColor = '#6366f1';

// ===========================================
// API Functions
// ===========================================

async function fetchMonths() {
  try {
    const res = await fetch(`${API_BASE}/api/months`);
    const data = await res.json();
    availableMonths = data.months;
  } catch (error) {
    console.error('Failed to fetch months:', error);
  }
}

async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE}/api/categories`);
    const data = await res.json();
    categories = data.categories;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
  }
}

async function fetchSummary(year, month) {
  try {
    const res = await fetch(`${API_BASE}/api/summary/${year}/${month}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch summary:', error);
    return null;
  }
}

async function fetchYTD(year) {
  try {
    const res = await fetch(`${API_BASE}/api/ytd/${year}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch YTD:', error);
    return null;
  }
}

async function fetchCategoryAverages(year, month) {
  try {
    const res = await fetch(`${API_BASE}/api/category-averages/${year}/${month}`);
    const data = await res.json();
    return data.averages;
  } catch (error) {
    console.error('Failed to fetch category averages:', error);
    return {};
  }
}

async function fetchSavingsGoal() {
  try {
    const res = await fetch(`${API_BASE}/api/savings-goal`);
    const data = await res.json();
    return data.goal || 0;
  } catch (error) {
    console.error('Failed to fetch savings goal:', error);
    return 0;
  }
}

async function fetchAvailableBudget(year, month) {
  try {
    const res = await fetch(`${API_BASE}/api/available-budget/${year}/${month}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch available budget:', error);
    return null;
  }
}

async function apiCreateCategory(name, color) {
  const res = await fetch(`${API_BASE}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color }),
  });
  return res.json();
}

async function apiSetTransactionCategory(txnId, categoryId) {
  await fetch(`${API_BASE}/api/transactions/category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId: txnId, categoryId }),
  });
}

async function apiToggleTransfer(txnId, isTransfer) {
  await fetch(`${API_BASE}/api/transactions/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId: txnId, isTransfer }),
  });
}

async function apiToggleInvestment(txnId, isInvestment) {
  await fetch(`${API_BASE}/api/transactions/investment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId: txnId, isInvestment }),
  });
}

async function apiSetComment(txnId, comment) {
  await fetch(`${API_BASE}/api/transactions/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId: txnId, comment }),
  });
}

async function apiToggleOccasionalIncome(txnId, isOccasional) {
  await fetch(`${API_BASE}/api/transactions/occasional-income`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId: txnId, isOccasional }),
  });
}

// ===========================================
// Formatting
// ===========================================

function formatCurrency(agorot) {
  const shekels = agorot / 100;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(shekels);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

// ===========================================
// UI Updates
// ===========================================

function updateMonthDisplay() {
  document.getElementById('monthName').textContent = MONTH_NAMES[currentMonth - 1];
  document.getElementById('monthYear').textContent = currentYear;
}

async function updateSavingsCard() {
  const budget = await fetchAvailableBudget(currentYear, currentMonth);
  if (!budget) return;
  
  const expectedIncomeEl = document.getElementById('expectedIncomeAmount');
  const goalEl = document.getElementById('savingsGoalAmount');
  const breakdownEl = document.getElementById('budgetBreakdown');
  const variableEl = document.getElementById('variableBudget');
  
  // Show expected income (with source indicator)
  let incomeSource = '';
  if (budget.actualIncome >= budget.expectedIncome) {
    incomeSource = ' (בפועל)';
  } else if (budget.userExpectedIncome >= budget.averageIncome) {
    incomeSource = ' (ידני)';
  } else {
    incomeSource = ' (ממוצע)';
  }
  expectedIncomeEl.textContent = formatCurrency(budget.expectedIncome);
  goalEl.textContent = formatCurrency(budget.savingsGoal);
  
  // Show breakdown with regular vs occasional income
  const hasOccasional = budget.actualOccasionalIncome > 0;
  
  // Determine regular income source
  let regularIncomeSource = '';
  if (budget.actualRegularIncome >= budget.expectedRegularIncome) {
    regularIncomeSource = ' (בפועל)';
  } else if (budget.userExpectedIncome >= budget.averageIncome) {
    regularIncomeSource = ' (ידני)';
  } else {
    regularIncomeSource = ' (ממוצע)';
  }
  
  // Income breakdown HTML
  let incomeBreakdownHtml = '';
  if (hasOccasional) {
    incomeBreakdownHtml = `
      <div class="breakdown-row sub">
        <span>↳ הכנסה קבועה (משכורת)${regularIncomeSource}</span>
        <span>${formatCurrency(budget.expectedRegularIncome)}</span>
      </div>
      <div class="breakdown-row sub">
        <span>↳ הכנסה חד פעמית 🎁</span>
        <span>${formatCurrency(budget.actualOccasionalIncome)}</span>
      </div>
    `;
  }
  
  breakdownEl.innerHTML = `
    <div class="breakdown-row">
      <span>הכנסה צפויה כוללת</span>
      <span>${formatCurrency(budget.expectedIncome)}</span>
    </div>
    ${incomeBreakdownHtml}
    <div class="breakdown-row">
      <span>יעד חיסכון</span>
      <span class="minus">-${formatCurrency(budget.savingsGoal)}</span>
    </div>
    <div class="breakdown-row">
      <span>הוצאות קבועות (ממוצע/בפועל)</span>
      <span class="minus">-${formatCurrency(budget.fixedExpenses)}</span>
    </div>
    <div class="breakdown-row total">
      <span>תקציב כולל להוצאות משתנות החודש</span>
      <span>${formatCurrency(budget.availableForVariable)}</span>
    </div>
  `;
  
  // Show variable budget status
  const amountClass = budget.remainingForVariable >= 0 ? 'positive' : 'negative';
  
  // Warning if budget is negative from the start
  let warningHtml = '';
  if (budget.availableForVariable < 0) {
    const shortfall = Math.abs(budget.availableForVariable);
    warningHtml = `
      <div class="budget-warning">
        ⚠️ יעד החיסכון + הוצאות קבועות גבוהים מההכנסה ב-${formatCurrency(shortfall)}
        <br><small>שקול להוריד את יעד החיסכון או לבדוק את הקטגוריות</small>
      </div>
    `;
  }
  
  variableEl.innerHTML = `
    ${warningHtml}
    <div class="variable-label">עוד אפשר להוציא על הוצאות משתנות:</div>
    <div class="variable-amount ${amountClass}">${formatCurrency(budget.remainingForVariable)}</div>
    <div class="variable-spent">הוצאת עד עכשיו: ${formatCurrency(budget.variableActual)}</div>
  `;
}

async function editSavingsGoal() {
  // Fetch current month's goal
  let currentGoal = 0;
  let defaultGoal = 0;
  try {
    const res = await fetch(`${API_BASE}/api/savings-goal/${currentYear}/${currentMonth}`);
    const data = await res.json();
    currentGoal = data.goal || 0;
    defaultGoal = data.defaultGoal || 0;
  } catch (e) {}
  
  const currentInShekels = currentGoal / 100;
  const defaultInShekels = defaultGoal / 100;
  
  const monthName = MONTH_NAMES[currentMonth - 1];
  const input = prompt(
    `הגדר יעד חיסכון ל-${monthName} ${currentYear} (בשקלים):\n\nברירת מחדל: ₪${defaultInShekels.toLocaleString()}`,
    currentInShekels || defaultInShekels || ''
  );
  if (input === null) return;
  
  const newGoal = parseFloat(input);
  if (isNaN(newGoal) || newGoal < 0) {
    alert('נא להזין מספר חיובי');
    return;
  }
  
  try {
    await fetch(`${API_BASE}/api/savings-goal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        goal: Math.round(newGoal * 100),
        year: currentYear,
        month: currentMonth
      }),
    });
    await updateSavingsCard();
  } catch (error) {
    console.error('Failed to set savings goal:', error);
  }
}

async function editExpectedIncome() {
  const budget = await fetchAvailableBudget(currentYear, currentMonth);
  const currentInShekels = budget ? budget.userExpectedIncome / 100 : 0;
  const averageInShekels = budget ? budget.averageIncome / 100 : 0;
  
  const input = prompt(
    `הגדר הכנסה צפויה חודשית (בשקלים):\n\nממוצע 3 חודשים אחרונים: ₪${averageInShekels.toLocaleString()}`,
    currentInShekels || averageInShekels || ''
  );
  if (input === null) return;
  
  const newIncome = parseFloat(input);
  if (isNaN(newIncome) || newIncome < 0) {
    alert('נא להזין מספר חיובי');
    return;
  }
  
  try {
    await fetch(`${API_BASE}/api/expected-income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ income: Math.round(newIncome * 100) }),
    });
    await updateSavingsCard();
  } catch (error) {
    console.error('Failed to set expected income:', error);
  }
}

function updateYTDCard(ytd) {
  if (!ytd) return;
  
  document.getElementById('ytdYear').textContent = ytd.year;
  document.getElementById('ytdIncome').textContent = formatCurrency(ytd.income);
  document.getElementById('ytdExpenses').textContent = formatCurrency(ytd.expenses);
  document.getElementById('ytdBalance').textContent = formatCurrency(ytd.balance);
  document.getElementById('ytdInvestment').textContent = formatCurrency(ytd.investmentTotal || 0);
  
  const balanceItem = document.querySelector('.ytd-item.balance');
  balanceItem.classList.remove('positive', 'negative');
  balanceItem.classList.add(ytd.balance >= 0 ? 'positive' : 'negative');
  
  // Show/hide investment item
  const investmentItem = document.getElementById('ytdInvestmentItem');
  if (investmentItem) {
    investmentItem.style.display = (ytd.investmentTotal && ytd.investmentTotal > 0) ? 'block' : 'none';
  }
}

function updateBalanceCard(summary) {
  const incomeEl = document.getElementById('income');
  const expensesEl = document.getElementById('expenses');
  const balanceEl = document.getElementById('balance');
  const balanceRow = document.getElementById('balanceRow');
  const indicator = document.getElementById('indicator');
  const indicatorText = document.getElementById('indicatorText');
  const txnCount = document.getElementById('txnCount');

  incomeEl.textContent = formatCurrency(summary.income);
  expensesEl.textContent = formatCurrency(summary.expenses);
  balanceEl.textContent = formatCurrency(summary.balance);
  txnCount.textContent = summary.transactionCount;

  balanceRow.classList.remove('positive', 'negative');
  indicator.classList.remove('positive', 'negative');

  if (summary.balance >= 0) {
    balanceRow.classList.add('positive');
    indicator.classList.add('positive');
    indicatorText.textContent = '✓ יתרה חיובית - מצוין!';
  } else {
    balanceRow.classList.add('negative');
    indicator.classList.add('negative');
    indicatorText.textContent = '⚠ יתרה שלילית - חרגת מהתקציב';
  }
}

function updateExcludedSection(summary) {
  const section = document.getElementById('excludedSection');
  const summaryEl = document.getElementById('excludedSummary');
  const listEl = document.getElementById('excludedList');

  if (!summary.transfers || summary.transfers.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  
  // Calculate total excluded
  const totalExcluded = summary.transfers.reduce((sum, t) => sum + t.amount, 0);
  summaryEl.textContent = `${summary.transfers.length} תנועות (${formatCurrency(totalExcluded)})`;

  // Store for reference
  window.currentExcluded = summary.transfers;

  listEl.innerHTML = summary.transfers.map((txn, index) => `
    <div class="excluded-item">
      <div class="excluded-info">
        <span class="desc">${txn.description || 'תנועה'}</span>
        ${txn.memo ? `<span class="memo">${txn.memo}</span>` : ''}
        <span class="date">${formatDate(txn.date)}</span>
      </div>
      <div class="excluded-actions">
        <span class="amount">${formatCurrency(txn.amount)}</span>
        <button class="undo-btn" onclick="restoreToBalanceByIndex(${index})">
          ↩ החזר ליתרה
        </button>
      </div>
    </div>
  `).join('');
}

async function restoreToBalance(txnId) {
  try {
    await apiToggleTransfer(txnId, false);
    await loadMonth(currentYear, currentMonth);
  } catch (error) {
    console.error('Failed to restore transaction:', error);
  }
}

async function restoreToBalanceByIndex(index) {
  const txn = window.currentExcluded[index];
  if (!txn) return;
  await restoreToBalance(txn.id);
}

function updateInvestmentSection(summary) {
  const section = document.getElementById('investmentSection');
  const summaryEl = document.getElementById('investmentSummary');
  const listEl = document.getElementById('investmentList');

  if (!summary.investments || summary.investments.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  
  // Calculate total investments
  const totalInvestment = summary.investments.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  summaryEl.textContent = `${summary.investments.length} תנועות (${formatCurrency(totalInvestment)})`;

  // Store for reference
  window.currentInvestments = summary.investments;

  listEl.innerHTML = summary.investments.map((txn, index) => `
    <div class="investment-item">
      <div class="investment-info">
        <span class="desc">${txn.description || 'תנועה'}</span>
        ${txn.memo ? `<span class="memo">${txn.memo}</span>` : ''}
        <span class="date">${formatDate(txn.date)}</span>
      </div>
      <div class="investment-actions">
        <span class="amount">${formatCurrency(Math.abs(txn.amount))}</span>
        <button class="uninvest-btn" onclick="restoreFromInvestmentByIndex(${index})">
          ↩ הסר מהשקעות
        </button>
      </div>
    </div>
  `).join('');
}

async function restoreFromInvestment(txnId) {
  try {
    await apiToggleInvestment(txnId, false);
    await loadMonth(currentYear, currentMonth);
  } catch (error) {
    console.error('Failed to restore from investment:', error);
  }
}

async function restoreFromInvestmentByIndex(index) {
  const txn = window.currentInvestments[index];
  if (!txn) return;
  await restoreFromInvestment(txn.id);
}

async function toggleInvestment(txnId) {
  try {
    await apiToggleInvestment(txnId, true);
    await loadMonth(currentYear, currentMonth);
  } catch (error) {
    console.error('Failed to mark as investment:', error);
  }
}

async function toggleInvestmentByIndex(index) {
  const txn = window.currentTransactions[index];
  if (!txn) return;
  await toggleInvestment(txn.id);
}

async function toggleOccasionalIncome(txnId, currentState) {
  try {
    await apiToggleOccasionalIncome(txnId, !currentState);
    await loadMonth(currentYear, currentMonth);
  } catch (error) {
    console.error('Failed to toggle occasional income:', error);
  }
}

async function toggleOccasionalByIndex(index) {
  const txn = window.currentTransactions[index];
  if (!txn) return;
  await toggleOccasionalIncome(txn.id, txn.is_occasional_income);
}

async function updateCategoriesSummary(summary) {
  const container = document.getElementById('categoriesSummary');
  
  if (!summary.byCategory) {
    container.innerHTML = '';
    return;
  }

  // Fetch category averages
  const averages = await fetchCategoryAverages(currentYear, currentMonth);

  const categoryMap = {};
  for (const cat of categories) {
    categoryMap[cat.id] = cat;
  }

  const rows = [];
  
  // Add uncategorized first
  if (summary.byCategory.uncategorized) {
    const data = summary.byCategory.uncategorized;
    const net = data.income - data.expenses;
    rows.push({
      id: 'uncategorized',
      name: 'ללא קטגוריה',
      color: '#6b7280',
      net,
      income: data.income,
      expenses: data.expenses,
      count: data.transactions.length,
      transactions: data.transactions,
      average: averages['uncategorized'] || 0,
    });
  }

  // Add other categories
  for (const [catId, data] of Object.entries(summary.byCategory)) {
    if (catId === 'uncategorized') continue;
    const cat = categoryMap[catId];
    if (!cat) continue;
    const net = data.income - data.expenses;
    rows.push({
      id: catId,
      name: cat.name,
      color: cat.color,
      net,
      income: data.income,
      expenses: data.expenses,
      count: data.transactions.length,
      transactions: data.transactions,
      average: averages[catId] || 0,
    });
  }

  // Sort by absolute value (biggest impact first)
  rows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  // Store for click handler
  window.categoryData = rows;

  // Categories to exclude from average calculation
  const excludeFromAverage = ['הוצאות משתנות', 'ללא קטגוריה'];
  
  container.innerHTML = rows.map((row, index) => {
    // Progress bar for expenses (only show if there's an average and not excluded)
    let progressHtml = '';
    const showAverage = row.average > 0 && row.expenses > 0 && !excludeFromAverage.includes(row.name);
    
    if (showAverage) {
      const percent = Math.min((row.expenses / row.average) * 100, 150);
      const fillClass = percent > 100 ? 'over' : percent > 80 ? 'warning' : 'under';
      progressHtml = `
        <div class="category-progress-inline">
          <div class="progress-info">
            <span class="progress-current">${formatCurrency(row.expenses)}</span>
            <span class="progress-separator">/</span>
            <span class="progress-average">${formatCurrency(row.average)}</span>
            <span class="progress-percent ${fillClass}">(${percent.toFixed(0)}%)</span>
          </div>
          <div class="category-progress-bar">
            <div class="category-progress-fill ${fillClass}" style="width: ${Math.min(percent, 100)}%"></div>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="category-card" onclick="showCategoryDetails(${index})">
        <div class="category-row clickable">
          <div class="category-info">
            <span class="category-color" style="background: ${row.color}"></span>
            <span class="category-name">${row.name}</span>
            <span class="category-count">(${row.count})</span>
          </div>
          <div class="category-right">
            <span class="category-amount ${row.net >= 0 ? 'positive' : 'negative'}">
              ${formatCurrency(row.net)}
            </span>
            <span class="category-arrow">←</span>
          </div>
        </div>
        ${progressHtml}
      </div>
    `;
  }).join('');
}

function showCategoryDetails(index) {
  const data = window.categoryData[index];
  if (!data) return;

  const modal = document.getElementById('categoryDetailsModal');
  const title = document.getElementById('categoryDetailsTitle');
  const summaryEl = document.getElementById('categoryDetailsSummary');
  const listEl = document.getElementById('categoryDetailsList');

  title.innerHTML = `<span class="category-color" style="background: ${data.color}; display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-left: 8px;"></span>${data.name}`;
  
  summaryEl.innerHTML = `
    <div class="detail-summary-row">
      <span>הכנסות</span>
      <span class="positive">${formatCurrency(data.income)}</span>
    </div>
    <div class="detail-summary-row">
      <span>הוצאות</span>
      <span class="negative">${formatCurrency(data.expenses)}</span>
    </div>
    <div class="detail-summary-row total">
      <span>סה"כ</span>
      <span class="${data.net >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.net)}</span>
    </div>
  `;

  // Sort transactions by date
  const sorted = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date));

  listEl.innerHTML = sorted.map(txn => {
    const amountClass = txn.amount >= 0 ? 'positive' : 'negative';
    const commentHtml = txn.user_comment ? `<span class="detail-txn-comment">💬 ${txn.user_comment}</span>` : '';
    return `
      <div class="detail-transaction">
        <div class="detail-txn-info">
          <span class="detail-txn-desc">${txn.description || 'תנועה'}</span>
          ${txn.memo ? `<span class="detail-txn-memo">${txn.memo}</span>` : ''}
          ${commentHtml}
          <span class="detail-txn-date">${formatDate(txn.date)}</span>
        </div>
        <span class="detail-txn-amount ${amountClass}">${formatCurrency(txn.amount)}</span>
      </div>
    `;
  }).join('');

  modal.classList.add('active');
}

function hideCategoryDetailsModal() {
  document.getElementById('categoryDetailsModal').classList.remove('active');
}

function updateTransactionList(transactions) {
  const listEl = document.getElementById('transactionList');
  
  if (!transactions || transactions.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <p>אין תנועות בחודש זה</p>
      </div>
    `;
    return;
  }

  const categoryMap = {};
  for (const cat of categories) {
    categoryMap[cat.id] = cat;
  }

  const sorted = [...transactions].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return Math.abs(b.amount) - Math.abs(a.amount);
  });

  // Store transactions for reference by index
  window.currentTransactions = sorted;

  listEl.innerHTML = sorted.map((txn, index) => {
    const amountClass = txn.amount >= 0 ? 'positive' : 'negative';
    const amountPrefix = txn.amount >= 0 ? '+' : '';
    const isIncome = txn.amount > 0;
    
    // Build category select options
    const categoryOptions = categories.map(c => 
      `<option value="${c.id}" ${txn.category_id === c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');
    
    // Show memo if exists (contains the details like לטובת, עבור)
    const memoHtml = txn.memo ? `<div class="transaction-memo">${txn.memo}</div>` : '';
    
    // Show user comment if exists
    const commentHtml = txn.user_comment 
      ? `<div class="transaction-comment">
           <span class="comment-text">💬 ${txn.user_comment}</span>
           <button class="edit-comment-btn" onclick="editCommentByIndex(${index})" title="ערוך הערה">✏️</button>
         </div>`
      : `<button class="add-comment-btn" onclick="editCommentByIndex(${index})">+ הוסף הערה</button>`;
    
    // Occasional income button (only for income transactions)
    const occasionalBtnClass = txn.is_occasional_income ? 'active' : '';
    const occasionalBtn = isIncome 
      ? `<button class="occasional-btn ${occasionalBtnClass}" onclick="toggleOccasionalByIndex(${index})" title="הכנסה לא קבועה (מתנה, החזר מס...)">
          🎁
        </button>`
      : '';
    
    return `
      <div class="transaction-item ${txn.is_occasional_income ? 'occasional' : ''}" data-index="${index}">
        <div class="transaction-info">
          <div class="transaction-header">
            <span class="transaction-desc">${txn.description || 'תנועה'}</span>
            ${occasionalBtn}
            <button class="invest-btn" onclick="toggleInvestmentByIndex(${index})" title="סמן כהשקעה">
              📈
            </button>
            <button class="exclude-btn" onclick="toggleExcludeByIndex(${index})" title="הוצא מחישוב היתרה">
              ⊘
            </button>
          </div>
          ${memoHtml}
          ${commentHtml}
          <div class="transaction-meta">
            <span class="transaction-date">${formatDate(txn.date)}</span>
            <select class="category-select" onchange="setCategoryByIndex(${index}, this.value)">
              <option value="">קטגוריה...</option>
              ${categoryOptions}
            </select>
          </div>
        </div>
        <div class="transaction-amount ${amountClass}">
          ${amountPrefix}${formatCurrency(txn.amount)}
        </div>
      </div>
    `;
  }).join('');
}

async function loadMonth(year, month) {
  document.body.classList.add('loading');
  
  updateMonthDisplay();
  
  // Fetch monthly summary and YTD in parallel
  const [summary, ytd] = await Promise.all([
    fetchSummary(year, month),
    fetchYTD(year)
  ]);
  
  currentSummary = summary;
  
  // Update YTD card
  updateYTDCard(ytd);
  
  // Update savings card
  await updateSavingsCard();
  
  if (summary) {
    updateBalanceCard(summary);
    await updateCategoriesSummary(summary);
    updateTransactionList(summary.transactions);
    updateInvestmentSection(summary);
    updateExcludedSection(summary);
  } else {
    updateBalanceCard({ income: 0, expenses: 0, balance: 0, transactionCount: 0 });
    await updateCategoriesSummary({});
    updateTransactionList([]);
    updateInvestmentSection({ investments: [] });
    updateExcludedSection({ transfers: [] });
  }
  
  document.body.classList.remove('loading');
}

// ===========================================
// Category Management
// ===========================================

function showCategoryModal() {
  document.getElementById('categoryModal').classList.add('active');
  document.getElementById('categoryName').focus();
}

function hideCategoryModal() {
  document.getElementById('categoryModal').classList.remove('active');
  document.getElementById('categoryName').value = '';
}

async function showManageCategoriesModal() {
  const modal = document.getElementById('manageCategoriesModal');
  const listEl = document.getElementById('manageCategoriesList');
  
  // Count transactions per category
  const categoryCounts = {};
  if (currentSummary && currentSummary.byCategory) {
    for (const [catId, data] of Object.entries(currentSummary.byCategory)) {
      categoryCounts[catId] = data.transactions.length;
    }
  }
  
  if (categories.length === 0) {
    listEl.innerHTML = '<p style="text-align: center; color: var(--text-muted);">אין קטגוריות עדיין</p>';
  } else {
    listEl.innerHTML = categories.map(cat => `
      <div class="manage-category-item">
        <div class="manage-category-info">
          <span class="manage-category-color" style="background: ${cat.color}"></span>
          <span class="manage-category-name">${cat.name}</span>
        </div>
        <button class="delete-category-btn" onclick="deleteCategory('${cat.id}')">
          🗑️ מחק
        </button>
      </div>
    `).join('');
  }
  
  modal.classList.add('active');
}

function hideManageCategoriesModal() {
  document.getElementById('manageCategoriesModal').classList.remove('active');
}

async function deleteCategory(categoryId) {
  if (!confirm('האם למחוק את הקטגוריה? כל התנועות המשויכות יחזרו להיות ללא קטגוריה.')) {
    return;
  }
  
  try {
    await fetch(`${API_BASE}/api/categories/${categoryId}`, {
      method: 'DELETE',
    });
    await fetchCategories();
    hideManageCategoriesModal();
    loadMonth(currentYear, currentMonth);
  } catch (error) {
    console.error('Failed to delete category:', error);
  }
}

async function createCategory() {
  const name = document.getElementById('categoryName').value.trim();
  if (!name) return;

  try {
    await apiCreateCategory(name, selectedColor);
    await fetchCategories();
    hideCategoryModal();
    loadMonth(currentYear, currentMonth); // Refresh
  } catch (error) {
    console.error('Failed to create category:', error);
  }
}

async function setCategory(txnId, categoryId) {
  try {
    await apiSetTransactionCategory(txnId, categoryId || null);
    await loadMonth(currentYear, currentMonth);
  } catch (error) {
    console.error('Failed to set category:', error);
  }
}

async function setCategoryByIndex(index, categoryId) {
  const txn = window.currentTransactions[index];
  if (!txn) return;
  await setCategory(txn.id, categoryId);
}

async function toggleExclude(txnId) {
  try {
    await apiToggleTransfer(txnId, true);
    await loadMonth(currentYear, currentMonth);
  } catch (error) {
    console.error('Failed to exclude transaction:', error);
  }
}

async function toggleExcludeByIndex(index) {
  const txn = window.currentTransactions[index];
  if (!txn) return;
  await toggleExclude(txn.id);
}

async function editCommentByIndex(index) {
  const txn = window.currentTransactions[index];
  if (!txn) return;
  
  const currentComment = txn.user_comment || '';
  const newComment = prompt('הוסף הערה לתנועה:', currentComment);
  
  if (newComment === null) return; // User cancelled
  
  try {
    await apiSetComment(txn.id, newComment);
    await loadMonth(currentYear, currentMonth);
  } catch (error) {
    console.error('Failed to set comment:', error);
  }
}

async function excludeAllMonth() {
  const monthName = MONTH_NAMES[currentMonth - 1];
  if (!confirm(`האם להוציא את כל התנועות של ${monthName} ${currentYear} מחישוב היתרה?\n\nפעולה זו תעביר את כל התנועות ל"לא בחישוב היתרה" והן לא ייכללו בסיכום השנתי.`)) {
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/exclude-month`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: currentYear, month: currentMonth }),
    });
    const data = await res.json();
    alert(`${data.excluded} תנועות הועברו ל"לא בחישוב היתרה"`);
    await loadMonth(currentYear, currentMonth);
  } catch (error) {
    console.error('Failed to exclude month:', error);
  }
}

// ===========================================
// UI Helpers
// ===========================================

function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  section.classList.toggle('collapsed');
}

// Color picker
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('color-option')) {
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
    e.target.classList.add('selected');
    selectedColor = e.target.dataset.color;
  }
});

// ===========================================
// Navigation
// ===========================================

function goToPrevMonth() {
  currentMonth--;
  if (currentMonth < 1) {
    currentMonth = 12;
    currentYear--;
  }
  loadMonth(currentYear, currentMonth);
}

function goToNextMonth() {
  currentMonth++;
  if (currentMonth > 12) {
    currentMonth = 1;
    currentYear++;
  }
  loadMonth(currentYear, currentMonth);
}

// ===========================================
// Initialize
// ===========================================

async function init() {
  // Set up navigation
  document.getElementById('prevMonth').addEventListener('click', goToPrevMonth);
  document.getElementById('nextMonth').addEventListener('click', goToNextMonth);

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') goToPrevMonth();
    if (e.key === 'ArrowLeft') goToNextMonth();
    if (e.key === 'Escape') {
      hideCategoryModal();
      hideCategoryDetailsModal();
      hideManageCategoriesModal();
    }
  });

  // Load data
  await Promise.all([fetchMonths(), fetchCategories()]);
  
  // Default to previous month (Israeli style)
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  
  if (currentMonth === 0) {
    currentMonth = 12;
    currentYear--;
  }

  loadMonth(currentYear, currentMonth);
}

// Start the app
init();
