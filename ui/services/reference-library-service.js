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

  function createReferenceLibraryService(options) {
    var opts = options || {};
    var serviceBase = resolveServiceBase(opts);
    if (!serviceBase || !serviceBase.resolveHttpClient) {
      throw new Error('ServiceBase.resolveHttpClient is required');
    }
    var httpClient = serviceBase.resolveHttpClient(opts);

    async function listCharacters(projectId) {
      var result = await httpClient.request('/api/references/characters?project=' + encodeURIComponent(String(projectId || '')), { method: 'GET' });
      if (!result.response.ok) {
        return { ok: false, error: result.payload.error || 'Failed to load character references' };
      }
      return { ok: true, data: result.payload || {} };
    }

    async function listLocations(projectId) {
      var result = await httpClient.request('/api/references/locations?project=' + encodeURIComponent(String(projectId || '')), { method: 'GET' });
      if (!result.response.ok) {
        return { ok: false, error: result.payload.error || 'Failed to load location references' };
      }
      return { ok: true, data: result.payload || {} };
    }

    async function addCharacter(projectId, characterName) {
      var endpoint = '/api/add-character?project=' + encodeURIComponent(String(projectId || '')) + '&character=' + encodeURIComponent(String(characterName || ''));
      var result = await httpClient.request(endpoint, { method: 'POST' });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to add character' };
      }
      return { ok: true, data: result.payload };
    }

    async function deleteCharacter(projectId, characterName) {
      var endpoint = '/api/delete/character-reference?project=' + encodeURIComponent(String(projectId || '')) + '&character=' + encodeURIComponent(String(characterName || ''));
      var result = await httpClient.request(endpoint, { method: 'DELETE' });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to delete character' };
      }
      return { ok: true, data: result.payload };
    }

    async function deleteCharacterImage(projectId, characterName, slotNum) {
      var endpoint = '/api/delete/reference-image?project=' + encodeURIComponent(String(projectId || ''))
        + '&character=' + encodeURIComponent(String(characterName || ''))
        + '&slot=' + encodeURIComponent(String(slotNum || ''));
      var result = await httpClient.request(endpoint, { method: 'DELETE' });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to delete reference image' };
      }
      return { ok: true, data: result.payload };
    }

    async function addLocation(projectId, locationName) {
      var endpoint = '/api/add-location?project=' + encodeURIComponent(String(projectId || '')) + '&location=' + encodeURIComponent(String(locationName || ''));
      var result = await httpClient.request(endpoint, { method: 'POST' });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to add location' };
      }
      return { ok: true, data: result.payload };
    }

    async function deleteLocation(projectId, locationName) {
      var endpoint = '/api/delete/location-reference?project=' + encodeURIComponent(String(projectId || '')) + '&location=' + encodeURIComponent(String(locationName || ''));
      var result = await httpClient.request(endpoint, { method: 'DELETE' });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to delete location' };
      }
      return { ok: true, data: result.payload };
    }

    async function deleteLocationImage(projectId, locationName, slotNum) {
      var endpoint = '/api/delete/location-reference-image?project=' + encodeURIComponent(String(projectId || ''))
        + '&location=' + encodeURIComponent(String(locationName || ''))
        + '&slot=' + encodeURIComponent(String(slotNum || ''));
      var result = await httpClient.request(endpoint, { method: 'DELETE' });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to delete location image' };
      }
      return { ok: true, data: result.payload };
    }

    return {
      listCharacters: listCharacters,
      listLocations: listLocations,
      addCharacter: addCharacter,
      deleteCharacter: deleteCharacter,
      deleteCharacterImage: deleteCharacterImage,
      addLocation: addLocation,
      deleteLocation: deleteLocation,
      deleteLocationImage: deleteLocationImage
    };
  }

  var api = {
    createReferenceLibraryService: createReferenceLibraryService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ReferenceLibraryService = api;
})(typeof window !== 'undefined' ? window : globalThis);
