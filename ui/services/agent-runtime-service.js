(function(root) {
  'use strict';

  function createAgentRuntimeService(options) {
    var opts = options || {};
    var base = root.ServiceBase;
    if (!base || !base.resolveHttpClient) {
      throw new Error('ServiceBase.resolveHttpClient is required');
    }
    var httpClient = base.resolveHttpClient(opts);

    function normalizeResult(result, fallbackMessage) {
      var payload = result && result.payload ? result.payload : {};
      var response = result && result.response ? result.response : { ok: false, status: 0 };
      var ok = Boolean(response.ok && payload && payload.success !== false);
      return {
        ok: ok,
        data: payload,
        error: ok ? '' : (payload.error || fallbackMessage || 'Request failed'),
        code: payload.code || (ok ? '' : 'SERVER_ERROR'),
        status: response.status || (ok ? 200 : 500)
      };
    }

    function createRunEventsSource(runId) {
      var id = String(runId || '').trim();
      if (!id) throw new Error('runId is required');
      return new EventSource('/api/agents/prompt-runs/' + encodeURIComponent(id) + '/events');
    }

    async function getGitHubStatus() {
      var result = await httpClient.request('/api/auth/github/status', { method: 'GET' });
      return normalizeResult(result, 'Failed to fetch GitHub auth status');
    }

    async function logoutGitHub() {
      var result = await httpClient.request('/api/auth/github/logout', { method: 'POST' });
      return normalizeResult(result, 'Failed to logout GitHub OAuth');
    }

    async function getRun(runId) {
      var id = String(runId || '').trim();
      if (!id) return { ok: false, error: 'runId is required', code: 'INVALID_INPUT', status: 400 };
      var result = await httpClient.request('/api/agents/prompt-runs/' + encodeURIComponent(id), { method: 'GET' });
      return normalizeResult(result, 'Failed to fetch agent run state');
    }

    async function startRun(payload) {
      var result = await httpClient.request('/api/agents/prompt-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return normalizeResult(result, 'Failed to start agent run');
    }

    async function cancelRun(runId) {
      var id = String(runId || '').trim();
      if (!id) return { ok: false, error: 'runId is required', code: 'INVALID_INPUT', status: 400 };
      var result = await httpClient.request('/api/agents/prompt-runs/' + encodeURIComponent(id) + '/cancel', {
        method: 'POST'
      });
      return normalizeResult(result, 'Failed to cancel agent run');
    }

    async function revertRun(runId) {
      var id = String(runId || '').trim();
      if (!id) return { ok: false, error: 'runId is required', code: 'INVALID_INPUT', status: 400 };
      var result = await httpClient.request('/api/agents/prompt-runs/' + encodeURIComponent(id) + '/revert', {
        method: 'POST'
      });
      return normalizeResult(result, 'Failed to revert agent run');
    }

    async function getAiProviderStatus() {
      var result = await httpClient.request('/api/ai-provider/status', { method: 'GET' });
      return normalizeResult(result, 'Failed to load AI provider status');
    }

    async function setActiveAiProvider(provider) {
      var result = await httpClient.request('/api/ai-provider/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: String(provider || '') })
      });
      return normalizeResult(result, 'Failed to update active AI provider');
    }

    async function saveAiProviderKey(provider, key) {
      var result = await httpClient.request('/api/ai-provider/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: String(provider || ''), key: String(key || '') })
      });
      return normalizeResult(result, 'Failed to save AI provider key');
    }

    return {
      createRunEventsSource: createRunEventsSource,
      getGitHubStatus: getGitHubStatus,
      logoutGitHub: logoutGitHub,
      getRun: getRun,
      startRun: startRun,
      cancelRun: cancelRun,
      revertRun: revertRun,
      getAiProviderStatus: getAiProviderStatus,
      setActiveAiProvider: setActiveAiProvider,
      saveAiProviderKey: saveAiProviderKey
    };
  }

  var api = {
    createAgentRuntimeService: createAgentRuntimeService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.AgentRuntimeService = api;
})(typeof window !== 'undefined' ? window : globalThis);
