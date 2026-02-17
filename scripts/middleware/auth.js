/**
 * Authentication middleware
 *
 * Provides login/logout routes and session-based auth middleware.
 * Can be disabled via AUTH_ENABLED=false environment variable for local dev.
 */

function createAuthMiddleware({ databaseService, sendJSON, jsonBody, MAX_BODY_SIZE }) {
  const AUTH_ENABLED = String(process.env.AUTH_ENABLED || '').trim().toLowerCase() !== 'false';
  const COOKIE_NAME = 'aimv_session';

  function parseCookies(req) {
    const cookies = {};
    const header = req.headers.cookie || '';
    header.split(';').forEach((part) => {
      const [key, ...rest] = part.trim().split('=');
      if (key) cookies[key.trim()] = rest.join('=').trim();
    });
    return cookies;
  }

  function setSessionCookie(res, sessionId) {
    const secure = process.env.HTTPS_ENABLED === 'true' ? '; Secure' : '';
    res.setHeader('Set-Cookie',
      `${COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}${secure}`
    );
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie',
      `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
    );
  }

  /**
   * Middleware that checks authentication for protected routes.
   * Skips auth for: login page, static assets, health check
   */
  function requireAuth(req, res) {
    if (!AUTH_ENABLED) {
      req.user = { id: 'local', username: 'local', displayName: 'Local User', role: 'admin' };
      return true;
    }

    const url = String(req.url || '').split('?')[0];

    // Public routes that don't require auth
    const publicRoutes = [
      '/api/auth/login',
      '/api/auth/status',
      '/health',
      '/login.html'
    ];
    const publicPrefixes = [
      '/styles/',
      '/modules/',
      '/services/',
      '/domain/',
      '/features/',
      '/controllers/',
      '/fonts/'
    ];

    if (publicRoutes.includes(url)) return true;
    if (publicPrefixes.some((p) => url.startsWith(p))) return true;
    if (url.match(/\.(css|js|png|jpg|ico|woff2?|svg)$/)) return true;

    const cookies = parseCookies(req);
    const sessionId = cookies[COOKIE_NAME];
    const session = databaseService.getSession(sessionId);

    if (!session) {
      // For API routes, return 401 JSON
      if (url.startsWith('/api/')) {
        sendJSON(res, 401, { success: false, error: 'Authentication required' });
        return false;
      }
      // For page routes, redirect to login
      res.writeHead(302, { Location: '/login.html' });
      res.end();
      return false;
    }

    req.user = session;
    return true;
  }

  /**
   * Register auth routes (login, logout, register, status)
   */
  function registerAuthApiRoutes(router, wrapAsync) {
    router.post('/api/auth/login', wrapAsync(async (req, res) => {
      const data = await jsonBody(req, MAX_BODY_SIZE);
      const username = String(data.username || '').trim();
      const password = String(data.password || '');

      if (!username || !password) {
        sendJSON(res, 400, { success: false, error: 'Username and password are required' });
        return;
      }

      const user = databaseService.authenticateUser(username, password);
      if (!user) {
        sendJSON(res, 401, { success: false, error: 'Invalid username or password' });
        return;
      }

      const sessionId = databaseService.createSession(user.id);
      setSessionCookie(res, sessionId);
      databaseService.logAudit(user.id, 'login', 'auth', { username });

      sendJSON(res, 200, {
        success: true,
        user: { username: user.username, displayName: user.displayName, role: user.role }
      });
    }));

    router.post('/api/auth/logout', wrapAsync(async (req, res) => {
      const cookies = parseCookies(req);
      const sessionId = cookies[COOKIE_NAME];
      if (sessionId) databaseService.deleteSession(sessionId);
      clearSessionCookie(res);
      sendJSON(res, 200, { success: true });
    }));

    router.get('/api/auth/status', (_req, res) => {
      if (!AUTH_ENABLED) {
        sendJSON(res, 200, {
          success: true,
          authenticated: true,
          authEnabled: false,
          user: { username: 'local', displayName: 'Local User', role: 'admin' }
        });
        return;
      }

      const cookies = parseCookies(_req);
      const sessionId = cookies[COOKIE_NAME];
      const session = databaseService.getSession(sessionId);

      sendJSON(res, 200, {
        success: true,
        authenticated: Boolean(session),
        authEnabled: true,
        user: session ? { username: session.username, displayName: session.displayName, role: session.role } : null
      });
    });

    router.post('/api/auth/register', wrapAsync(async (req, res) => {
      const data = await jsonBody(req, MAX_BODY_SIZE);
      const username = String(data.username || '').trim();
      const password = String(data.password || '');
      const displayName = String(data.displayName || '').trim() || username;

      if (!username || !password) {
        sendJSON(res, 400, { success: false, error: 'Username and password are required' });
        return;
      }
      if (password.length < 6) {
        sendJSON(res, 400, { success: false, error: 'Password must be at least 6 characters' });
        return;
      }
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
        sendJSON(res, 400, { success: false, error: 'Username must be 3-30 alphanumeric characters' });
        return;
      }

      try {
        const user = databaseService.createUser(username, password, displayName, 'editor');
        const sessionId = databaseService.createSession(user.id);
        setSessionCookie(res, sessionId);
        databaseService.logAudit(user.id, 'register', 'auth', { username });

        sendJSON(res, 201, {
          success: true,
          user: { username: user.username, displayName: user.displayName, role: user.role }
        });
      } catch (err) {
        sendJSON(res, 409, { success: false, error: err.message });
      }
    }));
  }

  return {
    requireAuth,
    registerAuthApiRoutes,
    AUTH_ENABLED
  };
}

module.exports = { createAuthMiddleware };
