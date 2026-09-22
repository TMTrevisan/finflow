import { createHash } from 'node:crypto';

export function validateAuthConfig({ secret, devOpen, host }) {
  if (devOpen === '1' && host !== '127.0.0.1') {
    throw new Error('FINFLOW_DEV_OPEN=1 requires HOST=127.0.0.1. Refusing to listen.');
  }
  if (secret) return false;
  if (devOpen !== '1') {
    throw new Error('MCP_SECRET is required. Refusing to listen. For local development only, set FINFLOW_DEV_OPEN=1 and HOST=127.0.0.1.');
  }
  return true;
}

function principal(type, credential) {
  return { type, credentialHash: createHash('sha256').update(credential).digest('hex') };
}

export function createAuthenticate(secret, openMode = false) {
  return function authenticate(req, res, next) {
    const { secretPrefix } = req.params;
    if (secretPrefix) {
      if (secret && secretPrefix === secret) {
        req.authPrincipal = principal('url-prefix', secretPrefix);
        return next();
      }
      return res.status(401).json({ error: 'Unauthorized. Invalid secret prefix in URL.' });
    }
    if (!secret) {
      if (!openMode) return res.status(401).json({ error: 'Unauthorized. MCP_SECRET is not configured.' });
      req.authPrincipal = principal('dev-open', '');
      return next();
    }
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '').trim();
    if (token !== secret) {
      return res.status(401).json({ error: 'Unauthorized. Provide a valid Bearer token.' });
    }
    req.authPrincipal = principal('bearer', token);
    next();
  };
}

export function requireSseSession(sessions) {
  return function (req, res, next) {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId query parameter.' });
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Active SSE connection session not found.' });
    const presented = req.authPrincipal;
    if (!presented || presented.type !== session.principal.type ||
        presented.credentialHash !== session.principal.credentialHash) {
      return res.status(403).json({ error: 'Unauthorized. SSE session credential mismatch.' });
    }
    req.sseResponse = session.response;
    next();
  };
}
