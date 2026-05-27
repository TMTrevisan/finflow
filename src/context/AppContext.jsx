import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchFinData, updateTransactionCategory } from '../services/api';
import { MOCK_TRANSACTIONS, MOCK_CATEGORIES, MOCK_BALANCES } from '../services/mockData';

const AppContext = createContext();

// Helper to resolve budget from category object dynamically
export const resolveBudget = (categoryObj, targetMonth, targetYear) => {
  if (!categoryObj || typeof categoryObj !== 'object') return 0;
  const keys = Object.keys(categoryObj);
  
  // 1. Try exact month and year match (e.g. "dec" and "2023")
  let match = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes(targetMonth.toLowerCase()) && lower.includes(String(targetYear));
  });
  if (match) return parseFloat(categoryObj[match]) || 0;
  
  // 2. Try month match regardless of year
  match = keys.find(k => k.toLowerCase().includes(targetMonth.toLowerCase()));
  if (match) return parseFloat(categoryObj[match]) || 0;
  
  // 3. Fallback to default budget key
  if ('budget' in categoryObj) {
    return parseFloat(categoryObj.budget) || 0;
  }
  
  // 4. Fallback to any date-like key
  const monthsList = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const dateKey = keys.find(k => {
    const lower = k.toLowerCase();
    return monthsList.some(m => lower.includes(m));
  });
  if (dateKey) return parseFloat(categoryObj[dateKey]) || 0;
  
  return 0;
};

// Helper to decorate transactions with category type/group
const decorateData = (rawTxns, rawCats) => {
  // Find active month/year based on latest transaction
  let activeMonth = 'may';
  let activeYear = 2026;
  
  const txnsList = (rawTxns || []).filter(t => t && typeof t === 'object');
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
    
    // Sign-based fallback
    if (!type) {
      const amt = Number(t.amount) || 0;
      if (catName === 'uncategorized' || !catName) {
        type = amt < 0 ? 'Expense' : 'Income';
        group = 'Uncategorized';
      } else {
        type = amt < 0 ? 'Expense' : 'Income';
        group = 'Other';
      }
    }

    // Force 401(k), retirement, and investment transfers to be categorized correctly as 'Transfer'
    const nameLower = catName.toLowerCase();
    const descLower = String(t.description || '').toLowerCase();
    const amt = Number(t.amount) || 0;

    let finalCategory = t.category;

    if (amt > 0 && (descLower.includes('wife') || descLower.includes('spouse') || descLower.includes('joint') || nameLower.includes('wife') || nameLower.includes('spouse'))) {
      type = 'Income';
      group = 'Family Funding';
      finalCategory = 'Family Funding';
    } else if (nameLower.includes('401') || nameLower.includes('retirement') || nameLower.includes('ira') || nameLower.includes('investment')) {
      if (!nameLower.includes('income') && !nameLower.includes('dividend') && !nameLower.includes('interest')) {
        type = 'Transfer';
        group = 'Investments';
      }
    } else if (nameLower.includes('transfer') || descLower.includes('transfer') || nameLower.includes('xfer') || descLower.includes('xfer')) {
      type = 'Transfer';
      group = 'Other';
    }

    return {
      ...t,
      category: finalCategory,
      type,
      group
    };
  });

  return { txns, cats };
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

// Helper to write to localStorage safely without crashing the app if browser storage limit is hit
const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write cache for key "${key}" (possibly quota exceeded):`, err);
  }
};

export const AppProvider = ({ children, setCurrentView }) => {
  const [transactions, setTransactions] = useState(() => {
    try {
      const cached = localStorage.getItem('finflow_cache_transactions');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [categories, setCategories] = useState(() => {
    try {
      const cached = localStorage.getItem('finflow_cache_categories');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [balances, setBalances] = useState(() => {
    try {
      const cached = localStorage.getItem('finflow_cache_balances');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [lifeOptimization, setLifeOptimization] = useState(() => {
    try {
      const cached = localStorage.getItem('finflow_cache_life_opt');
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
      const cached = localStorage.getItem('finflow_cache_transactions');
      return cached ? false : true;
    } catch {
      return true;
    }
  });

  const [isMockData, setIsMockData] = useState(() => {
    try {
      const cached = localStorage.getItem('finflow_cache_transactions');
      return cached ? false : true;
    } catch {
      return true;
    }
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(() => {
    return localStorage.getItem('finflow_last_sync') || null;
  });

  const loadData = async (forceSpinner = false) => {
    const hasCache = transactions.length > 0;
    if (!hasCache || forceSpinner) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await fetchFinData();
      const { txns, cats } = decorateData(data.transactions, data.categories);
      setTransactions(txns);
      setCategories(cats);
      setBalances(data.balances || []);
      setLifeOptimization(data.lifeOptimization || []);
      setIsMockData(false);
      
      // Save cache
      safeSetItem('finflow_cache_transactions', compressTransactions(txns));
      safeSetItem('finflow_cache_categories', cats);
      safeSetItem('finflow_cache_balances', data.balances || []);
      safeSetItem('finflow_cache_life_opt', data.lifeOptimization || []);
      
      const timestamp = new Date().toISOString();
      localStorage.setItem('finflow_last_sync', timestamp);
      setLastSync(timestamp);
    } catch (err) {
      console.warn("Failed to load live data, falling back to mock/cache:", err);
      if (!hasCache) {
        setError(err.message);
        const { txns, cats } = decorateData(MOCK_TRANSACTIONS, MOCK_CATEGORIES);
        setTransactions(txns);
        setCategories(cats);
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
      const { txns, cats } = decorateData(data.transactions, data.categories);
      setTransactions(txns);
      setCategories(cats);
      setBalances(data.balances || []);
      setLifeOptimization(data.lifeOptimization || []);
      setIsMockData(false);
      
      // Save cache
      safeSetItem('finflow_cache_transactions', compressTransactions(txns));
      safeSetItem('finflow_cache_categories', cats);
      safeSetItem('finflow_cache_balances', data.balances || []);
      safeSetItem('finflow_cache_life_opt', data.lifeOptimization || []);
      
      const timestamp = new Date().toISOString();
      localStorage.setItem('finflow_last_sync', timestamp);
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
    localStorage.removeItem('finflow_cache_transactions');
    localStorage.removeItem('finflow_cache_categories');
    localStorage.removeItem('finflow_cache_balances');
    localStorage.removeItem('finflow_cache_life_opt');
    localStorage.removeItem('finflow_last_sync');
    setTransactions([]);
    setCategories([]);
    setBalances([]);
    setLifeOptimization([]);
    setLastSync(null);
    setIsMockData(true);
    
    // Load mock fallback
    const { txns, cats } = decorateData(MOCK_TRANSACTIONS, MOCK_CATEGORIES);
    setTransactions(txns);
    setCategories(cats);
    setBalances(MOCK_BALANCES);
  };

  const updateCategory = async (transactionId, newCategory) => {
    // Optimistic update
    setTransactions(prev => {
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
    const url = localStorage.getItem('finflow_api_url');
    if (url && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        if (registration.active) {
          registration.active.postMessage({
            type: 'SET_API_URL',
            url: `${url}?action=getData`
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

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AppContext.Provider value={{
      transactions,
      categories,
      balances,
      lifeOptimization,
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
      updateCategory
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
