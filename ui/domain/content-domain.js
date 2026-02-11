(function(root) {
  'use strict';

  var CONTENT_TYPES = new Set([
    'suno-prompt',
    'song-info',
    'analysis',
    'concept',
    'inspiration',
    'mood',
    'genre'
  ]);

  function validateContentType(contentType) {
    var key = String(contentType || '');
    if (!CONTENT_TYPES.has(key)) {
      return { ok: false, error: 'Unsupported content type' };
    }
    return { ok: true, key: key };
  }

  function validateNonEmptyContent(content) {
    var value = String(content || '').trim();
    if (!value) {
      return { ok: false, error: 'Content is required' };
    }
    return { ok: true, value: value };
  }

  function validateAnalysisJsonContent(content) {
    var base = validateNonEmptyContent(content);
    if (!base.ok) return base;

    var parsed;
    try {
      parsed = JSON.parse(base.value);
    } catch (err) {
      return { ok: false, error: 'Please enter valid JSON format: ' + err.message };
    }

    if (!parsed.version || !parsed.duration || !parsed.bpm || !parsed.sections) {
      return { ok: false, error: 'Missing required fields (version, duration, bpm, sections)' };
    }

    return { ok: true, value: base.value, parsed: parsed };
  }

  var api = {
    validateContentType: validateContentType,
    validateNonEmptyContent: validateNonEmptyContent,
    validateAnalysisJsonContent: validateAnalysisJsonContent
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ContentDomain = api;
})(typeof window !== 'undefined' ? window : globalThis);
