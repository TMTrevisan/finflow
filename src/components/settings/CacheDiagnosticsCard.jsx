import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, Bell, RefreshCw, Trash2, Copy, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { safeStorage } from '../../utils/storage';
import { cleanMerchantName } from '../../utils/formatting';

const formatLastSync = (timestamp) => {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  return date.toLocaleString('default', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

export default function CacheDiagnosticsCard({
  clearCache,
  clearSnapTradeCache,
  loadData,
  lastSync,
  transactions = [],
  categories = [],
  balances = [],
  isSyncing,
  forceMock,
  setForceMock,
  snapTradeStatus = {},
  snapTradeHoldings = {}
}) {
  // Sync Diagnostics state
  const [syncLogs, setSyncLogs] = useState([]);
  const [logsCopied, setLogsCopied] = useState(false);
  const [isConfirmingClearCache, setIsConfirmingClearCache] = useState(false);
  const [isConfirmingClearSnapTradeCache, setIsConfirmingClearSnapTradeCache] = useState(false);

  // Notification state
  const [notificationStatus, setNotificationStatus] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'default';
  });
  const [notificationMessage, setNotificationMessage] = useState(null);

  useEffect(() => {
    const loadLogs = () => {
      try {
        const stored = JSON.parse(safeStorage.getItem('finflow_sync_logs') || '[]');
        setSyncLogs(stored);
      } catch (e) {
        setSyncLogs([]);
      }
    };
    loadLogs();
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsConfirmingClearCache(false);
        setIsConfirmingClearSnapTradeCache(false);
      }
    };
    if (isConfirmingClearCache || isConfirmingClearSnapTradeCache) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfirmingClearCache, isConfirmingClearSnapTradeCache]);

  const handleCopyLogs = async () => {
    const text = syncLogs.length > 0 ? syncLogs.join('\n') : 'No diagnostic events logged yet.';
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setLogsCopied(true);
      setTimeout(() => setLogsCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy sync logs:', err);
      setLogsCopied(false);
    }
  };

  const handleRequestNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationMessage({ type: 'error', text: 'Notifications not supported in this browser.' });
      return;
    }

    const res = await Notification.requestPermission();
    setNotificationStatus(res);
    if (res === 'granted') {
      setNotificationMessage({ type: 'success', text: 'Triage notifications allowed! New uncategorized items will alert you.' });
    } else {
      setNotificationMessage({ type: 'error', text: 'Permission denied. Clear block settings in your browser address bar to retry.' });
    }
  };

  // Cache stats calculations
  const transactionCount = transactions.length;
  const categoryCount = categories.length;
  const balanceCount = balances.length;

  const uniqueMerchantsCount = useMemo(() => {
    const merchants = new Set(transactions.map(t => cleanMerchantName(t.description)).filter(Boolean));
    return merchants.size;
  }, [transactions]);

  const institutionAccountCount = useMemo(() => {
    const latestMap = new Map();
    const sorted = [...(balances || [])]
      .filter(b => b && b.date && b.institution && b.account)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(b => {
      const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
      latestMap.set(key, b);
    });
    return Array.from(latestMap.values()).length;
  }, [balances]);

  const cacheSizeEstimate = useMemo(() => {
    let charCount = 0;
    try {
      charCount += (safeStorage.getItem('finflow_cache_transactions') || '').length;
      charCount += (safeStorage.getItem('finflow_cache_categories') || '').length;
      charCount += (safeStorage.getItem('finflow_cache_balances') || '').length;
    } catch (e) {}
    const kb = (charCount * 2) / 1024;
    return kb.toFixed(1);
  }, [transactions, categories, balances]);

  const handleExecuteClearCache = () => {
    clearCache();
    setIsConfirmingClearCache(false);
  };

  const handleExecuteClearSnapTradeCache = () => {
    clearSnapTradeCache();
    setIsConfirmingClearSnapTradeCache(false);
  };

  return (
    <div className="space-y-6 md:col-span-2">
      {/* Push Notifications Card */}
      <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
            <Bell size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Push Notifications</h3>
            <p className="text-xs text-slate-500">Configure background sync notifications for new uncategorized transactions.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-obsidian-800/40 border border-obsidian-850 rounded-2xl">
          <div>
            <p className="text-xs font-semibold text-slate-400">Triage Notification Permission</p>
            <p className="text-sm font-bold text-slate-100 mt-0.5 capitalize">Permission Status: {notificationStatus}</p>
          </div>
          
          <button
            onClick={handleRequestNotifications}
            className="px-4 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer focus:outline-none"
          >
            Request Alerts Permission
          </button>
        </div>

        {notificationMessage && (
          <div className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
            notificationMessage.type === 'success' 
              ? 'bg-neon-emerald/10 border-neon-emerald/20 text-neon-emerald'
              : 'bg-neon-crimson/10 border-neon-crimson/20 text-neon-crimson'
          }`}>
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{notificationMessage.text}</span>
          </div>
        )}
      </Card>

      {/* Cache & Diagnostics Card */}
      <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
            <HardDrive size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Cache & Diagnostics</h3>
            <p className="text-xs text-slate-500">Manage offline database caching stats and performance.</p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">Google Sheets Cache Database</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transactions</span>
                <span className="text-xl font-bold text-white">{transactionCount} rows</span>
              </div>
              <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Categories</span>
                <span className="text-xl font-bold text-white">{categoryCount} items</span>
              </div>
              <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Merchants</span>
                <span className="text-xl font-bold text-white">{uniqueMerchantsCount} items</span>
              </div>
              <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inst. Accounts</span>
                <span className="text-xl font-bold text-white">{institutionAccountCount} accounts</span>
              </div>
              <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cache Size</span>
                <span className="text-xl font-bold text-white">{cacheSizeEstimate} KB</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">SnapTrade Brokerage Cache Database</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Brokerage Connections</span>
                <span className="text-xl font-bold text-white">{snapTradeStatus.connections?.length || 0} links</span>
              </div>
              <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sync Accounts</span>
                <span className="text-xl font-bold text-white">{snapTradeHoldings.accounts?.length || 0} accounts</span>
              </div>
              <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Equity Positions</span>
                <span className="text-xl font-bold text-white">
                  {snapTradeHoldings.positions?.filter(p => p.symbol?.symbol !== 'CASH' && p.assetClass !== 'Alternatives (Options)')?.length || 0} items
                </span>
              </div>
              <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Option Positions</span>
                <span className="text-xl font-bold text-white">
                  {snapTradeHoldings.positions?.filter(p => p.assetClass === 'Alternatives (Options)')?.length || 0} items
                </span>
              </div>
              <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cash Entries</span>
                <span className="text-xl font-bold text-white">
                  {snapTradeHoldings.positions?.filter(p => p.symbol?.symbol === 'CASH')?.length || 0} items
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-obsidian-800/40 border border-obsidian-850 rounded-2xl">
          <div>
            <p className="text-xs font-semibold text-slate-400">Database & Brokerage Sync</p>
            <p className="text-sm font-bold text-slate-100 mt-0.5">Last Sheets Sync: {formatLastSync(lastSync)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsConfirmingClearCache(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-neon-crimson/10 border border-neon-crimson/25 hover:bg-neon-crimson/25 text-neon-crimson rounded-xl text-xs font-bold transition-colors cursor-pointer focus:outline-none"
            >
              <Trash2 size={14} />
              <span>Clear Sheets Cache</span>
            </button>
            <button
              onClick={() => setIsConfirmingClearSnapTradeCache(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-neon-crimson/10 border border-neon-crimson/25 hover:bg-neon-crimson/25 text-neon-crimson rounded-xl text-xs font-bold transition-colors cursor-pointer focus:outline-none"
            >
              <Trash2 size={14} />
              <span>Clear Brokerage Cache</span>
            </button>
            <button
              onClick={() => loadData(true)}
              disabled={isSyncing}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-obsidian-800 border border-obsidian-750 hover:border-obsidian-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer focus:outline-none"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              <span>Force Refetch Sheets</span>
            </button>
          </div>
        </div>

        {/* Sandbox / Mock Mode */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-obsidian-800/40 border border-obsidian-850 rounded-2xl">
          <div>
            <p className="text-xs font-semibold text-slate-400">Sandbox / Mock Mode</p>
            <p className="text-[10px] text-slate-500 mt-1">Bypasses spreadsheet APIs and forces simulated mock data.</p>
          </div>
          <div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceMock}
                onChange={(e) => setForceMock(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-obsidian-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neon-indigo"></div>
            </label>
          </div>
        </div>

        {/* Terminal Sync Logs */}
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Sync logs & Diagnostics</span>
              <p className="text-[10px] text-slate-600 mt-0.5">Stores the latest 300 events. Copy this block when sharing sync failures.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLogs}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-obsidian-850 border border-obsidian-750 text-[10px] font-bold text-slate-300 hover:text-white hover:border-neon-indigo/50 transition-colors focus:outline-none cursor-pointer"
              >
                <Copy size={12} />
                {logsCopied ? 'Copied' : 'Copy logs'}
              </button>
              <button
                onClick={() => {
                  safeStorage.setItem('finflow_sync_logs', JSON.stringify([]));
                  setSyncLogs([]);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-obsidian-850 border border-obsidian-750 text-[10px] font-bold text-slate-500 hover:text-neon-crimson transition-colors focus:outline-none cursor-pointer"
              >
                Clear logs
              </button>
            </div>
          </div>
          <div className="h-96 max-h-[60vh] overflow-y-auto bg-black/80 border border-obsidian-800 rounded-2xl p-4 font-mono text-xs space-y-1.5 text-slate-300 scrollbar-thin scrollbar-thumb-obsidian-750">
            {syncLogs.length === 0 ? (
              <div className="text-slate-600 italic">No diagnostic events logged yet. Trigger a refetch or sync to generate logs.</div>
            ) : (
              syncLogs.map((log, idx) => {
                const match = log.match(/^\[([^\]]+)\]\s+(.*)$/);
                if (match) {
                  const timestamp = match[1];
                  const msg = match[2];
                  let msgColorClass = 'text-slate-200';
                  if (msg.startsWith('$') || msg.includes('finflow db') || msg.includes('finflow snaptrade')) {
                    msgColorClass = 'text-cyan-400 font-bold';
                  } else if (msg.includes('[ERROR]')) {
                    msgColorClass = 'text-neon-crimson font-semibold';
                  } else if (msg.includes('[SUCCESS]')) {
                    msgColorClass = 'text-neon-emerald font-semibold';
                  } else if (msg.includes('[INFO]')) {
                    msgColorClass = 'text-slate-300';
                  }
                  return (
                    <div key={idx} className="whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                      <span className="text-slate-500 mr-2">[{timestamp}]</span>
                      <span className={msgColorClass}>{msg}</span>
                    </div>
                  );
                }

                let colorClass = 'text-slate-300';
                if (log.includes('$') || log.includes('finflow db') || log.includes('finflow snaptrade')) {
                  colorClass = 'text-cyan-400 font-bold';
                } else if (log.includes('[ERROR]')) {
                  colorClass = 'text-neon-crimson font-semibold';
                } else if (log.includes('[SUCCESS]')) {
                  colorClass = 'text-neon-emerald font-semibold';
                } else if (log.includes('[INFO]')) {
                  colorClass = 'text-slate-300';
                }
                return (
                  <div key={idx} className={`${colorClass} whitespace-pre-wrap break-all text-[11px] leading-relaxed`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      {/* Sheets Cache Modal */}
      <AnimatePresence>
        {isConfirmingClearCache && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmingClearCache(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian-900 border border-obsidian-750 rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl space-y-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-cache-title"
            >
              <div className="flex items-center space-x-3 text-neon-crimson">
                <AlertTriangle size={24} />
                <h3 id="clear-cache-title" className="text-lg font-bold text-white font-display">
                  Clear Sheets Database?
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                This will delete the local transaction and account cache. A full re-fetch will be required next time you launch FinFlow.
              </p>
              <div className="flex space-x-2 pt-2">
                <button
                  onClick={() => setIsConfirmingClearCache(false)}
                  className="flex-1 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-300 text-xs font-bold transition-colors cursor-pointer focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteClearCache}
                  className="flex-1 py-2 rounded-xl bg-neon-crimson hover:bg-red-600 text-white text-xs font-bold transition-colors cursor-pointer focus:outline-none"
                >
                  Clear Cache
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SnapTrade Cache Modal */}
      <AnimatePresence>
        {isConfirmingClearSnapTradeCache && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmingClearSnapTradeCache(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian-900 border border-obsidian-750 rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl space-y-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-snaptrade-cache-title"
            >
              <div className="flex items-center space-x-3 text-neon-crimson">
                <AlertTriangle size={24} />
                <h3 id="clear-snaptrade-cache-title" className="text-lg font-bold text-white font-display">
                  Clear Brokerage Cache?
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                This will purge local brokerage account and equity holding summaries. Your API credentials are preserved.
              </p>
              <div className="flex space-x-2 pt-2">
                <button
                  onClick={() => setIsConfirmingClearSnapTradeCache(false)}
                  className="flex-1 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-300 text-xs font-bold transition-colors cursor-pointer focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteClearSnapTradeCache}
                  className="flex-1 py-2 rounded-xl bg-neon-crimson hover:bg-red-600 text-white text-xs font-bold transition-colors cursor-pointer focus:outline-none"
                >
                  Clear Cache
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
