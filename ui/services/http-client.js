(function(root) {
  'use strict';

  var DEFAULT_TIMEOUT_MS = 30000;
  var DEFAULT_MAX_RETRIES = 2;
  var DEFAULT_RETRY_BASE_MS = 500;

  // Status codes that indicate a transient server issue worth retrying
  var RETRYABLE_STATUS_CODES = { 408: true, 429: true, 500: true, 502: true, 503: true, 504: true };

  function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function createHttpClient(options) {
    var opts = options || {};
    var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    var defaultTimeout = opts.timeout || DEFAULT_TIMEOUT_MS;
    var defaultMaxRetries = typeof opts.maxRetries === 'number' ? opts.maxRetries : DEFAULT_MAX_RETRIES;
    var defaultRetryBaseMs = typeof opts.retryBaseMs === 'number' ? opts.retryBaseMs : DEFAULT_RETRY_BASE_MS;

    if (!fetchImpl) {
      throw new Error('fetch implementation is required');
    }

    function isRetryable(response, err) {
      // Network errors (no response) are always retryable
      if (!response && err) return true;
      if (!response) return false;
      return RETRYABLE_STATUS_CODES[response.status] === true;
    }

    function getRetryDelay(attempt, retryBaseMs, response) {
      // Check for Retry-After header (429 rate limiting)
      if (response && response.headers && typeof response.headers.get === 'function') {
        var retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          var retryAfterSec = Number(retryAfter);
          if (Number.isFinite(retryAfterSec) && retryAfterSec > 0 && retryAfterSec <= 60) {
            return retryAfterSec * 1000;
          }
        }
      }
      // Exponential backoff with jitter: base * 2^attempt + random jitter
      var delay = retryBaseMs * Math.pow(2, attempt);
      var jitter = Math.random() * retryBaseMs;
      return Math.min(delay + jitter, 15000); // Cap at 15s
    }

    async function request(url, requestOptions) {
      var reqOpts = requestOptions || {};
      var timeoutMs = reqOpts.timeout || defaultTimeout;
      var maxRetries = typeof reqOpts.maxRetries === 'number' ? reqOpts.maxRetries : defaultMaxRetries;
      var retryBaseMs = typeof reqOpts.retryBaseMs === 'number' ? reqOpts.retryBaseMs : defaultRetryBaseMs;

      // Don't retry non-idempotent methods by default unless explicitly allowed
      var method = String(reqOpts.method || 'GET').toUpperCase();
      var idempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'PUT' || method === 'DELETE';
      if (!idempotent && !reqOpts.retryNonIdempotent) {
        maxRetries = 0;
      }

      var lastResponse = null;
      var lastPayload = null;

      for (var attempt = 0; attempt <= maxRetries; attempt++) {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, timeoutMs);

        var attemptOpts = {};
        for (var key in reqOpts) {
          if (reqOpts.hasOwnProperty(key) && key !== 'signal' && key !== 'maxRetries' && key !== 'retryBaseMs' && key !== 'retryNonIdempotent') {
            attemptOpts[key] = reqOpts[key];
          }
        }
        attemptOpts.signal = controller.signal;

        var response;
        try {
          response = await fetchImpl(url, attemptOpts);
        } catch (err) {
          clearTimeout(timer);

          if (err.name === 'AbortError') {
            lastResponse = { ok: false, status: 0 };
            lastPayload = { error: 'Request timed out after ' + (timeoutMs / 1000) + 's' };
          } else {
            lastResponse = { ok: false, status: 0 };
            lastPayload = { error: 'Network error: ' + (err.message || 'connection failed') };
          }

          // Retry on network errors if attempts remain
          if (attempt < maxRetries && isRetryable(null, err)) {
            await sleep(getRetryDelay(attempt, retryBaseMs, null));
            continue;
          }
          return { response: lastResponse, payload: lastPayload };
        }

        clearTimeout(timer);

        // If retryable status and attempts remain, retry
        if (attempt < maxRetries && isRetryable(response, null)) {
          lastResponse = response;
          try { lastPayload = await response.json(); } catch (e) { lastPayload = { error: 'Server error (status ' + response.status + ')' }; }
          await sleep(getRetryDelay(attempt, retryBaseMs, response));
          continue;
        }

        // Final attempt or non-retryable — return result
        var payload;
        try {
          payload = await response.json();
        } catch (err) {
          payload = { error: 'Invalid response format (not JSON)' };
        }

        return { response: response, payload: payload };
      }

      // Should not reach here, but safety fallback
      return { response: lastResponse || { ok: false, status: 0 }, payload: lastPayload || { error: 'Request failed' } };
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
