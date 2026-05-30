// ==========================================
// TILLER MONEY - GOOGLE APPS SCRIPT BACKEND
// ==========================================
// Deploy this as a "Web App" in your Tiller Google Sheet.
// Ensure it is executed as "Me" and access is set to "Anyone" (or CORS will block it).

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getData') {
    return createJsonResponse(getTillerData());
  }
  
  return createJsonResponse({ error: 'Invalid action' }, 400);
}

function doPost(e) {
  const action = e.parameter.action;
  
  if (action === 'updateCategory') {
    const postData = JSON.parse(e.postData.contents);
    const { transactionId, category } = postData;
    const success = updateTransactionCategory(transactionId, category);
    return createJsonResponse({ success, transactionId, category });
  }
  
  return createJsonResponse({ error: 'Invalid action' }, 400);
}

function createJsonResponse(data, statusCode = 200) {
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
  
  // Find the first row that is not entirely empty as the header row (skips blank lines)
  let headerIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].some(val => val !== null && val !== '')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1 || headerIndex === data.length - 1) return [];
  
  const headers = data[headerIndex];
  const rows = data.slice(headerIndex + 1);
  
  return rows
    .filter(row => row.some(val => val !== null && val !== '')) // skip completely empty rows
    .map((row, index) => {
      let rowData = { id: `${sheetName.toLowerCase().replace(/\s+/g, '_')}_${index}` };
      headers.forEach((header, i) => {
        let key = String(header || '').toLowerCase().trim().replace(/\s+/g, '_');
        if (key) {
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
  let headerIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].some(val => val !== null && val !== '')) {
      headerIndex = i;
      break;
    }
  }
  
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
          rowData[key] = row[i];
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
function updateTransactionCategory(transactionId, newCategory) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let sheet = ss.getSheetByName('Transactions');
  if (!sheet) {
    const sheets = ss.getSheets();
    sheet = sheets.find(s => s.getName().toLowerCase().trim() === 'transactions');
  }
  if (!sheet) return false;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const categoryColumnIndex = headers.findIndex(h => String(h || '').toLowerCase().trim() === 'category');
  
  if (categoryColumnIndex === -1) return false;
  
  // Example transactionId format: "transactions_4"
  const rowIndex = parseInt(transactionId.split('_')[1], 10) + 2; // +1 for header, +1 for 1-based index
  
  if (rowIndex > data.length) return false;
  
  // Update the cell
  sheet.getRange(rowIndex, categoryColumnIndex + 1).setValue(newCategory);
  return true;
}
