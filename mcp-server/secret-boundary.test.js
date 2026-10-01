import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
import { createAuthenticate } from './auth.js';

// Execute source with only in-memory filesystem and SDK doubles. No listeners or network.
const source = readFileSync(new URL('./server.js', import.meta.url), 'utf8');
function harness({ env = {}, config = {}, cached = false } = {}) {
  const identity = { snaptradeClientId: 'client', snaptradeConsumerKey: 'key', userId: 'server-user', userSecret: 'server-secret', ...config };
  const files = new Map([['/fake/snaptrade_config.json', JSON.stringify(identity)]]);
  const fs = {
    existsSync: vi.fn(file => files.has(file)),
    readFileSync: vi.fn(file => files.get(file)),
    writeFileSync: vi.fn((file, value) => files.set(file, value)),
    renameSync: vi.fn((from, to) => { files.set(to, files.get(from)); files.delete(from); }),
    unlinkSync: vi.fn(file => files.delete(file))
  };
  const client = {
    authentication: {
      login: vi.fn().mockResolvedValue({ data: { redirectURI: 'portal-url' } }),
      listSnapTradeUsers: vi.fn(), resetSnapTradeUserSecret: vi.fn(),
      registerSnapTradeUser: vi.fn().mockResolvedValue({ data: { userSecret: 'registered-secret' } }),
      deleteSnapTradeUser: vi.fn().mockResolvedValue({})
    },
    accountInformation: { listUserAccounts: vi.fn().mockResolvedValue({ data: [] }) }
  };
  const routes = new Map();
  const context = vm.createContext({
    console: { log() {}, error() {}, warn() {} }, process: { env },
    Buffer, createHash, randomUUID, timingSafeEqual, path, fs, __dirname: '/fake',
    MCP_SECRET: 'reader',
    Snaptrade: function () { return client; },
    buildConnectionSummaries: accounts => accounts, buildHoldingsSyncSummary: () => ({}),
    // Faithful gate: the SnapTrade credential-management routes use the same
    // MCP-secret `authenticate` as every other backend endpoint (single-user
    // personal deployment; the web UI has no admin-credential path).
    authenticate: createAuthenticate('reader'),
    app: { post: (route, ...handlers) => routes.set(route, handlers), get() {} }
  });
  vm.runInContext(source.slice(source.indexOf('// Config reads return'), source.indexOf('const allowedOrigins')), context);
  vm.runInContext(source.slice(source.indexOf('function getSnapTradeErrorMessage'), source.indexOf('// Health check')), context);
  if (cached) {
    const key = context.getSnapTradeClientAndConfig().config.principalKey;
    files.set(context.getUserStatusCacheFilePath(key), JSON.stringify({ timestamp: Date.now(), data: {
      connected: true, connections: [{ name: 'bank', nested: { USER_SECRET: 'old-secret' } }], ...identity
    } }));
  }
  // NOTE: secretPrefix has no default — callers must pass 'reader' explicitly or
  // undefined (a default would silently re-authenticate the rejection cases).
  async function request(route, token, body = {}, secretPrefix) {
    const res = response();
    const [gate, handler] = routes.get(route);
    let allowed = false;
    gate({ headers: { authorization: token }, params: { secretPrefix } }, res, () => { allowed = true; });
    if (allowed) await handler({ body, query: {} }, res);
    return res;
  }
  return { context, files, fs, client, identity, request };
}
function response() { return { json: vi.fn(), status: vi.fn().mockReturnThis() }; }

it('ignores caller identity headers and body credentials', () => {
  const { context } = harness();
  const expected = context.getSnapTradeClientAndConfig().config;
  expect(context.getSnapTradeClientAndConfig({ headers: { 'x-snaptrade-user-secret': 'attacker' }, body: { userId: 'attacker' } }).config).toEqual(expected);
});
it.each(['handleSaveConfig', 'handleCreatePortalUrl', 'handleSnapTradeStatus'])('%s returns opaque identity metadata', async handler => {
  const { context } = harness();
  const res = response();
  await context[handler]({ body: { clientId: 'id', consumerKey: 'key', userId: 'id', userSecret: 'secret' }, query: {} }, res);
  expect(res.json.mock.calls[0][0].hasUserSecret).toBe(true);
  for (const key of ['userId', 'userSecret', 'consumerKey', 'clientId', 'principalKey']) expect(res.json.mock.calls[0][0]).not.toHaveProperty(key);
});
it('scrubs nested legacy status secrets before reuse and on disk', async () => {
  const { context, client, files } = harness({ cached: true });
  const res = response();
  await context.handleSnapTradeStatus({ query: {} }, res);
  expect(res.json.mock.calls[0][0].connections).toEqual([{ name: 'bank', nested: {} }]);
  expect(client.accountInformation.listUserAccounts).not.toHaveBeenCalled();
  const caches = [...files].filter(([name]) => name.includes('_cache.json'));
  expect(JSON.stringify(caches)).not.toMatch(/old-secret|server-secret|consumerKey|USER_SECRET/);
});
it.each(['/api/snaptrade/config', '/api/snaptrade/disconnect', '/api/snaptrade/register', '/:secretPrefix/api/snaptrade/config', '/:secretPrefix/api/snaptrade/disconnect', '/:secretPrefix/api/snaptrade/register'])('%s requires the MCP credential', async route => {
  // No credential, wrong bearer, or wrong path prefix → 401 and nothing runs.
  for (const [token, prefix] of [['', undefined], ['Bearer wrong', undefined], ['', 'wrong']]) {
    const { request, fs, client } = harness();
    const res = await request(route, token, {}, prefix);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(client.authentication.deleteSnapTradeUser).not.toHaveBeenCalled();
    expect(client.authentication.registerSnapTradeUser).not.toHaveBeenCalled();
  }
  // Valid credential via path prefix or bearer → the gate passes.
  for (const [token, prefix] of [['', 'reader'], ['Bearer reader', undefined]]) {
    const { request } = harness();
    const res = await request(route, token, { clientId: 'id', consumerKey: 'key' }, prefix);
    expect(res.status).not.toHaveBeenCalledWith(401);
  }
});
it('allows replacement and deletion with the MCP credential', async () => {
  const { request, files, client } = harness();
  expect((await request('/api/snaptrade/config', '', { clientId: 'new', consumerKey: 'new-key', userId: 'new-user', userSecret: 'new-secret' }, 'reader')).json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  await request('/api/snaptrade/disconnect', '', {}, 'reader');
  expect(client.authentication.deleteSnapTradeUser).toHaveBeenCalledWith({ userId: 'new-user' });
  expect(files.has('/fake/snaptrade_config.json')).toBe(false);
});
it.each(['handleCreatePortalUrl', 'handleSnapTradeStatus', 'handleGetSnapTradeHoldings'])('%s never lists, resets, registers or writes config when secret missing', async handler => {
  const { context, client, fs } = harness({ config: { userSecret: '' } });
  const res = response();
  await context[handler]({ query: {} }, res);
  expect(res.json.mock.calls[0][0].configured).toBe(false);
  for (const call of Object.values(client.authentication)) expect(call).not.toHaveBeenCalled();
  expect(client.accountInformation.listUserAccounts).not.toHaveBeenCalled();
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});
it('registers through the register route with the MCP credential, without a reset', async () => {
  const { request, client, files } = harness({ config: { userSecret: '' } });
  await request('/api/snaptrade/register', '', {}, 'reader');
  expect(client.authentication.registerSnapTradeUser).toHaveBeenCalledWith({ userId: 'server-user' });
  expect(client.authentication.resetSnapTradeUserSecret).not.toHaveBeenCalled();
  expect(JSON.parse(files.get('/fake/snaptrade_config.json')).userSecret).toBe('registered-secret');
});
it('provisions a user identity during config save when none exists', async () => {
  const { context, client, files } = harness({ config: { userSecret: '' } });
  const res = response();
  await context.handleSaveConfig({ body: { clientId: 'new', consumerKey: 'new-key' }, query: {} }, res);
  expect(client.authentication.registerSnapTradeUser).toHaveBeenCalledTimes(1);
  expect(JSON.parse(files.get('/fake/snaptrade_config.json')).userSecret).toBe('registered-secret');
  expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ success: true, configured: true, hasUserSecret: true }));
});
it('skips provisioning during config save when the identity already exists', async () => {
  const { context, client } = harness();
  const res = response();
  await context.handleSaveConfig({ body: { clientId: 'new', consumerKey: 'new-key', userId: 'u', userSecret: 's' }, query: {} }, res);
  expect(client.authentication.registerSnapTradeUser).not.toHaveBeenCalled();
  expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ success: true, configured: true }));
});
it('preserves the existing user identity when the body omits credentials', async () => {
  const { context, client, files } = harness();
  const res = response();
  // Same clientId (key rotation): the identity stays valid and is preserved.
  await context.handleSaveConfig({ body: { clientId: 'client', consumerKey: 'new-key' }, query: {} }, res);
  expect(client.authentication.registerSnapTradeUser).not.toHaveBeenCalled();
  const saved = JSON.parse(files.get('/fake/snaptrade_config.json'));
  expect(saved.snaptradeConsumerKey).toBe('new-key');
  expect(saved.userId).toBe('server-user');
  expect(saved.userSecret).toBe('server-secret');
  expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ success: true, configured: true }));
});
it('rejects a partial identity update instead of corrupting the pair', async () => {
  const { context, client, files } = harness();
  const before = files.get('/fake/snaptrade_config.json');
  const res = response();
  await context.handleSaveConfig({ body: { clientId: 'client', consumerKey: 'key', userId: 'new-id' }, query: {} }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(client.authentication.registerSnapTradeUser).not.toHaveBeenCalled();
  expect(files.get('/fake/snaptrade_config.json')).toBe(before);
});
it('provisions a fresh identity when the clientId changes', async () => {
  const { context, client, files } = harness();
  const res = response();
  await context.handleSaveConfig({ body: { clientId: 'different-client', consumerKey: 'new-key' }, query: {} }, res);
  expect(client.authentication.registerSnapTradeUser).toHaveBeenCalledTimes(1);
  const saved = JSON.parse(files.get('/fake/snaptrade_config.json'));
  expect(saved.userId).toMatch(/^finflow_/);
  expect(saved.userId).not.toBe('server-user');
  expect(saved.userSecret).toBe('registered-secret');
  expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ success: true, configured: true }));
});
it('maps a SnapTrade 401 during provisioning to an actionable credential message', async () => {
  const { context, client } = harness({ config: { userSecret: '' } });
  const err = new Error('Request failed with status code 401');
  err.status = 401;
  client.authentication.registerSnapTradeUser.mockRejectedValueOnce(err);
  const res = response();
  await context.handleSaveConfig({ body: { clientId: 'new', consumerKey: 'bad-key' }, query: {} }, res);
  expect(res.status).toHaveBeenCalledWith(502);
  expect(res.json.mock.calls[0][0].error).toMatch(/rejected the Client ID \/ Consumer Key/);
});
it('keeps the generic message for non-auth provisioning failures', async () => {
  const { context, client } = harness({ config: { userSecret: '' } });
  client.authentication.registerSnapTradeUser.mockRejectedValueOnce(new Error('socket hang up'));
  const res = response();
  await context.handleSaveConfig({ body: { clientId: 'new', consumerKey: 'new-key' }, query: {} }, res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json.mock.calls[0][0].error).toBe('SnapTrade request failed. Check the server configuration and try again.');
});
it('applies env > file for all credentials and supports env-only provisioning without writes', () => {
  const env = { SNAPTRADE_CLIENT_ID: 'env-client', SNAPTRADE_CONSUMER_KEY: 'env-key', SNAPTRADE_USER_ID: 'env-user', SNAPTRADE_USER_SECRET: 'env-secret' };
  const { context, files, fs } = harness({ env });
  const expected = { snaptradeClientId: 'env-client', snaptradeConsumerKey: 'env-key', userId: 'env-user', userSecret: 'env-secret' };
  expect(context.loadSnapTradeConfig()).toEqual(expected);
  files.clear();
  expect(context.loadSnapTradeConfig()).toEqual(expected);
  expect(context.getSnapTradeClientAndConfig().config.userSecret).toBe('env-secret');
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});
it('explicitly empty env secret overrides file and leaves reads unconfigured', async () => {
  const { context } = harness({ env: { SNAPTRADE_USER_SECRET: '' } });
  const res = response();
  await context.handleSnapTradeStatus({ query: {} }, res);
  expect(res.json.mock.calls[0][0].configured).toBe(false);
});
it('writes atomically with mode 0600 and preserves the old config on rename failure', () => {
  const { context, fs, files } = harness();
  const original = files.get('/fake/snaptrade_config.json');
  fs.renameSync.mockImplementationOnce(() => { throw new Error('failed'); });
  expect(() => context.saveSnapTradeConfig({ userSecret: 'replacement' })).toThrow();
  expect(files.get('/fake/snaptrade_config.json')).toBe(original);
  expect(files.size).toBe(1);
  const [temporary, , options] = fs.writeFileSync.mock.calls[0];
  expect(path.dirname(temporary)).toBe('/fake');
  expect(options).toEqual({ mode: 0o600, flag: 'wx' });
  context.saveSnapTradeConfig({ userSecret: 'replacement' });
  expect(JSON.parse(files.get('/fake/snaptrade_config.json')).userSecret).toBe('replacement');
});
it('isolates same-user caches when credentials or authenticated server principal change', () => {
  const { context } = harness();
  const first = context.getSnapTradeClientAndConfig().config.principalKey;
  context.process.env.SNAPTRADE_USER_SECRET = 'rotated';
  const second = context.getSnapTradeClientAndConfig().config.principalKey;
  context.MCP_SECRET = 'other-reader';
  const third = context.getSnapTradeClientAndConfig().config.principalKey;
  expect(new Set([first, second, third]).size).toBe(3);
  expect(first).toMatch(/^[a-f0-9]{64}$/);
});
it('scrubs holdings cache secrets before use and persistence', async () => {
  const { context, files } = harness();
  const { client, config } = context.getSnapTradeClientAndConfig();
  const filename = context.getUserCacheFilePath(config.principalKey);
  files.set(filename, JSON.stringify({ timestamp: Date.now(), version: 2, data: { accounts: [], nested: { access_token: 'leak', consumerKey: 'leak' } } }));
  expect(await context.fetchNormalizedSnapTradeHoldings(client, config)).toEqual({ accounts: [], nested: {} });
  expect(files.get(filename)).not.toContain('leak');
});
it('never persists credential fields from fresh status data', async () => {
  const { context, client, files } = harness();
  client.accountInformation.listUserAccounts.mockResolvedValue({ data: [{ name: 'bank', nested: { userSecret: 'leak' } }] });
  await context.handleSnapTradeStatus({ query: {} }, response());
  expect([...files].filter(([name]) => name.includes('_cache.json')).map(([, value]) => value).join('')).not.toContain('leak');
});
it('fresh holdings writes strip nested credentials from SDK payloads', async () => {
  const { context, client, files } = harness();
  client.accountInformation.listUserAccounts.mockResolvedValue({ data: [{ id: 'account', brokerage: { name: 'bank', client_id: 'leak' } }] });
  client.accountInformation.getAllUserHoldings = vi.fn().mockResolvedValue({ data: [] });
  client.referenceData = { listAllCurrenciesRates: vi.fn().mockResolvedValue({ data: [] }) };
  const { config } = context.getSnapTradeClientAndConfig();
  const result = await context.fetchNormalizedSnapTradeHoldings(client, config, true);
  expect(JSON.stringify(result)).not.toContain('leak');
  expect(files.get(context.getUserCacheFilePath(config.principalKey))).not.toContain('leak');
});
it('refuses environment-managed deletion and registration without touching files or SDK', async () => {
  const { request, client, fs } = harness({ env: { SNAPTRADE_USER_SECRET: 'env-secret' } });
  for (const route of ['/api/snaptrade/disconnect', '/api/snaptrade/register']) {
    expect((await request(route, 'Bearer ignored', {}, 'reader')).status).toHaveBeenCalledWith(409);
  }
  expect(client.authentication.deleteSnapTradeUser).not.toHaveBeenCalled();
  expect(client.authentication.registerSnapTradeUser).not.toHaveBeenCalled();
  expect(fs.unlinkSync).not.toHaveBeenCalled();
});
