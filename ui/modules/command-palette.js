(function(root) {
  'use strict';

  var isOpen = false;
  var overlayEl = null;
  var inputEl = null;
  var resultsEl = null;
  var activeIndex = 0;
  var currentItems = [];

  var COMMANDS = [
    { id: 'home', icon: '00', label: 'Project Home', desc: 'Dashboard overview', href: 'home.html', shortcut: null },
    { id: 'step1', icon: '01', label: 'Step 1: Theme', desc: 'Define visual style and inspiration', href: 'step1.html', shortcut: null },
    { id: 'step2', icon: '02', label: 'Step 2: Music', desc: 'Upload and analyze music', href: 'step2.html', shortcut: null },
    { id: 'step3', icon: '03', label: 'Step 3: Canon', desc: 'Define characters, locations, props', href: 'step3.html', shortcut: null },
    { id: 'step4', icon: '04', label: 'Step 4: References', desc: 'Upload reference images', href: 'step4.html', shortcut: null },
    { id: 'step5', icon: '05', label: 'Step 5: Shots', desc: 'Generate and review prompts', href: 'index.html', shortcut: null },
    { id: 'storyboard', icon: '06', label: 'Step 6: Storyboard', desc: 'Preview and sequence shots', href: 'storyboard.html', shortcut: null },
    { id: 'guide', icon: '?', label: 'User Guide', desc: 'Workflow documentation', href: 'guide.html', shortcut: null },
    { id: 'shortcuts', icon: '?', label: 'Keyboard Shortcuts', desc: 'View all shortcuts', action: 'showShortcuts', shortcut: ['?'] }
  ];

  var SHORTCUTS = [
    { keys: ['Ctrl', 'K'], label: 'Open command palette' },
    { keys: ['?'], label: 'Keyboard shortcuts' },
    { keys: ['Esc'], label: 'Close dialog' },
    { keys: ['\u2191', '\u2193'], label: 'Navigate results' },
    { keys: ['Enter'], label: 'Select result' },
    { keys: ['1-6'], label: 'Jump to step (from home)' }
  ];

  function fuzzyMatch(query, text) {
    var q = query.toLowerCase();
    var t = text.toLowerCase();
    if (t.indexOf(q) !== -1) return true;
    var qi = 0;
    for (var ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) qi++;
    }
    return qi === q.length;
  }

  function withProjectParam(href) {
    if (root.ProjectContext && typeof root.ProjectContext.buildProjectUrl === 'function') {
      var projectId = '';
      try { projectId = root.ProjectContext.getStoredProjectId() || ''; } catch (e) { /* skip */ }
      if (projectId) return root.ProjectContext.buildProjectUrl(href, projectId);
    }
    return href;
  }

  function filterCommands(query) {
    if (!query) return COMMANDS.slice();
    return COMMANDS.filter(function(cmd) {
      return fuzzyMatch(query, cmd.label) || fuzzyMatch(query, cmd.desc);
    });
  }

  function renderResults(items) {
    currentItems = items;
    if (!resultsEl) return;
    resultsEl.innerHTML = '';

    if (items.length === 0) {
      resultsEl.innerHTML = '<div class="command-palette-empty">No results found</div>';
      return;
    }

    items.forEach(function(item, idx) {
      var row = document.createElement('div');
      row.className = 'command-palette-item' + (idx === activeIndex ? ' active' : '');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', idx === activeIndex ? 'true' : 'false');
      row.dataset.index = idx;

      var icon = document.createElement('div');
      icon.className = 'command-palette-item-icon';
      icon.textContent = item.icon;

      var text = document.createElement('div');
      text.className = 'command-palette-item-text';
      var label = document.createElement('div');
      label.className = 'command-palette-item-label';
      label.textContent = item.label;
      var desc = document.createElement('div');
      desc.className = 'command-palette-item-desc';
      desc.textContent = item.desc;
      text.appendChild(label);
      text.appendChild(desc);

      row.appendChild(icon);
      row.appendChild(text);

      if (item.shortcut) {
        var shortcutWrap = document.createElement('div');
        shortcutWrap.className = 'command-palette-item-shortcut';
        item.shortcut.forEach(function(k) {
          var kbd = document.createElement('kbd');
          kbd.textContent = k;
          shortcutWrap.appendChild(kbd);
        });
        row.appendChild(shortcutWrap);
      }

      row.addEventListener('click', function() {
        executeItem(item);
      });

      row.addEventListener('mouseenter', function() {
        activeIndex = idx;
        renderResults(currentItems);
      });

      resultsEl.appendChild(row);
    });
  }

  function executeItem(item) {
    close();
    if (item.action === 'showShortcuts') {
      showShortcutsModal();
      return;
    }
    if (item.href) {
      window.location.href = withProjectParam(item.href);
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    activeIndex = 0;

    overlayEl = document.createElement('div');
    overlayEl.className = 'command-palette-overlay';
    overlayEl.addEventListener('click', function(e) {
      if (e.target === overlayEl) close();
    });

    var palette = document.createElement('div');
    palette.className = 'command-palette';
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-label', 'Command palette');

    var header = document.createElement('div');
    header.className = 'command-palette-header';
    var iconEl = document.createElement('span');
    iconEl.className = 'command-palette-icon';
    iconEl.textContent = '\u2318';
    header.appendChild(iconEl);

    inputEl = document.createElement('input');
    inputEl.className = 'command-palette-input';
    inputEl.type = 'text';
    inputEl.placeholder = 'Type a command or page name...';
    inputEl.setAttribute('aria-label', 'Search commands');
    inputEl.addEventListener('input', function() {
      activeIndex = 0;
      renderResults(filterCommands(inputEl.value));
    });
    header.appendChild(inputEl);
    palette.appendChild(header);

    resultsEl = document.createElement('div');
    resultsEl.className = 'command-palette-results';
    resultsEl.setAttribute('role', 'listbox');
    palette.appendChild(resultsEl);

    var footer = document.createElement('div');
    footer.className = 'command-palette-footer';
    footer.innerHTML =
      '<span><kbd>\u2191\u2193</kbd> Navigate</span>' +
      '<span><kbd>\u23CE</kbd> Select</span>' +
      '<span><kbd>Esc</kbd> Close</span>';
    palette.appendChild(footer);

    overlayEl.appendChild(palette);
    document.body.appendChild(overlayEl);

    renderResults(filterCommands(''));
    inputEl.focus();

    palette.addEventListener('keydown', handleKeydown);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
    inputEl = null;
    resultsEl = null;
    currentItems = [];
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentItems.length - 1);
      renderResults(currentItems);
      scrollActiveIntoView();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderResults(currentItems);
      scrollActiveIntoView();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentItems[activeIndex]) {
        executeItem(currentItems[activeIndex]);
      }
    }
  }

  function scrollActiveIntoView() {
    if (!resultsEl) return;
    var active = resultsEl.querySelector('.command-palette-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  // ── Keyboard Shortcuts Modal ──
  function showShortcutsModal() {
    var overlay = document.createElement('div');
    overlay.className = 'command-palette-overlay';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.parentNode.removeChild(overlay);
      }
    });

    var modal = document.createElement('div');
    modal.className = 'command-palette';
    modal.style.maxHeight = '480px';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Keyboard shortcuts');

    var header = document.createElement('div');
    header.className = 'command-palette-header';
    header.style.borderBottom = '1px solid var(--border, #2a2f3e)';
    var title = document.createElement('span');
    title.style.fontSize = '15px';
    title.style.fontWeight = '600';
    title.style.color = 'var(--text-primary, #f2f5fa)';
    title.textContent = 'Keyboard Shortcuts';
    header.appendChild(title);

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = 'background:none;border:none;color:var(--text-secondary);font-size:20px;cursor:pointer;margin-left:auto;';
    closeBtn.addEventListener('click', function() {
      overlay.parentNode.removeChild(overlay);
    });
    header.appendChild(closeBtn);
    modal.appendChild(header);

    var grid = document.createElement('div');
    grid.className = 'shortcuts-grid';
    grid.style.padding = '16px';

    SHORTCUTS.forEach(function(shortcut) {
      var item = document.createElement('div');
      item.className = 'shortcut-item';

      var label = document.createElement('span');
      label.className = 'shortcut-item-label';
      label.textContent = shortcut.label;

      var keys = document.createElement('span');
      keys.className = 'shortcut-item-keys';
      shortcut.keys.forEach(function(k) {
        var kbd = document.createElement('kbd');
        kbd.textContent = k;
        keys.appendChild(kbd);
      });

      item.appendChild(label);
      item.appendChild(keys);
      grid.appendChild(item);
    });

    modal.appendChild(grid);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        overlay.parentNode.removeChild(overlay);
      }
    });
    closeBtn.focus();
  }

  // ── Global key listeners ──
  function initGlobalShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Skip if user is typing in an input/textarea
      var tag = (e.target.tagName || '').toLowerCase();
      var isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

      // Ctrl+K / Cmd+K — open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) close(); else open();
        return;
      }

      // ? key — shortcuts help (only when not in an input)
      if (e.key === '?' && !isInput && !isOpen) {
        e.preventDefault();
        showShortcutsModal();
        return;
      }

      // Number keys 1-6 — jump to step (only from home, and not in input)
      if (!isInput && !isOpen && /^[1-6]$/.test(e.key)) {
        var stepPages = ['step1.html', 'step2.html', 'step3.html', 'step4.html', 'index.html', 'storyboard.html'];
        var page = stepPages[parseInt(e.key, 10) - 1];
        if (page) {
          window.location.href = withProjectParam(page);
        }
      }
    });
  }

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalShortcuts);
  } else {
    initGlobalShortcuts();
  }

  root.CommandPalette = {
    open: open,
    close: close,
    showShortcutsModal: showShortcutsModal
  };
})(window);
