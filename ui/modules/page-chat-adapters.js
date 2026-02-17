(function(root) {
  'use strict';

  const PAGE_PATH_MAP = {
    '/': 'home',
    '/home.html': 'home',
    '/step1.html': 'step1',
    '/step2.html': 'step2',
    '/step3.html': 'step3',
    '/step4.html': 'step4',
    '/index.html': 'index',
    '/storyboard.html': 'storyboard',
    '/guide.html': 'guide'
  };

  function detectPageId(pathname) {
    const path = String(pathname || root.location.pathname || '/').toLowerCase();
    if (PAGE_PATH_MAP[path]) return PAGE_PATH_MAP[path];
    if (path.endsWith('/home.html')) return 'home';
    if (path.endsWith('/step1.html')) return 'step1';
    if (path.endsWith('/step2.html')) return 'step2';
    if (path.endsWith('/step3.html')) return 'step3';
    if (path.endsWith('/step4.html')) return 'step4';
    if (path.endsWith('/storyboard.html')) return 'storyboard';
    if (path.endsWith('/guide.html')) return 'guide';
    if (path.endsWith('/index.html')) return 'index';
    return 'index';
  }

  function getDefaultProjectId() {
    return root.SharedUtils ? root.SharedUtils.getProjectId() : 'default';
  }

  function collectDefaultState(pageId) {
    const state = {
      pageId: pageId,
      url: root.location.pathname + (root.location.search || ''),
      selection: {},
      fields: {}
    };

    if (pageId === 'index' && root.AppState && typeof root.AppState.get === 'function') {
      const currentShot = root.AppState.get('currentShot');
      state.selection = {
        shotId: currentShot && currentShot.shotId ? String(currentShot.shotId) : '',
        variation: String(root.AppState.get('currentVariation') || 'A'),
        tool: String(root.AppState.get('currentTool') || 'seedream')
      };
      const promptText = document.getElementById('promptText');
      if (promptText) {
        state.fields.promptText = String(promptText.textContent || '');
      }
      return state;
    }

    if (pageId === 'step3') {
      const activeTabBtn = document.querySelector('.canon-tab.active');
      state.activeCanonTab = activeTabBtn ? String(activeTabBtn.getAttribute('data-tab') || 'script') : 'script';
      return state;
    }

    return state;
  }

  function getDefaultBridge() {
    const pageId = detectPageId(root.location.pathname);
    return {
      pageId: pageId,
      getProjectId: function() {
        return getDefaultProjectId();
      },
      collectLiveState: function() {
        return collectDefaultState(pageId);
      },
      onAppliedChanges: async function() {
        return;
      }
    };
  }

  function isValidBridge(bridge) {
    return Boolean(
      bridge
      && typeof bridge === 'object'
      && typeof bridge.pageId === 'string'
      && typeof bridge.getProjectId === 'function'
      && typeof bridge.collectLiveState === 'function'
      && typeof bridge.onAppliedChanges === 'function'
    );
  }

  function getBridge() {
    if (isValidBridge(root.PageChatBridge)) {
      return root.PageChatBridge;
    }
    return getDefaultBridge();
  }

  root.PageChatAdapters = {
    detectPageId: detectPageId,
    getDefaultBridge: getDefaultBridge,
    getBridge: getBridge,
    isValidBridge: isValidBridge
  };
})(typeof window !== 'undefined' ? window : globalThis);
