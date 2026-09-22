// ==========================================
// TILLER MONEY - GOOGLE APPS SCRIPT BACKEND
// ==========================================
// Deploy this as a "Web App" in your Tiller Google Sheet.
// Execute as "Me" and set a real ACCESS_SECRET before deploying.
// Requests must supply the matching secret (or token) query parameter.

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

const ACCESS_SECRET = "replace-with-your-mcp-secret-or-custom-token"; // Required: configure a real secret to enable the endpoint

function isAuthorized(e) {
  const configuredSecret = (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties().getProperty('ACCESS_SECRET')) || ACCESS_SECRET;
  if (!configuredSecret || configuredSecret === "replace-with-your-mcp-secret-or-custom-token") {
    return false; // Fail closed until a real secret is configured
  }
  const parameters = (e && e.parameter) || {};
  const token = parameters.secret || parameters.token;
  return token === configuredSecret;
}

function doGet(e) {
  if (!isAuthorized(e)) {
    return createJsonResponse({ success: false, error: 'Unauthorized' });
  }
  try {
    if (e.parameter.action === 'getData') {
      return createJsonResponse({ success: true, data: getTillerData() });
    }
    return createJsonResponse({ success: false, error: 'Invalid action' });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

function doPost(e) {
  if (!isAuthorized(e)) {
    return createJsonResponse({ success: false, error: 'Unauthorized' });
  }
  try {
    const action = e.parameter.action;
    if (action === 'updateCategory') {
      const { transactionId, category, nativeTransactionId } = JSON.parse(e.postData.contents);
      return createJsonResponse(updateTransactionCategory(transactionId, category, nativeTransactionId));
    }
    if (action === 'updateBalance') {
      const { accountName, institution, balance, accountId, accountClass, accountType } = JSON.parse(e.postData.contents);
      return createJsonResponse(addBalanceHistoryEntry(accountName, institution, balance, accountId, accountClass, accountType));
    }
    return createJsonResponse({ success: false, error: 'Invalid action' });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

// Apps Script cannot set HTTP status codes; callers must check success.
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ------------------------------------------
// Core Data Fetching & Compression
// ------------------------------------------
function getTillerData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  return {
    transactions: getSheetData(ss, 'Transactions'),
    categories: getSheetData(ss, 'Categories'),
    balances: getBalancesData(ss),
    lifeOptimization: getSheetData(ss, 'Life_Optimization').length > 0 
      ? getSheetData(ss, 'Life_Optimization') 
      : getSheetData(ss, 'Life Optimization')
  };
}

function findHeaderRowIndex(data, sheetName) {
  const lowerSheet = sheetName.toLowerCase().trim();
  
  // Define standard columns we expect for each sheet type
  let expectedHeaders = [];
  if (lowerSheet.indexOf('transaction') !== -1) {
    expectedHeaders = ['date', 'amount', 'description', 'category'];
  } else if (lowerSheet.indexOf('category') !== -1) {
    expectedHeaders = ['category', 'group', 'type'];
  } else if (lowerSheet.indexOf('balance') !== -1) {
    expectedHeaders = ['date', 'account', 'balance', 'institution'];
  } else if (lowerSheet.indexOf('life') !== -1) {
    expectedHeaders = ['category', 'classification'];
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    // Count how many non-empty string cells are in this row
    const nonEmptyCells = row.filter(val => val !== null && String(val).trim() !== '');
    if (nonEmptyCells.length < 3) continue; // Headers usually have at least 3 columns
    
    // Check if the row contains any of our expected header names
    const rowStrings = row.map(val => String(val || '').toLowerCase().trim());
    
    // Count matches with expected headers
    const matches = expectedHeaders.filter(h => rowStrings.indexOf(h) !== -1);
    
    // If it matches at least 2 expected headers, it's definitely the header row
    if (matches.length >= 2) {
      return i;
    }
    
    // Fallback: if we don't have expected headers, but the row has many cells, and the next row has data
    if (nonEmptyCells.length >= 4) {
      // Let's make sure it's not a row of numbers/dates (which would be data, not headers)
      const hasOnlyNumbers = nonEmptyCells.every(val => !isNaN(val) || val instanceof Date);
      if (!hasOnlyNumbers) {
        return i;
      }
    }
  }
  
  // Fallback to the first row that has any non-empty cell if we find nothing else
  for (let i = 0; i < data.length; i++) {
    const nonEmptyCells = data[i].filter(val => val !== null && String(val).trim() !== '');
    if (nonEmptyCells.length > 0) {
      return i;
    }
  }
  
  return -1;
}

function getSheetData(ss, sheetName) {
  // Try to find sheet case-insensitively and trim spaces
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    const sheets = ss.getSheets();
    const lowerName = sheetName.toLowerCase().trim();
    sheet = sheets.find(s => s.getName().toLowerCase().trim() === lowerName);
  }
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  
  // Find the header row
  const headerIndex = findHeaderRowIndex(data, sheetName);
  
  if (headerIndex === -1 || headerIndex === data.length - 1) return [];
  
  const headers = data[headerIndex];
  const rows = data.slice(headerIndex + 1);
  
  const lowerSheet = sheetName.toLowerCase().trim();
  const isTxns = lowerSheet.indexOf('transaction') !== -1;
  const isCats = lowerSheet.indexOf('category') !== -1;
  const monthsList = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  return rows
    .filter(row => row.some(val => val !== null && val !== '')) // skip completely empty rows
    .map((row, index) => {
      let rowData = { id: `${sheetName.toLowerCase().replace(/\s+/g, '_')}_${index}` };
      headers.forEach((header, i) => {
        let key = String(header || '').toLowerCase().trim().replace(/\s+/g, '_');
        if (key) {
          // Compress columns at source
          if (isTxns) {
            if (['date', 'description', 'category', 'amount', 'account', 'type', 'transaction_id'].indexOf(key) === -1) {
              return;
            }
          } else if (isCats) {
            const isMonthKey = monthsList.some(m => key.indexOf(m) !== -1);
            if (['category', 'group', 'type', 'budget'].indexOf(key) === -1 && !isMonthKey) {
              return;
            }
          }
          rowData[key] = row[i];
        }
      });
      return rowData;
    });
}

function getBalancesData(ss) {
  // 1. Get raw balances using case-insensitive search
  let sheet = ss.getSheetByName('Balance History');
  if (!sheet) {
    const sheets = ss.getSheets();
    sheet = sheets.find(s => s.getName().toLowerCase().trim() === 'balance history');
  }
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  
  // Find the header row
  const headerIndex = findHeaderRowIndex(data, 'Balance History');
  
  if (headerIndex === -1 || headerIndex === data.length - 1) return [];
  
  const headers = data[headerIndex];
  const rows = data.slice(headerIndex + 1);
  
  const parsedRows = rows
    .filter(row => row.some(val => val !== null && val !== ''))
    .map((row, index) => {
      let rowData = { id: `balance_history_${index}` };
      headers.forEach((header, i) => {
        let key = String(header || '').toLowerCase().trim().replace(/\s+/g, '_');
        if (key) {
          // Keep only necessary columns for balance history
          if (['date', 'institution', 'account', 'account_id', 'balance', 'class', 'type'].indexOf(key) !== -1) {
            rowData[key] = row[i];
          }
        }
      });
      return rowData;
    });
    
  // Sort from newest to oldest
  parsedRows.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // 2. Keep:
  // - The latest balance for every single account (needed for current balance views).
  // - Up to 30 historical daily snapshots per account (to display net worth chart).
  const latestMap = new Map();
  const historyList = [];
  const uniqueDates = new Set();
  
  parsedRows.forEach(row => {
    if (!row.date || !row.account || !row.institution) return;
    
    const key = `${row.institution}_${row.account}_${row.account_id || ''}`;
    
    // Always store the absolute latest snapshot for current balances
    if (!latestMap.has(key)) {
      latestMap.set(key, row);
    }
    
    // Normalize date string to YYYY-MM-DD
    let dateStr = '';
    try {
      const d = new Date(row.date);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().split('T')[0];
      }
    } catch (e) {
      dateStr = String(row.date).split('T')[0];
    }
    
    if (dateStr) {
      // Limit history to 30 unique dates to keep payload under 150 KB
      if (uniqueDates.size < 30 || uniqueDates.has(dateStr)) {
        uniqueDates.add(dateStr);
        historyList.push(row);
      }
    }
  });
  
  // Combine daily history and latest balances, deduplicating by ID
  const finalMap = new Map();
  historyList.forEach(r => finalMap.set(r.id, r));
  latestMap.forEach(r => finalMap.set(r.id, r));
  
  return Array.from(finalMap.values());
}

// ------------------------------------------
// Mutations
// ------------------------------------------
function sanitizeSheetString(value) {
  const text = String(value == null ? '' : value);
  if (/^[=+\-@]/.test(text.trimStart()) || /[\t\r\n]/.test(text)) {
    throw new Error('Unsafe spreadsheet string');
  }
  return text;
}

function updateTransactionCategory(transactionId, newCategory, nativeTransactionId) {
  try {
    if (typeof newCategory !== 'string' || !newCategory.trim()) {
      throw new Error('Category must be a non-empty string');
    }
    newCategory = sanitizeSheetString(newCategory);
    if (typeof transactionId !== 'string' || !/^transactions_(0|[1-9]\d*)$/.test(transactionId)) {
      throw new Error('Invalid transaction ID');
    }
    const targetIndex = Number(transactionId.slice('transactions_'.length));
    if (!Number.isSafeInteger(targetIndex)) throw new Error('Invalid transaction ID');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Transactions') ||
      ss.getSheets().find(s => s.getName().toLowerCase().trim() === 'transactions');
    if (!sheet) throw new Error('Transactions sheet not found');
    const data = sheet.getDataRange().getValues();
    const headerIndex = findHeaderRowIndex(data, 'Transactions');
    if (headerIndex === -1) throw new Error('Transaction headers not found');
    const headers = data[headerIndex].map(h => String(h || '').toLowerCase().trim().replace(/\s+/g, '_'));
    const categoryCol = headers.indexOf('category');
    const dateCol = headers.indexOf('date');
    const amountCol = headers.indexOf('amount');
    if ([categoryCol, dateCol, amountCol].some(col => col === -1)) {
      throw new Error('Required transaction columns not found');
    }
    const nativeIdCol = headers.indexOf('transaction_id');
    let targetRow = -1;
    if (nativeIdCol !== -1) {
      if (nativeTransactionId == null || String(nativeTransactionId).trim() === '') throw new Error('Native transaction ID required');
      const matches = [];
      for (let row = headerIndex + 1; row < data.length; row++) {
        if (data[row][nativeIdCol] === nativeTransactionId) matches.push(row);
      }
      if (matches.length !== 1) throw new Error('Native transaction ID missing or ambiguous');
      targetRow = matches[0];
    } else {
      if (nativeTransactionId != null) throw new Error('Native transaction ID column missing');
      let index = 0;
      for (let row = headerIndex + 1; row < data.length; row++) {
        if (!data[row].some(value => value !== null && value !== '')) continue;
        if (index === targetIndex) { targetRow = row; break; }
        index++;
      }
    }
    if (targetRow <= headerIndex) throw new Error('Transaction not found');
    const date = data[targetRow][dateCol];
    const amount = data[targetRow][amountCol];
    if (!date || !Number.isFinite(new Date(date).getTime()) ||
        amount == null || String(amount).trim() === '' || !Number.isFinite(Number(amount))) {
      throw new Error('Target row is not a transaction');
    }
    sheet.getRange(targetRow + 1, categoryCol + 1).setValue(newCategory);
    return { success: true, transactionId, category: newCategory };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function addBalanceHistoryEntry(accountName, institution, balance, accountId, accountClass, accountType) {
  try {
    accountName = sanitizeSheetString(accountName);
    institution = sanitizeSheetString(institution);
    accountId = sanitizeSheetString(accountId);
    accountClass = sanitizeSheetString(accountClass || 'Asset');
    accountType = sanitizeSheetString(accountType || 'Investment');
    balance = Number(balance);
    if (!Number.isFinite(balance)) throw new Error('Balance must be a finite number');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Balance History');
    if (!sheet) {
      const sheets = ss.getSheets();
      sheet = sheets.find(s => s.getName().toLowerCase().trim() === 'balance history');
    }
    if (!sheet) throw new Error('Balance History sheet not found');

    const data = sheet.getDataRange().getValues();
    const headerIndex = findHeaderRowIndex(data, 'Balance History');
    if (headerIndex === -1) throw new Error('Balance History headers not found');

    const headers = data[headerIndex];
    const dateCol = headers.findIndex(h => String(h || '').toLowerCase().trim() === 'date');
    const institutionCol = headers.findIndex(h => String(h || '').toLowerCase().trim() === 'institution');
    const accountCol = headers.findIndex(h => String(h || '').toLowerCase().trim() === 'account');
    const balanceCol = headers.findIndex(h => String(h || '').toLowerCase().trim() === 'balance');
    const accountIdCol = headers.findIndex(h => String(h || '').toLowerCase().trim() === 'account_id' || String(h || '').toLowerCase().trim() === 'account id');
    const classCol = headers.findIndex(h => String(h || '').toLowerCase().trim() === 'class');
    const typeCol = headers.findIndex(h => String(h || '').toLowerCase().trim() === 'type');

    const newRow = new Array(headers.length).fill('');
    const now = new Date();

    if (dateCol !== -1) newRow[dateCol] = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    if (institutionCol !== -1) newRow[institutionCol] = institution;
    if (accountCol !== -1) newRow[accountCol] = accountName;
    if (balanceCol !== -1) newRow[balanceCol] = balance;
    if (accountIdCol !== -1) newRow[accountIdCol] = accountId;
    if (classCol !== -1) newRow[classCol] = accountClass || 'Asset';
    if (typeCol !== -1) newRow[typeCol] = accountType || 'Investment';

    sheet.appendRow(newRow);
    return { success: true, accountName, balance };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
