const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toAccountIdSet = (accounts = []) => new Set(accounts.map((account) => account.id).filter(Boolean));

export function reconcilePortfolioAccounts({ accounts = [], positions = [], syncSummary = {} }) {
  const missingHoldingsIds = toAccountIdSet(syncSummary.accounts_without_holdings_response);
  const positionTotals = new Map();

  positions.forEach((position) => {
    if (!position?.account_id) return;
    const current = positionTotals.get(position.account_id) || {
      calculated_value: 0,
      position_count: 0,
      missing_market_value_count: 0,
      missing_cost_basis_count: 0
    };
    const value = toFiniteNumber(position.value);
    current.position_count += 1;
    if (position.market_value_available === false || value === null) {
      current.missing_market_value_count += 1;
    } else {
      current.calculated_value += value;
    }
    if (position.cost_basis_available === false) current.missing_cost_basis_count += 1;
    positionTotals.set(position.account_id, current);
  });

  const accountResults = accounts.map((account) => {
    const totals = positionTotals.get(account.id) || {
      calculated_value: 0,
      position_count: 0,
      missing_market_value_count: 0,
      missing_cost_basis_count: 0
    };
    const reportedBalance = toFiniteNumber(account?.balances?.current);
    const difference = reportedBalance === null ? null : reportedBalance - totals.calculated_value;
    const tolerance = reportedBalance === null ? null : Math.max(1, Math.abs(reportedBalance) * 0.0025);
    const missingFromResponse = missingHoldingsIds.has(account.id);

    let status = 'reconciled';
    if (missingFromResponse || totals.missing_market_value_count > 0) status = 'partial';
    else if (reportedBalance === null) status = 'unreconciled';
    else if (Math.abs(difference) > tolerance) status = 'discrepancy';

    return {
      id: account.id,
      name: account.name || 'Unnamed account',
      institution_name: account.institution_name || 'Brokerage',
      reported_balance: reportedBalance,
      calculated_value: totals.calculated_value,
      difference,
      tolerance,
      position_count: totals.position_count,
      missing_market_value_count: totals.missing_market_value_count,
      missing_cost_basis_count: totals.missing_cost_basis_count,
      status
    };
  });

  const counts = accountResults.reduce((result, account) => {
    result[account.status] += 1;
    return result;
  }, { reconciled: 0, discrepancy: 0, partial: 0, unreconciled: 0 });

  return {
    accounts: accountResults,
    counts,
    total_reported_balance: accountResults.reduce((sum, account) => sum + (account.reported_balance || 0), 0),
    total_calculated_value: accountResults.reduce((sum, account) => sum + account.calculated_value, 0),
    attention_count: counts.discrepancy + counts.partial + counts.unreconciled
  };
}
