const assert = require('assert');
const { buildAuthorizeUrl } = require('../../scripts/services/github_auth_service');

function run() {
  const url = buildAuthorizeUrl({
    clientId: 'abc123',
    redirectUri: 'http://127.0.0.1:8000/api/auth/github/callback',
    state: 'state-token',
    scopes: ['read:user', 'user:email']
  });

  assert.ok(url.startsWith('https://github.com/login/oauth/authorize?'));
  assert.ok(url.includes('client_id=abc123'));
  assert.ok(url.includes('state=state-token'));
  assert.ok(url.includes(encodeURIComponent('http://127.0.0.1:8000/api/auth/github/callback')));
  assert.ok(url.includes('scope=read%3Auser+user%3Aemail'));

  console.log('github-auth-service.test.js passed');
}

run();
