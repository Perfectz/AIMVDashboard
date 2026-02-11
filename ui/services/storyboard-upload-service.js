(function(root) {
  'use strict';

  function resolveDependency(name, directValue) {
    if (directValue) return directValue;
    if (root && root[name]) return root[name];
    return null;
  }

  function createStoryboardUploadService(options) {
    var opts = options || {};
    var uploadDomain = resolveDependency('UploadDomain', opts.uploadDomain);
    var httpClientFactory = resolveDependency('HttpClient', opts.httpClientFactory);
    var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);

    if (!uploadDomain || !uploadDomain.validateKlingVideoUpload) {
      throw new Error('UploadDomain.validateKlingVideoUpload is required');
    }

    if (!httpClientFactory || !httpClientFactory.createHttpClient) {
      throw new Error('HttpClient.createHttpClient is required');
    }

    var httpClient = httpClientFactory.createHttpClient({ fetchImpl: fetchImpl });

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
