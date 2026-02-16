(function(root) {
  'use strict';

  var toastIdCounter = 0;

  function el(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve();
  }

  function showToast(title, message, type, duration) {
    if (message === undefined) message = '';
    if (type === undefined) type = 'info';
    if (duration === undefined) duration = 3000;

    var container = document.getElementById('toastContainer');
    if (!container) return null;

    var toastId = 'toast-' + (toastIdCounter++);

    var icons = {
      success: '\u2713',
      error: '\u2717',
      warning: '\u26A0',
      info: 'i'
    };

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.id = toastId;

    var iconEl = document.createElement('div');
    iconEl.className = 'toast-icon';
    iconEl.textContent = icons[type] || icons.info;

    var contentEl = document.createElement('div');
    contentEl.className = 'toast-content';

    var titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;
    contentEl.appendChild(titleEl);

    if (message) {
      var msgEl = document.createElement('div');
      msgEl.className = 'toast-message';
      msgEl.textContent = message;
      contentEl.appendChild(msgEl);
    }

    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', function() { dismissToast(toastId); });

    toast.appendChild(iconEl);
    toast.appendChild(contentEl);
    toast.appendChild(closeBtn);

    if (duration > 0) {
      var progress = document.createElement('div');
      progress.className = 'toast-progress';
      toast.appendChild(progress);
    }

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(function() { dismissToast(toastId); }, duration);
    }

    return toastId;
  }

  function dismissToast(toastId) {
    var toast = document.getElementById(toastId);
    if (!toast) return;
    toast.classList.add('toast-dismissing');
    setTimeout(function() { toast.remove(); }, 200);
  }

  function showLoading(container, message) {
    if (message === undefined) message = 'Loading...';
    var overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    var spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    var text = document.createElement('div');
    text.className = 'loading-text';
    text.textContent = message;
    overlay.appendChild(spinner);
    overlay.appendChild(text);
    container.style.position = 'relative';
    container.appendChild(overlay);
    return overlay;
  }

  function hideLoading(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.remove();
    }
  }

  function renderContextDrawer(bundle) {
    var content = document.getElementById('contextDrawerContent');
    if (!content) return;

    var orderList = (bundle.selectedShotOrder || [])
      .map(function(s) { return '<li>' + escapeHtml(s.shotId) + ' - Variation ' + escapeHtml(s.selectedVariation || 'none') + '</li>'; })
      .join('');

    var shotsHtml = (bundle.shots || []).map(function(shot) {
      var refs = (shot.references || []).map(function(ref) {
        var assets = ref.assets && ref.assets.length ? ' (' + ref.assets.length + ' asset' + (ref.assets.length > 1 ? 's' : '') + ')' : '';
        return '<li>' + escapeHtml(ref.type) + ': ' + escapeHtml(ref.name || ref.id || 'Unknown') + escapeHtml(assets) + '</li>';
      }).join('');
      var scriptText = (shot.scriptSnippet && (shot.scriptSnippet.what || shot.scriptSnippet.why)) || 'N/A';
      return '<div class="context-block">' +
        '<h3>' + escapeHtml(shot.shotId) + '</h3>' +
        '<p><strong>Script:</strong> ' + escapeHtml(scriptText) + '</p>' +
        '<p><strong>Transcript:</strong> ' + escapeHtml(shot.transcriptSnippet || 'N/A') + '</p>' +
        '<ul>' + (refs || '<li>No references</li>') + '</ul>' +
        '</div>';
    }).join('');

    var warnings = (bundle.warnings || []).map(function(w) {
      return '<div class="context-warning">\u26A0 ' + escapeHtml(w) + '</div>';
    }).join('');

    content.innerHTML =
      '<div class="context-block">' +
      '<h3>Selected Shot Order</h3>' +
      '<ul>' + (orderList || '<li>No selected shots</li>') + '</ul>' +
      '</div>' +
      '<div class="context-block">' +
      '<h3>Missing Context Warnings</h3>' +
      (warnings || '<div>No warnings</div>') +
      '</div>' +
      shotsHtml;
  }

  function bundleToMarkdown(bundle) {
    var order = (bundle.selectedShotOrder || []).map(function(s) {
      return '- ' + s.shotId + ': Variation ' + (s.selectedVariation || 'none');
    }).join('\n');
    var warnings = (bundle.warnings || []).map(function(w) {
      return '- \u26A0\uFE0F ' + w;
    }).join('\n');
    var shots = (bundle.shots || []).map(function(shot) {
      var refs = (shot.references || []).map(function(ref) {
        return '- ' + ref.type + ': ' + (ref.name || ref.id);
      }).join('\n') || '- none';
      var scriptText = (shot.scriptSnippet && (shot.scriptSnippet.what || shot.scriptSnippet.why)) || 'N/A';
      return '### ' + shot.shotId + '\n- Script: ' + scriptText + '\n- Transcript: ' + (shot.transcriptSnippet || 'N/A') + '\n- Active references:\n' + refs;
    }).join('\n\n');

    return '## AI Context Preview\n\n### Selected shot order\n' + (order || '- none') + '\n\n### Missing context warnings\n' + (warnings || '- none') + '\n\n' + shots;
  }

  function getProjectId() {
    var fromState = root.AppState && root.AppState.get('currentProject');
    if (fromState && fromState.id) return fromState.id;
    var sel = document.getElementById('projectSelector');
    if (sel && sel.value) return sel.value;
    try { return root.localStorage.getItem('activeProject') || 'default'; } catch (e) { return 'default'; }
  }

  function downloadJson(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  root.SharedUtils = {
    el: el,
    escapeHtml: escapeHtml,
    copyText: copyText,
    showToast: showToast,
    dismissToast: dismissToast,
    showLoading: showLoading,
    hideLoading: hideLoading,
    renderContextDrawer: renderContextDrawer,
    bundleToMarkdown: bundleToMarkdown,
    downloadJson: downloadJson,
    getProjectId: getProjectId
  };
})(typeof window !== 'undefined' ? window : globalThis);
