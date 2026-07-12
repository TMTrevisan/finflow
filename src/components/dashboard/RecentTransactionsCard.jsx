import React from 'react';
import { cleanMerchantName, formatCurrency } from '../../utils/formatting';

const formatRelativeDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const txnDate = new Date(Date.UTC(year, month, day));
    const today = new Date();
    const todayMidnight = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    
    const diffTime = todayMidnight - txnDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 1 && diffDays < 7) return `${diffDays}d ago`;
    
    return txnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch (e) {
    return dateStr;
  }
};

export default function RecentTransactionsCard({ 
  recentTransactions = [], 
  setCurrentView, 
  handleAccountClick 
}) {
  return (
    <div className="space-y-4 px-1 py-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white">Recent Transactions</h4>
        <button 
          onClick={() => setCurrentView('transactions')}
          className="text-[10px] font-black text-slate-500 hover:text-slate-350 tracking-wider uppercase focus:outline-none cursor-pointer"
        >
          View All
        </button>
      </div>

      <div className="space-y-1">
        {recentTransactions.map(txn => (
          <div 
            key={txn.id}
            onClick={() => handleAccountClick(txn.account)}
            className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/10 px-3 rounded-xl transition-all border-b border-obsidian-800/30 last:border-0"
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
  );
}
