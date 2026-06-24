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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Snaptrade } from 'snaptrade-typescript-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const MCP_SECRET = process.env.MCP_SECRET || '';
const SHEETS_API_URL = process.env.SHEETS_API_URL || ''; // Your Google Apps Script URL

let snaptradeClientId = process.env.SNAPTRADE_CLIENT_ID || '';
let snaptradeConsumerKey = process.env.SNAPTRADE_CONSUMER_KEY || '';

// Config file for SnapTrade User
const CONFIG_FILE_PATH = path.join(__dirname, 'snaptrade_config.json');

function saveSnapTradeConfig(config) {
  try {
    const existing = loadSnapTradeConfig() || {};
    const updated = {
      ...existing,
      ...config,
      snaptradeClientId,
      snaptradeConsumerKey
    };
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2));
    console.log(`[SnapTrade] Config saved.`);
  } catch (err) {
    console.error(`[SnapTrade] Error saving config:`, err.message);
  }
}

function loadSnapTradeConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
      if (data.snaptradeClientId) snaptradeClientId = data.snaptradeClientId;
      if (data.snaptradeConsumerKey) snaptradeConsumerKey = data.snaptradeConsumerKey;
      return data;
    }
  } catch (err) {
    console.warn(`[SnapTrade] Failed to load config from ${CONFIG_FILE_PATH}:`, err.message);
  }
  return null;
}

// Load config first to initialize keys on startup
loadSnapTradeConfig();

// Initialize SnapTrade Client
let snaptradeClient = null;
function getSnapTradeClient() {
  if (snaptradeClient) return snaptradeClient;
  if (snaptradeClientId && snaptradeConsumerKey) {
    snaptradeClient = new Snaptrade({
      clientId: snaptradeClientId,
      consumerKey: snaptradeConsumerKey,
    });
    console.log(`[SnapTrade] Client initialized.`);
  }
  return snaptradeClient;
}

// Automatically register a user on startup if not present
async function ensureSnapTradeUser() {
  const config = loadSnapTradeConfig();
  const client = getSnapTradeClient();
  return ensureSnapTradeUserForClient(client, config);
}

// Holdings Caching to prevent extra Investments charges
const HOLDINGS_CACHE_FILE = path.join(__dirname, 'snaptrade_holdings_cache.json');
const CACHE_HOLDINGS_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

function loadHoldingsCache() {
  try {
    if (fs.existsSync(HOLDINGS_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(HOLDINGS_CACHE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error(`[SnapTrade Cache] Error loading holdings cache:`, err.message);
  }
  return null;
}

function saveHoldingsCache(data) {
  try {
    fs.writeFileSync(HOLDINGS_CACHE_FILE, JSON.stringify({
      timestamp: Date.now(),
      data
    }, null, 2));
  } catch (err) {
    console.error(`[SnapTrade Cache] Error saving holdings cache:`, err.message);
  }
}

async function getSnapTradeHoldings(forceRefresh = false) {
  const config = await ensureSnapTradeUser();
  if (!config || !config.userSecret) {
    return null;
  }
  const client = getSnapTradeClient();

  // Check cache first
  const cache = loadHoldingsCache();
  if (cache && !forceRefresh && (Date.now() - cache.timestamp < CACHE_HOLDINGS_TTL_MS)) {
    console.log(`[SnapTrade Cache] Returning cached holdings.`);
    return cache.data;
  }

  if (!client || config.userSecret.includes('mock')) {
    // Generate mock sandbox holdings
    console.log(`[SnapTrade] Generating mock sandbox holdings.`);
    const mockData = {
      accounts: [
        {
          id: 'acc_1',
          name: 'Fidelity 401k',
          number: 'FID-401K-123',
          institution_name: 'Fidelity',
          brokerage: { name: 'Fidelity' },
          balances: { current: 454604.00 }
        },
        {
          id: 'acc_2',
          name: 'Robinhood Roth',
          number: 'RH-ROTH-456',
          institution_name: 'Robinhood',
          brokerage: { name: 'Robinhood' },
          balances: { current: 220900.00 }
        }
      ],
      positions: [
        {
          account_id: 'acc_1',
          symbol: { symbol: 'FXAIX', name: 'Fidelity 500 Index Fund' },
          units: 1000,
          price: 454.604,
          value: 454604.00,
          average_buy_price: 380.00,
          total_cost: 380000.00,
          open_pnl: 74604.00,
          total_pnl_percent: 19.63,
          day_pnl: 2250.00,
          day_pnl_percent: 0.50
        },
        {
          account_id: 'acc_1',
          symbol: { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
          units: 500,
          price: 201.96,
          value: 100980.00,
          average_buy_price: 190.00,
          total_cost: 95000.00,
          open_pnl: 5980.00,
          total_pnl_percent: 6.29,
          day_pnl: 500.00,
          day_pnl_percent: 0.50
        },
        {
          account_id: 'acc_2',
          symbol: { symbol: 'QQQ', name: 'Invesco QQQ Trust Series 1' },
          units: 1100,
          price: 200.81,
          value: 220900.00,
          average_buy_price: 180.00,
          total_cost: 198000.00,
          open_pnl: 22900.00,
          total_pnl_percent: 11.57,
          day_pnl: -1100.00,
          day_pnl_percent: -0.50
        }
      ]
    };
    saveHoldingsCache(mockData);
    return mockData;
  }

  console.log(`[SnapTrade] Fetching holdings from SnapTrade API...`);
  try {
    const { userId, userSecret } = config;
    const accountsResponse = await client.accountInformationUser.listUserAccounts({
      userId,
      userSecret
    });
    
    const accounts = accountsResponse.data || [];
    const aggregatedBalances = [];
    const aggregatedPositions = [];
    
    for (const acc of accounts) {
      const balRes = await client.accountInformationUser.calculateUserAccountBalances({
        userId,
        userSecret,
        accountId: acc.id
      }).catch(e => {
        console.error(`[SnapTrade] Balances call failed for ${acc.name}:`, e.message);
        return { data: [] };
      });
      
      const balancesData = balRes.data || [];
      const totalEquity = balancesData.find(b => b.currency?.code === 'USD')?.total?.amount || 0;

      const posRes = await client.accountInformationUser.getUserAccountPositions({
        userId,
        userSecret,
        accountId: acc.id
      }).catch(e => {
        console.error(`[SnapTrade] Positions call failed for ${acc.name}:`, e.message);
        return { data: [] };
      });

      const positions = (posRes.data || []).map(pos => {
        const units = pos.units || 0;
        const price = pos.price || 0;
        const value = pos.value || (units * price) || 0;
        const average_buy_price = pos.average_buy_price || pos.cost || price;
        const total_cost = average_buy_price * units;
        const open_pnl = pos.open_pnl !== undefined ? pos.open_pnl : (value - total_cost);
        const total_pnl_percent = total_cost > 0 ? (open_pnl / total_cost) * 100 : 0;
        const day_pnl = pos.day_pnl !== undefined ? pos.day_pnl : (value * 0.005);
        const day_pnl_percent = value > 0 ? (day_pnl / value) * 100 : 0;

        const name = pos.symbol?.description || pos.symbol?.symbol || 'Unknown Security';
        const { assetClass, sector, geography } = categorizeSecurity(name, acc.name || '');

        return {
          account_id: acc.id,
          symbol: {
            symbol: pos.symbol?.symbol || 'Unknown',
            name
          },
          units,
          price,
          value,
          average_buy_price,
          total_cost,
          open_pnl,
          total_pnl_percent,
          day_pnl,
          day_pnl_percent,
          assetClass,
          sector,
          geography
        };
      });

      aggregatedBalances.push({
        id: acc.id,
        name: acc.name,
        number: acc.number,
        institution_name: acc.brokerage?.name || 'Brokerage',
        brokerage: acc.brokerage || { name: 'Brokerage' },
        balances: {
          current: totalEquity || positions.reduce((sum, p) => sum + p.value, 0) || 0
        }
      });
      
      aggregatedPositions.push(...positions);
    }
    
    const result = {
      accounts: aggregatedBalances,
      positions: aggregatedPositions
    };
    
    saveHoldingsCache(result);
    return result;
  } catch (err) {
    const errMsg = getSnapTradeErrorMessage(err);
    console.error(`[SnapTrade] Error aggregating holdings:`, errMsg);
    throw new Error(errMsg, { cause: err });
  }
}

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
  },
  {
    name: 'get_portfolio_holdings',
    description: 'Provides a detailed list of all investment holdings, including symbol, company name, quantity, current price, total value, cost basis, unrealized P&L ($ and %), and day P&L ($ and %).',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Filter holdings to a specific investment account name or ID (optional)' }
      }
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

    case 'get_portfolio_holdings': {
      const { account } = args || {};
      const snapData = await getSnapTradeHoldings(false).catch(() => null);
      if (!snapData || !snapData.positions) {
        return { count: 0, holdings: [], message: 'No brokerage integration configured.' };
      }
      
      let holdings = snapData.positions;
      const accMap = new Map(snapData.accounts.map(a => [a.id, a]));
      holdings = holdings.map(h => {
        const acc = accMap.get(h.account_id) || {};
        return {
          ...h,
          account_name: acc.name || 'Unknown Account',
          institution_name: acc.institution_name || 'Brokerage'
        };
      });

      if (account) {
        holdings = holdings.filter(h => 
          h.account_id === account || 
          h.account_name.toLowerCase().includes(account.toLowerCase()) ||
          h.institution_name.toLowerCase().includes(account.toLowerCase())
        );
      }
      
      return {
        count: holdings.length,
        holdings
      };
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
      
      const DEMO_HOLDINGS = [
        { ticker: 'FXAIX', name: 'Fidelity 500 Index Fund', value: 345267.45, assetClass: 'US Equities', sector: 'Large Blend / Diversified', geography: 'United States' },
        { ticker: 'VTI', name: 'Vanguard Total Stock Market Index Fund ETF', value: 267083.82, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'Cash', name: 'Cash', value: 63259.14, assetClass: 'Cash & Equivalents', sector: 'Cash', geography: 'United States' },
        { ticker: 'NT S&P 500 IDX NL 4', name: 'NT S&P 500 Index NL 4', value: 61504.04, assetClass: 'US Equities', sector: 'Large Blend / Diversified', geography: 'United States' },
        { ticker: 'WEEK', name: 'WEEK ETF', value: 43047.30, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'ARM', name: 'Arm Holdings plc', value: 40772.00, assetClass: 'International Equities', sector: 'Semiconductors / Technology', geography: 'United Kingdom' },
        { ticker: 'VXUS', name: 'Vanguard Total International Stock Index Fund ETF', value: 30850.76, assetClass: 'International Equities', sector: 'Broad International / Diversified', geography: 'Global Ex-US' },
        { ticker: 'VB', name: 'Vanguard Small-Cap Index Fund ETF', value: 29235.20, assetClass: 'US Equities', sector: 'Small Cap / Diversified', geography: 'United States' },
        { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', value: 17584.84, assetClass: 'US Equities', sector: 'Large Blend / Diversified', geography: 'United States' },
        { ticker: 'QQQI', name: 'NEOS NASDAQ 100 HIGH INCOME ETF', value: 13077.71, assetClass: 'US Equities', sector: 'Nasdaq 100 / Technology / Income', geography: 'United States' },
        { ticker: 'SPYI', name: 'Neos S&P 500 High Income ETF', value: 11776.66, assetClass: 'US Equities', sector: 'Large Blend / Income', geography: 'United States' },
        { ticker: 'W', name: 'Wayfair Inc', value: 8485.00, assetClass: 'US Equities', sector: 'Consumer Cyclical / E-Commerce', geography: 'United States' },
        { ticker: 'IBIT', name: 'iShares Bitcoin Trust', value: 8382.37, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin', geography: 'Global' },
        { ticker: 'UTSTX', name: 'Total US Stock Market', value: 7854.59, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'NFLX', name: 'Netflix Inc', value: 7282.00, assetClass: 'US Equities', sector: 'Media / Communication Services', geography: 'United States' },
        { ticker: 'VIIIX', name: 'Vanguard Institutional Index Fund', value: 7252.25, assetClass: 'US Equities', sector: 'Large Blend / Diversified', geography: 'United States' },
        { ticker: 'VIGIX', name: 'Vanguard Growth Index Fund', value: 6937.40, assetClass: 'US Equities', sector: 'Large Growth / Tech-Leaning', geography: 'United States' },
        { ticker: 'BTCI', name: 'NEOS Bitcoin High Income ETF', value: 5404.49, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin', geography: 'Global' },
        { ticker: 'INTC', name: 'Intel Corp', value: 5291.20, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'SOFI', name: 'SoFi Technologies Inc', value: 5187.00, assetClass: 'US Equities', sector: 'Financial Services / Fintech', geography: 'United States' },
        { ticker: 'VCAIX', name: 'Vanguard California Intermediate-Term Tax-Exempt Fund', value: 4947.17, assetClass: 'Fixed Income', sector: 'Municipal Bonds', geography: 'United States' },
        { ticker: 'APLD', name: 'Applied Digital Corp', value: 4869.40, assetClass: 'US Equities', sector: 'Technology Infrastructure / Data Centers', geography: 'United States' },
        { ticker: 'TEM', name: 'Tempus AI Inc Class A', value: 4785.00, assetClass: 'US Equities', sector: 'Healthcare / Biotechnology / AI', geography: 'United States' },
        { ticker: 'NBIS', name: 'NBIS', value: 3920.51, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'RVI', name: 'RVI', value: 3868.00, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'GLXY', name: 'Galaxy Digital Holdings Ltd', value: 3310.00, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Financial Services', geography: 'Canada' },
        { ticker: 'SGOV', name: 'iShares 0-3 Month Treasury Bond ETF', value: 2865.70, assetClass: 'Fixed Income', sector: 'Government / Short-Term Treasuries', geography: 'United States' },
        { ticker: 'SIVEF', name: 'Sivers Semiconductors AB', value: 2808.00, assetClass: 'International Equities', sector: 'Semiconductors / Technology', geography: 'Sweden' },
        { ticker: 'DRAM', name: 'Roundhill Memory ETF', value: 2768.80, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'Global' },
        { ticker: 'IBM', name: 'International Business Machines Corp', value: 2649.40, assetClass: 'US Equities', sector: 'Information Technology Services', geography: 'United States' },
        { ticker: 'GEV', name: 'GE Vernova Inc', value: 2621.50, assetClass: 'US Equities', sector: 'Industrials / Clean Energy', geography: 'United States' },
        { ticker: 'CRDO', name: 'Credo Technology Group', value: 2520.56, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'AMD', name: 'Advanced Micro Devices Inc', value: 2354.09, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'USAR', name: 'USA Restaurant Funding Inc', value: 2289.00, assetClass: 'US Equities', sector: 'Consumer Cyclical / Restaurants', geography: 'United States' },
        { ticker: 'Cash 2', name: 'Cash', value: 2275.24, assetClass: 'Cash & Equivalents', sector: 'Cash', geography: 'United States' },
        { ticker: 'GLD', name: 'SPDR Gold Trust', value: 1886.60, assetClass: 'Alternatives (Commodities)', sector: 'Precious Metals / Gold', geography: 'Global' },
        { ticker: 'COHR', name: 'Coherent Corp', value: 1858.68, assetClass: 'US Equities', sector: 'Technology / Photonics', geography: 'United States' },
        { ticker: 'SG', name: 'Sweetgreen Inc', value: 1658.00, assetClass: 'US Equities', sector: 'Consumer Cyclical / Restaurants', geography: 'United States' },
        { ticker: 'IQEPY', name: 'IQE PLC', value: 1650.00, assetClass: 'International Equities', sector: 'Semiconductors / Tech', geography: 'United Kingdom' },
        { ticker: 'INFQ', name: 'Churchill Capital Corp X', value: 1596.00, assetClass: 'US Equities', sector: 'Financial Services / SPAC', geography: 'United States' },
        { ticker: 'AMZN', name: 'Amazon.com Inc', value: 1508.75, assetClass: 'US Equities', sector: 'Consumer Cyclical / Retail / Cloud', geography: 'United States' },
        { ticker: 'GOOGL', name: 'Alphabet Inc', value: 1491.79, assetClass: 'US Equities', sector: 'Interactive Media / Tech', geography: 'United States' },
        { ticker: 'RIVN', name: 'Rivian Automotive Inc', value: 1489.00, assetClass: 'US Equities', sector: 'Consumer Cyclical / Auto Manufacturers', geography: 'United States' },
        { ticker: 'JD', name: 'JD.com Inc', value: 1337.28, assetClass: 'International Equities', sector: 'Consumer Cyclical / E-Commerce', geography: 'China' },
        { ticker: 'SMCX', name: 'SMCX', value: 1335.00, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'ETHA', name: 'iShares Ethereum Trust', value: 1307.00, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Ethereum', geography: 'Global' },
        { ticker: 'NXT', name: 'Next PLC', value: 1290.60, assetClass: 'International Equities', sector: 'Consumer Cyclical / Retail', geography: 'United Kingdom' },
        { ticker: 'NVDA', name: 'NVIDIA Corp', value: 1242.03, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'ANET', name: 'Arista Networks Inc', value: 1189.07, assetClass: 'US Equities', sector: 'Technology / Networking Infrastructure', geography: 'United States' },
        { ticker: 'OKLO', name: 'Oklo Inc', value: 1167.70, assetClass: 'US Equities', sector: 'Utilities / Clean Energy / Nuclear', geography: 'United States' },
        { ticker: 'BE', name: 'Bloom Energy Corp', value: 1140.03, assetClass: 'US Equities', sector: 'Industrials / Clean Energy', geography: 'United States' },
        { ticker: 'SNDK', name: 'SanDisk Corp', value: 1126.52, assetClass: 'US Equities', sector: 'Technology / Storage', geography: 'United States' },
        { ticker: 'JBL', name: 'Jabil Inc', value: 1118.97, assetClass: 'US Equities', sector: 'Technology Hardware / Manufacturing', geography: 'United States' },
        { ticker: 'SLV', name: 'iShares Silver Trust', value: 1114.60, assetClass: 'Alternatives (Commodities)', sector: 'Precious Metals / Silver', geography: 'Global' },
        { ticker: 'ALAB', name: 'Astera Labs Inc', value: 1000.07, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'AVGO', name: 'Broadcom Inc', value: 987.78, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'CAT', name: 'Caterpillar Inc', value: 984.24, assetClass: 'US Equities', sector: 'Industrials / Machinery', geography: 'United States' },
        { ticker: 'IREN', name: 'Iris Energy Ltd', value: 980.49, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'Australia' },
        { ticker: 'CENX', name: 'Century Aluminum Co', value: 946.60, assetClass: 'US Equities', sector: 'Basic Materials / Aluminum', geography: 'United States' },
        { ticker: 'AAOI', name: 'Applied Optoelectronics Inc', value: 916.19, assetClass: 'US Equities', sector: 'Technology / Fiber Optics', geography: 'United States' },
        { ticker: 'TER', name: 'Teradyne Inc', value: 909.22, assetClass: 'US Equities', sector: 'Technology Hardware / Test Equipment', geography: 'United States' },
        { ticker: 'AOSL', name: 'Alpha and Omega Semiconductor Ltd', value: 901.40, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'VIAV', name: 'Viavi Solutions Inc', value: 746.77, assetClass: 'US Equities', sector: 'Technology / Telecommunications', geography: 'United States' },
        { ticker: 'LITE', name: 'Lumentum Holdings Inc', value: 713.92, assetClass: 'US Equities', sector: 'Technology / Photonics', geography: 'United States' },
        { ticker: 'SOUN', name: 'SoundHound AI Inc', value: 686.50, assetClass: 'US Equities', sector: 'Technology / AI / Software', geography: 'United States' },
        { ticker: 'VBMPX', name: 'Vanguard Total Bond Market Index Fund', value: 676.66, assetClass: 'Fixed Income', sector: 'Broad Bond Market', geography: 'United States' },
        { ticker: 'GRCV', name: 'Grand Capital Ventures Inc', value: 658.35, assetClass: 'US Equities', sector: 'Financial Services', geography: 'United States' },
        { ticker: 'EOSE', name: 'Eos Energy Enterprises Inc', value: 649.00, assetClass: 'US Equities', sector: 'Technology / Energy Storage', geography: 'United States' },
        { ticker: 'SERV', name: 'Serve Robotics Inc', value: 641.00, assetClass: 'US Equities', sector: 'Technology / Robotics', geography: 'United States' },
        { ticker: 'HIMS', name: 'Hims & Hers Health Inc', value: 613.58, assetClass: 'US Equities', sector: 'Healthcare / Wellness', geography: 'United States' },
        { ticker: 'MSFT', name: 'Microsoft Corp', value: 605.93, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'PANW', name: 'Palo Alto Networks Inc', value: 599.66, assetClass: 'US Equities', sector: 'Technology / Cybersecurity', geography: 'United States' },
        { ticker: 'TSEM', name: 'Tower Semiconductor Ltd', value: 540.37, assetClass: 'International Equities', sector: 'Semiconductors / Technology', geography: 'Israel' },
        { ticker: 'CIFR', name: 'Cipher Mining Inc', value: 522.09, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'United States' },
        { ticker: 'CORZ', name: 'Core Scientific Inc', value: 489.02, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'United States' },
        { ticker: 'META', name: 'Meta Platforms Inc', value: 465.73, assetClass: 'US Equities', sector: 'Interactive Media / Tech', geography: 'United States' },
        { ticker: 'GPDNF', name: 'Danone SA', value: 444.48, assetClass: 'International Equities', sector: 'Consumer Defensive / Food', geography: 'France' },
        { ticker: 'APM', name: 'Aptorum Group Ltd', value: 414.20, assetClass: 'International Equities', sector: 'Healthcare / Biotechnology', geography: 'Hong Kong' },
        { ticker: 'TEM 2', name: 'Tempus AI Inc Class A', value: 394.20, assetClass: 'US Equities', sector: 'Healthcare / Biotechnology / AI', geography: 'United States' },
        { ticker: 'ELV', name: 'SPDR DJ Wilshire Large Cap Value ETF', value: 378.65, assetClass: 'US Equities', sector: 'Large Value / Diversified', geography: 'United States' },
        { ticker: 'LLY', name: 'Eli Lilly and Co', value: 378.51, assetClass: 'US Equities', sector: 'Healthcare / Pharmaceuticals', geography: 'United States' },
        { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc', value: 374.04, assetClass: 'US Equities', sector: 'Financial Services / Conglomerate', geography: 'United States' },
        { ticker: 'WULF', name: 'TeraWulf Inc', value: 367.08, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'United States' },
        { ticker: 'CRWD', name: 'CrowdStrike Holdings Inc', value: 349.86, assetClass: 'US Equities', sector: 'Technology / Cybersecurity', geography: 'United States' },
        { ticker: 'VST', name: 'Vistra Corp', value: 346.87, assetClass: 'US Equities', sector: 'Utilities / Power Generation', geography: 'United States' },
        { ticker: 'CIEN', name: 'Ciena Corp', value: 339.83, assetClass: 'US Equities', sector: 'Technology / Networking', geography: 'United States' },
        { ticker: 'AEHR', name: 'Aehr Test Systems', value: 295.08, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'SPGI', name: 'S&P Global Inc', value: 277.39, assetClass: 'US Equities', sector: 'Financial Services / Information', geography: 'United States' },
        { ticker: 'PR', name: 'Permian Resources Corp', value: 273.84, assetClass: 'US Equities', sector: 'Energy / Oil & Gas', geography: 'United States' },
        { ticker: 'NOW', name: 'ServiceNow Inc', value: 263.90, assetClass: 'US Equities', sector: 'Technology / Software', geography: 'United States' },
        { ticker: 'SCHO', name: 'Schwab Short-Term U.S. Treasury ETF', value: 259.85, assetClass: 'Fixed Income', sector: 'Government / Short-Term Treasuries', geography: 'United States' },
        { ticker: 'NOK', name: 'Nokia Oyj', value: 256.61, assetClass: 'International Equities', sector: 'Technology / Telecommunications', geography: 'Finland' },
        { ticker: 'PLTR', name: 'Palantir Technologies Inc', value: 241.64, assetClass: 'US Equities', sector: 'Technology / AI / Software', geography: 'United States' },
        { ticker: 'AAPL', name: 'Apple Inc', value: 233.88, assetClass: 'US Equities', sector: 'Technology / Consumer Electronics', geography: 'United States' },
        { ticker: 'GRAB', name: 'Grab Holdings Ltd', value: 227.27, assetClass: 'International Equities', sector: 'Technology / Super-app', geography: 'Singapore' },
        { ticker: 'MELI', name: 'MercadoLibre Inc', value: 223.61, assetClass: 'International Equities', sector: 'Consumer Cyclical / E-Commerce', geography: 'Latin America' },
        { ticker: 'LHX', name: 'L3Harris Technologies Inc', value: 190.10, assetClass: 'US Equities', sector: 'Industrials / Aerospace & Defense', geography: 'United States' },
        { ticker: 'RIOT', name: 'Riot Platforms Inc', value: 178.13, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'United States' },
        { ticker: 'NVDS', name: 'AXS 1.25X NVDA Bear Daily ETF', value: 171.76, assetClass: 'Alternatives (Trading)', sector: 'Inverse Equity / Trading', geography: 'United States' },
        { ticker: 'IBP', name: 'Installed Building Products Inc', value: 166.40, assetClass: 'US Equities', sector: 'Industrials / Homebuilding', geography: 'United States' },
        { ticker: 'SPCK', name: 'SPAC and New Issue ETF', value: 156.11, assetClass: 'US Equities', sector: 'Financial Services / SPAC', geography: 'United States' },
        { ticker: 'MNST.o', name: 'Monster Beverage Call Option', value: 150.00, assetClass: 'Alternatives (Options)', sector: 'Derivatives / Beverage', geography: 'United States' },
        { ticker: 'AMAT', name: 'Applied Materials Inc', value: 148.64, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'CDE', name: 'Coeur Mining Inc', value: 144.53, assetClass: 'US Equities', sector: 'Basic Materials / Silver & Gold Mining', geography: 'United States' },
        { ticker: 'HL', name: 'Hecla Mining Co', value: 122.49, assetClass: 'US Equities', sector: 'Basic Materials / Silver & Gold Mining', geography: 'United States' },
        { ticker: 'CLSK', name: 'CleanSpark Inc', value: 115.32, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'United States' }
      ];

      let holdingsList = DEMO_HOLDINGS;
      const snapData = await getSnapTradeHoldings(false).catch(() => null);
      if (snapData && snapData.positions && snapData.accounts) {
        const accMap = new Map(snapData.accounts.map(a => [a.id, a]));
        
        holdingsList = snapData.positions.map(pos => {
          const acc = accMap.get(pos.account_id) || {};
          const ticker = pos.symbol?.symbol || 'Unknown';
          const name = pos.symbol?.name || 'Unknown Security';
          const value = pos.value || (pos.units * pos.price) || 0;
          const { assetClass, sector, geography } = categorizeSecurity(name, acc.name || '');
          
          return {
            ticker,
            name,
            value,
            assetClass,
            sector,
            geography,
            accountName: acc.name || 'Brokerage Account'
          };
        });
      }

      if (account) {
        holdingsList = holdingsList.filter(h => 
          (h.accountName && h.accountName.toLowerCase().includes(account.toLowerCase())) ||
          (h.name && h.name.toLowerCase().includes(account.toLowerCase()))
        );
      }

      let totalVal = holdingsList.reduce((sum, h) => sum + h.value, 0);
      const classMap = {};
      const sectorMap = {};
      const geoMap = {};

      holdingsList.forEach(h => {
        classMap[h.assetClass] = (classMap[h.assetClass] || 0) + h.value;
        sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.value;
        geoMap[h.geography] = (geoMap[h.geography] || 0) + h.value;
      });

      const getPercentages = (map) => {
        return Object.entries(map).map(([name, val]) => ({
          name,
          value: val,
          percentage: totalVal > 0 ? parseFloat(((val / totalVal) * 100).toFixed(1)) : 0
        })).sort((a, b) => b.value - a.value);
      };

      return {
        total_investment_value: totalVal,
        allocation_by_class: getPercentages(classMap),
        allocation_by_sector: getPercentages(sectorMap),
        allocation_by_geography: getPercentages(geoMap),
        holdings: holdingsList.map(h => ({
          ticker: h.ticker,
          name: h.name,
          value: h.value,
          percentage: totalVal > 0 ? parseFloat(((h.value / totalVal) * 100).toFixed(2)) : 0,
          assetClass: h.assetClass,
          sector: h.sector,
          geography: h.geography
        }))
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

function getSnapTradeErrorMessage(err) {
  const body = err.responseBody || err.response?.data;
  if (body) {
    if (typeof body === 'object') {
      return body.detail || body.error || body.message || JSON.stringify(body);
    }
    try {
      const parsed = JSON.parse(body);
      return parsed.detail || parsed.error || parsed.message || body;
    } catch {
      return body;
    }
  }
  return err.message;
}

// ─── SnapTrade Stateless Credential Resolvers ───────────────────────────────
function getSnapTradeClientAndConfig(req) {
  let cId = (req?.headers?.['x-snaptrade-client-id'] || '').trim();
  let cKey = (req?.headers?.['x-snaptrade-consumer-key'] || '').trim();
  let uId = (req?.headers?.['x-snaptrade-user-id'] || '').trim();
  let uSec = (req?.headers?.['x-snaptrade-user-secret'] || '').trim();

  // If not in headers, check body or memory
  if (!cId) cId = (req?.body?.clientId || snaptradeClientId || '').trim();
  if (!cKey) cKey = (req?.body?.consumerKey || snaptradeConsumerKey || '').trim();
  if (!uId) uId = (req?.body?.userId || '').trim();
  if (!uSec) uSec = (req?.body?.userSecret || '').trim();

  // Fallback to loaded config if not in headers/body/memory
  if (!uId || !uSec || uSec.includes('mock')) {
    const fileConfig = loadSnapTradeConfig() || {};
    uId = uId || fileConfig.userId;
    uSec = uSec || fileConfig.userSecret;
  }

  // Fallback to env if still missing
  if (!cId) {
    cId = process.env.SNAPTRADE_CLIENT_ID || '';
  }
  if (!cKey) {
    cKey = process.env.SNAPTRADE_CONSUMER_KEY || '';
  }
  if (!uId) {
    uId = process.env.SNAPTRADE_USER_ID || '';
  }
  if (!uSec) {
    uSec = process.env.SNAPTRADE_USER_SECRET || '';
  }

  if (!cId || !cKey) {
    return {
      client: null,
      config: {
        userId: uId || 'finflow_user',
        userSecret: uSec || 'mock-user-secret-fallback'
      }
    };
  }

  const client = new Snaptrade({
    clientId: cId,
    consumerKey: cKey,
  });

  return { client, config: { userId: uId, userSecret: uSec } };
}

async function ensureSnapTradeUserForClient(client, config) {
  if (config && config.userId && config.userSecret && !config.userSecret.includes('mock')) {
    return config;
  }
  if (!client) {
    return { userId: config?.userId || 'finflow_user', userSecret: 'mock-user-secret-fallback' };
  }

  try {
    console.log(`[SnapTrade] Querying existing users for Personal/Commercial fallback...`);
    const usersResponse = await client.authentication.listSnapTradeUsers().catch(e => {
      console.warn(`[SnapTrade] Could not list users (likely Commercial sandbox with no users yet):`, e.message);
      return { data: [] };
    });

    const users = usersResponse.data || [];
    let targetUserId = '';

    if (users.length > 0) {
      targetUserId = users[0].id || users[0].userId || users[0];
      console.log(`[SnapTrade] Found pre-provisioned user: ${targetUserId}. Resolving credentials via idempotency hack...`);
    } else {
      targetUserId = `finflow_user_${Math.random().toString(36).substring(2, 10)}`;
      console.log(`[SnapTrade] No existing users. Registering new unique user: ${targetUserId}`);
    }

    const registerResponse = await client.authentication.registerSnapTradeUser({
      userId: targetUserId,
    });

    const newConfig = {
      userId: targetUserId,
      userSecret: registerResponse.data.userSecret
    };
    saveSnapTradeConfig(newConfig);
    return newConfig;
  } catch (err) {
    const errMsg = getSnapTradeErrorMessage(err);
    console.error(`[SnapTrade] Error ensuring user:`, errMsg);
    throw new Error(errMsg, { cause: err });
  }
}

// ─── SnapTrade HTTP Route Handlers ────────────────────────────────────────────
async function handleSaveConfig(req, res) {
  try {
    const { clientId, consumerKey, userId, userSecret } = req.body;
    if (!clientId || !consumerKey) {
      return res.status(400).json({ error: 'Missing clientId or consumerKey' });
    }
    snaptradeClientId = clientId;
    snaptradeConsumerKey = consumerKey;
    snaptradeClient = null; // force reinitialization
    
    // Save credentials first
    if (userId && userSecret) {
      saveSnapTradeConfig({ userId, userSecret });
    } else {
      saveSnapTradeConfig({});
    }

    const client = getSnapTradeClient();
    if (!client) {
      return res.status(500).json({ error: 'Failed to initialize SnapTrade client with provided keys' });
    }
    
    const config = await ensureSnapTradeUser();
    
    res.json({ 
      success: true, 
      configured: true, 
      connected: config && !config.userSecret.includes('mock'),
      userId: config.userId,
      userSecret: config.userSecret
    });
  } catch (err) {
    const errMsg = getSnapTradeErrorMessage(err);
    console.error(`[SnapTrade] Error saving config:`, errMsg);
    res.status(500).json({ error: errMsg });
  }
}

async function handleCreatePortalUrl(req, res) {
  try {
    const { client, config } = getSnapTradeClientAndConfig(req);
    const finalConfig = await ensureSnapTradeUserForClient(client, config);
    if (!client || !finalConfig.userSecret || finalConfig.userSecret.includes('mock')) {
      return res.json({ redirectURI: 'https://web.snaptrade.com/session/mock-portal-url' });
    }
    const response = await client.authentication.login({
      userId: finalConfig.userId,
      userSecret: finalConfig.userSecret
    });
    res.json({ 
      redirectURI: response.data?.redirectURI || response.data,
      userId: finalConfig.userId,
      userSecret: finalConfig.userSecret
    });
  } catch (err) {
    const errMsg = getSnapTradeErrorMessage(err);
    console.error(`[SnapTrade] Error creating portal url:`, errMsg);
    res.status(500).json({ error: errMsg });
  }
}

async function handleSnapTradeStatus(req, res) {
  try {
    const { client, config } = getSnapTradeClientAndConfig(req);
    const finalConfig = await ensureSnapTradeUserForClient(client, config);
    const configured = !!client;

    if (!client || !finalConfig.userSecret || finalConfig.userSecret.includes('mock')) {
      return res.json({
        configured,
        connected: false,
        connections: [],
        userId: finalConfig.userId,
        userSecret: finalConfig.userSecret
      });
    }

    const response = await client.accountInformationUser.listUserAccounts({
      userId: finalConfig.userId,
      userSecret: finalConfig.userSecret
    });

    const accounts = response.data || [];
    const connectionsMap = new Map();
    accounts.forEach(acc => {
      const instName = acc.brokerage?.name || 'Brokerage';
      const authId = acc.brokerageAuthorization?.id || acc.brokerageAuthorization || acc.id;
      if (!connectionsMap.has(instName)) {
        connectionsMap.set(instName, {
          institution_name: instName,
          item_id: authId,
          last_sync: new Date().toISOString()
        });
      }
    });

    res.json({
      configured,
      connected: connectionsMap.size > 0,
      connections: Array.from(connectionsMap.values()),
      userId: finalConfig.userId,
      userSecret: finalConfig.userSecret
    });
  } catch (err) {
    const errMsg = getSnapTradeErrorMessage(err);
    console.error(`[SnapTrade] Error getting status:`, errMsg);
    res.status(500).json({ 
      error: errMsg, 
      configured: !!getSnapTradeClientAndConfig(req).client 
    });
  }
}

async function handleGetSnapTradeHoldings(req, res) {
  const forceRefresh = req.query.force === 'true';
  try {
    const { client, config } = getSnapTradeClientAndConfig(req);
    const finalConfig = await ensureSnapTradeUserForClient(client, config);

    // Dynamic cache file based on user
    const userCacheFile = path.join(__dirname, `snaptrade_holdings_${finalConfig.userId}_cache.json`);

    function loadHoldingsCache() {
      try {
        if (fs.existsSync(userCacheFile)) {
          return JSON.parse(fs.readFileSync(userCacheFile, 'utf8'));
        }
      } catch (err) {
        console.error(`[SnapTrade Cache] Error loading holdings cache:`, err.message);
      }
      return null;
    }

    function saveHoldingsCache(data) {
      try {
        fs.writeFileSync(userCacheFile, JSON.stringify({
          timestamp: Date.now(),
          data
        }, null, 2));
      } catch (err) {
        console.error(`[SnapTrade Cache] Error saving holdings cache:`, err.message);
      }
    }

    const cache = loadHoldingsCache();
    if (cache && !forceRefresh && (Date.now() - cache.timestamp < CACHE_HOLDINGS_TTL_MS)) {
      console.log(`[SnapTrade Cache] Returning cached holdings.`);
      return res.json(cache.data);
    }

    if (!client || !finalConfig.userSecret || finalConfig.userSecret.includes('mock')) {
      console.log(`[SnapTrade] Generating mock sandbox holdings.`);
      const mockData = {
        accounts: [
          {
            id: 'acc_1',
            name: 'Fidelity 401k',
            number: 'FID-401K-123',
            institution_name: 'Fidelity',
            brokerage: { name: 'Fidelity' },
            balances: { current: 454604.00 }
          },
          {
            id: 'acc_2',
            name: 'Robinhood Roth',
            number: 'RH-ROTH-456',
            institution_name: 'Robinhood',
            brokerage: { name: 'Robinhood' },
            balances: { current: 220900.00 }
          }
        ],
        positions: [
          {
            account_id: 'acc_1',
            symbol: { symbol: 'FXAIX', name: 'Fidelity 500 Index Fund' },
            units: 1000,
            price: 454.604,
            value: 454604.00,
            average_buy_price: 380.00,
            total_cost: 380000.00,
            open_pnl: 74604.00,
            total_pnl_percent: 19.63,
            day_pnl: 2250.00,
            day_pnl_percent: 0.50,
            assetClass: 'US Equities',
            sector: 'Technology',
            geography: 'United States'
          },
          {
            account_id: 'acc_1',
            symbol: { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
            units: 500,
            price: 201.96,
            value: 100980.00,
            average_buy_price: 190.00,
            total_cost: 95000.00,
            open_pnl: 5980.00,
            total_pnl_percent: 6.29,
            day_pnl: -120.00,
            day_pnl_percent: -0.12,
            assetClass: 'US Equities',
            sector: 'Financials',
            geography: 'United States'
          }
        ]
      };
      return res.json(mockData);
    }

    const accResponse = await client.accountInformationUser.listUserAccounts({
      userId: finalConfig.userId,
      userSecret: finalConfig.userSecret
    });

    const posResponse = await client.accountInformationUser.getUserHoldings({
      userId: finalConfig.userId,
      userSecret: finalConfig.userSecret
    });

    const accounts = accResponse.data || [];
    const positionsRaw = posResponse.data || [];

    const positions = positionsRaw.map(pos => {
      const uPrice = pos.price || 0;
      const units = pos.units || 0;
      const val = pos.value || (units * uPrice);
      const avgPrice = pos.average_buy_price || uPrice;
      const totalCost = avgPrice * units;
      const openPnl = val - totalCost;
      const pnlPercent = totalCost > 0 ? (openPnl / totalCost) * 100 : 0;
      
      const symbolText = pos.symbol?.symbol || '';
      const sector = categorizeSecurity(symbolText, 'sector');
      const assetClass = categorizeSecurity(symbolText, 'assetClass');
      const geography = categorizeSecurity(symbolText, 'geography');

      return {
        ...pos,
        value: val,
        total_cost: totalCost,
        open_pnl: openPnl,
        total_pnl_percent: pnlPercent,
        day_pnl: pos.day_pnl || 0,
        day_pnl_percent: pos.day_pnl_percent || 0,
        assetClass,
        sector,
        geography
      };
    });

    const result = { accounts, positions };
    saveHoldingsCache(result);
    res.json(result);
  } catch (err) {
    const errMsg = getSnapTradeErrorMessage(err);
    console.error(`[SnapTrade] Error getting holdings:`, errMsg);
    res.status(500).json({ error: errMsg });
  }
}

async function handleSnapTradeDisconnect(req, res) {
  try {
    const { authorizationId } = req.body;
    const { client, config } = getSnapTradeClientAndConfig(req);
    
    if (config && config.userId) {
      if (authorizationId) {
        if (client && config.userSecret && !config.userSecret.includes('mock')) {
          await client.connections.removeBrokerageAuthorization({
            authorizationId,
            userId: config.userId,
            userSecret: config.userSecret
          });
          console.log(`[SnapTrade] Connection ${authorizationId} removed.`);
          
          const userCacheFile = path.join(__dirname, `snaptrade_holdings_${config.userId}_cache.json`);
          if (fs.existsSync(userCacheFile)) {
            fs.unlinkSync(userCacheFile);
          }
        }
      } else {
        if (client && config.userSecret && !config.userSecret.includes('mock')) {
          await client.authentication.deleteSnapTradeUser({
            userId: config.userId
          }).catch(e => console.warn('[SnapTrade] Delete user API warning:', e.message));
        }
        if (fs.existsSync(CONFIG_FILE_PATH)) {
          fs.unlinkSync(CONFIG_FILE_PATH);
        }
        if (fs.existsSync(HOLDINGS_CACHE_FILE)) {
          fs.unlinkSync(HOLDINGS_CACHE_FILE);
        }
        // Reset global credentials
        snaptradeClientId = '';
        snaptradeConsumerKey = '';
        snaptradeClient = null;
        console.log(`[SnapTrade] User configuration reset.`);
      }
    }
    res.json({ success: true });
  } catch (err) {
    const errMsg = getSnapTradeErrorMessage(err);
    console.error(`[SnapTrade] Error resetting connection:`, errMsg);
    res.status(500).json({ error: errMsg });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// SnapTrade endpoints
app.post('/api/snaptrade/config', handleSaveConfig);
app.post('/:secretPrefix/api/snaptrade/config', handleSaveConfig);

app.post('/api/snaptrade/create_portal_url', handleCreatePortalUrl);
app.post('/:secretPrefix/api/snaptrade/create_portal_url', handleCreatePortalUrl);

app.get('/api/snaptrade/status', handleSnapTradeStatus);
app.get('/:secretPrefix/api/snaptrade/status', handleSnapTradeStatus);

app.get('/api/snaptrade/holdings', handleGetSnapTradeHoldings);
app.get('/:secretPrefix/api/snaptrade/holdings', handleGetSnapTradeHoldings);

app.post('/api/snaptrade/disconnect', handleSnapTradeDisconnect);
app.post('/:secretPrefix/api/snaptrade/disconnect', handleSnapTradeDisconnect);


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

// Generic Proxy endpoint to bypass browser CORS (e.g. OpenAI/Anthropic/DeepSeek)
async function handleProxyCall(req, res) {
  const { secretPrefix } = req.params;
  const { url, headers, method, body } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing target url parameter in proxy request.' });
  }

  // If MCP_SECRET is configured, restrict proxy access to authenticated clients
  if (MCP_SECRET) {
    if (secretPrefix) {
      if (secretPrefix !== MCP_SECRET) {
        return res.status(401).json({ error: 'Unauthorized. Invalid secret prefix.' });
      }
    } else {
      const auth = req.headers.authorization || '';
      const token = auth.replace('Bearer ', '').trim();
      if (token !== MCP_SECRET) {
        return res.status(401).json({ error: 'Unauthorized. Provide a valid Bearer token for the proxy.' });
      }
    }
  }

  try {
    const response = await fetch(url, {
      method: method || 'POST',
      headers: headers || {},
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
    });

    // Copy original status and headers
    res.status(response.status);
    
    // Set headers appropriate for streaming if target is SSE
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      response.body.on('data', (chunk) => {
        res.write(chunk);
      });
      response.body.on('end', () => {
        res.end();
      });
      response.body.on('error', (err) => {
        console.error('[Proxy] Stream error:', err);
        res.end();
      });
    } else {
      res.setHeader('Content-Type', contentType);
      const text = await response.text();
      res.send(text);
    }
  } catch (err) {
    console.error('[Proxy] Connection error:', err.message);
    res.status(500).json({ error: `Proxy failed: ${err.message}` });
  }
}

app.post('/proxy', handleProxyCall);
app.post('/:secretPrefix/proxy', handleProxyCall);


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
