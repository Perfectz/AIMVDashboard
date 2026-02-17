(function(root) {
  'use strict';

  var DEFAULT_TIMEOUT_MS = 30000;

  function createHttpClient(options) {
    var opts = options || {};
    var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    var defaultTimeout = opts.timeout || DEFAULT_TIMEOUT_MS;

    if (!fetchImpl) {
      throw new Error('fetch implementation is required');
    }

    async function request(url, requestOptions) {
      var reqOpts = requestOptions || {};
      var timeoutMs = reqOpts.timeout || defaultTimeout;
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, timeoutMs);

      if (!reqOpts.signal) {
        reqOpts.signal = controller.signal;
      }

      var response;
      try {
        response = await fetchImpl(url, reqOpts);
      } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          return { response: { ok: false, status: 0 }, payload: { error: 'Request timed out after ' + (timeoutMs / 1000) + 's' } };
        }
        return { response: { ok: false, status: 0 }, payload: { error: 'Network error: ' + (err.message || 'connection failed') } };
      }

      clearTimeout(timer);
      var payload;

      try {
        payload = await response.json();
      } catch (err) {
        payload = { error: 'Invalid response format (not JSON)' };
      }

      return { response: response, payload: payload };
    }

    return {
      request: request
    };
  }

  var api = {
    createHttpClient: createHttpClient
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.HttpClient = api;
})(typeof window !== 'undefined' ? window : globalThis);
