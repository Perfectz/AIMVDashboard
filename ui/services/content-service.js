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

  function createContentService(options) {
    var opts = options || {};
    var serviceBase = resolveServiceBase(opts);
    if (!serviceBase || !serviceBase.resolveDependency || !serviceBase.resolveHttpClient) {
      throw new Error('ServiceBase.resolveDependency and ServiceBase.resolveHttpClient are required');
    }

    var domain = serviceBase.resolveDependency('ContentDomain', opts.domain);

    if (!domain || !domain.validateContentType) {
      throw new Error('ContentDomain.validateContentType is required');
    }
    var httpClient = serviceBase.resolveHttpClient(opts);

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
