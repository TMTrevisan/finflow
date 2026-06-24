# FinFlow Developer & AI Agent Instructions

Welcome to the FinFlow codebase! This document acts as a persistent knowledge base of findings, architecture decisions, constraints, testing procedures, and deployment paths to ensure future developers and AI agents can build upon the platform seamlessly.

---

## 1. Codebase Overview & Architecture

FinFlow is a modern personal finance dashboard built on top of Tiller Sheets export data.

*   **Frontend**: React (v19) + Vite + Tailwind CSS.
*   **Routing**: View switching is managed dynamically via `currentView` state in [App.jsx](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/App.jsx) and context-based navigation utilities.
*   **Data Flow**: [AppContext.jsx](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/context/AppContext.jsx) is the central state provider. It manages caching, synchronization status, reference dates, and transaction decoration.

---

## 2. Critical Data Conventions & Rules

### A. Transaction Type & Group Decoration
Transactions fetch raw from the Google Sheets API. They are decorated in `decorateData` inside [AppContext.jsx](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/context/AppContext.jsx):
*   **Type Normalization**: Tiller represents Expenses as positive numbers and Income as negative numbers. FinFlow normalizes this in `AppContext` so that **Income is positive** and **Expenses/Outflows are negative**. FinFlow uses a majority-based counter check on raw transaction sign directions to identify when the input data is in Tiller convention, preventing refunds (which are positive expenses in normalized datasets) from triggering false double-flips.
*   **Refund Handling**: Under Tiller's convention, refunds appear as negative expense values. In `decorateData`, the signs are flipped (`normalizedAmt = -rawAmt`) so refunds resolve back to positive credits, preventing double/triple counting of merchant charges (e.g. ticket cancellations).
*   **Transfers vs. Consumption**: Credit card payments or internal bank transfers are typed as `Transfer` and grouped under `Other` (or similar). They must be **excluded** from general expense/spending totals to avoid double-counting.
*   **Investments**: Transfers to retirement accounts (401(k), IRA, 529) are typed as `Transfer` with `group === 'Investments'` or `group === 'Wealth Building'`. They are tracked separately as "Invested & Saved" metrics.

### B. Payroll & Merchant Grouping
Paycheck entries and direct deposits are cleaned via `cleanMerchantName` in [formatting.js](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/utils/formatting.js). Under Custom Income Split Mode, specific employer splits (e.g., *Becton Dickinson*, *Havas*, *Kaitlyn Trevisan Payroll*, *Todd Trevisan Payroll*, and *Franchise Tax Board*) are mapped to consolidated parent strings so they don't split into separate rows/nodes on dashboards and diagrams. If Custom Income Split Mode is disabled, they resolve directly to their generic cleaned merchant strings.

### C. Cash Flow & Sankey Diagrams
*   The **Sankey Flow Diagram** in [SankeyDiagram.jsx](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/components/diagrams/SankeyDiagram.jsx) visualizes:
    *   **Inflow (Left)**: Consolidated income sources.
    *   **Total Income Pool (Center)**.
    *   **Groups (Middle-Right)**: Categorized expenses, investments, and **Net Savings** (Dynamic Surplus).
    *   **Categories (Far-Right)**: Bottom-level categories (e.g., "Unspent Cash" for Net Savings).
*   **Dynamic Surplus (Net Savings)**: Formatted in **green** (`#10B981`) to represent positive unspent operational cash.

---

## 3. Key Mathematical Calculations & Learnings

### A. Dynamic Pacing Calculation
*   **Pacing Indicator**: Calculated in [Budgets.jsx](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/views/Budgets.jsx) as `currentDay / totalDays` of the active `referenceDate`'s month, rather than assuming a hardcoded 31-day cycle.
*   **Pacing Badge Direction**: If spending pace is under expected pacing, it displays as green `{underPace}% under pace`. If actual spending exceeds expected pacing, it computes a negative percent and renders as rose `{overPace}% over pace`, eliminating mathematical double-negatives.

### B. Month-over-Month Category Deltas
*   In the category detail rows of [Budgets.jsx](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/views/Budgets.jsx), dynamic MoM delta badges rely on passing the previous month's actual spending values (`lastMonthSpent`). The dynamic group calculation maps previous month transaction sums into `lastMonthSpent` so the MoM badges calculate shifts correctly.

### C. Contributions & Surplus Routing
*   **Classification Priority**: In [AppContext.jsx](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/context/AppContext.jsx), `txn.group === 'Investments'` takes precedence over `txn.type === 'Transfer'` to ensure investment savings (Roth IRA, 401(k)) map to `Compounding` instead of default cost-neutral `Lifestyle` transfers.
*   **Pre-Tax 401(k) Outflows**: Pre-tax W2 retirement contributions are excluded from post-tax outflow calculations to prevent double-subtraction from net paycheck incomes.
*   **Defensive Math**: Divide-by-zero guards are enforced on all slider calculations (e.g., Joint routing ratios) to default to `0%` instead of displaying `NaN%` or `Infinity%` when net inputs are zero.

### D. Copilot MCP System Prompting
*   To enable the Copilot ([Assistant.jsx](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/views/Assistant.jsx)) to execute MCP tools, the system prompt must explicitly list the name, description, and query schema for each connected tool.

---

## 4. Testing Procedures

The project utilizes `vitest` for unit and component testing.
*   **Run Test Suite**:
    ```bash
    npm run test
    ```
*   **Test Locations**:
    *   [dateFilters.test.js](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/utils/dateFilters.test.js) (date range logic)
    *   [formatting.test.js](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/utils/formatting.test.js) (merchant cleaning, currency formatting)
    *   [ViewsRobustness.test.jsx](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/views/ViewsRobustness.test.jsx) (view render testing, edge cases, error boundaries, empty states)

*Ensure all test suites pass before proposing changes or pushing to git.*

---

## 5. Deployment & Sync Pipeline

*   **Production Host**: Vercel (Auto-deploys from the `main` branch of GitHub repository `TMTrevisan/finflow`).
*   **Google Sheets Sync**: Updates in the Google Sheet are pulled by clicking "Sync Data" or "Force Refetch" in FinFlow's settings, which calls `syncData()` via the Google Apps Script Web App URL and updates the browser cache.

---

## 6. Dual MCP Server Integration (Sheets + SnapTrade)

FinFlow is designed to run in parallel with SnapTrade's native MCP server (`https://mcp.snaptrade.com/mcp`).
*   **FinFlow Custom Tools**: Exposes Google Sheets query tools (`get_portfolio_allocation`, `list_bank_accounts`, `query_transactions`) and pacing trackers.
*   **SnapTrade Tools**: Exposes direct trading APIs, trade validations, account information retrieval, and real-time execution endpoints.
*   **AI Integration**: Rather than proxying all APIs through a single server, AI clients (Claude Desktop, Cursor, Grok, etc.) configure both servers to run in parallel. This keeps the architectures separate, robust, and clean. Instruct the client to utilize both endpoints to handle both Google Sheets tracking and live brokerage actions.


