import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { formatCurrency } from '../utils/formatting';
import { Sparkles, HelpCircle, ArrowRightLeft, Percent, ToggleLeft, ToggleRight } from 'lucide-react';

export default function Budgets() {
  const { categories, transactions, isLoading } = useAppContext();
  
  // Keep track of which categories have "Rollover" enabled (persisted in local state for mock toggle)
  const [rolloverEnabled, setRolloverEnabled] = useState({
    'Groceries': true,
    'Dining': false,
    'Subscriptions': true,
    'Utilities': false
  });

  const toggleRollover = (category) => {
    setRolloverEnabled(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // 1. Calculate Safe-to-Spend and budget summaries
  const budgetSummary = useMemo(() => {
    let activeMonthKey = '';
    if (transactions.length > 0) {
      const validDates = transactions
        .map(t => new Date(t.date))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b - a);
      if (validDates.length > 0) {
        const latestDate = validDates[0];
        activeMonthKey = latestDate.toLocaleString('default', { month: 'short' }) + " '" + String(latestDate.getFullYear()).slice(-2);
      }
    }

    const currentMonthTxns = transactions.filter(t => {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return false;
      const key = date.toLocaleString('default', { month: 'short' }) + " '" + String(date.getFullYear()).slice(-2);
      return key === activeMonthKey;
    });

    const income = currentMonthTxns.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const spent = currentMonthTxns.filter(t => t.type === 'Expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // safe-to-spend = total income - fixed bills - budgeted allocations
    const budgetedTotal = categories.filter(c => c.type === 'Expense').reduce((sum, c) => sum + c.budget, 0);
    const safeToSpend = Math.max(0, income - spent);

    return { income, spent, budgetedTotal, safeToSpend, activeMonthKey };
  }, [transactions, categories]);

  const budgetItems = useMemo(() => {
    const expenses = categories.filter(c => c.type === 'Expense' && c.budget > 0);
    
    return expenses.map(cat => {
      const spent = transactions
        .filter(t => t.category === cat.category && (() => {
          const date = new Date(t.date);
          if (isNaN(date.getTime())) return false;
          const key = date.toLocaleString('default', { month: 'short' }) + " '" + String(date.getFullYear()).slice(-2);
          return key === budgetSummary.activeMonthKey;
        })())
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      const isRollover = !!rolloverEnabled[cat.category];
      // Generate a mock rollover offset from previous month (e.g. positive unspent or negative overspend)
      const rolloverOffset = isRollover ? (cat.category === 'Groceries' ? 45.20 : cat.category === 'Subscriptions' ? -8.50 : 15.00) : 0;
      
      const adjustedBudget = cat.budget + rolloverOffset;

      return {
        ...cat,
        spent,
        rolloverOffset,
        isRollover,
        adjustedBudget,
        remaining: adjustedBudget - spent,
        percentage: (spent / adjustedBudget) * 100
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [categories, transactions, rolloverEnabled, budgetSummary.activeMonthKey]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-28 bg-obsidian-800 rounded-3xl w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-32 bg-obsidian-800 rounded-3xl"></div>
          <div className="h-32 bg-obsidian-800 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Safe to Spend Panel */}
      <div className="bg-gradient-to-br from-obsidian-800 to-obsidian-900 border border-obsidian-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-neon-emerald/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-neon-emerald">
              <Sparkles size={16} />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Copilot Style Intelligence</span>
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">
              {formatCurrency(budgetSummary.safeToSpend)}
            </h1>
            <p className="text-sm text-slate-400">
              <span className="font-semibold text-white">Safe-to-Spend</span> remaining for {budgetSummary.activeMonthKey || 'this month'}.
            </p>
          </div>

          <div className="flex items-center space-x-6">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Total Income</p>
              <p className="text-base font-bold text-slate-100">{formatCurrency(budgetSummary.income)}</p>
            </div>
            <div className="w-px h-8 bg-obsidian-700"></div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Allocated</p>
              <p className="text-base font-bold text-slate-100">{formatCurrency(budgetSummary.budgetedTotal)}</p>
            </div>
            <div className="w-px h-8 bg-obsidian-700"></div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Spent</p>
              <p className="text-base font-bold text-slate-100">{formatCurrency(budgetSummary.spent)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Budgets Listing */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white tracking-tight">Active Budgets for {budgetSummary.activeMonthKey || 'this month'}</h3>
        <div className="flex items-center space-x-1 text-slate-500 text-xs font-medium">
          <HelpCircle size={14} />
          <span>Budgets are synced with your Tiller Sheets spreadsheet.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgetItems.map(item => (
          <Card key={item.id} className="bg-obsidian-800/40 hover:bg-obsidian-800/60 transition-all duration-300 border-obsidian-800/80 hover:shadow-lg">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {item.category}
                    {item.isRollover && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        item.rolloverOffset > 0 ? 'bg-neon-emerald/10 text-neon-emerald' : 'bg-neon-crimson/10 text-neon-crimson'
                      }`}>
                        {item.rolloverOffset > 0 ? `+${formatCurrency(item.rolloverOffset)} Rollover` : `${formatCurrency(item.rolloverOffset)} Rollover`}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">{item.group}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-white">{formatCurrency(item.spent)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">of {formatCurrency(item.adjustedBudget)}</p>
                </div>
              </div>

              <ProgressBar value={item.spent} max={item.adjustedBudget} className="h-2.5 mb-4" />
              
              <div className="flex justify-between items-center text-sm pt-2 border-t border-obsidian-800/30">
                <span className={`${item.remaining < 0 ? 'text-neon-crimson' : 'text-slate-400'} text-xs font-semibold`}>
                  {item.remaining < 0 ? 'Over budget by ' : 'Remaining: '}
                  <span className="font-bold">{formatCurrency(Math.abs(item.remaining))}</span>
                </span>
                
                {/* Rollover Toggle Control */}
                <button 
                  onClick={() => toggleRollover(item.category)}
                  className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <span className="font-medium">Rollover</span>
                  {item.isRollover ? (
                    <ToggleRight size={20} className="text-neon-indigo shrink-0" />
                  ) : (
                    <ToggleLeft size={20} className="text-slate-600 shrink-0" />
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
