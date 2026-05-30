import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { formatCurrency, cleanMerchantName } from '../../utils/formatting';

export default function GlobalSearch() {
  const { 
    transactions = [], 
    globalSearchOpen, 
    setGlobalSearchOpen,
    navigateToTransactions 
  } = useAppContext();

  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Focus input on open
  useEffect(() => {
    if (globalSearchOpen) {
      setQuery('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [globalSearchOpen]);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setGlobalSearchOpen(false);
      }
    };
    if (globalSearchOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [globalSearchOpen, setGlobalSearchOpen]);

  // Click outside to close
  const handleOverlayClick = (e) => {
    if (containerRef.current && !containerRef.current.contains(e.target)) {
      setGlobalSearchOpen(false);
    }
  };

  // Fuzzy match transactions
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    
    return (transactions || [])
      .filter(t => {
        const desc = String(t.description || '').toLowerCase();
        const cat = String(t.category || '').toLowerCase();
        const acc = String(t.account || '').toLowerCase();
        return searchTerms.every(term => 
          desc.includes(term) || cat.includes(term) || acc.includes(term)
        );
      })
      .slice(0, 8);
  }, [transactions, query]);

  const handleSelectResult = (item) => {
    setGlobalSearchOpen(false);
    // Deep link: navigate to transactions and pre-filter by the description
    navigateToTransactions({
      account: null,
      category: null,
      dateRange: null
    });
    // Store query in sessionStorage so Transactions view can read and apply it as local search filter
    sessionStorage.setItem('finflow_transactions_search', item.description);
    // Trigger storage event to notify Transactions component in case it's already mounted
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <AnimatePresence>
      {globalSearchOpen && (
        <div 
          onClick={handleOverlayClick}
          className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-md z-[100] flex items-start justify-center pt-[15vh] px-4"
        >
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-2xl bg-[#0B0E14] border border-obsidian-700/60 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[60vh]"
          >
            {/* Input Bar */}
            <div className="flex items-center space-x-3 px-5 py-4 border-b border-obsidian-750">
              <Search className="text-slate-400 shrink-0" size={20} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search transactions by merchant, category, account..."
                className="flex-1 bg-transparent border-none outline-none text-white text-base placeholder-slate-500 font-medium"
              />
              <button 
                onClick={() => setGlobalSearchOpen(false)}
                className="p-1 rounded-lg hover:bg-obsidian-800 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {!query.trim() ? (
                <div className="text-center py-8 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  Type to start searching...
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  No matching transactions found
                </div>
              ) : (
                results.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectResult(t)}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-800/15 text-left transition-all active:scale-[0.99] group"
                  >
                    <div className="min-w-0 pr-4">
                      <p className="text-sm font-bold text-slate-100 group-hover:text-neon-indigo transition-colors truncate">
                        {cleanMerchantName(t.description)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1 truncate font-semibold uppercase tracking-wider">
                        {t.date} • {t.category} • {t.account}
                      </p>
                    </div>
                    
                    <div className="shrink-0 flex items-center space-x-2">
                      <span className={`text-sm font-extrabold ${
                        t.type === 'Income' ? 'text-emerald-400' : 'text-slate-200'
                      }`}>
                        {t.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Keyboard shortcuts footer */}
            <div className="bg-obsidian-900 px-5 py-2.5 border-t border-obsidian-750 text-[10px] text-slate-500 flex justify-between font-bold uppercase tracking-wider select-none">
              <span>Press <kbd className="bg-obsidian-800 px-1.5 py-0.5 rounded border border-obsidian-700">ESC</kbd> to close</span>
              <span>Click a result to inspect</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
