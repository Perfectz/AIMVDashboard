(function(root) {
  'use strict';

  function createHttpClient(options) {
    var opts = options || {};
    var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);

    if (!fetchImpl) {
      throw new Error('fetch implementation is required');
    }

    async function request(url, requestOptions) {
      var response = await fetchImpl(url, requestOptions || {});
      var payload;

      try {
        payload = await response.json();
      } catch (err) {
        payload = {};
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
