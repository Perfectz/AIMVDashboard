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

  function createReferenceUploadService(options) {
    var opts = options || {};
    var serviceBase = resolveServiceBase(opts);
    if (!serviceBase || !serviceBase.resolveDependency || !serviceBase.resolveHttpClient) {
      throw new Error('ServiceBase.resolveDependency and ServiceBase.resolveHttpClient are required');
    }

    var domain = serviceBase.resolveDependency('ReferenceUploadDomain', opts.domain);

    if (!domain || !domain.validateReferenceImageFile || !domain.validateShotRenderUpload) {
      throw new Error('ReferenceUploadDomain is required');
    }
    var httpClient = serviceBase.resolveHttpClient(opts);

    async function uploadEntityReference(input, entityField, endpoint) {
      var validation = domain.validateReferenceImageFile(input && input.file);
      if (!validation.ok) return { ok: false, error: validation.error };

      var formData = new FormData();
      formData.append('project', String(input.projectId || ''));
      formData.append(entityField, String(input.entityName || ''));
      formData.append('slot', String(input.slotNum || ''));
      formData.append('image', input.file);

      var result = await httpClient.request(endpoint, {
        method: 'POST',
        body: formData
      });

      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Upload failed' };
      }
      return { ok: true, data: result.payload };
    }

    async function uploadCharacterReference(input) {
      return uploadEntityReference(
        {
          projectId: input && input.projectId,
          entityName: input && input.characterName,
          slotNum: input && input.slotNum,
          file: input && input.file
        },
        'character',
        '/api/upload/reference-image'
      );
    }

    async function uploadLocationReference(input) {
      return uploadEntityReference(
        {
          projectId: input && input.projectId,
          entityName: input && input.locationName,
          slotNum: input && input.slotNum,
          file: input && input.file
        },
        'location',
        '/api/upload/location-reference-image'
      );
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
