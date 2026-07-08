import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { resolveBudget } from '../utils/dataPrep';
import { Card, CardContent } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { formatCurrency } from '../utils/formatting';
import { 
  ChevronDown, 
  ChevronUp, 
  Wifi, 
  Phone, 
  Home, 
  Zap, 
  Coffee, 
  Utensils, 
  Film, 
  ShoppingCart, 
  Heart, 
  ShoppingBag, 
  CalendarRange, 
  Car, 
  Bike, 
  Plane, 
  Dumbbell, 
  Percent, 
  Activity, 
  PlusSquare, 
  GraduationCap, 
  TrendingUp, 
  PiggyBank, 
  Wallet,
  ArrowRight
} from 'lucide-react';

const ICON_MAP = {
  // Home & Bills
  'internet': Wifi,
  'phone': Phone,
  'rent': Home,
  'utilities': Zap,
  // Daily Life
  'coffee': Coffee,
  'coffee & bars': Coffee,
  'dining': Utensils,
  'dining out': Utensils,
  'entertainment': Film,
  'groceries': ShoppingCart,
  'personal': Heart,
  'personal care': Heart,
  'shopping': ShoppingBag,
  'subscriptions': CalendarRange,
  // Mobility & Travel
  'gas': Car,
  'rideshare': Bike,
  'travel': Plane,
  // Health & Debt
  'gym': Dumbbell,
  'interest': Percent,
  'interest & fees': Percent,
  'medical': Activity,
  'pharmacy': PlusSquare,
  'student': GraduationCap,
  'student loans': GraduationCap,
  // Investments
  'emergency': PiggyBank,
  'emergency fund': PiggyBank,
  'roth': TrendingUp,
  'roth ira': TrendingUp,
  'brokerage': Wallet
};

const getCategoryIcon = (name) => {
  const cleanName = String(name || '').toLowerCase().trim();
  const IconComponent = ICON_MAP[cleanName] || ICON_MAP[Object.keys(ICON_MAP).find(k => cleanName.includes(k))] || Wallet;
  return <IconComponent size={14} className="shrink-0" />;
};

function BudgetProgressBar({ spent, budget, paceProgress }) {
  const spentAbs = Math.abs(spent);
  const isOver = spentAbs > budget;
  const progressPercent = budget > 0 ? (spentAbs / budget) * 100 : 0;
  
  return (
    <div className="relative w-full py-1">
      {/* Pacing Marker representing current day in month */}
      {paceProgress > 0 && paceProgress < 1 && (
        <div 
          className="absolute top-0 bottom-0 w-[2px] bg-slate-400/40 dark:bg-slate-500/50 z-20 pointer-events-none"
          style={{ left: `${paceProgress * 100}%` }}
          title="Current day in month"
        />
      )}
      
      <div className="w-full h-2 bg-obsidian-950 rounded-full overflow-hidden relative">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            isOver 
              ? 'bg-rose-500' 
              : progressPercent > 90 
                ? 'bg-amber-500' 
                : 'bg-emerald-500'
          }`} 
          style={{ width: `${Math.min(100, progressPercent)}%` }}
        />
      </div>
    </div>
  );
}

// Mock data representing the exact values in the user's second screenshot
const mockBudgetGroups = {
  'Home & Bills': [
    { category: 'Internet', budget: 70.00, spent: -70.00, balance: 0.00, percent: 100 },
    { category: 'Phone', budget: 85.05, spent: -85.05, balance: 0.00, percent: 100 }, // Matching exact totals
    { category: 'Rent', budget: 1600.00, spent: -1400.00, balance: 900.00, percent: 87.5 }, // 700 rollover
    { category: 'Utilities', budget: 140.00, spent: -96.00, balance: 36.00, percent: 68.6 }
  ],
  'Daily Life': [
    { category: 'Coffee & Bars', budget: 150.00, spent: -142.00, balance: 228.00, percent: 94.7 },
    { category: 'Dining Out', budget: 320.00, spent: -138.00, balance: 363.00, percent: 43.1 },
    { category: 'Entertainment', budget: 180.00, spent: -142.00, balance: 242.00, percent: 78.9 },
    { category: 'Groceries', budget: 750.00, spent: -205.00, balance: 1131.55, percent: 27.3 },
    { category: 'Personal Care', budget: 120.00, spent: -64.00, balance: 128.00, percent: 53.3 },
    { category: 'Shopping', budget: 350.00, spent: -154.00, balance: 415.00, percent: 44.0 },
    { category: 'Subscriptions', budget: 60.00, spent: -46.00, balance: 62.01, percent: 76.7 }
  ],
  'Mobility & Travel': [
    { category: 'Gas', budget: 120.00, spent: -42.00, balance: 157.00, percent: 35.0 },
    { category: 'Rideshare', budget: 90.00, spent: -28.00, balance: 120.00, percent: 31.1 },
    { category: 'Travel', budget: 350.00, spent: -420.00, balance: -20.00, percent: 120.0 }
  ],
  'Health & Debt': [
    { category: 'Gym', budget: 60.00, spent: -60.00, balance: 0.00, percent: 100 },
    { category: 'Interest & Fees', budget: 65.00, spent: -80.05, balance: 30.00, percent: 123 },
    { category: 'Medical', budget: 100.00, spent: -75.00, balance: 75.00, percent: 75 },
    { category: 'Pharmacy', budget: 40.00, spent: -22.00, balance: 40.00, percent: 55 },
    { category: 'Student Loans', budget: 250.00, spent: -250.00, balance: 0.00, percent: 100 }
  ],
  'Investments & Savings': [
    { category: 'Emergency Fund', budget: 2600.00, spent: -2600.00, balance: 2600.00, percent: 100 },
    { category: 'Roth IRA', budget: 1750.00, spent: -1750.00, balance: 1750.00, percent: 100 },
    { category: 'Brokerage', budget: 1000.00, spent: -1000.00, balance: 1000.00, percent: 100 }
  ]
};

export default function Budgets({ setCurrentView }) {
  const { categories = [], transactions = [], isLoading, isMockData, referenceDate } = useAppContext();
  const [expandedGroups, setExpandedGroups] = useState({
    'Home & Bills': true,
    'Daily Life': true,
    'Mobility & Travel': true,
    'Health & Debt': true,
    'Investments & Savings': true
  });

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const handleCategoryClick = (categoryName) => {
    sessionStorage.setItem('finflow_deep_category', categoryName);
    if (setCurrentView) setCurrentView('transactions');
  };

  const getDotStyle = (percent, remaining) => {
    if (remaining < 0) return { color: 'text-rose-500', count: 10 };
    if (percent > 80) return { color: 'text-amber-500', count: Math.min(10, Math.ceil(percent / 10)) };
    return { color: 'text-emerald-500', count: Math.max(1, Math.min(10, Math.ceil(percent / 10))) };
  };

  // Helper to resolve standard mapping for live data
  const mapCategoryToGroup = (catName) => {
    const name = String(catName || '').toLowerCase();
    if (name.includes('internet') || name.includes('phone') || name.includes('rent') || name.includes('utilities') || name.includes('utility') || name.includes('wifi') || name.includes('bills') || name.includes('housing')) {
      return 'Home & Bills';
    }
    if (name.includes('coffee') || name.includes('dining') || name.includes('food') || name.includes('entertainment') || name.includes('groceries') || name.includes('grocery') || name.includes('personal') || name.includes('shopping') || name.includes('subscription')) {
      return 'Daily Life';
    }
    if (name.includes('gas') || name.includes('rideshare') || name.includes('travel') || name.includes('auto') || name.includes('car') || name.includes('uber')) {
      return 'Mobility & Travel';
    }
    if (name.includes('gym') || name.includes('interest') || name.includes('medical') || name.includes('pharmacy') || name.includes('loan') || name.includes('fitness') || name.includes('debt')) {
      return 'Health & Debt';
    }
    if (name.includes('emergency') || name.includes('ira') || name.includes('brokerage') || name.includes('savings') || name.includes('investment') || name.includes('vanguard')) {
      return 'Investments & Savings';
    }
    return 'Daily Life'; // default fallback
  };

  // Calculate dynamic groups or map mock groups
  const finalGroups = useMemo(() => {
    if (isMockData) {
      return mockBudgetGroups;
    }

    // Dynamic calculator for live connected sheets
    const groups = {
      'Home & Bills': [],
      'Daily Life': [],
      'Mobility & Travel': [],
      'Health & Debt': [],
      'Investments & Savings': []
    };

    const refDateObj = referenceDate || new Date();
    const currentMonth = refDateObj.getUTCMonth();
    const currentYear = refDateObj.getUTCFullYear();

    // Get last month's month and year
    let lastMonth = currentMonth - 1;
    let lastMonthYear = currentYear;
    if (lastMonth < 0) {
      lastMonth = 11;
      lastMonthYear = currentYear - 1;
    }

    const spentMap = {};
    const lastMonthSpentMap = {};
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) {
        if (d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear) {
          if (t.type === 'Expense') {
            const cleanCat = (t.category || '').trim().toLowerCase();
            spentMap[cleanCat] = (spentMap[cleanCat] || 0) + t.amount; // Negative amount
          }
        } else if (d.getUTCMonth() === lastMonth && d.getUTCFullYear() === lastMonthYear) {
          if (t.type === 'Expense') {
            const cleanCat = (t.category || '').trim().toLowerCase();
            lastMonthSpentMap[cleanCat] = (lastMonthSpentMap[cleanCat] || 0) + t.amount;
          }
        }
      }
    });

    categories.forEach(cat => {
      if (cat.type !== 'Expense') return;
      const budgetVal = cat.budget || 0;
      const cleanCat = (cat.category || '').trim().toLowerCase();
      const spentVal = spentMap[cleanCat] || 0;
      const balanceVal = budgetVal + spentVal; // Spent is negative
      const percentVal = budgetVal > 0 ? (Math.abs(spentVal) / budgetVal) * 100 : 0;
      const group = mapCategoryToGroup(cat.category);

      groups[group].push({
        category: cat.category,
        budget: budgetVal,
        spent: spentVal,
        balance: balanceVal,
        percent: percentVal,
        lastMonthSpent: lastMonthSpentMap[cleanCat] || 0
      });
    });

    return groups;
  }, [categories, transactions, isMockData, referenceDate]);

  // Aggregate metrics for header summaries
  const aggregatedMetrics = useMemo(() => {
    let totalBudgeted = 0;
    let totalSpent = 0;
    let totalBalance = 0;

    Object.values(finalGroups).forEach(items => {
      items.forEach(item => {
        totalBudgeted += item.budget;
        totalSpent += Math.abs(item.spent);
        totalBalance += item.balance;
      });
    });

    const refDateObj = referenceDate || new Date();
    const currentDay = refDateObj.getDate();
    const totalDays = new Date(refDateObj.getFullYear(), refDateObj.getMonth() + 1, 0).getDate();
    const paceProgress = currentDay / totalDays;
    const expectedPacing = totalBudgeted * paceProgress;
    const underPacePct = expectedPacing > 0 ? Math.round(((expectedPacing - totalSpent) / expectedPacing) * 100) : 0;

    return {
      remaining: totalBalance,
      budgeted: totalBudgeted,
      spent: totalSpent,
      underPace: underPacePct,
      dayProgress: `DAY ${currentDay} / ${totalDays}`,
      paceProgress
    };
  }, [finalGroups, referenceDate]);

  const incomeMetrics = useMemo(() => {
    let budgetTotal = 0;
    let actualTotal = 0;

    if (isMockData) {
      return { budget: 8250, actual: 8250 };
    }

    categories.forEach(c => {
      if (c.type === 'Income') budgetTotal += c.budget || 0;
    });

    const refDateObj = referenceDate || new Date();
    const currentMonth = refDateObj.getUTCMonth();
    const currentYear = refDateObj.getUTCFullYear();

    transactions.forEach(t => {
      const d = new Date(t.date);
      if (d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear && t.type === 'Income') {
        actualTotal += t.amount || 0;
      }
    });

    return { budget: budgetTotal, actual: actualTotal };
  }, [categories, transactions, isMockData, referenceDate]);

  // Dot-meter overview categories list (12 items matching screenshot)
  const dotCategories = useMemo(() => {
    if (isMockData) {
      return [
        { name: 'Emergency Fund', remaining: 2600, percent: 15 },
        { name: 'Roth IRA', remaining: 1750, percent: 20 },
        { name: 'Rent', remaining: 400, percent: 85 },
        { name: 'Groceries', remaining: 1132, percent: 27 },
        { name: 'Brokerage', remaining: 1000, percent: 20 },
        { name: 'Travel', remaining: -20, percent: 120 },
        { name: 'Shopping', remaining: 415, percent: 44 },
        { name: 'Dining Out', remaining: 363, percent: 43 },
        { name: 'Student Loans', remaining: 0, percent: 100 },
        { name: 'Entertainment', remaining: 242, percent: 78 },
        { name: 'Coffee & Bars', remaining: 228, percent: 94 },
        { name: 'Other (11)', remaining: 728, percent: 55 }
      ];
    }

    // Generate list from actual sheet categories
    const allItems = [];
    Object.values(finalGroups).forEach(items => {
      items.forEach(item => {
        allItems.push({
          name: item.category,
          remaining: item.balance,
          percent: item.percent
        });
      });
    });
    return allItems.sort((a, b) => b.remaining - a.remaining).slice(0, 12);
  }, [finalGroups, isMockData]);

  // Helper to compute Month-over-Month Delta badge
  const getMoMDelta = (categoryName, currentSpent, budgetVal, lastMonthSpentVal) => {
    let lastMonthSpent = lastMonthSpentVal || 0;
    if (isMockData) {
      const hash = categoryName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const factor = 0.75 + (hash % 5) * 0.1;
      lastMonthSpent = -(budgetVal * factor);
    }
    const currentAbs = Math.abs(currentSpent);
    const lastAbs = Math.abs(lastMonthSpent);
    if (lastAbs === 0) return null;
    const diff = currentAbs - lastAbs;
    const diffStr = formatCurrency(Math.abs(diff));
    if (diff > 0) {
      return {
        text: `↑ ${diffStr} more than last month`,
        color: 'text-rose-500 bg-rose-500/10 border border-rose-500/20'
      };
    } else {
      return {
        text: `↓ ${diffStr} less than last month`,
        color: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
      };
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6 p-4">
        <div className="h-32 bg-[#0B0E14] border border-slate-800/80 rounded-3xl w-full animate-pulse"></div>
        <div className="h-64 bg-[#0B0E14] border border-slate-800/80 rounded-3xl w-full animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-lg mx-auto md:max-w-none">
      {/* 1. Monarch Style Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income Card */}
        <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-5 space-y-2.5">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Income</span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-white font-variant-numeric:tabular-nums">{formatCurrency(incomeMetrics.actual)}</span>
            <span className="text-xs text-slate-500">of {formatCurrency(incomeMetrics.budget)}</span>
          </div>
          <div className="w-full h-1.5 bg-obsidian-950 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, incomeMetrics.budget > 0 ? (incomeMetrics.actual / incomeMetrics.budget) * 100 : 0)}%` }}
            />
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-5 space-y-2.5">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Expenses</span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-white font-variant-numeric:tabular-nums">{formatCurrency(aggregatedMetrics.spent)}</span>
            <span className="text-xs text-slate-500">of {formatCurrency(aggregatedMetrics.budgeted)}</span>
          </div>
          <div className="w-full h-1.5 bg-obsidian-950 rounded-full overflow-hidden relative">
            {aggregatedMetrics.paceProgress > 0 && aggregatedMetrics.paceProgress < 1 && (
              <div 
                className="absolute top-0 bottom-0 w-[1.5px] bg-slate-400/50 z-15" 
                style={{ left: `${aggregatedMetrics.paceProgress * 100}%` }} 
              />
            )}
            <div 
              className={`h-full rounded-full transition-all duration-500 ${aggregatedMetrics.spent > aggregatedMetrics.budgeted ? 'bg-rose-500' : 'bg-emerald-500'}`} 
              style={{ width: `${Math.min(100, aggregatedMetrics.budgeted > 0 ? (aggregatedMetrics.spent / aggregatedMetrics.budgeted) * 100 : 0)}%` }}
            />
          </div>
        </div>

        {/* Remaining Card */}
        <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-5 space-y-2.5">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Remaining</span>
          <div className="flex items-baseline space-x-1.5">
            <span className={`text-2xl font-black font-variant-numeric:tabular-nums ${aggregatedMetrics.remaining >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {aggregatedMetrics.remaining < 0 ? '-' : ''}{formatCurrency(Math.abs(aggregatedMetrics.remaining))}
            </span>
            <span className="text-xs text-slate-500">left to spend</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-extrabold tracking-wide uppercase mt-0.5">
            <span className={aggregatedMetrics.underPace >= 0 ? 'text-emerald-450' : 'text-rose-400'}>
              {aggregatedMetrics.underPace >= 0 
                ? `● ${aggregatedMetrics.underPace}% under pace` 
                : `⚠️ ${Math.abs(aggregatedMetrics.underPace)}% over pace`
              }
            </span>
            <span className="text-slate-500 font-bold">{aggregatedMetrics.dayProgress}</span>
          </div>
        </div>
      </div>

      {/* 2. Collapsible Category Groups */}
      <div className="space-y-4">
        {Object.entries(finalGroups).map(([groupName, items]) => {
          if (items.length === 0) return null;
          const isExpanded = expandedGroups[groupName];
          const budgetedSum = items.reduce((sum, item) => sum + item.budget, 0);
          const spentSum = items.reduce((sum, item) => sum + item.spent, 0);
          const balanceSum = items.reduce((sum, item) => sum + item.balance, 0);

          return (
            <div key={groupName} className="bg-[#0B0E14] border border-[#161B26] rounded-3xl overflow-hidden shadow-sm">
              {/* Group Toggle Header */}
              <div 
                onClick={() => toggleGroup(groupName)}
                className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-800/10 cursor-pointer select-none transition-colors border-b border-slate-850/60"
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-4">
                  <span className="text-slate-500">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-100 truncate">{groupName}</h4>
                  <span className="text-[10px] bg-slate-850 border border-slate-800/80 px-1.5 py-0.2 rounded font-black text-slate-400 shrink-0">
                    {items.length}
                  </span>
                </div>

                {/* Group aggregated pacing bar (desktop only) */}
                <div className="hidden md:block w-32 px-4 shrink-0">
                  <BudgetProgressBar 
                    spent={spentSum} 
                    budget={budgetedSum || 1} 
                    paceProgress={aggregatedMetrics.paceProgress}
                  />
                </div>

                <div className="flex items-center space-x-5 shrink-0 text-xs font-mono">
                  <span className="font-extrabold text-slate-400 w-16 text-right">{formatCurrency(budgetedSum)}</span>
                  <span className="font-bold text-slate-500 w-16 text-right">-{formatCurrency(Math.abs(spentSum))}</span>
                  <span className={`font-black w-16 text-right ${balanceSum < 0 ? 'text-rose-500' : 'text-emerald-450'}`}>
                    {balanceSum < 0 ? '-' : ''}{formatCurrency(Math.abs(balanceSum))}
                  </span>
                </div>
              </div>

              {/* Sub items table/list */}
              {isExpanded && (
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Table headers */}
                  <div className="grid grid-cols-12 text-[9px] font-black text-slate-500 uppercase tracking-widest pb-1.5 border-b border-slate-850/60">
                    <span className="col-span-6 sm:col-span-4">Category</span>
                    <span className="hidden sm:inline sm:col-span-3 text-center">Activity & Pacing</span>
                    <span className="col-span-3 sm:col-span-2 text-right">Spent</span>
                    <span className="hidden sm:inline sm:col-span-1 text-right">Limit</span>
                    <span className="col-span-3 sm:col-span-2 text-right">Remaining</span>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((item, index) => {
                      const isOver = item.balance < 0;
                      return (
                        <div 
                          key={index}
                          onClick={() => handleCategoryClick(item.category)}
                          className="space-y-1.5 group cursor-pointer hover:bg-slate-800/10 -mx-2 p-2 rounded-xl transition-colors"
                        >
                          <div className="grid grid-cols-12 items-center text-xs">
                            {/* Category Icon & Name */}
                            <div className="col-span-6 sm:col-span-4 flex items-center space-x-2.5 min-w-0 pr-2">
                              <span className="text-slate-550 shrink-0 select-none">{getCategoryIcon(item.category)}</span>
                              <span className="font-bold text-slate-200 group-hover:text-neon-indigo truncate transition-colors">{item.category}</span>
                            </div>

                            {/* Pacing bar (desktop only) */}
                            <div className="hidden sm:block sm:col-span-3 px-3">
                              <BudgetProgressBar 
                                spent={item.spent} 
                                budget={item.budget || 1} 
                                paceProgress={aggregatedMetrics.paceProgress}
                              />
                            </div>

                            {/* Spent Amount */}
                            <span className="col-span-3 sm:col-span-2 text-right font-medium text-slate-500 font-mono">
                              -{formatCurrency(Math.abs(item.spent))}
                            </span>

                            {/* Limit/Budget (desktop only) */}
                            <span className="hidden sm:block sm:col-span-1 text-right font-medium text-slate-400 font-mono">
                              {formatCurrency(item.budget)}
                            </span>

                            {/* Remaining Amount */}
                            <span className={`col-span-3 sm:col-span-2 text-right font-extrabold font-mono ${isOver ? 'text-rose-500' : 'text-emerald-450'}`}>
                              {isOver ? '-' : ''}{formatCurrency(Math.abs(item.balance))}
                            </span>
                          </div>

                          {/* MoM Delta Badge */}
                          {(() => {
                            const mom = getMoMDelta(item.category, item.spent, item.budget, item.lastMonthSpent);
                            if (!mom) return null;
                            return (
                              <div className="pl-8 mt-1">
                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md inline-block border ${mom.color}`}>
                                  {mom.text}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
