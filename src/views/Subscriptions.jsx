import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, formatDate, cleanMerchantName, getCategoryEmoji } from '../utils/formatting';
import { 
  CalendarRange, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  DollarSign, 
  TrendingUp, 
  Sparkles,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Subscriptions() {
  const { transactions, categories, balances } = useAppContext();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'overdue', 'hidden'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [expandedSub, setExpandedSub] = useState(null);

  // Form states for adding manual subscription
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmount, setNewSubAmount] = useState('');
  const [newSubFrequency, setNewSubFrequency] = useState('Monthly');
  const [newSubNextBill, setNewSubNextBill] = useState(new Date().toISOString().split('T')[0]);
  const [newSubCategory, setNewSubCategory] = useState('');
  const [newSubAccount, setNewSubAccount] = useState('');

  // 1. Included categories from localStorage (with pre-seeded 'Subscriptions')
  const [includedCategories, setIncludedCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('finflow_included_categories');
      return saved ? JSON.parse(saved) : ['Subscriptions'];
    } catch {
      return ['Subscriptions'];
    }
  });

  // 2. Hidden subscriptions from localStorage
  const [hiddenSubscriptions, setHiddenSubscriptions] = useState(() => {
    try {
      const saved = localStorage.getItem('finflow_hidden_subscriptions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 3. Manually added subscriptions from localStorage
  const [manualSubscriptions, setManualSubscriptions] = useState(() => {
    try {
      const saved = localStorage.getItem('finflow_manual_subscriptions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Date helper
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // System options for dropdowns in modal
  const systemCategories = useMemo(() => {
    const list = categories.map(c => c.category).filter(Boolean);
    return list.length > 0 ? Array.from(new Set(list)) : ['Subscriptions', 'Utilities', 'Rent', 'Fitness', 'Auto', 'Other'];
  }, [categories]);

  const systemAccounts = useMemo(() => {
    const list = balances.map(b => b.account).filter(Boolean);
    return list.length > 0 ? Array.from(new Set(list)) : ['Chase Checking', 'Chase Sapphire Reserve', 'Cash Wallet'];
  }, [balances]);

  // Helper to calculate integer currency formats for the header projection
  const formatCurrencyInt = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Helper to calculate days diff
  const getDaysDiff = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const diffTime = d2 - d1;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 4. Combined Subscriptions Processor
  const combinedSubscriptions = useMemo(() => {
    const detectedList = [];
    const expenses = transactions.filter(t => t.amount < 0);
    const merchantGroups = {};

    // Group expenses by merchant name
    expenses.forEach(t => {
      const cleanName = cleanMerchantName(t.description);
      if (!cleanName) return;
      if (!merchantGroups[cleanName]) {
        merchantGroups[cleanName] = [];
      }
      merchantGroups[cleanName].push(t);
    });

    // 4.1 Run Auto-Detection Logic
    Object.entries(merchantGroups).forEach(([merchant, txns]) => {
      if (txns.length < 2) return;

      const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) {
        const d1 = new Date(sorted[i-1].date);
        const d2 = new Date(sorted[i].date);
        const gap = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        gaps.push(gap);
      }

      const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
      const variance = gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length;
      const stdDev = Math.sqrt(variance);

      let frequency = '';
      let intervalDays = 0;
      if (avgGap >= 5 && avgGap <= 9) {
        frequency = 'Weekly';
        intervalDays = 7;
      } else if (avgGap >= 10 && avgGap <= 18) {
        frequency = 'Bi-weekly';
        intervalDays = 14;
      } else if (avgGap >= 24 && avgGap <= 35) {
        frequency = 'Monthly';
        intervalDays = 30;
      } else if (avgGap >= 80 && avgGap <= 100) {
        frequency = 'Quarterly';
        intervalDays = 90;
      } else if (avgGap >= 340 && avgGap <= 385) {
        frequency = 'Annually';
        intervalDays = 365;
      }

      const isConsistent = frequency !== '' && (stdDev < 6 || stdDev / intervalDays < 0.20);

      if (isConsistent) {
        const avgAmount = Math.abs(sorted.reduce((sum, t) => sum + t.amount, 0) / sorted.length);
        const latestTxn = sorted[sorted.length - 1];
        const latestDate = new Date(latestTxn.date);

        // Project next bill date
        const nextBill = new Date(latestDate);
        nextBill.setDate(nextBill.getDate() + intervalDays);
        while (nextBill < today) {
          nextBill.setDate(nextBill.getDate() + intervalDays);
        }

        detectedList.push({
          id: `auto_${merchant.replace(/\s+/g, '_')}`,
          merchant,
          frequency,
          intervalDays,
          amount: avgAmount,
          lastPaidDate: latestTxn.date,
          nextBillDate: nextBill.toISOString().split('T')[0],
          category: latestTxn.category,
          account: latestTxn.account,
          type: 'Auto-detected',
          status: 'Active'
        });
      }
    });

    // 4.2 Run Category-Based Inclusion Logic
    const categorySubs = [];
    if (includedCategories.length > 0) {
      expenses.forEach(t => {
        if (includedCategories.includes(t.category)) {
          const cleanName = cleanMerchantName(t.description);

          const existsInAuto = detectedList.some(s => s.merchant.toLowerCase() === cleanName.toLowerCase());
          const existsInCat = categorySubs.some(s => s.merchant.toLowerCase() === cleanName.toLowerCase());

          if (!existsInAuto && !existsInCat) {
            const merchantTxns = expenses.filter(et => cleanMerchantName(et.description).toLowerCase() === cleanName.toLowerCase());
            const sorted = [...merchantTxns].sort((a, b) => new Date(b.date) - new Date(a.date));
            const latestTxn = sorted[0];
            const latestDate = new Date(latestTxn.date);

            const nextBill = new Date(latestDate);
            nextBill.setDate(nextBill.getDate() + 30); // Default to monthly
            while (nextBill < today) {
              nextBill.setDate(nextBill.getDate() + 30);
            }

            categorySubs.push({
              id: `cat_${cleanName.replace(/\s+/g, '_')}`,
              merchant: cleanName,
              frequency: 'Monthly',
              intervalDays: 30,
              amount: Math.abs(latestTxn.amount),
              lastPaidDate: latestTxn.date,
              nextBillDate: nextBill.toISOString().split('T')[0],
              category: latestTxn.category,
              account: latestTxn.account,
              type: 'Category-based',
              status: 'Active'
            });
          }
        }
      });
    }

    // 4.3 Add Custom Manual Subscriptions
    const manualList = manualSubscriptions.map(s => {
      const nextBill = new Date(s.nextBillDate);
      let intervalDays = 30;
      if (s.frequency === 'Weekly') intervalDays = 7;
      else if (s.frequency === 'Bi-weekly') intervalDays = 14;
      else if (s.frequency === 'Quarterly') intervalDays = 90;
      else if (s.frequency === 'Annually') intervalDays = 365;

      while (nextBill < today) {
        nextBill.setDate(nextBill.getDate() + intervalDays);
      }

      return {
        ...s,
        intervalDays,
        nextBillDate: nextBill.toISOString().split('T')[0],
        type: 'Manual',
        status: 'Active'
      };
    });

    // Merge and deduplicate by merchant name
    const allList = [...detectedList, ...categorySubs, ...manualList];
    const seen = new Set();
    const result = [];

    allList.forEach(s => {
      const key = s.merchant.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(s);
      }
    });

    return result;
  }, [transactions, includedCategories, manualSubscriptions, today]);

  // Helper to calculate lifetime and yearly totals for a specific subscription
  const getSubDetails = useMemo(() => {
    return (merchantName) => {
      const matchingTxns = transactions.filter(t => 
        cleanMerchantName(t.description).toLowerCase() === merchantName.toLowerCase() && t.amount < 0
      );
      
      const totalEver = matchingTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const totalCount = matchingTxns.length;
      
      const yearsMap = {};
      matchingTxns.forEach(t => {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          yearsMap[y] = (yearsMap[y] || 0) + Math.abs(t.amount);
        }
      });
      
      const yearlyBreakdown = Object.entries(yearsMap)
        .map(([year, total]) => ({ year: parseInt(year), total }))
        .sort((a, b) => b.year - a.year);
        
      return {
        totalEver,
        totalCount,
        yearlyBreakdown
      };
    };
  }, [transactions]);

  // Filtering Lists
  const nonHiddenSubs = useMemo(() => {
    return combinedSubscriptions.filter(s => !hiddenSubscriptions.includes(s.merchant));
  }, [combinedSubscriptions, hiddenSubscriptions]);

  const hiddenSubs = useMemo(() => {
    return combinedSubscriptions.filter(s => hiddenSubscriptions.includes(s.merchant));
  }, [combinedSubscriptions, hiddenSubscriptions]);

  const overdueSubs = useMemo(() => {
    return nonHiddenSubs.filter(s => getDaysDiff(today, s.nextBillDate) < 0);
  }, [nonHiddenSubs, today]);

  // Metrics Calculations (for non-hidden subscriptions)
  const stats = useMemo(() => {
    let yearlyTotal = 0;

    nonHiddenSubs.forEach(s => {
      let annualVal = 0;
      if (s.frequency === 'Weekly') annualVal = s.amount * 52;
      else if (s.frequency === 'Bi-weekly') annualVal = s.amount * 26;
      else if (s.frequency === 'Monthly') annualVal = s.amount * 12;
      else if (s.frequency === 'Quarterly') annualVal = s.amount * 4;
      else if (s.frequency === 'Annually') annualVal = s.amount;
      yearlyTotal += annualVal;
    });

    const dailyBurn = yearlyTotal / 365;

    // Biggest subscription
    const biggest = nonHiddenSubs.reduce((max, s) => {
      let sAnnualVal = 0;
      if (s.frequency === 'Weekly') sAnnualVal = s.amount * 52;
      else if (s.frequency === 'Bi-weekly') sAnnualVal = s.amount * 26;
      else if (s.frequency === 'Monthly') sAnnualVal = s.amount * 12;
      else if (s.frequency === 'Quarterly') sAnnualVal = s.amount * 4;
      else if (s.frequency === 'Annually') sAnnualVal = s.amount;

      if (!max) return { ...s, annualVal: sAnnualVal };
      return sAnnualVal > max.annualVal ? { ...s, annualVal: sAnnualVal } : max;
    }, null);

    // Next upcoming charge
    const upcoming = nonHiddenSubs.reduce((closest, s) => {
      const days = getDaysDiff(today, s.nextBillDate);
      if (days < 0) return closest; // Overdue
      if (!closest) return { ...s, days };
      return days < closest.days ? { ...s, days } : closest;
    }, null);

    return {
      yearlyTotal,
      dailyBurn,
      biggest,
      upcoming
    };
  }, [nonHiddenSubs, today]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: nonHiddenSubs.length,
      active: nonHiddenSubs.length, // All non-hidden in this context are active
      overdue: overdueSubs.length,
      hidden: hiddenSubs.length
    };
  }, [nonHiddenSubs, overdueSubs, hiddenSubs]);

  // Filtered view items
  const activeViewItems = useMemo(() => {
    if (activeTab === 'active') return nonHiddenSubs;
    if (activeTab === 'overdue') return overdueSubs;
    if (activeTab === 'hidden') return hiddenSubs;
    return nonHiddenSubs;
  }, [activeTab, nonHiddenSubs, overdueSubs, hiddenSubs]);

  // Hide/Unhide Toggle
  const toggleHideSubscription = (merchantName) => {
    setHiddenSubscriptions(prev => {
      const updated = prev.includes(merchantName)
        ? prev.filter(m => m !== merchantName)
        : [...prev, merchantName];
      localStorage.setItem('finflow_hidden_subscriptions', JSON.stringify(updated));
      return updated;
    });
  };

  // Add Manual Subscription
  const handleAddManualSub = (e) => {
    e.preventDefault();
    if (!newSubName || !newSubAmount) return;

    const newSub = {
      id: `manual_${Date.now()}`,
      merchant: newSubName,
      amount: parseFloat(newSubAmount),
      frequency: newSubFrequency,
      nextBillDate: newSubNextBill,
      category: newSubCategory || 'Other',
      account: newSubAccount || 'Manual'
    };

    setManualSubscriptions(prev => {
      const updated = [...prev, newSub];
      localStorage.setItem('finflow_manual_subscriptions', JSON.stringify(updated));
      return updated;
    });

    // Reset fields
    setNewSubName('');
    setNewSubAmount('');
    setNewSubFrequency('Monthly');
    setNewSubNextBill(new Date().toISOString().split('T')[0]);
    setNewSubCategory('');
    setNewSubAccount('');
    setIsAddModalOpen(false);
  };

  // Delete Manual Subscription
  const deleteManualSubscription = (id) => {
    setManualSubscriptions(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('finflow_manual_subscriptions', JSON.stringify(updated));
      return updated;
    });
  };

  // Toggle category inclusion
  const toggleCategoryInclusion = (catName) => {
    setIncludedCategories(prev => {
      const updated = prev.includes(catName)
        ? prev.filter(c => c !== catName)
        : [...prev, catName];
      localStorage.setItem('finflow_included_categories', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto md:max-w-3xl px-4 pb-24 relative select-none">
      {/* 1. Header Area: Annual Projection */}
      <div className="flex justify-between items-end border-b border-slate-800/30 pb-5">
        <div className="space-y-1">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">PER YEAR</div>
          <h1 className="text-5xl md:text-6xl font-serif text-white tracking-tight leading-none mt-1">
            {formatCurrencyInt(stats.yearlyTotal)}
          </h1>
          <p className="font-serif italic text-slate-400 text-xs md:text-sm mt-3.5">
            {nonHiddenSubs.length > 0 
              ? `Tracking ${nonHiddenSubs.length} active recurring expenses.` 
              : 'Nothing recurring yet — add a category below to start tracking.'
            }
          </p>
        </div>
        <div className="text-right">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
            {nonHiddenSubs.length} TRACKED
          </span>
        </div>
      </div>

      {/* 2. Three-column Metrics Grid */}
      <div className="grid grid-cols-3 border-b border-slate-800/30 pb-5 my-6 gap-2">
        <div className="text-left">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">PER DAY</div>
          <div className="text-xl font-bold text-white mt-1">{formatCurrency(stats.dailyBurn)}</div>
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">EVERY 24H</div>
        </div>
        <div className="text-left border-l border-slate-800/30 pl-4">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">BIGGEST</div>
          <div className="text-xl font-bold text-white mt-1 truncate max-w-[150px]">
            {stats.biggest ? stats.biggest.merchant : '—'}
          </div>
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 truncate">
            {stats.biggest ? `-${formatCurrency(stats.biggest.amount)} / ${stats.biggest.frequency.toUpperCase()}` : 'NO ACTIVE'}
          </div>
        </div>
        <div className="text-left border-l border-slate-800/30 pl-4">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">NEXT UP</div>
          <div className="text-xl font-bold text-white mt-1">
            {stats.upcoming ? stats.upcoming.days : '—'}
          </div>
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 truncate max-w-[150px]">
            {stats.upcoming ? `${stats.upcoming.merchant.toUpperCase()} DUE` : 'NO CHARGES'}
          </div>
        </div>
      </div>

      {/* 3. Tab Selectors */}
      <div className="flex border-b border-slate-800/30 pb-px text-xs font-bold gap-6">
        {['all', 'active', 'overdue', 'hidden'].map(tab => {
          const isActive = activeTab === tab;
          const count = tabCounts[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 relative transition-all duration-200 capitalize cursor-pointer flex items-center space-x-1 ${
                isActive ? 'text-white font-extrabold' : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              <span>{tab}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-[#1D273B] text-slate-300 font-bold' : 'bg-slate-900/40 text-slate-600 font-medium'
              }`}>
                {count}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeSubTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Subscriptions List or Empty State */}
      <div className="mt-6">
        {activeViewItems.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 px-4 max-w-sm mx-auto animate-fade-in">
            <h3 className="font-serif italic text-2xl text-slate-200">No recurring payments yet.</h3>
            <p className="text-slate-400 text-[13px] leading-relaxed max-w-[280px]">
              finflow detects patterns as you add transactions, or include a category below.
            </p>
            <div className="pt-8 text-slate-500 text-[11px] leading-relaxed">
              Don't see something? Tell finflow which categories always count as subscriptions.
            </div>
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="inline-flex items-center text-slate-350 hover:text-white transition-colors cursor-pointer text-xs font-bold underline underline-offset-4 decoration-slate-650 hover:decoration-white mt-1"
            >
              Include categories ➔
            </button>
          </div>
        ) : (
          /* List of subscriptions */
          <div className="space-y-3">
            {activeViewItems.map((sub) => {
              const daysLeft = getDaysDiff(today, sub.nextBillDate);
              const isExpanded = expandedSub === sub.id;
              const details = isExpanded ? getSubDetails(sub.merchant) : null;

              return (
                <div 
                  key={sub.id} 
                  className={`flex flex-col p-4 bg-[#0B0E14] border rounded-2xl transition-all duration-200 cursor-pointer ${
                    isExpanded ? 'border-neon-indigo shadow-lg shadow-neon-indigo/5 bg-[#0e131d]' : 'border-[#161B26] hover:border-slate-800/80'
                  }`}
                  onClick={() => setExpandedSub(isExpanded ? null : sub.id)}
                >
                  {/* Row Summary */}
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="w-10 h-10 bg-[#131926] border border-slate-800/40 rounded-xl flex items-center justify-center text-lg select-none shrink-0">
                        {getCategoryEmoji(sub.category)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-100 group-hover:text-white truncate text-sm">
                          {sub.merchant}
                        </h4>
                        <p className="text-[10px] text-slate-500 truncate flex items-center space-x-1 mt-0.5">
                          <span>{sub.account || 'Manual'}</span>
                          <span>•</span>
                          <span>{sub.category}</span>
                        </p>
                      </div>
                    </div>
                    
                    {/* Middle Info: Billing Schedule & Status */}
                    <div className="hidden sm:flex items-center space-x-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-[#131926] border border-slate-800/80 px-2.5 py-0.5 rounded-full">
                        {sub.frequency}
                      </span>
                      <span className={`text-[10px] font-bold ${
                        daysLeft < 0 
                          ? 'text-rose-400 animate-pulse' 
                          : daysLeft === 0
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}>
                        {daysLeft < 0 
                          ? `Overdue by ${Math.abs(daysLeft)}d` 
                          : daysLeft === 0
                          ? 'Due today'
                          : `In ${daysLeft}d (${formatDate(sub.nextBillDate)})`
                        }
                      </span>
                    </div>

                    {/* Right Info: Amount & Actions */}
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className="font-bold text-slate-200 text-sm">
                          -{formatCurrency(sub.amount)}
                        </span>
                        <span className="block sm:hidden text-[9px] text-slate-500 mt-0.5 font-medium">
                          {sub.frequency}
                        </span>
                      </div>

                      {/* Actions Menu */}
                      <div className="flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => toggleHideSubscription(sub.merchant)}
                          title={hiddenSubscriptions.includes(sub.merchant) ? "Unhide subscription" : "Hide subscription"}
                          className="p-1.5 bg-[#131926] hover:bg-[#1A2234] border border-slate-800/50 hover:border-slate-700/80 rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                        >
                          {hiddenSubscriptions.includes(sub.merchant) ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        
                        {sub.type === 'Manual' && (
                          <button
                            onClick={() => deleteManualSubscription(sub.id)}
                            title="Delete custom subscription"
                            className="p-1.5 bg-[#131926] hover:bg-rose-500/10 border border-slate-800/50 hover:border-rose-500/30 rounded-lg text-slate-400 hover:text-rose-450 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail section */}
                  {isExpanded && details && (
                    <div 
                      className="mt-4 pt-4 border-t border-slate-800/40 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in cursor-default"
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Left: Lifetime Spent Summary */}
                      <div className="space-y-2 bg-[#0B0E14] border border-slate-850 p-3 rounded-xl flex flex-col justify-center">
                        <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                          <span>Total Amount Ever</span>
                          <span className="text-slate-400">{details.totalCount} payments</span>
                        </div>
                        <p className="text-xl font-bold text-white tracking-tight mt-1">
                          {formatCurrency(details.totalEver)}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">Accumulated historical debit volume</p>
                      </div>

                      {/* Right: Year-over-Year breakdown */}
                      <div className="space-y-2 bg-[#0B0E14] border border-slate-850 p-3 rounded-xl">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          Amount Spent By Year
                        </div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                          {details.yearlyBreakdown.length === 0 ? (
                            <p className="text-[10px] text-slate-500 font-semibold italic text-center py-2">No historical records available</p>
                          ) : (
                            details.yearlyBreakdown.map(y => (
                              <div key={y.year} className="flex justify-between items-center text-[10px] text-slate-400 py-0.5">
                                <span className="font-bold text-slate-300">{y.year}</span>
                                <span className="font-extrabold text-slate-200">{formatCurrency(y.total)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-24 right-8 md:bottom-28 md:right-12 w-14 h-14 bg-[#0B0E14] hover:bg-[#161B26] border border-slate-700/60 hover:border-slate-500 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group cursor-pointer z-30"
        style={{ boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)' }}
      >
        <Plus className="w-6 h-6 text-slate-300 group-hover:text-white transition-colors duration-200" />
      </button>

      {/* 5. Modals Area */}
      <AnimatePresence>
        {/* Category Inclusion Modal */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 shadow-2xl z-10 overflow-hidden space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/40">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CalendarRange className="w-4 h-4 text-neon-indigo" />
                    Subscription Categories
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Checked categories always treat items as subscriptions.</p>
                </div>
                <button 
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-1 text-slate-500 hover:text-white bg-slate-900/40 hover:bg-slate-800/60 rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 py-1 space-y-2 max-h-[50vh]">
                {systemCategories.map(cat => {
                  const isChecked = includedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategoryInclusion(cat)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                        isChecked 
                          ? 'bg-neon-indigo/5 border-neon-indigo/35 text-white' 
                          : 'bg-[#131926]/40 border-slate-850 text-slate-400 hover:border-slate-800'
                      }`}
                    >
                      <span className="text-xs font-semibold">{cat}</span>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isChecked ? 'bg-neon-indigo border-neon-indigo' : 'border-slate-650'
                      }`}>
                        {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-800/40 flex justify-end">
                <button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-5 py-2 bg-neon-indigo hover:bg-neon-indigo/90 text-white font-semibold text-xs rounded-xl shadow-lg shadow-neon-indigo/15 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Subscription Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 shadow-2xl z-10 overflow-hidden space-y-4 max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/40">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-neon-indigo" />
                    New Subscription
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Manually register a custom repeating transaction.</p>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 text-slate-500 hover:text-white bg-slate-900/40 hover:bg-slate-800/60 rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddManualSub} className="space-y-3.5 flex-1 overflow-y-auto pr-1">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Service Name</label>
                  <input
                    type="text"
                    required
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="e.g. Netflix, Spotify, Gym"
                    className="w-full bg-[#131926] border border-slate-850 focus:border-neon-indigo rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Cost / Price</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newSubAmount}
                      onChange={(e) => setNewSubAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#131926] border border-slate-850 focus:border-neon-indigo rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Frequency</label>
                    <select
                      value={newSubFrequency}
                      onChange={(e) => setNewSubFrequency(e.target.value)}
                      className="w-full bg-[#131926] border border-slate-850 focus:border-neon-indigo rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all"
                    >
                      {['Weekly', 'Bi-weekly', 'Monthly', 'Quarterly', 'Annually'].map(freq => (
                        <option key={freq} value={freq}>{freq}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Next Bill Date</label>
                  <input
                    type="date"
                    required
                    value={newSubNextBill}
                    onChange={(e) => setNewSubNextBill(e.target.value)}
                    className="w-full bg-[#131926] border border-slate-850 focus:border-neon-indigo rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Category</label>
                    <select
                      value={newSubCategory}
                      onChange={(e) => setNewSubCategory(e.target.value)}
                      className="w-full bg-[#131926] border border-slate-850 focus:border-neon-indigo rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all"
                    >
                      <option value="">Select Category</option>
                      {systemCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Account</label>
                    <select
                      value={newSubAccount}
                      onChange={(e) => setNewSubAccount(e.target.value)}
                      className="w-full bg-[#131926] border border-slate-850 focus:border-neon-indigo rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all"
                    >
                      <option value="">Select Account</option>
                      {systemAccounts.map(acc => (
                        <option key={acc} value={acc}>{acc}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/40 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-2 bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 text-slate-400 hover:text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-neon-indigo hover:bg-neon-indigo/90 text-white font-semibold text-xs rounded-xl shadow-lg shadow-neon-indigo/15 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Save Subscription
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
