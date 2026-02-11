(function(root) {
  'use strict';

  function createContentFeature(options) {
    var opts = options || {};
    var contentService = opts.contentService;
    var contentDomain = opts.contentDomain || (root && root.ContentDomain ? root.ContentDomain : null);

    if (!contentService || !contentService.loadContent || !contentService.saveContent) {
      throw new Error('contentService with loadContent/saveContent is required');
    }

    function validateAnalysisJson(content) {
      if (contentDomain && contentDomain.validateAnalysisJsonContent) {
        return contentDomain.validateAnalysisJsonContent(content);
      }

      var text = String(content || '').trim();
      if (!text) {
        return { ok: false, error: 'Content is required' };
      }

      try {
        var parsed = JSON.parse(text);
        if (!parsed.version || !parsed.duration || !parsed.bpm || !parsed.sections) {
          return { ok: false, error: 'Missing required fields (version, duration, bpm, sections)' };
        }
        return { ok: true, value: text, parsed: parsed };
      } catch (err) {
        return { ok: false, error: 'Please enter valid JSON format: ' + err.message };
      }
    }

    async function saveContent(input) {
      var result = await contentService.saveContent(input || {});
      if (!result.ok) {
        return { ok: false, error: result.error || 'Save failed' };
      }
      return { ok: true, data: result.data || {} };
    }

    async function loadContent(input) {
      var result = await contentService.loadContent(input || {});
      if (!result.ok) {
        return { ok: false, error: result.error || 'Load failed' };
      }
      return { ok: true, data: result.data || {} };
    }

    async function loadContentBatch(config) {
      var projectId = String((config && config.projectId) || '');
      var contentTypes = Array.isArray(config && config.contentTypes) ? config.contentTypes : [];
      var output = {};

      for (var i = 0; i < contentTypes.length; i += 1) {
        var contentType = contentTypes[i];
        var result = await loadContent({ projectId: projectId, contentType: contentType });
        output[contentType] = result;
      }

      return output;
    }

    return {
      validateAnalysisJson: validateAnalysisJson,
      saveContent: saveContent,
      loadContent: loadContent,
      loadContentBatch: loadContentBatch
    };
  }

  var api = {
    createContentFeature: createContentFeature
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ContentFeature = api;
})(typeof window !== 'undefined' ? window : globalThis);
