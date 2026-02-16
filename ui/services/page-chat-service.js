(function(root) {
  'use strict';

  function resolveServiceBase(opts) {
    if (opts && opts.serviceBase) return opts.serviceBase;
    if (root && root.ServiceBase) return root.ServiceBase;
    if (typeof require === 'function') {
      try {
        return require('./service-base.js');
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function normalizeError(payload, fallback) {
    if (payload && typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
    return fallback;
  }

  function createPageChatService(options) {
    var opts = options || {};
    var serviceBase = resolveServiceBase(opts);
    if (!serviceBase || !serviceBase.resolveHttpClient) {
      throw new Error('ServiceBase.resolveHttpClient is required');
    }

    var httpClient = serviceBase.resolveHttpClient(opts);

    async function getStatus(input) {
      var projectId = String((input && input.projectId) || '');
      var pageId = String((input && input.pageId) || 'index');
      var query = '?project=' + encodeURIComponent(projectId) + '&page=' + encodeURIComponent(pageId);
      var result = await httpClient.request('/api/page-chat/status' + query, { method: 'GET' });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: normalizeError(result.payload, 'Failed to load chat status') };
      }
      return { ok: true, data: result.payload };
    }

    async function openSession(input) {
      var projectId = String((input && input.projectId) || '');
      var pageId = String((input && input.pageId) || 'index');
      var url = String((input && input.url) || '');
      var result = await httpClient.request('/api/page-chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          pageId: pageId,
          url: url
        })
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: normalizeError(result.payload, 'Failed to open chat session') };
      }
      return { ok: true, data: result.payload };
    }

    async function loadSession(input) {
      var projectId = String((input && input.projectId) || '');
      var sessionId = String((input && input.sessionId) || '');
      var query = '?project=' + encodeURIComponent(projectId);
      var result = await httpClient.request('/api/page-chat/sessions/' + encodeURIComponent(sessionId) + query, {
        method: 'GET'
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: normalizeError(result.payload, 'Failed to load chat session') };
      }
      return { ok: true, data: result.payload };
    }

    async function sendMessage(input) {
      var projectId = String((input && input.projectId) || '');
      var sessionId = String((input && input.sessionId) || '');
      var message = String((input && input.message) || '');
      var pageState = (input && input.pageState) || {};
      var query = '?project=' + encodeURIComponent(projectId);
      var result = await httpClient.request('/api/page-chat/sessions/' + encodeURIComponent(sessionId) + '/messages' + query, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          message: message,
          pageState: pageState
        })
      });

      if (!result.response.ok || !result.payload.success) {
        return {
          ok: false,
          error: normalizeError(result.payload, 'Failed to send chat message'),
          code: result.payload && result.payload.code ? result.payload.code : ''
        };
      }
      return { ok: true, data: result.payload };
    }

    async function applyProposals(input) {
      var projectId = String((input && input.projectId) || '');
      var sessionId = String((input && input.sessionId) || '');
      var proposalIds = Array.isArray(input && input.proposalIds) ? input.proposalIds : [];
      var query = '?project=' + encodeURIComponent(projectId);
      var result = await httpClient.request('/api/page-chat/sessions/' + encodeURIComponent(sessionId) + '/apply' + query, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          proposalIds: proposalIds
        })
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: normalizeError(result.payload, 'Failed to apply proposals') };
      }
      return { ok: true, data: result.payload };
    }

    async function undoApply(input) {
      var projectId = String((input && input.projectId) || '');
      var sessionId = String((input && input.sessionId) || '');
      var applyId = String((input && input.applyId) || '');
      var query = '?project=' + encodeURIComponent(projectId);
      var result = await httpClient.request('/api/page-chat/sessions/' + encodeURIComponent(sessionId) + '/undo' + query, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          applyId: applyId
        })
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: normalizeError(result.payload, 'Failed to undo apply') };
      }
      return { ok: true, data: result.payload };
    }

    async function getGithubOAuthConfig() {
      var result = await httpClient.request('/api/session/github-oauth-config', { method: 'GET' });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: normalizeError(result.payload, 'Failed to load OAuth config') };
      }
      return { ok: true, data: result.payload };
    }

    async function setGithubOAuthConfig(input) {
      var clientId = String((input && input.clientId) || '');
      var clientSecret = String((input && input.clientSecret) || '');
      var clear = Boolean(input && input.clear);
      var result = await httpClient.request('/api/session/github-oauth-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId,
          clientSecret: clientSecret,
          clear: clear
        })
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: normalizeError(result.payload, 'Failed to update OAuth config') };
      }
      return { ok: true, data: result.payload };
    }

    async function getAiProviderStatus() {
      var result = await httpClient.request('/api/ai-provider/status', { method: 'GET' });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: normalizeError(result.payload, 'Failed to load AI provider status') };
      }
      return { ok: true, data: result.payload };
    }

    async function setActiveAiProvider(provider) {
      var result = await httpClient.request('/api/ai-provider/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider })
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: normalizeError(result.payload, 'Failed to set AI provider') };
      }
      return { ok: true, data: result.payload };
    }

    async function setAiProviderKey(provider, key) {
      var result = await httpClient.request('/api/ai-provider/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider, key: key || '' })
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: normalizeError(result.payload, 'Failed to save API key') };
      }
      return { ok: true, data: result.payload };
    }

    return {
      getStatus: getStatus,
      openSession: openSession,
      loadSession: loadSession,
      sendMessage: sendMessage,
      applyProposals: applyProposals,
      undoApply: undoApply,
      getGithubOAuthConfig: getGithubOAuthConfig,
      setGithubOAuthConfig: setGithubOAuthConfig,
      getAiProviderStatus: getAiProviderStatus,
      setActiveAiProvider: setActiveAiProvider,
      setAiProviderKey: setAiProviderKey
    };
  }

  var api = {
    createPageChatService: createPageChatService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.PageChatService = api;
})(typeof window !== 'undefined' ? window : globalThis);
