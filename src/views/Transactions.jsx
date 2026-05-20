import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, formatDate, cleanMerchantName } from '../utils/formatting';
import { CategoryPill } from '../components/ui/CategoryPill';
import { Search, Filter } from 'lucide-react';
import { cn } from '../components/ui/Card';

export default function Transactions() {
  const { transactions, isLoading, selectedAccount, setSelectedAccount } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');

  // Filter transactions based on search and selected filter
  const { reviewTransactions, filteredTransactions } = useMemo(() => {
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

    const fortyFiveDaysAgo = new Date(latestDate.getTime());
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

    const review = transactions.filter(txn => {
      const isUncategorized = txn.category === 'Uncategorized' || !txn.category;
      if (!isUncategorized) return false;

      // Fuzzy matching selected account
      if (selectedAccount) {
        const tAcc = (txn.account || '').toLowerCase().trim();
        const sAcc = String(selectedAccount).toLowerCase().trim();
        if (tAcc !== sAcc && !tAcc.includes(sAcc) && !sAcc.includes(tAcc)) {
          return false;
        }
      }

      const date = new Date(txn.date);
      return !isNaN(date.getTime()) && date >= fortyFiveDaysAgo;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const standard = transactions.filter(txn => {
      const isUncategorized = txn.category === 'Uncategorized' || !txn.category;
      const date = new Date(txn.date);
      const isNewUncategorized = isUncategorized && !isNaN(date.getTime()) && date >= fortyFiveDaysAgo;

      // Exclude uncategorized from standard list only if it's currently showing in the Needs Review section
      if (filter === 'All' && searchTerm === '' && isNewUncategorized) return false;
      
      // Fuzzy matching selected account
      if (selectedAccount) {
        const tAcc = (txn.account || '').toLowerCase().trim();
        const sAcc = String(selectedAccount).toLowerCase().trim();
        if (tAcc !== sAcc && !tAcc.includes(sAcc) && !sAcc.includes(tAcc)) {
          return false;
        }
      }

      const cleanedDesc = cleanMerchantName(txn.description);
      const matchesSearch = 
        txn.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cleanedDesc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (txn.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesFilter = true;
      if (filter === 'Income') matchesFilter = txn.type === 'Income'; // Use category-decorated type
      if (filter === 'Expenses') matchesFilter = txn.type === 'Expense'; // Use category-decorated type
      if (filter === 'Uncategorized') matchesFilter = isUncategorized;

      return matchesSearch && matchesFilter;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    return { reviewTransactions: review, filteredTransactions: standard };
  }, [transactions, searchTerm, filter, selectedAccount]);

  if (isLoading) {
    return <div className="animate-pulse">Loading Transactions...</div>;
  }

  const FILTERS = ['All', 'Income', 'Expenses', 'Uncategorized'];

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Sticky Controls Header */}
      <div className="sticky top-0 z-30 bg-obsidian-900/95 backdrop-blur pt-2 pb-4 border-b border-obsidian-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
          />
        </div>
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
          <Filter size={16} className="text-slate-500 mr-1 hidden md:block" />
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap",
                filter === f
                  ? "bg-neon-indigo border-neon-indigo text-white shadow-lg shadow-neon-indigo/20"
                  : "bg-obsidian-800 border-obsidian-700 text-slate-400 hover:text-white"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Account Filter Indicator */}
      {selectedAccount && (
        <div className="flex items-center space-x-2 bg-obsidian-800 border border-obsidian-700 px-4 py-2 rounded-xl text-sm text-slate-300 self-start">
          <span>Account:</span>
          <span className="font-bold text-white bg-neon-indigo/20 px-2 py-0.5 rounded text-xs">{selectedAccount}</span>
          <button 
            onClick={() => setSelectedAccount(null)}
            className="text-slate-500 hover:text-white transition-colors ml-1 font-bold text-base line-height-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Needs Review Section */}
      {searchTerm === '' && filter === 'All' && reviewTransactions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neon-crimson flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neon-crimson animate-pulse" />
              Needs Review ({reviewTransactions.length})
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">Uncategorized transactions from last 45 days</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewTransactions.map((txn) => (
              <div 
                key={txn.id} 
                className="bg-gradient-to-br from-obsidian-800 to-obsidian-850 border border-neon-crimson/20 hover:border-neon-crimson/40 rounded-2xl p-4 flex items-center justify-between shadow-lg transition-all"
              >
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="text-[10px] text-slate-500 font-medium">{formatDate(txn.date)}</span>
                  <span className="font-bold text-white text-sm truncate mt-0.5">{cleanMerchantName(txn.description)}</span>
                  <span className="text-[10px] text-slate-400 truncate mt-0.5">{txn.account}</span>
                </div>
                <div className="flex flex-col items-end space-y-2 shrink-0">
                  <span className={cn("font-bold text-lg", txn.amount > 0 ? "text-neon-emerald" : "text-white")}>
                    {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                  </span>
                  <CategoryPill transaction={txn} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standard Transactions List */}
      <div className="bg-obsidian-800 border border-obsidian-700 rounded-2xl shadow-xl flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-y-auto flex-1 min-h-0">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="border-b border-obsidian-700 bg-obsidian-800/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-48">Category</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right w-36">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-700/50">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                    No transactions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-obsidian-700/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 w-32 truncate">
                      {formatDate(txn.date)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white truncate">{cleanMerchantName(txn.description)}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{txn.account}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-48">
                      <CategoryPill transaction={txn} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium w-36">
                      <span className={txn.amount > 0 ? "text-neon-emerald" : "text-white"}>
                        {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View List */}
        <div className="md:hidden overflow-y-auto flex-1 min-h-0 divide-y divide-obsidian-700/50">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No transactions found matching your criteria.
            </div>
          ) : (
            filteredTransactions.map((txn) => (
              <div key={txn.id} className="p-4 flex flex-col justify-between hover:bg-obsidian-770 transition-colors space-y-1">
                {/* Top Row: Description and Amount */}
                <div className="flex justify-between items-center w-full">
                  <span className="font-semibold text-slate-100 text-sm truncate pr-4">
                    {cleanMerchantName(txn.description)}
                  </span>
                  <span className={`text-sm font-bold shrink-0 ${txn.amount > 0 ? "text-neon-emerald" : "text-white"}`}>
                    {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                  </span>
                </div>
                {/* Bottom Row: Metadata (Date/Account) and Category Pill */}
                <div className="flex justify-between items-center w-full text-[10px] text-slate-500">
                  <div className="flex items-center space-x-1.5 truncate pr-4">
                    <span>{formatDate(txn.date)}</span>
                    <span>•</span>
                    <span className="truncate">{txn.account}</span>
                  </div>
                  <div className="shrink-0 scale-90 origin-right">
                    <CategoryPill transaction={txn} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
