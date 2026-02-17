(function(root) {
  'use strict';

  // Lazy accessors for cross-module dependencies
  function getSharedUtils() { return root.SharedUtils; }
  function getAppState() { return root.AppState; }

  var el = getSharedUtils().el;

  function setupCanonTabs() {
    var tabs = document.querySelectorAll('.canon-tab');
    var tabContents = document.querySelectorAll('.canon-tab-content');

    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var tabName = tab.getAttribute('data-tab');

        // Update active tab
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');

        // Update active content
        tabContents.forEach(function(content) {
          if (content.id === 'tab-' + tabName) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        });
      });
    });
  }

  function normalizeShotLinks(shot) {
    if (!shot || typeof shot !== 'object') return shot;
    if (!shot.intent || typeof shot.intent !== 'object') shot.intent = {};
    if (!shot.intent.links || typeof shot.intent.links !== 'object') shot.intent.links = {};

    var links = shot.intent.links;
    if (!Array.isArray(links.transcriptSegments)) links.transcriptSegments = [];
    if (!Array.isArray(links.assets)) links.assets = [];
    if (!Array.isArray(links.references)) links.references = [];

    return shot;
  }

  function normalizeScriptData(scriptData) {
    if (!scriptData || typeof scriptData !== 'object') {
      return { version: '2026-02-08', shots: [], youtubeContentScript: '', transcriptBlocks: [] };
    }

    if (!Array.isArray(scriptData.shots)) scriptData.shots = [];
    scriptData.shots = scriptData.shots.map(normalizeShotLinks);

    if (typeof scriptData.youtubeContentScript !== 'string') scriptData.youtubeContentScript = '';
    if (!Array.isArray(scriptData.transcriptBlocks)) scriptData.transcriptBlocks = [];

    scriptData.transcriptBlocks = scriptData.transcriptBlocks
      .map(function(block, idx) {
        if (typeof block === 'string') {
          return { id: 'SEG_' + String(idx + 1).padStart(2, '0'), text: block };
        }
        var id = typeof block.id === 'string' && block.id.trim() ? block.id.trim() : 'SEG_' + String(idx + 1).padStart(2, '0');
        var text = typeof block.text === 'string' ? block.text : '';
        var timecode = typeof block.timecode === 'string' ? block.timecode : '';
        return { id: id, text: text, timecode: timecode };
      })
      .filter(function(block) { return block.text || block.id; });

    return scriptData;
  }

  function parseScriptJsonFromEditor() {
    var scriptTextarea = el('scriptJson');
    if (!scriptTextarea) return null;
    var raw = scriptTextarea.value.trim();
    if (!raw) return null;

    try {
      var parsed = JSON.parse(raw);
      return normalizeScriptData(parsed);
    } catch (err) {
      return null;
    }
  }

  function getTranscriptBlocksFromScriptData(scriptData) {
    if (Array.isArray(scriptData.transcriptBlocks) && scriptData.transcriptBlocks.length > 0) {
      return scriptData.transcriptBlocks;
    }

    var fallback = [];
    if (typeof scriptData.youtubeContentScript === 'string' && scriptData.youtubeContentScript.trim()) {
      scriptData.youtubeContentScript
        .split(/\n{2,}/)
        .map(function(part) { return part.trim(); })
        .filter(Boolean)
        .forEach(function(text, idx) {
          fallback.push({ id: 'SEG_' + String(idx + 1).padStart(2, '0'), text: text, timecode: '' });
        });
    }

    return fallback;
  }

  function jumpToTranscriptSegment(segmentId) {
    var segmentEl = document.querySelector('[data-transcript-segment-id="' + segmentId + '"]');
    if (!segmentEl) return;
    segmentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    segmentEl.classList.add('quick-jump-highlight');
    setTimeout(function() { segmentEl.classList.remove('quick-jump-highlight'); }, 1200);
  }

  function renderTranscriptBlocks(scriptData) {
    var transcriptBlocksEl = el('transcriptBlocks');
    if (!transcriptBlocksEl) return;

    var transcriptBlocks = getTranscriptBlocksFromScriptData(scriptData);
    transcriptBlocksEl.innerHTML = '';

    if (transcriptBlocks.length === 0) {
      transcriptBlocksEl.innerHTML = '<div class="transcript-empty">No transcript blocks yet.</div>';
      return;
    }

    transcriptBlocks.forEach(function(block) {
      var card = document.createElement('article');
      card.className = 'transcript-block-card';
      card.dataset.transcriptSegmentId = block.id;

      var header = document.createElement('div');
      header.className = 'transcript-block-header';

      var idEl = document.createElement('span');
      idEl.className = 'transcript-segment-id';
      idEl.textContent = block.id;

      header.appendChild(idEl);

      if (block.timecode) {
        var timecodeEl = document.createElement('span');
        timecodeEl.className = 'transcript-timecode';
        timecodeEl.textContent = block.timecode;
        header.appendChild(timecodeEl);
      }

      var textEl = document.createElement('p');
      textEl.className = 'transcript-block-text';
      textEl.textContent = block.text || '(empty segment)';

      card.appendChild(header);
      card.appendChild(textEl);
      transcriptBlocksEl.appendChild(card);
    });
  }

  function renderShotCards(scriptData) {
    var shotCardsEl = el('shotCards');
    if (!shotCardsEl) return;

    shotCardsEl.innerHTML = '';
    var shots = Array.isArray(scriptData.shots) ? scriptData.shots : [];

    if (shots.length === 0) {
      shotCardsEl.innerHTML = '<div class="transcript-empty">No shots found in script JSON.</div>';
      return;
    }

    shots.forEach(function(shot, idx) {
      normalizeShotLinks(shot);

      var card = document.createElement('article');
      card.className = 'shot-list-card';

      var title = document.createElement('h4');
      title.className = 'shot-list-card-title';
      var shotId = shot.id || shot.shotId || 'SHOT_' + String(idx + 1).padStart(2, '0');
      title.textContent = shotId + ' \u00b7 Shot ' + (shot.shotNumber || idx + 1);

      var intent = document.createElement('p');
      intent.className = 'shot-list-card-intent';
      intent.textContent = (shot.intent && shot.intent.what) || (shot.intent && shot.intent.why) || 'No intent summary yet.';

      var chipGroup = document.createElement('div');
      chipGroup.className = 'shot-link-chip-group';

      var addChip = function(label, values, jumpable) {
        var chip = document.createElement('div');
        chip.className = 'shot-link-chip';

        var badge = document.createElement('span');
        badge.className = 'shot-link-chip-badge';
        badge.textContent = label + ': ' + values.length;
        chip.appendChild(badge);

        if (values.length) {
          var list = document.createElement('div');
          list.className = 'shot-link-chip-items';
          values.forEach(function(val) {
            var item = document.createElement(jumpable ? 'button' : 'span');
            item.className = jumpable ? 'quick-jump-chip' : 'shot-link-value';
            item.textContent = val;
            if (jumpable) {
              item.type = 'button';
              item.addEventListener('click', function() { jumpToTranscriptSegment(val); });
            }
            list.appendChild(item);
          });
          chip.appendChild(list);
        }

        chipGroup.appendChild(chip);
      };

      var transcriptSegments = shot.intent.links.transcriptSegments.map(String);
      var assets = shot.intent.links.assets.map(String);
      var references = shot.intent.links.references.map(String);

      addChip('Transcript', transcriptSegments, true);
      addChip('Assets', assets, false);
      addChip('Refs', references, false);

      card.appendChild(title);
      card.appendChild(intent);
      card.appendChild(chipGroup);
      shotCardsEl.appendChild(card);
    });
  }

  function syncScriptEditorViews() {
    var scriptTextarea = el('scriptJson');
    if (!scriptTextarea) return;

    var parsed = parseScriptJsonFromEditor();
    if (!parsed) return;

    var youtubeScriptEl = el('youtubeContentScript');
    if (youtubeScriptEl && document.activeElement !== youtubeScriptEl) {
      youtubeScriptEl.value = parsed.youtubeContentScript || '';
    }

    renderTranscriptBlocks(parsed);
    renderShotCards(parsed);
  }

  function buildScriptJsonFromViews() {
    var scriptTextarea = el('scriptJson');
    if (!scriptTextarea) return '';

    var base = parseScriptJsonFromEditor() || normalizeScriptData({});
    var youtubeScriptEl = el('youtubeContentScript');
    base.youtubeContentScript = youtubeScriptEl ? youtubeScriptEl.value : base.youtubeContentScript;

    if (!Array.isArray(base.transcriptBlocks) || base.transcriptBlocks.length === 0) {
      base.transcriptBlocks = getTranscriptBlocksFromScriptData(base);
    }

    base.shots = (base.shots || []).map(normalizeShotLinks);
    return JSON.stringify(base, null, 2);
  }

  function setupCanonShortcutLinks() {
    var scriptTextarea = el('scriptJson');
    if (!scriptTextarea) return;

    scriptTextarea.addEventListener('input', syncScriptEditorViews);

    var youtubeScriptEl = el('youtubeContentScript');
    if (youtubeScriptEl) {
      youtubeScriptEl.addEventListener('input', function() {
        var scriptTextareaEl = el('scriptJson');
        if (!scriptTextareaEl) return;
        var merged = buildScriptJsonFromViews();
        if (!merged) return;
        scriptTextareaEl.value = merged;
        syncScriptEditorViews();
      });
    }
  }

  // --- Pipeline action handlers ---

  function setupPipelineActions() {
    var generateBtn = document.getElementById('generateShotPlanBtn');
    var compileBtn = document.getElementById('autoCompileBtn');
    if (!generateBtn && !compileBtn) return;

    var HttpClient = root.HttpClient;
    var state = getAppState();
    var projectId = state && state.get ? state.get('currentProject') : 'default';

    if (generateBtn) {
      generateBtn.addEventListener('click', async function() {
        var statusEl = document.getElementById('shotPlanStatus');
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        if (statusEl) statusEl.textContent = '';
        try {
          var res = await HttpClient.post('/api/pipeline/generate-shot-plan', { project: projectId });
          if (res.success) {
            if (statusEl) statusEl.textContent = 'Generated ' + res.totalShots + ' shots from ' + res.sectionCount + ' sections';
            if (root.UILayer && root.UILayer.showToast) root.UILayer.showToast('Shot plan generated: ' + res.totalShots + ' shots', 'success');
          } else {
            if (statusEl) statusEl.textContent = 'Error: ' + (res.error || 'Unknown');
            if (root.UILayer && root.UILayer.showToast) root.UILayer.showToast(res.error || 'Failed to generate shot plan', 'error');
          }
        } catch (err) {
          if (statusEl) statusEl.textContent = 'Error: ' + (err.message || 'Request failed');
        }
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Shot Plan';
      });
    }

    if (compileBtn) {
      compileBtn.addEventListener('click', async function() {
        var statusEl = document.getElementById('compileStatus');
        compileBtn.disabled = true;
        compileBtn.textContent = 'Compiling...';
        if (statusEl) statusEl.textContent = '';
        try {
          var res = await HttpClient.post('/api/pipeline/auto-compile', { project: projectId });
          if (res.success) {
            var promptCount = res.status && res.status.promptCount ? res.status.promptCount : 0;
            if (statusEl) statusEl.textContent = 'Compiled successfully (' + promptCount + ' prompts)';
            if (root.UILayer && root.UILayer.showToast) root.UILayer.showToast('Prompts compiled successfully', 'success');
          } else {
            var errMsg = 'Compile failed';
            if (res.compile && !res.compile.success) errMsg = 'Compile step failed';
            if (res.reindex && !res.reindex.success) errMsg = 'Reindex step failed';
            if (statusEl) statusEl.textContent = errMsg;
            if (root.UILayer && root.UILayer.showToast) root.UILayer.showToast(errMsg, 'error');
          }
        } catch (err) {
          if (statusEl) statusEl.textContent = 'Error: ' + (err.message || 'Request failed');
        }
        compileBtn.disabled = false;
        compileBtn.textContent = 'Compile Now';
      });
    }
  }

  root.CanonEditor = {
    setupCanonTabs: setupCanonTabs,
    normalizeShotLinks: normalizeShotLinks,
    normalizeScriptData: normalizeScriptData,
    parseScriptJsonFromEditor: parseScriptJsonFromEditor,
    getTranscriptBlocksFromScriptData: getTranscriptBlocksFromScriptData,
    jumpToTranscriptSegment: jumpToTranscriptSegment,
    renderTranscriptBlocks: renderTranscriptBlocks,
    renderShotCards: renderShotCards,
    syncScriptEditorViews: syncScriptEditorViews,
    buildScriptJsonFromViews: buildScriptJsonFromViews,
    setupCanonShortcutLinks: setupCanonShortcutLinks,
    setupPipelineActions: setupPipelineActions
  };
})(typeof window !== 'undefined' ? window : globalThis);
