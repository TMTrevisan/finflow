import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import { 
  getBrandIcon, 
  getBrandIconContainerClass, 
  getAccountStatusDot 
} from '../../utils/brandRegistry';

export default function AccountsListCard({ 
  assetCategories = [], 
  liabilityCategories = [], 
  totals = {}, 
  balances = [], 
  referenceDate, 
  handleAccountClick 
}) {
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

  const getAccountSyncDetails = (accName, accountId, institution, currentClass, date) => {
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
    const suffix = accountId ? (accountId.includes('-') ? accountId.split('-').pop() : accountId.slice(-4)) : '';
    const displaySuffix = suffix && /^\w{4}$/.test(suffix) ? `${suffix} • ` : '';

    let typeLabel = 'Asset';
    if (currentClass === 'Liability') {
      typeLabel = 'Credit Card';
    } else {
      if (name.includes('checking')) typeLabel = 'Checking';
      else if (name.includes('savings')) typeLabel = 'Savings';
      else if (name.includes('brokerage') || name.includes('investment') || name.includes('vanguard') || name.includes('portfolio')) typeLabel = 'Investment';
    }

    let timeAgo = '0m ago';
    let daysOld = 0;
    if (date) {
      const diffMs = Math.abs(new Date(referenceDate) - new Date(date));
      daysOld = diffMs / (1000 * 60 * 60 * 24);
      const diffDays = Math.floor(daysOld);
      if (diffDays > 0) {
        timeAgo = `${diffDays}d ago`;
      } else {
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHrs > 0) {
          timeAgo = `${diffHrs}h ago`;
        } else {
          timeAgo = '0m ago';
        }
      }
    }

    let status = 'synced';
    let link = undefined;
    let tag = undefined;

    if (daysOld > 5) {
      status = 'delayed';
      link = 'Reconnect';
    } else if (daysOld > 2) {
      status = 'loading';
    }

    if (name.includes('revolut') || name.includes('emirates') || name.includes('apple card') || name.includes('amex') || name.includes('adcb')) {
      status = 'delayed';
      link = 'Reconnect';
    }

    return {
      sub: `${typeLabel} • ${displaySuffix}${timeAgo}`,
      delta: calculatedDelta || '—',
      status,
      link,
      tag
    };
  };

  const renderCategoryList = (categories, sectionLabel) => {
    return (
      <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl overflow-hidden divide-y divide-slate-800/40">
        {categories.map(cat => {
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
                      const details = getAccountSyncDetails(acc.account, acc.account_id, acc.institution, acc.class, acc.date);
                      return (
                        <div 
                          key={acc.id}
                          onClick={() => handleAccountClick(acc.account)}
                          className="p-3.5 pl-12 pr-6 hover:bg-slate-800/15 transition-all flex items-center justify-between cursor-pointer group"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <div className={`p-1 rounded transition-all duration-300 flex items-center justify-center w-6 h-6 ${getBrandIconContainerClass(acc.account, acc.institution)}`}>
                                {getBrandIcon(acc.account, acc.type, acc.institution)}
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
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.hash = '#settings';
                                }}
                                className="text-[9px] font-black text-rose-500 hover:text-rose-400 mt-0.5 tracking-wider uppercase underline focus:outline-none cursor-pointer"
                              >
                                {details.link}
                              </button>
                            ) : details.tag ? (
                              <span className="inline-block text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 mt-0.5">
                                {details.tag}
                              </span>
                            ) : (
                              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{details.delta}</p>
                            )}
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
    );
  };

  return (
    <div className="space-y-6">
      {/* ASSETS SECTION */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase">Assets</h3>
          <span className="text-xs font-bold text-slate-200">{formatCurrency(totals.assets || 0)}</span>
        </div>
        {renderCategoryList(assetCategories, 'Assets')}
      </div>

      {/* LIABILITIES SECTION */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase">Liabilities</h3>
          <span className="text-xs font-bold text-slate-200">{formatCurrency(totals.liabilities || 0)}</span>
        </div>
        {renderCategoryList(liabilityCategories, 'Liabilities')}
      </div>
    </div>
  );
}
