/**
 * Session management service.
 * Extracted from serve_ui.js — Phase 4 architecture optimization.
 */

const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'amv_sid';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function createSessionService({ host, port }) {
  const sessionStore = new Map();

  function parseCookieHeader(headerValue = '') {
    const out = {};
    String(headerValue || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const idx = part.indexOf('=');
        if (idx <= 0) return;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) return;
        try {
          out[key] = decodeURIComponent(value);
        } catch {
          out[key] = value;
        }
      });
    return out;
  }

  function generateSessionId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function getRequestOrigin(req) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto = typeof forwardedProto === 'string' && forwardedProto.trim()
      ? forwardedProto.split(',')[0].trim()
      : 'http';
    const reqHost = req.headers.host || `${host}:${port}`;
    return `${proto}://${reqHost}`;
  }

  function getSession(req) {
    const cookies = parseCookieHeader(req.headers.cookie || '');
    const sessionId = cookies[SESSION_COOKIE_NAME];
    if (!sessionId) {
      return null;
    }
    const session = sessionStore.get(sessionId);
    if (!session) {
      return null;
    }
    if ((Date.now() - session.updatedAtMs) > SESSION_TTL_MS) {
      sessionStore.delete(sessionId);
      return null;
    }
    session.updatedAtMs = Date.now();
    return session;
  }

  function ensureSession(req, res) {
    const existing = getSession(req);
    if (existing) {
      return existing;
    }

    const sessionId = generateSessionId();
    const session = {
      id: sessionId,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      githubAuth: null,
      githubOAuthConfig: null,
      githubOAuthState: null,
      githubOAuthReturnTo: '/index.html'
    };
    sessionStore.set(sessionId, session);
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/`
    );
    return session;
  }

  function clearGitHubSessionAuth(session) {
    if (!session) return;
    session.githubAuth = null;
    session.githubOAuthState = null;
    session.githubOAuthReturnTo = '/index.html';
    session.updatedAtMs = Date.now();
  }

  function setGitHubOAuthConfig(session, config) {
    if (!session) return;
    const clientId = String(config && config.clientId || '').trim();
    const clientSecret = String(config && config.clientSecret || '').trim();
    if (!clientId || !clientSecret) {
      throw new Error('clientId and clientSecret are required');
    }
    session.githubOAuthConfig = {
      clientId,
      clientSecret,
      updatedAt: new Date().toISOString()
    };
    session.updatedAtMs = Date.now();
  }

  function clearGitHubOAuthConfig(session) {
    if (!session) return;
    session.githubOAuthConfig = null;
    session.updatedAtMs = Date.now();
  }

  function resolveGitHubOAuthClientId(session) {
    const sessionClientId = String(session?.githubOAuthConfig?.clientId || '').trim();
    if (sessionClientId) return sessionClientId;
    return String(process.env.GITHUB_CLIENT_ID || '').trim();
  }

  function resolveGitHubOAuthClientSecret(session) {
    const sessionClientSecret = String(session?.githubOAuthConfig?.clientSecret || '').trim();
    if (sessionClientSecret) return sessionClientSecret;
    return String(process.env.GITHUB_CLIENT_SECRET || '').trim();
  }

  function getGitHubOAuthConfigPayload(session) {
    const sessionClientId = String(session?.githubOAuthConfig?.clientId || '').trim();
    const sessionClientSecret = String(session?.githubOAuthConfig?.clientSecret || '').trim();
    const envClientId = String(process.env.GITHUB_CLIENT_ID || '').trim();
    const envClientSecret = String(process.env.GITHUB_CLIENT_SECRET || '').trim();
    const sessionConfigured = Boolean(sessionClientId && sessionClientSecret);
    const envConfigured = Boolean(envClientId && envClientSecret);
    const source = sessionConfigured ? 'session' : (envConfigured ? 'env' : 'none');
    const activeClientId = source === 'session' ? sessionClientId : (source === 'env' ? envClientId : '');

    function maskClientId(value) {
      const raw = String(value || '');
      if (raw.length <= 8) return raw ? '***' : '';
      return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
    }

    return {
      configured: source !== 'none',
      source,
      hasSessionConfig: sessionConfigured,
      hasEnvConfig: envConfigured,
      clientIdPreview: maskClientId(activeClientId)
    };
  }

  function getGitHubAuthPayload(session) {
    const auth = session && session.githubAuth ? session.githubAuth : null;
    return {
      connected: Boolean(auth && auth.accessToken),
      username: auth?.username || '',
      scopes: Array.isArray(auth?.scopes) ? auth.scopes : [],
      tokenSource: auth && auth.accessToken ? 'oauth_session' : 'none'
    };
  }

  function resolveGitHubOAuthRedirectUri(req) {
    const explicit = (process.env.GITHUB_OAUTH_REDIRECT_URI || '').trim();
    if (explicit) {
      return explicit;
    }
    return `${getRequestOrigin(req)}/api/auth/github/callback`;
  }

  function normalizeReturnToPath(value) {
    const fallback = '/index.html';
    const str = typeof value === 'string' ? value.trim() : '';
    if (!str) return fallback;
    if (!str.startsWith('/')) return fallback;
    if (str.startsWith('//')) return fallback;
    return str;
  }

  function appendQueryParam(urlPath, key, value) {
    const base = String(urlPath || '/index.html');
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}${encodeURIComponent(key)}=${encodeURIComponent(String(value || ''))}`;
  }

  // Session cleanup interval
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessionStore.entries()) {
      if (!session || (now - session.updatedAtMs) > SESSION_TTL_MS) {
        sessionStore.delete(sessionId);
      }
    }
  }, 10 * 60 * 1000);
  cleanupInterval.unref();

  return {
    parseCookieHeader,
    generateSessionId,
    getRequestOrigin,
    getSession,
    ensureSession,
    clearGitHubSessionAuth,
    getGitHubAuthPayload,
    setGitHubOAuthConfig,
    clearGitHubOAuthConfig,
    resolveGitHubOAuthClientId,
    resolveGitHubOAuthClientSecret,
    getGitHubOAuthConfigPayload,
    resolveGitHubOAuthRedirectUri,
    normalizeReturnToPath,
    appendQueryParam,
    SESSION_COOKIE_NAME,
    SESSION_TTL_MS
  };
}

module.exports = { createSessionService };
