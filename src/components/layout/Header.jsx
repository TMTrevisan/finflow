import React, { useState, useEffect } from 'react';
import { RefreshCw, Bell, AlertTriangle, Settings, Search, Sun, Moon } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header({ title, currentView, setCurrentView }) {
  const { syncData, isSyncing, error, isMockData, lastSync, setGlobalSearchOpen } = useAppContext();
  
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('finflow_theme') || 'dark';
  });

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

  return (
    <header className="flex items-center justify-between p-6 border-b border-obsidian-700 bg-obsidian-900/80 backdrop-blur-md sticky top-0 z-40">
      <h2 className="text-xl font-semibold md:hidden text-white">{title}</h2>
      <div className="hidden md:block">
        <h2 className="text-2xl font-bold text-white capitalize">{title}</h2>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Dynamic Connection/Sync Status Indicator */}
        <div 
          title={getTooltipText()}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors duration-300 cursor-help ${getStatusStyles()}`}
        >
          <span className="relative flex h-2 w-2">
            {/* Pulsing ring animation */}
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getDotStyles()}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${getDotStyles()}`}></span>
          </span>
          <span>{syncTimeLabel}</span>
        </div>

        <button 
          onClick={() => setCurrentView('settings')}
          className={`p-2 rounded-full hover:bg-obsidian-700 transition-colors relative ${
            currentView === 'settings' ? 'text-neon-indigo bg-obsidian-800' : 'text-slate-400 hover:text-white'
          }`}
          title="Settings"
        >
          <Settings size={20} />
        </button>

        <button 
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-obsidian-700 text-slate-400 hover:text-white transition-colors relative"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <button 
          onClick={() => setGlobalSearchOpen(true)}
          className="p-2 rounded-full hover:bg-obsidian-700 text-slate-400 hover:text-white transition-colors relative"
          title="Search (Cmd+K)"
        >
          <Search size={20} />
        </button>

        <button 
          className="p-2 rounded-full hover:bg-obsidian-700 text-slate-400 hover:text-white transition-colors relative"
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-neon-crimson rounded-full"></span>
        </button>
        
        <button 
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center space-x-2 px-4 py-2 bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isSyncing ? "animate-spin text-neon-emerald" : ""} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
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
