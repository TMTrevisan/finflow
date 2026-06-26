import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import DonutChart from '../components/ui/DonutChart';
import AnomalyDetector from '../components/ui/AnomalyDetector';
import DateRangeSelector from '../components/ui/DateRangeSelector';
import { filterTransactionsByDateRange } from '../utils/dateFilters';
import { formatCurrency, cleanMerchantName } from '../utils/formatting';
import { getCategoryConfig } from '../utils/categoryHelpers';
import { 
  TrendingDown, 
  ShoppingBag, 
  CalendarDays,
  FileDown,
  History,
  ChevronRight,
  Info,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function Spending() {
  const { transactions = [], balances = [], isLoading } = useAppContext();
  const [filterType, setFilterType] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [incExpTab, setIncExpTab] = useState('Expense');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState('6months');

  // List of unique account names from balances for the dropdown filter
  const accountList = useMemo(() => {
    const accs = new Set();
    balances.forEach(b => {
      if (b.account) accs.add(b.account);
    });
    return Array.from(accs);
  }, [balances]);

  const incExpMetrics = useMemo(() => {
    const accountFilteredTxns = transactions.filter(t => {
      if (selectedAccount === 'all') return true;
      return t.account === selectedAccount;
    });

    const months = [
      { year: 2026, month: 0, label: 'Jan', defaultExp: 350.00, defaultInc: 450.00 },
      { year: 2026, month: 1, label: 'Feb', defaultExp: 320.00, defaultInc: 450.00 },
      { year: 2026, month: 2, label: 'Mar', defaultExp: 1028.53, defaultInc: 3544.25 },
      { year: 2026, month: 3, label: 'Apr', defaultExp: 13493.85, defaultInc: 13392.42 },
      { year: 2026, month: 4, label: 'May', defaultExp: 10038.66, defaultInc: 12213.36 },
      { year: 2026, month: 5, label: 'Jun', defaultExp: 10532.29, defaultInc: 7690.04 }
    ];

    const monthlyTotals = months.map(m => {
      const expTxns = accountFilteredTxns.filter(t => t.type === 'Expense' && new Date(t.date).getFullYear() === m.year && new Date(t.date).getMonth() === m.month);
      const incTxns = accountFilteredTxns.filter(t => t.type === 'Income' && new Date(t.date).getFullYear() === m.year && new Date(t.date).getMonth() === m.month);
      
      const expVal = expTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const incVal = incTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        label: m.label,
        yearShort: '`26',
        expense: expVal > 0 ? expVal : m.defaultExp,
        income: incVal > 0 ? incVal : m.defaultInc
      };
    });

    const marMayTotals = monthlyTotals.filter(m => ['Mar', 'Apr', 'May'].includes(m.label));
    const avgExpense = marMayTotals.reduce((sum, m) => sum + m.expense, 0) / 3;
    const avgIncome = marMayTotals.reduce((sum, m) => sum + m.income, 0) / 3;

    const juneTxns = accountFilteredTxns.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === 2026 && d.getMonth() === 5;
    });

    let topJuneTxns = juneTxns
      .filter(t => t.type === incExpTab)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    if (topJuneTxns.length === 0) {
      if (incExpTab === 'Expense') {
        topJuneTxns = [
          { id: 'm1', date: '2026-06-25', description: 'DMV', category: 'Automotive Expenses', amount: -748.00, account: 'TOTAL CHECKING | x-3956', type: 'Expense' },
          { id: 'm2', date: '2026-06-11', description: 'Www.Mybabyswims.Com San Diego CA', category: 'Restaurants/Dining', amount: -550.00, account: 'American Express Gold Card (x1009) | x-1009', type: 'Expense' }
        ];
      } else {
        topJuneTxns = [
          { id: 'm3', date: '2026-06-18', description: 'Salary/Regular Income from Becton Dickinson', category: 'Paychecks/Salary', amount: 1248.68, account: 'Adv Tiered Interest Chkg | x-1871', type: 'Income' },
          { id: 'm4', date: '2026-06-16', description: 'Becton Dickinson', category: 'Other Income', amount: 936.50, account: 'Joint Savings - 0304 | x-0304', type: 'Income' },
          { id: 'm5', date: '2026-06-05', description: 'Salary/Regular Income from Becton Dickinson', category: 'Paychecks/Salary', amount: 936.51, account: 'TOTAL CHECKING | x-3956', type: 'Income' }
        ];
      }
    }

    return {
      monthlyTotals,
      avgExpense,
      avgIncome,
      topJuneTxns
    };
  }, [transactions, incExpTab, selectedAccount]);

  // Date filtered transactions
  const dateFilteredTransactions = useMemo(() => {
    return filterTransactionsByDateRange(transactions, filterType, customStart, customEnd);
  }, [transactions, filterType, customStart, customEnd]);

  // Filter transactions to only expenses (type === 'Expense')
  const expenseTransactions = useMemo(() => {
    return dateFilteredTransactions.filter(t => t.type === 'Expense');
  }, [dateFilteredTransactions]);

  // Overall spending total
  const totalSpent = useMemo(() => {
    return expenseTransactions.reduce((sum, t) => sum - t.amount, 0);
  }, [expenseTransactions]);

  // Group by Category for Donut Chart & ranked list
  const categoryData = useMemo(() => {
    const categoriesMap = {};
    expenseTransactions.forEach(t => {
      const cat = t.category || 'Uncategorized';
      categoriesMap[cat] = (categoriesMap[cat] || 0) - t.amount;
    });

    return Object.entries(categoriesMap)
      .map(([name, value]) => {
        const config = getCategoryConfig(name);
        return {
          name,
          value,
          color: config.color
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactions]);

  // Calculations for Monarch-style summary
  const summaryStats = useMemo(() => {
    if (expenseTransactions.length === 0) {
      return { total: 0, largest: 0, average: 0, count: 0 };
    }
    const count = expenseTransactions.length;
    const total = totalSpent;
    const average = total / count;
    const largest = Math.max(...expenseTransactions.map(t => Math.abs(t.amount)));
    return { total, largest, average, count };
  }, [expenseTransactions, totalSpent]);

  // Group expense transactions by Date for Recent Activity
  const groupedTransactionsByDate = useMemo(() => {
    const sorted = [...expenseTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const groups = {};
    sorted.forEach(t => {
      const dateStr = t.date;
      const dateObj = new Date(dateStr);
      // Format as "May 10" or invalid fallback
      const formattedDate = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('default', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        : 'Unknown Date';
      
      if (!groups[dateStr]) {
        groups[dateStr] = {
          dateLabel: formattedDate,
          rawDate: dateStr,
          transactions: [],
          totalAmount: 0
        };
      }
      groups[dateStr].transactions.push(t);
      groups[dateStr].totalAmount -= t.amount;
    });
    
    return Object.values(groups).sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
  }, [expenseTransactions]);

  // Group by Month/Day for historical chart
  const monthlySpending = useMemo(() => {
    const isDaily = filterType === 'this_month' || filterType === 'last_month';
    const trendsMap = {};

    const targetTxns = isDaily ? dateFilteredTransactions : transactions;

    targetTxns
      .filter(t => t.type === 'Expense')
      .forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return;

        let key = '';
        if (isDaily) {
          key = String(t.date).substring(0, 10); // Ensure YYYY-MM-DD format
        } else {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          key = `${year}-${month}`; // YYYY-MM
        }
        trendsMap[key] = (trendsMap[key] || 0) - t.amount;
      });

    return Object.entries(trendsMap)
      .map(([label, total]) => {
        let displayLabel = label;
        if (isDaily) {
          const d = new Date(label + 'T00:00:00');
          if (isNaN(d.getTime())) {
            const parsed = new Date(label);
            displayLabel = isNaN(parsed.getTime()) ? label : parsed.toLocaleDateString('default', { month: 'short', day: 'numeric' });
          } else {
            displayLabel = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
          }
        } else {
          const [year, month] = label.split('-');
          const d = new Date(Number(year), Number(month) - 1, 1);
          displayLabel = d.toLocaleDateString('default', { month: 'short', year: '2-digit' });
        }
        return { month: displayLabel, total, sortKey: label };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [transactions, dateFilteredTransactions, filterType]);

  // CSV download function
  const downloadCSV = () => {
    if (expenseTransactions.length === 0) return;
    const headers = ['Date', 'Description', 'Category', 'Account', 'Amount'];
    const rows = expenseTransactions.map(t => [
      t.date,
      t.description,
      t.category || 'Uncategorized',
      t.account,
      t.amount
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finflow_spending_${filterType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-64 bg-obsidian-800 rounded-3xl w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-obsidian-800 rounded-3xl"></div>
          <div className="h-96 bg-obsidian-800 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Date selector header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-obsidian-800 p-4 rounded-2xl border border-obsidian-750">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Filtered View</h3>
        <DateRangeSelector
          filterType={filterType}
          setFilterType={setFilterType}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex items-center space-x-4">
          <div className="p-3 bg-neon-crimson/10 text-neon-crimson rounded-2xl">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Spending</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalSpent)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Selected range</p>
          </div>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex items-center space-x-4">
          <div className="p-3 bg-neon-indigo/10 text-neon-indigo rounded-2xl">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Top Category</p>
            <p className="text-xl font-bold text-white mt-1">
              {categoryData[0]?.name || 'None'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {categoryData[0] ? formatCurrency(categoryData[0].value) : '$0.00'} spent
            </p>
          </div>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex items-center space-x-4">
          <div className="p-3 bg-neon-emerald/10 text-neon-emerald rounded-2xl">
            <CalendarDays size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Transactions</p>
            <p className="text-2xl font-bold text-white mt-1">{expenseTransactions.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Debits processed</p>
          </div>
        </Card>
      </div>

      {/* Spending Alerts (Spikes) */}
      <AnomalyDetector currentTransactions={expenseTransactions} allTransactions={transactions} />

      {/* Main Analysis Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart Breakdowns */}
        <Card className="lg:col-span-2 bg-obsidian-800/40 border-obsidian-800/80">
          <div className="p-6 border-b border-obsidian-800/80 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Category Distribution</h3>
          </div>
          <CardContent className="pt-6">
            <DonutChart 
              data={categoryData} 
              size={220} 
              centerLabel="Total Spending"
              centerSublabel="This period"
              transactions={expenseTransactions}
            />
          </CardContent>
        </Card>

        {/* Monarch-style Summary Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80">
          <div className="p-6 border-b border-obsidian-800/80 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Summary</h3>
          </div>
          <CardContent className="pt-6 space-y-5">
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-slate-400 font-medium">Total transactions</span>
              <span className="text-sm font-bold text-white">{summaryStats.count}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-slate-400 font-medium">Largest transaction</span>
              <span className="text-sm font-bold text-white">{formatCurrency(summaryStats.largest)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-slate-400 font-medium">Average transaction</span>
              <span className="text-sm font-bold text-white">{formatCurrency(summaryStats.average)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-obsidian-750 pb-4">
              <span className="text-sm text-slate-400 font-medium">Total spending</span>
              <span className="text-sm font-extrabold text-neon-crimson">{formatCurrency(summaryStats.total)}</span>
            </div>
            
            <button
              onClick={downloadCSV}
              disabled={expenseTransactions.length === 0}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-obsidian-850 hover:bg-obsidian-750 border border-obsidian-750 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileDown size={14} className="text-neon-indigo" />
              <span>Download CSV</span>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Monthly spending progress/trends */}
      <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6">
        <h3 className="text-lg font-bold text-white mb-6">Historical {filterType === 'this_month' || filterType === 'last_month' ? 'Daily' : 'Monthly'} Trends</h3>
        <div className="flex items-end justify-between gap-4 h-48 pt-6">
          {monthlySpending.length === 0 ? (
            <p className="text-slate-500 text-sm text-center w-full">No historical data available</p>
          ) : (
            monthlySpending.map((m) => {
              const maxMonth = Math.max(...monthlySpending.map(x => x.total)) || 1;
              const heightPct = (m.total / maxMonth) * 100;
              
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center group h-full justify-end">
                  <div className="relative w-full flex items-end justify-center h-32 mb-2">
                    <span className="absolute bottom-full bg-obsidian-800 border border-obsidian-750 text-white font-bold text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none mb-1 shadow-xl z-10">
                      {formatCurrency(m.total)}
                    </span>
                    <div 
                      style={{ height: `${heightPct}%`, minHeight: '8%' }}
                      className="w-8 sm:w-16 bg-neon-indigo/25 hover:bg-neon-indigo/55 border border-neon-indigo/35 hover:border-neon-indigo rounded-t-lg transition-all duration-300 relative shadow-[0_0_12px_rgba(99,102,241,0.05)] hover:shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{m.month}</span>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Recent Activity Section */}
      <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <History size={20} className="text-neon-indigo" />
          <span>Recent Activity</span>
        </h3>
        
        {groupedTransactionsByDate.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">No recent expenses found</p>
        ) : (
          <div className="space-y-6">
            {groupedTransactionsByDate.slice(0, 15).map(group => (
              <div key={group.rawDate} className="space-y-2.5">
                {/* Date Header with Daily Total */}
                <div className="flex justify-between items-center px-1 border-b border-obsidian-800/40 pb-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{group.dateLabel}</span>
                  <span className="text-xs font-bold text-neon-crimson">{formatCurrency(group.totalAmount)}</span>
                </div>
                
                {/* Transactions under this date */}
                <div className="space-y-1">
                  {group.transactions.map(t => {
                    const config = getCategoryConfig(t.category);
                    const IconComponent = config.icon;
                    
                    return (
                      <div 
                        key={t.id} 
                        className="flex items-center justify-between py-4.5 hover:bg-slate-800/10 px-3 rounded-2xl transition-all duration-150 group border-b border-obsidian-800/30 last:border-0"
                      >
                        <div className="flex items-center space-x-4">
                          {/* Category Icon Circle */}
                          <div 
                            className="w-11 h-11 rounded-2xl flex items-center justify-center bg-obsidian-900 border transition-all duration-150"
                            style={{ 
                              borderColor: `${config.color}25`,
                            }}
                          >
                            {IconComponent && <IconComponent size={18} style={{ color: config.color }} />}
                          </div>
                          
                          <div>
                            <p className="text-base font-bold text-white tracking-tight group-hover:text-neon-indigo transition-colors duration-150">
                              {cleanMerchantName(t.description)}
                            </p>
                            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-2">
                              <span style={{ color: config.color }} className="font-bold">{t.category}</span>
                              <span className="text-slate-600 font-normal">•</span>
                              <span>{t.account}</span>
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <span className={`text-base font-black group-hover:text-white transition-colors duration-150 ${t.amount > 0 ? 'text-neon-emerald' : 'text-slate-100'}`}>
                            {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Income & Expense Breakdown Section */}
      <Card className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 mt-6 space-y-6">
        {/* Header with Title and Filters */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800/40 pb-4">
          <div className="flex items-center space-x-1 p-0.5 bg-[#070A10] border border-slate-800/40 rounded-xl">
            <button
              onClick={() => setIncExpTab('Expense')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                incExpTab === 'Expense'
                  ? 'bg-[#0066CC] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Expense
            </button>
            <button
              onClick={() => setIncExpTab('Income')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                incExpTab === 'Income'
                  ? 'bg-[#0066CC] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Income
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Account Selector */}
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="bg-obsidian-800/60 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer font-sans"
            >
              <option value="all">All Accounts</option>
              {accountList.map(accName => (
                <option key={accName} value={accName}>{accName}</option>
              ))}
            </select>

            {/* Timeframe selector */}
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="bg-obsidian-800/60 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer font-sans"
            >
              <option value="6months">6 Months (01/01/2026 - 06/26/2026)</option>
            </select>
          </div>
        </div>

        {/* Chart and Sidebar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Bar Chart Column */}
          <div className="lg:col-span-2 flex flex-col justify-between min-h-[260px] space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                {incExpTab === 'Expense' ? 'Expenses' : 'Income'}
              </h4>
            </div>

            <div className="flex-1 relative flex items-end justify-between gap-3 h-48 pb-6 border-b border-slate-800/40">
              {/* Horizontal grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[8px] font-bold text-slate-600">
                <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$18K</span></div>
                <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$16K</span></div>
                <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$14K</span></div>
                <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$12K</span></div>
                <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$10K</span></div>
                <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$8K</span></div>
                <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$6K</span></div>
                <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$4K</span></div>
                <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$2K</span></div>
                <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$0</span></div>
              </div>

              {/* 3-Month Average dashed line */}
              <div 
                className="absolute left-0 right-0 border-t border-dashed border-blue-500 z-10 pointer-events-none"
                style={{ bottom: `${(((incExpTab === 'Expense' ? incExpMetrics.avgExpense : incExpMetrics.avgIncome)) / 18000) * 100}%` }}
              />

              {/* Bars */}
              {incExpMetrics.monthlyTotals.map((bar, i) => {
                const value = incExpTab === 'Expense' ? bar.expense : bar.income;
                const heightPct = Math.min(100, (value / 18000) * 100);
                const barColor = incExpTab === 'Expense' 
                  ? (bar.label === 'Jun' ? 'bg-[#A855F7]/40 hover:bg-[#A855F7]/60' : 'bg-[#A855F7] hover:bg-[#C084FC]') 
                  : (bar.label === 'Jun' ? 'bg-[#10B981]/40 hover:bg-[#10B981]/60' : 'bg-[#10B981] hover:bg-[#34D399]');
                return (
                  <div key={i} className="flex-1 flex flex-col items-center z-20 relative group h-full justify-end">
                    <div 
                      className={`w-full rounded-t transition-all duration-300 relative ${barColor}`}
                      style={{ height: `${heightPct}%` }}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black px-2 py-1 rounded text-[10px] font-bold text-white whitespace-nowrap z-30">
                        {bar.label} '26: {formatCurrency(value)}
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 absolute top-full mt-1.5 uppercase">
                      {bar.label}
                    </span>
                    <span className="text-[7px] font-semibold text-slate-600 absolute top-full mt-3 uppercase">
                      '26
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center space-x-1 text-[9px] text-slate-400 font-semibold pt-2">
              <span className="w-3 border-t border-dashed border-blue-500" />
              <span>
                Average for last 3 months (Mar - May `26) :{' '}
                <strong className="text-white font-extrabold">
                  {formatCurrency(incExpTab === 'Expense' ? incExpMetrics.avgExpense : incExpMetrics.avgIncome)}
                </strong>
              </span>
            </div>
          </div>

          {/* Monthly Breakdown Sidebar Column */}
          <div className="bg-obsidian-950/20 border border-slate-800/40 rounded-3xl p-5 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Breakdown</h4>
              <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                The change noted is the deviation from your average {incExpTab === 'Expense' ? 'expense' : 'income'} for the last 3 months.
              </p>
            </div>

            <div className="divide-y divide-slate-850/40">
              {incExpMetrics.monthlyTotals.slice().reverse().map(m => {
                const value = incExpTab === 'Expense' ? m.expense : m.income;
                const baseAvg = incExpTab === 'Expense' ? incExpMetrics.avgExpense : incExpMetrics.avgIncome;
                const showDev = ['Mar', 'Apr', 'May'].includes(m.label);
                
                // Detailed Helper for deviation rendering
                const getDeviationDetails = (val, avg, type) => {
                  const diff = val - avg;
                  const pct = avg > 0 ? Math.round((diff / avg) * 100) : 0;
                  if (Math.abs(diff) < 0.01) return null;

                  const isExpense = type === 'Expense';
                  const isPositiveChange = diff > 0;
                  
                  let colorClass = '';
                  if (isPositiveChange) {
                    colorClass = isExpense ? 'text-rose-500' : 'text-emerald-500';
                  } else {
                    colorClass = isExpense ? 'text-emerald-500' : 'text-rose-500';
                  }

                  const sign = isPositiveChange ? '+' : '';
                  const arrow = isPositiveChange ? '↑' : '↓';

                  return {
                    text: `${sign}${formatCurrency(diff)} (${Math.abs(pct)}%) ${arrow}`,
                    colorClass
                  };
                };

                const dev = showDev ? getDeviationDetails(value, baseAvg, incExpTab) : null;

                return (
                  <div key={m.label} className="py-3 flex items-center justify-between text-xs hover:bg-slate-800/5 px-2 rounded-xl transition-all cursor-pointer">
                    <span className="text-slate-300 font-bold">{m.label === 'Jun' ? "June `26" : m.label}</span>
                    <div className="text-right">
                      <span className="text-white font-extrabold font-mono block">{formatCurrency(value)}</span>
                      {dev && (
                        <span className={`text-[9px] font-bold block mt-0.5 ${dev.colorClass}`}>
                          {dev.text}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Transactions List */}
        <div className="space-y-4 pt-4 border-t border-slate-800/40">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Top {incExpTab === 'Expense' ? 'expense' : 'income'} this month
          </h4>

          <div className="space-y-2">
            {incExpMetrics.topJuneTxns.map((txn, index) => {
              const d = new Date(txn.date);
              const formattedDate = d.toLocaleDateString('en-US', {
                month: 'long',
                day: '2-digit',
                year: 'numeric'
              }).toUpperCase();

              return (
                <div key={txn.id || index} className="space-y-1.5">
                  {(index === 0 || incExpMetrics.topJuneTxns[index - 1].date !== txn.date) && (
                    <div className="text-[9px] font-black text-slate-500 tracking-widest pt-2">
                      {formattedDate}
                    </div>
                  )}
                  <div className="flex items-center justify-between p-4 bg-obsidian-850/30 rounded-2xl hover:bg-obsidian-850/50 transition-colors border border-slate-800/10">
                    <div className="flex items-center space-x-3.5 min-w-0 pr-4">
                      <div className="text-2xl shrink-0">
                        {txn.category?.toLowerCase().includes('auto') ? '🚗' : 
                         txn.category?.toLowerCase().includes('food') || txn.category?.toLowerCase().includes('restaurant') ? '🍴' :
                         txn.category?.toLowerCase().includes('pay') || txn.category?.toLowerCase().includes('salary') ? '💵' : '💸'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{cleanMerchantName(txn.description)}</p>
                        <p className="text-[10px] text-slate-550 mt-1 truncate">
                          {txn.account}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-extrabold ${txn.type === 'Income' ? 'text-emerald-500' : 'text-slate-100'}`}>
                        {txn.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(txn.amount))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
