import React, { useMemo, useState } from 'react';
import { useAppContext, resolveBudget } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { formatCurrency } from '../utils/formatting';
import { Sparkles, HelpCircle, ToggleLeft, ToggleRight } from 'lucide-react';

export default function Budgets() {
  const { categories, transactions, isLoading } = useAppContext();
  
  // Keep track of which categories have "Rollover" enabled (persisted in localStorage)
  const [rolloverEnabled, setRolloverEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('finflow_rollover_categories');
      return saved ? JSON.parse(saved) : {
        'Groceries': true,
        'Dining': false,
        'Subscriptions': true,
        'Utilities': false
      };
    } catch {
      return {
        'Groceries': true,
        'Dining': false,
        'Subscriptions': true,
        'Utilities': false
      };
    }
  });

  const toggleRollover = (category) => {
    setRolloverEnabled(prev => {
      const updated = {
        ...prev,
        [category]: !prev[category]
      };
      localStorage.setItem('finflow_rollover_categories', JSON.stringify(updated));
      return updated;
    });
  };

  // Get all unique months from transactions for selection
  const months = useMemo(() => {
    if (transactions.length === 0) return [];
    const monthKeysMap = new Map();
    transactions.forEach(t => {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return;
      const key = date.toLocaleString('default', { month: 'short' }) + " '" + String(date.getFullYear()).slice(-2);
      const sortVal = date.getFullYear() * 12 + date.getMonth();
      monthKeysMap.set(key, { 
        label: key, 
        sortVal, 
        yearFull: date.getFullYear(),
        monthName: date.toLocaleString('default', { month: 'short' }).toLowerCase()
      });
    });
    return Array.from(monthKeysMap.values()).sort((a, b) => a.sortVal - b.sortVal);
  }, [transactions]);

  const [selectedMonthKey, setSelectedMonthKey] = useState(null);

  // Set default month to latest month in dataset
  React.useEffect(() => {
    if (months.length > 0 && !selectedMonthKey) {
      setSelectedMonthKey(months[months.length - 1].label);
    }
  }, [months, selectedMonthKey]);

  const activeMonthInfo = useMemo(() => {
    if (months.length === 0) return null;
    if (!selectedMonthKey) return months[months.length - 1];
    return months.find(m => m.label === selectedMonthKey) || months[months.length - 1];
  }, [selectedMonthKey, months]);

  // 1. Calculate Safe-to-Spend and budget summaries
  const budgetSummary = useMemo(() => {
    if (!activeMonthInfo) return { income: 0, spent: 0, budgetedTotal: 0, safeToSpend: 0, activeMonthKey: '' };

    const activeMonthKey = activeMonthInfo.label;
    const currentMonthTxns = transactions.filter(t => {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return false;
      const key = date.toLocaleString('default', { month: 'short' }) + " '" + String(date.getFullYear()).slice(-2);
      return key === activeMonthKey;
    });

    const income = currentMonthTxns.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const spent = currentMonthTxns.filter(t => t.type === 'Expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // safe-to-spend = total income - budgeted allocations (fixed and variable)
    const budgetedTotal = categories
      .filter(c => c.type === 'Expense')
      .reduce((sum, c) => sum + resolveBudget(c, activeMonthInfo.monthName, activeMonthInfo.yearFull), 0);
      
    const safeToSpend = Math.max(0, income - spent);

    return { income, spent, budgetedTotal, safeToSpend, activeMonthKey };
  }, [transactions, categories, activeMonthInfo]);

  const budgetItems = useMemo(() => {
    if (!activeMonthInfo) return [];

    const expenses = categories.filter(c => c.type === 'Expense' && resolveBudget(c, activeMonthInfo.monthName, activeMonthInfo.yearFull) > 0);
    
    // Previous month details from chronological months list
    const activeIndex = months.findIndex(m => m.label === activeMonthInfo.label);
    const prevMonthInfo = activeIndex > 0 ? months[activeIndex - 1] : null;
    
    // Calculate previous month's transactions per category
    const prevSpentMap = {};
    if (prevMonthInfo) {
      transactions.forEach(t => {
        const date = new Date(t.date);
        if (isNaN(date.getTime())) return;
        const key = date.toLocaleString('default', { month: 'short' }) + " '" + String(date.getFullYear()).slice(-2);
        if (key === prevMonthInfo.label && t.type === 'Expense') {
          const catName = t.category || '';
          prevSpentMap[catName] = (prevSpentMap[catName] || 0) + Math.abs(t.amount);
        }
      });
    }

    return expenses.map(cat => {
      const catBudget = resolveBudget(cat, activeMonthInfo.monthName, activeMonthInfo.yearFull);
      const spent = transactions
        .filter(t => t.category === cat.category && (() => {
          const date = new Date(t.date);
          if (isNaN(date.getTime())) return false;
          const key = date.toLocaleString('default', { month: 'short' }) + " '" + String(date.getFullYear()).slice(-2);
          return key === budgetSummary.activeMonthKey;
        })())
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      const isRollover = !!rolloverEnabled[cat.category];
      
      // Calculate dynamic rollover offset
      let rolloverOffset = 0;
      if (isRollover && prevMonthInfo) {
        const prevBudget = resolveBudget(cat, prevMonthInfo.monthName, prevMonthInfo.yearFull);
        const prevSpent = prevSpentMap[cat.category] || 0;
        
        // Rollover = budget - spent
        rolloverOffset = prevBudget - prevSpent;
      }
      
      const adjustedBudget = catBudget + rolloverOffset;

      return {
        ...cat,
        budget: catBudget,
        spent,
        rolloverOffset,
        isRollover,
        adjustedBudget,
        remaining: adjustedBudget - spent,
        percentage: adjustedBudget > 0 ? (spent / adjustedBudget) * 100 : 0
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [categories, transactions, rolloverEnabled, budgetSummary.activeMonthKey, activeMonthInfo, months]);

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
      {/* Month Selector */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-0 md:px-0 hide-scrollbar">
        {months.map((m) => (
          <button
            key={m.label}
            onClick={() => setSelectedMonthKey(m.label)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all shrink-0 ${
              selectedMonthKey === m.label
                ? 'bg-neon-indigo border-neon-indigo text-white shadow-lg shadow-neon-indigo/20'
                : 'bg-obsidian-850 hover:bg-obsidian-750 border-obsidian-750 text-slate-400 hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

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
          <span>Budgets are synced with your Tiller Sheets.</span>
        </div>
      </div>

      {/* Desktop view: Grid of cards */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Mobile view: Compact List to fit 8+ budgets on screen */}
      <div className="md:hidden divide-y divide-obsidian-800/50 bg-obsidian-800/20 border border-obsidian-800/80 rounded-2xl p-4 space-y-4">
        {budgetItems.map(item => (
          <div key={item.id} className="pt-3 first:pt-0 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <div className="min-w-0 pr-4">
                <span className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
                  {item.category}
                  {item.isRollover && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                      item.rolloverOffset > 0 ? 'bg-neon-emerald/10 text-neon-emerald' : 'bg-neon-crimson/10 text-neon-crimson'
                    }`}>
                      {item.rolloverOffset > 0 ? `+${formatCurrency(item.rolloverOffset)}` : `${formatCurrency(item.rolloverOffset)}`}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-bold text-slate-200">{formatCurrency(item.spent)}</span>
                <span className="text-slate-500 font-medium"> / {formatCurrency(item.adjustedBudget)}</span>
              </div>
            </div>
            
            <ProgressBar value={item.spent} max={item.adjustedBudget} className="h-1.5" />
            
            <div className="flex justify-between items-center text-[10px]">
              <span className={`font-semibold ${item.remaining < 0 ? 'text-neon-crimson' : 'text-slate-400'}`}>
                {item.remaining < 0 ? `Over by ${formatCurrency(Math.abs(item.remaining))}` : `${formatCurrency(item.remaining)} left`}
              </span>
              <button 
                onClick={() => toggleRollover(item.category)}
                className="flex items-center space-x-1 text-slate-500 hover:text-slate-300"
              >
                <span>Rollover:</span>
                <span className={`font-bold uppercase ${item.isRollover ? 'text-neon-indigo' : 'text-slate-600'}`}>
                  {item.isRollover ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
