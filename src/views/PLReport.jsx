import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, getCategoryEmoji } from '../utils/formatting';
import { Card, CardContent } from '../components/ui/Card';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PLReport() {
  const { transactions, categories, isLoading } = useAppContext();
  
  const [timeframe, setTimeframe] = useState('6M');
  const [rowSortOrder, setRowSortOrder] = useState('alphabetical');
  const [mobileMonthIndex, setMobileMonthIndex] = useState(0);

  // 1. Get the list of months chronologically based on transactions and timeframe
  const months = useMemo(() => {
    if (transactions.length === 0) return [];
    
    const monthKeysMap = new Map();
    transactions.forEach(t => {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return;
      const key = date.toLocaleString('default', { month: 'short' }) + " '" + String(date.getFullYear()).slice(-2);
      const sortVal = date.getFullYear() * 12 + date.getMonth();
      monthKeysMap.set(key, { label: key, sortVal, year: date.getFullYear() });
    });

    let list = Array.from(monthKeysMap.values()).sort((a, b) => a.sortVal - b.sortVal);

    if (timeframe === '3M') {
      list = list.slice(-3);
    } else if (timeframe === '6M') {
      list = list.slice(-6);
    } else if (timeframe === '12M') {
      list = list.slice(-12);
    } else if (timeframe === 'YTD') {
      const latestYear = list.length > 0 ? list[list.length - 1].year : new Date().getFullYear();
      list = list.filter(item => item.year === latestYear);
    }
    
    return list.map(item => item.label);
  }, [transactions, timeframe]);

  // Auto-set latest month for mobile index when months load/change
  React.useEffect(() => {
    if (months.length > 0) {
      setMobileMonthIndex(months.length - 1);
    }
  }, [months]);

  // 2. Build mapping of Group -> Categories -> Month -> Amount
  const plData = useMemo(() => {
    if (months.length === 0) return { incomeGroups: {}, expenseGroups: {}, monthlySummary: {} };

    const incomeGroups = {};
    const expenseGroups = {};
    const monthlySummary = {}; // { [month]: { income: 0, expense: 0, net: 0 } }

    months.forEach(m => {
      monthlySummary[m] = { income: 0, expense: 0, net: 0 };
    });

    // Seed groups from categories
    categories.forEach(cat => {
      const groupName = cat.group || 'Other';
      const targetMap = cat.type === 'Income' ? incomeGroups : expenseGroups;
      
      if (!targetMap[groupName]) {
        targetMap[groupName] = {};
      }
      if (!targetMap[groupName][cat.category]) {
        targetMap[groupName][cat.category] = {};
        months.forEach(m => {
          targetMap[groupName][cat.category][m] = 0;
        });
      }
    });

    // Fill data from transactions
    transactions.forEach(t => {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return;
      const monthKey = date.toLocaleString('default', { month: 'short' }) + " '" + String(date.getFullYear()).slice(-2);
      
      if (!months.includes(monthKey)) return;

      const groupName = t.group || 'Other';
      const amount = Math.abs(t.amount);
      const isIncome = t.type === 'Income';
      const targetMap = isIncome ? incomeGroups : expenseGroups;

      // Ensure the key path exists
      if (!targetMap[groupName]) {
        targetMap[groupName] = {};
      }
      if (!targetMap[groupName][t.category]) {
        targetMap[groupName][t.category] = {};
        months.forEach(m => {
          targetMap[groupName][t.category][m] = 0;
        });
      }

      // Add amount
      targetMap[groupName][t.category][monthKey] += amount;

      // Add to summary
      if (isIncome) {
        monthlySummary[monthKey].income += amount;
      } else if (t.type === 'Expense') {
        monthlySummary[monthKey].expense += amount;
      }
    });

    // Calculate Net Cash Flows
    months.forEach(m => {
      monthlySummary[m].net = monthlySummary[m].income - monthlySummary[m].expense;
    });

    return { incomeGroups, expenseGroups, monthlySummary };
  }, [transactions, categories, months]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-12 bg-obsidian-800 rounded-2xl w-1/4"></div>
        <div className="h-96 bg-obsidian-800 rounded-3xl w-full"></div>
      </div>
    );
  }

  if (months.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400">
        No transaction history available to generate a P&L report. Please connect and sync your sheets.
      </div>
    );
  }

  const activeMobileMonth = months[mobileMonthIndex] || months[months.length - 1];

  // Helper to check if a category has any non-zero values across the months
  const isCategoryUsed = (catMap) => {
    return Object.values(catMap).some(val => val > 0);
  };

  // Helper to sort categories inside a group
  const sortCategories = (categoriesList) => {
    if (rowSortOrder === 'amount') {
      return [...categoriesList].sort((a, b) => {
        const sumA = Object.values(a[1] || {}).reduce((s, v) => s + v, 0);
        const sumB = Object.values(b[1] || {}).reduce((s, v) => s + v, 0);
        return sumB - sumA;
      });
    }
    return [...categoriesList].sort((a, b) => a[0].localeCompare(b[0]));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Profit & Loss Report</h2>
          <p className="text-xs text-slate-500 mt-1">Monthly cash flow statement</p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe Selector */}
          <div className="flex bg-obsidian-850 p-1 rounded-xl border border-obsidian-750 text-xs">
            {['3M', '6M', '12M', 'YTD', 'All'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  timeframe === tf
                    ? 'bg-neon-indigo text-white shadow-lg shadow-neon-indigo/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Row Sorting Button */}
          <button
            onClick={() => setRowSortOrder(prev => prev === 'alphabetical' ? 'amount' : 'alphabetical')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-obsidian-850 border border-obsidian-750 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all"
          >
            <span className="text-slate-500">Sort:</span>
            <span className="text-neon-indigo font-extrabold capitalize">{rowSortOrder}</span>
          </button>
        </div>
      </div>

      {/* Mobile Month Navigator */}
      <div className="md:hidden flex items-center justify-between bg-obsidian-800 border border-obsidian-700 rounded-2xl p-4">
        <button
          disabled={mobileMonthIndex === 0}
          onClick={() => setMobileMonthIndex(prev => prev - 1)}
          className="p-2 rounded-lg bg-obsidian-750 border border-obsidian-700 disabled:opacity-30 text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="font-bold text-white text-base">{activeMobileMonth}</span>
        <button
          disabled={mobileMonthIndex === months.length - 1}
          onClick={() => setMobileMonthIndex(prev => prev + 1)}
          className="p-2 rounded-lg bg-obsidian-750 border border-obsidian-700 disabled:opacity-30 text-white"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Mobile Card-Based P&L View */}
      <div className="md:hidden space-y-4">
        {/* Net Flow Summary Card */}
        <Card className="bg-gradient-to-br from-obsidian-800 to-obsidian-900 border-obsidian-700/80">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <span>Net Cash Flow</span>
              <span>{activeMobileMonth}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className={`text-3xl font-black ${plData.monthlySummary[activeMobileMonth]?.net >= 0 ? 'text-neon-emerald' : 'text-neon-crimson'}`}>
                {formatCurrency(plData.monthlySummary[activeMobileMonth]?.net || 0)}
              </span>
              <span className="text-xs text-slate-500">Net Profit / Loss</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-obsidian-800">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Income</span>
                <span className="text-sm font-bold text-slate-200">{formatCurrency(plData.monthlySummary[activeMobileMonth]?.income || 0)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Expenses</span>
                <span className="text-sm font-bold text-slate-200">{formatCurrency(plData.monthlySummary[activeMobileMonth]?.expense || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Groups (Income first, then Expenses) */}
        <div className="space-y-4">
          {/* INCOME GROUPS */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neon-emerald uppercase tracking-wider px-2">Income breakdown</h4>
            <div className="bg-obsidian-800/40 border border-obsidian-800/80 rounded-2xl p-4 divide-y divide-obsidian-700/30">
              {Object.entries(plData.incomeGroups).map(([group, categoriesMap]) => {
                const groupTotal = Object.values(categoriesMap).reduce((sum, catMap) => sum + (catMap[activeMobileMonth] || 0), 0);
                if (groupTotal === 0) return null;
                return (
                  <div key={group} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-200 mb-1">
                      <span>{group}</span>
                      <span>{formatCurrency(groupTotal)}</span>
                    </div>
                    <div className="space-y-1 pl-3 border-l border-obsidian-700/50">
                      {sortCategories(Object.entries(categoriesMap)).map(([category, monthsMap]) => {
                        const val = monthsMap[activeMobileMonth] || 0;
                        if (val === 0) return null;
                        return (
                          <div key={category} className="flex justify-between items-center text-[11px] text-slate-400">
                            <span className="flex items-center space-x-1.5">
                              <span>{getCategoryEmoji(category)}</span>
                              <span>{category}</span>
                            </span>
                            <span>{formatCurrency(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* EXPENSE GROUPS */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Expense breakdown</h4>
            <div className="bg-obsidian-800/40 border border-obsidian-800/80 rounded-2xl p-4 divide-y divide-obsidian-700/30">
              {Object.entries(plData.expenseGroups).map(([group, categoriesMap]) => {
                const groupTotal = Object.values(categoriesMap).reduce((sum, catMap) => sum + (catMap[activeMobileMonth] || 0), 0);
                if (groupTotal === 0) return null;
                return (
                  <div key={group} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-200 mb-1">
                      <span>{group}</span>
                      <span>{formatCurrency(groupTotal)}</span>
                    </div>
                    <div className="space-y-1 pl-3 border-l border-obsidian-700/50">
                      {sortCategories(Object.entries(categoriesMap)).map(([category, monthsMap]) => {
                        const val = monthsMap[activeMobileMonth] || 0;
                        if (val === 0) return null;
                        return (
                          <div key={category} className="flex justify-between items-center text-[11px] text-slate-400">
                            <span className="flex items-center space-x-1.5">
                              <span>{getCategoryEmoji(category)}</span>
                              <span>{category}</span>
                            </span>
                            <span>{formatCurrency(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Spreadsheet Grid Layout */}
      <div className="hidden md:block bg-obsidian-800 border border-obsidian-700 rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-obsidian-750 bg-obsidian-800/60 font-semibold text-slate-300 text-xs">
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-400 w-64">Category / Group</th>
                {months.map(m => (
                  <th key={m} className="px-4 py-4 text-right font-bold tracking-wider">{m}</th>
                ))}
              </tr>
            </thead>
            
            <tbody className="text-sm divide-y divide-obsidian-800/60">
              {/* --- INCOME SECTION --- */}
              <tr className="bg-neon-emerald/5 border-y border-neon-emerald/10">
                <td className="px-6 py-3 font-bold text-neon-emerald uppercase tracking-wider text-xs">Income</td>
                {months.map(m => (
                  <td key={m} className="px-4 py-3 text-right font-bold text-neon-emerald">
                    {formatCurrency(plData.monthlySummary[m]?.income || 0)}
                  </td>
                ))}
              </tr>

              {Object.entries(plData.incomeGroups).map(([group, categoriesMap]) => {
                const groupHasData = Object.values(categoriesMap).some(isCategoryUsed);
                if (!groupHasData) return null;

                return (
                  <React.Fragment key={group}>
                    {/* Group Header Row */}
                    <tr className="bg-obsidian-800/30">
                      <td className="px-8 py-2 font-bold text-slate-200 text-xs tracking-wide">{group}</td>
                      {months.map(m => {
                        const groupSum = Object.values(categoriesMap).reduce((sum, catMap) => sum + (catMap[m] || 0), 0);
                        return (
                          <td key={m} className="px-4 py-2 text-right font-bold text-slate-300 text-xs">
                            {formatCurrency(groupSum)}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Category Detail Rows */}
                    {sortCategories(Object.entries(categoriesMap)).map(([category, monthsMap]) => {
                      if (!isCategoryUsed(monthsMap)) return null;
                      return (
                        <tr key={category} className="hover:bg-obsidian-750/30 text-slate-400 text-xs transition-colors">
                          <td className="px-12 py-2 font-medium flex items-center space-x-2">
                            <span className="text-sm shrink-0">{getCategoryEmoji(category)}</span>
                            <span className="truncate">{category}</span>
                          </td>
                          {months.map(m => (
                            <td key={m} className="px-4 py-2 text-right">
                              {monthsMap[m] > 0 ? formatCurrency(monthsMap[m]) : '—'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* --- EXPENSE SECTION --- */}
              <tr className="bg-obsidian-900 border-y border-obsidian-850">
                <td className="px-6 py-3 font-bold text-slate-300 uppercase tracking-wider text-xs">Expenses</td>
                {months.map(m => (
                  <td key={m} className="px-4 py-3 text-right font-bold text-slate-300">
                    {formatCurrency(plData.monthlySummary[m]?.expense || 0)}
                  </td>
                ))}
              </tr>

              {Object.entries(plData.expenseGroups).map(([group, categoriesMap]) => {
                const groupHasData = Object.values(categoriesMap).some(isCategoryUsed);
                if (!groupHasData) return null;

                return (
                  <React.Fragment key={group}>
                    {/* Group Header Row */}
                    <tr className="bg-obsidian-800/30">
                      <td className="px-8 py-2 font-bold text-slate-200 text-xs tracking-wide">{group}</td>
                      {months.map(m => {
                        const groupSum = Object.values(categoriesMap).reduce((sum, catMap) => sum + (catMap[m] || 0), 0);
                        return (
                          <td key={m} className="px-4 py-2 text-right font-bold text-slate-300 text-xs">
                            {formatCurrency(groupSum)}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Category Detail Rows */}
                    {sortCategories(Object.entries(categoriesMap)).map(([category, monthsMap]) => {
                      if (!isCategoryUsed(monthsMap)) return null;
                      return (
                        <tr key={category} className="hover:bg-obsidian-750/30 text-slate-400 text-xs transition-colors">
                          <td className="px-12 py-2 font-medium flex items-center space-x-2">
                            <span className="text-sm shrink-0">{getCategoryEmoji(category)}</span>
                            <span className="truncate">{category}</span>
                          </td>
                          {months.map(m => (
                            <td key={m} className="px-4 py-2 text-right">
                              {monthsMap[m] > 0 ? formatCurrency(monthsMap[m]) : '—'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* --- NET CASH FLOW FOOTER --- */}
              <tr className="bg-gradient-to-r from-obsidian-900 to-obsidian-850 border-t border-obsidian-750">
                <td className="px-6 py-4 font-black uppercase text-white tracking-wider text-xs">Net Cash Flow</td>
                {months.map(m => {
                  const net = plData.monthlySummary[m]?.net || 0;
                  return (
                    <td key={m} className={`px-4 py-4 text-right font-black text-base ${net >= 0 ? 'text-neon-emerald' : 'text-neon-crimson'}`}>
                      {formatCurrency(net)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
