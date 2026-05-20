# FinFlow MCP Server

Exposes your Google Sheets financial data as **MCP tools** callable by Claude Desktop, Cursor, Zed, or any MCP-compatible AI assistant.

---

## 🔧 Available Tools

| Tool | Description |
|------|-------------|
| `get_summary` | Net worth, assets, liabilities, monthly spend vs. budget |
| `get_transactions` | Transactions filtered by account, category, date, type |
| `get_budgets` | Budget limits + actual spend + % used per category |
| `get_accounts` | All accounts with balances, types, and institution |

---

## 🚀 Deploy to Render.com (Free)

1. Push the `mcp-server/` folder to a GitHub repository (or use the existing `TMTrevisan/finflow` repo)
2. Go to [render.com](https://render.com) → New → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Root Directory:** `mcp-server`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node 18+
5. Add **Environment Variables:**
   - `SHEETS_API_URL` = your Google Apps Script URL (e.g. `https://script.google.com/macros/s/.../exec`)
   - `MCP_SECRET` = a random secret token you choose (e.g. `finflow_abc123xyz`)
6. Deploy! Your MCP server will be at `https://your-service.onrender.com`

---

## 🤖 Connect to Claude Desktop

1. Open Claude Desktop
2. Go to **Settings → MCP Servers → Add Server**
3. Enter:
   ```json
   {
     "name": "FinFlow",
     "url": "https://your-service.onrender.com",
     "headers": {
       "Authorization": "Bearer YOUR_MCP_SECRET"
     }
   }
   ```
4. Save and restart Claude Desktop

Now you can ask Claude:
> *"How much did I spend on dining last month?"*  
> *"Am I over budget on groceries?"*  
> *"What are my 5 largest transactions this year?"*  
> *"What is my current net worth?"*

---

## 💻 Run Locally (Testing)

```bash
cd mcp-server
npm install
SHEETS_API_URL="https://script.google.com/macros/s/.../exec" MCP_SECRET="test123" npm start
```

Then test the tools:
```bash
# Health check
curl http://localhost:3001/

# List tools
curl -H "Authorization: Bearer test123" http://localhost:3001/tools

# Get financial summary
curl -X POST -H "Authorization: Bearer test123" -H "Content-Type: application/json" \
  http://localhost:3001/tools/get_summary

# Get transactions (last 30 days, dining category)
curl -X POST -H "Authorization: Bearer test123" -H "Content-Type: application/json" \
  -d '{"category": "Dining", "since_date": "2025-04-01", "limit": 20}' \
  http://localhost:3001/tools/get_transactions

# Get over-budget categories only
curl -X POST -H "Authorization: Bearer test123" -H "Content-Type: application/json" \
  -d '{"over_budget_only": true}' \
  http://localhost:3001/tools/get_budgets
```

---

## 🔒 Security Notes

- The `MCP_SECRET` Bearer token protects all tool endpoints
- Only you have the token, so only you can query your data
- The server does NOT store any financial data — it fetches live from your Google Sheet on every request
- Your Google Apps Script URL is protected on the server via environment variable (not exposed to clients)
