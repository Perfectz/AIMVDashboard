(function(root) {
  'use strict';

  var MAX_VIDEO_BYTES = 500 * 1024 * 1024;
  var VIDEO_EXTENSION_PATTERN = /\.(mp4|mov)$/i;
  var VARIATION_PATTERN = /^[A-D]$/;
  var SHOT_ID_PATTERN = /^SHOT_[A-Z0-9_]+$/i;

  function validateKlingVideoUpload(input) {
    if (!input || !input.file) {
      return { ok: false, error: 'No file selected' };
    }

    var file = input.file;
    var shotId = String(input.shotId || '');
    var variation = String(input.variation || '').toUpperCase();

    if (!VIDEO_EXTENSION_PATTERN.test(String(file.name || ''))) {
      return { ok: false, error: 'Please upload MP4 or MOV' };
    }

    if (Number(file.size || 0) > MAX_VIDEO_BYTES) {
      return { ok: false, error: 'Maximum size is 500MB' };
    }

    if (!SHOT_ID_PATTERN.test(shotId)) {
      return { ok: false, error: 'Invalid shot ID format' };
    }

    if (!VARIATION_PATTERN.test(variation)) {
      return { ok: false, error: 'Variation must be A, B, C, or D' };
    }

    return {
      ok: true,
      normalized: {
        file: file,
        shotId: shotId,
        variation: variation
      }
    };
  }

  var api = {
    validateKlingVideoUpload: validateKlingVideoUpload
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UploadDomain = api;
})(typeof window !== 'undefined' ? window : globalThis);
