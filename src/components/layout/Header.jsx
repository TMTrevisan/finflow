import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Bell, AlertTriangle, Settings, Search, Sun, Moon, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';

import { formatCurrency } from '../../utils/formatting';

export default function Header({ title, currentView, setCurrentView }) {
  const { syncData, isSyncing, error, isMockData, lastSync, setGlobalSearchOpen, balances = [], transactions = [], categories = [], snapTradeHoldings, snapTradeError } = useAppContext();
  
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('finflow_theme') || 'dark';
  });

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  useEffect(() => {
    if (!isAlertsOpen) return;
    const handleClose = () => setIsAlertsOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isAlertsOpen]);

  const alerts = useMemo(() => {
    const list = [];

    // 1. Stale sync warning
    const isStale = lastSync && (Date.now() - new Date(lastSync).getTime() > 24 * 60 * 60 * 1000);
    if (isStale) {
      list.push({
        id: 'stale_sync',
        type: 'warning',
        title: 'Database Sync Stale',
        description: 'FinFlow database hasn\'t been synced in over 24 hours. Sync now to retrieve latest activity.',
        actionLabel: 'Sync Now',
        action: 'sync'
      });
    }

    // 2. Account Sync status alerts
    const latestMap = new Map();
    const sortedBalances = [...(balances || [])]
      .filter(b => b && b.date && b.institution && b.account)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedBalances.forEach(b => {
      const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
      latestMap.set(key, b);
    });
    
    Array.from(latestMap.values()).forEach(acc => {
      const name = acc.account.toLowerCase();
      if (name.includes('emirates') || name.includes('revolut') || name.includes('apple') || name.includes('amex') || name.includes('adcb')) {
        list.push({
          id: `sync_delay_${acc.account}`,
          type: 'info',
          title: `Sync Delayed: ${acc.account}`,
          description: `The connection to ${acc.institution} has been delayed. Click to view accounts.`,
          actionLabel: 'View Accounts',
          action: 'view_accounts'
        });
      }
      if (name.includes('venmo')) {
        list.push({
          id: `sync_action_${acc.account}`,
          type: 'error',
          title: `Action Required: ${acc.account}`,
          description: `A credential update is required for your Venmo link. Click to view accounts.`,
          actionLabel: 'Fix Link',
          action: 'view_accounts'
        });
      }
    });

    // 3. Budgets Overspent alert
    const today = new Date();
    const currentMonthTxns = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && t.type === 'Expense';
    });
    
    categories.forEach(cat => {
      if (cat.budget > 0) {
        const spent = currentMonthTxns
          .filter(t => t.category === cat.category)
          .reduce((sum, t) => sum - t.amount, 0);
        if (spent > cat.budget) {
          list.push({
            id: `overspent_${cat.category}`,
            type: 'warning',
            title: `Budget Exceeded: ${cat.category}`,
            description: `You have spent ${spent.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} which is over your ${cat.budget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} budget limit.`,
            actionLabel: 'View Budgets',
            action: 'view_budgets'
          });
        }
      }
    });

    // 4. Cash Drag Warning (if > 8%)
    let totalCash = 0;
    let totalInvested = 0;

    const isCashEquivalent = (pos) => {
      if (pos.symbol?.symbol === 'CASH' || pos.is_cash || pos.assetClass === 'Cash & Equivalents') return true;
      const sym = String(pos.symbol?.symbol || '').toUpperCase().trim();
      const name = String(pos.symbol?.name || '').toUpperCase();
      const cashEtfs = ['SGOV', 'BIL', 'SHV', 'USFR', 'TFLO', 'CLIP', 'TBIL', 'JPST', 'MINT', 'FLOT', 'ICSH', 'WEEK', 'WKLY'];
      if (cashEtfs.includes(sym)) return true;
      if (sym.includes('USTB') || sym.includes('TREASURY') || sym.includes('T-BILL')) return true;
      if (name.includes('TREASURY BILL') || name.includes('T-BILL') || name.includes('0-3 MONTH') || name.includes('1-3 MONTH')) return true;
      return false;
    };

    const positions = snapTradeHoldings?.positions || [];
    positions.forEach(pos => {
      const val = pos.value || 0;
      if (isCashEquivalent(pos)) {
        totalCash += val;
      } else {
        totalInvested += val;
      }
    });

    // Filter latest balance entries per account
    const latestMapForDrag = new Map();
    const sortedBalancesForDrag = [...(balances || [])]
      .filter(b => b && b.date && b.institution && b.account)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedBalancesForDrag.forEach(b => {
      const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
      latestMapForDrag.set(key, b);
    });

    Array.from(latestMapForDrag.values()).forEach(b => {
      if (b.class === 'Asset') {
        const type = String(b.type || '').toLowerCase();
        const name = String(b.account || '').toLowerCase();
        if (type === 'checking' || type === 'savings' || type === 'cash' || name.includes('checking') || name.includes('savings')) {
          totalCash += (Number(b.balance) || 0);
        }
      }
    });

    const totalValue = totalCash + totalInvested;
    const cashDragRatio = totalValue > 0 ? (totalCash / totalValue) * 100 : 0;

    if (cashDragRatio > 8) {
      list.push({
        id: 'cash_drag_alert',
        type: 'warning',
        title: 'High Cash Drag Detected',
        description: `Your cash sweep & liquid reserves are currently at ${cashDragRatio.toFixed(1)}% (${formatCurrency(totalCash)}). This exceeds the 8% target and may drag your portfolio returns.`,
        actionLabel: 'View Wealth',
        action: 'view_wealth'
      });
    }

    // 5. SnapTrade Sync Error Alert
    if (snapTradeError) {
      list.push({
        id: 'snaptrade_error',
        type: 'error',
        title: 'Brokerage Sync Failed',
        description: `SnapTrade connection error: ${snapTradeError}. Displaying cached holdings.`,
        actionLabel: 'Check Settings',
        action: 'view_settings'
      });
    }

    return list;
  }, [balances, transactions, categories, lastSync, snapTradeHoldings, snapTradeError]);

  const handleAlertAction = (action) => {
    setIsAlertsOpen(false);
    if (action === 'sync') {
      handleSync();
    } else if (action === 'view_accounts') {
      setCurrentView('accounts');
    } else if (action === 'view_budgets') {
      setCurrentView('budgets');
    } else if (action === 'view_wealth') {
      setCurrentView('wealth');
    } else if (action === 'view_settings') {
      setCurrentView('settings');
    }
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      document.body.classList.add('light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      document.body.classList.remove('light');
    }
    localStorage.setItem('finflow_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setGlobalSearchOpen]);
  const [showToast, setShowToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [syncTimeLabel, setSyncTimeLabel] = useState('Live Synced');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isStale = lastSync && (Date.now() - new Date(lastSync).getTime() > 24 * 60 * 60 * 1000);

  useEffect(() => {
    if (error) {
      setShowErrorToast(true);
      const timer = setTimeout(() => setShowErrorToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Update sync relative label periodically
  useEffect(() => {
    const updateLabel = () => {
      if (!isOnline) {
        setSyncTimeLabel('Offline (Local Cache)');
        return;
      }
      if (isSyncing) {
        setSyncTimeLabel('Syncing...');
        return;
      }
      if (isMockData) {
        setSyncTimeLabel('Demo Mode');
        return;
      }
      if (isStale) {
        setSyncTimeLabel('Stale Data (>24h)');
        return;
      }
      if (error) {
        setSyncTimeLabel('Sync Failed');
        return;
      }
      if (!lastSync) {
        setSyncTimeLabel('Live Synced');
        return;
      }

      const diffMs = Date.now() - new Date(lastSync).getTime();
      const secondsAgo = Math.floor(diffMs / 1000);
      if (secondsAgo < 10) {
        setSyncTimeLabel('Just Synced');
      } else if (secondsAgo < 60) {
        setSyncTimeLabel('Synced <1m ago');
      } else {
        const minutesAgo = Math.floor(secondsAgo / 60);
        if (minutesAgo < 60) {
          setSyncTimeLabel(`Synced ${minutesAgo}m ago`);
        } else {
          const hoursAgo = Math.floor(minutesAgo / 60);
          if (hoursAgo < 24) {
            setSyncTimeLabel(`Synced ${hoursAgo}h ago`);
          } else {
            setSyncTimeLabel(`Synced ${new Date(lastSync).toLocaleDateString()}`);
          }
        }
      }
    };

    updateLabel();
    const interval = setInterval(updateLabel, 10000);
    return () => clearInterval(interval);
  }, [isSyncing, isMockData, error, lastSync, isOnline, isStale]);

  const handleSync = async () => {
    if (!isOnline) return;
    const success = await syncData();
    if (success) {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const getStatusStyles = () => {
    if (!isOnline) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    if (isSyncing) return 'bg-neon-indigo/10 text-neon-indigo border-neon-indigo/20';
    if (isMockData) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (isStale) return 'bg-neon-crimson/10 text-neon-crimson border-neon-crimson/20';
    if (error) return 'bg-neon-crimson/10 text-neon-crimson border-neon-crimson/20';
    return 'bg-neon-emerald/10 text-neon-emerald border-neon-emerald/20';
  };

  const getDotStyles = () => {
    if (!isOnline) return 'bg-amber-500';
    if (isSyncing) return 'bg-neon-indigo';
    if (isMockData) return 'bg-yellow-400';
    if (isStale) return 'bg-neon-crimson';
    if (error) return 'bg-neon-crimson';
    return 'bg-neon-emerald';
  };

  const getTooltipText = () => {
    if (!isOnline) return 'App is running in offline mode. Changes are saved to local cache.';
    if (isSyncing) return 'Fetching latest transactions and balances from server.';
    if (isMockData) return 'Displaying generated mock financial data for exploration.';
    if (isStale) return 'Data has not been synced in over 24 hours. Click Sync Data to update.';
    if (error) return `Last sync attempt failed: ${error}`;
    return `Connected. Displaying up-to-date data synced at ${lastSync ? new Date(lastSync).toLocaleTimeString() : 'start'}.`;
  };

  const getShortSyncTimeLabel = (label) => {
    return label
      .replace('Synced ', '')
      .replace(' ago', '')
      .replace('Offline (Local Cache)', 'Offline')
      .replace('Demo Mode', 'Demo')
      .replace('Stale Data (>24h)', 'Stale')
      .replace('Sync Failed', 'Failed')
      .replace('Live Synced', 'Live');
  };

  return (
    <header className="flex items-center justify-between p-4 sm:p-6 border-b border-obsidian-700 bg-obsidian-900/80 backdrop-blur-md sticky top-0 z-40">
      <h2 className="text-lg font-bold md:hidden text-white truncate max-w-[120px]">{title}</h2>
      <div className="hidden md:block">
        <h2 className="text-2xl font-bold text-white capitalize">{title}</h2>
      </div>
      
      <div className="flex items-center space-x-1.5 sm:space-x-3 md:space-x-4">
        {/* Dynamic Connection/Sync Status Indicator */}
        <div 
          title={getTooltipText()}
          className={`flex items-center space-x-1 sm:space-x-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold border transition-colors duration-300 cursor-help ${getStatusStyles()}`}
        >
          <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
            {/* Pulsing ring animation */}
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getDotStyles()}`}></span>
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 ${getDotStyles()}`}></span>
          </span>
          <span className="hidden xs:inline">{syncTimeLabel}</span>
          <span className="xs:hidden">{getShortSyncTimeLabel(syncTimeLabel)}</span>
        </div>

        <button 
          onClick={() => setCurrentView('settings')}
          className={`p-1.5 sm:p-2 rounded-full hover:bg-obsidian-700 transition-colors relative ${
            currentView === 'settings' ? 'text-neon-indigo bg-obsidian-800' : 'text-slate-400 hover:text-white'
          }`}
          title="Settings"
        >
          <Settings size={18} className="sm:w-5 sm:h-5" />
        </button>

        <button 
          onClick={toggleTheme}
          className="p-1.5 sm:p-2 rounded-full hover:bg-obsidian-700 text-slate-400 hover:text-white transition-colors relative"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={18} className="sm:w-5 sm:h-5" /> : <Sun size={18} className="sm:w-5 sm:h-5" />}
        </button>

        <button 
          onClick={() => setGlobalSearchOpen(true)}
          className="p-1.5 sm:p-2 rounded-full hover:bg-obsidian-700 text-slate-400 hover:text-white transition-colors relative"
          title="Search (Cmd+K)"
        >
          <Search size={18} className="sm:w-5 sm:h-5" />
        </button>

        <div className="relative">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsAlertsOpen(prev => !prev);
            }}
            className={`p-1.5 sm:p-2 rounded-full hover:bg-obsidian-700 transition-colors relative ${
              isAlertsOpen ? 'text-neon-indigo bg-obsidian-800' : 'text-slate-400 hover:text-white'
            }`}
            title="Notifications"
          >
            <Bell size={18} className="sm:w-5 sm:h-5" />
            {alerts.length > 0 && (
              <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-neon-crimson text-[8px] sm:text-[9px] font-extrabold text-white">
                {alerts.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isAlertsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-2 w-72 sm:w-96 bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl p-4 z-50 text-left"
              >
                <div className="flex justify-between items-center pb-2 border-b border-obsidian-800 mb-3">
                  <h3 className="font-bold text-white text-sm">System Alerts</h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{alerts.length} active</span>
                </div>

                {alerts.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <CheckCircle2 className="mx-auto text-neon-emerald mb-2" size={24} />
                    All caught up! No recent alerts.
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                    {alerts.map(alert => (
                      <div 
                        key={alert.id}
                        className={`p-3 rounded-xl border text-xs flex flex-col space-y-2 ${
                          alert.type === 'error'
                            ? 'bg-neon-crimson/5 border-neon-crimson/15'
                            : alert.type === 'warning'
                              ? 'bg-amber-500/5 border-amber-500/15'
                              : 'bg-neon-indigo/5 border-neon-indigo/15'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <AlertTriangle 
                            size={14} 
                            className={
                              alert.type === 'error'
                                ? 'text-neon-crimson'
                                : alert.type === 'warning'
                                  ? 'text-amber-500'
                                  : 'text-neon-indigo'
                            } 
                          />
                          <span className="font-bold text-slate-200">{alert.title}</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed text-[11px]">{alert.description}</p>
                        {alert.actionLabel && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleAlertAction(alert.action)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors ${
                                alert.type === 'error'
                                  ? 'bg-neon-crimson/15 hover:bg-neon-crimson/25 text-neon-crimson'
                                  : alert.type === 'warning'
                                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-500'
                                    : 'bg-neon-indigo/15 hover:bg-neon-indigo/25 text-neon-indigo'
                              }`}
                            >
                                {alert.actionLabel}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <button 
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center justify-center p-2 sm:px-3 sm:py-2 bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={isSyncing ? "animate-spin text-neon-emerald" : ""} />
          <span className="hidden sm:inline sm:ml-1.5">{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
        </button>
      </div>

      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 bg-neon-emerald/10 border border-neon-emerald text-neon-emerald px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 z-50"
          >
            <RefreshCw size={18} className="text-neon-emerald" />
            <span className="font-medium text-sm">Data synced successfully</span>
          </motion.div>
        )}
        
        {showErrorToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 bg-neon-crimson/10 border border-neon-crimson text-neon-crimson px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 z-50 max-w-sm"
          >
            <AlertTriangle size={18} className="text-neon-crimson shrink-0" />
            <span className="font-medium text-sm">{error || "Failed to sync data"}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
