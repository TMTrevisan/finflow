export const MOCK_TRANSACTIONS = [
  { id: 'txn_001', date: '2026-05-18', description: 'Whole Foods Market', category: 'Groceries', amount: -145.20, type: 'Expense', account: 'Chase Sapphire Reserve', status: 'cleared' },
  { id: 'txn_002', date: '2026-05-17', description: 'Tech Startup Salary', category: 'Paycheck', amount: 4500.00, type: 'Income', account: 'Chase Checking', status: 'cleared' },
  { id: 'txn_003', date: '2026-05-16', description: 'Netflix', category: 'Subscriptions', amount: -15.99, type: 'Expense', account: 'Chase Sapphire Reserve', status: 'cleared' },
  { id: 'txn_004', date: '2026-05-15', description: 'Shell Gas Station', category: 'Auto', amount: -45.00, type: 'Expense', account: 'Chase Sapphire Reserve', status: 'cleared' },
  { id: 'txn_005', date: '2026-05-14', description: 'Uber Eats', category: 'Dining', amount: -32.50, type: 'Expense', account: 'Chase Sapphire Reserve', status: 'cleared' },
  { id: 'txn_006', date: '2026-05-12', description: 'Electric Bill', category: 'Utilities', amount: -110.00, type: 'Expense', account: 'Chase Checking', status: 'cleared' },
  { id: 'txn_007', date: '2026-05-10', description: 'Landlord Rent', category: 'Rent', amount: -2200.00, type: 'Expense', account: 'Chase Checking', status: 'cleared' },
  { id: 'txn_008', date: '2026-05-08', description: 'Starbucks Coffee', category: 'Dining', amount: -5.75, type: 'Expense', account: 'Chase Sapphire Reserve', status: 'cleared' },
  { id: 'txn_009', date: '2026-05-05', description: 'Gas Utility', category: 'Utilities', amount: -34.80, type: 'Expense', account: 'Chase Checking', status: 'cleared' },
  { id: 'txn_010', date: '2026-05-01', description: 'Dividend Payment', category: 'Dividends', amount: 150.00, type: 'Income', account: 'Vanguard Brokerage', status: 'cleared' },
  { id: 'txn_011', date: '2026-05-01', description: 'Gym Membership', category: 'Fitness', amount: -80.00, type: 'Expense', account: 'Chase Sapphire Reserve', status: 'cleared' },
  { id: 'txn_012', date: '2026-05-01', description: 'Internet Provider', category: 'Utilities', amount: -79.99, type: 'Expense', account: 'Chase Checking', status: 'cleared' }
];

export const MOCK_CATEGORIES = [
  { id: 'cat_001', category: 'Groceries', group: 'Living', type: 'Expense', budget: 600.00 },
  { id: 'cat_002', category: 'Paycheck', group: 'Income', type: 'Income', budget: 9000.00 },
  { id: 'cat_003', category: 'Subscriptions', group: 'Living', type: 'Expense', budget: 50.00 },
  { id: 'cat_004', category: 'Auto', group: 'Transportation', type: 'Expense', budget: 150.00 },
  { id: 'cat_005', category: 'Dining', group: 'Living', type: 'Expense', budget: 300.00 },
  { id: 'cat_006', category: 'Utilities', group: 'Housing', type: 'Expense', budget: 350.00 },
  { id: 'cat_007', category: 'Rent', group: 'Housing', type: 'Expense', budget: 2200.00 },
  { id: 'cat_008', category: 'Dividends', group: 'Income', type: 'Income', budget: 100.00 },
  { id: 'cat_009', category: 'Fitness', group: 'Personal Care', type: 'Expense', budget: 100.00 }
];

// Rich balance history representing snapshots over time for Net Worth tracking
export const MOCK_BALANCES = [
  // Current Snapshots (May 19, 2026)
  { id: 'bal_001', date: '2026-05-19', account: 'Chase Checking', account_id: 'XXXX-5678', institution: 'Chase', balance: 5240.50, class: 'Asset', type: 'Cash' },
  { id: 'bal_002', date: '2026-05-19', account: 'Ally Savings', account_id: 'XXXX-9911', institution: 'Ally', balance: 25450.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_003', date: '2026-05-19', account: 'Chase Sapphire Reserve', account_id: 'XXXX-1234', institution: 'Chase', balance: -1250.45, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_004', date: '2026-05-19', account: 'Vanguard Brokerage', account_id: 'XXXX-9012', institution: 'Vanguard', balance: 145000.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_005', date: '2026-05-19', account: 'Principal 401k', account_id: 'XXXX-4422', institution: 'Principal', balance: 88500.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_006', date: '2026-05-19', account: 'Primary Residence', account_id: 'XXXX-HOME', institution: 'Manual Asset', balance: 450000.00, class: 'Asset', type: 'Real Estate' },
  { id: 'bal_007', date: '2026-05-19', account: 'Chase Mortgage', account_id: 'XXXX-9988', institution: 'Chase Mortgages', balance: -285000.00, class: 'Liability', type: 'Loan' },

  // April 30, 2026 Snapshots
  { id: 'bal_008', date: '2026-04-30', account: 'Chase Checking', account_id: 'XXXX-5678', institution: 'Chase', balance: 4800.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_009', date: '2026-04-30', account: 'Ally Savings', account_id: 'XXXX-9911', institution: 'Ally', balance: 24300.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_010', date: '2026-04-30', account: 'Chase Sapphire Reserve', account_id: 'XXXX-1234', institution: 'Chase', balance: -890.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_011', date: '2026-04-30', account: 'Vanguard Brokerage', account_id: 'XXXX-9012', institution: 'Vanguard', balance: 141200.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_012', date: '2026-04-30', account: 'Principal 401k', account_id: 'XXXX-4422', institution: 'Principal', balance: 86100.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_013', date: '2026-04-30', account: 'Primary Residence', account_id: 'XXXX-HOME', institution: 'Manual Asset', balance: 450000.00, class: 'Asset', type: 'Real Estate' },
  { id: 'bal_014', date: '2026-04-30', account: 'Chase Mortgage', account_id: 'XXXX-9988', institution: 'Chase Mortgages', balance: -286200.00, class: 'Liability', type: 'Loan' },

  // March 31, 2026 Snapshots
  { id: 'bal_015', date: '2026-03-31', account: 'Chase Checking', account_id: 'XXXX-5678', institution: 'Chase', balance: 6100.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_016', date: '2026-03-31', account: 'Ally Savings', account_id: 'XXXX-9911', institution: 'Ally', balance: 23150.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_017', date: '2026-03-31', account: 'Chase Sapphire Reserve', account_id: 'XXXX-1234', institution: 'Chase', balance: -2100.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_018', date: '2026-03-31', account: 'Vanguard Brokerage', account_id: 'XXXX-9012', institution: 'Vanguard', balance: 137500.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_019', date: '2026-03-31', account: 'Principal 401k', account_id: 'XXXX-4422', institution: 'Principal', balance: 84000.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_020', date: '2026-03-31', account: 'Primary Residence', account_id: 'XXXX-HOME', institution: 'Manual Asset', balance: 445000.00, class: 'Asset', type: 'Real Estate' },
  { id: 'bal_021', date: '2026-03-31', account: 'Chase Mortgage', account_id: 'XXXX-9988', institution: 'Chase Mortgages', balance: -287400.00, class: 'Liability', type: 'Loan' },

  // February 28, 2026 Snapshots
  { id: 'bal_022', date: '2026-02-28', account: 'Chase Checking', account_id: 'XXXX-5678', institution: 'Chase', balance: 3900.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_023', date: '2026-02-28', account: 'Ally Savings', account_id: 'XXXX-9911', institution: 'Ally', balance: 22000.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_024', date: '2026-02-28', account: 'Chase Sapphire Reserve', account_id: 'XXXX-1234', institution: 'Chase', balance: -1450.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_025', date: '2026-02-28', account: 'Vanguard Brokerage', account_id: 'XXXX-9012', institution: 'Vanguard', balance: 132400.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_026', date: '2026-02-28', account: 'Principal 401k', account_id: 'XXXX-4422', institution: 'Principal', balance: 81200.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_027', date: '2026-02-28', account: 'Primary Residence', account_id: 'XXXX-HOME', institution: 'Manual Asset', balance: 445000.00, class: 'Asset', type: 'Real Estate' },
  { id: 'bal_028', date: '2026-02-28', account: 'Chase Mortgage', account_id: 'XXXX-9988', institution: 'Chase Mortgages', balance: -288600.00, class: 'Liability', type: 'Loan' },

  // January 31, 2026 Snapshots
  { id: 'bal_029', date: '2026-01-31', account: 'Chase Checking', account_id: 'XXXX-5678', institution: 'Chase', balance: 4200.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_030', date: '2026-01-31', account: 'Ally Savings', account_id: 'XXXX-9911', institution: 'Ally', balance: 22000.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_031', date: '2026-01-31', account: 'Chase Sapphire Reserve', account_id: 'XXXX-1234', institution: 'Chase', balance: -980.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_032', date: '2026-01-31', account: 'Vanguard Brokerage', account_id: 'XXXX-9012', institution: 'Vanguard', balance: 128900.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_033', date: '2026-01-31', account: 'Principal 401k', account_id: 'XXXX-4422', institution: 'Principal', balance: 79500.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_034', date: '2026-01-31', account: 'Primary Residence', account_id: 'XXXX-HOME', institution: 'Manual Asset', balance: 440000.00, class: 'Asset', type: 'Real Estate' },
  { id: 'bal_035', date: '2026-01-31', account: 'Chase Mortgage', account_id: 'XXXX-9988', institution: 'Chase Mortgages', balance: -289800.00, class: 'Liability', type: 'Loan' }
];
