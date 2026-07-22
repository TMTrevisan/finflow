import { describe, expect, it } from 'vitest';
import { reconcilePortfolioAccounts } from './portfolioReconciliation';

describe('reconcilePortfolioAccounts', () => {
  it('reconciles an account when its reported balance matches positions and cash', () => {
    const result = reconcilePortfolioAccounts({
      accounts: [{ id: 'a1', name: 'Individual', balances: { current: 125 } }],
      positions: [
        { account_id: 'a1', value: 100, market_value_available: true, cost_basis_available: true },
        { account_id: 'a1', value: 25, market_value_available: true, cost_basis_available: true }
      ]
    });

    expect(result.counts.reconciled).toBe(1);
    expect(result.accounts[0]).toMatchObject({ difference: 0, status: 'reconciled' });
  });

  it('flags material balance differences without treating them as complete data', () => {
    const result = reconcilePortfolioAccounts({
      accounts: [{ id: 'a1', balances: { current: 200 } }],
      positions: [{ account_id: 'a1', value: 150, market_value_available: true }]
    });

    expect(result.accounts[0]).toMatchObject({ difference: 50, status: 'discrepancy' });
  });

  it('flags accounts omitted from the holdings response as partial', () => {
    const result = reconcilePortfolioAccounts({
      accounts: [{ id: 'a1', balances: { current: 200 } }],
      syncSummary: { accounts_without_holdings_response: [{ id: 'a1' }] }
    });

    expect(result.accounts[0].status).toBe('partial');
  });
});
