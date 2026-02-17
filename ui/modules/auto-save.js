/**
 * Auto-save module — debounced saves with inline status indicators.
 * Replaces manual "Save" buttons on all text input cards.
 *
 * Usage:
 *   AutoSave.attach(textarea, { type: 'content', contentType: 'concept', projectGetter })
 *   AutoSave.attach(textarea, { type: 'canon', canonType: 'characters', projectGetter })
 */
window.AutoSave = (function () {
  'use strict';

  const timers = new Map();
  const dirtyFields = new Set();
  const DEBOUNCE_MS = 800;
  const SAVED_DISPLAY_MS = 2500;
  let autoSaveService = null;

  function getAutoSaveService() {
    if (autoSaveService) return autoSaveService;
    if (!window.AutoSaveService || !window.AutoSaveService.createAutoSaveService) {
      throw new Error('AutoSaveService.createAutoSaveService is required');
    }
    autoSaveService = window.AutoSaveService.createAutoSaveService();
    return autoSaveService;
  }

  function createIndicator(textarea) {
    let indicator = textarea.parentElement.querySelector('.auto-save-indicator');
    if (indicator) return indicator;
    indicator = document.createElement('span');
    indicator.className = 'auto-save-indicator';
    textarea.parentElement.appendChild(indicator);
    return indicator;
  }

  function setStatus(indicator, state, text) {
    indicator.textContent = text || '';
    indicator.className = 'auto-save-indicator' + (state ? ' ' + state : '');
  }

  async function saveContent(projectId, contentType, content) {
    const result = await getAutoSaveService().saveContent(projectId, contentType, content);
    if (!result.ok) throw new Error(result.error || 'Save failed');
    return result.data || {};
  }

  async function saveCanon(projectId, canonType, content) {
    const result = await getAutoSaveService().saveCanon(projectId, canonType, content);
    if (!result.ok) throw new Error(result.error || 'Save failed');
    return result.data || {};
  }

  /**
   * Attach auto-save to a textarea.
   * @param {HTMLTextAreaElement} textarea
   * @param {Object} opts
   * @param {'content'|'canon'} opts.type - 'content' for /api/save/:type, 'canon' for /api/save/canon/:type
   * @param {string} [opts.contentType] - e.g. 'concept', 'suno-prompt'
   * @param {string} [opts.canonType] - e.g. 'characters', 'style'
   * @param {Function} opts.projectGetter - returns current project ID
   * @param {string} [opts.statusElementId] - optional existing status element to update
   */
  function createCharCounter(textarea, maxChars) {
    let counter = textarea.parentElement.querySelector('.char-counter');
    if (counter) return counter;
    counter = document.createElement('span');
    counter.className = 'char-counter';
    textarea.parentElement.appendChild(counter);
    function update() {
      const len = textarea.value.length;
      counter.textContent = maxChars ? len + ' / ' + maxChars : len + ' chars';
      counter.classList.toggle('char-counter-warn', maxChars > 0 && len > maxChars * 0.9);
      counter.classList.toggle('char-counter-over', maxChars > 0 && len > maxChars);
    }
    textarea.addEventListener('input', update);
    update();
    return counter;
  }

  function attach(textarea, opts) {
    if (!textarea) return;
    const indicator = createIndicator(textarea);
    createCharCounter(textarea, opts.maxChars || 0);

    textarea.addEventListener('input', () => {
      clearTimeout(timers.get(textarea));
      setStatus(indicator, 'pending', '');
      dirtyFields.add(textarea);

      timers.set(textarea, setTimeout(async () => {
        const content = textarea.value.trim();
        if (!content) { dirtyFields.delete(textarea); return; }

        const projectId = opts.projectGetter();
        if (!projectId) return;

        setStatus(indicator, 'saving', 'Saving\u2026');

        try {
          if (opts.type === 'canon') {
            await saveCanon(projectId, opts.canonType, content);
          } else {
            await saveContent(projectId, opts.contentType, content);
          }
          dirtyFields.delete(textarea);
          setStatus(indicator, 'saved', '\u2713 Saved');
          setTimeout(() => setStatus(indicator, '', ''), SAVED_DISPLAY_MS);

          // Also update legacy status element if present
          if (opts.statusElementId) {
            const el = document.getElementById(opts.statusElementId);
            if (el) {
              el.textContent = '\u2713 Saved (' + content.length + ' chars)';
              el.className = 'text-input-status success';
            }
          }
        } catch (err) {
          const msg = err.message.includes('JSON')
            ? 'Invalid JSON'
            : 'Save failed';
          setStatus(indicator, 'failed', '\u2717 ' + msg);
        }
      }, DEBOUNCE_MS));
    });
  }

  function hasDirtyFields() {
    return dirtyFields.size > 0;
  }

  return { attach, hasDirtyFields };
})();
