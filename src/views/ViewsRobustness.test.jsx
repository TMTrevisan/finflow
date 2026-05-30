import { describe, it, expect, vi } from 'vitest';
import React from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    ...actual,
    useState: (val) => [typeof val === 'function' ? val() : val, vi.fn()],
    useMemo: (fn) => fn(),
    useEffect: (fn) => {},
    useCallback: (fn) => fn,
    useRef: (val) => ({ current: val }),
    useContext: (ctx) => ({})
  };
  return {
    ...mocked,
    default: mocked
  };
});

// Mock Lucide icons to return dummy components
vi.mock('lucide-react', () => {
  return new Proxy({ __esModule: true }, {
    get: (target, prop) => {
      if (prop === '__esModule') return true;
      return prop;
    },
    has: (target, prop) => true,
    getOwnPropertyDescriptor: (target, prop) => {
      return {
        enumerable: true,
        configurable: true,
        value: prop
      };
    }
  });
});

// Mock framer-motion to bypass animation library DOM requirements in Node
vi.mock('framer-motion', () => {
  const Dummy = ({ children }) => children;
  return {
    motion: {
      div: Dummy,
      button: Dummy,
      span: Dummy,
      p: Dummy,
      h2: Dummy,
      h3: Dummy,
      h4: Dummy,
      nav: Dummy
    },
    AnimatePresence: Dummy
  };
});

// Mock local React context hooks & utilities
let mockContextValue = {};
vi.mock('../context/AppContext', () => {
  return {
    useAppContext: () => mockContextValue,
    resolveBudget: () => 0
  };
});

// Mock sub-components that rely on DOM/SVG/Canvas
vi.mock('../components/diagrams/SankeyDiagram', () => ({
  default: () => 'SankeyDiagram'
}));
vi.mock('../components/ui/LineChart', () => ({
  default: () => 'LineChart'
}));
vi.mock('../components/ui/DonutChart', () => ({
  default: () => 'DonutChart'
}));
vi.mock('../components/ui/AnomalyDetector', () => ({
  default: () => 'AnomalyDetector'
}));

// Import views to test
import Accounts from './Accounts';
import Assistant from './Assistant';
import Budgets from './Budgets';
import CashFlow from './CashFlow';
import ContributionsSurplus from './ContributionsSurplus';
import Dashboard from './Dashboard';
import Income from './Income';
import PLReport from './PLReport';
import Settings from './Settings';
import Spending from './Spending';
import SpendingTrends from './SpendingTrends';
import Subscriptions from './Subscriptions';
import Transactions from './Transactions';
import YearlyInsights from './YearlyInsights';

describe('Views Robustness Tests', () => {
  const views = [
    { name: 'Accounts', component: Accounts },
    { name: 'Assistant', component: Assistant },
    { name: 'Budgets', component: Budgets },
    { name: 'CashFlow', component: CashFlow },
    { name: 'ContributionsSurplus', component: ContributionsSurplus },
    { name: 'Dashboard', component: Dashboard },
    { name: 'Income', component: Income },
    { name: 'PLReport', component: PLReport },
    { name: 'Settings', component: Settings },
    { name: 'Spending', component: Spending },
    { name: 'SpendingTrends', component: SpendingTrends },
    { name: 'Subscriptions', component: Subscriptions },
    { name: 'Transactions', component: Transactions },
    { name: 'YearlyInsights', component: YearlyInsights }
  ];

  it('renders all views without throwing exceptions when database context is empty/uninitialized', () => {
    // 1. Set the mock context to represent uninitialized/loading state (everything undefined)
    mockContextValue = {
      isLoading: true,
      isSyncing: false,
      isMockData: false,
      error: null,
      lastSync: null,
      transactions: undefined,
      categories: undefined,
      balances: undefined,
      lifeOptimization: undefined,
      surplusMetrics: undefined,
      selectedAccount: null,
      setSelectedAccount: vi.fn(),
      setSelectedCategory: vi.fn(),
      setSelectedDateRange: vi.fn(),
      navigateToTransactions: vi.fn(),
      syncData: vi.fn(),
      clearCache: vi.fn(),
      loadData: vi.fn(),
      updateCategory: vi.fn(),
      useCalendarToday: false,
      setUseCalendarToday: vi.fn()
    };

    views.forEach(v => {
      expect(() => {
        try {
          // Shallow execute the functional component
          v.component({ setCurrentView: vi.fn() });
        } catch (e) {
          // Wrap error in a descriptive error message to identify the failing view
          throw new Error(`Failed to render view [${v.name}] with empty context: ${e.message}\n${e.stack}`);
        }
      }).not.toThrow();
    });
  });

  it('renders all views without throwing when data has loaded', () => {
    // 2. Set mock context to represent fully loaded database state
    mockContextValue = {
      isLoading: false,
      isSyncing: false,
      isMockData: true,
      error: null,
      lastSync: '2026-05-29T20:18:11Z',
      transactions: [
        { id: '1', date: '2026-05-15', description: 'Test Grocery', category: 'Groceries', amount: -50.00, type: 'Expense', account: 'Chase Checking' },
        { id: '2', date: '2026-05-17', description: 'Salary Deposit', category: 'Paycheck', amount: 3000.00, type: 'Income', account: 'Chase Checking' }
      ],
      categories: [
        { id: 'c1', category: 'Groceries', group: 'Living', type: 'Expense', budget: 500.00 },
        { id: 'c2', category: 'Paycheck', group: 'Income', type: 'Income', budget: 3000.00 }
      ],
      balances: [
        { id: 'b1', date: '2026-05-29', account: 'Chase Checking', institution: 'Chase', balance: 5000.00, class: 'Asset', type: 'Checking' }
      ],
      lifeOptimization: [],
      surplusMetrics: {
        rolling: { income: 3000, compounding: 0, baseline: 50, lifestyle: 0, surplus: 2950 },
        projected: { income: 3000, compounding: 0, baseline: 50, lifestyle: 0, surplus: 2950 }
      },
      selectedAccount: null,
      setSelectedAccount: vi.fn(),
      setSelectedCategory: vi.fn(),
      setSelectedDateRange: vi.fn(),
      navigateToTransactions: vi.fn(),
      syncData: vi.fn(),
      clearCache: vi.fn(),
      loadData: vi.fn(),
      updateCategory: vi.fn(),
      useCalendarToday: false,
      setUseCalendarToday: vi.fn()
    };

    views.forEach(v => {
      expect(() => {
        try {
          v.component({ setCurrentView: vi.fn() });
        } catch (e) {
          throw new Error(`Failed to render view [${v.name}] with populated context: ${e.message}\n${e.stack}`);
        }
      }).not.toThrow();
    });
  });
});
