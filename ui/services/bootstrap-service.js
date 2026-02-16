(function(root) {
  'use strict';

  function createBootstrapService(options) {
    var opts = options || {};
    var base = root.ServiceBase;
    if (!base || !base.resolveHttpClient) {
      throw new Error('ServiceBase.resolveHttpClient is required');
    }
    var httpClient = base.resolveHttpClient(opts);

    function normalizeResult(result, fallbackMessage) {
      var payload = result && result.payload ? result.payload : {};
      var response = result && result.response ? result.response : { ok: false, status: 0 };
      if (response.ok && payload && payload.success !== false) {
        return { ok: true, data: payload, status: response.status || 200 };
      }
      return {
        ok: false,
        error: payload.error || fallbackMessage || 'Request failed',
        code: payload.code || 'SERVER_ERROR',
        status: response.status || 500,
        data: payload
      };
    }

    async function loadBootstrap(input) {
      var request = input || {};
      var params = new URLSearchParams();
      var projectId = String(request.projectId || request.project || '').trim();
      var pageId = String(request.pageId || request.page || '').trim();
      if (projectId) params.set('project', projectId);
      if (pageId) params.set('page', pageId);

      var query = params.toString();
      var result = await httpClient.request('/api/app/bootstrap' + (query ? ('?' + query) : ''), { method: 'GET' });
      return normalizeResult(result, 'Failed to load app bootstrap data');
    }

    return {
      loadBootstrap: loadBootstrap
    };
  }

  var api = {
    createBootstrapService: createBootstrapService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.BootstrapService = api;
})(typeof window !== 'undefined' ? window : globalThis);
