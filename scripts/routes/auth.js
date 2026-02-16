const crypto = require('crypto');

function registerAuthRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    jsonBody,
    MAX_BODY_SIZE,
    ensureSession,
    getGitHubAuthPayload,
    getGitHubOAuthConfigPayload,
    normalizeReturnToPath,
    resolveGitHubOAuthRedirectUri,
    resolveGitHubOAuthClientId,
    resolveGitHubOAuthClientSecret,
    buildAuthorizeUrl,
    exchangeCodeForToken,
    fetchUserProfile,
    clearGitHubSessionAuth,
    setGitHubOAuthConfig,
    clearGitHubOAuthConfig,
    appendQueryParam,
    corsHeadersForRequest
  } = ctx;

  router.get('/api/session/github-oauth-config', (req, res) => {
    const session = ensureSession(req, res);
    sendJSON(res, 200, {
      success: true,
      ...getGitHubOAuthConfigPayload(session)
    });
  });

  router.post('/api/session/github-oauth-config', wrapAsync(async (req, res) => {
    const session = ensureSession(req, res);
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const clear = payload && payload.clear === true;

    if (clear) {
      clearGitHubOAuthConfig(session);
      sendJSON(res, 200, {
        success: true,
        message: 'Session OAuth config cleared',
        ...getGitHubOAuthConfigPayload(session)
      });
      return;
    }

    const clientId = String(payload && payload.clientId || '').trim();
    const clientSecret = String(payload && payload.clientSecret || '').trim();
    if (!clientId || !clientSecret) {
      sendJSON(res, 400, {
        success: false,
        error: 'clientId and clientSecret are required'
      });
      return;
    }

    setGitHubOAuthConfig(session, { clientId, clientSecret });
    sendJSON(res, 200, {
      success: true,
      message: 'Session OAuth config updated',
      ...getGitHubOAuthConfigPayload(session)
    });
  }));

  router.get('/api/auth/github/status', (req, res) => {
    const session = ensureSession(req, res);
    sendJSON(res, 200, getGitHubAuthPayload(session));
  });

  router.get('/api/auth/github/start', wrapAsync(async (req, res) => {
    const session = ensureSession(req, res);
    const clientId = resolveGitHubOAuthClientId(session);
    if (!clientId) {
      const err = new Error('GITHUB_CLIENT_ID is not configured');
      err.statusCode = 500;
      throw err;
    }

    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = resolveGitHubOAuthRedirectUri(req);
    const returnTo = normalizeReturnToPath((req.query && req.query.returnTo) || '/index.html');
    session.githubOAuthState = state;
    session.githubOAuthReturnTo = returnTo;
    session.updatedAtMs = Date.now();

    const authorizeUrl = buildAuthorizeUrl({ clientId, redirectUri, state });
    const headers = { Location: authorizeUrl };
    Object.assign(headers, corsHeadersForRequest(req));
    res.writeHead(302, headers);
    res.end();
  }));

  router.get('/api/auth/github/callback', wrapAsync(async (req, res) => {
    const session = ensureSession(req, res);
    const expectedState = session.githubOAuthState || '';
    const returnTo = normalizeReturnToPath(session.githubOAuthReturnTo || '/index.html');
    const code = req.urlObj.searchParams.get('code') || '';
    const state = req.urlObj.searchParams.get('state') || '';
    const oauthError = req.urlObj.searchParams.get('error') || '';

    const redirectWithStatus = (statusValue, message = '') => {
      let location = appendQueryParam(returnTo, 'gh_oauth', statusValue);
      if (message) {
        location = appendQueryParam(location, 'gh_oauth_message', message);
      }
      const headers = { Location: location };
      Object.assign(headers, corsHeadersForRequest(req));
      res.writeHead(302, headers);
      res.end();
    };

    if (oauthError) {
      clearGitHubSessionAuth(session);
      redirectWithStatus('error', oauthError);
      return;
    }

    if (!code || !state || !expectedState || state !== expectedState) {
      clearGitHubSessionAuth(session);
      redirectWithStatus('error', 'invalid_state');
      return;
    }

    const clientId = resolveGitHubOAuthClientId(session);
    const clientSecret = resolveGitHubOAuthClientSecret(session);
    if (!clientId || !clientSecret) {
      clearGitHubSessionAuth(session);
      redirectWithStatus('error', 'missing_github_client_credentials');
      return;
    }

    try {
      const redirectUri = resolveGitHubOAuthRedirectUri(req);
      const tokenResult = await exchangeCodeForToken({
        code,
        clientId,
        clientSecret,
        redirectUri
      });
      const profile = await fetchUserProfile(tokenResult.access_token);
      session.githubAuth = {
        accessToken: tokenResult.access_token,
        scope: tokenResult.scope || '',
        tokenType: tokenResult.token_type || 'bearer',
        username: profile?.login || '',
        userId: profile?.id || null,
        scopes: String(tokenResult.scope || '').split(',').map((s) => s.trim()).filter(Boolean),
        connectedAt: new Date().toISOString()
      };
      session.githubOAuthState = null;
      session.githubOAuthReturnTo = '/index.html';
      session.updatedAtMs = Date.now();
      redirectWithStatus('ok');
    } catch (authErr) {
      clearGitHubSessionAuth(session);
      redirectWithStatus('error', authErr.message || 'oauth_failed');
    }
  }));

  router.post('/api/auth/github/logout', (req, res) => {
    const session = ensureSession(req, res);
    clearGitHubSessionAuth(session);
    sendJSON(res, 200, {
      success: true,
      ...getGitHubAuthPayload(session)
    });
  });
}

module.exports = {
  registerAuthRoutes
};
