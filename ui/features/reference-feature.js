(function(root) {
  'use strict';

  function createReferenceFeature(options) {
    var opts = options || {};
    var referenceUploadService = opts.referenceUploadService;

    if (!referenceUploadService) {
      throw new Error('referenceUploadService is required');
    }

    if (!referenceUploadService.uploadCharacterReference || !referenceUploadService.uploadLocationReference || !referenceUploadService.uploadShotRenderFrame) {
      throw new Error('referenceUploadService upload methods are required');
    }

    async function uploadCharacterReference(input) {
      var result = await referenceUploadService.uploadCharacterReference(input || {});
      if (!result.ok) {
        return { ok: false, error: result.error || 'Upload failed' };
      }
      return { ok: true, data: result.data || {} };
    }

    async function uploadLocationReference(input) {
      var result = await referenceUploadService.uploadLocationReference(input || {});
      if (!result.ok) {
        return { ok: false, error: result.error || 'Upload failed' };
      }
      return { ok: true, data: result.data || {} };
    }

    async function uploadShotRenderFrame(input) {
      var result = await referenceUploadService.uploadShotRenderFrame(input || {});
      if (!result.ok) {
        return { ok: false, error: result.error || 'Upload failed' };
      }
      return { ok: true, data: result.data || {} };
    }

    return {
      uploadCharacterReference: uploadCharacterReference,
      uploadLocationReference: uploadLocationReference,
      uploadShotRenderFrame: uploadShotRenderFrame
    };
  }

  var api = {
    createReferenceFeature: createReferenceFeature
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ReferenceFeature = api;
})(typeof window !== 'undefined' ? window : globalThis);
