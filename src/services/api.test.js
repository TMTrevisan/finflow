import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFinData, getVerificationOutcome, isGatewayAuthError, updateTransactionCategory } from './api';
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

describe('isGatewayAuthError', () => {
  it('detects the tagged unauthorized code', () => {
    const err = new Error('Unauthorized');
    err.code = 'GATEWAY_UNAUTHORIZED';
    expect(isGatewayAuthError(err)).toBe(true);
  });
  it('detects unauthorized by message as a fallback', () => {
    expect(isGatewayAuthError(new Error('gateway says: Unauthorized'))).toBe(true);
  });
  it('rejects transient failures', () => {
    expect(isGatewayAuthError(new Error('Sync timed out after 90s. Google Apps Script is taking longer'))).toBe(false);
    expect(isGatewayAuthError(new Error('Failed to fetch'))).toBe(false);
    expect(isGatewayAuthError(new Error('Invalid Apps Script response'))).toBe(false);
    expect(isGatewayAuthError(null)).toBe(false);
    expect(isGatewayAuthError(undefined)).toBe(false);
  });
});

describe('getVerificationOutcome', () => {
  it('reverts to the previous URL on auth rejection', () => {
    const err = new Error('Unauthorized');
    err.code = 'GATEWAY_UNAUTHORIZED';
    expect(getVerificationOutcome(err, 'https://old/exec?secret=x')).toEqual({
      shouldRevert: true,
      restoreUrl: 'https://old/exec?secret=x',
      message: expect.stringContaining('Unauthorized'),
    });
  });
  it('reverts to empty (clears) on auth rejection with no previous URL', () => {
    const outcome = getVerificationOutcome(new Error('Unauthorized'), null);
    expect(outcome.shouldRevert).toBe(true);
    expect(outcome.restoreUrl).toBe('');
  });
  it('keeps the new URL on transient failures', () => {
    for (const msg of ['Sync timed out after 90s.', 'Failed to fetch', 'Invalid Apps Script response']) {
      const outcome = getVerificationOutcome(new Error(msg), 'https://old/exec?secret=x');
      expect(outcome.shouldRevert).toBe(false);
      expect(outcome.message).toContain('URL saved');
      expect(outcome.message).toContain('manual sync');
    }
  });
});

describe('fetchFinData gateway auth tagging', () => {
  it('tags Unauthorized envelope rejections so the UI can revert a bad URL', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'https://example.invalid/exec' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'Unauthorized' }),
    }));
    const err = await fetchFinData().then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('GATEWAY_UNAUTHORIZED');
    expect(isGatewayAuthError(err)).toBe(true);
  });
  it('does not tag non-auth envelope errors', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'https://example.invalid/exec' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'Script blew up' }),
    }));
    const err = await fetchFinData().then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBeUndefined();
    expect(isGatewayAuthError(err)).toBe(false);
  });
});
