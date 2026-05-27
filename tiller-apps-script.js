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
// Core Data Fetching
// ------------------------------------------
function getTillerData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  return {
    transactions: getSheetData(ss, 'Transactions'),
    categories: getSheetData(ss, 'Categories'),
    balances: getSheetData(ss, 'Balance History'),
    lifeOptimization: getSheetData(ss, 'Life_Optimization').length > 0 
      ? getSheetData(ss, 'Life_Optimization') 
      : getSheetData(ss, 'Life Optimization')
  };
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map((row, index) => {
    let rowData = { id: `${sheetName.toLowerCase().replace(' ', '_')}_${index}` };
    headers.forEach((header, i) => {
      // Safely convert header to string and map spaces to underscores
      let key = String(header || '').toLowerCase().trim().replace(/\s+/g, '_');
      if (key) {
        rowData[key] = row[i];
      }
    });
    return rowData;
  });
}

// ------------------------------------------
// Mutations
// ------------------------------------------
function updateTransactionCategory(transactionId, newCategory) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Transactions');
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
