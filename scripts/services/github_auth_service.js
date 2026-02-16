const https = require('https');
const { URLSearchParams } = require('url');

const DEFAULT_SCOPES = ['read:user', 'user:email'];
const GITHUB_AUTH_BASE = 'https://github.com/login/oauth';
const GITHUB_API_BASE = 'https://api.github.com';

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = { raw };
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ payload: parsed, headers: res.headers });
          return;
        }

        const message = parsed.error_description || parsed.message || parsed.error || `HTTP ${res.statusCode}`;
        const err = new Error(message);
        err.statusCode = res.statusCode;
        err.payload = parsed;
        reject(err);
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('GitHub auth request timed out'));
    });
    if (body) req.write(body);
    req.end();
  });
}

function buildAuthorizeUrl({ clientId, redirectUri, state, scopes = DEFAULT_SCOPES }) {
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('redirect_uri', redirectUri);
  params.set('scope', scopes.join(' '));
  params.set('state', state);
  return `${GITHUB_AUTH_BASE}/authorize?${params.toString()}`;
}

async function exchangeCodeForToken({ clientId, clientSecret, code, redirectUri }) {
  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);
  body.set('code', code);
  body.set('redirect_uri', redirectUri);

  const { payload } = await requestJson(
    `${GITHUB_AUTH_BASE}/access_token`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'AIMusicVideo-Agent'
      }
    },
    body.toString()
  );

  if (!payload.access_token) {
    throw new Error(payload.error_description || 'GitHub token exchange failed');
  }

  return {
    accessToken: payload.access_token,
    scope: payload.scope || ''
  };
}

async function fetchUserProfile(accessToken) {
  const { payload, headers } = await requestJson(
    `${GITHUB_API_BASE}/user`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'AIMusicVideo-Agent',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );

  const scopeHeader = headers['x-oauth-scopes'] || '';
  const scopes = String(scopeHeader)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    username: payload.login || '',
    id: payload.id || null,
    name: payload.name || '',
    scopes
  };
}

module.exports = {
  DEFAULT_SCOPES,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchUserProfile
};

