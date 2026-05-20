import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import LineChart from '../components/ui/LineChart';
import { formatCurrency } from '../utils/formatting';
import { 
  Wallet, 
  CreditCard, 
  TrendingUp, 
  Home, 
  Scale, 
  ChevronDown, 
  ChevronUp,
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  TrendingDown
} from 'lucide-react';

const GROUP_ICONS = {
  'Cash': Wallet,
  'Credit Cards': CreditCard,
  'Investments': TrendingUp,
  'Real Estate': Home,
  'Loans': Scale
};

export default function Dashboard({ setCurrentView }) {
  const { balances, transactions, categories, isLoading, setSelectedAccount } = useAppContext();
  const [collapsedGroups, setCollapsedGroups] = useState({
    'Cash': false,
    'Credit Cards': false,
    'Investments': false,
    'Real Estate': false,
    'Loans': false
  });

  const toggleGroup = (group) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  // Find the latest snapshot for each account (to avoid duplicating history rows)
  const latestBalances = useMemo(() => {
    const latestMap = new Map();
    // Sort chronologically so more recent dates overwrite older ones
    const sorted = [...balances].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(b => {
      const key = `${b.institution}_${b.account}_${b.account_id}`;
      latestMap.set(key, b);
    });
    return Array.from(latestMap.values());
  }, [balances]);

  // Aggregate assets, liabilities and current Net Worth
  const { assets, liabilities, netWorth } = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    latestBalances.forEach(b => {
      const val = Number(b.balance) || 0;
      if (b.class === 'Asset') {
        assets += val;
      } else if (b.class === 'Liability') {
        liabilities += Math.abs(val);
      }
    });
    return { assets, liabilities, netWorth: assets - liabilities };
  }, [latestBalances]);

  // Group latest accounts by their functional group
  const groupedAccounts = useMemo(() => {
    const groups = {
      'Cash': [],
      'Credit Cards': [],
      'Investments': [],
      'Real Estate': [],
      'Loans': []
    };

    latestBalances.forEach(b => {
      const type = b.type ? b.type.toLowerCase() : '';
      if (type === 'checking' || type === 'savings' || type === 'cash') {
        groups['Cash'].push(b);
      } else if (type === 'credit card') {
        groups['Credit Cards'].push(b);
      } else if (type === 'investment' || type === 'retirement' || type === 'brokerage') {
        groups['Investments'].push(b);
      } else if (type === 'real estate' || type === 'property' || type === 'home') {
        groups['Real Estate'].push(b);
      } else if (type === 'loan' || type === 'mortgage') {
        groups['Loans'].push(b);
      } else {
        // Fallback based on asset/liability class
        if (b.class === 'Asset') {
          groups['Cash'].push(b);
        } else {
          groups['Loans'].push(b);
        }
      }
    });

    return groups;
  }, [latestBalances]);

  // Compute Net Worth History for line chart (Grouped by Month for a smooth trend)
  const netWorthHistory = useMemo(() => {
    if (!balances || balances.length === 0) return [];
    
    // Determine how many unique months of history exist
    const uniqueMonths = new Set(balances.map(b => b.date ? b.date.substring(0, 7) : ''));
    uniqueMonths.delete('');
    
    if (uniqueMonths.size <= 1) {
      // Less than 2 months: Fall back to daily view to show recent progress
      const byDate = {};
      balances.forEach(b => {
        const date = b.date;
        if (!date) return;
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(b);
      });
      return Object.entries(byDate).map(([date, records]) => {
        let assetsSum = 0;
        let liabilitiesSum = 0;
        records.forEach(r => {
          const val = Number(r.balance) || 0;
          if (r.class === 'Asset') assetsSum += val;
          else if (r.class === 'Liability') liabilitiesSum += Math.abs(val);
        });
        const dObj = new Date(date);
        const label = isNaN(dObj.getTime()) ? date : dObj.toLocaleString('default', { month: 'short', day: 'numeric' });
        return {
          date: label,
          rawDate: date,
          netWorth: assetsSum - liabilitiesSum
        };
      }).sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
    }

    // 2+ months: Group balances by Year-Month (e.g., "2026-05") for a smooth trend line
    const byMonth = {};
    balances.forEach(b => {
      if (!b.date) return;
      const dateObj = new Date(b.date);
      if (isNaN(dateObj.getTime())) return;
      const yyyymm = b.date.substring(0, 7); // "YYYY-MM"
      
      if (!byMonth[yyyymm]) {
        byMonth[yyyymm] = {};
      }
      
      // Keep only the latest entry per unique account in that month
      const accountKey = `${b.institution}_${b.account}_${b.account_id}`;
      const existing = byMonth[yyyymm][accountKey];
      if (!existing || new Date(b.date) > new Date(existing.date)) {
        byMonth[yyyymm][accountKey] = b;
      }
    });

    const history = Object.entries(byMonth).map(([yyyymm, accountBalancesMap]) => {
      let assetsSum = 0;
      let liabilitiesSum = 0;
      
      Object.values(accountBalancesMap).forEach(r => {
        const val = Number(r.balance) || 0;
        if (r.class === 'Asset') {
          assetsSum += val;
        } else if (r.class === 'Liability') {
          liabilitiesSum += Math.abs(val);
        }
      });
      
      const [year, month] = yyyymm.split('-');
      const dateLabel = new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
      
      return {
        date: dateLabel,
        rawDate: yyyymm,
        netWorth: assetsSum - liabilitiesSum
      };
    });

    return history.sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [balances]);

  const handleAccountClick = (accountName) => {
    setSelectedAccount(accountName);
    if (setCurrentView) {
      setCurrentView('transactions');
    }
  };

  // Calculate Net Worth change (difference between last month and current)
  const netWorthChange = useMemo(() => {
    if (netWorthHistory.length < 2) return { amount: 0, percentage: 0, direction: 'flat' };
    const current = netWorthHistory[netWorthHistory.length - 1].netWorth;
    const previous = netWorthHistory[netWorthHistory.length - 2].netWorth;
    const diff = current - previous;
    const pct = previous !== 0 ? (diff / Math.abs(previous)) * 100 : 0;
    
    return {
      amount: diff,
      percentage: pct,
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
    };
  }, [netWorthHistory]);

  // High-level budget spending pacing comparison
  const { totalSpent, totalBudget } = useMemo(() => {
    let latestDate = new Date();
    if (transactions.length > 0) {
      const dates = transactions
        .map(t => new Date(t.date))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b - a);
      if (dates.length > 0) {
        latestDate = dates[0];
      }
    }
    const targetMonth = latestDate.getMonth();
    const targetYear = latestDate.getFullYear();

    const totalBudget = categories.filter(c => c.type === 'Expense').reduce((sum, c) => sum + (c.budget || 0), 0);
    const totalSpent = transactions
      .filter(t => {
        if (t.type !== 'Expense') return false;
        const d = new Date(t.date);
        return !isNaN(d.getTime()) && d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return { totalSpent, totalBudget };
  }, [transactions, categories]);

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-6 animate-pulse">
        <div className="h-48 bg-obsidian-800 rounded-3xl w-full"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-obsidian-800 rounded-3xl"></div>
          <div className="h-96 bg-obsidian-800 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Net Worth Dashboard Card */}
      <div className="bg-gradient-to-br from-obsidian-800 via-obsidian-800 to-obsidian-900 border border-obsidian-700/80 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-neon-indigo/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-slate-400 font-semibold mb-1 uppercase tracking-wider text-xs">Total Net Worth</h2>
              <div className="flex items-baseline space-x-3">
                <span className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight">
                  {formatCurrency(netWorth)}
                </span>
                
                {netWorthChange.amount !== 0 && (
                  <div className={`flex items-center space-x-1 text-sm font-medium px-2 py-0.5 rounded-full ${
                    netWorthChange.direction === 'up' ? 'bg-neon-emerald/10 text-neon-emerald' : 'bg-neon-crimson/10 text-neon-crimson'
                  }`}>
                    {netWorthChange.direction === 'up' ? <ArrowUpRight size={14} /> : <TrendingDown size={14} />}
                    <span>
                      {Math.abs(netWorthChange.percentage).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-8 pt-2">
              <div>
                <div className="flex items-center space-x-1.5 text-neon-emerald mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-emerald"></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assets</span>
                </div>
                <span className="text-lg md:text-xl font-bold text-slate-100">{formatCurrency(assets)}</span>
              </div>
              <div className="w-px h-10 bg-obsidian-700"></div>
              <div>
                <div className="flex items-center space-x-1.5 text-neon-crimson mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-crimson"></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Liabilities</span>
                </div>
                <span className="text-lg md:text-xl font-bold text-slate-100">{formatCurrency(liabilities)}</span>
              </div>
            </div>
          </div>

          {/* Historical Line Chart Visualizer */}
          <div className="flex-1 max-w-xl lg:max-w-2xl w-full">
            <LineChart data={netWorthHistory} height={180} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accounts Grid - Copilot Style Collapsible Sections */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white tracking-tight">Accounts</h3>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck size={14} className="text-neon-emerald" /> Bank connections verified
            </span>
          </div>

          <div className="space-y-3">
            {Object.entries(groupedAccounts).map(([group, accounts]) => {
              if (accounts.length === 0) return null;
              
              const GroupIcon = GROUP_ICONS[group] || Wallet;
              const isCollapsed = collapsedGroups[group];
              const groupTotal = accounts.reduce((sum, a) => sum + a.balance, 0);

              return (
                <Card key={group} className="bg-obsidian-800/40 border-obsidian-800/80 shadow-md">
                  <div 
                    onClick={() => toggleGroup(group)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-obsidian-800/30 transition-colors select-none"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-obsidian-800 rounded-xl text-slate-400 group-hover:text-white transition-colors">
                        <GroupIcon size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm md:text-base">{group}</h4>
                        <p className="text-xs text-slate-500">{accounts.length} account{accounts.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-slate-200 text-sm md:text-base">
                        {formatCurrency(groupTotal)}
                      </span>
                      {isCollapsed ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronUp size={18} className="text-slate-500" />}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="border-t border-obsidian-800/50 divide-y divide-obsidian-800/30 px-4 pb-2">
                      {accounts.map(account => (
                        <div 
                          key={account.id} 
                          onClick={() => handleAccountClick(account.account)}
                          className="flex justify-between items-center py-3 group cursor-pointer hover:bg-obsidian-800/40 px-2 -mx-2 rounded-lg transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-300 group-hover:text-neon-indigo transition-colors">{account.account}</p>
                            <p className="text-[10px] text-slate-500">{account.institution} • {account.account_id}</p>
                          </div>
                          <span className={`text-sm font-bold ${account.class === 'Asset' ? 'text-slate-100' : 'text-slate-400'}`}>
                            {formatCurrency(account.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Monthly Budget Summary Progress Box */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white tracking-tight">Spending Target</h3>
          <Card className="bg-gradient-to-b from-obsidian-800/40 to-obsidian-900/40 border-obsidian-800/80">
            <CardContent className="pt-6">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Spent</p>
                  <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(totalSpent)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Budget</p>
                  <p className="text-base font-bold text-slate-300">{formatCurrency(totalBudget)}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <ProgressBar value={totalSpent} max={totalBudget} className="h-3" />
                
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Paced spending</span>
                  <span className="font-semibold text-slate-300">
                    {Math.round((totalSpent / totalBudget) * 100)}% consumed
                  </span>
                </div>
                
                <div className="pt-4 border-t border-obsidian-800/80 text-center">
                  <p className="text-sm text-slate-400 font-medium">
                    {totalBudget > totalSpent ? (
                      <>You have <span className="text-neon-emerald font-bold">{formatCurrency(totalBudget - totalSpent)}</span> left to spend.</>
                    ) : (
                      <>You are <span className="text-neon-crimson font-bold">{formatCurrency(totalSpent - totalBudget)}</span> over budget!</>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
