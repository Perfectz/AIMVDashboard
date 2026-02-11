(function(root) {
  'use strict';

  var SUPPORTED_TYPES = {
    'suno-prompt': true,
    'song-info': true,
    'analysis': true,
    'concept': true,
    'inspiration': true,
    'mood': true,
    'genre': true
  };

  function resolveDependency(name, directValue) {
    if (directValue) return directValue;
    if (root && root[name]) return root[name];
    return null;
  }

  function createContentService(options) {
    var opts = options || {};
    var domain = resolveDependency('ContentDomain', opts.domain);
    var httpClientFactory = resolveDependency('HttpClient', opts.httpClientFactory);
    var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);

    if (!domain || !domain.validateContentType) {
      throw new Error('ContentDomain.validateContentType is required');
    }

    if (!httpClientFactory || !httpClientFactory.createHttpClient) {
      throw new Error('HttpClient.createHttpClient is required');
    }

    var httpClient = httpClientFactory.createHttpClient({ fetchImpl: fetchImpl });

    function ensureType(contentType) {
      var validation = domain.validateContentType(contentType);
      if (!validation.ok) {
        throw new Error(validation.error);
      }
      if (!SUPPORTED_TYPES[validation.key]) {
        throw new Error('Unsupported content type');
      }
      return validation.key;
    }

    async function saveContent(input) {
      var projectId = String((input && input.projectId) || '');
      var contentType = ensureType(input && input.contentType);
      var content = String((input && input.content) || '');

      var result = await httpClient.request('/api/save/' + contentType, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectId,
          content: content
        })
      });

      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Save failed' };
      }

      return { ok: true, data: result.payload };
    }

    async function loadContent(input) {
      var projectId = String((input && input.projectId) || '');
      var contentType = ensureType(input && input.contentType);
      var result = await httpClient.request('/api/load/' + contentType + '?project=' + encodeURIComponent(projectId), {
        method: 'GET'
      });

      if (!result.response.ok) {
        return { ok: false, error: result.payload.error || 'Load failed' };
      }

      return { ok: true, data: result.payload || {} };
    }

    return {
      saveContent: saveContent,
      loadContent: loadContent
    };
  }

  var api = {
    createContentService: createContentService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ContentService = api;
})(typeof window !== 'undefined' ? window : globalThis);
