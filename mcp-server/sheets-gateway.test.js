import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';

const script = readFileSync(new URL('../tiller-apps-script.js', import.meta.url), 'utf8');
function sheets(secret = 'configured') {
  const rows = [['Title'], [], ['Date', 'Amount', 'Category'], [], ['2026-01-01', 0, 'Old'], [], ['2026-01-02', -5, 'Old']];
  const setValue = vi.fn();
  const sheet = { getDataRange: () => ({ getValues: () => rows }), getRange: vi.fn(() => ({ setValue })), appendRow: vi.fn() };
  const context = vm.createContext({ SpreadsheetApp: { getActiveSpreadsheet: () => ({ getId: () => 'fake' }), openById: () => ({ getSheetByName: () => sheet }) } });
  vm.runInContext(script.replace('const ACCESS_SECRET = "replace-with-your-mcp-secret-or-custom-token";', `const ACCESS_SECRET = ${JSON.stringify(secret)};`), context);
  return { context, sheet, setValue, rows };
}
it.each(['', 'replace-with-your-mcp-secret-or-custom-token'])('denies unconfigured secret %s', secret => {
  expect(sheets(secret).context.isAuthorized({ parameter: { secret } })).toBe(false);
});
it('requires the configured token even for missing request parameters', () => {
  const { context } = sheets();
  expect(context.isAuthorized()).toBe(false);
  expect(context.isAuthorized({ parameter: { secret: 'wrong' } })).toBe(false);
  expect(context.isAuthorized({ parameter: { token: 'configured' } })).toBe(true);
});
it('maps filtered IDs below a displaced header and accepts zero amounts', () => {
  const { context, sheet } = sheets();
  expect(context.updateTransactionCategory('transactions_0', 'New').success).toBe(true);
  expect(sheet.getRange).toHaveBeenLastCalledWith(5, 3);
  expect(context.updateTransactionCategory('transactions_1', 'New').success).toBe(true);
  expect(sheet.getRange).toHaveBeenLastCalledWith(7, 3);
});
it.each(['transactions_-1', 'transactions_1junk', 'transactions_99', 'transactions_01'])('rejects invalid target %s', id => {
  const { context, setValue } = sheets();
  expect(context.updateTransactionCategory(id, 'New').success).toBe(false);
  expect(setValue).not.toHaveBeenCalled();
});
it('rejects nontransaction rows and empty categories', () => {
  const { context, rows, setValue } = sheets();
  rows[4][0] = 'Date';
  expect(context.updateTransactionCategory('transactions_0', 'New').success).toBe(false);
  expect(context.updateTransactionCategory('transactions_1', '  ').success).toBe(false);
  expect(setValue).not.toHaveBeenCalled();
});
it.each([' =SUM(A1)', '+cmd', '-cmd', '@cmd', '\ttext', 'a\rb', 'a\nb'])('rejects sheet injection %j before writes', value => {
  const { context, setValue, sheet } = sheets();
  expect(context.updateTransactionCategory('transactions_0', value).success).toBe(false);
  for (const index of [0, 1, 3, 4, 5]) {
    const args = ['Account', 'Bank', '10', 'id', 'Asset', 'Cash'];
    args[index] = value;
    expect(context.addBalanceHistoryEntry(...args).success).toBe(false);
  }
  expect(setValue).not.toHaveBeenCalled();
  expect(sheet.appendRow).not.toHaveBeenCalled();
});
it('rejects nonnumeric balances', () => {
  const { context, sheet } = sheets();
  expect(context.addBalanceHistoryEntry('A', 'B', 'oops').success).toBe(false);
  expect(sheet.appendRow).not.toHaveBeenCalled();
});

const server = readFileSync(new URL('./server.js', import.meta.url), 'utf8');
function gateway(envelope, secret = '') {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => envelope });
  const context = vm.createContext({ URL, fetch, console: { log() {} }, SHEETS_API_URL: 'https://example.invalid/exec?secret=old&other=keep&action=old', SHEETS_API_SECRET: secret });
  vm.runInContext(server.slice(server.indexOf('let cachedSheetData ='), server.indexOf('// ─── Authentication Middleware')), context);
  return { context, fetch };
}
it.each(['', 'new&token'])('preserves query params and applies secret override %s', async secret => {
  const data = { transactions: [] };
  const { context, fetch } = gateway({ success: true, data }, secret);
  expect(await context.fetchSheetData()).toEqual(data);
  const url = fetch.mock.calls[0][0];
  expect(url.searchParams.get('secret')).toBe(secret || 'old');
  expect(url.searchParams.get('action')).toBe('getData');
  expect(url.searchParams.get('other')).toBe('keep');
  await context.fetchSheetData();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([{ success: false, error: 'Unauthorized' }, { error: '' }, { success: true, error: 'failed', data: {} }, {}, null])('rejects error or malformed envelopes without caching %j', async envelope => {
  const { context, fetch } = gateway(envelope);
  await expect(context.fetchSheetData()).rejects.toThrow();
  await expect(context.fetchSheetData()).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(2);
});
