(function(root) {
  'use strict';

  var _state = {
    indexData: null,
    currentShot: null,
    currentVariation: 'A',
    currentTool: null,
    currentPlatform: 'all',
    currentLintFilter: 'all',
    currentProject: null,
    canGenerate: false,
    generateTokenSource: 'none',
    previsMapCache: {},
    pendingGeneratedPreviews: null,
    githubAuthState: { connected: false, username: '', scopes: [], tokenSource: 'none' },
    agentActiveRunId: null,
    agentEventSource: null,
    agentRunCache: null,
    generationJobEventSource: null,
    activeGenerationJobId: null,
    generationMetricsCache: null,
    generationHistoryAutoRefreshTimer: null,
    generationHistoryRefreshInFlight: false,
    generationHistoryJobsById: new Map(),
    generationDetailsJobId: null,
    shotPreflightCache: new Map(),
    lastShotPreflight: null,
    searchDebounceTimer: null
  };

  var _listeners = {};

  function get(key) {
    return _state[key];
  }

  function set(key, value) {
    _state[key] = value;
    var listeners = _listeners[key];
    if (!listeners || !listeners.length) return;
    listeners.slice().forEach(function(fn) {
      try {
        fn(value);
      } catch (_) {
        // Ignore listener failures to avoid breaking state updates.
      }
    });
  }

  function on(key, fn) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(fn);
    return function unsubscribe() {
      var listeners = _listeners[key];
      if (!listeners) return;
      _listeners[key] = listeners.filter(function(listener) {
        return listener !== fn;
      });
    };
  }

  root.AppState = {
    get: get,
    set: set,
    on: on
  };
})(typeof window !== 'undefined' ? window : globalThis);
