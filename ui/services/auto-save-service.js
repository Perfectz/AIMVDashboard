(function(root) {
  'use strict';

  function createAutoSaveService(options) {
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

    async function saveContent(projectId, contentType, content) {
      var result = await httpClient.request('/api/save/' + encodeURIComponent(String(contentType || '')), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: String(projectId || ''), content: String(content || '') })
      });
      return normalizeResult(result, 'Save failed');
    }

    async function saveCanon(projectId, canonType, content) {
      var canonicalJson = String(content || '');
      JSON.parse(canonicalJson);
      var result = await httpClient.request('/api/save/canon/' + encodeURIComponent(String(canonType || '')) + '?project=' + encodeURIComponent(String(projectId || '')), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: canonicalJson })
      });
      return normalizeResult(result, 'Save failed');
    }

    return {
      saveContent: saveContent,
      saveCanon: saveCanon
    };
  }

  var api = {
    createAutoSaveService: createAutoSaveService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.AutoSaveService = api;
})(typeof window !== 'undefined' ? window : globalThis);
