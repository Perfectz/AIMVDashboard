(function(root) {
  'use strict';

  // Lazy accessors for cross-module dependencies
  function getSharedUtils() { return root.SharedUtils; }
  function getAppState() { return root.AppState; }
  var lintReportService = null;

  function getLintReportService() {
    if (lintReportService) return lintReportService;
    if (!root.LintReportService || !root.LintReportService.createLintReportService) {
      throw new Error('LintReportService.createLintReportService is required');
    }
    lintReportService = root.LintReportService.createLintReportService();
    return lintReportService;
  }

  var el = getSharedUtils().el;

  var PLATFORM_LABELS = {
    all: 'All Platforms',
    kling: 'Kling 3.0',
    nanobanana: 'Nano Banana',
    suno: 'Suno',
    seedream: 'SeedDream 4.5'
  };

  function getShotLintState(shot) {
    var shotPrompts = Object.values(shot.variations || {}).flat();
    var hasFail = shotPrompts.some(function(prompt) { return prompt.lintStatus === 'FAIL'; });
    var hasPass = shotPrompts.some(function(prompt) { return prompt.lintStatus === 'PASS'; });
    if (hasFail) return 'FAIL';
    if (hasPass) return 'PASS';
    return 'UNKNOWN';
  }

  function getFilteredShots(promptsState) {
    if (!promptsState.indexData || !Array.isArray(promptsState.indexData.shots)) return [];
    var searchInput = el('search');
    var searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();

    return promptsState.indexData.shots.filter(function(shot) {
      if (searchTerm && !shot.shotId.toLowerCase().includes(searchTerm)) {
        return false;
      }

      if (promptsState.currentLintFilter !== 'all') {
        var lintState = getShotLintState(shot);
        if (promptsState.currentLintFilter === 'fail' && lintState !== 'FAIL') return false;
        if (promptsState.currentLintFilter === 'pass' && lintState !== 'PASS') return false;
      }

      var hasKling = shot.variations.kling && shot.variations.kling.length > 0;
      var hasNano = shot.variations.nanobanana && shot.variations.nanobanana.length > 0;
      var hasSuno = shot.variations.suno && shot.variations.suno.length > 0;
      var hasSeedream = shot.variations.seedream && shot.variations.seedream.length > 0;

      if (promptsState.currentPlatform !== 'all') {
        return (
          (promptsState.currentPlatform === 'kling' && hasKling) ||
          (promptsState.currentPlatform === 'nanobanana' && hasNano) ||
          (promptsState.currentPlatform === 'suno' && hasSuno) ||
          (promptsState.currentPlatform === 'seedream' && hasSeedream)
        );
      }

      return hasKling || hasNano || hasSuno || hasSeedream;
    });
  }

  function renderShotList(promptsState, selectShotFn) {
    var shotList = el('shotList');
    var shotSelector = el('shotSelector');
    if (!shotList) return;
    var filteredShots = getFilteredShots(promptsState);

    if (!promptsState.indexData || !promptsState.indexData.shots || promptsState.indexData.shots.length === 0 || filteredShots.length === 0) {
      shotList.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">No shots match these filters. Adjust platform, lint state, or search.</p>';
      if (shotSelector) {
        shotSelector.innerHTML = '<option value="">Select a shot...</option>';
      }
      promptsState.currentShot = null;
      promptsState.currentTool = null;
      return filteredShots;
    }

    shotList.innerHTML = '';
    if (shotSelector) {
      shotSelector.innerHTML = '<option value="">Select a shot...</option>';
    }

    filteredShots.forEach(function(shot) {
      var hasKling = shot.variations.kling && shot.variations.kling.length > 0;
      var hasNano = shot.variations.nanobanana && shot.variations.nanobanana.length > 0;
      var hasSuno = shot.variations.suno && shot.variations.suno.length > 0;
      var hasSeedream = shot.variations.seedream && shot.variations.seedream.length > 0;
      var tags = [];
      if (hasKling) tags.push({ className: 'kling', text: 'Kling (' + shot.variations.kling.length + ')' });
      if (hasNano) tags.push({ className: 'nanobanana', text: 'Nano (' + shot.variations.nanobanana.length + ')' });
      if (hasSuno) tags.push({ className: 'suno', text: 'Suno (' + shot.variations.suno.length + ')' });
      if (hasSeedream) tags.push({ className: 'seedream', text: 'SeedDream (' + shot.variations.seedream.length + ')' });

      if (root.UILayer && root.UILayer.createShotSidebarItem) {
        var shotItem = root.UILayer.createShotSidebarItem({
          shotId: shot.shotId,
          active: Boolean(promptsState.currentShot && promptsState.currentShot.shotId === shot.shotId),
          tags: tags,
          onClick: function() { selectShotFn(shot); }
        });
        shotItem.dataset.shotId = shot.shotId;
        shotList.appendChild(shotItem);
      } else {
        var shotItem = document.createElement('div');
        shotItem.className = 'shot-item';
        shotItem.dataset.shotId = shot.shotId;
        if (promptsState.currentShot && promptsState.currentShot.shotId === shot.shotId) shotItem.classList.add('active');

        var header = document.createElement('div');
        header.className = 'shot-item-header';
        header.textContent = shot.shotId;

        var tools = document.createElement('div');
        tools.className = 'shot-item-tools';
        tags.forEach(function(tagData) {
          var tag = document.createElement('span');
          tag.className = 'tool-tag ' + tagData.className;
          tag.textContent = tagData.text;
          tools.appendChild(tag);
        });

        shotItem.appendChild(header);
        shotItem.appendChild(tools);
        shotItem.addEventListener('click', function() { selectShotFn(shot); });
        shotList.appendChild(shotItem);
      }

      if (shotSelector) {
        var option = document.createElement('option');
        option.value = shot.shotId;
        option.textContent = shot.shotId + ' - ' + getShotLintState(shot);
        option.selected = Boolean(promptsState.currentShot && promptsState.currentShot.shotId === shot.shotId);
        shotSelector.appendChild(option);
      }
    });

    return filteredShots;
  }

  function getCurrentPrompt(promptsState) {
    if (!promptsState.currentShot || !promptsState.currentTool) return null;

    var prompts = promptsState.currentShot.variations[promptsState.currentTool];
    if (!prompts || prompts.length === 0) return null;

    // For tools with variations (Kling, SeedDream), find by variation
    if (promptsState.currentTool === 'kling' || promptsState.currentTool === 'seedream') {
      var prompt = prompts.find(function(p) { return p.variation === promptsState.currentVariation; });
      return prompt || prompts[0];
    }

    // For others, just return first
    return prompts[0];
  }

  /**
   * Update variation button states
   */
  function updateVariationButtons(promptsState) {
    var buttons = document.querySelectorAll('.variation-btn');
    // Get available variations for current shot+tool
    var available = new Set();
    if (promptsState.currentShot && promptsState.currentTool) {
      var prompts = promptsState.currentShot.variations[promptsState.currentTool] || [];
      prompts.forEach(function(p) { if (p.variation) available.add(p.variation); });
    }

    buttons.forEach(function(btn) {
      var variation = btn.dataset.variation;
      // Hide buttons for variations that don't exist
      if (available.size > 0 && !available.has(variation)) {
        btn.style.display = 'none';
      } else {
        btn.style.display = '';
      }
      if (variation === promptsState.currentVariation) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Parse and render prompt sections
   */
  function renderPromptSections(content, tool) {
    var promptText = el('promptText');
    if (!promptText) return;

    // Define section patterns for different tools
    var sectionPatterns = {
      kling: [
        { name: 'Kling Prompt', icon: 'KL', pattern: /--- KLING PROMPT ---\s*\n([\s\S]*?)(?=--- NEGATIVE PROMPT|$)/ },
        { name: 'Negative Prompt', icon: 'No', pattern: /--- NEGATIVE PROMPT ---\s*\n([\s\S]*?)(?=--- DIRECTOR NOTES|$)/ },
        { name: 'Director Notes', icon: 'Note', pattern: /--- DIRECTOR NOTES ---\s*\n([\s\S]*?)$/ }
      ],
      nanobanana: [
        { name: 'Scene Description', icon: 'Scene', pattern: /^(.*?)(?=Style:|Negative Prompt:|$)/s },
        { name: 'Style', icon: 'Style', pattern: /Style:(.*?)(?=Negative Prompt:|$)/s },
        { name: 'Negative Prompt', icon: 'No', pattern: /Negative Prompt:(.*?)$/s }
      ],
      suno: [
        { name: 'Full Prompt', icon: 'Music', pattern: /^(.*)$/s }
      ],
      seedream: [
        { name: 'SeedDream Prompt', icon: 'SD', pattern: /--- SEEDREAM PROMPT ---\s*\n([\s\S]*?)(?=--- FIRST FRAME|$)/ },
        { name: 'First Frame', icon: 'KL', pattern: /--- FIRST FRAME[^-]*---\s*\n([\s\S]*?)(?=--- LAST FRAME|$)/ },
        { name: 'Last Frame', icon: 'End', pattern: /--- LAST FRAME[^-]*---\s*\n([\s\S]*?)(?=--- NEGATIVE PROMPT|$)/ },
        { name: 'Negative Prompt', icon: 'No', pattern: /--- NEGATIVE PROMPT ---\s*\n([\s\S]*?)(?=--- DIRECTOR NOTES|$)/ },
        { name: 'Director Notes', icon: 'Note', pattern: /--- DIRECTOR NOTES ---\s*\n([\s\S]*?)$/ }
      ]
    };

    var patterns = sectionPatterns[tool] || sectionPatterns.kling;
    var sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'prompt-sections';

    var hasValidSections = false;

    patterns.forEach(function(entry) {
      var match = content.match(entry.pattern);
      if (match && match[1] && match[1].trim()) {
        hasValidSections = true;
        var section = createPromptSection(entry.name, entry.icon, match[1].trim());
        sectionsContainer.appendChild(section);
      }
    });

    // If no sections matched, show raw content
    if (!hasValidSections) {
      promptText.textContent = content;
    } else {
      promptText.textContent = '';
      promptText.appendChild(sectionsContainer);
    }
  }

  /**
   * Create a prompt section element
   */
  function createPromptSection(title, icon, content) {
    var utils = getSharedUtils();
    var section = document.createElement('div');
    section.className = 'prompt-section';

    var header = document.createElement('div');
    header.className = 'prompt-section-header';
    var titleDiv = document.createElement('div');
    titleDiv.className = 'prompt-section-title';
    var iconSpan = document.createElement('span');
    iconSpan.className = 'prompt-section-icon';
    iconSpan.textContent = icon;
    var titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    titleDiv.appendChild(iconSpan);
    titleDiv.appendChild(titleSpan);
    var toggleSpan = document.createElement('span');
    toggleSpan.className = 'prompt-section-toggle';
    toggleSpan.textContent = '\u25bc';
    header.appendChild(titleDiv);
    header.appendChild(toggleSpan);

    var body = document.createElement('div');
    body.className = 'prompt-section-body';

    var contentEl = document.createElement('div');
    contentEl.className = 'prompt-section-content';
    contentEl.textContent = content;

    var actions = document.createElement('div');
    actions.className = 'prompt-section-actions';

    var copyBtn = document.createElement('button');
    copyBtn.className = 'btn-small';
    copyBtn.textContent = 'Copy Section';
    copyBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      utils.copyText(content).then(function() {
        utils.showToast('Copied!', title + ' copied to clipboard', 'success', 2000);
      }).catch(function() {
        utils.showToast('Failed to copy', 'Could not copy section', 'error', 3000);
      });
    });

    actions.appendChild(copyBtn);
    body.appendChild(contentEl);
    body.appendChild(actions);

    section.appendChild(header);
    section.appendChild(body);

    // Toggle collapse
    header.addEventListener('click', function() {
      section.classList.toggle('collapsed');
    });

    return section;
  }

  /**
   * Load and display lint errors for a prompt
   */
  function loadLintErrors(promptPath, projectState) {
    var lintErrorsList = el('lintErrorsList');
    if (!lintErrorsList) return;

    var projectId = projectState.currentProject ? projectState.currentProject.id : '';
    getLintReportService().loadLintReport(projectId)
      .then(function(result) {
        if (!result || !result.ok || !result.data) return;
        var report = result.data;
        var promptValidation = report.promptValidation || [];
        var promptResult = promptValidation.find(function(p) { return p.file === promptPath; });
        if (promptResult && promptResult.errors && promptResult.errors.length > 0) {
          lintErrorsList.innerHTML = '';
          promptResult.errors.forEach(function(err) {
            var li = document.createElement('li');
            li.textContent = '[' + err.rule + '] ' + err.message;
            lintErrorsList.appendChild(li);
          });
        }
      })
      .catch(function(err) {
        console.error('Failed to load lint report:', err);
      });
  }

  /**
   * Copy prompt to clipboard
   */
  function copyToClipboard() {
    var utils = getSharedUtils();
    var promptTextEl = el('promptText');
    // Get all section content
    var sections = document.querySelectorAll('.prompt-section-content');
    var fullText = '';

    if (sections.length > 0) {
      sections.forEach(function(section) {
        fullText += section.textContent + '\n\n';
      });
    } else if (promptTextEl) {
      fullText = promptTextEl.textContent;
    }

    utils.copyText(fullText.trim()).then(function() {
      utils.showToast('Copied!', 'Shot text copied to clipboard', 'success', 2000);
    }).catch(function() {
      utils.showToast('Failed to copy', 'Could not copy shot text to clipboard', 'error', 3000);
    });
  }

  root.PromptViewer = {
    PLATFORM_LABELS: PLATFORM_LABELS,
    getShotLintState: getShotLintState,
    getFilteredShots: getFilteredShots,
    renderShotList: renderShotList,
    getCurrentPrompt: getCurrentPrompt,
    updateVariationButtons: updateVariationButtons,
    renderPromptSections: renderPromptSections,
    createPromptSection: createPromptSection,
    loadLintErrors: loadLintErrors,
    copyToClipboard: copyToClipboard
  };
})(typeof window !== 'undefined' ? window : globalThis);
