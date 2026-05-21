import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import LineChart from '../components/ui/LineChart';
import { formatCurrency } from '../utils/formatting';
import { 
  TrendingUp, 
  TrendingDown,
  ShieldCheck,
  Umbrella,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Link,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function Dashboard({ setCurrentView }) {
  const { balances, transactions, isLoading, navigateToTransactions } = useAppContext();
  const [metric, setMetric] = useState('history'); // 'history', 'assets', 'debts'

  // Filter latest balance entries per account
  const latestBalances = useMemo(() => {
    const latestMap = new Map();
    const sorted = [...balances].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(b => {
      const key = `${b.institution}_${b.account}_${b.account_id}`;
      latestMap.set(key, b);
    });
    return Array.from(latestMap.values());
  }, [balances]);

  // Aggregate assets, liabilities
  const totals = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    let savingsBalance = 0;

    latestBalances.forEach(b => {
      const val = Number(b.balance) || 0;
      if (b.class === 'Asset') {
        assets += val;
        if (b.account === 'Marcus Online Savings') {
          savingsBalance = val;
        }
      } else if (b.class === 'Liability') {
        liabilities += Math.abs(val);
      }
    });

    return {
      assets,
      liabilities,
      netWorth: assets - liabilities,
      savingsBalance
    };
  }, [latestBalances]);

  // Group cash/checking/savings for Budget Accounts
  const budgetAccounts = useMemo(() => {
    return latestBalances.filter(b => {
      if (b.class !== 'Asset') return false;
      const type = b.type ? b.type.toLowerCase() : '';
      return type === 'checking' || type === 'savings' || type === 'cash';
    });
  }, [latestBalances]);

  // Filter credit card liabilities for Debt Accounts
  const debtAccounts = useMemo(() => {
    return latestBalances.filter(b => {
      if (b.class !== 'Liability') return false;
      const type = b.type ? b.type.toLowerCase() : '';
      return type === 'credit card';
    });
  }, [latestBalances]);

  // Calculate Net Worth / Assets / Liabilities history for Line Chart
  const historyData = useMemo(() => {
    const uniqueDates = Array.from(new Set(balances.map(b => b.date))).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    // Filter to last 5 dates like the mockup
    const targetDates = uniqueDates.slice(-5);

    return targetDates.map(date => {
      let assetsSum = 0;
      let liabilitiesSum = 0;

      // Filter balances up to this date
      const dateBalances = balances.filter(b => b.date === date);
      
      // Use latest map up to this date to avoid duplicating
      const map = new Map();
      dateBalances.forEach(b => {
        const key = `${b.institution}_${b.account}_${b.account_id}`;
        map.set(key, b);
      });

      Array.from(map.values()).forEach(b => {
        const val = Number(b.balance) || 0;
        if (b.class === 'Asset') {
          assetsSum += val;
        } else if (b.class === 'Liability') {
          liabilitiesSum += Math.abs(val);
        }
      });

      let chartVal = 0;
      if (metric === 'history') {
        chartVal = assetsSum - liabilitiesSum;
      } else if (metric === 'assets') {
        chartVal = assetsSum;
      } else if (metric === 'debts') {
        chartVal = liabilitiesSum;
      }

      const dObj = new Date(date);
      const label = isNaN(dObj.getTime())
        ? date
        : dObj.toLocaleString('default', { month: 'short', day: 'numeric' });

      return {
        date: label,
        rawDate: date,
        netWorth: chartVal, // LineChart looks for netWorth property
        assets: assetsSum,
        liabilities: liabilitiesSum
      };
    });
  }, [balances, metric]);

  const activeValue = useMemo(() => {
    if (metric === 'assets') return totals.assets;
    if (metric === 'debts') return -totals.liabilities;
    return totals.netWorth;
  }, [metric, totals]);

  const activeDelta = useMemo(() => {
    if (metric === 'assets') return { pct: '8.4%', dir: 'up' };
    if (metric === 'debts') return { pct: '3.5%', dir: 'down' };
    return { pct: '12.2%', dir: 'up' };
  }, [metric]);

  const handleAccountClick = (accountName) => {
    navigateToTransactions(accountName);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-6 animate-pulse p-4">
        <div className="h-64 bg-[#0B0E14] border border-slate-800/80 rounded-3xl w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-[#0B0E14] border border-slate-800/80 rounded-3xl"></div>
          <div className="h-96 bg-[#0B0E14] border border-slate-800/80 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  // Calculate Debt summaries
  const totalInterestPaid = debtAccounts.reduce((sum, a) => sum + (a.interestPaid || 0), 0);
  const interestBurnPerMonth = totalInterestPaid / 12;
  const debtToAssetRatio = totals.assets > 0 ? (totals.liabilities / totals.assets) * 100 : 0;
  const unpaidUpcoming = debtAccounts.filter(a => a.status === 'UNPAID' && a.dueDate === '7D').length;

  // Dot styles mapping for debt list
  const getDebtDotColor = (accountName) => {
    const name = accountName.toLowerCase();
    if (name.includes('apple')) return 'bg-white';
    if (name.includes('amex')) return 'bg-amber-400';
    if (name.includes('sapphire') || name.includes('chase')) return 'bg-sky-400';
    return 'bg-rose-500';
  };

  // Border styles mapping for budget accounts left margin highlights
  const getAccountBorderColor = (accountName) => {
    const name = accountName.toLowerCase();
    if (name.includes('marcus')) return 'border-l-amber-500';
    if (name.includes('chase')) return 'border-l-emerald-500';
    if (name.includes('emirates')) return 'border-l-cyan-500';
    if (name.includes('wise')) return 'border-l-blue-500';
    if (name.includes('revolut')) return 'border-l-purple-500';
    if (name.includes('venmo')) return 'border-l-slate-500';
    return 'border-l-pink-500';
  };

  // Foreign currency labels mapping
  const getForeignDetails = (acc) => {
    if (acc.currency === 'AED') return `AED ${acc.foreignBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (acc.currency === 'EUR') return `€${acc.foreignBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (acc.currency === 'GBP') return `£${acc.foreignBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return null;
  };

  return (
    <div className="space-y-6 pb-12 max-w-lg mx-auto md:max-w-none">
      {/* 1. Net Worth History Card */}
      <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-400 font-semibold text-xs tracking-wider uppercase font-display">Net Worth History</h2>
            
            {/* Tab Toggles */}
            <div className="flex bg-[#131926] p-0.5 rounded-full text-[10px] font-extrabold gap-0.5 border border-slate-800/40">
              <button
                onClick={() => setMetric('assets')}
                className={`px-3 py-1 rounded-full flex items-center gap-1 transition-all ${
                  metric === 'assets'
                    ? 'bg-[#1D273B] text-emerald-400 font-black border border-slate-800/60'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Assets <span className="bg-[#121724] text-[8px] px-1 rounded text-slate-400 font-semibold">5</span>
              </button>
              <button
                onClick={() => setMetric('debts')}
                className={`px-3 py-1 rounded-full flex items-center gap-1 transition-all ${
                  metric === 'debts'
                    ? 'bg-[#1D273B] text-rose-400 font-black border border-slate-800/60'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Debts <span className="bg-[#121724] text-[8px] px-1 rounded text-slate-400 font-semibold">4</span>
              </button>
              <button
                onClick={() => setMetric('history')}
                className={`px-3 py-1 rounded-full transition-all ${
                  metric === 'history'
                    ? 'bg-[#1D273B] text-emerald-400 font-black border border-slate-800/60'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                History
              </button>
            </div>
          </div>

          {/* Centered current month & value */}
          <div className="text-center py-2 space-y-1">
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">May 23</span>
            <div className="flex items-center justify-center space-x-2">
              <span className={`text-3xl font-extrabold tracking-tight font-display ${
                metric === 'debts' ? 'text-rose-500' : 'text-[#10B981]'
              }`}>
                {metric === 'debts' ? '' : ''}{formatCurrency(activeValue)}
              </span>
            </div>
            
            {/* Delta pill */}
            <div className="flex justify-center">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeDelta.dir === 'up' 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-rose-500/10 text-rose-400'
              }`}>
                {activeDelta.dir === 'up' ? '▲' : '▼'} {activeDelta.pct}
              </span>
            </div>
          </div>

          {/* Sparkline Area Graph */}
          <div className="w-full pt-2">
            <LineChart 
              data={historyData} 
              height={160} 
              lineColor={metric === 'debts' ? '#EF4444' : '#10B981'}
              glowColor={metric === 'debts' ? '#EF4444' : '#10B981'}
              gradientColor={metric === 'debts' ? '#EF4444' : '#10B981'}
              fillOpacity={0.08}
              strokeWidth={2}
              showGrid={false}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Column: Debts List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase">Debt • 4 Accounts</h3>
            <span className="text-xs font-semibold text-slate-500">Verified</span>
          </div>

          <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-white tracking-tight">
                -{formatCurrency(totals.liabilities)}
              </h2>
              <p className="text-[11px] text-slate-400 leading-relaxed italic">
                Across 4 accounts, ${totalInterestPaid.toFixed(2)} paid in interest this year. {unpaidUpcoming} due this week.
              </p>
            </div>

            {/* Interest metrics columns */}
            <div className="grid grid-cols-3 gap-2 border-t border-b border-slate-800/60 py-4">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Per Month</span>
                <span className="text-base font-bold text-slate-200 block">{formatCurrency(interestBurnPerMonth)}</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Interest Burn</span>
              </div>
              <div className="space-y-1 border-l border-slate-800/40 pl-3">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">D / A</span>
                <span className="text-base font-bold text-slate-200 block">{debtToAssetRatio.toFixed(1)}%</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Diversified</span>
              </div>
              <div className="space-y-1 border-l border-slate-800/40 pl-3">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Due / 7D</span>
                <span className="text-base font-bold text-slate-200 block">{unpaidUpcoming}</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Upcoming</span>
              </div>
            </div>

            {/* Accounts Sublist */}
            <div className="space-y-4">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Accounts</span>
              <div className="space-y-3.5">
                {debtAccounts.map((acc, index) => {
                  const debtShare = totals.liabilities > 0 ? Math.round((Math.abs(acc.balance) / totals.liabilities) * 100) : 0;
                  return (
                    <div 
                      key={acc.id}
                      onClick={() => handleAccountClick(acc.account)}
                      className="group cursor-pointer hover:bg-slate-800/10 -mx-3 px-3 py-2 rounded-xl transition-all flex items-start justify-between"
                    >
                      <div className="flex items-start space-x-2.5">
                        {/* Bullet point colored highlight */}
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${getDebtDotColor(acc.account)}`} />
                        <div className="space-y-1.5">
                          <p className="text-sm font-bold text-slate-100 group-hover:text-[#10B981] transition-colors">{acc.account}</p>
                          
                          {/* Info Pill Indicators */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">
                            <span className="bg-[#121826] px-1.5 py-0.5 rounded border border-slate-800">#{index + 1}</span>
                            <span>•</span>
                            <span>{debtShare}%</span>
                            <span>•</span>
                            <span className={acc.status === 'UNPAID' ? 'text-rose-400' : 'text-emerald-400'}>{acc.status}</span>
                            <span>•</span>
                            <span>{acc.dueDate}</span>
                            <span>•</span>
                            <span>{acc.apr}% APR</span>
                          </div>

                          {/* Interest Paid */}
                          <p className="text-[10px] text-slate-500 italic">
                            ${acc.interestPaid ? acc.interestPaid.toFixed(2) : '0.00'} in interest this year
                          </p>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <p className="text-sm font-bold text-white">
                          -{formatCurrency(Math.abs(acc.balance))}
                        </p>
                        {getForeignDetails(acc) && (
                          <p className="text-[10px] text-slate-500">{getForeignDetails(acc)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Goal Tracker & Cash Accounts */}
        <div className="space-y-6">
          {/* Emergency Fund Card */}
          <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="border border-emerald-500/30 text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-widest">
                ⚙ Current Goal
              </span>
              <span className="text-emerald-400 font-extrabold text-[9px] uppercase tracking-widest">On Track</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/5">
                  <Umbrella size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-100">Emergency Fund</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Have balance - $18,000</p>
                </div>
              </div>

              {/* Progress Ring SVG */}
              <div className="relative flex items-center justify-center shrink-0">
                <svg className="w-14 h-14 transform -rotate-90">
                  <circle cx="28" cy="28" r="21" stroke="#131924" strokeWidth="3.5" fill="transparent" />
                  <circle 
                    cx="28" 
                    cy="28" 
                    r="21" 
                    stroke="#10B981" 
                    strokeWidth="3.5" 
                    strokeDasharray={132} 
                    strokeDashoffset={132 - (71 / 100) * 132} 
                    strokeLinecap="round" 
                    fill="transparent" 
                  />
                </svg>
                <span className="absolute text-[10px] font-black text-white">71%</span>
              </div>
            </div>

            {/* Accent divider line */}
            <div className="h-0.5 bg-emerald-500 rounded-full w-full opacity-80" />

            {/* Metrics column grid */}
            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="space-y-0.5">
                <span className="text-[14px] font-extrabold text-white">{formatCurrency(totals.savingsBalance)}</span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Saved</span>
              </div>
              <div className="space-y-0.5 border-l border-slate-800/40">
                <span className="text-[14px] font-extrabold text-white">{formatCurrency(18000 - totals.savingsBalance)}</span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">To Go</span>
              </div>
              <div className="space-y-0.5 border-l border-slate-800/40">
                <span className="text-[14px] font-extrabold text-emerald-400 block">Dec 2026</span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">$700/mo</span>
              </div>
            </div>

            {/* Goal Link */}
            <button className="w-full text-center text-[9px] font-extrabold text-slate-500 hover:text-slate-300 transition-colors pt-2 flex items-center justify-center gap-1 uppercase tracking-widest">
              ▲ Track balance to goal
            </button>
          </div>

          {/* Budget Accounts (Assets - Cash & Checking) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase">Budget Accounts</h3>
              <span className="text-xs font-bold text-slate-200">
                {formatCurrency(budgetAccounts.reduce((sum, a) => sum + a.balance, 0))}
              </span>
            </div>

            <div className="space-y-2">
              {budgetAccounts.map((acc) => (
                <div 
                  key={acc.id}
                  onClick={() => handleAccountClick(acc.account)}
                  className={`bg-[#0B0E14] border border-[#161B26] rounded-2xl p-4 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-between border-l-4 ${getAccountBorderColor(acc.account)}`}
                >
                  <div className="space-y-1.5 min-w-0 pr-4">
                    {/* Category Label */}
                    <span className="text-[8px] font-extrabold text-slate-500 tracking-wider uppercase block">
                      {acc.type === 'Savings' ? 'SAVINGS' : acc.type === 'Checking' ? 'CHECKING' : 'CASH'} 
                      {acc.note ? ` • ${acc.note.toUpperCase()}` : ''}
                    </span>
                    <p className="text-sm font-bold text-slate-100 truncate">{acc.account}</p>
                    
                    {/* Foreign details as secondary description */}
                    {getForeignDetails(acc) && (
                      <p className="text-[11px] text-slate-400 font-semibold">{getForeignDetails(acc)}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-white">
                      {formatCurrency(acc.balance)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
