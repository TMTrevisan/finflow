import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionStore, wipeLegacySecrets } from './storage';

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}
afterEach(() => vi.unstubAllGlobals());
describe('credential storage', () => {
  it('keeps credentials in session storage only and supports removal', () => {
    const local = storage();
    const session = storage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    sessionStore.setItem('finflow_mcp_secret', 'session-token');
    expect(session.getItem('finflow_mcp_secret')).toBe('session-token');
    expect(local.getItem('finflow_mcp_secret')).toBeNull();
    sessionStore.removeItem('finflow_mcp_secret');
    expect(sessionStore.getItem('finflow_mcp_secret')).toBeNull();
  });
  it('falls back to memory when session storage is blocked', () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    sessionStore.setItem('fallback-key', 'token');
    expect(sessionStore.getItem('fallback-key')).toBe('token');
    sessionStore.removeItem('fallback-key');
    expect(sessionStore.getItem('fallback-key')).toBeNull();
  });
  it('wipes all legacy secrets without removing preferences or session credentials', () => {
    const local = storage();
    const session = storage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    const keys = ['gemini_key', 'openai_key', 'claude_key', 'deepseek_key', 'mcp_secret', 'snaptrade_user_secret', 'snaptrade_consumer_key'];
    keys.forEach(key => local.setItem(`finflow_${key}`, 'legacy-secret'));
    local.setItem('finflow_ai_provider', 'openai');
    local.setItem('finflow_mcp_url', 'http://localhost:3001');
    session.setItem('finflow_mcp_secret', 'new-token');
    wipeLegacySecrets();
    wipeLegacySecrets();
    keys.forEach(key => expect(local.getItem(`finflow_${key}`)).toBeNull());
    expect(local.getItem('finflow_ai_provider')).toBe('openai');
    expect(local.getItem('finflow_mcp_url')).toBe('http://localhost:3001');
    expect(session.getItem('finflow_mcp_secret')).toBe('new-token');
  });
});
