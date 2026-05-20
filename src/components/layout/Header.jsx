import React, { useState, useEffect } from 'react';
import { RefreshCw, Bell, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header({ title }) {
  const { syncData, isSyncing, error, isMockData } = useAppContext();
  const [showToast, setShowToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);

  useEffect(() => {
    if (error) {
      setShowErrorToast(true);
      const timer = setTimeout(() => setShowErrorToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSync = async () => {
    const success = await syncData();
    if (success) {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  return (
    <header className="flex items-center justify-between p-6 border-b border-obsidian-700 bg-obsidian-900/80 backdrop-blur-md sticky top-0 z-40">
      <h2 className="text-xl font-semibold md:hidden text-white">{title}</h2>
      <div className="hidden md:block">
        <h2 className="text-2xl font-bold text-white capitalize">{title}</h2>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Dynamic Connection/Sync Status Indicator */}
        <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
          isMockData 
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
            : 'bg-neon-emerald/10 text-neon-emerald border-neon-emerald/20'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            isMockData ? 'bg-amber-400 animate-pulse' : 'bg-neon-emerald animate-pulse'
          }`}></span>
          <span>{isMockData ? 'Demo Mode' : 'Live Synced'}</span>
        </div>

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
