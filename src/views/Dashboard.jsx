import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import LineChart from '../components/ui/LineChart';
import { formatCurrency, cleanMerchantName } from '../utils/formatting';
import { 
  TrendingUp, 
  TrendingDown,
  Umbrella,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Plus,
  Table,
  Calendar,
  CalendarRange,
  Waves,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard({ setCurrentView }) {
  const { balances, transactions, isLoading, navigateToTransactions } = useAppContext();
  const [metric, setMetric] = useState('history'); // 'history', 'assets', 'debts'
  const [expandedCategories, setExpandedCategories] = useState({
    'Cash': false,
    'Investments': false,
    'Other': false,
    'Credit Cards': false,
    'Loans': false,
    'Mortgage': false
  });

  const toggleCategory = (label) => {
    setExpandedCategories(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  // Filter latest balance entries per account
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

  // Aggregate assets, liabilities
  const totals = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    let savingsBalance = 0;

    latestBalances.forEach(b => {
      if (!b) return;
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

  // Group assets categories dynamically
  const assetCategories = useMemo(() => {
    const cashAccts = latestBalances.filter(b => b && b.class === 'Asset' && (b.type?.toLowerCase() === 'checking' || b.type?.toLowerCase() === 'savings' || b.type?.toLowerCase() === 'cash'));
    const investAccts = latestBalances.filter(b => b && b.class === 'Asset' && (b.type?.toLowerCase() === 'investment' || b.type?.toLowerCase() === 'brokerage' || b.type?.toLowerCase()?.includes('401') || b.type?.toLowerCase()?.includes('ira')));
    const otherAccts = latestBalances.filter(b => b && b.class === 'Asset' && !cashAccts.includes(b) && !investAccts.includes(b));

    const getCatMetrics = (accts, label) => {
      const balance = accts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
      
      // Calculate delta (latest snapshot vs earliest snapshot)
      let delta = 0;
      accts.forEach(acc => {
        if (!acc) return;
        const accHist = (balances || []).filter(b => b && b.institution === acc.institution && b.account === acc.account && b.account_id === acc.account_id);
        if (accHist.length > 1) {
          const sortedHist = [...accHist]
            .filter(b => b && b.date)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
          if (sortedHist.length > 0) {
            const firstVal = Number(sortedHist[0].balance || 0);
            const lastVal = Number(sortedHist[sortedHist.length - 1].balance || 0);
            delta += (lastVal - firstVal);
          }
        }
      });

      return {
        label,
        balance,
        delta,
        accounts: accts
      };
    };

    return [
      getCatMetrics(cashAccts, 'Cash'),
      getCatMetrics(investAccts, 'Investments'),
      getCatMetrics(otherAccts, 'Other')
    ].filter(c => c.accounts.length > 0 || c.label !== 'Other');
  }, [latestBalances, balances]);

  // Group liabilities categories dynamically
  const liabilityCategories = useMemo(() => {
    const cardAccts = latestBalances.filter(b => b && b.class === 'Liability' && b.type?.toLowerCase() === 'credit card');
    const loanAccts = latestBalances.filter(b => b && b.class === 'Liability' && (b.type?.toLowerCase() === 'loan' || b.type?.toLowerCase()?.includes('student')));
    const mortgageAccts = latestBalances.filter(b => b && b.class === 'Liability' && b.type?.toLowerCase() === 'mortgage');
    const otherAccts = latestBalances.filter(b => b && b.class === 'Liability' && !cardAccts.includes(b) && !loanAccts.includes(b) && !mortgageAccts.includes(b));

    const getCatMetrics = (accts, label) => {
      const balance = accts.reduce((sum, a) => sum + Math.abs(Number(a.balance || 0)), 0);
      
      let delta = 0;
      accts.forEach(acc => {
        if (!acc) return;
        const accHist = (balances || []).filter(b => b && b.institution === acc.institution && b.account === acc.account && b.account_id === acc.account_id);
        if (accHist.length > 1) {
          const sortedHist = [...accHist]
            .filter(b => b && b.date)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
          if (sortedHist.length > 0) {
            const firstVal = Math.abs(Number(sortedHist[0].balance || 0));
            const lastVal = Math.abs(Number(sortedHist[sortedHist.length - 1].balance || 0));
            delta += (lastVal - firstVal); // positive means debt increased
          }
        }
      });

      return {
        label,
        balance,
        delta,
        accounts: accts
      };
    };

    return [
      getCatMetrics(cardAccts, 'Credit Cards'),
      getCatMetrics(loanAccts, 'Loans'),
      getCatMetrics(mortgageAccts, 'Mortgage'),
      getCatMetrics(otherAccts, 'Other')
    ].filter(c => c.accounts.length > 0 || c.label !== 'Other');
  }, [latestBalances, balances]);

  // Calculate Net Worth / Assets / Liabilities history for Line Chart
  const historyData = useMemo(() => {
    const uniqueDates = Array.from(new Set((balances || []).filter(b => b && b.date).map(b => b.date))).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    const targetDates = uniqueDates.slice(-5);

    return targetDates.map(date => {
      let assetsSum = 0;
      let liabilitiesSum = 0;

      const dateBalances = (balances || []).filter(b => b && b.date === date);
      const map = new Map();
      dateBalances.forEach(b => {
        if (b && b.institution && b.account) {
          const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
          map.set(key, b);
        }
      });

      Array.from(map.values()).forEach(b => {
        if (!b) return;
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
        netWorth: chartVal,
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

  // Recent Transactions (last 5)
  const recentTransactions = useMemo(() => {
    return [...(transactions || [])]
      .filter(t => t && t.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [transactions]);

  // Cash Flow Calculations
  const cashFlowMetrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter current month
    const thisMonthTxns = (transactions || []).filter(t => {
      if (!t || !t.date) return false;
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const incomeThisMonth = thisMonthTxns
      .filter(t => t && t.type === 'Income')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    const expensesThisMonth = thisMonthTxns
      .filter(t => t && t.type === 'Expense')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    // Filter last month
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const lastMonthTxns = (transactions || []).filter(t => {
      if (!t || !t.date) return false;
      const d = new Date(t.date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const incomeLastMonth = lastMonthTxns
      .filter(t => t && t.type === 'Income')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    const expensesLastMonth = lastMonthTxns
      .filter(t => t && t.type === 'Expense')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    // Year-to-date net cash flow
    const ytdTxns = (transactions || []).filter(t => t && t.date && new Date(t.date).getFullYear() === currentYear);
    const ytdIncome = ytdTxns.filter(t => t && t.type === 'Income').reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const ytdExpenses = ytdTxns.filter(t => t && t.type === 'Expense').reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const ytdNet = ytdIncome - ytdExpenses;

    return {
      netFlow: incomeThisMonth - expensesThisMonth,
      incomeThisMonth,
      expensesThisMonth,
      incomeLastMonth,
      expensesLastMonth,
      ytdNet
    };
  }, [transactions]);

  // Account details decorators (simulated sync lag & reconnection status matching screenshot)
  const getAccountSyncDetails = (accName) => {
    const name = accName.toLowerCase();
    if (name.includes('marcus')) {
      return { sub: 'Savings Account • 0m ago', delta: null, status: 'synced' };
    }
    if (name.includes('chase total checking')) {
      return { sub: 'Checking Account • 0m ago', delta: '+$1,862', status: 'synced' };
    }
    if (name.includes('emirates')) {
      return { sub: 'Checking Account • 6d ago', delta: null, status: 'delayed', link: 'Reconnect' };
    }
    if (name.includes('wise')) {
      return { sub: 'Multi-Currency Account • 2d ago', delta: null, status: 'loading' };
    }
    if (name.includes('revolut')) {
      return { sub: 'Checking Account • 38d ago', delta: null, status: 'delayed', link: 'Reconnect' };
    }
    if (name.includes('venmo')) {
      return { sub: 'Cash Balance • 196d ago', delta: null, status: 'delayed', tag: 'Delayed' };
    }
    if (name.includes('cash wallet')) {
      return { sub: 'Manual Asset • 0m ago', delta: null, status: 'synced' };
    }
    if (name.includes('apple card')) {
      return { sub: '1871 • 6d ago', delta: '-$94,212', status: 'delayed', link: 'Reconnect' };
    }
    if (name.includes('amex')) {
      return { sub: '8829 • 6d ago', delta: null, status: 'delayed', link: 'Reconnect' };
    }
    if (name.includes('sapphire')) {
      return { sub: '3956 • 0m ago', delta: '+$1,862', status: 'synced' };
    }
    if (name.includes('adcb')) {
      return { sub: '4444 • 38d ago', delta: null, status: 'delayed', link: 'Reconnect' };
    }
    return { sub: '0m ago', delta: null, status: 'synced' };
  };

  const getAccountStatusDot = (acc) => {
    const name = acc.toLowerCase();
    if (name.includes('emirates') || name.includes('revolut') || name.includes('apple') || name.includes('amex') || name.includes('adcb')) {
      return <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />;
    }
    if (name.includes('venmo')) {
      return <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />;
    }
    return null;
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
                className={`px-3 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                  metric === 'assets'
                    ? 'bg-[#1D273B] text-emerald-400 font-black border border-slate-800/60'
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Assets <span className="bg-[#121724] text-[8px] px-1 rounded text-slate-400 font-semibold">7</span>
              </button>
              <button
                onClick={() => setMetric('debts')}
                className={`px-3 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                  metric === 'debts'
                    ? 'bg-[#1D273B] text-rose-400 font-black border border-slate-800/60'
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Debts <span className="bg-[#121724] text-[8px] px-1 rounded text-slate-400 font-semibold">4</span>
              </button>
              <button
                onClick={() => setMetric('history')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  metric === 'history'
                    ? 'bg-[#1D273B] text-emerald-400 font-black border border-slate-800/60'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                History
              </button>
            </div>
          </div>

          {/* Centered current value */}
          <div className="text-center py-2 space-y-1">
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">May 26</span>
            <div className="flex items-center justify-center space-x-2">
              <span className={`text-3xl font-extrabold tracking-tight font-display ${
                metric === 'debts' ? 'text-rose-500' : 'text-[#10B981]'
              }`}>
                {formatCurrency(activeValue)}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Bucket Account Group List (Assets & Liabilities) */}
        <div className="space-y-6">
          {/* ASSETS SECTION */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase">Assets</h3>
              <span className="text-xs font-bold text-slate-200">{formatCurrency(totals.assets)}</span>
            </div>
            
            <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl overflow-hidden divide-y divide-slate-800/40">
              {assetCategories.map(cat => {
                const isExpanded = !!expandedCategories[cat.label];
                return (
                  <div key={cat.label} className="transition-all">
                    {/* Category Row */}
                    <button 
                      onClick={() => toggleCategory(cat.label)}
                      className={`w-full p-4 flex items-center justify-between hover:bg-slate-800/10 transition-colors text-left focus:outline-none cursor-pointer ${isExpanded ? 'bg-slate-800/5' : ''}`}
                    >
                      <div className="flex items-center space-x-3.5">
                        {cat.delta < 0 ? (
                          <ArrowDownRight className="w-4 h-4 text-rose-500 shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                        <span className="font-bold text-slate-100 text-sm">{cat.label}</span>
                      </div>
                      
                      <div className="text-right flex items-center space-x-3">
                        <div>
                          <p className="font-bold text-white text-sm">{formatCurrency(cat.balance)}</p>
                          <p className={`text-[10px] font-bold ${cat.delta < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {cat.delta < 0 ? '' : '+'}{formatCurrency(cat.delta)}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                      </div>
                    </button>

                    {/* Sub accounts (Expanded list) */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-[#070A10]/50 divide-y divide-slate-850/30"
                        >
                          {cat.accounts.map(acc => {
                            const details = getAccountSyncDetails(acc.account);
                            return (
                              <div 
                                key={acc.id}
                                onClick={() => handleAccountClick(acc.account)}
                                className="p-3.5 pl-12 pr-6 hover:bg-slate-800/15 transition-all flex items-center justify-between cursor-pointer group"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  {getAccountStatusDot(acc.account)}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-200 group-hover:text-neon-indigo transition-colors truncate">{acc.account}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{details.sub}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs font-bold text-white">{formatCurrency(acc.balance)}</p>
                                  {details.link ? (
                                    <span className="text-[10px] font-bold text-blue-500 hover:underline mt-0.5 block">{details.link}</span>
                                  ) : details.tag ? (
                                    <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">{details.tag}</span>
                                  ) : details.status === 'loading' ? (
                                    <span className="text-[10px] font-medium text-slate-500 flex items-center justify-end gap-1 mt-0.5">
                                      Loading <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                    </span>
                                  ) : details.delta ? (
                                    <span className={`text-[10px] font-bold mt-0.5 block ${details.delta.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{details.delta}</span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LIABILITIES SECTION */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase">Liabilities</h3>
              <span className="text-xs font-bold text-slate-200">{formatCurrency(totals.liabilities)}</span>
            </div>
            
            <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl overflow-hidden divide-y divide-slate-800/40">
              {liabilityCategories.map(cat => {
                const isExpanded = !!expandedCategories[cat.label];
                return (
                  <div key={cat.label} className="transition-all">
                    {/* Category Row */}
                    <button 
                      onClick={() => toggleCategory(cat.label)}
                      className={`w-full p-4 flex items-center justify-between hover:bg-slate-800/10 transition-colors text-left focus:outline-none cursor-pointer ${isExpanded ? 'bg-slate-800/5' : ''}`}
                    >
                      <div className="flex items-center space-x-3.5">
                        {cat.delta < 0 ? (
                          <ArrowDownRight className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-rose-500 shrink-0" />
                        )}
                        <span className="font-bold text-slate-100 text-sm">{cat.label}</span>
                      </div>
                      
                      <div className="text-right flex items-center space-x-3">
                        <div>
                          <p className="font-bold text-white text-sm">{formatCurrency(cat.balance)}</p>
                          <p className={`text-[10px] font-bold ${cat.delta < 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {cat.delta < 0 ? '' : '+'}{formatCurrency(cat.delta)}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                      </div>
                    </button>

                    {/* Sub accounts (Expanded list) */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-[#070A10]/50 divide-y divide-slate-855/30"
                        >
                          {cat.accounts.map(acc => {
                            const details = getAccountSyncDetails(acc.account);
                            return (
                              <div 
                                key={acc.id}
                                onClick={() => handleAccountClick(acc.account)}
                                className="p-3.5 pl-12 pr-6 hover:bg-slate-800/15 transition-all flex items-center justify-between cursor-pointer group"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  {getAccountStatusDot(acc.account)}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-200 group-hover:text-neon-indigo transition-colors truncate">{acc.account}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{details.sub}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs font-bold text-white">-{formatCurrency(Math.abs(acc.balance))}</p>
                                  {details.link ? (
                                    <span className="text-[10px] font-bold text-blue-500 hover:underline mt-0.5 block">{details.link}</span>
                                  ) : details.delta ? (
                                    <span className={`text-[10px] font-bold mt-0.5 block ${details.delta.startsWith('+') ? 'text-rose-500' : 'text-emerald-500'}`}>{details.delta}</span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Cash Flow card, Emergency Fund chart & Recent Transactions */}
        <div className="space-y-6">
          {/* CASH FLOW CARD (Image 3) */}
          <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setCurrentView('cashflow')}
                className="flex items-center space-x-1 font-bold text-white hover:text-neon-indigo transition-colors text-sm"
              >
                <span>Cash Flow</span>
                <Info size={13} className="text-slate-500 shrink-0" />
                <span className="text-slate-400 font-normal">»</span>
              </button>
              <div className="text-right">
                <span className={`text-sm font-extrabold ${cashFlowMetrics.netFlow >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                  {cashFlowMetrics.netFlow >= 0 ? '+' : ''}{formatCurrency(cashFlowMetrics.netFlow)}
                </span>
                <span className="text-[9px] font-black text-slate-500 block uppercase tracking-widest mt-0.5">This month</span>
              </div>
            </div>

            {/* Income Progress */}


            {/* Expenses Progress */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-400">Expenses this month</span>
                <span className="text-white font-extrabold">-{formatCurrency(cashFlowMetrics.expensesThisMonth)}</span>
              </div>
              
              {/* Stacked Proportional Bar (Simulated categories segments: Coral, Red, Orange, Yellow, Lime) */}
              <div className="w-full h-4 rounded overflow-hidden flex">
                <div className="h-full bg-rose-500" style={{ width: '45%' }} />
                <div className="h-full bg-orange-500" style={{ width: '22%' }} />
                <div className="h-full bg-amber-400" style={{ width: '15%' }} />
                <div className="h-full bg-yellow-300" style={{ width: '10%' }} />
                <div className="h-full bg-lime-400" style={{ width: '8%' }} />
              </div>

              {/* Progress Comparison line */}
              <div className="w-full bg-[#131926] h-1.5 rounded overflow-hidden">
                <div 
                  className="h-full bg-rose-500 rounded-full" 
                  style={{ width: `${Math.min(100, (cashFlowMetrics.expensesThisMonth / Math.max(cashFlowMetrics.expensesThisMonth, cashFlowMetrics.expensesLastMonth, 1)) * 100)}%` }} 
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Last Month</span>
                <span className="font-bold">-{formatCurrency(cashFlowMetrics.expensesLastMonth)}</span>
              </div>
            </div>

            {/* YTD net cash flow indicator */}
            <div className="text-[10px] text-slate-400 italic pt-2 flex items-center justify-between border-t border-slate-800/40">
              <span>Up {formatCurrency(Math.abs(cashFlowMetrics.ytdNet))} so far this year.</span>
            </div>
          </div>

          {/* EMERGENCY FUND BAR CHART CARD (Image 4) */}
          <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setCurrentView('budgets')}
                className="flex items-center space-x-1 font-bold text-white hover:text-neon-indigo transition-colors text-sm"
              >
                <span>Emergency Fund</span>
                <Info size={13} className="text-slate-500 shrink-0" />
                <span className="text-slate-400 font-normal">»</span>
              </button>
              <span className="text-sm font-extrabold text-white">
                {formatCurrency(totals.savingsBalance)}
              </span>
            </div>

            {/* Custom 12-Month Bar Chart */}
            <div className="space-y-4 pt-1">
              <div className="h-28 flex items-end justify-between gap-1 select-none">
                {[
                  { m: 'JUN', val: 100 },
                  { m: 'JUL', val: 72 },
                  { m: 'AUG', val: 51 },
                  { m: 'SEP', val: 34 },
                  { m: 'OCT', val: 18 },
                  { m: 'NOV', val: 19 },
                  { m: 'DEC', val: 20 },
                  { m: 'JAN', val: 23 },
                  { m: 'FEB', val: 22 },
                  { m: 'MAR', val: 22 },
                  { m: 'APR', val: 24 },
                  { m: 'MAY', val: 22 }
                ].map((bar, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full rounded-t-sm bg-neon-indigo/20 hover:bg-neon-indigo/40 transition-colors relative group"
                      style={{ height: `${bar.val}%` }}
                    >
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black px-2 py-1 rounded text-[10px] font-bold text-white whitespace-nowrap">
                        {bar.m}: {bar.val}%
                      </div>
                    </div>
                    <span className="text-[8px] font-black text-slate-500 mt-2 block uppercase text-center min-h-[10px]">
                      {['JUN', 'AUG', 'OCT', 'DEC', 'FEB', 'APR'].includes(bar.m) ? bar.m : ''}
                    </span>
                  </div>
                ))}
              </div>

              {/* Savings Advice */}
              <div className="text-[10px] text-slate-450 leading-relaxed pt-2 border-t border-slate-800/40 italic">
                {totals.savingsBalance > 10000 
                  ? `$${(totals.savingsBalance - 10000).toLocaleString('en-US', { maximumFractionDigits: 0 })} could be invested for potential greater returns.`
                  : 'Keep building savings to reach your $18,000 emergency fund target.'}
              </div>
            </div>
          </div>

          {/* RECENT TRANSACTIONS CARD */}
          <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">Recent Transactions</h4>
              <button 
                onClick={() => setCurrentView('transactions')}
                className="text-[10px] font-black text-slate-500 hover:text-slate-350 tracking-wider uppercase"
              >
                View All
              </button>
            </div>

            <div className="divide-y divide-slate-850/40">
              {recentTransactions.map(txn => (
                <div 
                  key={txn.id}
                  onClick={() => handleAccountClick(txn.account)}
                  className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/5 -mx-3 px-3 rounded-xl transition-all"
                >
                  <div className="min-w-0 pr-4">
                    <p className="text-xs font-bold text-slate-200 truncate">{cleanMerchantName(txn.description)}</p>
                    <p className="text-[10px] text-slate-550 mt-1 truncate">
                      {txn.date} • {txn.category} • {txn.account}
                    </p>
                  </div>
                  <span className={`text-xs font-extrabold shrink-0 ${
                    txn.type === 'Income' ? 'text-emerald-500' : 'text-slate-100'
                  }`}>
                    {txn.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(txn.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reports Quick Access */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-white tracking-tight">Reports & Analytics</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { id: 'cashflow', label: 'Cash Flow', icon: Waves, color: 'text-neon-indigo' },
            { id: 'spending', label: 'Spending', icon: ArrowDownRight, color: 'text-neon-crimson' },
            { id: 'income', label: 'Income', icon: ArrowUpRight, color: 'text-neon-emerald' },
            { id: 'plreport', label: 'P&L Report', icon: Table, color: 'text-amber-400' },
            { id: 'yearly', label: 'Yearly', icon: Calendar, color: 'text-slate-300' },
            { id: 'subscriptions', label: 'Subscriptions', icon: CalendarRange, color: 'text-[#6366F1]' },
          ].map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setCurrentView(id)}
              className="flex flex-col items-center justify-center p-4 bg-obsidian-800/40 hover:bg-obsidian-800/70 border border-obsidian-800/80 hover:border-obsidian-750 rounded-2xl transition-all group active:scale-[0.97] space-y-2 cursor-pointer"
            >
              <div className={`p-2 rounded-xl bg-obsidian-800 ${color}`}>
                <Icon size={18} />
              </div>
              <span className="text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
