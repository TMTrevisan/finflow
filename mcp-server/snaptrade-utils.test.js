import { describe, expect, it } from 'vitest';
import { buildConnectionSummaries, buildHoldingsSyncSummary } from './snaptrade-utils.js';

describe('SnapTrade normalization helpers', () => {
  it('groups accounts by authorization rather than institution name', () => {
    const connections = buildConnectionSummaries([
      { id: 'a1', institution_name: 'Fidelity', brokerage_authorization: 'auth-1' },
      { id: 'a2', institution_name: 'Fidelity', brokerage_authorization: 'auth-1' },
      { id: 'a3', institution_name: 'Fidelity', brokerage_authorization: 'auth-2' }
    ]);

    expect(connections).toEqual([
      expect.objectContaining({ item_id: 'auth-1', account_count: 2 }),
      expect.objectContaining({ item_id: 'auth-2', account_count: 1 })
    ]);
  });

  it('reports accounts omitted by the holdings payload', () => {
    const summary = buildHoldingsSyncSummary(
      [{ id: 'a1', name: 'Individual' }, { id: 'a2', name: 'Roth IRA' }],
      [{ account: { id: 'a1' }, positions: [] }]
    );

    expect(summary).toMatchObject({
      expected_accounts: 2,
      accounts_with_holdings_response: 1,
      returned_holdings_records: 1,
      accounts_without_holdings_response: [{ id: 'a2', name: 'Roth IRA' }]
    });
  });
});
