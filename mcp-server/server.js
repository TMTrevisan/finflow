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
import dns from 'dns';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { createAuthenticate, requireSseSession, validateAuthConfig } from './auth.js';
import { buildConnectionSummaries, buildHoldingsSyncSummary } from './snaptrade-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Defense in depth for nested SDK payloads and legacy caches.
app.set('json replacer', (key, value) =>
  ['userSecret', 'consumerKey', 'clientId', 'snaptradeConsumerKey', 'snaptradeClientId'].includes(key)
    ? undefined : value);
const PORT = process.env.PORT || 3001;
const MCP_SECRET = process.env.MCP_SECRET || '';
const FINFLOW_ADMIN_SECRET = process.env.FINFLOW_ADMIN_SECRET || '';
const HOST = process.env.HOST || undefined;
let openMode;
try {
  if (FINFLOW_ADMIN_SECRET && FINFLOW_ADMIN_SECRET === MCP_SECRET) {
    throw new Error('FINFLOW_ADMIN_SECRET must differ from MCP_SECRET.');
  }
  openMode = validateAuthConfig({ secret: MCP_SECRET, devOpen: process.env.FINFLOW_DEV_OPEN, host: HOST });
} catch (err) {
  console.error(`[FinFlow] ${err.message}`);
  process.exit(1);
}
if (openMode) {
  console.warn(`
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
WARNING: FINFLOW DEVELOPMENT OPEN MODE — AUTHENTICATION OFF
Anyone with access to 127.0.0.1 can access financial data.
Use only for local development. Never expose via a proxy/tunnel.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
`);
}
console.log(`[FinFlow] Admin operations: ${FINFLOW_ADMIN_SECRET ? 'separate bearer required' : 'disabled (FINFLOW_ADMIN_SECRET not configured)'}.`);
const SHEETS_API_SECRET = process.env.SHEETS_API_SECRET || '';
const SHEETS_API_URL = process.env.SHEETS_API_URL || ''; // Your Google Apps Script URL

// Config reads return the effective server identity without creating or mutating files.
const CONFIG_FILE_PATH = path.join(__dirname, 'snaptrade_config.json');

function getUserCacheFilePath(principalKey) {
  return path.join(__dirname, `snaptrade_holdings_${principalKey}_cache.json`);
}

function getUserStatusCacheFilePath(principalKey) {
  return path.join(__dirname, `snaptrade_status_${principalKey}_cache.json`);
}

function atomicWriteJson(target, data) {
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function saveSnapTradeConfig(config) {
  atomicWriteJson(CONFIG_FILE_PATH, config);
  console.log('[SnapTrade] Config saved.');
}

function loadSnapTradeConfig() {
  let data = {};
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) data = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8')) || {};
  } catch {
    console.warn('[SnapTrade] Failed to load config.');
  }
  const stringValue = value => typeof value === 'string' ? value : '';
  return {
    snaptradeClientId: stringValue(process.env.SNAPTRADE_CLIENT_ID ?? data.snaptradeClientId ?? ''),
    snaptradeConsumerKey: stringValue(process.env.SNAPTRADE_CONSUMER_KEY ?? data.snaptradeConsumerKey ?? ''),
    userId: stringValue(process.env.SNAPTRADE_USER_ID ?? data.userId ?? ''),
    userSecret: stringValue(process.env.SNAPTRADE_USER_SECRET ?? data.userSecret ?? '')
  };
}

let snaptradeClient = null;
let snaptradeClientKey = '';
function getSnapTradeClient(config = loadSnapTradeConfig()) {
  const { snaptradeClientId, snaptradeConsumerKey } = config;
  if (!snaptradeClientId || !snaptradeConsumerKey) return null;
  const key = createHash('sha256').update(JSON.stringify([snaptradeClientId, snaptradeConsumerKey])).digest('hex');
  if (!snaptradeClient || key !== snaptradeClientKey) {
    snaptradeClient = new Snaptrade({ clientId: snaptradeClientId, consumerKey: snaptradeConsumerKey });
    snaptradeClientKey = key;
  }
  return snaptradeClient;
}

function scrubSnapTradeCache(data) {
  return JSON.parse(JSON.stringify(data, (key, value) =>
    key !== 'hasUserSecret' && /secret|credential|token|consumer.?key|client.?id|user.?id|^authorization$/i.test(key)
      ? undefined : value));
}

function readSnapTradeCache(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const clean = scrubSnapTradeCache(raw);
  if (JSON.stringify(raw) !== JSON.stringify(clean)) atomicWriteJson(file, clean);
  return clean;
}

// Resolve provisioned credentials only; reads never register or reset users.
async function ensureSnapTradeUser() {
  const { client, config } = getSnapTradeClientAndConfig();
  return ensureSnapTradeUserForClient(client, config);
}

// Holdings Caching to prevent extra Investments charges
const HOLDINGS_CACHE_FILE = path.join(__dirname, 'snaptrade_holdings_cache.json');
const CACHE_HOLDINGS_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours
const HOLDINGS_CACHE_VERSION = 2;

async function fetchNormalizedSnapTradeHoldings(client, config, forceRefresh = false) {
  if (!client || !config.userId || !config.userSecret) {
    return { configured: false, connected: false, accounts: [], error: 'SnapTrade is not configured.' };
  }
  const userCacheFile = getUserCacheFilePath(config.principalKey);
  const isRealSnapTradeUser = !!client && !!config.userSecret && !config.userSecret.includes('mock');

  function loadHoldingsCache() {
    try {
      if (fs.existsSync(userCacheFile)) {
        const cache = readSnapTradeCache(userCacheFile);
        if (cache.version !== HOLDINGS_CACHE_VERSION) {
          console.log(`[SnapTrade Cache] Ignoring cache with an outdated holdings schema.`);
          return null;
        }
        return cache;
      }
    } catch (err) {
      console.error(`[SnapTrade Cache] Error loading holdings cache:`);
    }
    return null;
  }

  function saveHoldingsCache(data) {
    try {
      atomicWriteJson(userCacheFile, scrubSnapTradeCache({
        timestamp: Date.now(),
        version: HOLDINGS_CACHE_VERSION,
        data
      }));
    } catch (err) {
      console.error(`[SnapTrade Cache] Error saving holdings cache:`);
    }
  }

  const isMockHoldingsCache = (data) => {
    const accounts = data?.accounts || [];
    return !!data?.is_mock || accounts.some(acc => acc.id === 'acc_1' || acc.id === 'acc_2');
  };

  // Check cache first. Never let older mock/demo cache satisfy a real SnapTrade user.
  const cache = loadHoldingsCache();
  if (cache && !forceRefresh && (Date.now() - cache.timestamp < CACHE_HOLDINGS_TTL_MS)) {
    if (isRealSnapTradeUser && isMockHoldingsCache(cache.data)) {
      console.log(`[SnapTrade Cache] Ignoring stale mock holdings cache for real SnapTrade user.`);
    } else {
      console.log(`[SnapTrade Cache] Returning cached holdings.`);
      return cache.data;
    }
  }

  if (!isRealSnapTradeUser) {
    // Generate mock sandbox holdings
    console.log(`[SnapTrade] Generating mock sandbox holdings.`);
    const mockData = {
      is_mock: true,
      accounts: [
        {
          id: 'acc_1',
          name: 'Fidelity 401k',
          number: 'FID-401K-123',
          institution_name: 'Fidelity',
          brokerage: { name: 'Fidelity' },
          balances: { current: 598605.50, cash: 43021.50 }
        },
        {
          id: 'acc_2',
          name: 'Robinhood Roth',
          number: 'RH-ROTH-456',
          institution_name: 'Robinhood',
          brokerage: { name: 'Robinhood' },
          balances: { current: 225900.00, cash: 5000.00 }
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

    // Inject CASH synthetic position for mock
    mockData.positions.push({
      account_id: 'acc_1',
      symbol: { symbol: 'CASH', name: 'Cash Balance' },
      units: 43021.50,
      price: 1,
      value: 43021.50,
      average_buy_price: 1,
      total_cost: 43021.50,
      open_pnl: 0,
      total_pnl_percent: 0,
      day_pnl: 0,
      day_pnl_percent: 0,
      assetClass: 'Cash & Equivalents',
      sector: 'Cash',
      geography: 'United States',
      is_cash: true
    });
    mockData.positions.push({
      account_id: 'acc_2',
      symbol: { symbol: 'CASH', name: 'Cash Balance' },
      units: 5000.00,
      price: 1,
      value: 5000.00,
      average_buy_price: 1,
      total_cost: 5000.00,
      open_pnl: 0,
      total_pnl_percent: 0,
      day_pnl: 0,
      day_pnl_percent: 0,
      assetClass: 'Cash & Equivalents',
      sector: 'Cash',
      geography: 'United States',
      is_cash: true
    });

    // Populate classifications for standard mock assets
    mockData.positions.forEach(pos => {
      if (!pos.assetClass) {
        const { assetClass, sector, geography } = categorizeSecurity(pos.symbol.name, 'Investment');
        pos.assetClass = assetClass;
        pos.sector = sector;
        pos.geography = geography;
      }
    });

    saveHoldingsCache(mockData);
    return mockData;
  }

  console.log(`[SnapTrade] Fetching holdings from SnapTrade API...`);
  try {
    const { userId, userSecret } = config;
    const accountsResponse = await client.accountInformation.listUserAccounts({
      userId,
      userSecret
    });
    
    const holdingsResponse = await client.accountInformation.getAllUserHoldings({
      userId,
      userSecret
    });

    const accounts = accountsResponse.data || [];
    const holdings = holdingsResponse.data || [];
    const aggregatedBalances = [];
    const aggregatedPositions = [];

    // Fetch currency exchange rates to normalize everything to USD
    const usdRates = { 'USD': 1.0 };
    try {
      console.log(`[SnapTrade] Fetching currency exchange rates...`);
      const ratesResponse = await client.referenceData.listAllCurrenciesRates();
      const rates = ratesResponse.data || [];
      for (const pair of rates) {
        const srcCode = pair.src?.code?.toUpperCase();
        const dstCode = pair.dst?.code?.toUpperCase();
        const rate = Number(pair.exchange_rate);
        if (!srcCode || !dstCode || isNaN(rate) || rate <= 0) continue;

        if (dstCode === 'USD') {
          usdRates[srcCode] = rate;
        } else if (srcCode === 'USD') {
          if (!usdRates[dstCode]) {
            usdRates[dstCode] = 1 / rate;
          }
        }
      }
      console.log(`[SnapTrade] Loaded ${Object.keys(usdRates).length} USD currency exchange rates.`);
    } catch (ratesErr) {
      console.error(`[SnapTrade] Error fetching currency exchange rates, defaulting to 1.0:`, ratesErr.message);
    }

    // Create holdings map by account ID for easy lookup
    const holdingsMap = new Map();
    for (const h of holdings) {
      if (h.account && h.account.id) {
        holdingsMap.set(h.account.id, h);
      }
    }
    
    for (const acc of accounts) {
      // Robustly extract cash balance
      let cash = 0;
      if (acc.balance?.cash?.amount !== undefined && acc.balance.cash.amount !== null) {
        cash = Number(acc.balance.cash.amount) || 0;
      } else if (acc.balance?.cash !== undefined && acc.balance.cash !== null && typeof acc.balance.cash === 'number') {
        cash = acc.balance.cash;
      } else if (Array.isArray(acc.balances)) {
        for (const bal of acc.balances) {
          const cVal = bal.cash !== null && bal.cash !== undefined ? Number(bal.cash) : 0;
          const bpVal = bal.buying_power !== null && bal.buying_power !== undefined ? Number(bal.buying_power) : 0;
          cash += (cVal || bpVal || 0);
        }
      } else if (acc.balances && typeof acc.balances === 'object') {
        cash = Number(acc.balances.cash) || Number(acc.balances.buying_power) || 0;
      }

      // Robustly extract total equity
      let totalEquity = 0;
      if (acc.balance?.total?.amount !== undefined && acc.balance.total.amount !== null) {
        totalEquity = Number(acc.balance.total.amount);
      } else if (acc.balance?.amount !== undefined && acc.balance.amount !== null) {
        totalEquity = Number(acc.balance.amount);
      } else if (acc.balances?.current !== undefined && acc.balances.current !== null && typeof acc.balances.current === 'number') {
        totalEquity = acc.balances.current;
      } else if (Array.isArray(acc.balances)) {
        // If it's an array, try to find the total balance or sum cash + position values
      }
      
      if (!totalEquity) {
        totalEquity = cash || 0;
      }

      // Normalize account cash and total equity to USD
      let cashCurrencyCode = 'USD';
      if (acc.balance?.cash?.currency) {
        cashCurrencyCode = acc.balance.cash.currency;
      } else if (acc.balance?.total?.currency) {
        cashCurrencyCode = acc.balance.total.currency;
      } else if (acc.currency) {
        cashCurrencyCode = typeof acc.currency === 'object' ? (acc.currency.code || 'USD') : acc.currency;
      }

      let totalEquityCurrencyCode = 'USD';
      if (acc.balance?.total?.currency) {
        totalEquityCurrencyCode = acc.balance.total.currency;
      } else if (acc.balance?.currency) {
        totalEquityCurrencyCode = typeof acc.balance.currency === 'object' ? (acc.balance.currency.code || 'USD') : acc.balance.currency;
      } else if (acc.currency) {
        totalEquityCurrencyCode = typeof acc.currency === 'object' ? (acc.currency.code || 'USD') : acc.currency;
      }

      cashCurrencyCode = cashCurrencyCode.toUpperCase();
      totalEquityCurrencyCode = totalEquityCurrencyCode.toUpperCase();

      if (cashCurrencyCode !== 'USD') {
        const rate = usdRates[cashCurrencyCode];
        if (rate) {
          console.log(`[SnapTrade Currency] Converting cash from ${cashCurrencyCode} to USD using rate ${rate}`);
          cash = cash * rate;
        }
      }

      if (totalEquityCurrencyCode !== 'USD') {
        const rate = usdRates[totalEquityCurrencyCode];
        if (rate) {
          console.log(`[SnapTrade Currency] Converting total equity from ${totalEquityCurrencyCode} to USD using rate ${rate}`);
          totalEquity = totalEquity * rate;
        }
      }

      const hEntry = holdingsMap.get(acc.id);
      const rawAccPositions = [];
      if (hEntry) {
        if (hEntry.positions) {
          for (const pos of hEntry.positions) {
            rawAccPositions.push({ ...pos, is_option: false });
          }
        }
        if (hEntry.option_positions) {
          for (const pos of hEntry.option_positions) {
            rawAccPositions.push({ ...pos, is_option: true });
          }
        }
      }

      const positions = rawAccPositions.map(pos => {
        const units = pos.units || 0;
        let price = pos.price || 0;
        let value = pos.value || (units * price) || 0;
        
        let average_buy_price = pos.average_buy_price || pos.average_purchase_price || pos.cost || null;
        let open_pnl = pos.open_pnl !== undefined && pos.open_pnl !== null ? Number(pos.open_pnl) : null;
        let cost_basis_available = false;
        
        let total_cost;
        if (average_buy_price > 0) {
          total_cost = average_buy_price * units;
          cost_basis_available = true;
          if (pos.open_pnl === undefined || pos.open_pnl === null) {
            open_pnl = value - total_cost;
          }
        } else if (open_pnl !== null && units > 0) {
          // Back-calculate cost basis from open_pnl if average purchase price is missing
          total_cost = value - open_pnl;
          average_buy_price = total_cost / units;
          cost_basis_available = true;
        } else {
          // Do not fabricate cost basis or return data when SnapTrade did not provide it.
          total_cost = null;
        }
        
        let day_pnl = pos.day_pnl || 0;

        let ticker = '';
        let name = '';
        if (pos.symbol && typeof pos.symbol === 'object') {
          if (pos.symbol.ticker) {
            ticker = pos.symbol.ticker;
            name = pos.symbol.description || `Option: ${ticker}`;
          } else if (pos.symbol.symbol) {
            ticker = typeof pos.symbol.symbol === 'object' ? pos.symbol.symbol.symbol : pos.symbol.symbol;
            name = pos.symbol.description || (typeof pos.symbol.symbol === 'object' ? pos.symbol.symbol.description : '') || ticker;
          }
        }
        if (!ticker) {
          ticker = typeof pos.symbol === 'string' ? pos.symbol : 'Unknown';
        }
        if (!name) {
          name = ticker || 'Unknown Security';
        }

        // Normalize position values to USD if they are in another currency
        const posCurrencyCode = (pos.currency?.code || 'USD').toUpperCase();
        if (posCurrencyCode !== 'USD') {
          const rate = usdRates[posCurrencyCode];
          if (rate) {
            console.log(`[SnapTrade Currency] Converting position ${ticker} from ${posCurrencyCode} to USD using rate ${rate}`);
            price = price * rate;
            value = value * rate;
            if (average_buy_price !== null) average_buy_price = average_buy_price * rate;
            if (total_cost !== null) total_cost = total_cost * rate;
            if (open_pnl !== null) open_pnl = open_pnl * rate;
            day_pnl = day_pnl * rate;
          } else {
            console.warn(`[SnapTrade Currency] Exchange rate for ${posCurrencyCode} not found, using original values.`);
          }
        }

        const total_pnl_percent = total_cost > 0 && open_pnl !== null ? (open_pnl / total_cost) * 100 : null;
        const day_pnl_percent = value > 0 ? (day_pnl / value) * 100 : 0;

        let { assetClass, sector, geography } = categorizeSecurity(name, acc.name || '');
        if (pos.is_option) {
          assetClass = 'Alternatives (Options)';
          sector = 'Derivatives';
        }

        return {
          account_id: acc.id,
          symbol: {
            symbol: ticker || 'Unknown',
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
          geography,
          market_value_available: Number.isFinite(Number(pos.value))
            || (Number.isFinite(Number(pos.units)) && Number.isFinite(Number(pos.price)) && Number(pos.price) > 0),
          cost_basis_available
        };
      });

      const totalPosValue = positions.reduce((sum, p) => sum + p.value, 0);
      const finalAccountBalance = totalEquity || (cash + totalPosValue) || 0;

      // Inject cash balance as a synthetic position so it is fully captured
      if (cash > 0) {
        positions.push({
          account_id: acc.id,
          symbol: {
            symbol: 'CASH',
            name: 'Cash Balance'
          },
          units: cash,
          price: 1,
          value: cash,
          average_buy_price: 1,
          total_cost: cash,
          open_pnl: 0,
          total_pnl_percent: 0,
          day_pnl: 0,
          day_pnl_percent: 0,
          assetClass: 'Cash & Equivalents',
          sector: 'Cash',
          geography: 'United States',
          is_cash: true,
          market_value_available: true,
          cost_basis_available: true
        });
      }

      aggregatedBalances.push({
        id: acc.id,
        name: acc.name,
        number: acc.number,
        institution_name: acc.institution_name || acc.brokerage?.name || acc.meta?.institution_name || 'Brokerage',
        brokerage: acc.brokerage || { name: acc.institution_name || acc.meta?.institution_name || 'Brokerage' },
        brokerage_authorization: acc.brokerage_authorization || acc.brokerageAuthorization,
        sync_status: acc.sync_status || {},
        last_synced: acc.sync_status?.holdings?.last_successful_sync || acc.sync_status?.last_successful_sync || null,
        balances: {
          current: finalAccountBalance,
          cash: cash
        }
      });
      
      aggregatedPositions.push(...positions);
    }
    
    const syncSummary = buildHoldingsSyncSummary(accounts, holdings);
    const result = {
      is_mock: false,
      accounts: aggregatedBalances,
      positions: aggregatedPositions,
      connections: buildConnectionSummaries(accounts),
      sync_summary: syncSummary
    };
    
    saveHoldingsCache(result);
    return scrubSnapTradeCache(result);
  } catch (err) {
    const errMsg = getSnapTradeErrorMessage(err);
    console.error(`[SnapTrade] Error aggregating holdings:`, errMsg);
    throw new Error(errMsg, { cause: err });
  }
}

async function getSnapTradeHoldings(forceRefresh = false) {
  const config = await ensureSnapTradeUser();
  if (!config || !config.userSecret) {
    return null;
  }
  const client = getSnapTradeClient();
  return fetchNormalizedSnapTradeHoldings(client, config, forceRefresh);
}

const allowedOrigins = (process.env.TRUSTED_ORIGINS !== undefined
  ? process.env.TRUSTED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : process.env.NODE_ENV === 'production' ? [] : [
    'http://localhost:5173', 'http://localhost:3000',
    'http://127.0.0.1:5173', 'http://127.0.0.1:3000'
  ]);
function checkOrigin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error('Not allowed by CORS'));
}
// Apply before auth, parsers and CORS so errors cannot cache sensitive responses either.
function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}
app.use(noStore);
app.use(cors({ origin: checkOrigin }));
app.use(express.json());

// Active Server-Sent Events (SSE) connections mapping session IDs to response objects
const sseConnections = new Map();

// ─── Simple In-Memory Cache for Sheet Data ───────────────────────────────────
let cachedSheetData = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute Cache TTL

function normalizeTransactionTypes(transactions, categories) {
  const canonical = value => ({ income: 'Income', expense: 'Expense', transfer: 'Transfer' })[String(value || '').trim().toLowerCase()];
  const metadata = new Map(categories.map(c => [String(c.category || '').trim().toLowerCase(), c]));
  return transactions.map(transaction => {
    const category = metadata.get(String(transaction.category || '').trim().toLowerCase());
    const type = (category && (canonical(category.type) || canonical(category.group))) ||
      canonical(transaction.type) || (category ? 'Unknown' : Number(transaction.amount) < 0 ? 'Expense' : Number(transaction.amount) > 0 ? 'Income' : 'Unknown');
    return { ...transaction, type };
  });
}

async function fetchSheetData(forceRefresh = false) {
  if (!SHEETS_API_URL) {
    throw new Error('SHEETS_API_URL environment variable not set. Configure your Google Apps Script URL.');
  }

  const now = Date.now();
  if (cachedSheetData && !forceRefresh && (now - lastCacheFetchTime < CACHE_TTL_MS)) {
    return cachedSheetData;
  }

  console.log(`[Cache] Fetching fresh financial data from Google Apps Script...`);
  const url = new URL(SHEETS_API_URL);
  url.searchParams.set('action', 'getData');
  if (SHEETS_API_SECRET) url.searchParams.set('secret', SHEETS_API_SECRET);
  const response = await fetch(url);
  if (!response.ok) {
    if (cachedSheetData) {
      console.warn(`[Cache] Fresh fetch failed, returning stale cache.`);
      return cachedSheetData;
    }
    throw new Error(`Failed to fetch sheet data: ${response.status} ${response.statusText}`);
  }

  const envelope = await response.json();
  if (envelope && typeof envelope === 'object' &&
      (envelope.success === false || Object.hasOwn(envelope, 'error'))) {
    throw new Error(String(envelope.error || 'Sheets gateway request failed'));
  }
  if (!envelope || envelope.success !== true || !envelope.data ||
      typeof envelope.data !== 'object' || Array.isArray(envelope.data)) {
    throw new Error('Invalid Sheets gateway response envelope');
  }
  cachedSheetData = { ...envelope.data, transactions: normalizeTransactionTypes(envelope.data.transactions || [], envelope.data.categories || []) };
  lastCacheFetchTime = Date.now();
  return cachedSheetData;
}

// ─── Authentication Middleware ────────────────────────────────────────────────
const authenticate = createAuthenticate(MCP_SECRET, openMode);

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
  },
  {
    name: 'get_brokerage_activities',
    description: 'Provides a detailed list of historical brokerage transactions/activities (buys, sells, dividends, cash transfers, deposits, interest, fees) from connected SnapTrade accounts.',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Filter activities to a specific account name or ID (optional)' },
        since_date: { type: 'string', description: 'ISO date string (YYYY-MM-DD) — return activities on or after this date (optional)' },
        until_date: { type: 'string', description: 'ISO date string (YYYY-MM-DD) — return activities on or before this date (optional)' },
        limit: { type: 'number', description: 'Max number of results to return (default: 50, max: 200)' }
      }
    }
  },
  {
    name: 'get_brokerage_orders',
    description: 'Provides a list of open, pending, and executed brokerage orders across connected SnapTrade accounts.',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Filter orders to a specific account name or ID (optional)' },
        state: { type: 'string', enum: ['all', 'open', 'executed'], description: 'Filter orders by state (default: "all")' },
        days: { type: 'number', description: 'Number of past days to query orders for (default: 30)' }
      }
    }
  }
];

// Helper to determine asset class / sector / geography allocations based on account name or category
function categorizeSecurity(securityName = '', accountType = '') {
  const name = String(securityName || '').toLowerCase();
  
  let assetClass = 'US Equities';
  let sector = 'Technology';
  let geography = 'United States';

  // Check for short-term T-bill / cash-equivalent ETFs and cash keywords first
  if (
    name.includes('cash') || 
    name.includes('vmfxx') || 
    name.includes('money market') ||
    name.includes('weekly t-bill') ||
    name.includes('roundhill weekly') ||
    name.includes('t-bill') ||
    name.includes('t-bills') ||
    name.includes('sgov') ||
    name.includes('bil') ||
    name.includes('shv') ||
    name.includes('usfr') ||
    name.includes('tflo') ||
    name === 'week'
  ) {
    assetClass = 'Cash & Equivalents';
    sector = 'Cash';
    geography = 'United States';
  } else if (name.includes('bond') || name.includes('treasury') || name.includes('bnd') || name.includes('ief')) {
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
  } else if (accountType.toLowerCase() === 'checking' || accountType.toLowerCase() === 'savings') {
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
  } else if (
    name.includes('index') ||
    name.includes('s&p 500') ||
    name.includes('sp 500') ||
    name.includes('vti') ||
    name.includes('voo') ||
    name.includes('spy') ||
    name.includes('fxaix') ||
    name.includes('total stock') ||
    name.includes('diversified') ||
    name.includes('blend') ||
    name.includes('mutual fund') ||
    name.includes('etf')
  ) {
    sector = 'Broad Market / Diversified';
  }

  return { assetClass, sector, geography };
}

// ─── Tool Implementations ─────────────────────────────────────────────────────
async function runTool(toolName, args) {
  const data = await fetchSheetData();
  const { transactions = [], categories = [], balances = [] } = data;

  // Deduplicate balances to latest per account and merge SnapTrade if connected
  let latestBalances = (() => {
    const map = new Map();
    [...balances].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(b => {
      map.set(`${b.institution}_${b.account}_${b.account_id}`, b);
    });
    return Array.from(map.values());
  })();

  const snapData = await getSnapTradeHoldings(false).catch(() => null);
  if (snapData && snapData.accounts) {
    const snapAccounts = snapData.accounts;
    snapAccounts.forEach(acc => {
      const bInst = (acc.institution_name || acc.brokerage?.name || '').toLowerCase();
      const accName = (acc.name || '').toLowerCase();

      // Filter out duplicate sheet balances
      latestBalances = latestBalances.filter(b => {
        if (b.account_id === acc.id) return false;

        const sheetInst = (b.institution || '').toLowerCase();
        const sheetName = (b.account || '').toLowerCase();

        const instMatch = sheetInst.includes(bInst) || bInst.includes(sheetInst) ||
          (sheetInst.includes('fidelity') && bInst.includes('fidelity')) ||
          (sheetInst.includes('robinhood') && bInst.includes('robinhood')) ||
          (sheetInst.includes('e*trade') && bInst.includes('etrade')) ||
          (sheetInst.includes('etrade') && bInst.includes('etrade')) ||
          (sheetInst.includes('morgan stanley') && bInst.includes('etrade'));

        if (!instMatch) return true;

        // Check account type similarity
        if (sheetName === accName) return false;
        
        if ((accName.includes('401') || accName.includes('retirement') || accName.includes('plan')) && 
            (sheetName.includes('401') || sheetName.includes('retirement') || sheetName.includes('plan'))) {
          return false;
        }
        
        if (accName.includes('roth') && sheetName.includes('roth')) {
          return false;
        }
        
        if (accName.includes('traditional') && sheetName.includes('traditional')) {
          return false;
        }

        const isIndividualSnap = accName.includes('individual') || accName.includes('securities') || accName.includes('brokerage') || accName.includes('cash') || (!accName.includes('roth') && !accName.includes('401'));
        const isIndividualSheet = sheetName.includes('individual') || sheetName.includes('securities') || sheetName.includes('brokerage') || sheetName.includes('cash') || (!sheetName.includes('roth') && !sheetName.includes('401'));
        if (isIndividualSnap && isIndividualSheet) {
          return false;
        }

        if (sheetName.includes(accName) || accName.includes(sheetName)) {
          return false;
        }

        return true;
      });

      // Add the SnapTrade account record
      latestBalances.push({
        id: `snaptrade_${acc.id}`,
        date: new Date().toISOString().split('T')[0],
        institution: acc.institution_name || acc.brokerage?.name || 'Brokerage',
        account: acc.name,
        account_id: acc.id,
        balance: acc.balances?.current || 0,
        class: 'Asset',
        type: 'Investment'
      });
    });
  }

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

    case 'get_brokerage_activities': {
      const { account, since_date, until_date, limit = 50 } = args || {};
      const config = await ensureSnapTradeUser().catch(() => null);
      if (!config || !config.userSecret) {
        return { count: 0, activities: [], message: 'No brokerage integration configured.' };
      }
      const client = getSnapTradeClient();
      if (!client) {
        return { count: 0, activities: [], message: 'SnapTrade client not initialized.' };
      }

      try {
        const accountsResponse = await client.accountInformation.listUserAccounts({
          userId: config.userId,
          userSecret: config.userSecret
        });
        const accounts = accountsResponse.data || [];
        
        let targetAccounts = accounts;
        if (account) {
          targetAccounts = accounts.filter(a => 
            a.id === account || 
            (a.name || '').toLowerCase().includes(account.toLowerCase()) ||
            (a.institution_name || '').toLowerCase().includes(account.toLowerCase())
          );
        }

        const allActivities = [];
        for (const acc of targetAccounts) {
          const params = {
            userId: config.userId,
            userSecret: config.userSecret,
            accountId: acc.id
          };
          if (since_date) params.startDate = since_date;
          if (until_date) params.endDate = until_date;
          
          const actRes = await client.accountInformation.getAccountActivities(params).catch(err => {
            console.warn(`[SnapTrade MCP] Failed to get activities for account ${acc.id}:`, err.message);
            return { data: [] };
          });

          const list = Array.isArray(actRes.data) ? actRes.data : (actRes.data?.activities || []);
          list.forEach(act => {
            allActivities.push({
              ...act,
              account_id: acc.id,
              account_name: acc.name,
              institution_name: acc.institution_name || 'Brokerage'
            });
          });
        }

        // Sort by date descending (trade_date or date)
        allActivities.sort((a, b) => new Date(b.date || b.trade_date || 0) - new Date(a.date || a.trade_date || 0));
        
        const sliced = allActivities.slice(0, limit);
        return {
          count: sliced.length,
          total_available: allActivities.length,
          activities: sliced
        };
      } catch (err) {
        return { error: `Failed to fetch brokerage activities: ${err.message}` };
      }
    }

    case 'get_brokerage_orders': {
      const { account, state = 'all', days = 30 } = args || {};
      const config = await ensureSnapTradeUser().catch(() => null);
      if (!config || !config.userSecret) {
        return { count: 0, orders: [], message: 'No brokerage integration configured.' };
      }
      const client = getSnapTradeClient();
      if (!client) {
        return { count: 0, orders: [], message: 'SnapTrade client not initialized.' };
      }

      try {
        const accountsResponse = await client.accountInformation.listUserAccounts({
          userId: config.userId,
          userSecret: config.userSecret
        });
        const accounts = accountsResponse.data || [];
        
        let targetAccounts = accounts;
        if (account) {
          targetAccounts = accounts.filter(a => 
            a.id === account || 
            (a.name || '').toLowerCase().includes(account.toLowerCase()) ||
            (a.institution_name || '').toLowerCase().includes(account.toLowerCase())
          );
        }

        const allOrders = [];
        for (const acc of targetAccounts) {
          const orderRes = await client.accountInformation.getUserAccountOrders({
            userId: config.userId,
            userSecret: config.userSecret,
            accountId: acc.id,
            state: state,
            days: days
          }).catch(err => {
            console.warn(`[SnapTrade MCP] Failed to get orders for account ${acc.id}:`, err.message);
            return { data: [] };
          });

          const list = Array.isArray(orderRes.data) ? orderRes.data : [];
          list.forEach(ord => {
            allOrders.push({
              ...ord,
              account_id: acc.id,
              account_name: acc.name,
              institution_name: acc.institution_name || 'Brokerage'
            });
          });
        }

        return {
          count: allOrders.length,
          orders: allOrders
        };
      } catch (err) {
        return { error: `Failed to fetch brokerage orders: ${err.message}` };
      }
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
      
      // Synthetic demo fixture — round placeholder values, not real holdings. Only used when FINFLOW_DEMO=1.
      const DEMO_HOLDINGS = [
        { ticker: 'FXAIX', name: 'Fidelity 500 Index Fund', value: 345000, assetClass: 'US Equities', sector: 'Large Blend / Diversified', geography: 'United States' },
        { ticker: 'VTI', name: 'Vanguard Total Stock Market Index Fund ETF', value: 267000, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'Cash', name: 'Cash', value: 63000, assetClass: 'Cash & Equivalents', sector: 'Cash', geography: 'United States' },
        { ticker: 'NT S&P 500 IDX NL 4', name: 'NT S&P 500 Index NL 4', value: 62000, assetClass: 'US Equities', sector: 'Large Blend / Diversified', geography: 'United States' },
        { ticker: 'WEEK', name: 'WEEK ETF', value: 43000, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'ARM', name: 'Arm Holdings plc', value: 41000, assetClass: 'International Equities', sector: 'Semiconductors / Technology', geography: 'United Kingdom' },
        { ticker: 'VXUS', name: 'Vanguard Total International Stock Index Fund ETF', value: 31000, assetClass: 'International Equities', sector: 'Broad International / Diversified', geography: 'Global Ex-US' },
        { ticker: 'VB', name: 'Vanguard Small-Cap Index Fund ETF', value: 29000, assetClass: 'US Equities', sector: 'Small Cap / Diversified', geography: 'United States' },
        { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', value: 18000, assetClass: 'US Equities', sector: 'Large Blend / Diversified', geography: 'United States' },
        { ticker: 'QQQI', name: 'NEOS NASDAQ 100 HIGH INCOME ETF', value: 13000, assetClass: 'US Equities', sector: 'Nasdaq 100 / Technology / Income', geography: 'United States' },
        { ticker: 'SPYI', name: 'Neos S&P 500 High Income ETF', value: 12000, assetClass: 'US Equities', sector: 'Large Blend / Income', geography: 'United States' },
        { ticker: 'W', name: 'Wayfair Inc', value: 8500, assetClass: 'US Equities', sector: 'Consumer Cyclical / E-Commerce', geography: 'United States' },
        { ticker: 'IBIT', name: 'iShares Bitcoin Trust', value: 8400, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin', geography: 'Global' },
        { ticker: 'UTSTX', name: 'Total US Stock Market', value: 7900, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'NFLX', name: 'Netflix Inc', value: 7300, assetClass: 'US Equities', sector: 'Media / Communication Services', geography: 'United States' },
        { ticker: 'VIIIX', name: 'Vanguard Institutional Index Fund', value: 7300, assetClass: 'US Equities', sector: 'Large Blend / Diversified', geography: 'United States' },
        { ticker: 'VIGIX', name: 'Vanguard Growth Index Fund', value: 6900, assetClass: 'US Equities', sector: 'Large Growth / Tech-Leaning', geography: 'United States' },
        { ticker: 'BTCI', name: 'NEOS Bitcoin High Income ETF', value: 5400, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin', geography: 'Global' },
        { ticker: 'INTC', name: 'Intel Corp', value: 5300, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'SOFI', name: 'SoFi Technologies Inc', value: 5200, assetClass: 'US Equities', sector: 'Financial Services / Fintech', geography: 'United States' },
        { ticker: 'VCAIX', name: 'Vanguard California Intermediate-Term Tax-Exempt Fund', value: 4900, assetClass: 'Fixed Income', sector: 'Municipal Bonds', geography: 'United States' },
        { ticker: 'APLD', name: 'Applied Digital Corp', value: 4900, assetClass: 'US Equities', sector: 'Technology Infrastructure / Data Centers', geography: 'United States' },
        { ticker: 'TEM', name: 'Tempus AI Inc Class A', value: 4800, assetClass: 'US Equities', sector: 'Healthcare / Biotechnology / AI', geography: 'United States' },
        { ticker: 'NBIS', name: 'NBIS', value: 3900, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'RVI', name: 'RVI', value: 3900, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'GLXY', name: 'Galaxy Digital Holdings Ltd', value: 3300, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Financial Services', geography: 'Canada' },
        { ticker: 'SGOV', name: 'iShares 0-3 Month Treasury Bond ETF', value: 2900, assetClass: 'Fixed Income', sector: 'Government / Short-Term Treasuries', geography: 'United States' },
        { ticker: 'SIVEF', name: 'Sivers Semiconductors AB', value: 2800, assetClass: 'International Equities', sector: 'Semiconductors / Technology', geography: 'Sweden' },
        { ticker: 'DRAM', name: 'Roundhill Memory ETF', value: 2800, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'Global' },
        { ticker: 'IBM', name: 'International Business Machines Corp', value: 2600, assetClass: 'US Equities', sector: 'Information Technology Services', geography: 'United States' },
        { ticker: 'GEV', name: 'GE Vernova Inc', value: 2600, assetClass: 'US Equities', sector: 'Industrials / Clean Energy', geography: 'United States' },
        { ticker: 'CRDO', name: 'Credo Technology Group', value: 2500, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'AMD', name: 'Advanced Micro Devices Inc', value: 2400, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'USAR', name: 'USA Restaurant Funding Inc', value: 2300, assetClass: 'US Equities', sector: 'Consumer Cyclical / Restaurants', geography: 'United States' },
        { ticker: 'Cash 2', name: 'Cash', value: 2300, assetClass: 'Cash & Equivalents', sector: 'Cash', geography: 'United States' },
        { ticker: 'GLD', name: 'SPDR Gold Trust', value: 1900, assetClass: 'Alternatives (Commodities)', sector: 'Precious Metals / Gold', geography: 'Global' },
        { ticker: 'COHR', name: 'Coherent Corp', value: 1900, assetClass: 'US Equities', sector: 'Technology / Photonics', geography: 'United States' },
        { ticker: 'SG', name: 'Sweetgreen Inc', value: 1700, assetClass: 'US Equities', sector: 'Consumer Cyclical / Restaurants', geography: 'United States' },
        { ticker: 'IQEPY', name: 'IQE PLC', value: 1600, assetClass: 'International Equities', sector: 'Semiconductors / Tech', geography: 'United Kingdom' },
        { ticker: 'INFQ', name: 'Churchill Capital Corp X', value: 1600, assetClass: 'US Equities', sector: 'Financial Services / SPAC', geography: 'United States' },
        { ticker: 'AMZN', name: 'Amazon.com Inc', value: 1500, assetClass: 'US Equities', sector: 'Consumer Cyclical / Retail / Cloud', geography: 'United States' },
        { ticker: 'GOOGL', name: 'Alphabet Inc', value: 1500, assetClass: 'US Equities', sector: 'Interactive Media / Tech', geography: 'United States' },
        { ticker: 'RIVN', name: 'Rivian Automotive Inc', value: 1500, assetClass: 'US Equities', sector: 'Consumer Cyclical / Auto Manufacturers', geography: 'United States' },
        { ticker: 'JD', name: 'JD.com Inc', value: 1300, assetClass: 'International Equities', sector: 'Consumer Cyclical / E-Commerce', geography: 'China' },
        { ticker: 'SMCX', name: 'SMCX', value: 1300, assetClass: 'US Equities', sector: 'Broad Market / Diversified', geography: 'United States' },
        { ticker: 'ETHA', name: 'iShares Ethereum Trust', value: 1300, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Ethereum', geography: 'Global' },
        { ticker: 'NXT', name: 'Next PLC', value: 1300, assetClass: 'International Equities', sector: 'Consumer Cyclical / Retail', geography: 'United Kingdom' },
        { ticker: 'NVDA', name: 'NVIDIA Corp', value: 1200, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'ANET', name: 'Arista Networks Inc', value: 1200, assetClass: 'US Equities', sector: 'Technology / Networking Infrastructure', geography: 'United States' },
        { ticker: 'OKLO', name: 'Oklo Inc', value: 1200, assetClass: 'US Equities', sector: 'Utilities / Clean Energy / Nuclear', geography: 'United States' },
        { ticker: 'BE', name: 'Bloom Energy Corp', value: 1100, assetClass: 'US Equities', sector: 'Industrials / Clean Energy', geography: 'United States' },
        { ticker: 'SNDK', name: 'SanDisk Corp', value: 1100, assetClass: 'US Equities', sector: 'Technology / Storage', geography: 'United States' },
        { ticker: 'JBL', name: 'Jabil Inc', value: 1100, assetClass: 'US Equities', sector: 'Technology Hardware / Manufacturing', geography: 'United States' },
        { ticker: 'SLV', name: 'iShares Silver Trust', value: 1100, assetClass: 'Alternatives (Commodities)', sector: 'Precious Metals / Silver', geography: 'Global' },
        { ticker: 'ALAB', name: 'Astera Labs Inc', value: 1000, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'AVGO', name: 'Broadcom Inc', value: 1000, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'CAT', name: 'Caterpillar Inc', value: 1000, assetClass: 'US Equities', sector: 'Industrials / Machinery', geography: 'United States' },
        { ticker: 'IREN', name: 'Iris Energy Ltd', value: 1000, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'Australia' },
        { ticker: 'CENX', name: 'Century Aluminum Co', value: 900, assetClass: 'US Equities', sector: 'Basic Materials / Aluminum', geography: 'United States' },
        { ticker: 'AAOI', name: 'Applied Optoelectronics Inc', value: 900, assetClass: 'US Equities', sector: 'Technology / Fiber Optics', geography: 'United States' },
        { ticker: 'TER', name: 'Teradyne Inc', value: 900, assetClass: 'US Equities', sector: 'Technology Hardware / Test Equipment', geography: 'United States' },
        { ticker: 'AOSL', name: 'Alpha and Omega Semiconductor Ltd', value: 900, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'VIAV', name: 'Viavi Solutions Inc', value: 700, assetClass: 'US Equities', sector: 'Technology / Telecommunications', geography: 'United States' },
        { ticker: 'LITE', name: 'Lumentum Holdings Inc', value: 700, assetClass: 'US Equities', sector: 'Technology / Photonics', geography: 'United States' },
        { ticker: 'SOUN', name: 'SoundHound AI Inc', value: 700, assetClass: 'US Equities', sector: 'Technology / AI / Software', geography: 'United States' },
        { ticker: 'VBMPX', name: 'Vanguard Total Bond Market Index Fund', value: 700, assetClass: 'Fixed Income', sector: 'Broad Bond Market', geography: 'United States' },
        { ticker: 'GRCV', name: 'Grand Capital Ventures Inc', value: 700, assetClass: 'US Equities', sector: 'Financial Services', geography: 'United States' },
        { ticker: 'EOSE', name: 'Eos Energy Enterprises Inc', value: 600, assetClass: 'US Equities', sector: 'Technology / Energy Storage', geography: 'United States' },
        { ticker: 'SERV', name: 'Serve Robotics Inc', value: 600, assetClass: 'US Equities', sector: 'Technology / Robotics', geography: 'United States' },
        { ticker: 'HIMS', name: 'Hims & Hers Health Inc', value: 600, assetClass: 'US Equities', sector: 'Healthcare / Wellness', geography: 'United States' },
        { ticker: 'MSFT', name: 'Microsoft Corp', value: 600, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'PANW', name: 'Palo Alto Networks Inc', value: 600, assetClass: 'US Equities', sector: 'Technology / Cybersecurity', geography: 'United States' },
        { ticker: 'TSEM', name: 'Tower Semiconductor Ltd', value: 500, assetClass: 'International Equities', sector: 'Semiconductors / Technology', geography: 'Israel' },
        { ticker: 'CIFR', name: 'Cipher Mining Inc', value: 500, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'United States' },
        { ticker: 'CORZ', name: 'Core Scientific Inc', value: 500, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'United States' },
        { ticker: 'META', name: 'Meta Platforms Inc', value: 500, assetClass: 'US Equities', sector: 'Interactive Media / Tech', geography: 'United States' },
        { ticker: 'GPDNF', name: 'Danone SA', value: 400, assetClass: 'International Equities', sector: 'Consumer Defensive / Food', geography: 'France' },
        { ticker: 'APM', name: 'Aptorum Group Ltd', value: 400, assetClass: 'International Equities', sector: 'Healthcare / Biotechnology', geography: 'Hong Kong' },
        { ticker: 'TEM 2', name: 'Tempus AI Inc Class A', value: 400, assetClass: 'US Equities', sector: 'Healthcare / Biotechnology / AI', geography: 'United States' },
        { ticker: 'ELV', name: 'SPDR DJ Wilshire Large Cap Value ETF', value: 400, assetClass: 'US Equities', sector: 'Large Value / Diversified', geography: 'United States' },
        { ticker: 'LLY', name: 'Eli Lilly and Co', value: 400, assetClass: 'US Equities', sector: 'Healthcare / Pharmaceuticals', geography: 'United States' },
        { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc', value: 400, assetClass: 'US Equities', sector: 'Financial Services / Conglomerate', geography: 'United States' },
        { ticker: 'WULF', name: 'TeraWulf Inc', value: 400, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'United States' },
        { ticker: 'CRWD', name: 'CrowdStrike Holdings Inc', value: 300, assetClass: 'US Equities', sector: 'Technology / Cybersecurity', geography: 'United States' },
        { ticker: 'VST', name: 'Vistra Corp', value: 300, assetClass: 'US Equities', sector: 'Utilities / Power Generation', geography: 'United States' },
        { ticker: 'CIEN', name: 'Ciena Corp', value: 300, assetClass: 'US Equities', sector: 'Technology / Networking', geography: 'United States' },
        { ticker: 'AEHR', name: 'Aehr Test Systems', value: 300, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'SPGI', name: 'S&P Global Inc', value: 300, assetClass: 'US Equities', sector: 'Financial Services / Information', geography: 'United States' },
        { ticker: 'PR', name: 'Permian Resources Corp', value: 300, assetClass: 'US Equities', sector: 'Energy / Oil & Gas', geography: 'United States' },
        { ticker: 'NOW', name: 'ServiceNow Inc', value: 300, assetClass: 'US Equities', sector: 'Technology / Software', geography: 'United States' },
        { ticker: 'SCHO', name: 'Schwab Short-Term U.S. Treasury ETF', value: 300, assetClass: 'Fixed Income', sector: 'Government / Short-Term Treasuries', geography: 'United States' },
        { ticker: 'NOK', name: 'Nokia Oyj', value: 300, assetClass: 'International Equities', sector: 'Technology / Telecommunications', geography: 'Finland' },
        { ticker: 'PLTR', name: 'Palantir Technologies Inc', value: 200, assetClass: 'US Equities', sector: 'Technology / AI / Software', geography: 'United States' },
        { ticker: 'AAPL', name: 'Apple Inc', value: 200, assetClass: 'US Equities', sector: 'Technology / Consumer Electronics', geography: 'United States' },
        { ticker: 'GRAB', name: 'Grab Holdings Ltd', value: 200, assetClass: 'International Equities', sector: 'Technology / Super-app', geography: 'Singapore' },
        { ticker: 'MELI', name: 'MercadoLibre Inc', value: 200, assetClass: 'International Equities', sector: 'Consumer Cyclical / E-Commerce', geography: 'Latin America' },
        { ticker: 'LHX', name: 'L3Harris Technologies Inc', value: 200, assetClass: 'US Equities', sector: 'Industrials / Aerospace & Defense', geography: 'United States' },
        { ticker: 'RIOT', name: 'Riot Platforms Inc', value: 200, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'United States' },
        { ticker: 'NVDS', name: 'AXS 1.25X NVDA Bear Daily ETF', value: 200, assetClass: 'Alternatives (Trading)', sector: 'Inverse Equity / Trading', geography: 'United States' },
        { ticker: 'IBP', name: 'Installed Building Products Inc', value: 200, assetClass: 'US Equities', sector: 'Industrials / Homebuilding', geography: 'United States' },
        { ticker: 'SPCK', name: 'SPAC and New Issue ETF', value: 200, assetClass: 'US Equities', sector: 'Financial Services / SPAC', geography: 'United States' },
        { ticker: 'MNST.o', name: 'Monster Beverage Call Option', value: 200, assetClass: 'Alternatives (Options)', sector: 'Derivatives / Beverage', geography: 'United States' },
        { ticker: 'AMAT', name: 'Applied Materials Inc', value: 100, assetClass: 'US Equities', sector: 'Semiconductors / Technology', geography: 'United States' },
        { ticker: 'CDE', name: 'Coeur Mining Inc', value: 100, assetClass: 'US Equities', sector: 'Basic Materials / Silver & Gold Mining', geography: 'United States' },
        { ticker: 'HL', name: 'Hecla Mining Co', value: 100, assetClass: 'US Equities', sector: 'Basic Materials / Silver & Gold Mining', geography: 'United States' },
        { ticker: 'CLSK', name: 'CleanSpark Inc', value: 100, assetClass: 'Alternatives (Crypto/Crypto-related)', sector: 'Cryptocurrency / Bitcoin Mining', geography: 'United States' }
      ];

      let holdingsList = [];
      let isMock = false;
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

      if (!snapData && process.env.FINFLOW_DEMO === '1') {
        holdingsList = DEMO_HOLDINGS;
        isMock = true;
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
        is_mock: isMock,
        total_investment_value: totalVal,
        allocation_by_class: getPercentages(classMap),
        allocation_by_sector: getPercentages(sectorMap),
        allocation_by_geography: getPercentages(geoMap),
        holdings: holdingsList.map(h => ({
          is_mock: isMock,
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
            protocolVersion: '2025-03-26',
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

function getSnapTradeErrorMessage() {
  return 'SnapTrade request failed. Check the server configuration and try again.';
}

// SnapTrade identity is owned by the server; request credentials never override it.
function getSnapTradeClientAndConfig() {
  const effective = loadSnapTradeConfig();
  const principalKey = createHash('sha256').update(JSON.stringify([MCP_SECRET, effective])).digest('hex');
  return {
    client: getSnapTradeClient(effective),
    config: { userId: effective.userId, userSecret: effective.userSecret, principalKey }
  };
}

function snapTradeMetadata(config) {
  return { hasUserSecret: !!config?.userSecret && !config.userSecret.includes('mock') };
}

async function ensureSnapTradeUserForClient(client, config) {
  return config || { userId: '', userSecret: '' };
}

function authenticateAdmin(req, res, next) {
  if (!FINFLOW_ADMIN_SECRET || FINFLOW_ADMIN_SECRET === MCP_SECRET) {
    return res.status(503).json({ error: 'Admin operations disabled: configure a distinct FINFLOW_ADMIN_SECRET.' });
  }
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1] || '';
  const actual = Buffer.from(token);
  const expected = Buffer.from(FINFLOW_ADMIN_SECRET);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return res.status(401).json({ error: 'A valid admin Bearer credential is required.' });
  }
  next();
}

async function handleRegisterSnapTradeUser(req, res) {
  try {
    const effective = loadSnapTradeConfig();
    if (effective.userSecret || process.env.SNAPTRADE_USER_SECRET !== undefined) {
      return res.status(409).json({ error: 'Identity already provisioned or user secret managed by environment.' });
    }
    const client = getSnapTradeClient(effective);
    if (!client) return res.status(409).json({ error: 'SnapTrade client is not configured.' });
    const userId = effective.userId || `finflow_${randomUUID()}`;
    const response = await client.authentication.registerSnapTradeUser({ userId });
    if (!response.data?.userSecret) throw new Error('Registration returned no secret');
    saveSnapTradeConfig({ ...effective, userId, userSecret: response.data.userSecret });
    res.json({ success: true, hasUserSecret: true });
  } catch {
    res.status(500).json({ error: getSnapTradeErrorMessage() });
  }
}

// ─── SnapTrade HTTP Route Handlers ────────────────────────────────────────────
async function handleSaveConfig(req, res) {
  try {
    const { clientId, consumerKey } = req.body;
    if (!clientId || !consumerKey) {
      return res.status(400).json({ error: 'Missing clientId or consumerKey' });
    }
    const { userId = '', userSecret = '' } = req.body;
    if (![clientId, consumerKey, userId, userSecret].every(value => typeof value === 'string')) {
      return res.status(400).json({ error: 'Credentials must be strings.' });
    }
    saveSnapTradeConfig({ snaptradeClientId: clientId, snaptradeConsumerKey: consumerKey, userId, userSecret });
    const { client, config } = getSnapTradeClientAndConfig();

    res.json({ 
      success: true, 
      configured: !!client && !!config.userId && !!config.userSecret,
      connected: false,
      ...snapTradeMetadata(config)
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
    if (!client || !finalConfig.userId || !finalConfig.userSecret || finalConfig.userSecret.includes('mock')) {
      return res.status(409).json({ configured: false, error: 'SnapTrade is not configured: provision a user ID and user secret.' });
    }
    const response = await client.authentication.login({
      userId: finalConfig.userId,
      userSecret: finalConfig.userSecret
    });
    res.json({ 
      redirectURI: typeof response.data === 'string' ? response.data : response.data?.redirectURI,
      ...snapTradeMetadata(finalConfig)
    });
  } catch (err) {
    const errMsg = getSnapTradeErrorMessage(err);
    console.error(`[SnapTrade] Error creating portal url:`, errMsg);
    res.status(500).json({ error: errMsg });
  }
}

async function handleSnapTradeStatus(req, res) {
  const forceRefresh = req.query.force === 'true';
  try {
    const { client, config } = getSnapTradeClientAndConfig(req);
    const finalConfig = await ensureSnapTradeUserForClient(client, config);
    const configured = !!client && !!finalConfig.userId && !!finalConfig.userSecret;

    if (!client || !finalConfig.userId || !finalConfig.userSecret || finalConfig.userSecret.includes('mock')) {
      return res.json({
        configured,
        connected: false,
        connections: [],
        ...snapTradeMetadata(finalConfig)
      });
    }

    const statusCacheFile = getUserStatusCacheFilePath(finalConfig.principalKey);
    const CACHE_STATUS_TTL_MS = 15 * 60 * 1000; // 15 minutes

    if (!forceRefresh && fs.existsSync(statusCacheFile)) {
      try {
        const cache = readSnapTradeCache(statusCacheFile);
        if (Date.now() - cache.timestamp < CACHE_STATUS_TTL_MS) {
          console.log(`[SnapTrade Cache] Returning cached status for user ${finalConfig.userId}.`);
          return res.json({
            configured,
            connected: !!cache.data.connected,
            connections: cache.data.connections || [],
            account_count: cache.data.account_count,
            ...snapTradeMetadata(finalConfig)
          });
        }
      } catch (err) {
        console.error(`[SnapTrade Cache] Error loading status cache:`);
      }
    }

    const response = await client.accountInformation.listUserAccounts({
      userId: finalConfig.userId,
      userSecret: finalConfig.userSecret
    });

    const accounts = response.data || [];
    const connections = buildConnectionSummaries(accounts);

    const statusResult = {
      configured,
      connected: connections.length > 0,
      connections,
      account_count: accounts.length,
      ...snapTradeMetadata(finalConfig)
    };

    // Save to status cache
    try {
      atomicWriteJson(statusCacheFile, scrubSnapTradeCache({
        timestamp: Date.now(),
        data: statusResult
      }));
    } catch (err) {
      console.error(`[SnapTrade Cache] Error saving status cache:`);
    }

    res.json(scrubSnapTradeCache(statusResult));
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
    const result = await fetchNormalizedSnapTradeHoldings(client, finalConfig, forceRefresh);
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
    if (!authorizationId && (process.env.SNAPTRADE_USER_ID !== undefined || process.env.SNAPTRADE_USER_SECRET !== undefined)) {
      return res.status(409).json({ error: 'Identity is managed by environment; remove it from the server environment before deletion.' });
    }
    const { client, config } = getSnapTradeClientAndConfig(req);
    
    if (config) {
      if (authorizationId) {
        if (client && config.userSecret && !config.userSecret.includes('mock')) {
          await client.connections.removeBrokerageAuthorization({
            authorizationId,
            userId: config.userId,
            userSecret: config.userSecret
          });
          console.log(`[SnapTrade] Connection ${authorizationId} removed.`);
          
          const userCacheFile = getUserCacheFilePath(config.principalKey);
          if (fs.existsSync(userCacheFile)) {
            fs.unlinkSync(userCacheFile);
          }
          const userStatusCacheFile = getUserStatusCacheFilePath(config.principalKey);
          if (fs.existsSync(userStatusCacheFile)) {
            fs.unlinkSync(userStatusCacheFile);
          }
        }
      } else {
        if (client && config.userSecret && !config.userSecret.includes('mock')) {
          await client.authentication.deleteSnapTradeUser({
            userId: config.userId
          });
        }
        for (const cacheFile of [getUserCacheFilePath(config.principalKey), getUserStatusCacheFilePath(config.principalKey)]) {
          if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
        }
        if (fs.existsSync(CONFIG_FILE_PATH)) {
          fs.unlinkSync(CONFIG_FILE_PATH);
        }
        if (fs.existsSync(HOLDINGS_CACHE_FILE)) {
          fs.unlinkSync(HOLDINGS_CACHE_FILE);
        }
        // Reset global credentials
        snaptradeClientKey = '';
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

async function handleClearSnapTradeCache(req, res) {
  try {
    const { client, config } = getSnapTradeClientAndConfig(req);
    let clearedCount = 0;
    if (config && config.userId) {
      const userCacheFile = getUserCacheFilePath(config.principalKey);
      if (fs.existsSync(userCacheFile)) {
        fs.unlinkSync(userCacheFile);
        clearedCount++;
      }
      const userStatusCacheFile = getUserStatusCacheFilePath(config.principalKey);
      if (fs.existsSync(userStatusCacheFile)) {
        fs.unlinkSync(userStatusCacheFile);
        clearedCount++;
      }
      console.log(`[SnapTrade Cache] Cleared cache files for user ${config.userId}`);
    }
    if (fs.existsSync(HOLDINGS_CACHE_FILE)) {
      fs.unlinkSync(HOLDINGS_CACHE_FILE);
      clearedCount++;
    }
    res.json({ success: true, clearedCount, message: 'SnapTrade holdings cache cleared successfully.' });
  } catch (err) {
    const errMsg = getSnapTradeErrorMessage(err);
    console.error(`[SnapTrade] Error clearing holdings cache:`, errMsg);
    res.status(500).json({ error: errMsg });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// SnapTrade endpoints
app.post('/api/snaptrade/register', authenticateAdmin, handleRegisterSnapTradeUser);
app.post('/:secretPrefix/api/snaptrade/register', authenticateAdmin, handleRegisterSnapTradeUser);
app.post('/api/snaptrade/config', authenticateAdmin, handleSaveConfig);
app.post('/:secretPrefix/api/snaptrade/config', authenticateAdmin, handleSaveConfig);

app.post('/api/snaptrade/create_portal_url', authenticate, handleCreatePortalUrl);
app.post('/:secretPrefix/api/snaptrade/create_portal_url', authenticate, handleCreatePortalUrl);

app.get('/api/snaptrade/status', authenticate, handleSnapTradeStatus);
app.get('/:secretPrefix/api/snaptrade/status', authenticate, handleSnapTradeStatus);

app.get('/api/snaptrade/holdings', authenticate, handleGetSnapTradeHoldings);
app.get('/:secretPrefix/api/snaptrade/holdings', authenticate, handleGetSnapTradeHoldings);

app.post('/api/snaptrade/disconnect', authenticateAdmin, handleSnapTradeDisconnect);
app.post('/:secretPrefix/api/snaptrade/disconnect', authenticateAdmin, handleSnapTradeDisconnect);

app.post('/api/snaptrade/clear_cache', authenticate, handleClearSnapTradeCache);
app.post('/:secretPrefix/api/snaptrade/clear_cache', authenticate, handleClearSnapTradeCache);


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

// ─── Streamable HTTP MCP transport ───────────────────────────────────────────
// Modern remote clients (including Gemini's URL-only MCP connector) use one
// JSON-RPC endpoint instead of the legacy SSE /sse -> /message handshake.
async function handleStreamableMcp(req, res) {
  const accept = req.headers.accept || '';
  if (!accept.includes('application/json') && !accept.includes('text/event-stream') && accept !== '*/*') {
    return res.status(406).json({ error: 'MCP clients must accept application/json or text/event-stream.' });
  }

  const responsePayload = await handleJsonRpc(req.body);
  if (!responsePayload) {
    return res.status(202).end();
  }

  res.set('Content-Type', 'application/json');
  return res.status(200).json(responsePayload);
}

function methodNotAllowedForMcp(req, res) {
  res.set('Allow', 'POST');
  return res.status(405).json({ error: 'Use POST with a JSON-RPC MCP request.' });
}

app.post('/mcp', authenticate, handleStreamableMcp);
app.post('/:secretPrefix/mcp', authenticate, handleStreamableMcp);
app.get('/mcp', authenticate, methodNotAllowedForMcp);
app.get('/:secretPrefix/mcp', authenticate, methodNotAllowedForMcp);
app.delete('/mcp', authenticate, methodNotAllowedForMcp);
app.delete('/:secretPrefix/mcp', authenticate, methodNotAllowedForMcp);

// ─── Standard MCP SSE (Server-Sent Events) Transport Endpoints ────────────────

function handleSseConnection(req, res) {
  const { secretPrefix } = req.params;


  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive'
  });

  const sessionId = randomUUID();
  sseConnections.set(sessionId, { response: res, principal: req.authPrincipal });

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
  const clientRes = req.sseResponse;

  const payload = req.body;
  const responsePayload = await handleJsonRpc(payload);
  
  if (responsePayload) {
    clientRes.write(`event: message\ndata: ${JSON.stringify(responsePayload)}\n\n`);
  }

  res.status(202).end();
}

app.get('/sse', authenticate, handleSseConnection);
app.get('/:secretPrefix/sse', authenticate, handleSseConnection);
app.post('/message', authenticate, requireSseSession(sseConnections), handlePostMessage);
app.post('/:secretPrefix/message', authenticate, requireSseSession(sseConnections), handlePostMessage);

// Check if an IP address is private/local (RFC1918, loopbacks, etc.)
function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
  }
  const ipv6Lower = ip.toLowerCase();
  if (ipv6Lower === '::1' || ipv6Lower === '0:0:0:0:0:0:0:1') return true;
  if (ipv6Lower.startsWith('fc00:') || ipv6Lower.startsWith('fd00:')) return true;
  if (ipv6Lower.startsWith('fe80:')) return true;
  return false;
}

// Perform safe DNS lookup check
async function resolveHostAndCheck(hostname) {
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  const ipv6Regex = /^[:0-9a-fA-F]+$/;
  if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
    return isPrivateIp(hostname);
  }
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        return true;
      }
    }
  } catch (err) {
    return true; // Treat failures as unsafe
  }
  return false;
}

// Generic Proxy endpoint to bypass browser CORS (e.g. OpenAI/Anthropic/DeepSeek)
async function handleProxyCall(req, res) {
  // Proxy access always requires a configured credential, including in dev-open mode.
  let authenticated = false;
  if (!MCP_SECRET) return res.status(401).json({ error: 'Proxy authentication required' });
  authenticate(req, res, () => { authenticated = true; });
  if (!authenticated) return;
  const { url, headers, method, body } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'Missing target url parameter in proxy request.' });
  }

  // SSRF Loopback/Private network protection
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();
    if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password ||
        (parsedUrl.port && parsedUrl.port !== '443') ||
        !['api.openai.com', 'api.anthropic.com', 'api.deepseek.com'].includes(host)) {
      return res.status(403).json({ error: 'Proxy target is not allowed' });
    }
    
    const isUnsafe = await resolveHostAndCheck(host);
    if (isUnsafe) {
      return res.status(403).json({ error: 'Forbidden: Proxy call to local or private addresses is blocked for security reasons.' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid URL format provided to proxy.' });
  }


  try {
    const response = await fetch(url, {
      method: method || 'POST',
      headers: headers || {},
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      redirect: 'manual'
    });

    // Copy original status
    res.status(response.status);
    
    // Copy headers back to client, filtering safety headers
    for (const [key, val] of response.headers.entries()) {
      if (!['content-encoding', 'transfer-encoding', 'cache-control', 'pragma'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('event-stream')) {
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


// Keep the generic health route after every specific route.
app.get('/:secretPrefix', handleHealthCheck);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`\n🚀 FinFlow MCP Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/`);
  console.log(`   Tools:  http://localhost:${PORT}/tools`);
  console.log(`   SSE:    http://localhost:${PORT}/sse`);
  if (MCP_SECRET) {
    console.log(`   Auth:   Bearer token configured ✓`);
  } else {
    console.log(`   Auth:   ⚠️  FINFLOW_DEV_OPEN=1 — open access on 127.0.0.1`);
  }
  if (!SHEETS_API_URL) {
    console.log(`   Data:   ⚠️  No SHEETS_API_URL set — tool calls will fail`);
  } else {
    console.log(`   Data:   Google Sheets URL configured ✓`);
  }
  console.log('');
});
