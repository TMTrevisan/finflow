import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, formatDate, cleanMerchantName } from '../utils/formatting';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Calendar, TrendingUp, DollarSign, ArrowUpRight, TrendingDown } from 'lucide-react';

export default function YearlyInsights() {
  const { transactions, categories, isLoading } = useAppContext();
  
  // 1. Get available years in the dataset
  const years = useMemo(() => {
    if (transactions.length === 0) return [String(new Date().getFullYear())];
    const uniqueYears = new Set();
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) {
        uniqueYears.add(String(d.getFullYear()));
      }
    });
    return Array.from(uniqueYears).sort((a, b) => b - a); // Sort newest first
  }, [transactions]);

  const [selectedYear, setSelectedYear] = useState('');

  // Default to the newest year with transactions
  React.useEffect(() => {
    if (years.length > 0 && !selectedYear) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  // 2. Filter transactions by the selected year
  const yearlyTxns = useMemo(() => {
    if (!selectedYear) return [];
    return transactions.filter(t => {
      const d = new Date(t.date);
      return !isNaN(d.getTime()) && String(d.getFullYear()) === selectedYear;
    });
  }, [transactions, selectedYear]);

  // 3. Calculate high level metrics
  const metrics = useMemo(() => {
    let income = 0;
    let expenses = 0;

    yearlyTxns.forEach(t => {
      const val = Math.abs(t.amount);
      if (t.type === 'Income') {
        income += val;
      } else if (t.type === 'Expense') {
        expenses += val;
      }
    });

    return {
      income,
      expenses,
      netCashFlow: income - expenses
    };
  }, [yearlyTxns]);

  // 4. Calculate Category Spending Breakdown
  const categoryTotals = useMemo(() => {
    const totals = {};
    
    yearlyTxns.forEach(t => {
      if (t.type !== 'Expense') return;
      const cat = t.category || 'Uncategorized';
      totals[cat] = (totals[cat] || 0) + Math.abs(t.amount);
    });

    const maxVal = Math.max(...Object.values(totals), 1);

    return Object.entries(totals)
      .map(([category, value]) => ({
        category,
        value,
        percentage: (value / maxVal) * 100
      }))
      .sort((a, b) => b.value - a.value);
  }, [yearlyTxns]);

  // 5. Calculate Top 100 Expenses
  const top100Expenses = useMemo(() => {
    return yearlyTxns
      .filter(t => t.type === 'Expense')
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 100);
  }, [yearlyTxns]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-12 bg-obsidian-800 rounded-2xl w-1/4"></div>
        <div className="h-48 bg-obsidian-800 rounded-3xl w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-obsidian-800 rounded-3xl"></div>
          <div className="h-96 bg-obsidian-800 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  if (years.length === 0 || !selectedYear) {
    return (
      <div className="p-8 text-center text-slate-400">
        No transaction history available to generate Yearly Insights. Please connect and sync your sheets.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Yearly Insights</h2>
          <p className="text-xs text-slate-500 mt-1">Annual performance overview for {selectedYear}</p>
        </div>
        
        {/* Year Select Dropdown */}
        <div className="relative">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="appearance-none bg-obsidian-800 border border-obsidian-700 text-white rounded-xl pl-4 pr-10 py-2.5 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 cursor-pointer"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
        </div>
      </div>

      {/* Annual Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 shadow-md">
          <CardContent className="pt-6 space-y-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Yearly Income</span>
            <div className="flex items-center space-x-2 text-neon-emerald">
              <ArrowUpRight size={18} />
              <span className="text-2xl font-black text-white">{formatCurrency(metrics.income)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 shadow-md">
          <CardContent className="pt-6 space-y-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Yearly Expenses</span>
            <div className="flex items-center space-x-2 text-neon-crimson">
              <TrendingDown size={18} />
              <span className="text-2xl font-black text-white">{formatCurrency(metrics.expenses)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br border-obsidian-700/80 shadow-md ${
          metrics.netCashFlow >= 0 ? 'from-obsidian-800/40 to-neon-emerald/5' : 'from-obsidian-800/40 to-neon-crimson/5'
        }`}>
          <CardContent className="pt-6 space-y-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Annual Cash Flow</span>
            <div className={`flex items-center space-x-2 ${
              metrics.netCashFlow >= 0 ? 'text-neon-emerald' : 'text-neon-crimson'
            }`}>
              <TrendingUp size={18} />
              <span className="text-2xl font-black text-white">{formatCurrency(metrics.netCashFlow)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Triple Bar Chart Comparison (Custom SVG) */}
      <Card className="bg-gradient-to-b from-obsidian-800/40 to-obsidian-900/40 border-obsidian-800/80">
        <CardContent className="pt-6">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6 text-center">Cash Flow Breakdown ({selectedYear})</h4>
          
          <div className="flex flex-col space-y-4 max-w-lg mx-auto">
            {/* Income Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">Total Inflow</span>
                <span className="text-neon-emerald font-bold">{formatCurrency(metrics.income)}</span>
              </div>
              <div className="w-full bg-obsidian-850 h-3.5 rounded-full overflow-hidden">
                <div className="bg-neon-emerald h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Expenses Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">Total Outflow</span>
                <span className="text-neon-crimson font-bold">{formatCurrency(metrics.expenses)}</span>
              </div>
              <div className="w-full bg-obsidian-850 h-3.5 rounded-full overflow-hidden">
                <div 
                  className="bg-neon-crimson h-full rounded-full transition-all duration-500" 
                  style={{ width: `${metrics.income > 0 ? (metrics.expenses / metrics.income) * 100 : 100}%` }}
                ></div>
              </div>
            </div>

            {/* Net Flow Bar */}
            {metrics.netCashFlow > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-400">Net Savings (Cash Flow)</span>
                  <span className="text-neon-indigo font-bold">{formatCurrency(metrics.netCashFlow)}</span>
                </div>
                <div className="w-full bg-obsidian-850 h-3.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-neon-indigo h-full rounded-full transition-all duration-500" 
                    style={{ width: `${metrics.income > 0 ? (metrics.netCashFlow / metrics.income) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Totals */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 shadow-md">
          <CardHeader className="border-b border-obsidian-750 pb-4">
            <CardTitle className="text-base font-bold text-white tracking-tight">Category Spending Ranking</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 max-h-[500px] overflow-y-auto pr-2 space-y-4">
            {categoryTotals.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8">No category data recorded for this year.</p>
            ) : (
              categoryTotals.map(item => (
                <div key={item.category} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-200">{item.category}</span>
                    <span className="text-slate-100 font-bold">{formatCurrency(item.value)}</span>
                  </div>
                  <ProgressBar value={item.value} max={Math.max(...categoryTotals.map(x => x.value))} className="h-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top 100 Expenses */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 shadow-md">
          <CardHeader className="border-b border-obsidian-750 pb-4">
            <CardTitle className="text-base font-bold text-white tracking-tight">Top 100 Expenses</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 p-0 max-h-[500px] overflow-y-auto divide-y divide-obsidian-700/40">
            {top100Expenses.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8">No expenses recorded for this year.</p>
            ) : (
              top100Expenses.map(txn => (
                <div key={txn.id} className="p-3 flex items-center justify-between hover:bg-obsidian-750/30 transition-colors">
                  <div className="min-w-0 pr-4">
                    <p className="text-xs text-slate-500">{formatDate(txn.date)}</p>
                    <p className="text-sm font-semibold text-slate-200 truncate mt-0.5">{cleanMerchantName(txn.description)}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{txn.category || 'Uncategorized'} • {txn.account}</p>
                  </div>
                  <span className="text-sm font-bold text-white shrink-0">
                    {formatCurrency(Math.abs(txn.amount))}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
