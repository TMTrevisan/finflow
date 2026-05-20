import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import DateRangeSelector from '../components/ui/DateRangeSelector';
import { filterTransactionsByDateRange } from '../utils/dateFilters';
import { formatCurrency, cleanMerchantName } from '../utils/formatting';
import { 
  TrendingUp, 
  Landmark, 
  CalendarCheck,
  FileDown
} from 'lucide-react';

export default function Income() {
  const { transactions, isLoading } = useAppContext();
  const [filterType, setFilterType] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Date filtered transactions
  const dateFilteredTransactions = useMemo(() => {
    return filterTransactionsByDateRange(transactions, filterType, customStart, customEnd);
  }, [transactions, filterType, customStart, customEnd]);

  // Filter transactions to only income (type === 'Income')
  const incomeTransactions = useMemo(() => {
    return dateFilteredTransactions.filter(t => t.type === 'Income');
  }, [dateFilteredTransactions]);

  // Overall income total
  const totalIncome = useMemo(() => {
    return incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [incomeTransactions]);

  // Group by Category for Ranked Income Sources
  const categoryData = useMemo(() => {
    const categoriesMap = {};
    incomeTransactions.forEach(t => {
      const cat = t.category || 'Other Income';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + t.amount;
    });

    return Object.entries(categoriesMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [incomeTransactions]);

  // Calculations for Monarch-style summary
  const summaryStats = useMemo(() => {
    if (incomeTransactions.length === 0) {
      return { total: 0, largest: 0, average: 0, count: 0 };
    }
    const count = incomeTransactions.length;
    const total = totalIncome;
    const average = total / count;
    const largest = Math.max(...incomeTransactions.map(t => t.amount));
    return { total, largest, average, count };
  }, [incomeTransactions, totalIncome]);

  // Group by Month to show historical income comparisons (uses all transactions for proper scale, not filtered by this month)
  const monthlyIncome = useMemo(() => {
    const monthlyMap = {};
    transactions
      .filter(t => t.type === 'Income')
      .forEach(t => {
        const date = new Date(t.date);
        const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthlyMap[key] = (monthlyMap[key] || 0) + t.amount;
      });

    // Sort months chronologically
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
    if (incomeTransactions.length === 0) return;
    const headers = ['Date', 'Description', 'Category', 'Account', 'Amount'];
    const rows = incomeTransactions.map(t => [
      t.date,
      t.description,
      t.category || 'Other Income',
      t.account,
      t.amount
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finflow_income_${filterType}.csv`);
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
          <div className="p-3 bg-neon-emerald/10 text-neon-emerald rounded-2xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Income</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalIncome)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Selected range</p>
          </div>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex items-center space-x-4">
          <div className="p-3 bg-neon-indigo/10 text-neon-indigo rounded-2xl">
            <Landmark size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Top Source</p>
            <p className="text-xl font-bold text-white mt-1">
              {categoryData[0]?.name || 'None'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {categoryData[0] ? formatCurrency(categoryData[0].value) : '$0.00'} deposits
            </p>
          </div>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex items-center space-x-4">
          <div className="p-3 bg-neon-indigo/10 text-neon-indigo rounded-2xl">
            <CalendarCheck size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Deposits</p>
            <p className="text-2xl font-bold text-white mt-1">{incomeTransactions.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Credits processed</p>
          </div>
        </Card>
      </div>

      {/* Main Income Breakdown Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranked Income Categories */}
        <Card className="lg:col-span-2 bg-obsidian-800/40 border-obsidian-800/80">
          <div className="p-6 border-b border-obsidian-800/80">
            <h3 className="text-lg font-bold text-white">Income by Category</h3>
          </div>
          <CardContent className="pt-6 space-y-4">
            {categoryData.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No income category data</p>
            ) : (
              categoryData.map((cat, index) => {
                const maxVal = categoryData[0]?.value || 1;
                const percent = (cat.value / maxVal) * 100;
                
                return (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-200">{cat.name}</span>
                      <span className="font-bold text-white">{formatCurrency(cat.value)}</span>
                    </div>
                    <div className="w-full bg-obsidian-800 h-2 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${percent}%` }}
                        className="h-full bg-neon-emerald rounded-full"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Monarch-style Summary Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80">
          <div className="p-6 border-b border-obsidian-800/80 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Summary</h3>
          </div>
          <CardContent className="pt-6 space-y-5">
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-slate-400 font-medium">Total deposits</span>
              <span className="text-sm font-bold text-white">{summaryStats.count}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-slate-400 font-medium">Largest deposit</span>
              <span className="text-sm font-bold text-white">{formatCurrency(summaryStats.largest)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-slate-400 font-medium">Average deposit</span>
              <span className="text-sm font-bold text-white">{formatCurrency(summaryStats.average)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-obsidian-750 pb-4">
              <span className="text-sm text-slate-400 font-medium">Total income</span>
              <span className="text-sm font-extrabold text-neon-emerald">{formatCurrency(summaryStats.total)}</span>
            </div>
            
            <button
              onClick={downloadCSV}
              disabled={incomeTransactions.length === 0}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-obsidian-850 hover:bg-obsidian-750 border border-obsidian-750 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileDown size={14} className="text-neon-indigo" />
              <span>Download CSV</span>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Monthly income bar charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-3 bg-obsidian-800/40 border-obsidian-800/80 p-6">
          <h3 className="text-lg font-bold text-white mb-6">Historical Income Trends</h3>
          <div className="flex items-end justify-between gap-4 h-48 pt-6">
            {monthlyIncome.length === 0 ? (
              <p className="text-slate-500 text-sm text-center w-full">No historical income data</p>
            ) : (
              monthlyIncome.map((m) => {
                const maxMonth = Math.max(...monthlyIncome.map(x => x.total)) || 1;
                const heightPct = (m.total / maxMonth) * 100;
                
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center group h-full justify-end">
                    <div className="relative w-full flex items-end justify-center h-32 mb-2">
                      <span className="absolute bottom-full bg-obsidian-800 border border-obsidian-750 text-white font-bold text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none mb-1 shadow-xl">
                        {formatCurrency(m.total)}
                      </span>
                      <div 
                        style={{ height: `${heightPct}%`, minHeight: '8%' }}
                        className="w-8 sm:w-16 bg-neon-emerald/25 hover:bg-neon-emerald/55 border border-neon-emerald/35 hover:border-neon-emerald rounded-t-lg transition-all duration-300 relative shadow-[0_0_12px_rgba(16,185,129,0.05)] hover:shadow-[0_0_12px_rgba(16,185,129,0.2)]"
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
