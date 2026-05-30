import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, formatDate, cleanMerchantName, getCategoryEmoji } from '../utils/formatting';
import { CategoryPill } from '../components/ui/CategoryPill';
import { Search, Filter, ChevronDown, ChevronUp, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { cn } from '../components/ui/Card';
import { useDebounce } from '../utils/hooks';

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_3_months', label: '3 Months' },
  { id: 'last_6_months', label: '6 Months' },
  { id: 'this_year', label: 'This Year' },
];

const SORT_OPTIONS = [
  { id: 'date_desc', label: 'Newest First' },
  { id: 'date_asc', label: 'Oldest First' },
  { id: 'amount_desc', label: 'Largest Amount' },
  { id: 'amount_asc', label: 'Smallest Amount' },
  { id: 'merchant_asc', label: 'Merchant A→Z' },
];

function getDateRange(preset, refDate) {
  // Use the provided reference date (from context) so all views agree on "this month"
  const now = refDate instanceof Date && !isNaN(refDate) ? refDate : new Date();
  const start = new Date(now);
  switch (preset) {
    case 'this_month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: first, end: last };
    }
    case 'last_3_months':
      start.setMonth(start.getMonth() - 3);
      return { start, end: now };
    case 'last_6_months':
      start.setMonth(start.getMonth() - 6);
      return { start, end: now };
    case 'this_year':
      start.setMonth(0); start.setDate(1); start.setHours(0, 0, 0, 0);
      return { start, end: now };
    default:
      return null;
  }
}

export default function Transactions() {
  const { 
    transactions = [], 
    isLoading, 
    selectedAccount, 
    setSelectedAccount,
    selectedCategory,
    setSelectedCategory,
    selectedDateRange,
    setSelectedDateRange,
    referenceDate,
  } = useAppContext();
  
  const [rawSearch, setRawSearch] = useState('');
  const searchTerm = useDebounce(rawSearch, 300);
  const [typeFilter, setTypeFilter] = useState('All'); // All | Income | Expense | Uncategorized
  const [datePreset, setDatePreset] = useState('all');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  
  const searchInputRef = useRef(null);

  // Reset pagination when filters change to ensure snappy performance
  React.useEffect(() => {
    setVisibleCount(100);
  }, [searchTerm, typeFilter, datePreset, accountFilter, categoryFilter, minAmount, maxAmount, sortBy]);

  // Initialize account filter from selectedAccount context
  React.useEffect(() => {
    if (selectedAccount) {
      setAccountFilter(selectedAccount);
    }
  }, [selectedAccount]);

  // Sync category filter from context
  React.useEffect(() => {
    if (selectedCategory) {
      setCategoryFilter(selectedCategory);
      setShowFilters(true);
    }
  }, [selectedCategory]);

  // Sync date filter from context
  React.useEffect(() => {
    if (selectedDateRange) {
      setDatePreset('custom');
    }
  }, [selectedDateRange]);

  // Keyboard shortcut listener to focus search on alphanumeric keydown
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      const targetTag = e.target.tagName.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select' || e.target.isContentEditable) {
        return;
      }
      if (/^[a-zA-Z0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (searchInputRef.current) {
          e.preventDefault();
          setRawSearch(prev => prev + e.key);
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pick up deep-link category from Budgets navigation
  React.useEffect(() => {
    const deepCat = sessionStorage.getItem('finflow_deep_category');
    if (deepCat) {
      setCategoryFilter(deepCat);
      setShowFilters(true);
      sessionStorage.removeItem('finflow_deep_category');
    }
  }, []);

  // Unique accounts and categories for dropdowns
  const { uniqueAccounts, uniqueCategories } = useMemo(() => {
    const accounts = [...new Set(transactions.map(t => t.account).filter(Boolean))].sort();
    const cats = [...new Set(transactions.map(t => t.category).filter(Boolean).filter(c => c !== 'Uncategorized'))].sort();
    return { uniqueAccounts: accounts, uniqueCategories: cats };
  }, [transactions]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== 'All') count++;
    if (datePreset !== 'all') count++;
    if (accountFilter) count++;
    if (categoryFilter) count++;
    if (minAmount || maxAmount) count++;
    if (sortBy !== 'date_desc') count++;
    return count;
  }, [typeFilter, datePreset, accountFilter, categoryFilter, minAmount, maxAmount, sortBy]);

  const clearAllFilters = () => {
    setTypeFilter('All');
    setDatePreset('all');
    setAccountFilter('');
    setCategoryFilter('');
    setMinAmount('');
    setMaxAmount('');
    setSortBy('date_desc');
    setSelectedAccount(null);
    setSelectedCategory(null);
    setSelectedDateRange(null);
    setRawSearch('');
  };

  const { reviewTransactions, filteredTransactions } = useMemo(() => {
    const dateRange = datePreset === 'custom' && selectedDateRange ? selectedDateRange : getDateRange(datePreset, referenceDate);

    let latestDate = new Date();
    if (transactions.length > 0) {
      const dates = transactions.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime())).sort((a, b) => b - a);
      if (dates.length > 0) latestDate = dates[0];
    }
    const fortyFiveDaysAgo = new Date(latestDate.getTime());
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

    const applyCommonFilters = (txn) => {
      const date = new Date(txn.date);
      if (isNaN(date.getTime())) return false;

      // Date range
      if (dateRange && (date < dateRange.start || date > dateRange.end)) return false;

      // Account filter (from dropdown or context)
      const effectiveAccount = accountFilter;
      if (effectiveAccount) {
        const tAcc = (txn.account || '').toLowerCase().trim();
        const sAcc = effectiveAccount.toLowerCase().trim();
        if (tAcc !== sAcc && !tAcc.includes(sAcc) && !sAcc.includes(tAcc)) return false;
      }

      // Category filter
      if (categoryFilter && (txn.category || '').toLowerCase() !== categoryFilter.toLowerCase()) return false;

      // Amount range
      const amt = Math.abs(txn.amount);
      if (minAmount && amt < parseFloat(minAmount)) return false;
      if (maxAmount && amt > parseFloat(maxAmount)) return false;

      return true;
    };

    const applySort = (arr) => {
      const sorted = [...arr];
      switch (sortBy) {
        case 'date_asc': return sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
        case 'amount_desc': return sorted.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        case 'amount_asc': return sorted.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
        case 'merchant_asc': return sorted.sort((a, b) => (a.description || '').localeCompare(b.description || ''));
        default: return sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
      }
    };

    const review = transactions.filter(txn => {
      const isUncategorized = txn.category === 'Uncategorized' || !txn.category;
      if (!isUncategorized) return false;
      if (!applyCommonFilters(txn)) return false;
      const date = new Date(txn.date);
      return date >= fortyFiveDaysAgo;
    });

    const standard = transactions.filter(txn => {
      const isUncategorized = txn.category === 'Uncategorized' || !txn.category;
      const date = new Date(txn.date);
      const isNewUncategorized = isUncategorized && !isNaN(date.getTime()) && date >= fortyFiveDaysAgo;

      // Only exclude new uncategorized from standard list when no filters active
      if (typeFilter === 'All' && !searchTerm && datePreset === 'all' && !accountFilter && !categoryFilter && isNewUncategorized) return false;

      if (!applyCommonFilters(txn)) return false;

      const merchantName = txn.description || '';
      const cleanedDesc = cleanMerchantName(merchantName);
      const matchesSearch = !searchTerm ||
        merchantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cleanedDesc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (txn.account || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (txn.category || '').toLowerCase().includes(searchTerm.toLowerCase());

      let matchesType = true;
      if (typeFilter === 'Income') matchesType = txn.type === 'Income';
      if (typeFilter === 'Expense') matchesType = txn.type === 'Expense';
      if (typeFilter === 'Uncategorized') matchesType = isUncategorized;

      return matchesSearch && matchesType;
    });

    return { reviewTransactions: applySort(review), filteredTransactions: applySort(standard) };
  }, [transactions, searchTerm, typeFilter, datePreset, selectedDateRange, accountFilter, categoryFilter, minAmount, maxAmount, sortBy]);

  const slicedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleCount);
  }, [filteredTransactions, visibleCount]);

  if (isLoading) {
    return <div className="animate-pulse text-slate-500 p-8">Loading Transactions...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="sticky top-0 z-30 bg-obsidian-900/97 backdrop-blur-sm pt-2 pb-3 space-y-3">
        {/* Row 1: Search + Filter Toggle */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search transactions... (press any key to start typing)"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={cn(
              'flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all',
              showFilters || activeFilterCount > 0
                ? 'bg-neon-indigo/15 border-neon-indigo/40 text-neon-indigo'
                : 'bg-obsidian-800 border-obsidian-700 text-slate-400 hover:text-white'
            )}
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-neon-indigo text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: Type quick filters */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {['All', 'Income', 'Expense', 'Uncategorized'].map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all',
                typeFilter === f
                  ? 'bg-neon-indigo border-neon-indigo text-white'
                  : 'bg-obsidian-800/60 border-obsidian-700 text-slate-400 hover:text-white'
              )}
            >
              {f}
            </button>
          ))}
          <div className="w-px" />
          {DATE_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setDatePreset(p.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all',
                datePreset === p.id
                  ? 'bg-obsidian-700 border-obsidian-600 text-white'
                  : 'bg-obsidian-800/60 border-obsidian-700 text-slate-400 hover:text-white'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Row 3: Collapsible Advanced Filters */}
        {showFilters && (
          <div className="bg-obsidian-800/60 border border-obsidian-700/60 rounded-2xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Account */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Account</label>
                <select
                  value={accountFilter}
                  onChange={e => { setAccountFilter(e.target.value); setSelectedAccount(e.target.value || null); }}
                  className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                >
                  <option value="">All Accounts</option>
                  {uniqueAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</label>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map(c => <option key={c} value={c}>{getCategoryEmoji(c)} {c}</option>)}
                </select>
              </div>

              {/* Amount Range */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Min Amount ($)</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={minAmount}
                  onChange={e => setMinAmount(e.target.value)}
                  className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Max Amount ($)</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={maxAmount}
                  onChange={e => setMaxAmount(e.target.value)}
                  className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                />
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-3">
              <div className="space-y-1 flex-1 max-w-xs">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sort By</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                >
                  {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="mt-5 flex items-center space-x-1.5 px-3 py-2 bg-neon-crimson/10 hover:bg-neon-crimson/20 border border-neon-crimson/30 text-neon-crimson text-xs font-bold rounded-xl transition-all"
                >
                  <X size={12} />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active filter indicators */}
        {(accountFilter || selectedAccount) && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500">Filtered by account:</span>
            <span className="bg-neon-indigo/20 text-neon-indigo font-bold px-2 py-0.5 rounded-full">
              {accountFilter || selectedAccount}
            </span>
            <button
              onClick={() => { setAccountFilter(''); setSelectedAccount(null); }}
              className="text-slate-500 hover:text-neon-crimson"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Results count + inflow/outflow/net summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}</span>
        </div>
        {filteredTransactions.length > 0 && (() => {
          const totalInflow = filteredTransactions
            .filter(t => t.type === 'Income')
            .reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const totalOutflow = filteredTransactions
            .filter(t => t.type === 'Expense')
            .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
          const net = totalInflow - totalOutflow;
          return (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold">
              <span className="text-emerald-400">↑ {formatCurrency(totalInflow)} <span className="text-slate-500 font-normal">in</span></span>
              <span className="text-rose-400">↓ {formatCurrency(totalOutflow)} <span className="text-slate-500 font-normal">out</span></span>
              <span className={net >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                Net: <strong>{net >= 0 ? '+' : ''}{formatCurrency(net)}</strong>
              </span>
            </div>
          );
        })()}
      </div>

      {/* Needs Review Section */}
      {!searchTerm && typeFilter === 'All' && datePreset === 'all' && !accountFilter && !categoryFilter && reviewTransactions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neon-crimson flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neon-crimson animate-pulse" />
              Needs Review ({reviewTransactions.length})
            </h3>
            <span className="text-[10px] text-slate-500">Uncategorized — last 45 days</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reviewTransactions.map(txn => (
              <div key={txn.id} className="bg-obsidian-800 border border-neon-crimson/20 hover:border-neon-crimson/40 rounded-2xl p-4 flex items-center justify-between transition-all">
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="text-[10px] text-slate-500">{formatDate(txn.date)}</span>
                  <span className="font-bold text-white text-sm truncate mt-0.5">{cleanMerchantName(txn.description)}</span>
                  <span className="text-[10px] text-slate-400 truncate mt-0.5">{txn.account}</span>
                </div>
                <div className="flex flex-col items-end space-y-2 shrink-0">
                  <span className={cn('font-bold text-lg', txn.amount > 0 ? 'text-neon-emerald' : 'text-white')}>
                    {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                  </span>
                  <CategoryPill transaction={txn} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Standard Transactions Table */}
      <div className="bg-obsidian-800 border border-obsidian-700 rounded-2xl shadow-xl overflow-hidden">
        {/* Desktop View */}
        <div className="hidden md:block">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="border-b border-obsidian-700 bg-obsidian-800/80">
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-28">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Merchant</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-40">Account</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-40">Category</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-700/50">
              {slicedTransactions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    No transactions match your filters.
                    {activeFilterCount > 0 && (
                      <button onClick={clearAllFilters} className="ml-2 text-neon-indigo hover:underline">Clear filters</button>
                    )}
                  </td>
                </tr>
              ) : (
                slicedTransactions.map(txn => (
                  <tr key={txn.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 53px' }} className="hover:bg-obsidian-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">{formatDate(txn.date)}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white truncate">{cleanMerchantName(txn.description)}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 truncate">{txn.account}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <CategoryPill transaction={txn} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                      <span className={txn.amount > 0 ? 'text-neon-emerald' : 'text-white'}>
                        {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-obsidian-700/50">
          {slicedTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No transactions match your filters.
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="block mx-auto mt-2 text-neon-indigo hover:underline text-xs">Clear filters</button>
              )}
            </div>
          ) : (
            slicedTransactions.map(txn => (
              <div key={txn.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 80px' }} className="p-4 flex items-center justify-between hover:bg-obsidian-770 transition-colors">
                <div className="flex flex-col min-w-0 pr-3">
                  <span className="font-semibold text-slate-100 text-sm truncate">{cleanMerchantName(txn.description)}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-slate-500">{formatDate(txn.date)}</span>
                    <span className="text-[10px] text-slate-600">•</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{txn.account}</span>
                  </div>
                  <div className="mt-1 scale-90 origin-left">
                    <CategoryPill transaction={txn} />
                  </div>
                </div>
                <span className={`text-sm font-bold shrink-0 ${
                  txn.amount > 0 ? 'text-neon-emerald' : 'text-white'
                }`}>
                  {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Load More Pagination Trigger */}
        {filteredTransactions.length > visibleCount && (
          <div className="p-4 border-t border-obsidian-750 bg-obsidian-850/30 text-center">
            <button
              onClick={() => setVisibleCount(prev => prev + 100)}
              className="px-6 py-2.5 bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 hover:border-obsidian-650 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition-all active:scale-[0.98]"
            >
              Load More ({filteredTransactions.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
