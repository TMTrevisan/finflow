const getReferenceDate = (transactions) => {
  if (!transactions || transactions.length === 0) return new Date();
  const dates = transactions
    .map(t => {
      if (!t.date) return null;
      const parts = String(t.date).split('T')[0].split('-');
      if (parts.length !== 3) return new Date(t.date);
      return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    })
    .filter(d => d && !isNaN(d.getTime()))
    .sort((a, b) => b - a);
  return dates.length > 0 ? dates[0] : new Date();
};

const toUtcString = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const filterTransactionsByDateRange = (transactions, filterType, customStart, customEnd) => {
  const now = getReferenceDate(transactions);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();
  
  let startDate = null;
  let endDate = null;
  
  switch (filterType) {
    case 'this_week': {
      const day = now.getUTCDay();
      const diff = date - day + (day === 0 ? -6 : 1);
      startDate = new Date(Date.UTC(year, month, diff));
      endDate = new Date(Date.UTC(year, month, diff + 6));
      break;
    }
    case 'this_month': {
      startDate = new Date(Date.UTC(year, month, 1));
      endDate = new Date(Date.UTC(year, month + 1, 0));
      break;
    }
    case 'last_month': {
      startDate = new Date(Date.UTC(year, month - 1, 1));
      endDate = new Date(Date.UTC(year, month, 0));
      break;
    }
    case 'last_3_months': {
      startDate = new Date(Date.UTC(year, month - 3, date));
      endDate = now;
      break;
    }
    case 'last_6_months': {
      startDate = new Date(Date.UTC(year, month - 6, date));
      endDate = now;
      break;
    }
    case 'this_quarter': {
      const quarter = Math.floor(month / 3);
      startDate = new Date(Date.UTC(year, quarter * 3, 1));
      endDate = new Date(Date.UTC(year, (quarter + 1) * 3, 0));
      break;
    }
    case 'ytd': {
      startDate = new Date(Date.UTC(year, 0, 1));
      endDate = now;
      break;
    }
    case 'last_year': {
      startDate = new Date(Date.UTC(year - 1, 0, 1));
      endDate = new Date(Date.UTC(year - 1, 11, 31));
      break;
    }
    case 'custom': {
      if (customStart) {
        const parts = String(customStart).split('-');
        startDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
      }
      if (customEnd) {
        const parts = String(customEnd).split('-');
        endDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
      }
      break;
    }
    case 'all':
    default:
      return transactions;
  }
  
  const startStr = startDate ? toUtcString(startDate) : '';
  const endStr = endDate ? toUtcString(endDate) : '';

  return transactions.filter(t => {
    if (!t.date) return false;
    const tStr = typeof t.date === 'string' ? t.date.split('T')[0] : toUtcString(new Date(t.date));
    if (startStr && tStr < startStr) return false;
    if (endStr && tStr > endStr) return false;
    return true;
  });
};

export const getDateRangeLabel = (filterType, customStart, customEnd, transactions = []) => {
  const now = getReferenceDate(transactions);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();
  
  const formatDate = (d) => {
    return d.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  };
  
  switch (filterType) {
    case 'this_week': {
      const day = now.getUTCDay();
      const diff = date - day + (day === 0 ? -6 : 1);
      const start = new Date(Date.UTC(year, month, diff));
      const end = new Date(Date.UTC(year, month, diff + 6));
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    case 'this_month': {
      const start = new Date(Date.UTC(year, month, 1));
      const end = new Date(Date.UTC(year, month + 1, 0));
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    case 'last_month': {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    case 'last_3_months': {
      const start = new Date(Date.UTC(year, month - 3, date));
      return `${formatDate(start)} - ${formatDate(now)}`;
    }
    case 'last_6_months': {
      const start = new Date(Date.UTC(year, month - 6, date));
      return `${formatDate(start)} - ${formatDate(now)}`;
    }
    case 'this_quarter': {
      const quarter = Math.floor(month / 3);
      const start = new Date(Date.UTC(year, quarter * 3, 1));
      const end = new Date(Date.UTC(year, (quarter + 1) * 3, 0));
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    case 'ytd': {
      const start = new Date(Date.UTC(year, 0, 1));
      return `${formatDate(start)} - ${formatDate(now)}`;
    }
    case 'last_year': {
      const start = new Date(Date.UTC(year - 1, 0, 1));
      const end = new Date(Date.UTC(year - 1, 11, 31));
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    case 'custom': {
      if (customStart && customEnd) {
        const p1 = String(customStart).split('-');
        const p2 = String(customEnd).split('-');
        const start = new Date(Date.UTC(parseInt(p1[0], 10), parseInt(p1[1], 10) - 1, parseInt(p1[2], 10)));
        const end = new Date(Date.UTC(parseInt(p2[0], 10), parseInt(p2[1], 10) - 1, parseInt(p2[2], 10)));
        return `${formatDate(start)} - ${formatDate(end)}`;
      }
      if (customStart) {
        const p = String(customStart).split('-');
        const start = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
        return `From ${formatDate(start)}`;
      }
      if (customEnd) {
        const p = String(customEnd).split('-');
        const end = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
        return `Until ${formatDate(end)}`;
      }
      return 'Custom Range';
    }
    case 'all':
    default:
      return 'All Time';
  }
};
