import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import LineChart from '../components/ui/LineChart';
import SurplusGoalTracker from '../components/ui/SurplusGoalTracker';
import { formatCurrency, cleanMerchantName } from '../utils/formatting';
import { getCategoryConfig } from '../utils/categoryHelpers';
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
  RefreshCw,
  Compass,
  Heart,
  Shield,
  PiggyBank,
  CreditCard,
  Landmark,
  Building2,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper for relative dates: Today, Yesterday, Nd ago, or MMM DD
const formatRelativeDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const txnDate = new Date(year, month, day);
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const txnMidnight = new Date(txnDate.getFullYear(), txnDate.getMonth(), txnDate.getDate());
    
    const diffTime = todayMidnight - txnMidnight;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 1 && diffDays < 7) return `${diffDays}d ago`;
    
    return txnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};

export default function Dashboard({ setCurrentView }) {
  const { balances = [], transactions = [], surplusMetrics, isLoading, navigateToTransactions } = useAppContext();
  const [metric, setMetric] = useState('history'); // 'history', 'assets', 'debts'
  const [chartHeight, setChartHeight] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth < 640 ? 90 : 130
  );
  const [showChart, setShowChart] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth >= 640
  );

  useEffect(() => {
    const handleResize = () => {
      setChartHeight(window.innerWidth < 640 ? 90 : 130);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        if (b.type?.toLowerCase()?.includes('savings') || b.account?.toLowerCase()?.includes('savings') || b.account?.toLowerCase()?.includes('emergency')) {
          savingsBalance += val;
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

  // Calculate dynamic savings history for emergency fund chart
  const savingsHistory = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // end of month
      months.push({
        date: d,
        label: d.toLocaleString('default', { month: 'short' }).toUpperCase(),
        val: 0
      });
    }

    const savingsAccounts = (balances || []).filter(b => {
      if (!b || b.class !== 'Asset') return false;
      const typeLower = (b.type || '').toLowerCase();
      const nameLower = (b.account || '').toLowerCase();
      return (
        typeLower.includes('savings') ||
        nameLower.includes('savings') ||
        nameLower.includes('emergency')
      );
    });

    months.forEach(m => {
      const accountLatest = new Map();
      savingsAccounts.forEach(b => {
        const bDate = new Date(b.date);
        if (bDate <= m.date) {
          const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
          const existing = accountLatest.get(key);
          if (!existing || new Date(existing.date) < bDate) {
            accountLatest.set(key, b);
          }
        }
      });
      let total = 0;
      accountLatest.forEach(b => {
        total += Number(b.balance) || 0;
      });
      m.val = total;
    });

    const maxVal = Math.max(...months.map(m => m.val), 1);
    return months.map(m => ({
      m: m.label,
      actualVal: m.val,
      val: Math.round((m.val / maxVal) * 100)
    }));
  }, [balances]);

  const baselineExpenses = surplusMetrics?.rolling?.baseline || 3000;
  const targetMonths = 6;
  const emergencyFundTarget = baselineExpenses * targetMonths;

  // Group assets categories dynamically
  const assetCategories = useMemo(() => {
    const investAccts = latestBalances.filter(b => {
      if (!b || b.class !== 'Asset') return false;
      const typeLower = (b.type || '').toLowerCase();
      const nameLower = (b.account || '').toLowerCase();
      const instLower = (b.institution || '').toLowerCase();
      return (
        typeLower.includes('investment') ||
        typeLower.includes('brokerage') ||
        typeLower.includes('retirement') ||
        typeLower.includes('401') ||
        typeLower.includes('ira') ||
        typeLower.includes('529') ||
        nameLower.includes('fidelity') ||
        nameLower.includes('etrade') ||
        nameLower.includes('e*trade') ||
        nameLower.includes('schwab') ||
        nameLower.includes('vanguard') ||
        nameLower.includes('robinhood') ||
        nameLower.includes('brokerage') ||
        nameLower.includes('ira') ||
        nameLower.includes('401k') ||
        nameLower.includes('401(k)') ||
        nameLower.includes('529') ||
        instLower.includes('fidelity') ||
        instLower.includes('etrade') ||
        instLower.includes('schwab') ||
        instLower.includes('vanguard') ||
        instLower.includes('robinhood')
      );
    });
    const cashAccts = latestBalances.filter(b => b && b.class === 'Asset' && !investAccts.includes(b) && (b.type?.toLowerCase() === 'checking' || b.type?.toLowerCase() === 'savings' || b.type?.toLowerCase() === 'cash' || b.account?.toLowerCase()?.includes('checking') || b.account?.toLowerCase()?.includes('savings')));
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
    const cardAccts = latestBalances.filter(b => b && b.class === 'Liability' && (b.type?.toLowerCase()?.includes('credit') || b.account?.toLowerCase()?.includes('card') || b.account?.toLowerCase()?.includes('credit')));
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
    const uniqueDates = Array.from(new Set((balances || []).filter(b => b && b.date).map(b => b.date))).sort(
      (a, b) => new Date(a) - new Date(b)
    );
    const targetDates = uniqueDates.slice(-5);
    
    if (targetDates.length < 2) {
      return { pct: '0%', dir: 'up' };
    }

    const getSnapshotVal = (date) => {
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

      if (metric === 'assets') return assetsSum;
      if (metric === 'debts') return liabilitiesSum;
      return assetsSum - liabilitiesSum;
    };

    const firstVal = getSnapshotVal(targetDates[0]);
    const lastVal = getSnapshotVal(targetDates[targetDates.length - 1]);

    if (firstVal === 0) {
      return { pct: lastVal > 0 ? '100%' : '0%', dir: lastVal >= 0 ? 'up' : 'down' };
    }

    const diff = lastVal - firstVal;
    const pctVal = Math.abs((diff / firstVal) * 100).toFixed(1) + '%';
    
    const dir = diff >= 0 ? 'up' : 'down';
    return { pct: pctVal, dir };
  }, [balances, metric]);

  const activeDateLabel = useMemo(() => {
    const uniqueDates = Array.from(new Set((balances || []).filter(b => b && b.date).map(b => b.date))).sort(
      (a, b) => new Date(a) - new Date(b)
    );
    if (uniqueDates.length === 0) return 'Today';
    const latestDate = new Date(uniqueDates[uniqueDates.length - 1]);
    return latestDate.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  }, [balances]);

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

  const cashFlowCategories = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthExpenses = (transactions || [])
      .filter(t => {
        if (!t || !t.date || t.type !== 'Expense') return false;
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

    const categoriesMap = {};
    thisMonthExpenses.forEach(t => {
      const cat = t.category || 'Uncategorized';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + Math.abs(Number(t.amount) || 0);
    });

    const sorted = Object.entries(categoriesMap)
      .map(([name, value]) => {
        const config = getCategoryConfig(name);
        return { name, value, color: config?.color || '#6366F1' };
      })
      .sort((a, b) => b.value - a.value);

    const total = sorted.reduce((sum, item) => sum + item.value, 0);

    return sorted.map(item => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0
    }));
  }, [transactions]);

  // Account details decorators (simulated sync lag & reconnection status matching screenshot)
  const getAccountSyncDetails = (accName, accountId, institution, currentClass) => {
    // Calculate delta (latest snapshot vs earliest snapshot)
    const accHist = (balances || []).filter(b => 
      b && 
      b.account === accName && 
      (institution ? b.institution === institution : true) &&
      (accountId ? b.account_id === accountId : true)
    );

    let calculatedDelta = null;
    if (accHist.length > 1) {
      const sortedHist = [...accHist]
        .filter(b => b && b.date)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      if (sortedHist.length > 1) {
        const firstVal = Number(sortedHist[0].balance || 0);
        const lastVal = Number(sortedHist[sortedHist.length - 1].balance || 0);
        const rawDelta = currentClass === 'Liability' ? -(lastVal - firstVal) : (lastVal - firstVal);
        if (rawDelta !== 0) {
          calculatedDelta = (rawDelta > 0 ? '+' : '') + formatCurrency(rawDelta);
        }
      }
    }

    const name = accName.toLowerCase();
    let details = { sub: '0m ago', delta: calculatedDelta, status: 'synced' };

    if (name.includes('marcus')) {
      details = { sub: 'Savings Account • 0m ago', delta: calculatedDelta, status: 'synced' };
    } else if (name.includes('chase total checking')) {
      details = { sub: 'Checking Account • 0m ago', delta: calculatedDelta || '+$1,862', status: 'synced' };
    } else if (name.includes('emirates')) {
      details = { sub: 'Checking Account • 6d ago', delta: calculatedDelta, status: 'delayed', link: 'Reconnect' };
    } else if (name.includes('wise')) {
      details = { sub: 'Multi-Currency Account • 2d ago', delta: calculatedDelta, status: 'loading' };
    } else if (name.includes('revolut')) {
      details = { sub: 'Checking Account • 38d ago', delta: calculatedDelta, status: 'delayed', link: 'Reconnect' };
    } else if (name.includes('venmo')) {
      details = { sub: 'Cash Balance • 196d ago', delta: calculatedDelta, status: 'delayed', tag: 'Delayed' };
    } else if (name.includes('cash wallet')) {
      details = { sub: 'Manual Asset • 0m ago', delta: calculatedDelta, status: 'synced' };
    } else if (name.includes('apple card')) {
      details = { sub: '1871 • 6d ago', delta: calculatedDelta || '-$94,212', status: 'delayed', link: 'Reconnect' };
    } else if (name.includes('amex')) {
      details = { sub: '8829 • 6d ago', delta: calculatedDelta, status: 'delayed', link: 'Reconnect' };
    } else if (name.includes('sapphire')) {
      details = { sub: '3956 • 0m ago', delta: calculatedDelta || '+$1,862', status: 'synced' };
    } else if (name.includes('adcb')) {
      details = { sub: '4444 • 38d ago', delta: calculatedDelta, status: 'delayed', link: 'Reconnect' };
    }

    return details;
  };

  const getBrandIcon = (accountName = '', type = '') => {
    const nameLower = (accountName || '').toLowerCase();
    const typeLower = (type || '').toLowerCase();

    // Chase
    if (nameLower.includes('chase')) {
      return (
        <svg viewBox="0 0 100 100" className="w-3.5 h-3.5 fill-white">
          <path d="M 50 15 L 78 15 L 85 22 L 85 50 L 50 50 Z" opacity="0.8"/>
          <path d="M 85 50 L 85 78 L 78 85 L 50 85 L 50 50 Z" opacity="0.9"/>
          <path d="M 50 85 L 25 85 L 15 78 L 15 50 L 50 50 Z" opacity="1.0"/>
          <path d="M 15 50 L 15 22 L 22 15 L 50 15 L 50 50 Z" opacity="0.7"/>
          <rect x="35" y="35" width="30" height="30" fill="#1172be" />
        </svg>
      );
    }

    // Robinhood
    if (nameLower.includes('robinhood')) {
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-[#00c805] stroke-[2]">
          <path d="M2 22C2 22 7.5 19.5 12 15C16.5 10.5 18.5 4 18.5 4C18.5 4 12 6 7.5 10.5C3 15 2.5 21.5 2.5 21.5" />
          <path d="M7.5 10.5C7.5 10.5 9.5 15.5 14.5 14.5" />
        </svg>
      );
    }

    // SoFi
    if (nameLower.includes('sofi')) {
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
          <circle cx="6" cy="6" r="2.2" />
          <circle cx="12" cy="6" r="2.2" />
          <circle cx="18" cy="6" r="2.2" />
          <circle cx="6" cy="12" r="2.2" />
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="18" cy="12" r="2.2" />
          <circle cx="6" cy="18" r="2.2" />
          <circle cx="12" cy="18" r="2.2" />
          <circle cx="18" cy="18" r="2.2" />
        </svg>
      );
    }

    // Wells Fargo
    if (nameLower.includes('wells fargo') || nameLower.includes('wf') || nameLower.includes('wells')) {
      return <span className="text-[#f6d000] font-black text-[8px] tracking-tighter">WF</span>;
    }

    // Bank of America
    if (nameLower.includes('bofa') || nameLower.includes('bank of america') || nameLower.includes('america')) {
      return <span className="text-white font-extrabold text-[7px] tracking-tighter">BofA</span>;
    }

    // Vanguard
    if (nameLower.includes('vanguard')) {
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#dcb35c]">
          <path d="M12 2L2 22h20L12 2zm0 4l6.5 13h-13L12 6z" />
        </svg>
      );
    }

    // Fidelity
    if (nameLower.includes('fidelity')) {
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#ffc72c] stroke-[#ffc72c] stroke-[1] fill-none">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6l3 6h-6z" fill="#ffc72c" />
          <path d="M12 18l-3-6h6z" fill="#ffc72c" />
        </svg>
      );
    }

    // E*TRADE
    if (nameLower.includes('etrade') || nameLower.includes('e*trade')) {
      return <span className="text-[#8cc63f] font-black text-[8px] tracking-tight">E*T</span>;
    }

    // Apple Card / Apple
    if (nameLower.includes('apple')) {
      return (
        <svg viewBox="0 0 170 170" className="w-3 h-3 fill-white">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.13-1.92-14.38-6.15-2.82-2.38-6.53-6.82-11.13-13.32-6.15-8.75-11.45-18.42-15.88-29.02-4.43-10.6-6.64-20.73-6.64-30.37 0-13.88 3.53-25.05 10.59-33.51 7.07-8.47 16.21-12.78 27.42-12.91 5.07 0 10.2 1.34 15.39 4.02 5.2 2.68 8.7 4.02 10.5 4.02 1.68 0 5.17-1.34 10.5-4.02 5.33-2.68 10.15-3.9 14.46-3.69 11.29.54 20.08 4.65 26.38 12.35-8.89 5.41-13.27 12.86-13.15 22.37.13 7.6 2.87 13.97 8.22 19.12 5.35 5.15 11.82 8.01 19.4 8.57-2.33 6.72-5.7 13.39-10.11 20.01zm-32.96-107c0-6.15 2.18-11.75 6.53-16.78 4.35-5.04 9.77-8.14 16.27-9.33.11 6.81-2.07 12.73-6.53 17.75-4.47 5.04-9.97 8.27-16.27 8.36z" />
        </svg>
      );
    }

    // American Express / Amex
    if (nameLower.includes('amex') || nameLower.includes('american express')) {
      return <span className="text-white font-extrabold text-[7px] tracking-tighter">AMEX</span>;
    }

    // Marcus
    if (nameLower.includes('marcus')) {
      return <span className="text-[#a28056] font-black text-[10px]">M</span>;
    }

    // Wise
    if (nameLower.includes('wise')) {
      return <span className="text-white font-black text-[10px]">W</span>;
    }

    // Revolut
    if (nameLower.includes('revolut')) {
      return <span className="text-white font-bold text-[10px]">R</span>;
    }

    // Venmo
    if (nameLower.includes('venmo')) {
      return <span className="text-white font-black text-[10px]">V</span>;
    }

    // Fallbacks
    if (nameLower.includes('savings') || typeLower.includes('savings')) {
      return <PiggyBank size={14} className="text-emerald-400" />;
    }
    if (nameLower.includes('credit') || nameLower.includes('card') || typeLower.includes('credit')) {
      return <CreditCard size={14} className="text-rose-400" />;
    }
    if (nameLower.includes('checking') || typeLower.includes('checking')) {
      return <Landmark size={14} className="text-neon-indigo" />;
    }
    if (nameLower.includes('investment') || nameLower.includes('brokerage') || typeLower.includes('investment')) {
      return <Building2 size={14} className="text-violet-400" />;
    }
    return <Wallet size={14} className="text-slate-400" />;
  };

  const getBrandIconContainerClass = (accountName = '') => {
    const nameLower = (accountName || '').toLowerCase();
    if (nameLower.includes('chase')) return 'bg-[#1172be] border-none';
    if (nameLower.includes('robinhood')) return 'bg-[#00c805]/10 border border-[#00c805]/30';
    if (nameLower.includes('sofi')) return 'bg-[#0052ff] border-none';
    if (nameLower.includes('wells fargo') || nameLower.includes('wf') || nameLower.includes('wells')) return 'bg-[#b31b1b] border-none';
    if (nameLower.includes('bofa') || nameLower.includes('bank of america') || nameLower.includes('america')) return 'bg-[#002664] border-none';
    if (nameLower.includes('vanguard')) return 'bg-[#73191b] border-none';
    if (nameLower.includes('fidelity')) return 'bg-[#007a33] border-none';
    if (nameLower.includes('etrade') || nameLower.includes('e*trade')) return 'bg-[#5c2d91] border-none';
    if (nameLower.includes('apple')) return 'bg-gradient-to-tr from-slate-900 to-slate-700 border-none';
    if (nameLower.includes('amex') || nameLower.includes('american express')) return 'bg-[#006fcf] border-none';
    if (nameLower.includes('marcus')) return 'bg-[#0c2340] border border-[#a28056]/30';
    if (nameLower.includes('wise')) return 'bg-[#00B9FF] border-none';
    if (nameLower.includes('revolut')) return 'bg-black border-none';
    if (nameLower.includes('venmo')) return 'bg-[#008CFF] border-none';
    return 'bg-obsidian-900 border border-obsidian-800';
  };

  const getAccountStatusDot = (acc) => {
    const name = acc.toLowerCase();
    if (name.includes('emirates') || name.includes('revolut') || name.includes('apple') || name.includes('amex') || name.includes('adcb')) {
      return <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 absolute -top-0.5 -right-0.5" />;
    }
    if (name.includes('venmo')) {
      return <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 absolute -top-0.5 -right-0.5" />;
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
      <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col space-y-2.5 sm:space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-slate-400 font-semibold text-xs tracking-wider uppercase font-display">Net Worth History</h2>
              <button 
                onClick={() => setShowChart(!showChart)}
                className="p-1 rounded-lg hover:bg-[#131926] text-slate-500 hover:text-slate-350 transition-colors cursor-pointer"
                title={showChart ? "Collapse Chart" : "Expand Chart"}
              >
                {showChart ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            
            {/* Tab Toggles */}
            <div className="flex bg-[#131926] p-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold gap-0.5 border border-slate-800/40">
              <button
                onClick={() => setMetric('assets')}
                className={`px-2.5 py-1 sm:px-3 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                  metric === 'assets'
                    ? 'bg-[#1D273B] text-emerald-400 font-black border border-slate-800/60'
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Assets <span className="bg-[#121724] text-[8px] px-1 rounded text-slate-400 font-semibold hidden sm:inline">7</span>
              </button>
              <button
                onClick={() => setMetric('debts')}
                className={`px-2.5 py-1 sm:px-3 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                  metric === 'debts'
                    ? 'bg-[#1D273B] text-rose-400 font-black border border-slate-800/60'
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Debts <span className="bg-[#121724] text-[8px] px-1 rounded text-slate-400 font-semibold hidden sm:inline">4</span>
              </button>
              <button
                onClick={() => setMetric('history')}
                className={`px-2.5 py-1 sm:px-3 rounded-full transition-all cursor-pointer ${
                  metric === 'history'
                    ? 'bg-[#1D273B] text-emerald-400 font-black border border-slate-800/60'
                    : 'text-slate-500 hover:text-slate-330'
                }`}
              >
                History
              </button>
            </div>
          </div>

          {/* Centered current value */}
          <div className="text-center py-1 sm:py-2 space-y-0.5 sm:space-y-1">
            <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-slate-500 uppercase">{activeDateLabel}</span>
            <div className="flex items-center justify-center space-x-2">
              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-display ${
                metric === 'debts' ? 'text-rose-500' : 'text-[#10B981]'
              }`}>
                {formatCurrency(activeValue)}
              </span>
            </div>
            
            {/* Delta pill */}
            <div className="flex justify-center">
              <span className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeDelta.dir === 'up' 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-rose-500/10 text-rose-400'
              }`}>
                {activeDelta.dir === 'up' ? '▲' : '▼'} {activeDelta.pct}
              </span>
            </div>
          </div>

          {/* Sparkline Area Graph */}
          {showChart && (
            <div className="w-full pt-1">
              <LineChart 
                data={historyData} 
                height={chartHeight} 
                lineColor={metric === 'debts' ? '#EF4444' : '#10B981'}
                glowColor={metric === 'debts' ? '#EF4444' : '#10B981'}
                gradientColor={metric === 'debts' ? '#EF4444' : '#10B981'}
                fillOpacity={0.08}
                strokeWidth={2}
                showGrid={false}
              />
            </div>
          )}
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
                            const details = getAccountSyncDetails(acc.account, acc.account_id, acc.institution, acc.class);
                            return (
                              <div 
                                key={acc.id}
                                onClick={() => handleAccountClick(acc.account)}
                                className="p-3.5 pl-12 pr-6 hover:bg-slate-800/15 transition-all flex items-center justify-between cursor-pointer group"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <div className="relative shrink-0">
                                    <div className={`p-1 rounded transition-all duration-300 flex items-center justify-center w-6 h-6 ${getBrandIconContainerClass(acc.account)}`}>
                                      {getBrandIcon(acc.account, acc.type)}
                                    </div>
                                    {getAccountStatusDot(acc.account)}
                                  </div>
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
                            const details = getAccountSyncDetails(acc.account, acc.account_id, acc.institution, acc.class);
                            return (
                              <div 
                                key={acc.id}
                                onClick={() => handleAccountClick(acc.account)}
                                className="p-3.5 pl-12 pr-6 hover:bg-slate-800/15 transition-all flex items-center justify-between cursor-pointer group"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <div className="relative shrink-0">
                                    <div className={`p-1 rounded transition-all duration-300 flex items-center justify-center w-6 h-6 ${getBrandIconContainerClass(acc.account)}`}>
                                      {getBrandIcon(acc.account, acc.type)}
                                    </div>
                                    {getAccountStatusDot(acc.account)}
                                  </div>
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
          {/* Surplus Investment Goal Tracker */}
          <SurplusGoalTracker surplusMetrics={surplusMetrics} />

          {/* PERMISSION TO SPEND ENGINE SUMMARY CARD */}
          {surplusMetrics && (
            <div 
              onClick={() => setCurrentView('insights')}
              className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-4 hover:border-neon-indigo/55 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
                <span className="flex items-center space-x-1.5 font-bold text-white group-hover:text-neon-indigo transition-colors text-sm">
                  <Compass className="text-neon-indigo animate-spin-slow" size={16} />
                  <span>Permission to Spend</span>
                </span>
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-0.5 group-hover:text-slate-350 transition-colors">
                  View <ChevronRight size={12} />
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Option A: Rolling 30D */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Heart size={10} className="text-neon-indigo" />
                    <span>A: Rolling 30d</span>
                  </span>
                  <p className={`text-sm font-black tracking-tight ${surplusMetrics.rolling.surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {surplusMetrics.rolling.surplus >= 0 
                      ? formatCurrency(surplusMetrics.rolling.surplus) 
                      : `Over budget by ${formatCurrency(Math.abs(surplusMetrics.rolling.surplus))}`}
                  </p>
                  <span className="text-[9px] font-bold text-slate-450 block leading-tight">
                    {surplusMetrics.rolling.surplus >= 0 ? '✓ Clear to Spend' : '⚠️ Deficit'}
                  </span>
                  <div className="w-full h-1 bg-obsidian-950 rounded-full overflow-hidden mt-1">
                    <div 
                      className={`h-full rounded-full ${surplusMetrics.rolling.surplus >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, ((surplusMetrics.rolling.baseline + surplusMetrics.rolling.compounding) / Math.max(surplusMetrics.rolling.income, 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Option B: Blended Projected */}
                <div className="space-y-1.5 border-l border-slate-850/40 pl-4">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Shield size={10} className="text-neon-indigo" />
                    <span>B: Proj Month</span>
                  </span>
                  <p className={`text-sm font-black tracking-tight ${surplusMetrics.projected.surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {surplusMetrics.projected.surplus >= 0 
                      ? formatCurrency(surplusMetrics.projected.surplus) 
                      : `Over budget by ${formatCurrency(Math.abs(surplusMetrics.projected.surplus))}`}
                  </p>
                  <span className="text-[9px] font-bold text-slate-455 block leading-tight">
                    {surplusMetrics.projected.surplus >= 0 ? '✓ Budget Cleared' : '⚠️ Proj Deficit'}
                  </span>
                  <div className="w-full h-1 bg-obsidian-950 rounded-full overflow-hidden mt-1">
                    <div 
                      className={`h-full rounded-full ${surplusMetrics.projected.surplus >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, ((surplusMetrics.projected.baseline + surplusMetrics.projected.compounding) / Math.max(surplusMetrics.projected.income, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

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
              
              {/* Stacked Proportional Bar with tooltips */}
              <div className="w-full h-4 rounded overflow-hidden flex bg-obsidian-950">
                {cashFlowCategories.length === 0 ? (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 font-semibold">No expenses this month</div>
                ) : (
                  cashFlowCategories.slice(0, 5).map(cat => (
                    <div 
                      key={cat.name}
                      className="h-full relative group transition-all cursor-pointer hover:opacity-85"
                      style={{ 
                        width: `${cat.percentage}%`,
                        backgroundColor: cat.color
                      }}
                      title={`${cat.name}: ${formatCurrency(cat.value)} (${cat.percentage.toFixed(0)}%)`}
                    />
                  ))
                )}
              </div>

              {/* Component breakdown display */}
              <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[9px] text-slate-450 pt-1">
                {cashFlowCategories.slice(0, 5).map(cat => (
                  <div key={cat.name} className="flex items-center space-x-1 hover:text-white transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span>{cat.name}</span>
                    <span className="text-slate-500 font-semibold">{cat.percentage.toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              {/* Progress Comparison line */}
              <div className="w-full bg-[#131926] h-1.5 rounded overflow-hidden mt-1">
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
                {savingsHistory.map((bar, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full rounded-t-sm bg-neon-indigo/20 hover:bg-neon-indigo/40 transition-colors relative group"
                      style={{ height: `${bar.val}%` }}
                    >
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black px-2 py-1 rounded text-[10px] font-bold text-white whitespace-nowrap z-10">
                        {bar.m}: {formatCurrency(bar.actualVal)}
                      </div>
                    </div>
                    <span className="text-[8px] font-black text-slate-500 mt-2 block uppercase text-center min-h-[10px]">
                      {i % 2 === 0 ? bar.m : ''}
                    </span>
                  </div>
                ))}
              </div>

              {/* Savings Advice */}
              <div className="text-[10px] text-slate-450 leading-relaxed pt-2 border-t border-slate-800/40 italic">
                {totals.savingsBalance > emergencyFundTarget 
                  ? `${formatCurrency(totals.savingsBalance - emergencyFundTarget)} could be invested for potential greater returns as you have met your 6-month baseline target of ${formatCurrency(emergencyFundTarget)}.`
                  : `You have ${baselineExpenses > 0 ? (totals.savingsBalance / baselineExpenses).toFixed(1) : 0} months of baseline expenses covered. Keep building savings to reach your ${formatCurrency(emergencyFundTarget)} target (6 months of baseline expenses).`}
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
                      {formatRelativeDate(txn.date)} • {txn.category} • {txn.account}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { id: 'insights', label: 'Insights', icon: Compass, color: 'text-sky-400' },
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
