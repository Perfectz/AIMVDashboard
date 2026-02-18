(function(root) {
  'use strict';

  var DEFAULT_STATE = {
    shotId: '',
    variation: 'A',
    tool: '',
    readiness: null,
    continuity: null,
    activeJob: null,
    previews: [],
    errors: [],
    updatedAt: null
  };

  function sanitizeEvent(event) {
    if (!event || typeof event !== 'object') {
      return { type: 'UNKNOWN', payload: {} };
    }
    return {
      type: String(event.type || 'UNKNOWN').trim().toUpperCase(),
      payload: event.payload && typeof event.payload === 'object' ? event.payload : {}
    };
  }

  function reducer(state, event) {
    var next = Object.assign({}, state);
    var payload = event.payload || {};

    switch (event.type) {
      case 'SHOT_SELECTED':
        next.shotId = String(payload.shotId || '');
        next.tool = String(payload.tool || next.tool || '');
        next.variation = String(payload.variation || 'A');
        next.readiness = null;
        next.continuity = null;
        next.previews = [];
        next.errors = [];
        next.activeJob = null;
        break;
      case 'VARIATION_CHANGED':
        next.variation = String(payload.variation || next.variation || 'A');
        next.readiness = null;
        next.continuity = null;
        break;
      case 'PREFLIGHT_LOADED':
        next.readiness = payload.readiness || null;
        next.continuity = payload.continuity || null;
        break;
      case 'JOB_STARTED':
        next.activeJob = {
          jobId: String(payload.jobId || ''),
          traceId: String(payload.traceId || ''),
          status: 'running',
          progress: 0,
          step: ''
        };
        break;
      case 'JOB_PROGRESS':
        next.activeJob = Object.assign({}, next.activeJob || {}, {
          jobId: String(payload.jobId || (next.activeJob && next.activeJob.jobId) || ''),
          traceId: String(payload.traceId || (next.activeJob && next.activeJob.traceId) || ''),
          status: 'running',
          progress: Number.isFinite(payload.progress) ? Number(payload.progress) : Number((next.activeJob && next.activeJob.progress) || 0),
          step: String(payload.step || (next.activeJob && next.activeJob.step) || '')
        });
        break;
      case 'JOB_COMPLETED':
        next.activeJob = Object.assign({}, next.activeJob || {}, {
          status: String(payload.status || 'completed')
        });
        next.previews = Array.isArray(payload.previews) ? payload.previews.slice() : [];
        break;
      case 'PREVIEWS_SAVED':
        next.previews = [];
        break;
      case 'ERROR_SET':
        next.errors = (next.errors || []).concat([{
          code: String(payload.code || 'SERVER_ERROR'),
          message: String(payload.message || 'Unknown error'),
          timestamp: new Date().toISOString()
        }]).slice(-25);
        break;
      default:
        break;
    }

    next.updatedAt = new Date().toISOString();
    return next;
  }

  function createShotFlowStore(initialState) {
    var state = Object.assign({}, DEFAULT_STATE, initialState || {});
    var listeners = [];

    function getState() {
      return state;
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') {
        return function() {};
      }
      listeners.push(listener);
      return function unsubscribe() {
        listeners = listeners.filter(function(candidate) { return candidate !== listener; });
      };
    }

    function dispatch(event) {
      var normalized = sanitizeEvent(event);
      state = reducer(state, normalized);
      listeners.forEach(function(listener) {
        try {
          listener(state, normalized);
        } catch (err) {
          console.warn('[shot-flow-state] listener error:', err.message || err);
        }
      });
      return state;
    }

    return {
      dispatch: dispatch,
      getState: getState,
      subscribe: subscribe
    };
  }

  var api = {
    createShotFlowStore: createShotFlowStore
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ShotFlowState = api;
})(typeof window !== 'undefined' ? window : globalThis);
