import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createAuthenticate, requireSseSession, validateAuthConfig } from './auth.js';

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}
function request(type = 'bearer', credential = 'test-secret') {
  return {
    params: type === 'url-prefix' ? { secretPrefix: credential } : {},
    headers: type === 'bearer' ? { authorization: `Bearer ${credential}` } : {},
    query: { sessionId: 'test-session' },
  };
}
function authenticated(type, credential = 'test-secret') {
  const req = request(type, credential);
  const next = vi.fn();
  createAuthenticate(credential)(req, response(), next);
  expect(next).toHaveBeenCalledOnce();
  return req;
}

describe('startup authentication policy', () => {
  it.each([undefined, '', '0', 'true'])('refuses missing secrets with dev flag %s', devOpen => {
    expect(() => validateAuthConfig({ secret: '', devOpen, host: '127.0.0.1' })).toThrow('MCP_SECRET');
  });
  it.each([undefined, '0.0.0.0', '::', '::1', 'localhost', '192.168.1.2'])('refuses dev mode on host %s', host => {
    expect(() => validateAuthConfig({ secret: '', devOpen: '1', host })).toThrow('HOST=127.0.0.1');
  });
  it('permits explicit loopback open mode', () => {
    expect(validateAuthConfig({ secret: '', devOpen: '1', host: '127.0.0.1' })).toBe(true);
  });
  it('preserves authenticated startup and never disables configured authentication', () => {
    expect(validateAuthConfig({ secret: 'secret' })).toBe(false);
    expect(validateAuthConfig({ secret: 'secret', devOpen: '1', host: '127.0.0.1' })).toBe(false);
  });
});

describe('shared SSE and message authentication', () => {
  it.each(['missing', 'wrong-bearer', 'wrong-prefix'])('rejects %s credentials before session access', type => {
    const req = type === 'missing' ? request('none') : request(type === 'wrong-prefix' ? 'url-prefix' : 'bearer', 'wrong');
    const res = response();
    const next = vi.fn();
    createAuthenticate('test-secret')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it('fails closed without a secret unless explicitly enabled', () => {
    const res = response();
    const next = vi.fn();
    createAuthenticate('')(request('none'), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    const req = request('none');
    createAuthenticate('', true)(req, response(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.authPrincipal.type).toBe('dev-open');
  });
  it.each(['bearer', 'url-prefix'])('stores only a hash and credential type for %s', type => {
    const req = authenticated(type);
    expect(req.authPrincipal).toEqual({ type, credentialHash: createHash('sha256').update('test-secret').digest('hex') });
    expect(JSON.stringify(req.authPrincipal)).not.toContain('test-secret');
  });
  it.each(['bearer', 'url-prefix'])('accepts matching %s session credentials', type => {
    const req = authenticated(type);
    const stream = {};
    const sessions = new Map([['test-session', { response: stream, principal: authenticated(type).authPrincipal }]]);
    const next = vi.fn();
    requireSseSession(sessions)(req, response(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.sseResponse).toBe(stream);
  });
  it.each([
    ['bearer', 'url-prefix', 'test-secret'],
    ['url-prefix', 'bearer', 'test-secret'],
    ['bearer', 'bearer', 'another-secret'],
  ])('rejects session %s accessed via %s with %s', (ownerType, callerType, credential) => {
    const sessions = new Map([['test-session', { principal: authenticated(ownerType).authPrincipal }]]);
    const req = authenticated(callerType, credential);
    const res = response();
    const next = vi.fn();
    requireSseSession(sessions)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it.each([[undefined, 400], ['unknown', 404]])('handles session ID %s', (sessionId, status) => {
    const req = authenticated('bearer');
    req.query.sessionId = sessionId;
    const res = response();
    const next = vi.fn();
    requireSseSession(new Map())(req, res, next);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(next).not.toHaveBeenCalled();
  });
});
