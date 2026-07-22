const getInstitutionName = (account) => (
  account?.institution_name
  || account?.brokerage?.name
  || account?.meta?.institution_name
  || 'Brokerage'
);

const getAuthorizationId = (account) => {
  const authorization = account?.brokerage_authorization || account?.brokerageAuthorization;
  return typeof authorization === 'object' ? authorization?.id : authorization;
};

const getHoldingsLastSync = (account) => (
  account?.sync_status?.holdings?.last_successful_sync
  || account?.sync_status?.last_successful_sync
  || null
);

/**
 * SnapTrade returns one account per row. A brokerage connection is identified by
 * its authorization ID, not just its institution name: users can link more than
 * one login at the same institution.
 */
export function buildConnectionSummaries(accounts = []) {
  const connections = new Map();

  accounts.forEach((account) => {
    const institutionName = getInstitutionName(account);
    const authorizationId = getAuthorizationId(account);
    const key = authorizationId || `${institutionName}:${account?.id || account?.number || 'unknown'}`;
    const lastSync = getHoldingsLastSync(account);

    if (!connections.has(key)) {
      connections.set(key, {
        institution_name: institutionName,
        item_id: authorizationId || account?.id,
        account_count: 0,
        last_sync: null
      });
    }

    const connection = connections.get(key);
    connection.account_count += 1;
    if (lastSync && (!connection.last_sync || new Date(lastSync) > new Date(connection.last_sync))) {
      connection.last_sync = lastSync;
    }
  });

  return Array.from(connections.values());
}

export function buildHoldingsSyncSummary(accounts = [], holdings = []) {
  const accountIdsWithHoldings = new Set(
    holdings
      .map((holding) => holding?.account?.id)
      .filter(Boolean)
  );
  const accountsWithoutHoldingsResponse = accounts
    .filter((account) => !accountIdsWithHoldings.has(account.id))
    .map((account) => ({ id: account.id, name: account.name || 'Unnamed account' }));

  return {
    expected_accounts: accounts.length,
    accounts_with_holdings_response: accountIdsWithHoldings.size,
    accounts_without_holdings_response: accountsWithoutHoldingsResponse,
    returned_holdings_records: holdings.length
  };
}
