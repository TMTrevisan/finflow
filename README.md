# FinFlow - Personal Finance Dashboard & MCP Server

FinFlow is a modern, high-performance personal finance dashboard and AI agent companion. It aggregates transactional, budgeting, and holdings data directly from **Tiller Sheets** (via a custom Google Apps Script Web App gateway) and brokerages (via **SnapTrade**).

Additionally, it functions as a **Model Context Protocol (MCP)** server, enabling local AI models (such as Claude Desktop, Cursor, Grok, etc.) to query and update your financial data.

---

## Architecture Overview

```mermaid
graph TD
  Bank[Bank feeds & Brokerages] -->|Sync| Tiller[Tiller Google Sheet]
  Tiller -->|Google Apps Script Web App| Gateway[API Gateway Web App]
  Gateway -->|GET /api/data| Backend[Render-Hosted Express Server]
  Brokerage[Fidelity/Robinhood/etc] -->|Oauth Connection| SnapTrade[SnapTrade Portal API]
  SnapTrade -->|Sync Positions & Balances| Backend
  Backend -->|Local Storage Cache Sync| Dashboard[FinFlow React Dashboard]
  Backend -->|JSON-RPC SSE| AI[AI Agent / Claude Desktop / Cursor]
```

---

## 1. Google Sheets & Tiller Configuration

### Connect Bank Feeds
1. Sign up for a [Tiller Money](https://www.tillermoney.com/) account.
2. Link your bank accounts to a Tiller-configured Google Spreadsheet using the Tiller Money Feeds add-on.

### Install the Gateway Script
1. Open your Tiller Google Spreadsheet.
2. In the menu, go to **Extensions > Apps Script**.
3. Replace the default script content with the code inside `tiller-apps-script.js` from this repository.
4. Click **Save** (disk icon).

### Deploy as Web App
1. In the Apps Script editor, click **Deploy > New deployment**.
2. Select type: **Web App**.
3. Configure the settings:
   - **Execute as:** `Me (your-email@gmail.com)`
   - **Who has access:** `Anyone` (necessary for Express/Vercel CORS requests, guarded by URL token).
4. Click **Deploy** and authorize permissions when prompted.
5. Copy the generated **Web App URL**. It will look like:
   `https://script.google.com/macros/s/AKfycb.../exec`

---

## 2. Deploying the Backend (`mcp-server`)

The backend is an Express server located in `mcp-server/`. It processes data normalisation, caches SnapTrade holdings, and serves as an MCP SSE endpoint.

### Run Locally
1. Navigate to the server folder:
   ```bash
   cd mcp-server
   npm install
   ```
2. Create a `.env` file:
   ```env
   PORT=3001
   MCP_SECRET=your-secret-passcode
   SHEETS_API_URL=https://script.google.com/macros/s/AKfycb.../exec
   ```
3. Start the server:
   ```bash
   npm start
   ```

### Deploy to Render
1. Create a Web Service on [Render](https://render.com/).
2. Connect your GitHub repository.
3. Configure the settings:
   - **Root Directory:** `mcp-server`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. In **Environment Variables**, add:
   - `SHEETS_API_URL` (Your Google Apps Script Web App URL)
   - `MCP_SECRET` (A strong custom token to secure your API routes)

---

## 3. Frontend Dashboard Setup

1. From the project root, install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```
2. Open the browser to the local URL (usually `http://localhost:5173`).
3. Click the **Settings** icon:
   - Enter your **MCP Server URL** (e.g. `http://localhost:3001` or your Render domain).
   - Enter your **MCP Secret** passcode.
   - Under the **SnapTrade Credentials** card, input your **SnapTrade Client ID** and **Consumer Key**, and click **Save & Initialize Keys**.
   - Click **Link Brokerage** to authenticate bank or brokerage connections (Fidelity, Robinhood, etc.) using the SnapTrade Connection Portal redirect.

---

## 4. Configuring Dual MCP Servers

FinFlow integrates with both the custom **FinFlow Sheet tools** and **SnapTrade's native MCP server** concurrently. This gives your AI Agent access to sheets query actions *and* SnapTrade brokerage transactional/trading tools.

### Claude Desktop Configuration
Add both servers to your `claude_desktop_config.json` (on MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "finflow": {
      "command": "node",
      "args": ["/Users/toddtrevisan/Documents/Tiller Sheets/FinFlow/mcp-server/server.js"],
      "env": {
        "MCP_SECRET": "your-secret-passcode",
        "SHEETS_API_URL": "https://script.google.com/macros/s/AKfycb.../exec"
      }
    },
    "snaptrade-native": {
      "url": "https://mcp.snaptrade.com/mcp",
      "headers": {
        "Authorization": "Bearer your_snaptrade_token_if_needed"
      }
    }
  }
}
```

### Cursor Configuration
To run both in Cursor:
1. Go to **Settings > Features > MCP**.
2. Click **+ Add New MCP Server**:
   - **Name:** `finflow`
   - **Type:** `command` or `sse` (if using your Render domain, set SSE to `https://your-render-domain.onrender.com/sse` or `https://your-render-domain.onrender.com/your-secret-passcode/sse`).
3. Add the second server:
   - **Name:** `snaptrade`
   - **Type:** `sse`
   - **URL:** `https://mcp.snaptrade.com/mcp`
