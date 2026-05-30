import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { fetchFinData, updateTransactionCategory } from '../services/api';
import { MOCK_TRANSACTIONS, MOCK_CATEGORIES, MOCK_BALANCES } from '../services/mockData';
import { safeStorage } from '../utils/storage';

const AppContext = createContext();

// Helper to resolve budget from category object dynamically
export const resolveBudget = (categoryObj, targetMonth, targetYear) => {
  if (!categoryObj || typeof categoryObj !== 'object') return 0;
  const keys = Object.keys(categoryObj);

  // Month name lookup — use index for exact matching (avoids 'mar' matching 'summary')
  const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const targetMonthLower = String(targetMonth || '').toLowerCase();
  const targetMonthIdx = MONTH_NAMES.indexOf(targetMonthLower);

  // Parse a key into { month: 0-11, year: YYYY } or null
  const parseKeyDate = (key) => {
    const lower = key.toLowerCase();
    let monthIdx = -1;
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      // Match the 3-letter abbreviation surrounded by non-alpha chars (word boundary)
      const pattern = new RegExp(`(?:^|[^a-z])${MONTH_NAMES[i]}(?:[^a-z]|$)`);
      if (pattern.test(lower)) { monthIdx = i; break; }
    }
    const yearMatch = lower.match(/\d{4}/);
    if (monthIdx >= 0 && yearMatch) return { month: monthIdx, year: parseInt(yearMatch[0]) };
    if (monthIdx >= 0) return { month: monthIdx, year: null };
    return null;
  };

  // 1. Try exact month + year match
  if (targetMonthIdx >= 0) {
    const exact = keys.find(k => {
      const parsed = parseKeyDate(k);
      return parsed && parsed.month === targetMonthIdx && parsed.year === targetYear;
    });
    if (exact) return parseFloat(categoryObj[exact]) || 0;

    // 2. Try month match regardless of year
    const monthOnly = keys.find(k => {
      const parsed = parseKeyDate(k);
      return parsed && parsed.month === targetMonthIdx;
    });
    if (monthOnly) return parseFloat(categoryObj[monthOnly]) || 0;
  }

  // 3. Fallback to explicit budget key
  if ('budget' in categoryObj) {
    return parseFloat(categoryObj.budget) || 0;
  }

  // 4. Fallback to any date-keyed column
  const anyDateKey = keys.find(k => parseKeyDate(k) !== null);
  if (anyDateKey) return parseFloat(categoryObj[anyDateKey]) || 0;

  return 0;
};

// Helper to decorate transactions with category type/group
const decorateData = (rawTxns, rawCats, useCalendarToday) => {
  const txnsList = (rawTxns || []).filter(t => t && typeof t === 'object');

  // Find active month/year based on latest transaction or today
  let activeMonth = 'may';
  let activeYear = 2026;
  
  if (useCalendarToday) {
    const today = new Date();
    const monthsList = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    activeMonth = monthsList[today.getMonth()];
    activeYear = today.getFullYear();
  } else {
    if (txnsList.length > 0) {
      const validDates = txnsList
        .map(t => t.date ? new Date(t.date) : null)
        .filter(d => d && !isNaN(d.getTime()))
        .sort((a, b) => b - a);
        
      if (validDates.length > 0) {
        const latestDate = validDates[0];
        const monthsList = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        activeMonth = monthsList[latestDate.getMonth()];
        activeYear = latestDate.getFullYear();
      }
    }
  }

  const cats = (rawCats || [])
    .filter(c => c && typeof c === 'object')
    .map(c => ({
      ...c,
      budget: resolveBudget(c, activeMonth, activeYear)
    }));

  const catMap = {};
  cats.forEach(c => {
    if (c.category) {
      catMap[String(c.category).trim().toLowerCase()] = c;
    }
  });

  const txns = txnsList.map(t => {
    const catName = String(t.category || '').trim().toLowerCase();
    const catMeta = catMap[catName];
    
    let type = t.type || '';
    let group = t.group || '';
    
    if (catMeta) {
      type = catMeta.type || type;
      group = catMeta.group || group;
    }
    
    // Normalize date: Tiller/Google Sheets returns ISO timestamps (e.g. "2026-05-28T07:00:00.000Z")
    // Parse them into local YYYY-MM-DD so month/date filters work correctly in any timezone
    let normalizedDate = t.date;
    if (normalizedDate && typeof normalizedDate === 'string' && normalizedDate.includes('T')) {
      const d = new Date(normalizedDate);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        normalizedDate = `${y}-${m}-${day}`;
      }
    } else if (normalizedDate instanceof Date) {
      const y = normalizedDate.getFullYear();
      const m = String(normalizedDate.getMonth() + 1).padStart(2, '0');
      const day = String(normalizedDate.getDate()).padStart(2, '0');
      normalizedDate = `${y}-${m}-${day}`;
    }

    // Normalize Tiller's sign convention:
    // Tiller stores EXPENSES as positive numbers and INCOME as negative numbers.
    // The app's UI calculations assume INCOME is positive and EXPENSES are negative.
    // Flip the sign to match UI expectations after we know the type.
    let rawAmt = Number(t.amount) || 0;

    // Sign-based fallback for type detection (using Tiller convention: negative = income)
    if (!type) {
      if (catName === 'uncategorized' || !catName) {
        // Tiller: negative amount = credit/income, positive = debit/expense
        type = rawAmt < 0 ? 'Income' : 'Expense';
        group = 'Uncategorized';
      } else {
        type = rawAmt < 0 ? 'Income' : 'Expense';
        group = 'Other';
      }
    }

    // Force 401(k), retirement, and investment transfers to be categorized correctly as 'Transfer'
    const nameLower = catName.toLowerCase();
    const descLower = String(t.description || '').toLowerCase();

    let finalCategory = t.category;
    let finalType = type;

    if (rawAmt < 0 && (descLower.includes('wife') || descLower.includes('spouse') || descLower.includes('joint') || nameLower.includes('wife') || nameLower.includes('spouse'))) {
      finalType = 'Income';
      group = 'Family Funding';
      finalCategory = 'Family Funding';
    } else if (nameLower.includes('401') || nameLower.includes('retirement') || nameLower.includes('ira') || nameLower.includes('investment')) {
      if (!nameLower.includes('income') && !nameLower.includes('dividend') && !nameLower.includes('interest')) {
        finalType = 'Transfer';
        group = 'Investments';
      }
    } else if (nameLower.includes('transfer') || descLower.includes('transfer') || nameLower.includes('xfer') || descLower.includes('xfer')) {
      finalType = 'Transfer';
      group = 'Other';
    }

    // Flip amount so Income is positive, Expense is negative (standard UI convention)
    // Only flip if amount sign doesn't already match the type (handles mock data that's already normalized)
    let normalizedAmt = rawAmt;
    if (finalType === 'Income' && rawAmt < 0) {
      normalizedAmt = -rawAmt; // make positive
    } else if (finalType === 'Expense' && rawAmt > 0) {
      normalizedAmt = -rawAmt; // make negative
    } else if (finalType === 'Transfer' && rawAmt > 0) {
      normalizedAmt = -rawAmt; // transfers are outflows, make negative
    }

    return {
      ...t,
      date: normalizedDate,
      amount: normalizedAmt,
      category: finalCategory,
      type: finalType,
      group
    };
  });

  return { transactions: txns, categories: cats };
};

// Helper to compress transaction data before writing to localStorage
const compressTransactions = (txns) => {
  return (txns || []).map(t => ({
    id: t.id,
    date: t.date,
    description: t.description,
    category: t.category,
    amount: t.amount,
    type: t.type,
    group: t.group,
    account: t.account
  }));
};

// Helper to compress category data before writing to localStorage
const compressCategories = (cats) => {
  const monthsList = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return (cats || []).map(c => {
    const compressed = {
      id: c.id,
      category: c.category,
      group: c.group,
      type: c.type,
      budget: c.budget
    };
    // Keep month-specific budgets if they exist
    Object.keys(c || {}).forEach(k => {
      const lowerK = k.toLowerCase();
      if (monthsList.some(m => lowerK.includes(m))) {
        compressed[k] = c[k];
      }
    });
    return compressed;
  });
};

// Helper to compress balance data before writing to localStorage
const compressBalances = (balances) => {
  return (balances || []).map(b => ({
    id: b.id,
    date: b.date,
    institution: b.institution,
    account: b.account,
    account_id: b.account_id,
    balance: b.balance,
    class: b.class,
    type: b.type
  }));
};

// Helper to write to localStorage safely without crashing the app if browser storage limit is hit
const safeSetItem = (key, value) => {
  try {
    safeStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write cache for key "${key}" (possibly quota exceeded):`, err);
  }
};

export const AppProvider = ({ children, setCurrentView }) => {
  const [rawTransactions, setRawTransactions] = useState(() => {
    try {
      const cached = safeStorage.getItem('finflow_cache_transactions');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [rawCategories, setRawCategories] = useState(() => {
    try {
      const cached = safeStorage.getItem('finflow_cache_categories');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [useCalendarToday, setUseCalendarToday] = useState(() => {
    return safeStorage.getItem('finflow_use_calendar_today') === 'true';
  });

  const handleSetUseCalendarToday = (val) => {
    setUseCalendarToday(val);
    safeStorage.setItem('finflow_use_calendar_today', val ? 'true' : 'false');
  };

  const { transactions, categories } = useMemo(() => {
    return decorateData(rawTransactions, rawCategories, useCalendarToday);
  }, [rawTransactions, rawCategories, useCalendarToday]);

  const [balances, setBalances] = useState(() => {
    try {
      const cached = safeStorage.getItem('finflow_cache_balances');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [lifeOptimization, setLifeOptimization] = useState(() => {
    try {
      const cached = safeStorage.getItem('finflow_cache_life_opt');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedDateRange, setSelectedDateRange] = useState(null);

  // Navigation helper — atomically set account filter AND navigate to Transactions
  const navigateToTransactions = (options = {}) => {
    if (typeof options === 'string') {
      setSelectedAccount(options);
      setSelectedCategory(null);
      setSelectedDateRange(null);
    } else {
      setSelectedAccount(options.account || null);
      setSelectedCategory(options.category || null);
      setSelectedDateRange(options.dateRange || null);
    }
    if (setCurrentView) {
      setCurrentView('transactions');
    }
  };

  const [isLoading, setIsLoading] = useState(() => {
    try {
      const cached = safeStorage.getItem('finflow_cache_transactions');
      return cached ? false : true;
    } catch {
      return true;
    }
  });

  const [isMockData, setIsMockData] = useState(() => {
    try {
      const cached = safeStorage.getItem('finflow_cache_transactions');
      return cached ? false : true;
    } catch {
      return true;
    }
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(() => {
    return safeStorage.getItem('finflow_last_sync') || null;
  });

  const loadData = async (forceSpinner = false) => {
    const hasCache = rawTransactions.length > 0;
    if (!hasCache || forceSpinner) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await fetchFinData();
      setRawTransactions(data.transactions || []);
      setRawCategories(data.categories || []);
      setBalances(data.balances || []);
      setLifeOptimization(data.lifeOptimization || []);
      setIsMockData(false);

      // IMPORTANT: Write *decorated* (normalized) data to cache, not raw Tiller data.
      // This ensures ISO timestamps and Tiller sign convention never persist in localStorage.
      // On next load, decorateData sees already-clean data and its normalization is a no-op.
      const { transactions: decoratedTxns, categories: decoratedCats } = decorateData(
        data.transactions || [], data.categories || [], useCalendarToday
      );
      safeSetItem('finflow_cache_transactions', compressTransactions(decoratedTxns));
      safeSetItem('finflow_cache_categories', compressCategories(decoratedCats));
      safeSetItem('finflow_cache_balances', compressBalances(data.balances || []));
      safeSetItem('finflow_cache_life_opt', data.lifeOptimization || []);

      const timestamp = new Date().toISOString();
      safeStorage.setItem('finflow_last_sync', timestamp);
      setLastSync(timestamp);
    } catch (err) {
      console.warn("Failed to load live data, falling back to mock/cache:", err);
      if (!hasCache) {
        setError(err.message);
        setRawTransactions(MOCK_TRANSACTIONS);
        setRawCategories(MOCK_CATEGORIES);
        setBalances(MOCK_BALANCES);
        setIsMockData(true);
      } else {
        // Soft error for background refreshes
        setError(`Refresh failed: ${err.message}. Using cached data.`);
        // auto-dismiss after 4 seconds
        setTimeout(() => setError(null), 4000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const syncData = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const data = await fetchFinData();
      setRawTransactions(data.transactions || []);
      setRawCategories(data.categories || []);
      setBalances(data.balances || []);
      setLifeOptimization(data.lifeOptimization || []);
      setIsMockData(false);

      // IMPORTANT: Write decorated (normalized) data to cache — same rationale as loadData
      const { transactions: decoratedTxns, categories: decoratedCats } = decorateData(
        data.transactions || [], data.categories || [], useCalendarToday
      );
      safeSetItem('finflow_cache_transactions', compressTransactions(decoratedTxns));
      safeSetItem('finflow_cache_categories', compressCategories(decoratedCats));
      safeSetItem('finflow_cache_balances', compressBalances(data.balances || []));
      safeSetItem('finflow_cache_life_opt', data.lifeOptimization || []);

      const timestamp = new Date().toISOString();
      safeStorage.setItem('finflow_last_sync', timestamp);
      setLastSync(timestamp);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const clearCache = () => {
    safeStorage.removeItem('finflow_cache_transactions');
    safeStorage.removeItem('finflow_cache_categories');
    safeStorage.removeItem('finflow_cache_balances');
    safeStorage.removeItem('finflow_cache_life_opt');
    safeStorage.removeItem('finflow_last_sync');
    setRawTransactions([]);
    setRawCategories([]);
    setBalances([]);
    setLifeOptimization([]);
    setLastSync(null);
    setIsMockData(true);
    
    // Load mock fallback
    setRawTransactions(MOCK_TRANSACTIONS);
    setRawCategories(MOCK_CATEGORIES);
    setBalances(MOCK_BALANCES);
  };

  const updateCategory = async (transactionId, newCategory) => {
    // Optimistic update
    setRawTransactions(prev => {
      const updated = prev.map(txn => 
        txn.id === transactionId ? { ...txn, category: newCategory } : txn
      );
      safeSetItem('finflow_cache_transactions', compressTransactions(updated));
      return updated;
    });

    try {
      await updateTransactionCategory(transactionId, newCategory);
    } catch (err) {
      console.error("Failed to update category", err);
      loadData();
    }
  };

  // Post API URL to Service Worker for background notifications sync
  useEffect(() => {
    const url = safeStorage.getItem('finflow_api_url');
    if (url && 'serviceWorker' in navigator) {
      let swUrl = url;
      try {
        const urlObj = new URL(url);
        urlObj.searchParams.set('action', 'getData');
        swUrl = urlObj.toString();
      } catch (e) {
        const separator = url.includes('?') ? '&' : '?';
        swUrl = `${url}${separator}action=getData`;
      }
      navigator.serviceWorker.ready.then(registration => {
        if (registration.active) {
          registration.active.postMessage({
            type: 'SET_API_URL',
            url: swUrl
          });
        }
      });
    }
  }, [lastSync]);

  // Register Periodic Sync for background updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        if ('periodicSync' in reg) {
          try {
            await reg.periodicSync.register('check-transactions', {
              minInterval: 24 * 60 * 60 * 1000 // 24 hours
            });
          } catch (e) {
            console.warn('Failed to register periodicSync:', e);
          }
        }
      });
    }
  }, []);

  // Calculate Rolling 30-Day and Blended Monthly Surplus Projections
  const surplusMetrics = useMemo(() => {
    let mappings = {};
    try {
      const cached = safeStorage.getItem('finflow_life_opt_mappings');
      if (cached) mappings = JSON.parse(cached);
    } catch {}

    // Classify a transaction using its already-decorated type/group fields as the primary
    // signal, falling back to category-name keywords only for Baseline vs Lifestyle.
    // This fixes Surplus Goal = $0 when real Tiller categories like "Direct Deposit" are used.
    const getClassification = (txn) => {
      const cat = txn.category;
      // User-defined override from Life Optimization mappings
      if (mappings[cat]) return mappings[cat].classification;

      // PRIMARY: use already-decorated type/group from decorateData
      if (txn.type === 'Income') return 'Income';
      if (txn.type === 'Transfer') return 'Lifestyle'; // transfers are cost-neutral for surplus
      if (txn.group === 'Investments') return 'Compounding';

      // SECONDARY: keyword matching on category name for Baseline vs Lifestyle
      const name = String(cat || '').toLowerCase();
      if (
        name.includes('grocer') || name.includes('rent') || name.includes('mortgage') ||
        name.includes('utilit') || name.includes('electric') || name.includes('gas') ||
        name.includes('water') || name.includes('power') || name.includes('internet') ||
        name.includes('phone') || name.includes('insurance') || name.includes('medical') ||
        name.includes('doctor') || name.includes('health') || name.includes('daycare') ||
        name.includes('childcare') || name.includes('care')
      ) return 'Baseline';

      // TERTIARY: keyword matching for Compounding (savings/investment categories)
      if (
        name.includes('401') || name.includes('ira') || name.includes('retirement') ||
        name.includes('invest') || name.includes('savings') || name.includes('hsa') ||
        name.includes('529') || name.includes('compounding') || name.includes('stock')
      ) return 'Compounding';

      return 'Lifestyle';
    };

    // Classify a category row (no txn object) — used for budget projections
    const getClassificationByName = (cat) => {
      if (mappings[cat]) return mappings[cat].classification;
      const name = String(cat || '').toLowerCase();
      if (name.includes('paycheck') || name.includes('salary') || name.includes('bonus') ||
          name.includes('dividend') || name.includes('interest') || name.includes('deposit') ||
          name.includes('wages') || name.includes('family funding') || name.includes('income'))
        return 'Income';
      if (name.includes('401') || name.includes('ira') || name.includes('retirement') ||
          name.includes('invest') || name.includes('savings') || name.includes('hsa') ||
          name.includes('529') || name.includes('compounding') || name.includes('stock'))
        return 'Compounding';
      if (name.includes('grocer') || name.includes('rent') || name.includes('mortgage') ||
          name.includes('utilit') || name.includes('electric') || name.includes('gas') ||
          name.includes('water') || name.includes('power') || name.includes('internet') ||
          name.includes('phone') || name.includes('insurance') || name.includes('medical') ||
          name.includes('doctor') || name.includes('health') || name.includes('daycare') ||
          name.includes('childcare'))
        return 'Baseline';
      return 'Lifestyle';
    };

    const isIncluded = (cat) => {
      if (mappings[cat] && mappings[cat].included === false) return false;
      return true;
    };

    let refDate = new Date();
    if (!useCalendarToday) {
      const validTxnDates = (transactions || [])
        .map(t => t.date ? new Date(t.date) : null)
        .filter(d => d && !isNaN(d.getTime()))
        .sort((a, b) => b - a);
      if (validTxnDates.length > 0) {
        refDate = validTxnDates[0];
      }
    }

    // A. ROLLING 30-DAY
    const rollingStart = new Date(refDate.getTime());
    rollingStart.setDate(rollingStart.getDate() - 30);

    let rollingIncome = 0;
    let rollingBaseline = 0;
    let rollingCompounding = 0;
    let rollingLifestyle = 0;

    (transactions || []).forEach(t => {
      if (!t.date || !t.category || !isIncluded(t.category)) return;
      const d = new Date(t.date);
      if (d < rollingStart || d > refDate) return;

      const classification = getClassification(t);
      const amountVal = Number(t.amount) || 0;

      if (classification === 'Income') {
        rollingIncome += amountVal; // already positive after decoration
      } else {
        const netExpense = Math.abs(amountVal); // expenses are negative after decoration
        if (classification === 'Compounding') rollingCompounding += netExpense;
        else if (classification === 'Baseline') rollingBaseline += netExpense;
        else if (classification === 'Lifestyle') rollingLifestyle += netExpense;
      }
    });

    const rollingSurplus = rollingIncome - rollingCompounding - rollingBaseline;

    // B. BLENDED/PROJECTED CALENDAR MONTH
    const currentMonth = refDate.getMonth();
    const currentYear = refDate.getFullYear();

    let actualIncome = 0;
    let actualBaseline = 0;
    let actualCompounding = 0;
    let actualLifestyle = 0;

    (transactions || []).forEach(t => {
      if (!t.date || !t.category || !isIncluded(t.category)) return;
      const d = new Date(t.date);
      if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return;

      const classification = getClassification(t);
      const amountVal = Number(t.amount) || 0;

      if (classification === 'Income') {
        actualIncome += amountVal;
      } else {
        const netExpense = Math.abs(amountVal);
        if (classification === 'Compounding') actualCompounding += netExpense;
        else if (classification === 'Baseline') actualBaseline += netExpense;
        else if (classification === 'Lifestyle') actualLifestyle += netExpense;
      }
    });

    let budgetIncome = 0;
    let budgetBaseline = 0;
    let budgetCompounding = 0;

    (categories || []).forEach(c => {
      if (!c.category || !isIncluded(c.category)) return;
      const classification = getClassificationByName(c.category);
      const budgetVal = Number(c.budget) || 0;

      if (classification === 'Income') {
        budgetIncome += budgetVal;
      } else if (classification === 'Compounding') {
        budgetCompounding += budgetVal;
      } else if (classification === 'Baseline') {
        budgetBaseline += budgetVal;
      }
    });

    const projectedIncome = Math.max(actualIncome, budgetIncome);
    const projectedBaseline = Math.max(actualBaseline, budgetBaseline);
    const projectedCompounding = Math.max(actualCompounding, budgetCompounding);
    const projectedSurplus = projectedIncome - projectedCompounding - projectedBaseline;

    return {
      rolling: {
        income: rollingIncome,
        baseline: rollingBaseline,
        compounding: rollingCompounding,
        lifestyle: rollingLifestyle,
        surplus: rollingSurplus
      },
      projected: {
        income: projectedIncome,
        baseline: projectedBaseline,
        compounding: projectedCompounding,
        surplus: projectedSurplus,
        actualIncome,
        actualBaseline,
        actualCompounding
      }
    };
  }, [transactions, categories, useCalendarToday]);

  // Shared reference date: latest transaction date (or today if useCalendarToday).
  // Exposed in context so all views use the same "current" period.
  const referenceDate = useMemo(() => {
    if (useCalendarToday) return new Date();
    const dates = (transactions || [])
      .map(t => t.date ? new Date(t.date) : null)
      .filter(d => d && !isNaN(d.getTime()));
    return dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
  }, [transactions, useCalendarToday]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AppContext.Provider value={{
      transactions,
      categories,
      balances,
      lifeOptimization,
      surplusMetrics,
      isLoading,
      isSyncing,
      error,
      isMockData,
      lastSync,
      selectedAccount,
      setSelectedAccount,
      selectedCategory,
      setSelectedCategory,
      selectedDateRange,
      setSelectedDateRange,
      navigateToTransactions,
      syncData,
      clearCache,
      loadData,
      updateCategory,
      useCalendarToday,
      setUseCalendarToday: handleSetUseCalendarToday,
      referenceDate,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
