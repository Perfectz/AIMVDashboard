(function(root) {
  'use strict';

  function createGenerationJobsService(options) {
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

    function createJobEventsSource(jobId) {
      var id = String(jobId || '').trim();
      if (!id) {
        throw new Error('jobId is required');
      }
      return new EventSource('/api/generation-jobs/' + encodeURIComponent(id) + '/events');
    }

    async function startJob(payload) {
      var result = await httpClient.request('/api/generation-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return normalizeResult(result, 'Failed to start generation job');
    }

    async function getJob(jobId) {
      var id = String(jobId || '').trim();
      if (!id) return { ok: false, error: 'jobId is required', code: 'INVALID_INPUT', status: 400 };
      var result = await httpClient.request('/api/generation-jobs/' + encodeURIComponent(id), { method: 'GET' });
      return normalizeResult(result, 'Failed to fetch generation job state');
    }

    async function listJobs(query) {
      var params = new URLSearchParams();
      var input = query || {};
      if (input.project) params.set('project', String(input.project));
      if (input.projectId) params.set('projectId', String(input.projectId));
      if (input.type) params.set('type', String(input.type));
      if (input.shotId) params.set('shotId', String(input.shotId));
      if (input.variation) params.set('variation', String(input.variation));
      if (input.status) params.set('status', String(input.status));
      if (input.limit !== undefined && input.limit !== null) params.set('limit', String(input.limit));

      var result = await httpClient.request('/api/generation-jobs?' + params.toString(), { method: 'GET' });
      return normalizeResult(result, 'Failed to load generation jobs');
    }

    async function getMetrics(projectId, limit) {
      var params = new URLSearchParams();
      if (projectId) params.set('project', String(projectId));
      if (limit !== undefined && limit !== null) params.set('limit', String(limit));
      var result = await httpClient.request('/api/generation-jobs/metrics?' + params.toString(), { method: 'GET' });
      return normalizeResult(result, 'Failed to load generation metrics');
    }

    async function cancelJob(jobId) {
      var id = String(jobId || '').trim();
      if (!id) return { ok: false, error: 'jobId is required', code: 'INVALID_INPUT', status: 400 };
      var result = await httpClient.request('/api/generation-jobs/' + encodeURIComponent(id) + '/cancel', { method: 'POST' });
      return normalizeResult(result, 'Failed to cancel generation job');
    }

    async function retryJob(jobId, payload) {
      var id = String(jobId || '').trim();
      if (!id) return { ok: false, error: 'jobId is required', code: 'INVALID_INPUT', status: 400 };
      var result = await httpClient.request('/api/generation-jobs/' + encodeURIComponent(id) + '/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return normalizeResult(result, 'Failed to retry generation job');
    }

    return {
      createJobEventsSource: createJobEventsSource,
      startJob: startJob,
      getJob: getJob,
      listJobs: listJobs,
      getMetrics: getMetrics,
      cancelJob: cancelJob,
      retryJob: retryJob
    };
  }

  var api = {
    createGenerationJobsService: createGenerationJobsService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.GenerationJobsService = api;
})(typeof window !== 'undefined' ? window : globalThis);
