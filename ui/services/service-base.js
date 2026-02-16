(function(root) {
  'use strict';

  function resolveDependency(name, directValue) {
    if (directValue) return directValue;
    if (root && root[name]) return root[name];
    return null;
  }

  function resolveHttpClient(options) {
    var opts = options || {};
    var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    var httpClientFactory = resolveDependency('HttpClient', opts.httpClientFactory);
    if (!httpClientFactory || !httpClientFactory.createHttpClient) {
      throw new Error('HttpClient.createHttpClient is required');
    }
    return httpClientFactory.createHttpClient({ fetchImpl: fetchImpl });
  }

  var api = {
    resolveDependency: resolveDependency,
    resolveHttpClient: resolveHttpClient
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ServiceBase = api;
})(typeof window !== 'undefined' ? window : globalThis);
