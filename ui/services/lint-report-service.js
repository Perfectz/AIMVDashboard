(function(root) {
  'use strict';

  function createLintReportService(options) {
    var opts = options || {};
    var base = root.ServiceBase;
    if (!base || !base.resolveHttpClient) {
      throw new Error('ServiceBase.resolveHttpClient is required');
    }
    var httpClient = base.resolveHttpClient(opts);

    function normalizeResult(result, fallbackMessage) {
      var payload = result && result.payload ? result.payload : {};
      var response = result && result.response ? result.response : { ok: false, status: 0 };
      if (response.ok) {
        return { ok: true, data: payload, status: response.status || 200 };
      }
      return {
        ok: false,
        error: (payload && payload.error) || fallbackMessage || 'Request failed',
        code: (payload && payload.code) || 'SERVER_ERROR',
        status: response.status || 500,
        data: payload
      };
    }

    async function loadLintReport(projectId) {
      var query = projectId ? ('?project=' + encodeURIComponent(String(projectId))) : '';
      var result = await httpClient.request('/lint/report.json' + query, { method: 'GET' });
      return normalizeResult(result, 'Failed to load lint report');
    }

    async function loadPromptsIndex(projectId) {
      var query = projectId ? ('?project=' + encodeURIComponent(String(projectId))) : '';
      var result = await httpClient.request('/prompts_index.json' + query, { method: 'GET' });
      return normalizeResult(result, 'Failed to load prompts index');
    }

    return {
      loadLintReport: loadLintReport,
      loadPromptsIndex: loadPromptsIndex
    };
  }

  var api = {
    createLintReportService: createLintReportService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.LintReportService = api;
})(typeof window !== 'undefined' ? window : globalThis);
