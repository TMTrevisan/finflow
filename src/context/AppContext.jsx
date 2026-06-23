import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { fetchFinData, updateTransactionCategory } from '../services/api';
import { MOCK_TRANSACTIONS, MOCK_CATEGORIES, MOCK_BALANCES } from '../services/mockData';
import { safeStorage } from '../utils/storage';
import {
  resolveBudget,
  decorateData,
  compressTransactions,
  compressCategories,
  compressBalances,
  injectMortgage
} from '../utils/dataPrep';

const AppContext = createContext();

export { resolveBudget, decorateData };

// Helper to write to localStorage safely without crashing the app if browser storage limit is hit
const safeSetItem = (key, value) => {
  try {
    safeStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write cache for key "${key}" (possibly quota exceeded):`, err);
  }
};

// Sync Error and step logging utility
const logSync = (stepName, status, details = '') => {
  const now = new Date().toISOString();
  const newLog = `[${now}] ${status === 'cmd' ? '$' : status === 'error' ? '[ERROR]' : status === 'success' ? '[SUCCESS]' : '[INFO]'} ${stepName}${details ? ' - ' + details : ''}`;
  
  // Store in localStorage
  try {
    const logs = JSON.parse(safeStorage.getItem('finflow_sync_logs') || '[]');
    logs.push(newLog);
    if (logs.length > 50) logs.shift();
    safeStorage.setItem('finflow_sync_logs', JSON.stringify(logs));
  } catch (e) {}

  // Print CLI command-line style logs to dev console
  if (status === 'cmd') {
    console.log(`%c${newLog}`, 'color: #38BDF8; font-family: monospace; font-weight: bold;');
  } else if (status === 'error') {
    console.error(`%c${newLog}`, 'color: #F87171; font-family: monospace; font-weight: bold;');
  } else if (status === 'success') {
    console.log(`%c${newLog}`, 'color: #34D399; font-family: monospace; font-weight: bold;');
  } else {
    console.log(`%c${newLog}`, 'color: #94A3B8; font-family: monospace;');
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

  const [enableCustomSplits, setEnableCustomSplits] = useState(() => {
    return safeStorage.getItem('finflow_enable_custom_splits') === 'true';
  });

  const handleSetEnableCustomSplits = (val) => {
    setEnableCustomSplits(val);
    safeStorage.setItem('finflow_enable_custom_splits', val ? 'true' : 'false');
  };

  const [partnerAName, setPartnerANameState] = useState(() => {
    return safeStorage.getItem('finflow_partner_a_name') || '';
  });
  const [partnerBName, setPartnerBNameState] = useState(() => {
    return safeStorage.getItem('finflow_partner_b_name') || '';
  });
  const [partnerAEmployer, setPartnerAEmployerState] = useState(() => {
    return safeStorage.getItem('finflow_partner_a_employer') || '';
  });
  const [partnerBEmployer, setPartnerBEmployerState] = useState(() => {
    return safeStorage.getItem('finflow_partner_b_employer') || '';
  });

  const handleSetPartnerAName = (val) => {
    setPartnerANameState(val);
    safeStorage.setItem('finflow_partner_a_name', val);
  };
  const handleSetPartnerBName = (val) => {
    setPartnerBNameState(val);
    safeStorage.setItem('finflow_partner_b_name', val);
  };
  const handleSetPartnerAEmployer = (val) => {
    setPartnerAEmployerState(val);
    safeStorage.setItem('finflow_partner_a_employer', val);
  };
  const handleSetPartnerBEmployer = (val) => {
    setPartnerBEmployerState(val);
    safeStorage.setItem('finflow_partner_b_employer', val);
  };

  const resolvedPartnerAName = useMemo(() => {
    return partnerAName || (enableCustomSplits ? 'Kaitlyn' : 'Wife');
  }, [partnerAName, enableCustomSplits]);

  const resolvedPartnerBName = useMemo(() => {
    return partnerBName || (enableCustomSplits ? 'Todd' : 'Husband');
  }, [partnerBName, enableCustomSplits]);

  const resolvedPartnerAEmployer = useMemo(() => {
    return partnerAEmployer || (enableCustomSplits ? 'Havas' : 'Employer A');
  }, [partnerAEmployer, enableCustomSplits]);

  const resolvedPartnerBEmployer = useMemo(() => {
    return partnerBEmployer || (enableCustomSplits ? 'BD' : 'Employer B');
  }, [partnerBEmployer, enableCustomSplits]);

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

  const [plaidStatus, setPlaidStatus] = useState({ connected: false });
  const [plaidHoldings, setPlaidHoldings] = useState(null);

  const getPlaidUrl = (path) => {
    const rawUrl = safeStorage.getItem('finflow_mcp_url') || 'http://localhost:3001';
    const cleanUrl = rawUrl.trim().replace(/\/+$/, '');
    const mcpSecret = safeStorage.getItem('finflow_mcp_secret') || '';
    
    if (mcpSecret) {
      return cleanUrl.endsWith(mcpSecret) 
        ? `${cleanUrl}/${path}` 
        : `${cleanUrl}/${mcpSecret}/${path}`;
    }
    return `${cleanUrl}/${path}`;
  };

  const loadPlaidData = async () => {
    try {
      const statusUrl = getPlaidUrl('api/plaid/status');
      const statusRes = await fetch(statusUrl);
      if (!statusRes.ok) throw new Error('Status failed');
      const statusData = await statusRes.json();
      setPlaidStatus(statusData);

      if (statusData.connected) {
        const holdingsUrl = getPlaidUrl('api/plaid/holdings');
        const holdingsRes = await fetch(holdingsUrl);
        if (!holdingsRes.ok) throw new Error('Holdings failed');
        const holdingsData = await holdingsRes.json();
        setPlaidHoldings(holdingsData);
        return holdingsData;
      } else {
        setPlaidHoldings(null);
      }
    } catch (err) {
      console.warn('[Plaid Context] Failed to fetch Plaid data:', err.message);
    }
    return null;
  };

  const mergedBalances = useMemo(() => {
    let list = [...balances];
    if (plaidStatus.connected && plaidHoldings && plaidHoldings.accounts) {
      plaidHoldings.accounts.forEach(acc => {
        const existingIdx = list.findIndex(b => 
          b.account_id === acc.account_id || 
          (b.account && b.account.toLowerCase() === acc.name.toLowerCase())
        );
        
        const balanceRecord = {
          id: `plaid_${acc.account_id}`,
          date: new Date().toISOString().split('T')[0],
          institution: acc.institution_name || 'Plaid Connected Bank',
          account: acc.name,
          account_id: acc.account_id,
          balance: acc.balances.current,
          class: 'Asset',
          type: acc.type === 'investment' ? 'Investment' : 'Checking'
        };

        if (existingIdx !== -1) {
          list[existingIdx] = { ...list[existingIdx], ...balanceRecord };
        } else {
          list.push(balanceRecord);
        }
      });
    }
    return list;
  }, [balances, plaidHoldings, plaidStatus]);

  const decoratedBalances = useMemo(() => {
    return injectMortgage(mergedBalances, enableCustomSplits, resolvedPartnerBName);
  }, [mergedBalances, enableCustomSplits, resolvedPartnerBName]);

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
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

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
    logSync('finflow db load --cache=' + hasCache, 'cmd');
    if (!hasCache || forceSpinner) {
      setIsLoading(true);
    }
    setError(null);
    try {
      logSync('Checking network connectivity...', 'info');
      logSync('Fetching latest sheets financial database...', 'info');
      const data = await fetchFinData();
      logSync('Remote database retrieve finished', 'success', `transactions: ${data.transactions?.length}, balances: ${data.balances?.length}`);
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
      logSync('Database local storage caches written', 'success');

      // Load Plaid data in the background
      await loadPlaidData().catch(e => console.warn('Plaid background load failed:', e));
    } catch (err) {
      logSync('Database fetch failed', 'error', err.message);
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
    logSync('finflow db sync --force', 'cmd');
    setIsSyncing(true);
    setError(null);
    try {
      logSync('Contacting API sheet gateway...', 'info');
      const data = await fetchFinData();
      logSync('Sync complete, starting serialization...', 'success', `transactions: ${data.transactions?.length}, balances: ${data.balances?.length}`);
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
      logSync('Sync cached written to browser', 'success');

      // Sync Plaid data
      await loadPlaidData().catch(e => console.warn('Plaid sync failed:', e));
      return true;
    } catch (err) {
      logSync('Sync process crashed', 'error', err.message);
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
      if (txn.group === 'Investments') return 'Compounding';
      if (txn.type === 'Transfer') return 'Lifestyle'; // transfers are cost-neutral for surplus

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
      balances: decoratedBalances,
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
      enableCustomSplits,
      setEnableCustomSplits: handleSetEnableCustomSplits,
      partnerAName,
      setPartnerAName: handleSetPartnerAName,
      partnerBName,
      setPartnerBName: handleSetPartnerBName,
      partnerAEmployer,
      setPartnerAEmployer: handleSetPartnerAEmployer,
      partnerBEmployer,
      setPartnerBEmployer: handleSetPartnerBEmployer,
      resolvedPartnerAName,
      resolvedPartnerBName,
      resolvedPartnerAEmployer,
      resolvedPartnerBEmployer,
      referenceDate,
      globalSearchOpen,
      setGlobalSearchOpen,
      globalSearchQuery,
      setGlobalSearchQuery,
      logSync,
      plaidStatus,
      plaidHoldings,
      loadPlaidData,
      getPlaidUrl
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
