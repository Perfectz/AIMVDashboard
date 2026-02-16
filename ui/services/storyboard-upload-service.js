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

  function createStoryboardUploadService(options) {
    var opts = options || {};
    var serviceBase = resolveServiceBase(opts);
    if (!serviceBase || !serviceBase.resolveDependency || !serviceBase.resolveHttpClient) {
      throw new Error('ServiceBase.resolveDependency and ServiceBase.resolveHttpClient are required');
    }
    var uploadDomain = serviceBase.resolveDependency('UploadDomain', opts.uploadDomain);

    if (!uploadDomain || !uploadDomain.validateKlingVideoUpload) {
      throw new Error('UploadDomain.validateKlingVideoUpload is required');
    }
    var httpClient = serviceBase.resolveHttpClient(opts);

    async function uploadKlingVariation(input) {
      var validation = uploadDomain.validateKlingVideoUpload(input);
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      var normalized = validation.normalized;
      var projectParam = input.projectId ? ('?project=' + encodeURIComponent(input.projectId)) : '';
      var formData = new FormData();
      formData.append('file', normalized.file);
      formData.append('shotId', normalized.shotId);
      formData.append('variation', normalized.variation);
      formData.append('fileType', 'kling');

      var result = await httpClient.request('/api/upload/shot' + projectParam, {
        method: 'POST',
        body: formData
      });

      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Upload failed' };
      }

      return { ok: true, data: result.payload };
    }

    return {
      uploadKlingVariation: uploadKlingVariation
    };
  }

  var api = {
    createStoryboardUploadService: createStoryboardUploadService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.StoryboardUploadService = api;
})(typeof window !== 'undefined' ? window : globalThis);
