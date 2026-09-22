import { afterEach, expect, it, vi } from 'vitest';
import { updateTransactionCategory } from './api';
import { compressTransactions } from '../utils/dataPrep';
afterEach(() => vi.unstubAllGlobals());
it('preserves native IDs in cache and sends them to the gateway', async () => {
  vi.stubGlobal('localStorage', { getItem: () => 'https://example.invalid/exec' });
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal('fetch', fetch);
  const [txn] = compressTransactions([{ id: 'transactions_0', transaction_id: 'immutable' }]);
  await updateTransactionCategory(txn.id, 'Food', txn.transaction_id);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ transactionId: 'transactions_0', category: 'Food', nativeTransactionId: 'immutable' });
});
