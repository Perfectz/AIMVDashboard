(function(root) {
  'use strict';

  function createGenerationReadinessService(options) {
    var opts = options || {};
    var base = root.ServiceBase;
    if (!base || !base.resolveHttpClient) {
      throw new Error('ServiceBase.resolveHttpClient is required');
    }
    var httpClient = base.resolveHttpClient(opts);

    function normalizeResult(result, fallbackMessage) {
      var payload = result && result.payload ? result.payload : {};
      var response = result && result.response ? result.response : { ok: false, status: 0 };
      var ok = Boolean(response.ok && payload && payload.success !== false);
      return {
        ok: ok,
        data: payload,
        error: ok ? '' : (payload.error || fallbackMessage || 'Request failed'),
        code: payload.code || (ok ? '' : 'SERVER_ERROR'),
        status: response.status || (ok ? 200 : 500)
      };
    }

    async function getGenerateStatus() {
      var result = await httpClient.request('/api/generate-status', { method: 'GET' });
      return normalizeResult(result, 'Failed to load generation status');
    }

    async function setSessionReplicateKey(token) {
      var result = await httpClient.request('/api/session/replicate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: String(token || '') })
      });
      return normalizeResult(result, 'Failed to update Replicate session key');
    }

    async function loadShotPreflight(input) {
      var req = input || {};
      var params = new URLSearchParams();
      params.set('project', String(req.projectId || req.project || ''));
      params.set('shotId', String(req.shotId || req.shot || ''));
      params.set('variation', String(req.variation || 'A'));
      params.set('tool', String(req.tool || 'seedream'));
      if (req.requireReference !== undefined) {
        params.set('requireReference', String(Boolean(req.requireReference)));
      }
      var result = await httpClient.request('/api/shot-generation/preflight?' + params.toString(), { method: 'GET' });
      return normalizeResult(result, 'Failed to load shot preflight');
    }

    async function saveShotPreview(payload) {
      var result = await httpClient.request('/api/save-shot-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return normalizeResult(result, 'Failed to save generated preview');
    }

    async function saveShotPreviews(payload) {
      var result = await httpClient.request('/api/save-shot-previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return normalizeResult(result, 'Failed to save generated previews');
    }

    async function discardShotPreview(payload) {
      var result = await httpClient.request('/api/discard-shot-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return normalizeResult(result, 'Failed to discard generated previews');
    }

    async function uploadShotReferenceSet(payload) {
      var result = await httpClient.request('/api/upload/shot-reference-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return normalizeResult(result, 'Failed to upload shot reference set');
    }

    async function loadPrevisMap(projectId) {
      var result = await httpClient.request('/api/storyboard/previs-map?project=' + encodeURIComponent(String(projectId || '')), {
        method: 'GET'
      });
      return normalizeResult(result, 'Failed to load previs map');
    }

    async function savePrevisMapEntry(projectId, shotId, entry) {
      var result = await httpClient.request('/api/storyboard/previs-map/' + encodeURIComponent(String(shotId || '')), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: String(projectId || ''),
          entry: entry || {}
        })
      });
      return normalizeResult(result, 'Failed to save previs map entry');
    }

    async function loadShotRenders(projectId, shotId) {
      var params = new URLSearchParams();
      params.set('project', String(projectId || ''));
      params.set('shot', String(shotId || ''));
      var result = await httpClient.request('/api/shot-renders?' + params.toString(), { method: 'GET' });
      return normalizeResult(result, 'Failed to load shot renders');
    }

    async function deleteShotRender(input) {
      var req = input || {};
      var params = new URLSearchParams();
      params.set('project', String(req.projectId || req.project || ''));
      params.set('shot', String(req.shotId || req.shot || ''));
      params.set('variation', String(req.variation || 'A'));
      params.set('frame', String(req.frame || ''));
      params.set('tool', String(req.tool || 'seedream'));

      var result = await httpClient.request('/api/delete/shot-render?' + params.toString(), { method: 'DELETE' });
      return normalizeResult(result, 'Failed to delete shot render');
    }

    async function generateImage(payload) {
      var result = await httpClient.request('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return normalizeResult(result, 'Failed to generate image');
    }

    return {
      getGenerateStatus: getGenerateStatus,
      setSessionReplicateKey: setSessionReplicateKey,
      loadShotPreflight: loadShotPreflight,
      saveShotPreview: saveShotPreview,
      saveShotPreviews: saveShotPreviews,
      discardShotPreview: discardShotPreview,
      uploadShotReferenceSet: uploadShotReferenceSet,
      loadPrevisMap: loadPrevisMap,
      savePrevisMapEntry: savePrevisMapEntry,
      loadShotRenders: loadShotRenders,
      deleteShotRender: deleteShotRender,
      generateImage: generateImage
    };
  }

  var api = {
    createGenerationReadinessService: createGenerationReadinessService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.GenerationReadinessService = api;
})(typeof window !== 'undefined' ? window : globalThis);
