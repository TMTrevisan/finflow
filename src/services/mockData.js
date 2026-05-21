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
  // Current Snapshots (May 23, 2026) - Net Worth = $41,955.00
  { id: 'bal_001', date: '2026-05-23', account: 'Marcus Online Savings', account_id: 'XXXX-8822', institution: 'Marcus', balance: 12850.00, class: 'Asset', type: 'Savings', sidebarColor: 'border-amber-500' },
  { id: 'bal_002', date: '2026-05-23', account: 'Chase Total Checking', account_id: 'XXXX-5678', institution: 'Chase', balance: 3832.44, class: 'Asset', type: 'Checking', sidebarColor: 'border-emerald-500', note: 'Linked to Robinhood' },
  { id: 'bal_003', date: '2026-05-23', account: 'Emirates NBD', account_id: 'XXXX-1122', institution: 'Emirates NBD', balance: 2435.65, class: 'Asset', type: 'Checking', sidebarColor: 'border-cyan-500', currency: 'AED', foreignBalance: 8935.52 },
  { id: 'bal_004', date: '2026-05-23', account: 'Wise EUR', account_id: 'XXXX-3344', institution: 'Wise', balance: 2173.91, class: 'Asset', type: 'Checking', sidebarColor: 'border-blue-500', currency: 'EUR', foreignBalance: 1950.00 },
  { id: 'bal_005', date: '2026-05-23', account: 'Revolut GBP', account_id: 'XXXX-5566', institution: 'Revolut', balance: 1169.10, class: 'Asset', type: 'Checking', sidebarColor: 'border-purple-500', currency: 'GBP', foreignBalance: 920.00 },
  { id: 'bal_006', date: '2026-05-23', account: 'Venmo', account_id: 'XXXX-7788', institution: 'Venmo', balance: 68.50, class: 'Asset', type: 'Cash', sidebarColor: 'border-slate-500' },
  { id: 'bal_007', date: '2026-05-23', account: 'Cash Wallet', account_id: 'XXXX-CASH', institution: 'Manual Asset', balance: 24.00, class: 'Asset', type: 'Cash', sidebarColor: 'border-pink-500' },
  { id: 'bal_008', date: '2026-05-23', account: 'Vanguard Brokerage', account_id: 'XXXX-9012', institution: 'Vanguard', balance: 23559.32, class: 'Asset', type: 'Investment', sidebarColor: 'border-indigo-500' },
  
  // Debt Liabilities (May 23, 2026) - Total = -$4,157.92
  { id: 'bal_009', date: '2026-05-23', account: 'Apple Card', account_id: 'XXXX-1111', institution: 'Apple Card', balance: -421.50, class: 'Liability', type: 'Credit Card', apr: '4.XX', interestPaid: 18.00, status: 'UNPAID', dueDate: '7D' },
  { id: 'bal_010', date: '2026-05-23', account: 'Amex Gold', account_id: 'XXXX-2222', institution: 'Amex', balance: -782.30, class: 'Liability', type: 'Credit Card', apr: '2.XX', interestPaid: 22.00, status: 'PAID', dueDate: '3D' },
  { id: 'bal_011', date: '2026-05-23', account: 'Chase Sapphire Preferred', account_id: 'XXXX-3333', institution: 'Chase', balance: -1864.20, class: 'Liability', type: 'Credit Card', apr: '1.XX', interestPaid: 31.00, status: 'PAID', dueDate: '7D' },
  { id: 'bal_012', date: '2026-05-23', account: 'ADCB Traveller Card', account_id: 'XXXX-4444', institution: 'ADCB', balance: -1089.92, class: 'Liability', type: 'Credit Card', apr: '0.XX', interestPaid: 9.00, status: 'PAID', dueDate: '15D', currency: 'AED', foreignBalance: 4000.00 },

  // May 15, 2026 Snapshots - Net Worth = $39,800.00
  { id: 'bal_013', date: '2026-05-15', account: 'Marcus Online Savings', account_id: 'XXXX-8822', institution: 'Marcus', balance: 12000.00, class: 'Asset', type: 'Savings' },
  { id: 'bal_014', date: '2026-05-15', account: 'Chase Total Checking', account_id: 'XXXX-5678', institution: 'Chase', balance: 3500.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_015', date: '2026-05-15', account: 'Emirates NBD', account_id: 'XXXX-1122', institution: 'Emirates NBD', balance: 2200.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_016', date: '2026-05-15', account: 'Wise EUR', account_id: 'XXXX-3344', institution: 'Wise', balance: 2000.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_017', date: '2026-05-15', account: 'Revolut GBP', account_id: 'XXXX-5566', institution: 'Revolut', balance: 1000.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_018', date: '2026-05-15', account: 'Venmo', account_id: 'XXXX-7788', institution: 'Venmo', balance: 100.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_019', date: '2026-05-15', account: 'Cash Wallet', account_id: 'XXXX-CASH', institution: 'Manual Asset', balance: 30.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_020', date: '2026-05-15', account: 'Vanguard Brokerage', account_id: 'XXXX-9012', institution: 'Vanguard', balance: 23200.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_021', date: '2026-05-15', account: 'Apple Card', account_id: 'XXXX-1111', institution: 'Apple Card', balance: -350.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_022', date: '2026-05-15', account: 'Amex Gold', account_id: 'XXXX-2222', institution: 'Amex', balance: -980.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_023', date: '2026-05-15', account: 'Chase Sapphire Preferred', account_id: 'XXXX-3333', institution: 'Chase', balance: -1900.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_024', date: '2026-05-15', account: 'ADCB Traveller Card', account_id: 'XXXX-4444', institution: 'ADCB', balance: -1000.00, class: 'Liability', type: 'Credit Card' },

  // May 5, 2026 Snapshots - Net Worth = $41,200.00
  { id: 'bal_025', date: '2026-05-05', account: 'Marcus Online Savings', account_id: 'XXXX-8822', institution: 'Marcus', balance: 12500.00, class: 'Asset', type: 'Savings' },
  { id: 'bal_026', date: '2026-05-05', account: 'Chase Total Checking', account_id: 'XXXX-5678', institution: 'Chase', balance: 4100.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_027', date: '2026-05-05', account: 'Emirates NBD', account_id: 'XXXX-1122', institution: 'Emirates NBD', balance: 2500.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_028', date: '2026-05-05', account: 'Wise EUR', account_id: 'XXXX-3344', institution: 'Wise', balance: 2200.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_029', date: '2026-05-05', account: 'Revolut GBP', account_id: 'XXXX-5566', institution: 'Revolut', balance: 1200.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_030', date: '2026-05-05', account: 'Venmo', account_id: 'XXXX-7788', institution: 'Venmo', balance: 50.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_031', date: '2026-05-05', account: 'Cash Wallet', account_id: 'XXXX-CASH', institution: 'Manual Asset', balance: 50.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_032', date: '2026-05-05', account: 'Vanguard Brokerage', account_id: 'XXXX-9012', institution: 'Vanguard', balance: 22800.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_033', date: '2026-05-05', account: 'Apple Card', account_id: 'XXXX-1111', institution: 'Apple Card', balance: -500.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_034', date: '2026-05-05', account: 'Amex Gold', account_id: 'XXXX-2222', institution: 'Amex', balance: -1000.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_035', date: '2026-05-05', account: 'Chase Sapphire Preferred', account_id: 'XXXX-3333', institution: 'Chase', balance: -1600.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_036', date: '2026-05-05', account: 'ADCB Traveller Card', account_id: 'XXXX-4444', institution: 'ADCB', balance: -1100.00, class: 'Liability', type: 'Credit Card' },

  // April 28, 2026 Snapshots - Net Worth = $36,500.00
  { id: 'bal_037', date: '2026-04-28', account: 'Marcus Online Savings', account_id: 'XXXX-8822', institution: 'Marcus', balance: 10000.00, class: 'Asset', type: 'Savings' },
  { id: 'bal_038', date: '2026-04-28', account: 'Chase Total Checking', account_id: 'XXXX-5678', institution: 'Chase', balance: 3200.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_039', date: '2026-04-28', account: 'Emirates NBD', account_id: 'XXXX-1122', institution: 'Emirates NBD', balance: 1800.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_040', date: '2026-04-28', account: 'Wise EUR', account_id: 'XXXX-3344', institution: 'Wise', balance: 1500.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_041', date: '2026-04-28', account: 'Revolut GBP', account_id: 'XXXX-5566', institution: 'Revolut', balance: 800.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_042', date: '2026-04-28', account: 'Venmo', account_id: 'XXXX-7788', institution: 'Venmo', balance: 120.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_043', date: '2026-04-28', account: 'Cash Wallet', account_id: 'XXXX-CASH', institution: 'Manual Asset', balance: 80.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_044', date: '2026-04-28', account: 'Vanguard Brokerage', account_id: 'XXXX-9012', institution: 'Vanguard', balance: 22000.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_045', date: '2026-04-28', account: 'Apple Card', account_id: 'XXXX-1111', institution: 'Apple Card', balance: -200.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_046', date: '2026-04-28', account: 'Amex Gold', account_id: 'XXXX-2222', institution: 'Amex', balance: -700.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_047', date: '2026-04-28', account: 'Chase Sapphire Preferred', account_id: 'XXXX-3333', institution: 'Chase', balance: -1200.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_048', date: '2026-04-28', account: 'ADCB Traveller Card', account_id: 'XXXX-4444', institution: 'ADCB', balance: -900.00, class: 'Liability', type: 'Credit Card' },

  // April 21, 2026 Snapshots - Net Worth = $35,200.00
  { id: 'bal_049', date: '2026-04-21', account: 'Marcus Online Savings', account_id: 'XXXX-8822', institution: 'Marcus', balance: 10000.00, class: 'Asset', type: 'Savings' },
  { id: 'bal_050', date: '2026-04-21', account: 'Chase Total Checking', account_id: 'XXXX-5678', institution: 'Chase', balance: 3000.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_051', date: '2026-04-21', account: 'Emirates NBD', account_id: 'XXXX-1122', institution: 'Emirates NBD', balance: 1500.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_052', date: '2026-04-21', account: 'Wise EUR', account_id: 'XXXX-3344', institution: 'Wise', balance: 1500.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_053', date: '2026-04-21', account: 'Revolut GBP', account_id: 'XXXX-5566', institution: 'Revolut', balance: 800.00, class: 'Asset', type: 'Checking' },
  { id: 'bal_054', date: '2026-04-21', account: 'Venmo', account_id: 'XXXX-7788', institution: 'Venmo', balance: 100.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_055', date: '2026-04-21', account: 'Cash Wallet', account_id: 'XXXX-CASH', institution: 'Manual Asset', balance: 100.00, class: 'Asset', type: 'Cash' },
  { id: 'bal_056', date: '2026-04-21', account: 'Vanguard Brokerage', account_id: 'XXXX-9012', institution: 'Vanguard', balance: 21000.00, class: 'Asset', type: 'Investment' },
  { id: 'bal_057', date: '2026-04-21', account: 'Apple Card', account_id: 'XXXX-1111', institution: 'Apple Card', balance: -300.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_058', date: '2026-04-21', account: 'Amex Gold', account_id: 'XXXX-2222', institution: 'Amex', balance: -600.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_059', date: '2026-04-21', account: 'Chase Sapphire Preferred', account_id: 'XXXX-3333', institution: 'Chase', balance: -1100.00, class: 'Liability', type: 'Credit Card' },
  { id: 'bal_060', date: '2026-04-21', account: 'ADCB Traveller Card', account_id: 'XXXX-4444', institution: 'ADCB', balance: -800.00, class: 'Liability', type: 'Credit Card' }
];

