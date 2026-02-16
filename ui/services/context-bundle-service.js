(function(root) {
  'use strict';

  function createContextBundleService(options) {
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

    async function loadPreview(projectId) {
      var result = await httpClient.request('/api/export/context-bundle?project=' + encodeURIComponent(String(projectId || '')), {
        method: 'GET'
      });
      return normalizeResult(result, 'Failed to load context bundle preview');
    }

    async function exportBundle(projectId, includePromptTemplates) {
      var payload = {
        project: String(projectId || ''),
        includePromptTemplates: includePromptTemplates !== false
      };
      var result = await httpClient.request('/api/export/context-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return normalizeResult(result, 'Failed to export context bundle');
    }

    return {
      loadPreview: loadPreview,
      exportBundle: exportBundle
    };
  }

  var api = {
    createContextBundleService: createContextBundleService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ContextBundleService = api;
})(typeof window !== 'undefined' ? window : globalThis);
