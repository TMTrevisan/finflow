import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
import { createAuthenticate } from './auth.js';
const source = readFileSync(new URL('./server.js', import.meta.url), 'utf8');
function policy(env = {}) {
  const app = { use: vi.fn() };
  const context = vm.createContext({ process: { env }, app, cors: vi.fn(), express: { json: vi.fn() } });
  vm.runInContext(source.slice(source.indexOf('const allowedOrigins'), source.indexOf('// Active Server-Sent')), context);
  return { context, app };
}
it('uses exact origins and restrictive production defaults', () => {
  for (const [env, origin, allowed] of [
    [{ NODE_ENV: 'production' }, undefined, true],
    [{ NODE_ENV: 'production' }, 'http://localhost:5173', false],
    [{}, 'http://localhost:5173', true],
    [{}, 'https://attacker.vercel.app', false],
    [{ TRUSTED_ORIGINS: ' https://trusted.vercel.app,https://example.com ' }, 'https://trusted.vercel.app', true],
    [{ TRUSTED_ORIGINS: 'https://example.com' }, 'https://sub.example.com', false]
  ]) {
    const callback = vi.fn();
    policy(env).context.checkOrigin(origin, callback);
    expect(callback.mock.calls[0][0] === null).toBe(allowed);
  }
});
it('installs no-store globally before all routes and preserves it for SSE', () => {
  const { context, app } = policy();
  const res = { setHeader: vi.fn() }, next = vi.fn();
  app.use.mock.calls[0][0]({}, res, next);
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
  expect(next).toHaveBeenCalledOnce();
  expect(source.indexOf('app.use(noStore)')).toBeLessThan(source.indexOf("app.post('/api/snaptrade"));
  expect(source).not.toContain("'Cache-Control': 'no-cache'");
});
it('registers generic health after every specific route', () => {
  const generic = source.indexOf("app.get('/:secretPrefix', handleHealthCheck)");
  for (const match of source.matchAll(/app\.(?:get|post|delete)\(['"]([^'"]+)/g)) {
    if (!['/', '/:secretPrefix'].includes(match[1])) expect(match.index).toBeLessThan(generic);
  }
});
function proxy() {
  const dns = vi.fn(), fetch = vi.fn();
  const context = vm.createContext({ URL, MCP_SECRET: 'reader', authenticate: createAuthenticate('reader'), resolveHostAndCheck: dns, fetch });
  vm.runInContext(source.slice(source.indexOf('async function handleProxyCall'), source.indexOf("app.post('/proxy'")), context);
  return { context, dns, fetch };
}
it.each(['https://api.openai.com/v1/models', 'https://attacker.invalid'])('authenticates before DNS or fetch for %s', async url => {
  const { context, dns, fetch } = proxy();
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await context.handleProxyCall({ params: {}, headers: {}, body: { url } }, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(dns).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it.each(['https://attacker.invalid', 'http://api.openai.com', 'https://sub.api.openai.com', 'https://api.openai.com:444', 'https://user@api.openai.com'])('blocks proxy target %s before DNS', async url => {
  const { context, dns, fetch } = proxy();
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await context.handleProxyCall({ params: {}, headers: { authorization: 'Bearer reader' }, body: { url } }, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(dns).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it.each([undefined, '0', '1'])('gates demo holdings with FINFLOW_DEMO=%s', async demo => {
  const context = vm.createContext({ process: { env: { FINFLOW_DEMO: demo } }, fetchSheetData: async () => ({ balances: [{ account: 'Live', balance: 999, class: 'Asset' }] }), getSnapTradeHoldings: async () => null });
  vm.runInContext(source.slice(source.indexOf('async function runTool'), source.indexOf('// Helper to format currency')), context);
  const result = await context.runTool('get_portfolio_allocation', {});
  expect(result.is_mock).toBe(demo === '1');
  if (demo === '1') expect(result.holdings.every(h => h.is_mock)).toBe(true);
  else expect(result.holdings).toEqual([]);
});
it('forwards an authenticated allowlisted request without following redirects', async () => {
  const { context, dns, fetch } = proxy();
  dns.mockResolvedValue(false);
  fetch.mockResolvedValue({ status: 200, headers: new Map([['cache-control', 'public'], ['pragma', 'cache']]), text: async () => 'ok' });
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn(), send: vi.fn() };
  await context.handleProxyCall({ params: {}, headers: { authorization: 'Bearer reader' }, body: { url: 'https://api.openai.com/v1/models', method: 'GET' } }, res);
  expect(dns).toHaveBeenCalledWith('api.openai.com');
  expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.objectContaining({ redirect: 'manual' }));
  expect(res.setHeader).not.toHaveBeenCalled();
  expect(res.send).toHaveBeenCalledWith('ok');
});
it('never combines demo positions with available live holdings', async () => {
  const context = vm.createContext({ process: { env: { FINFLOW_DEMO: '1' } }, fetchSheetData: async () => ({}), categorizeSecurity: () => ({}), getSnapTradeHoldings: async () => ({ accounts: [], positions: [{ symbol: { symbol: 'LIVE' }, value: 42 }] }) });
  vm.runInContext(source.slice(source.indexOf('async function runTool'), source.indexOf('// Helper to format currency')), context);
  const result = await context.runTool('get_portfolio_allocation', {});
  expect(result.is_mock).toBe(false);
  expect(result.holdings.map(h => h.ticker)).toEqual(['LIVE']);
  expect(result.total_investment_value).toBe(42);
});
