(function(root) {
  'use strict';

  var MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
  var IMAGE_REF_PATTERN = /\.(png|jpg|jpeg)$/i;
  var IMAGE_RENDER_PATTERN = /\.(png|jpg|jpeg|webp)$/i;
  var SHOT_ID_PATTERN = /^SHOT_[A-Z0-9_]+$/i;
  var VARIATION_PATTERN = /^[A-D]$/;
  var FRAME_PATTERN = /^(first|last)$/;
  var TOOL_PATTERN = /^(seedream|kling)$/;

  function validateFilePresence(file) {
    if (!file) return { ok: false, error: 'No file selected' };
    return { ok: true };
  }

  function validateReferenceImageFile(file) {
    var presence = validateFilePresence(file);
    if (!presence.ok) return presence;

    if (!IMAGE_REF_PATTERN.test(String(file.name || ''))) {
      return { ok: false, error: 'Only PNG and JPEG images are supported' };
    }

    if (Number(file.size || 0) > MAX_UPLOAD_BYTES) {
      return { ok: false, error: 'Maximum size is 20MB' };
    }

    return { ok: true };
  }

  function validateShotRenderUpload(input) {
    var file = input && input.file;
    var shotId = String((input && input.shotId) || '');
    var variation = String((input && input.variation) || '').toUpperCase();
    var frame = String((input && input.frame) || '');
    var tool = String((input && input.tool) || '').toLowerCase();

    var presence = validateFilePresence(file);
    if (!presence.ok) return presence;

    if (!IMAGE_RENDER_PATTERN.test(String(file.name || ''))) {
      return { ok: false, error: 'Only PNG, JPEG, and WebP images are supported' };
    }

    if (Number(file.size || 0) > MAX_UPLOAD_BYTES) {
      return { ok: false, error: 'Maximum size is 20MB' };
    }

    if (!SHOT_ID_PATTERN.test(shotId)) {
      return { ok: false, error: 'Invalid shot ID format' };
    }

    if (!VARIATION_PATTERN.test(variation)) {
      return { ok: false, error: 'Variation must be A, B, C, or D' };
    }

    if (!FRAME_PATTERN.test(frame)) {
      return { ok: false, error: 'Frame must be first or last' };
    }

    if (!TOOL_PATTERN.test(tool)) {
      return { ok: false, error: 'Tool must be seedream or kling' };
    }

    return {
      ok: true,
      normalized: {
        file: file,
        shotId: shotId,
        variation: variation,
        frame: frame,
        tool: tool
      }
    };
  }

  var api = {
    validateReferenceImageFile: validateReferenceImageFile,
    validateShotRenderUpload: validateShotRenderUpload
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ReferenceUploadDomain = api;
})(typeof window !== 'undefined' ? window : globalThis);
