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

  function toProjectQuery(projectId) {
    return projectId ? ('?project=' + encodeURIComponent(projectId)) : '';
  }

  function createReviewService(options) {
    var opts = options || {};
    var serviceBase = resolveServiceBase(opts);
    if (!serviceBase || !serviceBase.resolveHttpClient) {
      throw new Error('ServiceBase.resolveHttpClient is required');
    }
    var httpClient = serviceBase.resolveHttpClient(opts);

    async function loadPrevisMap(projectId) {
      var result = await httpClient.request('/api/storyboard/previs-map' + toProjectQuery(projectId), { method: 'GET' });
      if (!result.response.ok) {
        return { ok: false, error: result.payload.error || 'Failed to load previs map' };
      }
      return { ok: true, data: result.payload };
    }

    async function savePrevisMapEntry(input) {
      var payload = {
        project: String((input && input.projectId) || ''),
        entry: (input && input.entry) || {}
      };
      var shotId = encodeURIComponent(String((input && input.shotId) || ''));
      var result = await httpClient.request('/api/storyboard/previs-map/' + shotId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to save previs override' };
      }
      return { ok: true, data: result.payload };
    }

    async function resetPrevisMapEntry(input) {
      var shotId = encodeURIComponent(String((input && input.shotId) || ''));
      var result = await httpClient.request('/api/storyboard/previs-map/' + shotId + toProjectQuery(input && input.projectId), {
        method: 'DELETE'
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to reset previs override' };
      }
      return { ok: true, data: result.payload };
    }

    async function loadReviewSequence(projectId) {
      var result = await httpClient.request('/api/review/sequence' + toProjectQuery(projectId), { method: 'GET' });
      if (!result.response.ok) {
        return { ok: false, error: result.payload.error || 'Sequence file not found' };
      }
      return { ok: true, data: result.payload };
    }

    async function loadReviewMetadata(projectId) {
      var result = await httpClient.request('/api/load/review-metadata' + toProjectQuery(projectId), { method: 'GET' });
      if (!result.response.ok) {
        return { ok: false, error: result.payload.error || 'Failed to load review metadata' };
      }
      return { ok: true, data: result.payload };
    }

    async function saveReviewMetadata(input) {
      var payload = (input && input.payload) || {};
      var result = await httpClient.request('/api/save/review-metadata' + toProjectQuery(input && input.projectId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to save review metadata' };
      }
      return { ok: true, data: result.payload };
    }

    async function saveStoryboardSequence(input) {
      var payload = (input && input.payload) || {};
      var result = await httpClient.request('/api/storyboard/sequence' + toProjectQuery(input && input.projectId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to save storyboard sequence' };
      }
      return { ok: true, data: result.payload };
    }

    return {
      loadPrevisMap: loadPrevisMap,
      savePrevisMapEntry: savePrevisMapEntry,
      resetPrevisMapEntry: resetPrevisMapEntry,
      loadReviewSequence: loadReviewSequence,
      loadReviewMetadata: loadReviewMetadata,
      saveReviewMetadata: saveReviewMetadata,
      saveStoryboardSequence: saveStoryboardSequence
    };
  }

  var api = {
    createReviewService: createReviewService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ReviewService = api;
})(typeof window !== 'undefined' ? window : globalThis);
