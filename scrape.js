/**
 * Bank Scraper - Fetches transactions and stores in SQLite
 */

require('dotenv').config();
const { createScraper, CompanyTypes } = require('israeli-bank-scrapers');
const db = require('./db');

// ===========================================
// CONFIGURATION
// ===========================================

const BANKS = [
  {
    name: 'Hapoalim',
    companyId: CompanyTypes.hapoalim,
    credentials: {
      userCode: process.env.HAPOALIM_USER,
      password: process.env.HAPOALIM_PASS,
    },
    enabled: !!(process.env.HAPOALIM_USER && process.env.HAPOALIM_PASS),
  },
  {
    name: 'VisaCal',
    companyId: CompanyTypes.visaCal,
    credentials: {
      username: process.env.CAL_USER,
      password: process.env.CAL_PASS,
    },
    enabled: !!(process.env.CAL_USER && process.env.CAL_PASS),
  },
  // Isracard - disabled due to anti-bot blocking (status 429)
  // Uncomment when israeli-bank-scrapers fixes the issue
  // {
  //   name: 'Isracard',
  //   companyId: CompanyTypes.isracard,
  //   credentials: {
  //     id: process.env.ISRACARD_ID,
  //     card6Digits: process.env.ISRACARD_CARD6,
  //     password: process.env.ISRACARD_PASS,
  //   },
  //   enabled: !!(process.env.ISRACARD_ID && process.env.ISRACARD_CARD6 && process.env.ISRACARD_PASS),
  // },
];

// ===========================================
// SCRAPING
// ===========================================

async function scrapeBank(bank) {
  console.log(`\n🏦 Scraping: ${bank.name}`);

  if (!bank.enabled) {
    console.log(`⚠️  Skipping ${bank.name}: No credentials configured`);
    return 0;
  }

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2); // Last 2 years (maximum history)

  try {
    const scraper = createScraper({
      companyId: bank.companyId,
      showBrowser: true,
      startDate,
      combineInstallments: false,
      timeout: 300000,
    });

    console.log(`📡 Connecting to ${bank.name}...`);
    const result = await scraper.scrape(bank.credentials);

    if (!result.success) {
      console.error(`❌ Scrape failed: ${result.errorType} - ${result.errorMessage}`);
      return 0;
    }

    console.log(`✅ Connected to ${bank.name}`);

    // Process all accounts
    let totalTransactions = 0;

    for (const account of result.accounts) {
      console.log(`   📋 Account ${account.accountNumber}: ${account.txns.length} transactions`);

      // Map to our format
      const transactions = account.txns.map((txn, index) => {
        // Fix timezone issue: extract local date parts instead of using UTC
        const date = new Date(txn.date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        // Create a STABLE unique ID based on date + amount + description
        // Don't use bank identifier as it can change between scrapes
        const descClean = (txn.description || '').trim().substring(0, 30);
        const stableId = `${bank.name}-${dateStr}-${txn.chargedAmount}-${descClean}`;
        
        return {
          id: stableId,
          date: dateStr,
          amount: Math.round(txn.chargedAmount * 100), // Convert to agorot
          description: txn.description || '',
          memo: txn.memo || '',
        };
      });

      // Save to database
      const count = db.upsertTransactions(transactions, bank.name);
      totalTransactions += count;
    }

    console.log(`💾 Saved ${totalTransactions} transactions from ${bank.name}`);
    return totalTransactions;

  } catch (error) {
    console.error(`❌ Error scraping ${bank.name}:`, error.message);
    return 0;
  }
}

// ===========================================
// MAIN
// ===========================================

async function main() {
  console.log('🔄 Israeli Bank Scraper');
  console.log('═══════════════════════════════════════════════════\n');

  let totalSaved = 0;

  for (const bank of BANKS) {
    const count = await scrapeBank(bank);
    totalSaved += count;
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`✨ Done! Total transactions saved: ${totalSaved}`);
  console.log(`📊 Database now has: ${db.getTransactionCount()} transactions`);
  
  // Apply category rules to new transactions
  const rulesApplied = db.applyCategoryRules();
  if (rulesApplied > 0) {
    console.log(`🏷️  Auto-categorized ${rulesApplied} transactions`);
  }
  
  console.log('\nRun "npm start" to view your dashboard!\n');
}

main();
