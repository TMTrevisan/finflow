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

// ─── Fetch Data from Google Sheets ───────────────────────────────────────────
async function fetchSheetData() {
  if (!SHEETS_API_URL) {
    throw new Error('SHEETS_API_URL environment variable not set. Configure your Google Apps Script URL.');
  }
  const response = await fetch(`${SHEETS_API_URL}?action=getData`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet data: ${response.status} ${response.statusText}`);
  }
  return response.json();
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
        type: { type: 'string', enum: ['Income', 'Expense'], description: 'Filter by transaction type' },
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
  }
];

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

      // Current month spend
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

      // Current month spend per category
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

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
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

  // Send standard MCP SSE endpoint announcement
  const messagePath = secretPrefix
    ? `/${secretPrefix}/message?sessionId=${sessionId}`
    : `/message?sessionId=${sessionId}`;
    
  res.write(`event: endpoint\ndata: ${messagePath}\n\n`);

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
