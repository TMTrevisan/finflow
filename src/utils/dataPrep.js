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
export const decorateData = (rawTxns, rawCats, useCalendarToday) => {
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

  // Detect if raw data uses Tiller convention (positive expenses, negative income/credits)
  let positiveExpenses = 0;
  let negativeExpenses = 0;
  let positiveIncomes = 0;
  let negativeIncomes = 0;
  
  txnsList.forEach(t => {
    const amt = Number(t.amount) || 0;
    const cat = String(t.category || '').trim().toLowerCase();
    const catMeta = catMap[cat];
    const type = catMeta?.type || t.type || '';
    
    if (type === 'Expense') {
      if (amt > 0) positiveExpenses++;
      if (amt < 0) negativeExpenses++;
    } else if (type === 'Income') {
      if (amt > 0) positiveIncomes++;
      if (amt < 0) negativeIncomes++;
    } else if (!type) {
      const isExpenseCat = cat.includes('grocer') || cat.includes('rent') || cat.includes('dining') || 
                           cat.includes('shopping') || cat.includes('utilit') || cat.includes('travel') || 
                           cat.includes('auto');
      if (isExpenseCat) {
        if (amt > 0) positiveExpenses++;
        if (amt < 0) negativeExpenses++;
      } else {
        const isIncomeCat = cat.includes('paycheck') || cat.includes('salary') || cat.includes('deposit') || 
                            cat.includes('bonus') || cat.includes('wages') || cat.includes('dividend');
        if (isIncomeCat) {
          if (amt > 0) positiveIncomes++;
          if (amt < 0) negativeIncomes++;
        }
      }
    }
  });

  const hasExpenses = (positiveExpenses + negativeExpenses) > 0;
  const isTillerConvention = hasExpenses 
    ? (positiveExpenses > negativeExpenses)
    : (negativeIncomes > positiveIncomes);

  const txns = txnsList.map(t => {
    const catName = String(t.category || '').trim().toLowerCase();
    const catMeta = catMap[catName];
    
    let type = t.type || '';
    let group = t.group || '';
    
    if (catMeta) {
      type = catMeta.type || type;
      group = catMeta.group || group;
    }
    
    // Normalize date
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
      const day = normalizedDate.getDate();
      const dayStr = String(day).padStart(2, '0');
      normalizedDate = `${y}-${m}-${dayStr}`;
    }

    // Normalize Tiller's sign convention
    let rawAmt = Number(t.amount) || 0;

    if (!type) {
      const isExpenseCat = catName.includes('grocer') || catName.includes('rent') || catName.includes('dining') || 
                           catName.includes('shopping') || catName.includes('utilit') || catName.includes('travel') || 
                           catName.includes('auto') || catName.includes('park') || catName.includes('subscr') || 
                           catName.includes('gas') || catName.includes('expens') || catName.includes('fee');
      const isIncomeCat = catName.includes('paycheck') || catName.includes('salary') || catName.includes('deposit') || 
                          catName.includes('bonus') || catName.includes('wages') || catName.includes('dividend') ||
                          catName.includes('annuity') || catName.includes('interest');
      
      if (isExpenseCat) {
        type = 'Expense';
      } else if (isIncomeCat) {
        type = 'Income';
      } else {
        if (isTillerConvention) {
          type = rawAmt < 0 ? 'Income' : 'Expense';
        } else {
          type = rawAmt > 0 ? 'Income' : 'Expense';
        }
      }
      group = (catName === 'uncategorized' || !catName) ? 'Uncategorized' : 'Other';
    }

    const nameLower = catName.toLowerCase();
    const descLower = String(t.description || '').toLowerCase();

    let finalCategory = t.category;
    let finalType = type;

    // Force known descriptions
    if (descLower.includes('sd gas & elec') || descLower.includes('sdge') || descLower.includes('sdg&e') || descLower.includes('sd genie') || descLower.includes('sd gas and electric')) {
      finalType = 'Expense';
      group = 'Utilities';
      if (!finalCategory || finalCategory === 'Uncategorized') {
        finalCategory = 'Utilities';
      }
    }

    if (rawAmt < 0 && (descLower.includes('wife') || descLower.includes('spouse') || descLower.includes('joint') || nameLower.includes('wife') || nameLower.includes('spouse'))) {
      finalType = 'Income';
      group = 'Family Funding';
      finalCategory = 'Family Funding';
    } else if (nameLower.includes('401') || nameLower.includes('retirement') || nameLower.includes('ira') || nameLower.includes('investment') || nameLower.includes('529')) {
      if (!nameLower.includes('income') && !nameLower.includes('dividend') && !nameLower.includes('interest')) {
        finalType = 'Transfer';
        group = 'Investments';
      }
    } else if (nameLower.includes('transfer') || descLower.includes('transfer') || nameLower.includes('xfer') || descLower.includes('xfer')) {
      finalType = 'Transfer';
      group = 'Other';
    }

    let normalizedAmt = rawAmt;
    if (isTillerConvention) {
      normalizedAmt = -rawAmt;
    } else {
      normalizedAmt = rawAmt;
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
export const compressTransactions = (txns) => {
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
export const compressCategories = (cats) => {
  const monthsList = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return (cats || []).map(c => {
    const compressed = {
      id: c.id,
      category: c.category,
      group: c.group,
      type: c.type,
      budget: c.budget
    };
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
export const compressBalances = (balances) => {
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

// Helper to inject manual mortgage liability and escrow assets dynamically and amortize over time
export const injectMortgage = (rawBalances, enableCustomSplits = false, partnerBName = "Todd") => {
  if (!rawBalances || rawBalances.length === 0) return rawBalances;
  
  // Find all unique dates in the balances
  const uniqueDates = Array.from(new Set(rawBalances.map(b => b.date)));
  
  const mortgageAccountName = enableCustomSplits ? `${partnerBName}'s Mortgage` : "Mortgage Account";
  const escrowAccountName = enableCustomSplits ? `${partnerBName}'s Mortgage Escrow` : "Mortgage Escrow";
  const institutionName = enableCustomSplits ? `${partnerBName} Mortgage Account` : "Mortgage Account";

  const mortgageEntries = [];
  
  uniqueDates.forEach(dateStr => {
    const anchorDate = new Date('2026-06-19');
    const currentDate = new Date(dateStr);
    const diffTime = currentDate - anchorDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    const principalDrawdown = diffDays * 15;
    const mortgageBalance = Math.min(194000, Math.max(0, 150462.74 - principalDrawdown));
    
    const escrowBalance = 4219.34;
    
    mortgageEntries.push({
      id: `manual_mortgage_${dateStr}`,
      date: dateStr,
      account: mortgageAccountName,
      account_id: 'XXXX-MORT',
      institution: institutionName,
      balance: -mortgageBalance,
      class: 'Liability',
      type: 'Mortgage',
      sidebarColor: 'border-blue-500'
    });
    
    mortgageEntries.push({
      id: `manual_mortgage_escrow_${dateStr}`,
      date: dateStr,
      account: escrowAccountName,
      account_id: 'XXXX-ESCROW',
      institution: institutionName,
      balance: escrowBalance,
      class: 'Asset',
      type: 'Savings',
      sidebarColor: 'border-emerald-500'
    });
  });
  
  const filtered = rawBalances.filter(b => 
    b.id !== `manual_mortgage_${b.date}` && 
    b.id !== `manual_mortgage_escrow_${b.date}` && 
    b.account !== mortgageAccountName && 
    b.account !== escrowAccountName &&
    b.account !== "Todd's Mortgage" && 
    b.account !== "Mortgage Account" && 
    b.account !== `${partnerBName}'s Mortgage` &&
    b.account !== `${partnerBName}'s Mortgage Escrow` &&
    b.account !== "Mortgage Escrow"
  );
  return [...filtered, ...mortgageEntries];
};
