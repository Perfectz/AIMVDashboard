(function(root) {
  'use strict';

  function createPipelineService(options) {
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

    async function getStatus(projectId) {
      var query = '?project=' + encodeURIComponent(String(projectId || ''));
      var result = await httpClient.request('/api/pipeline/status' + query, { method: 'GET' });
      return normalizeResult(result, 'Failed to load pipeline status');
    }

    async function run(action, projectId) {
      var result = await httpClient.request('/api/pipeline/' + encodeURIComponent(String(action || '')), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: String(projectId || '') })
      });
      return normalizeResult(result, 'Failed to run pipeline action');
    }

    return {
      getStatus: getStatus,
      run: run
    };
  }

  var api = {
    createPipelineService: createPipelineService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.PipelineService = api;
})(typeof window !== 'undefined' ? window : globalThis);
