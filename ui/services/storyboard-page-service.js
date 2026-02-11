(function(root) {
  'use strict';

  function resolveDependency(name, directValue) {
    if (directValue) return directValue;
    if (root && root[name]) return root[name];
    return null;
  }

  function createStoryboardPageService(options) {
    var opts = options || {};
    var httpClientFactory = resolveDependency('HttpClient', opts.httpClientFactory);
    var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);

    if (!httpClientFactory || !httpClientFactory.createHttpClient) {
      throw new Error('HttpClient.createHttpClient is required');
    }

    var httpClient = httpClientFactory.createHttpClient({ fetchImpl: fetchImpl });

    async function loadAssetManifest(projectId) {
      var projectParam = projectId ? '?project=' + encodeURIComponent(projectId) : '';
      var result = await httpClient.request('/projects/' + encodeURIComponent(projectId || '') + '/bible/asset_manifest.json' + projectParam, {
        method: 'GET'
      });
      if (!result.response.ok) {
        return { ok: false, error: result.payload.error || 'Asset manifest not found' };
      }
      return { ok: true, data: result.payload || {} };
    }

    async function loadContextBundlePreview(projectId) {
      var result = await httpClient.request('/api/export/context-bundle?project=' + encodeURIComponent(projectId || ''), {
        method: 'GET'
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to generate context bundle' };
      }
      return { ok: true, data: result.payload.bundle || null };
    }

    async function uploadMusic(input) {
      var projectId = String((input && input.projectId) || '');
      var file = input && input.file;
      var formData = new FormData();
      formData.append('file', file);
      var projectParam = projectId ? '?project=' + encodeURIComponent(projectId) : '';
      var result = await httpClient.request('/api/upload/music' + projectParam, {
        method: 'POST',
        body: formData
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Upload failed' };
      }
      return { ok: true, data: result.payload };
    }

    async function saveReadinessReport(input) {
      var projectId = String((input && input.projectId) || '');
      var payload = (input && input.payload) || {};
      var result = await httpClient.request('/api/storyboard/readiness-report?project=' + encodeURIComponent(projectId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to save readiness report' };
      }
      return { ok: true, data: result.payload };
    }

    async function loadCanonScript(projectId) {
      var projectParam = projectId ? '?project=' + encodeURIComponent(projectId) : '';
      var result = await httpClient.request('/api/load/canon/script' + projectParam, {
        method: 'GET'
      });
      if (!result.response.ok) {
        return { ok: false, error: result.payload.error || 'Failed to load script' };
      }
      return { ok: true, data: result.payload || {} };
    }

    async function exportContextBundle(input) {
      var projectId = String((input && input.projectId) || '');
      var includePromptTemplates = (input && input.includePromptTemplates) !== false;
      var result = await httpClient.request('/api/export/context-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectId,
          includePromptTemplates: includePromptTemplates
        })
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to export context bundle' };
      }
      return { ok: true, data: result.payload.bundle || null };
    }

    return {
      loadAssetManifest: loadAssetManifest,
      loadContextBundlePreview: loadContextBundlePreview,
      uploadMusic: uploadMusic,
      saveReadinessReport: saveReadinessReport,
      loadCanonScript: loadCanonScript,
      exportContextBundle: exportContextBundle
    };
  }

  var api = {
    createStoryboardPageService: createStoryboardPageService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.StoryboardPageService = api;
})(typeof window !== 'undefined' ? window : globalThis);
