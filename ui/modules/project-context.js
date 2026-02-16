(function(root) {
  'use strict';

  function normalizeProjectId(value) {
    var id = String(value || '').trim();
    return id || '';
  }

  function getProjectIdFromQuery() {
    try {
      var url = new URL(root.location.href);
      return normalizeProjectId(url.searchParams.get('project'));
    } catch (_) {
      return '';
    }
  }

  function getStoredProjectId(storage) {
    var targetStorage = storage || (root && root.localStorage ? root.localStorage : null);
    if (!targetStorage || typeof targetStorage.getItem !== 'function') return '';
    try {
      return normalizeProjectId(targetStorage.getItem('activeProject'));
    } catch (_) {
      return '';
    }
  }

  function setStoredProjectId(projectId, storage) {
    var nextProjectId = normalizeProjectId(projectId);
    var targetStorage = storage || (root && root.localStorage ? root.localStorage : null);
    if (!targetStorage || typeof targetStorage.setItem !== 'function' || !nextProjectId) return;
    try {
      targetStorage.setItem('activeProject', nextProjectId);
    } catch (_) {
      // Ignore storage write failures.
    }
  }

  function clearStoredProjectId(storage) {
    var targetStorage = storage || (root && root.localStorage ? root.localStorage : null);
    if (!targetStorage || typeof targetStorage.removeItem !== 'function') return;
    try {
      targetStorage.removeItem('activeProject');
    } catch (_) {
      // Ignore storage write failures.
    }
  }

  function persistProjectFromQuery(storage) {
    var projectId = getProjectIdFromQuery();
    if (!projectId) return '';
    setStoredProjectId(projectId, storage);
    return projectId;
  }

  function getCurrentProjectId(selectorId, scope, storage) {
    var targetSelectorId = selectorId || 'projectSelector';
    var targetScope = scope || root.document;
    if (targetScope && typeof targetScope.getElementById === 'function') {
      var selector = targetScope.getElementById(targetSelectorId);
      if (selector && selector.value) {
        return normalizeProjectId(selector.value);
      }
    }
    return getProjectIdFromQuery() || getStoredProjectId(storage);
  }

  function isProjectNavigableHref(href) {
    var raw = String(href || '').trim();
    if (!raw) return false;
    if (raw.startsWith('#')) return false;
    if (/^(mailto|tel|javascript):/i.test(raw)) return false;
    return true;
  }

  function buildProjectUrl(baseUrl, projectId, currentHref) {
    var raw = String(baseUrl || '').trim();
    var nextProjectId = normalizeProjectId(projectId);
    if (!nextProjectId || !isProjectNavigableHref(raw)) return raw;

    try {
      var originUrl = currentHref || (root && root.location ? root.location.href : 'http://localhost/');
      var url = new URL(raw, originUrl);
      var current = new URL(originUrl);

      if (url.origin !== current.origin) return raw;

      var pathname = String(url.pathname || '').toLowerCase();
      var isHtmlTarget = pathname === '/' || pathname.endsWith('.html') || pathname.endsWith('/');
      if (!isHtmlTarget) return raw;

      url.searchParams.set('project', nextProjectId);
      return '' + url.pathname + url.search + url.hash;
    } catch (_) {
      return raw;
    }
  }

  function navigateWithProject(projectId, options) {
    var opts = options || {};
    var nextProjectId = normalizeProjectId(projectId);
    var baseHref = opts.baseHref || (root && root.location ? root.location.href : '');
    var url = new URL(baseHref);
    if (nextProjectId) {
      url.searchParams.set('project', nextProjectId);
      setStoredProjectId(nextProjectId, opts.storage);
    } else {
      url.searchParams.delete('project');
      clearStoredProjectId(opts.storage);
    }
    if (opts.replace && root && root.location && typeof root.location.replace === 'function') {
      root.location.replace(url.toString());
      return;
    }
    if (root && root.location) {
      root.location.href = url.toString();
    }
  }

  var api = {
    normalizeProjectId: normalizeProjectId,
    getProjectIdFromQuery: getProjectIdFromQuery,
    getStoredProjectId: getStoredProjectId,
    setStoredProjectId: setStoredProjectId,
    clearStoredProjectId: clearStoredProjectId,
    persistProjectFromQuery: persistProjectFromQuery,
    getCurrentProjectId: getCurrentProjectId,
    isProjectNavigableHref: isProjectNavigableHref,
    buildProjectUrl: buildProjectUrl,
    navigateWithProject: navigateWithProject
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ProjectContext = api;
})(typeof window !== 'undefined' ? window : globalThis);
