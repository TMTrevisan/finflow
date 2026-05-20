import { MOCK_TRANSACTIONS, MOCK_CATEGORIES, MOCK_BALANCES } from './mockData';

const getApiUrl = (action) => {
  const envUrl = import.meta.env.VITE_API_URL;
  const localUrl = localStorage.getItem('finflow_api_url');
  const apiUrl = envUrl || localUrl || null;
  if (!apiUrl) return null;
  return `${apiUrl}?action=${action}`;
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const fetchFinData = async () => {
  const url = getApiUrl('getData');
  if (url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch live data (HTTP ${response.status}). Check Google Apps Script permissions.`);
    }
    const result = await response.json();
    if (result.error) {
      throw new Error(`Apps Script Error: ${result.error}`);
    }
    return result;
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
