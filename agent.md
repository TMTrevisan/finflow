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
*   **Type Normalization**: Tiller represents Expenses as positive numbers and Income as negative numbers. FinFlow normalizes this in `AppContext` so that **Income is positive** and **Expenses/Outflows are negative**.
*   **Transfers vs. Consumption**: Credit card payments or internal bank transfers are typed as `Transfer` and grouped under `Other` (or similar). They must be **excluded** from general expense/spending totals to avoid double-counting.
*   **Investments**: Transfers to retirement accounts (401(k), IRA, 529) are typed as `Transfer` with `group === 'Investments'` or `group === 'Wealth Building'`. They are tracked separately as "Invested & Saved" metrics.

### B. Payroll & Merchant Grouping
Paycheck entries and direct deposits are cleaned via `cleanMerchantName` in [formatting.js](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/utils/formatting.js). Specific employer splits (e.g., *Becton Dickinson*, *Kaitlyn Trevisan Payroll*, *Todd Trevisan Payroll*, and *Franchise Tax Board*) are mapped to consolidated parent strings so they don't split into separate rows/nodes on dashboards and diagrams.

### C. Cash Flow & Sankey Diagrams
*   The **Sankey Flow Diagram** in [SankeyDiagram.jsx](file:///Users/toddtrevisan/Documents/Tiller%20Sheets/FinFlow/src/components/diagrams/SankeyDiagram.jsx) visualizes:
    *   **Inflow (Left)**: Consolidated income sources.
    *   **Total Income Pool (Center)**.
    *   **Groups (Middle-Right)**: Categorized expenses, investments, and **Net Savings** (Dynamic Surplus).
    *   **Categories (Far-Right)**: Bottom-level categories (e.g., "Unspent Cash" for Net Savings).
*   **Dynamic Surplus (Net Savings)**: Formatted in **green** (`#10B981`) to represent positive unspent operational cash.

---

## 3. Testing Procedures

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

## 4. Deployment & Sync Pipeline

*   **Production Host**: Vercel (Auto-deploys from the `main` branch of GitHub repository `TMTrevisan/finflow`).
*   **Google Sheets Sync**: Updates in the Google Sheet are pulled by clicking "Sync Data" or "Force Refetch" in FinFlow's settings, which calls `syncData()` via the Google Apps Script Web App URL and updates the browser cache.
