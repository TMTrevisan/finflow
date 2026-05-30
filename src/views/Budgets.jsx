import React, { useMemo, useState } from 'react';
import { useAppContext, resolveBudget } from '../context/AppContext';
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

function BudgetProgressBar({ spent, budget }) {
  const spentAbs = Math.abs(spent);
  const isOver = spentAbs > budget;
  
  if (!isOver) {
    const progressPercent = budget > 0 ? (spentAbs / budget) * 100 : 0;
    let barColor = 'bg-neon-emerald shadow-[0_0_8px_rgba(16,185,129,0.2)]';
    if (progressPercent > 80) {
      barColor = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.2)]';
    }
    return (
      <div className="w-full h-1.5 bg-obsidian-900 rounded-full overflow-hidden relative">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
          style={{ width: `${Math.min(100, progressPercent)}%` }}
        />
      </div>
    );
  } else {
    // Over budget visual: budget point is a vertical tick, excess is pulsing red
    const budgetPercent = spentAbs > 0 ? (budget / spentAbs) * 100 : 100;
    const overPercent = 100 - budgetPercent;
    return (
      <div className="w-full h-1.5 bg-obsidian-900 rounded-full overflow-hidden relative flex">
        {/* Budgeted Portion */}
        <div 
          className="h-full bg-slate-650 transition-all duration-500" 
          style={{ width: `${budgetPercent}%` }}
        />
        {/* Goal limit line separator */}
        <div className="w-[1.5px] h-full bg-white z-10 opacity-80" />
        {/* Over budget portion */}
        <div 
          className="h-full bg-neon-crimson animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)] transition-all duration-500" 
          style={{ width: `${overPercent}%` }}
        />
      </div>
    );
  }
}

export default function Budgets({ setCurrentView }) {
  const { categories = [], transactions = [], isLoading, isMockData } = useAppContext();
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

    // Calculate spent per category for current month
    const latestDate = transactions.length > 0 ? new Date(Math.max(...transactions.map(t => new Date(t.date).getTime()))) : new Date();
    const currentMonth = latestDate.getMonth();
    const currentYear = latestDate.getFullYear();

    const spentMap = {};
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (!isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        if (t.type === 'Expense') {
          spentMap[t.category] = (spentMap[t.category] || 0) + t.amount; // Negative amount
        }
      }
    });

    categories.forEach(cat => {
      if (cat.type !== 'Expense') return;
      const budgetVal = cat.budget || 0;
      const spentVal = spentMap[cat.category] || 0;
      const balanceVal = budgetVal + spentVal; // Spent is negative
      const percentVal = budgetVal > 0 ? (Math.abs(spentVal) / budgetVal) * 100 : 0;
      const group = mapCategoryToGroup(cat.category);

      groups[group].push({
        category: cat.category,
        budget: budgetVal,
        spent: spentVal,
        balance: balanceVal,
        percent: percentVal
      });
    });

    return groups;
  }, [categories, transactions, isMockData]);

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

    // Pacing calculations: Day 21 of 31 is 67.7% of the month
    // Pace comparison is spent vs budgeted pacing fraction
    const remaining = totalBalance;
    const paceProgress = 21 / 31;
    const expectedPacing = totalBudgeted * paceProgress;
    const underPacePct = expectedPacing > 0 ? Math.round(((expectedPacing - totalSpent) / expectedPacing) * 100) : 0;

    return {
      remaining: isMockData ? 8838 : remaining,
      budgeted: isMockData ? 8150 : totalBudgeted,
      spent: isMockData ? 2652 : totalSpent,
      underPace: isMockData ? 23 : underPacePct,
      dayProgress: 'DAY 21 / 31'
    };
  }, [finalGroups, isMockData]);

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

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6 p-4">
        <div className="h-32 bg-[#0B0E14] border border-slate-800/80 rounded-3xl w-full"></div>
        <div className="h-64 bg-[#0B0E14] border border-slate-800/80 rounded-3xl w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-lg mx-auto md:max-w-none">
      {/* 1. Budgets Metric Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5">
        <div className="space-y-1">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Remaining</span>
          <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-baseline">
            {formatCurrency(aggregatedMetrics.remaining)}
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
            of {formatCurrency(aggregatedMetrics.budgeted)} • <span className="text-slate-400">{formatCurrency(aggregatedMetrics.spent)} Spent</span>
          </p>
        </div>

        {/* Pacing Badge Pill */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-2xl text-right">
          <span className="text-[10px] font-black uppercase tracking-wider block">● {aggregatedMetrics.underPace}% under pace</span>
          <span className="text-[9px] text-slate-500 block mt-0.5">{aggregatedMetrics.dayProgress}</span>
        </div>
      </div>

      {/* 2. 10-Dot Category Meter Overview List */}
      <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-5 space-y-4">
        <div className="divide-y divide-slate-800/40">
          {dotCategories.map((item, idx) => {
            const dot = getDotStyle(item.percent, item.remaining);
            const filledDots = '●'.repeat(dot.count);
            const emptyDots = '○'.repeat(10 - dot.count);
            return (
              <div 
                key={idx} 
                onClick={() => handleCategoryClick(item.name)}
                className="flex items-center justify-between py-2 hover:bg-slate-800/10 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2 min-w-0 pr-4">
                  <span className="text-xs text-slate-500 select-none shrink-0">{getCategoryIcon(item.name)}</span>
                  <span className="text-xs font-bold text-slate-300 truncate">{item.name}</span>
                </div>
                
                {/* Dot Meter bar + Value */}
                <div className="flex items-center space-x-4 shrink-0 font-mono">
                  <div className="text-[10px] tracking-[1.5px] select-none">
                    <span className={dot.color}>{filledDots}</span>
                    <span className="text-slate-850">{emptyDots}</span>
                  </div>
                  <span className={`text-xs font-extrabold w-16 text-right ${item.remaining < 0 ? 'text-rose-500' : 'text-slate-200'}`}>
                    {item.remaining < 0 ? '-' : ''}{formatCurrency(Math.abs(item.remaining))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest pt-2 border-t border-slate-800/40">
          <div className="flex items-center space-x-3">
            <span><span className="text-emerald-500">●</span> On Track</span>
            <span><span className="text-amber-500">●</span> Drifting</span>
            <span><span className="text-rose-500">●</span> Over</span>
          </div>
          <span>| Today's Pace</span>
        </div>
      </div>

      {/* 3. Budget Summary Box */}
      <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-5 space-y-3.5">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
          <span>Available funds</span>
          <span className="text-white font-bold">{formatCurrency(17108.14)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-450 border-t border-slate-800/40 pt-3">
          <span>Budgeted</span>
          <span className="text-slate-400 font-bold">-{formatCurrency(8150.00)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-450 border-t border-slate-800/40 pt-3">
          <span>For next month</span>
          <span className="text-slate-500 font-bold">{formatCurrency(0.00)}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-800/60 pt-4 mt-1 text-center">
          <div className="space-y-0.5">
            <span className="text-base font-extrabold text-white">{formatCurrency(8250)}</span>
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Income</span>
          </div>
          <div className="space-y-0.5 border-l border-slate-800/40">
            <span className="text-base font-extrabold text-white">{formatCurrency(8150)}</span>
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Budgeted</span>
          </div>
        </div>
      </div>

      {/* 4. Collapsible Category Groups */}
      <div className="space-y-4">
        {Object.entries(finalGroups).map(([groupName, items]) => {
          if (items.length === 0) return null;
          const isExpanded = expandedGroups[groupName];
          const budgetedSum = items.reduce((sum, item) => sum + item.budget, 0);
          const spentSum = items.reduce((sum, item) => sum + item.spent, 0);
          const balanceSum = items.reduce((sum, item) => sum + item.balance, 0);

          return (
            <div key={groupName} className="bg-[#0B0E14] border border-[#161B26] rounded-3xl overflow-hidden shadow-md">
              {/* Group Toggle Header */}
              <div 
                onClick={() => toggleGroup(groupName)}
                className="flex items-center justify-between p-4 hover:bg-slate-800/10 cursor-pointer select-none transition-colors border-b border-slate-850"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className="text-slate-500">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-100 truncate">{groupName}</h4>
                  <span className="text-[10px] bg-slate-850 border border-slate-800 px-1.5 py-0.2 rounded font-black text-slate-400 shrink-0">
                    {items.length}
                  </span>
                </div>

                <div className="flex items-center space-x-4 shrink-0 text-xs">
                  <span className="font-extrabold text-slate-400">{formatCurrency(budgetedSum)}</span>
                  <span className="font-bold text-slate-500">-{formatCurrency(Math.abs(spentSum))}</span>
                  <span className={`font-black ${balanceSum < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                    {balanceSum < 0 ? '-' : ''}{formatCurrency(Math.abs(balanceSum))}
                  </span>
                </div>
              </div>

              {/* Sub items table/list */}
              {isExpanded && (
                <div className="p-4 space-y-4">
                  {/* Table headers */}
                  <div className="grid grid-cols-12 text-[8px] font-black text-slate-500 uppercase tracking-widest pb-1 border-b border-slate-900">
                    <span className="col-span-5">Category</span>
                    <span className="col-span-2 text-right">Budgeted</span>
                    <span className="col-span-2 text-right">Spent</span>
                    <span className="col-span-3 text-right">Balance</span>
                  </div>

                  <div className="space-y-3.5">
                    {items.map((item, index) => {
                      const isOver = item.balance < 0;
                      return (
                        <div 
                          key={index}
                          onClick={() => handleCategoryClick(item.category)}
                          className="space-y-2 group cursor-pointer hover:bg-slate-800/5 -mx-2 p-2 rounded-xl transition-all"
                        >
                          <div className="grid grid-cols-12 items-center text-xs">
                            <div className="col-span-5 flex items-center space-x-2 min-w-0 pr-2">
                              <span className="text-slate-500 shrink-0 select-none">{getCategoryIcon(item.category)}</span>
                              <span className="font-bold text-slate-200 group-hover:text-emerald-400 truncate transition-colors">{item.category}</span>
                            </div>

                            {/* Budgeted Capsule */}
                            <div className="col-span-2 text-right">
                              <span className="border border-amber-500/25 text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                {formatCurrency(item.budget)}
                              </span>
                            </div>

                            {/* Spent Amount */}
                            <span className="col-span-2 text-right font-semibold text-slate-500">
                              -{formatCurrency(Math.abs(item.spent))}
                            </span>

                            {/* Balance Amount */}
                            <span className={`col-span-3 text-right font-extrabold ${isOver ? 'text-rose-500 font-black' : 'text-emerald-400'}`}>
                              {isOver ? '-' : ''}{formatCurrency(Math.abs(item.balance))}
                            </span>
                          </div>

                          {/* Inline Progress Bar */}
                          <div className="px-1">
                            <BudgetProgressBar 
                              spent={item.spent} 
                              budget={item.budget || 1} 
                            />
                          </div>

                          {/* MoM Delta Badge */}
                          {(() => {
                            const mom = getMoMDelta(item.category, item.spent, item.budget, item.lastMonthSpent);
                            if (!mom) return null;
                            return (
                              <div className="px-1 mt-1.5">
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md inline-block border ${mom.color}`}>
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
