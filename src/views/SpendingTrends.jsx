import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import LineChart from '../components/ui/LineChart';
import { formatCurrency, cleanMerchantName, getCategoryEmoji } from '../utils/formatting';
import { Card, CardContent } from '../components/ui/Card';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Info, HelpCircle } from 'lucide-react';

export default function SpendingTrends() {
  const { transactions = [], balances = [], isLoading } = useAppContext();
  const [insightPeriod, setInsightPeriod] = useState('30_days');
  const [expandedCategories, setExpandedCategories] = useState({});

  const toggleCategoryExpanded = (name) => {
    setExpandedCategories(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Find the latest transaction date to use as reference date
  const referenceDate = useMemo(() => {
    if (!transactions || transactions.length === 0) return new Date();
    const dates = transactions
      .map(t => new Date(t.date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => b - a);
    return dates.length > 0 ? dates[0] : new Date();
  }, [transactions]);

  // Calculations for Spent Yesterday, Past 7 Days, Past 30 Days
  const spentYesterday = useMemo(() => {
    const yesterday = new Date(referenceDate.getTime());
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    return transactions
      .filter(t => t.type === 'Expense' && t.date === yesterdayStr)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
  }, [transactions, referenceDate]);

  const spent7Days = useMemo(() => {
    const start = new Date(referenceDate.getTime());
    start.setDate(start.getDate() - 7);
    return transactions
      .filter(t => {
        if (t.type !== 'Expense') return false;
        const d = new Date(t.date);
        return d >= start && d <= referenceDate;
      })
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
  }, [transactions, referenceDate]);

  const spent30Days = useMemo(() => {
    const start = new Date(referenceDate.getTime());
    start.setDate(start.getDate() - 30);
    return transactions
      .filter(t => {
        if (t.type !== 'Expense') return false;
        const d = new Date(t.date);
        return d >= start && d <= referenceDate;
      })
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
  }, [transactions, referenceDate]);

  // Deduplicate and aggregate latest balances
  const latestBalances = useMemo(() => {
    const latestMap = new Map();
    const sorted = [...(balances || [])]
      .filter(b => b && b.date && b.institution && b.account)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(b => {
      const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
      latestMap.set(key, b);
    });
    return Array.from(latestMap.values());
  }, [balances]);

  const totals = useMemo(() => {
    let assets = 0;
    let liabilities = 0;

    latestBalances.forEach(b => {
      if (!b) return;
      const val = Number(b.balance) || 0;
      if (b.class === 'Asset') {
        assets += val;
      } else if (b.class === 'Liability') {
        liabilities += Math.abs(val);
      }
    });

    return {
      assets,
      liabilities,
      netWorth: assets - liabilities
    };
  }, [latestBalances]);

  // Line chart daily expenses for the past 30 days
  const dailyExpensesData = useMemo(() => {
    const dataMap = {};
    // Seed the map with last 30 days chronologically
    for (let i = 29; i >= 0; i--) {
      const d = new Date(referenceDate.getTime());
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dataMap[key] = 0;
    }
    
    transactions.forEach(t => {
      if (t.type !== 'Expense' || !t.date) return;
      if (t.date in dataMap) {
        dataMap[t.date] += Math.abs(Number(t.amount) || 0);
      }
    });
    
    return Object.entries(dataMap).map(([dateStr, val]) => {
      const dObj = new Date(dateStr + 'T00:00:00');
      const label = dObj.toLocaleDateString('default', { month: 'short', day: 'numeric' });
      return {
        date: label,
        netWorth: val // LineChart expects value mapped to 'netWorth' key
      };
    });
  }, [transactions, referenceDate]);

  // Date range filters for active selection
  const activeRange = useMemo(() => {
    const now = new Date(referenceDate.getTime());
    const start = new Date(referenceDate.getTime());
    switch (insightPeriod) {
      case '7_days':
        start.setDate(now.getDate() - 7);
        return { start, end: now, days: 7, label: 'Past 7 days' };
      case '30_days':
        start.setDate(now.getDate() - 30);
        return { start, end: now, days: 30, label: 'Past 30 days' };
      case 'this_month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        return { start, end: now, days: now.getDate() || 1, label: 'This Month' };
      case 'last_month': {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const diffTime = Math.abs(last - first);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { start: first, end: last, days: diffDays || 30, label: 'Last Month' };
      }
      case 'this_year':
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const yDiff = Math.abs(now - start);
        const yDays = Math.ceil(yDiff / (1000 * 60 * 60 * 24)) || 1;
        return { start, end: now, days: yDays, label: 'This Year' };
      default:
        start.setDate(now.getDate() - 30);
        return { start, end: now, days: 30, label: 'Past 30 days' };
    }
  }, [insightPeriod, referenceDate]);

  // Calculations inside selected Insight Period
  const insightMetrics = useMemo(() => {
    const inRangeTxns = transactions.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d >= activeRange.start && d <= activeRange.end;
    });

    const income = inRangeTxns
      .filter(t => t.type === 'Income')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    const expense = inRangeTxns
      .filter(t => t.type === 'Expense')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    const needsCategorizing = inRangeTxns
      .filter(t => !t.category || t.category.toLowerCase() === 'uncategorized')
      .length;

    // Grouping by Category for Breakdown
    const incomeCategoriesMap = {};
    const expenseCategoriesMap = {};

    inRangeTxns.forEach(t => {
      const amt = Math.abs(Number(t.amount) || 0);
      const cat = t.category || 'Uncategorized';
      if (t.type === 'Income') {
        incomeCategoriesMap[cat] = (incomeCategoriesMap[cat] || 0) + amt;
      } else if (t.type === 'Expense') {
        expenseCategoriesMap[cat] = (expenseCategoriesMap[cat] || 0) + amt;
      }
    });

    const incomeBreakdown = Object.entries(incomeCategoriesMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const expenseBreakdown = Object.entries(expenseCategoriesMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      income,
      expense,
      cashFlow: income - expense,
      needsCategorizing,
      avgDailyExpense: expense / activeRange.days,
      incomeBreakdown,
      expenseBreakdown
    };
  }, [transactions, activeRange]);

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
      {/* 1. Spent Cards & Net Worth Header Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 bg-obsidian-800 p-6 rounded-3xl border border-obsidian-750 shadow-xl items-center">
        <div className="flex flex-col space-y-1 justify-center border-r border-obsidian-700/40 pr-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Spent Yesterday</span>
          <span className="text-xl font-extrabold text-white">{formatCurrency(spentYesterday)}</span>
        </div>
        <div className="flex flex-col space-y-1 justify-center border-r border-obsidian-700/40 pr-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Spent Past 7 Days</span>
          <span className="text-xl font-extrabold text-white">{formatCurrency(spent7Days)}</span>
        </div>
        <div className="flex flex-col space-y-1 justify-center lg:border-r lg:border-obsidian-700/40 pr-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Spent Past 30 Days</span>
          <span className="text-xl font-extrabold text-white">{formatCurrency(spent30Days)}</span>
        </div>
        
        {/* Line Chart showing past 30 days daily expenses */}
        <div className="col-span-1 md:col-span-3 lg:col-span-4 h-24 flex items-center justify-center pt-2">
          <div className="w-full h-full relative">
            <div className="absolute top-0 right-0 text-[8px] text-slate-500 font-bold uppercase">Daily Expenses (30 Days)</div>
            <LineChart 
              data={dailyExpensesData} 
              height={90} 
              lineColor="#6366F1"
              glowColor="#6366F1"
              gradientColor="#6366F1"
              fillOpacity={0.05}
              strokeWidth={1.5}
              showGrid={false}
            />
          </div>
        </div>
      </div>

      {/* 2. Assets & Net Worth Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 flex items-center space-x-4">
          <div className="p-3 bg-neon-emerald/10 text-neon-emerald rounded-2xl shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current Assets</p>
            <p className="text-xl font-extrabold text-white truncate mt-1">{formatCurrency(totals.assets)}</p>
          </div>
        </Card>
        
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 flex items-center space-x-4">
          <div className="p-3 bg-neon-crimson/10 text-neon-crimson rounded-2xl shrink-0">
            <TrendingDown size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current Liabilities</p>
            <p className="text-xl font-extrabold text-white truncate mt-1">{formatCurrency(totals.liabilities)}</p>
          </div>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 flex items-center space-x-4">
          <div className="p-3 bg-neon-indigo/10 text-neon-indigo rounded-2xl shrink-0">
            <Info size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Net Worth</p>
            <p className="text-xl font-extrabold text-neon-emerald truncate mt-1">{formatCurrency(totals.netWorth)}</p>
          </div>
        </Card>
      </div>

      {/* 3. Period Insights Selector Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-obsidian-800 p-4 rounded-3xl border border-obsidian-750">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-slate-400">Insights for:</span>
          <select
            value={insightPeriod}
            onChange={(e) => setInsightPeriod(e.target.value)}
            className="bg-obsidian-800 border border-obsidian-700 text-white font-extrabold rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 cursor-pointer"
          >
            <option value="7_days">Past 7 days</option>
            <option value="30_days">Past 30 days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
          </select>
        </div>
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          {activeRange.label} ({activeRange.start.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - {activeRange.end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: '2-digit' })})
        </span>
      </div>

      {/* 4. Active Period Stats Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Income', val: formatCurrency(insightMetrics.income), color: 'text-white' },
          { label: 'Total Expense', val: formatCurrency(insightMetrics.expense), color: 'text-white' },
          { label: 'Cash Flow', val: `${insightMetrics.cashFlow >= 0 ? '+' : ''}${formatCurrency(insightMetrics.cashFlow)}`, color: insightMetrics.cashFlow >= 0 ? 'text-neon-emerald' : 'text-neon-crimson' },
          { label: 'Needs Categorizing', val: insightMetrics.needsCategorizing, color: insightMetrics.needsCategorizing > 0 ? 'text-amber-400' : 'text-slate-400' },
          { label: 'Avg. Daily Expense', val: formatCurrency(insightMetrics.avgDailyExpense), color: 'text-white' }
        ].map((stat, i) => (
          <div key={i} className="bg-[#0B0E14] border border-[#161B26] p-4 rounded-2xl flex flex-col space-y-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
            <span className={`text-lg font-black ${stat.color}`}>{stat.val}</span>
          </div>
        ))}
      </div>

      {/* 5. Income & Expense Proportional Breakdown Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Breakdown */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-obsidian-750 pb-3">
            <ArrowUpRight className="text-neon-emerald" size={16} />
            <span>Income Breakdown</span>
          </h3>
          <div className="space-y-4">
            {insightMetrics.incomeBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No income recorded in this period</p>
            ) : (
              insightMetrics.incomeBreakdown.map(cat => {
                const pct = insightMetrics.income > 0 ? (cat.value / insightMetrics.income) * 100 : 0;
                const isExpanded = !!expandedCategories[cat.name];
                return (
                  <div key={cat.name} className="space-y-2 p-2 rounded-2xl hover:bg-obsidian-800/30 transition-all border border-transparent hover:border-obsidian-800">
                    <div 
                      onClick={() => toggleCategoryExpanded(cat.name)}
                      className="flex justify-between items-center text-xs font-semibold cursor-pointer select-none"
                    >
                      <span className="flex items-center space-x-2">
                        <span className="text-[9px] text-slate-500 transition-transform duration-200" style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                        <span>{getCategoryEmoji(cat.name)}</span>
                        <span className="text-slate-300 font-bold">{cat.name}</span>
                      </span>
                      <span className="text-white font-extrabold">{formatCurrency(cat.value)}</span>
                    </div>
                    {/* Proportional green bar */}
                    <div className="w-full h-2 bg-obsidian-950 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-neon-emerald rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    
                    {/* Collapsible list of transactions */}
                    {isExpanded && (
                      <div className="mt-2.5 pl-6 pr-2 py-2 bg-obsidian-900/50 rounded-xl border border-obsidian-800/80 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {transactions
                          .filter(t => {
                            if (t.type !== 'Income' || t.category !== cat.name) return false;
                            const d = new Date(t.date);
                            return d >= activeRange.start && d <= activeRange.end;
                          })
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .map(t => (
                            <div key={t.id} className="flex justify-between items-center text-[10px] text-slate-400 py-1.5 border-b border-obsidian-800/40 last:border-b-0">
                              <div className="min-w-0">
                                <p className="font-bold text-slate-300 truncate">{cleanMerchantName(t.description)}</p>
                                <p className="text-[8px] text-slate-500 mt-0.5">{t.date} • {t.account}</p>
                              </div>
                              <span className="font-extrabold text-slate-200 ml-2 shrink-0">{formatCurrency(Math.abs(t.amount))}</span>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Expense Breakdown */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-obsidian-750 pb-3">
            <ArrowDownRight className="text-neon-crimson" size={16} />
            <span>Expense Breakdown</span>
          </h3>
          <div className="space-y-4">
            {insightMetrics.expenseBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No expenses recorded in this period</p>
            ) : (
              insightMetrics.expenseBreakdown.map(cat => {
                const pct = insightMetrics.expense > 0 ? (cat.value / insightMetrics.expense) * 100 : 0;
                const isExpanded = !!expandedCategories[cat.name];
                return (
                  <div key={cat.name} className="space-y-2 p-2 rounded-2xl hover:bg-obsidian-800/30 transition-all border border-transparent hover:border-obsidian-800">
                    <div 
                      onClick={() => toggleCategoryExpanded(cat.name)}
                      className="flex justify-between items-center text-xs font-semibold cursor-pointer select-none"
                    >
                      <span className="flex items-center space-x-2">
                        <span className="text-[9px] text-slate-500 transition-transform duration-200" style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                        <span>{getCategoryEmoji(cat.name)}</span>
                        <span className="text-slate-300 font-bold">{cat.name}</span>
                      </span>
                      <span className="text-white font-extrabold">{formatCurrency(cat.value)}</span>
                    </div>
                    {/* Proportional gray/slate bar */}
                    <div className="w-full h-2 bg-obsidian-950 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-indigo-500/80 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    
                    {/* Collapsible list of transactions */}
                    {isExpanded && (
                      <div className="mt-2.5 pl-6 pr-2 py-2 bg-obsidian-900/50 rounded-xl border border-obsidian-800/80 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {transactions
                          .filter(t => {
                            if (t.type !== 'Expense' || t.category !== cat.name) return false;
                            const d = new Date(t.date);
                            return d >= activeRange.start && d <= activeRange.end;
                          })
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .map(t => (
                            <div key={t.id} className="flex justify-between items-center text-[10px] text-slate-400 py-1.5 border-b border-obsidian-800/40 last:border-b-0">
                              <div className="min-w-0">
                                <p className="font-bold text-slate-300 truncate">{cleanMerchantName(t.description)}</p>
                                <p className="text-[8px] text-slate-500 mt-0.5">{t.date} • {t.account}</p>
                              </div>
                              <span className="font-extrabold text-slate-200 ml-2 shrink-0">{formatCurrency(Math.abs(t.amount))}</span>
                            </div>
                          ))
                        }
                      </div>
                    )}
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
