import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import DonutChart from '../components/ui/DonutChart';
import DateRangeSelector from '../components/ui/DateRangeSelector';
import { filterTransactionsByDateRange } from '../utils/dateFilters';
import { formatCurrency, cleanMerchantName } from '../utils/formatting';
import { 
  TrendingDown, 
  ShoppingBag, 
  CalendarDays,
  FileDown
} from 'lucide-react';

const CATEGORY_COLORS = {
  'Rent': '#6366F1',         // Indigo
  'Housing': '#3B82F6',      // Blue
  'Groceries': '#10B981',    // Emerald
  'Dining': '#EC4899',       // Pink
  'Auto': '#F59E0B',         // Amber
  'Subscriptions': '#8B5CF6', // Violet
  'Fitness': '#06B6D4',      // Cyan
  'Utilities': '#06B6D4',    // Cyan
  'Default': '#94A3B8'       // Slate
};

export default function Spending() {
  const { transactions, isLoading } = useAppContext();
  const [filterType, setFilterType] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

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
    return expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [expenseTransactions]);

  // Group by Category for Donut Chart & ranked list
  const categoryData = useMemo(() => {
    const categoriesMap = {};
    expenseTransactions.forEach(t => {
      const cat = t.category || 'Uncategorized';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + Math.abs(t.amount);
    });

    return Object.entries(categoriesMap)
      .map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || CATEGORY_COLORS['Default']
      }))
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

  // Group by Month for historical chart (uses all transactions for proper scale, not filtered by this month)
  const monthlySpending = useMemo(() => {
    const monthlyMap = {};
    transactions
      .filter(t => t.type === 'Expense')
      .forEach(t => {
        const date = new Date(t.date);
        const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthlyMap[key] = (monthlyMap[key] || 0) + Math.abs(t.amount);
      });

    return Object.entries(monthlyMap)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => {
        const dateA = new Date(a.month + ' 01');
        const dateB = new Date(b.month + ' 01');
        return dateA - dateB;
      });
  }, [transactions]);

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
    <div className="space-y-6">
      {/* Date selector header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-obsidian-850 p-4 rounded-2xl border border-obsidian-800">
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

      {/* Main Analysis Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart Breakdowns */}
        <Card className="lg:col-span-2 bg-obsidian-800/40 border-obsidian-800/80">
          <div className="p-6 border-b border-obsidian-800/80 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Category Distribution</h3>
          </div>
          <CardContent className="pt-6">
            <DonutChart data={categoryData.slice(0, 7)} size={220} />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-3 bg-obsidian-800/40 border-obsidian-800/80 p-6">
          <h3 className="text-lg font-bold text-white mb-6">Historical Monthly Trends</h3>
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
                      <span className="absolute bottom-full bg-obsidian-800 border border-obsidian-750 text-white font-bold text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none mb-1 shadow-xl">
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
      </div>
    </div>
  );
}
