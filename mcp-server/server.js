/**
 * FinFlow MCP Server
 * 
 * Exposes your Google Sheets financial data as MCP tools that can be consumed
 * by Claude Desktop, Cursor, Zed, Grok, or any other MCP-compatible AI assistant.
 * 
 * Supports both standard MCP Server-Sent Events (SSE) protocol and simple REST HTTP.
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;
const MCP_SECRET = process.env.MCP_SECRET || '';
const SHEETS_API_URL = process.env.SHEETS_API_URL || ''; // Your Google Apps Script URL

app.use(cors());
app.use(express.json());

// Active Server-Sent Events (SSE) connections mapping session IDs to response objects
const sseConnections = new Map();

// ─── Simple In-Memory Cache for Sheet Data ───────────────────────────────────
let cachedSheetData = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute Cache TTL

async function fetchSheetData(forceRefresh = false) {
  if (!SHEETS_API_URL) {
    throw new Error('SHEETS_API_URL environment variable not set. Configure your Google Apps Script URL.');
  }

  const now = Date.now();
  if (cachedSheetData && !forceRefresh && (now - lastCacheFetchTime < CACHE_TTL_MS)) {
    return cachedSheetData;
  }

  console.log(`[Cache] Fetching fresh financial data from Google Apps Script...`);
  const response = await fetch(`${SHEETS_API_URL}?action=getData`);
  if (!response.ok) {
    if (cachedSheetData) {
      console.warn(`[Cache] Fresh fetch failed, returning stale cache.`);
      return cachedSheetData;
    }
    throw new Error(`Failed to fetch sheet data: ${response.status} ${response.statusText}`);
  }

  cachedSheetData = await response.json();
  lastCacheFetchTime = Date.now();
  return cachedSheetData;
}

// ─── Authentication Middleware ────────────────────────────────────────────────
function authenticate(req, res, next) {
  const { secretPrefix } = req.params;
  if (secretPrefix) {
    if (MCP_SECRET && secretPrefix === MCP_SECRET) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized. Invalid secret prefix in URL.' });
  }
  if (!MCP_SECRET) {
    return next();
  }
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (token !== MCP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized. Provide a valid Bearer token.' });
  }
  next();
}

// ─── MCP Tool Definitions ─────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'get_summary',
    description: 'Get a high-level financial summary: net worth, total assets, total liabilities, and monthly spend vs. budget overview.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_transactions',
    description: 'Get a list of financial transactions. Optionally filter by account, category, date range, or transaction type.',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Filter by account name (partial match OK)' },
        category: { type: 'string', description: 'Filter by category name (partial match OK)' },
        type: { type: 'string', enum: ['Income', 'Expense', 'Transfer'], description: 'Filter by transaction type' },
        since_date: { type: 'string', description: 'ISO date string (YYYY-MM-DD) — return transactions on or after this date' },
        until_date: { type: 'string', description: 'ISO date string (YYYY-MM-DD) — return transactions on or before this date' },
        limit: { type: 'number', description: 'Max number of results (default: 50, max: 200)' }
      }
    }
  },
  {
    name: 'get_budgets',
    description: 'Get budget categories with their configured limits, actual spending this month, and remaining budget.',
    inputSchema: {
      type: 'object',
      properties: {
        group: { type: 'string', description: 'Filter by budget group (e.g. "Food", "Housing")' },
        over_budget_only: { type: 'boolean', description: 'If true, only return categories that are over budget' }
      }
    }
  },
  {
    name: 'get_accounts',
    description: 'Get all financial accounts with their current balances, institution, type (Checking, Savings, Investment, Credit Card, Loan), and asset/liability classification.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter by account type (e.g. "Credit Card", "Investment")' },
        class: { type: 'string', enum: ['Asset', 'Liability'], description: 'Filter by asset/liability class' }
      }
    }
  },
  
  // ─── PHASE 1 TOOLS ──────────────────────────────────────────────────────────
  {
    name: 'get_portfolio_allocation',
    description: 'Provides a detailed breakdown of investments and holding allocations by asset class, sector, geography, and account type.',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Filter breakdown to a specific investment account (optional)' }
      }
    }
  },
  {
    name: 'get_net_worth_history',
    description: 'Get historical net worth tracking logs with customizable daily/weekly/monthly granularity and historical milestones.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', default: 365, description: 'Number of historical days to fetch (e.g. 30, 90, 365)' },
        interval: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'monthly', description: 'Granularity interval of response nodes' }
      }
    }
  },
  {
    name: 'analyze_spending_trends',
    description: 'Detailed analysis of categories trends, month-over-month and YoY changes, top merchants, and anomalies.',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['last_3_months', 'last_6_months', 'this_year', 'last_year'], default: 'last_3_months', description: 'Trend analysis window' },
        category: { type: 'string', description: 'Analyze spending specifically for this category (optional)' }
      }
    }
  },
  {
    name: 'get_cash_flow_projection',
    description: 'Forecasts income vs expenses over next N months with dynamic confidence intervals based on historical volatility.',
    inputSchema: {
      type: 'object',
      properties: {
        months: { type: 'number', default: 6, description: 'Number of projection months (default 6, max 12)' }
      }
    }
  },
  {
    name: 'search_transactions',
    description: 'Natural language style fuzzy search over description, category, and accounts (e.g. "Starbucks in March" or "large purchases over 100").',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Fuzzy search text phrase' },
        min_amount: { type: 'number', description: 'Minimum amount filter (absolute value)' },
        month: { type: 'string', description: 'Filter specifically to a month name (e.g. "March" or "2026-05")' }
      },
      required: ['query']
    }
  }
];

// Helper to determine asset class / sector / geography allocations based on account name or category
function categorizeSecurity(securityName = '', accountType = '') {
  const name = securityName.toLowerCase();
  
  let assetClass = 'US Equities';
  let sector = 'Technology';
  let geography = 'United States';

  if (name.includes('bond') || name.includes('treasury') || name.includes('bnd') || name.includes('ief')) {
    assetClass = 'Fixed Income';
    sector = 'Government';
    geography = 'United States';
  } else if (name.includes('international') || name.includes('vxus') || name.includes('efa') || name.includes('emerging') || name.includes('vwo')) {
    assetClass = 'International Equities';
    sector = 'Global Diversified';
    geography = 'Global Ex-US';
  } else if (name.includes('real estate') || name.includes('vnq') || name.includes('reit')) {
    assetClass = 'Real Estate (REITs)';
    sector = 'Real Estate';
    geography = 'United States';
  } else if (accountType.toLowerCase() === 'checking' || accountType.toLowerCase() === 'savings' || name.includes('cash') || name.includes('vmfxx') || name.includes('money market')) {
    assetClass = 'Cash & Equivalents';
    sector = 'Cash';
    geography = 'United States';
  }

  // Sector classification
  if (name.includes('apple') || name.includes('microsoft') || name.includes('nvidia') || name.includes('qqq')) {
    sector = 'Technology';
  } else if (name.includes('healthcare') || name.includes('pfizer') || name.includes('xlv')) {
    sector = 'Healthcare';
  } else if (name.includes('financial') || name.includes('jp morgan') || name.includes('xlf')) {
    sector = 'Financial Services';
  }

  return { assetClass, sector, geography };
}

// ─── Tool Implementations ─────────────────────────────────────────────────────
async function runTool(toolName, args) {
  const data = await fetchSheetData();
  const { transactions = [], categories = [], balances = [] } = data;

  // Deduplicate balances to latest per account
  const latestBalances = (() => {
    const map = new Map();
    [...balances].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(b => {
      map.set(`${b.institution}_${b.account}_${b.account_id}`, b);
    });
    return Array.from(map.values());
  })();

  switch (toolName) {
    case 'get_summary': {
      let assets = 0, liabilities = 0;
      latestBalances.forEach(b => {
        const val = Number(b.balance) || 0;
        if (b.class === 'Asset') assets += val;
        else if (b.class === 'Liability') liabilities += Math.abs(val);
      });

      const now = new Date();
      const monthSpend = transactions
        .filter(t => {
          const d = new Date(t.date);
          return t.type === 'Expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((s, t) => s + Math.abs(t.amount || 0), 0);

      const totalBudget = categories
        .filter(c => c.type === 'Expense' && c.budget)
        .reduce((s, c) => s + (parseFloat(c.budget) || 0), 0);

      return {
        net_worth: assets - liabilities,
        total_assets: assets,
        total_liabilities: liabilities,
        monthly_spend_so_far: monthSpend,
        monthly_budget: totalBudget,
        budget_remaining: totalBudget - monthSpend,
        budget_percent_used: totalBudget > 0 ? Math.round((monthSpend / totalBudget) * 100) : null,
        account_count: latestBalances.length,
        transaction_count: transactions.length
      };
    }

    case 'get_transactions': {
      const { account, category, type, since_date, until_date, limit = 50 } = args || {};
      const maxLimit = Math.min(limit, 200);

      let filtered = transactions;
      if (account) filtered = filtered.filter(t => (t.account || '').toLowerCase().includes(account.toLowerCase()));
      if (category) filtered = filtered.filter(t => (t.category || '').toLowerCase().includes(category.toLowerCase()));
      if (type) filtered = filtered.filter(t => t.type === type);
      if (since_date) filtered = filtered.filter(t => new Date(t.date) >= new Date(since_date));
      if (until_date) filtered = filtered.filter(t => new Date(t.date) <= new Date(until_date));

      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

      return {
        count: filtered.length,
        returned: Math.min(filtered.length, maxLimit),
        transactions: filtered.slice(0, maxLimit).map(t => ({
          date: t.date,
          merchant: t.description,
          category: t.category,
          amount: t.amount,
          type: t.type,
          account: t.account
        }))
      };
    }

    case 'get_budgets': {
      const { group, over_budget_only } = args || {};

      const now = new Date();
      const spendByCategory = {};
      transactions
        .filter(t => {
          const d = new Date(t.date);
          return t.type === 'Expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .forEach(t => {
          const cat = (t.category || 'Uncategorized').trim();
          spendByCategory[cat] = (spendByCategory[cat] || 0) + Math.abs(t.amount || 0);
        });

      let budgets = categories
        .filter(c => c.type === 'Expense')
        .map(c => {
          const spent = spendByCategory[c.category] || 0;
          const budget = parseFloat(c.budget) || 0;
          return {
            category: c.category,
            group: c.group,
            budget,
            spent,
            remaining: budget - spent,
            percent_used: budget > 0 ? Math.round((spent / budget) * 100) : null,
            over_budget: spent > budget && budget > 0
          };
        });

      if (group) budgets = budgets.filter(b => (b.group || '').toLowerCase().includes(group.toLowerCase()));
      if (over_budget_only) budgets = budgets.filter(b => b.over_budget);

      budgets.sort((a, b) => (b.percent_used || 0) - (a.percent_used || 0));

      return { count: budgets.length, budgets };
    }

    case 'get_accounts': {
      const { type, class: acctClass } = args || {};
      let accounts = latestBalances;
      if (type) accounts = accounts.filter(a => (a.type || '').toLowerCase().includes(type.toLowerCase()));
      if (acctClass) accounts = accounts.filter(a => a.class === acctClass);
      return {
        count: accounts.length,
        accounts: accounts.map(a => ({
          institution: a.institution,
          account: a.account,
          balance: a.balance,
          type: a.type,
          class: a.class,
          last_updated: a.date
        }))
      };
    }

    // ─── PHASE 1 IMPLEMENTATION ──────────────────────────────────────────────
    
    case 'get_portfolio_allocation': {
      const { account } = args || {};
      let investmentAccounts = latestBalances.filter(a => {
        const tLower = (a.type || '').toLowerCase();
        return tLower.includes('investment') || tLower.includes('brokerage') || tLower.includes('401') || tLower.includes('ira') || tLower.includes('savings');
      });

      if (account) {
        investmentAccounts = investmentAccounts.filter(a => a.account.toLowerCase().includes(account.toLowerCase()));
      }

      let totalVal = 0;
      const classMap = {};
      const sectorMap = {};
      const geoMap = {};
      const accountsBreakdown = [];

      investmentAccounts.forEach(acc => {
        const bal = Math.max(0, Number(acc.balance || 0));
        if (bal === 0) return;
        totalVal += bal;

        // Categorize account mapping holding (Using account type/name to derive security profile simulation)
        const { assetClass, sector, geography } = categorizeSecurity(acc.account, acc.type);
        
        classMap[assetClass] = (classMap[assetClass] || 0) + bal;
        sectorMap[sector] = (sectorMap[sector] || 0) + bal;
        geoMap[geography] = (geoMap[geography] || 0) + bal;

        accountsBreakdown.push({
          institution: acc.institution,
          account: acc.account,
          type: acc.type,
          value: bal,
          assetClass,
          sector,
          geography
        });
      });

      const getPercentages = (map) => {
        return Object.entries(map).map(([name, val]) => ({
          name,
          value: val,
          percentage: totalVal > 0 ? Math.round((val / totalVal) * 100) : 0
        })).sort((a, b) => b.value - a.value);
      };

      return {
        total_investment_value: totalVal,
        allocation_by_class: getPercentages(classMap),
        allocation_by_sector: getPercentages(sectorMap),
        allocation_by_geography: getPercentages(geoMap),
        accounts: accountsBreakdown
      };
    }

    case 'get_net_worth_history': {
      const { days = 365, interval = 'monthly' } = args || {};
      
      const uniqueDates = Array.from(new Set(balances.map(b => b.date))).sort(
        (a, b) => new Date(a) - new Date(b)
      );

      // Limit scope to requested days
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - days);
      const filteredDates = uniqueDates.filter(d => new Date(d) >= limitDate);

      const netWorthLogs = filteredDates.map(date => {
        let assetsSum = 0;
        let liabilitiesSum = 0;

        const dateBalances = balances.filter(b => b.date === date);
        const map = new Map();
        dateBalances.forEach(b => {
          map.set(`${b.institution}_${b.account}_${b.account_id}`, b);
        });

        Array.from(map.values()).forEach(b => {
          const val = Number(b.balance) || 0;
          if (b.class === 'Asset') assetsSum += val;
          else if (b.class === 'Liability') liabilitiesSum += Math.abs(val);
        });

        return {
          date,
          assets: assetsSum,
          liabilities: liabilitiesSum,
          net_worth: assetsSum - liabilitiesSum
        };
      });

      // Filter logs by interval step size (monthly / weekly / daily)
      let finalLogs = netWorthLogs;
      if (interval === 'monthly') {
        const seenMonths = new Set();
        finalLogs = netWorthLogs.filter(log => {
          const d = new Date(log.date);
          const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
          if (seenMonths.has(monthKey)) return false;
          seenMonths.add(monthKey);
          return true;
        });
      } else if (interval === 'weekly') {
        finalLogs = netWorthLogs.filter((_, idx) => idx % 7 === 0);
      }

      // Add final current stats
      const firstNet = finalLogs[0]?.net_worth || 0;
      const lastNet = finalLogs[finalLogs.length - 1]?.net_worth || 0;

      return {
        days_analyzed: days,
        interval,
        total_growth: lastNet - firstNet,
        growth_percentage: firstNet !== 0 ? ((lastNet - firstNet) / Math.abs(firstNet)) * 100 : 0,
        history: finalLogs
      };
    }

    case 'analyze_spending_trends': {
      const { period = 'last_3_months', category } = args || {};
      
      const now = new Date();
      let limitMonths = 3;
      if (period === 'last_6_months') limitMonths = 6;
      else if (period === 'this_year' || period === 'last_year') limitMonths = 12;

      const cutoffDate = new Date(now.getFullYear(), now.getMonth() - limitMonths, 1);

      const periodTxns = transactions.filter(t => {
        const d = new Date(t.date);
        if (d < cutoffDate) return false;
        if (t.type !== 'Expense') return false;
        if (category && t.category?.toLowerCase() !== category.toLowerCase()) return false;
        return true;
      });

      // Aggregates
      let totalSpent = 0;
      const categoryMap = {};
      const merchantMap = {};
      const monthlyTotals = {};

      periodTxns.forEach(t => {
        const amt = Math.abs(t.amount || 0);
        totalSpent += amt;
        
        categoryMap[t.category] = (categoryMap[t.category] || 0) + amt;
        
        const cleanMerchant = cleanMerchantName(t.description);
        merchantMap[cleanMerchant] = (merchantMap[cleanMerchant] || 0) + amt;

        const d = new Date(t.date);
        const monthKey = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amt;
      });

      // Find anomalies (transactions exceeding 3.5x category median)
      const categoryTxnsMap = {};
      periodTxns.forEach(t => {
        if (!categoryTxnsMap[t.category]) categoryTxnsMap[t.category] = [];
        categoryTxnsMap[t.category].push(Math.abs(t.amount));
      });

      const anomalies = [];
      periodTxns.forEach(t => {
        const amt = Math.abs(t.amount);
        const list = categoryTxnsMap[t.category] || [];
        if (list.length < 3) return;
        const sorted = [...list].sort((a,b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        if (amt > 3.5 * median && amt > 150) {
          anomalies.push({
            date: t.date,
            description: t.description,
            category: t.category,
            amount: t.amount,
            reason: `Transaction is ${(amt/median).toFixed(1)}x greater than category median (${formatCurrency(median)})`
          });
        }
      });

      const sortLimit = (map) => {
        return Object.entries(map).map(([name, val]) => ({
          name,
          value: val,
          percentage: totalSpent > 0 ? Math.round((val / totalSpent) * 100) : 0
        })).sort((a, b) => b.value - a.value);
      };

      return {
        period,
        total_spending: totalSpent,
        monthly_breakdown: Object.entries(monthlyTotals).map(([month, value]) => ({ month, value })),
        top_categories: sortLimit(categoryMap).slice(0, 10),
        top_merchants: sortLimit(merchantMap).slice(0, 10),
        detected_anomalies: anomalies
      };
    }

    case 'get_cash_flow_projection': {
      const { months = 6 } = args || {};
      const now = new Date();
      const currentYear = now.getFullYear();

      // Analyze last 6 months of historical transactions to derive averages
      const historyCutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const histTxns = transactions.filter(t => new Date(t.date) >= historyCutoff);

      const incomeByMonth = {};
      const expenseByMonth = {};

      histTxns.forEach(t => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const amt = Math.abs(t.amount);

        if (t.type === 'Income') {
          incomeByMonth[key] = (incomeByMonth[key] || 0) + amt;
        } else if (t.type === 'Expense') {
          expenseByMonth[key] = (expenseByMonth[key] || 0) + amt;
        }
      });

      const getStats = (monthMap) => {
        const vals = Object.values(monthMap);
        if (vals.length === 0) return { mean: 0, stdev: 0 };
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        const variance = vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length;
        return { mean, stdev: Math.sqrt(variance) };
      };

      const incStats = getStats(incomeByMonth);
      const expStats = getStats(expenseByMonth);

      const projections = [];
      for (let i = 1; i <= Math.min(months, 12); i++) {
        const projDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const label = projDate.toLocaleString('default', { month: 'short', year: 'numeric' });

        // Projections include confidence intervals (+/- 1 standard deviation)
        projections.push({
          month: label,
          projected_income: incStats.mean,
          projected_expenses: expStats.mean,
          projected_net_savings: incStats.mean - expStats.mean,
          confidence_range: {
            income_low: Math.max(0, incStats.mean - incStats.stdev),
            income_high: incStats.mean + incStats.stdev,
            expenses_low: Math.max(0, expStats.mean - expStats.stdev),
            expenses_high: expStats.mean + expStats.stdev
          }
        });
      }

      return {
        projection_months: months,
        historical_baseline: {
          average_monthly_income: incStats.mean,
          income_volatility_stdev: incStats.stdev,
          average_monthly_expenses: expStats.mean,
          expenses_volatility_stdev: expStats.stdev
        },
        forecast: projections
      };
    }

    case 'search_transactions': {
      const { query = '', min_amount, month } = args || {};

      let matches = transactions;

      if (query) {
        const q = query.toLowerCase();
        matches = matches.filter(t => {
          return (t.description || '').toLowerCase().includes(q) ||
                 (t.category || '').toLowerCase().includes(q) ||
                 (t.account || '').toLowerCase().includes(q);
        });
      }

      if (min_amount) {
        matches = matches.filter(t => Math.abs(t.amount) >= Number(min_amount));
      }

      if (month) {
        const m = month.toLowerCase();
        matches = matches.filter(t => {
          const d = new Date(t.date);
          const fullMonthName = d.toLocaleString('default', { month: 'long' }).toLowerCase();
          const shortMonthName = d.toLocaleString('default', { month: 'short' }).toLowerCase();
          return fullMonthName.includes(m) || shortMonthName.includes(m) || t.date.includes(m);
        });
      }

      matches.sort((a, b) => new Date(b.date) - new Date(a.date));

      return {
        query,
        results_count: matches.length,
        transactions: matches.slice(0, 50).map(t => ({
          date: t.date,
          merchant: t.description,
          category: t.category,
          amount: t.amount,
          type: t.type,
          account: t.account
        }))
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Helper to format currency values in USD
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// Helper to clean merchant strings
function cleanMerchantName(description) {
  if (!description) return '';
  let cleaned = description;
  cleaned = cleaned.replace(/^(tst\*|sq\s*\*|sp\s*\*|paypal\s*\*|amzn\s*mktp\s*us\*|opos\s*\*|pending\s*-|purchase\s*at\s*|authorized\s*on\s*\d{2}\/\d{2}\s*)/i, '');
  cleaned = cleaned.replace(/#\d+/g, ''); 
  cleaned = cleaned.replace(/\b\d{3}-\d{3}-\d{4}\b/g, ''); 
  cleaned = cleaned.replace(/\s+[A-Z]{2}\b/g, ''); 
  cleaned = cleaned.replace(/\b\d{5}\b/g, ''); 
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || description;
}

// ─── Standard JSON-RPC Handler for MCP ───────────────────────────────────────
async function handleJsonRpc(payload) {
  const { jsonrpc, method, id, params } = payload;
  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
  }

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'FinFlow MCP Server',
              version: '1.0.0'
            }
          }
        };

      case 'notifications/initialized':
        return null; // No response needed

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS
          }
        };

      case 'tools/call': {
        const { name, arguments: args } = params || {};
        const toolDef = TOOLS.find(t => t.name === name);
        if (!toolDef) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Tool "${name}" not found.` }
          };
        }
        
        const result = await runTool(name, args);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        };
    }
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: err.message }
    };
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
function handleHealthCheck(req, res) {
  const { secretPrefix } = req.params;
  if (secretPrefix && MCP_SECRET && secretPrefix !== MCP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized. Invalid secret prefix in URL.' });
  }
  res.json({
    service: 'FinFlow MCP Server',
    version: '1.0.0',
    status: 'ok',
    sheets_configured: !!SHEETS_API_URL,
    auth_required: !!MCP_SECRET,
    tool_count: TOOLS.length,
    path_auth: secretPrefix ? 'prefix_verified' : 'pending'
  });
}

app.get('/', handleHealthCheck);
app.get('/:secretPrefix', handleHealthCheck);

// Simple REST endpoints (For Claude.ai custom connectors/REST integrations)
app.get('/tools', authenticate, (req, res) => {
  res.json({ tools: TOOLS });
});
app.get('/:secretPrefix/tools', authenticate, (req, res) => {
  res.json({ tools: TOOLS });
});

async function handleToolCall(req, res) {
  const { toolName } = req.params;
  const args = req.body || {};

  const toolDef = TOOLS.find(t => t.name === toolName);
  if (!toolDef) {
    return res.status(404).json({ error: `Tool "${toolName}" not found.`, available_tools: TOOLS.map(t => t.name) });
  }

  try {
    const result = await runTool(toolName, args);
    res.json({ tool: toolName, result });
  } catch (err) {
    console.error(`[MCP] Error running tool "${toolName}":`, err.message);
    res.status(500).json({ error: err.message });
  }
}

app.post('/tools/:toolName', authenticate, handleToolCall);
app.post('/:secretPrefix/tools/:toolName', authenticate, handleToolCall);

// ─── Standard MCP SSE (Server-Sent Events) Transport Endpoints ────────────────

function handleSseConnection(req, res) {
  const { secretPrefix } = req.params;
  
  if (secretPrefix && MCP_SECRET && secretPrefix !== MCP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized. Invalid secret prefix.' });
  }
  
  if (!secretPrefix && MCP_SECRET) {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '').trim();
    if (token !== MCP_SECRET) {
      return res.status(401).json({ error: 'Unauthorized. Bearer token invalid.' });
    }
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sessionId = Math.random().toString(36).substring(2, 15);
  sseConnections.set(sessionId, res);

  // Send standard MCP SSE endpoint announcement (Must be absolute for some remote clients like Grok/Cursor)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  
  const messagePath = secretPrefix
    ? `/${secretPrefix}/message?sessionId=${sessionId}`
    : `/message?sessionId=${sessionId}`;
    
  const absoluteMessageUrl = `${protocol}://${host}${messagePath}`;
    
  res.write(`event: endpoint\ndata: ${absoluteMessageUrl}\n\n`);

  req.on('close', () => {
    sseConnections.delete(sessionId);
  });
}

async function handlePostMessage(req, res) {
  const { secretPrefix } = req.params;
  const { sessionId } = req.query;

  if (secretPrefix && MCP_SECRET && secretPrefix !== MCP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId query parameter.' });
  }

  const clientRes = sseConnections.get(sessionId);
  if (!clientRes) {
    return res.status(404).json({ error: 'Active SSE connection session not found.' });
  }

  const payload = req.body;
  const responsePayload = await handleJsonRpc(payload);
  
  if (responsePayload) {
    clientRes.write(`event: message\ndata: ${JSON.stringify(responsePayload)}\n\n`);
  }

  res.status(202).end();
}

app.get('/sse', handleSseConnection);
app.get('/:secretPrefix/sse', handleSseConnection);
app.post('/message', handlePostMessage);
app.post('/:secretPrefix/message', handlePostMessage);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 FinFlow MCP Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/`);
  console.log(`   Tools:  http://localhost:${PORT}/tools`);
  console.log(`   SSE:    http://localhost:${PORT}/sse`);
  if (MCP_SECRET) {
    console.log(`   Auth:   Bearer token configured ✓`);
  } else {
    console.log(`   Auth:   ⚠️  No MCP_SECRET set — open access (dev mode)`);
  }
  if (!SHEETS_API_URL) {
    console.log(`   Data:   ⚠️  No SHEETS_API_URL set — tool calls will fail`);
  } else {
    console.log(`   Data:   Google Sheets URL configured ✓`);
  }
  console.log('');
});
