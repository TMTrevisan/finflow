import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';

// Evaluate only the handlers with fake SDK/filesystem dependencies: no server startup or network.
const source = readFileSync(new URL('./server.js', import.meta.url), 'utf8');
function harness(cached = false) {
  const config = { userId: 'server-user', userSecret: 'server-secret' };
  const client = {
    authentication: { login: vi.fn().mockResolvedValue({ data: { redirectURI: 'portal-url' } }) },
    accountInformation: { listUserAccounts: vi.fn().mockResolvedValue({ data: [] }) }
  };
  const context = vm.createContext({
    console: { log() {}, error() {} }, process: { env: {} },
    loadSnapTradeConfig: () => config, getSnapTradeClient: () => client,
    saveSnapTradeConfig: vi.fn(), ensureSnapTradeUser: async () => config,
    getUserStatusCacheFilePath: () => 'fake-cache', buildConnectionSummaries: () => [],
    fs: { existsSync: () => cached, writeFileSync: vi.fn(), readFileSync: () => JSON.stringify({
      timestamp: Date.now(), data: { connected: true, connections: [], ...config, consumerKey: 'old-key', clientId: 'old-id' }
    }) }
  });
  vm.runInContext(source.slice(source.indexOf('function getSnapTradeErrorMessage'), source.indexOf('async function handleGetSnapTradeHoldings')), context);
  return { context, config, client };
}
it('ignores caller identity headers and body credentials', () => {
  const { context, config } = harness();
  expect(context.getSnapTradeClientAndConfig({ headers: { 'x-snaptrade-user-secret': 'attacker' }, body: { userId: 'attacker', userSecret: 'attacker' } }).config).toEqual(config);
});
it.each(['handleSaveConfig', 'handleCreatePortalUrl', 'handleSnapTradeStatus'])('%s returns opaque identity metadata', async handler => {
  const { context } = harness();
  const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  await context[handler]({ body: { clientId: 'id', consumerKey: 'key', userSecret: 'attacker' }, query: {} }, res);
  const data = res.json.mock.calls[0][0];
  expect(data.hasUserSecret).toBe(true);
  for (const key of ['userId', 'userSecret', 'consumerKey', 'clientId']) expect(data).not.toHaveProperty(key);
});
it('does not replay secrets from legacy status caches', async () => {
  const { context, client } = harness(true);
  const res = { json: vi.fn() };
  await context.handleSnapTradeStatus({ query: {} }, res);
  expect(res.json.mock.calls[0][0]).toEqual({ configured: true, connected: true, connections: [], account_count: undefined, hasUserSecret: true });
  expect(client.accountInformation.listUserAccounts).not.toHaveBeenCalled();
});
