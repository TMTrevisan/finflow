import { MOCK_TRANSACTIONS, MOCK_CATEGORIES, MOCK_BALANCES } from './mockData';
import { safeStorage } from '../utils/storage';

const getApiUrl = (action) => {
  const envUrl = import.meta.env.VITE_API_URL;
  const localUrl = safeStorage.getItem('finflow_api_url');
  const apiUrl = localUrl || envUrl || null;
  if (!apiUrl) return null;
  
  try {
    const url = new URL(apiUrl);
    url.searchParams.set('action', action);
    return url.toString();
  } catch (e) {
    const separator = apiUrl.includes('?') ? '&' : '?';
    return `${apiUrl}${separator}action=${encodeURIComponent(action)}`;
  }
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const fetchFinData = async () => {
  const url = getApiUrl('getData');
  if (url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Failed to fetch live data (HTTP ${response.status}). Check Google Apps Script permissions.`);
      }
      const result = await response.json();
      if (result.error) {
        throw new Error(`Apps Script Error: ${result.error}`);
      }
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Sync timed out after 90s. Google Apps Script is taking longer to process your large database — please try again in a moment.', { cause: err });
      }
      throw err;
    }
  }
  
  // No API_URL defined, simulate network delay and return mock data
  await delay(800);
  
  return {
    transactions: [...MOCK_TRANSACTIONS],
    categories: [...MOCK_CATEGORIES],
    balances: [...MOCK_BALANCES]
  };
};

export const updateTransactionCategory = async (transactionId, newCategory) => {
  const url = getApiUrl('updateCategory');
  if (url) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Avoid CORS preflight options blocks
      body: JSON.stringify({ transactionId, category: newCategory })
    });
    if (!response.ok) {
      throw new Error(`Failed to update category (HTTP ${response.status})`);
    }
    return await response.json();
  }

  // Simulate network delay
  await delay(400);
  return { success: true, transactionId, newCategory };
};

export const updateAccountBalance = async ({ accountName, institution, balance, accountId, accountClass, accountType }) => {
  const url = getApiUrl('updateBalance');
  if (url) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accountName, institution, balance, accountId, accountClass, accountType })
    });
    if (!response.ok) {
      throw new Error(`Failed to update balance (HTTP ${response.status})`);
    }
    return await response.json();
  }

  // Simulate network delay
  await delay(400);
  return { success: true, accountName, balance };
};
