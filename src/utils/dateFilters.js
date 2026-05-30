const getReferenceDate = (transactions) => {
  if (!transactions || transactions.length === 0) return new Date();
  const dates = transactions
    .map(t => new Date(t.date))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => b - a);
  return dates.length > 0 ? dates[0] : new Date();
};

export const filterTransactionsByDateRange = (transactions, filterType, customStart, customEnd) => {
  const now = getReferenceDate(transactions);
  
  let startDate = null;
  let endDate = null;
  
  switch (filterType) {
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.getFullYear(), now.getMonth(), diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case 'this_month': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'last_month': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'last_3_months': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    }
    case 'last_6_months': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    }
    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
      break;
    }
    case 'ytd': {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    }
    case 'last_year': {
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;
    }
    case 'custom': {
      if (customStart) {
        startDate = new Date(customStart);
        startDate.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
      }
      break;
    }
    case 'all':
    default:
      return transactions;
  }
  
  return transactions.filter(t => {
    const tDate = new Date(t.date);
    if (isNaN(tDate.getTime())) return false;
    if (startDate && tDate < startDate) return false;
    if (endDate && tDate > endDate) return false;
    return true;
  });
};

export const getDateRangeLabel = (filterType, customStart, customEnd, transactions = []) => {
  const now = getReferenceDate(transactions);
  
  const formatDate = (d) => {
    return d.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  switch (filterType) {
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(now.getFullYear(), now.getMonth(), diff);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    case 'last_3_months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      return `${formatDate(start)} - ${formatDate(now)}`;
    }
    case 'last_6_months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      return `${formatDate(start)} - ${formatDate(now)}`;
    }
    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1);
      return `${formatDate(start)} - ${formatDate(now)}`;
    }
    case 'last_year': {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    case 'custom': {
      if (customStart && customEnd) {
        return `${formatDate(new Date(customStart))} - ${formatDate(new Date(customEnd))}`;
      }
      if (customStart) return `From ${formatDate(new Date(customStart))}`;
      if (customEnd) return `Until ${formatDate(new Date(customEnd))}`;
      return 'Custom Range';
    }
    case 'all':
    default:
      return 'All Time';
  }
};
