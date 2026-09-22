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
   - `SHEETS_API_SECRET` = the real `ACCESS_SECRET` configured in `tiller-apps-script.js`. Unset or placeholder Apps Script secrets deny all requests. Existing URL query parameters are preserved; this variable overrides a `secret` already in `SHEETS_API_URL`.
   - `MCP_SECRET` = a random secret token you choose (e.g. `finflow_abc123xyz`)
6. Deploy! Your MCP server will be at `https://your-service.onrender.com`

---

## 🤖 Connect to Claude Desktop

1. Open Claude Desktop
2. Go to **Settings → MCP Servers → Add Server**
3. For a legacy SSE-capable client, enter:
   ```json
   {
     "name": "FinFlow",
     "url": "https://your-service.onrender.com/sse",
     "headers": {
       "Authorization": "Bearer YOUR_MCP_SECRET"
     }
   }
   ```
4. Save and restart Claude Desktop

### URL-only remote clients

Modern remote clients that accept a single MCP URL should use the Streamable HTTP endpoint:

```
https://your-service.onrender.com/YOUR_MCP_SECRET/mcp
```

The URL-prefixed secret is a compatibility fallback for clients that cannot send an
`Authorization` header. Treat it as sensitive: it can appear in client history and
provider logs. Prefer Bearer or OAuth authentication whenever the client supports it.

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
SHEETS_API_URL="https://script.google.com/macros/s/.../exec" SHEETS_API_SECRET="your-configured-access-secret" MCP_SECRET="test123" npm start
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
- The server caches sheet data in memory and SnapTrade holdings/status on disk. Protect the server filesystem.
- Your Google Apps Script URL is protected on the server via environment variable (not exposed to clients)

## SnapTrade credentials and administration

Provision the identity entirely on the server using `SNAPTRADE_CLIENT_ID`,
`SNAPTRADE_CONSUMER_KEY`, `SNAPTRADE_USER_ID`, and `SNAPTRADE_USER_SECRET`.
Each environment variable overrides its corresponding value in
`mcp-server/snaptrade_config.json` (**env > file**), including an explicitly empty
variable. File fields are `snaptradeClientId`, `snaptradeConsumerKey`, `userId`, and
`userSecret`. Request headers and read-request bodies cannot override this identity.
Missing user credentials leave SnapTrade unconfigured; status and portal reads
never list users, register users, or reset secrets.

Set `FINFLOW_ADMIN_SECRET` to a separate random secret, distinct from `MCP_SECRET`.
Startup rejects equal secrets and logs whether administration is enabled without
logging either value. If the admin secret is unset, destructive operations are
disabled, including in development open mode.

These POST routes require `Authorization: Bearer <FINFLOW_ADMIN_SECRET>`:

- `/api/snaptrade/config`: atomically replaces the file with `clientId`,
  `consumerKey`, and optional `userId` / `userSecret` from the JSON body. Omitted
  user credentials are cleared. Environment overrides still apply. This does not
  register a user automatically.
- `/api/snaptrade/register`: explicitly registers the effective server user ID
  (or a generated ID if absent) and saves the returned secret. An existing secret
  or an environment-managed user secret prevents registration. Existing users
  are never discovered or reset automatically.
- `/api/snaptrade/disconnect`: removes the specified `authorizationId`, or deletes
  the user and local configuration when omitted. Full deletion refuses an
  environment-managed user identity; remove the user environment variables first.

The `/:secretPrefix` variants require the same admin Bearer header; a URL secret
or the read-only MCP token cannot authorize these operations. Keep the admin
secret out of MCP client configurations.

Config reads do not create or modify files. Config and cache writes use a new
same-directory temporary file with mode `0600`, followed by an atomic rename.
SnapTrade caches use a SHA-256 hash of the server MCP credential and effective
SnapTrade identity, so credential changes select a different cache namespace.
This single-tenant server uses the same server identity for REST and MCP sessions.
Legacy user-ID/global caches are not reused. Reused cache payloads are recursively
scrubbed of credential fields and rewritten when needed; new cache writes are
scrubbed before persistence.
