import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, formatDate, cleanMerchantName } from '../utils/formatting';
import { CategoryPill } from '../components/ui/CategoryPill';
import { Search, Filter, Inbox } from 'lucide-react';
import { cn } from '../components/ui/Card';

export default function Transactions() {
  const { transactions, isLoading, selectedAccount, setSelectedAccount } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All'); 

  const { reviewTransactions, filteredTransactions } = useMemo(() => {
    // Find the latest transaction date in the entire dataset
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
      if (selectedAccount && txn.account !== selectedAccount) return false;
      const date = new Date(txn.date);
      return !isNaN(date.getTime()) && date >= fortyFiveDaysAgo;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const standard = transactions.filter(txn => {
      const isUncategorized = txn.category === 'Uncategorized' || !txn.category;
      const date = new Date(txn.date);
      const isNewUncategorized = isUncategorized && !isNaN(date.getTime()) && date >= fortyFiveDaysAgo;

      // Exclude uncategorized from standard list only if it's currently showing in the Needs Review section
      if (filter === 'All' && searchTerm === '' && isNewUncategorized) return false;
      
      if (selectedAccount && txn.account !== selectedAccount) return false;

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
  }, [transactions, searchTerm, filter]);

  if (isLoading) {
    return <div className="animate-pulse">Loading Transactions...</div>;
  }

  const FILTERS = ['All', 'Income', 'Expenses', 'Uncategorized'];

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Sticky Controls Header */}
      <div className="sticky top-0 z-30 bg-obsidian-900/95 backdrop-blur pt-2 pb-4 border-b border-obsidian-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors",
                filter === f 
                  ? "bg-neon-indigo/20 text-neon-indigo border border-neon-indigo/30"
                  : "bg-obsidian-800 text-slate-400 border border-obsidian-700 hover:text-white hover:bg-obsidian-700"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Account filter banner */}
      {selectedAccount && (
        <div className="flex items-center justify-between bg-neon-indigo/10 border border-neon-indigo/20 rounded-xl px-4 py-2.5">
          <div className="flex items-center space-x-2 text-sm text-neon-indigo">
            <span className="font-semibold text-slate-400">Account:</span>
            <span className="font-bold text-white bg-neon-indigo/20 px-2 py-0.5 rounded text-xs">{selectedAccount}</span>
          </div>
          <button 
            onClick={() => setSelectedAccount(null)}
            className="text-xs text-neon-indigo hover:text-white underline transition-colors"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Needs Review Inbox */}
      {reviewTransactions.length > 0 && filter === 'All' && searchTerm === '' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-amber-500/20 p-2 rounded-lg">
              <Inbox size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-400">Needs Review</h3>
              <p className="text-sm text-amber-500/70">{reviewTransactions.length} transaction{reviewTransactions.length > 1 ? 's' : ''} to categorize</p>
            </div>
          </div>
          <div className="space-y-2">
            {reviewTransactions.map(txn => (
              <div key={txn.id} className="flex flex-col md:flex-row md:items-center justify-between bg-obsidian-900/50 rounded-xl p-4 border border-obsidian-700/50 hover:bg-obsidian-800 transition-colors">
                <div className="flex flex-col mb-3 md:mb-0">
                  <span className="text-sm text-slate-400">{formatDate(txn.date)}</span>
                  <span className="font-medium text-white text-lg">{cleanMerchantName(txn.description)}</span>
                  <span className="text-sm text-slate-500">{txn.account}</span>
                </div>
                <div className="flex items-center justify-between md:justify-end space-x-6">
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
      <div className="bg-obsidian-800 border border-obsidian-700 rounded-2xl shadow-xl overflow-hidden flex-1">
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-obsidian-700 bg-obsidian-800/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Amount</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {formatDate(txn.date)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{cleanMerchantName(txn.description)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{txn.account}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <CategoryPill transaction={txn} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
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
        <div className="md:hidden divide-y divide-obsidian-700/50">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No transactions found matching your criteria.
            </div>
          ) : (
            filteredTransactions.map((txn) => (
              <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-obsidian-700/30 transition-colors">
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="text-[10px] text-slate-400 font-medium">{formatDate(txn.date)}</span>
                  <span className="font-semibold text-white text-sm truncate mt-0.5">{cleanMerchantName(txn.description)}</span>
                  <span className="text-[10px] text-slate-500 truncate mt-0.5">{txn.account}</span>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  <CategoryPill transaction={txn} />
                  <span className={`text-sm font-bold ${txn.amount > 0 ? "text-neon-emerald" : "text-white"}`}>
                    {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
