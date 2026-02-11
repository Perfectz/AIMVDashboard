(function(root) {
  'use strict';

  function resolveDependency(name, directValue) {
    if (directValue) return directValue;
    if (root && root[name]) return root[name];
    return null;
  }

  function createReferenceUploadService(options) {
    var opts = options || {};
    var domain = resolveDependency('ReferenceUploadDomain', opts.domain);
    var httpClientFactory = resolveDependency('HttpClient', opts.httpClientFactory);
    var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);

    if (!domain || !domain.validateReferenceImageFile || !domain.validateShotRenderUpload) {
      throw new Error('ReferenceUploadDomain is required');
    }

    if (!httpClientFactory || !httpClientFactory.createHttpClient) {
      throw new Error('HttpClient.createHttpClient is required');
    }

    var httpClient = httpClientFactory.createHttpClient({ fetchImpl: fetchImpl });

    async function uploadCharacterReference(input) {
      var validation = domain.validateReferenceImageFile(input && input.file);
      if (!validation.ok) return { ok: false, error: validation.error };

      var formData = new FormData();
      formData.append('project', String(input.projectId || ''));
      formData.append('character', String(input.characterName || ''));
      formData.append('slot', String(input.slotNum || ''));
      formData.append('image', input.file);

      var result = await httpClient.request('/api/upload/reference-image', {
        method: 'POST',
        body: formData
      });

      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Upload failed' };
      }

      return { ok: true, data: result.payload };
    }

    async function uploadLocationReference(input) {
      var validation = domain.validateReferenceImageFile(input && input.file);
      if (!validation.ok) return { ok: false, error: validation.error };

      var formData = new FormData();
      formData.append('project', String(input.projectId || ''));
      formData.append('location', String(input.locationName || ''));
      formData.append('slot', String(input.slotNum || ''));
      formData.append('image', input.file);

      var result = await httpClient.request('/api/upload/location-reference-image', {
        method: 'POST',
        body: formData
      });

      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Upload failed' };
      }

      return { ok: true, data: result.payload };
    }

    async function uploadShotRenderFrame(input) {
      var validation = domain.validateShotRenderUpload(input);
      if (!validation.ok) return { ok: false, error: validation.error };

      var normalized = validation.normalized;
      var formData = new FormData();
      formData.append('project', String(input.projectId || ''));
      formData.append('shot', normalized.shotId);
      formData.append('variation', normalized.variation);
      formData.append('frame', normalized.frame);
      formData.append('tool', normalized.tool);
      formData.append('image', normalized.file);

      var result = await httpClient.request('/api/upload/shot-render', {
        method: 'POST',
        body: formData
      });

      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Upload failed' };
      }

      return { ok: true, data: result.payload };
    }

    return {
      uploadCharacterReference: uploadCharacterReference,
      uploadLocationReference: uploadLocationReference,
      uploadShotRenderFrame: uploadShotRenderFrame
    };
  }

  var api = {
    createReferenceUploadService: createReferenceUploadService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ReferenceUploadService = api;
})(typeof window !== 'undefined' ? window : globalThis);
