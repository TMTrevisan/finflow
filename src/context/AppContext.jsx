import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchFinData, updateTransactionCategory } from '../services/api';
import { MOCK_TRANSACTIONS, MOCK_CATEGORIES, MOCK_BALANCES } from '../services/mockData';

const AppContext = createContext();

// Helper to resolve budget from category object dynamically
const resolveBudget = (categoryObj, targetMonth, targetYear) => {
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
  
  const txnsList = rawTxns || [];
  if (txnsList.length > 0) {
    const validDates = txnsList
      .map(t => new Date(t.date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => b - a);
      
    if (validDates.length > 0) {
      const latestDate = validDates[0];
      const monthsList = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      activeMonth = monthsList[latestDate.getMonth()];
      activeYear = latestDate.getFullYear();
    }
  }

  const cats = (rawCats || []).map(c => ({
    ...c,
    budget: resolveBudget(c, activeMonth, activeYear)
  }));

  const catMap = {};
  cats.forEach(c => {
    if (c.category) {
      catMap[c.category.trim().toLowerCase()] = c;
    }
  });

  const txns = txnsList.map(t => {
    const catName = (t.category || '').trim().toLowerCase();
    const catMeta = catMap[catName];
    
    let type = t.type || '';
    let group = t.group || '';
    
    if (catMeta) {
      type = catMeta.type || type;
      group = catMeta.group || group;
    }
    
    // Sign-based fallback
    if (!type) {
      if (catName === 'uncategorized' || !catName) {
        type = t.amount < 0 ? 'Expense' : 'Income';
        group = 'Uncategorized';
      } else {
        type = t.amount < 0 ? 'Expense' : 'Income';
        group = 'Other';
      }
    }

    return {
      ...t,
      type,
      group
    };
  });

  return { txns, cats };
};

export const AppProvider = ({ children }) => {
  const [transactions, setTransactions] = useState(() => {
    try {
      const cached = localStorage.getItem('finflow_cache_transactions');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [categories, setCategories] = useState(() => {
    try {
      const cached = localStorage.getItem('finflow_cache_categories');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [balances, setBalances] = useState(() => {
    try {
      const cached = localStorage.getItem('finflow_cache_balances');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

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
      setIsMockData(false);
      
      // Save cache
      localStorage.setItem('finflow_cache_transactions', JSON.stringify(txns));
      localStorage.setItem('finflow_cache_categories', JSON.stringify(cats));
      localStorage.setItem('finflow_cache_balances', JSON.stringify(data.balances || []));
      
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
      setIsMockData(false);
      
      // Save cache
      localStorage.setItem('finflow_cache_transactions', JSON.stringify(txns));
      localStorage.setItem('finflow_cache_categories', JSON.stringify(cats));
      localStorage.setItem('finflow_cache_balances', JSON.stringify(data.balances || []));
      
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
    localStorage.removeItem('finflow_last_sync');
    setTransactions([]);
    setCategories([]);
    setBalances([]);
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
      localStorage.setItem('finflow_cache_transactions', JSON.stringify(updated));
      return updated;
    });

    try {
      await updateTransactionCategory(transactionId, newCategory);
    } catch (err) {
      console.error("Failed to update category", err);
      loadData();
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AppContext.Provider value={{
      transactions,
      categories,
      balances,
      isLoading,
      isSyncing,
      error,
      isMockData,
      lastSync,
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
