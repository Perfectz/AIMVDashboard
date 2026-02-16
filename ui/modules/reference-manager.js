(function(root) {
  'use strict';

  // Lazy accessors
  function getSharedUtils() { return root.SharedUtils; }
  function getAppState() { return root.AppState; }

  var el = getSharedUtils().el;

  // Module-local state
  var charactersData = [];
  var locationsData = [];
  var activeGenerations = new Set();

  // Prompt slot labels
  var PROMPT_SLOT_LABELS = ['Front View', '3/4 View', 'Close-Up'];

  // --- Service accessors (resolved lazily via window references set by app.js) ---
  var _getReferenceLibraryService = null;
  var _getReferenceFeature = null;
  var _getGenerationState = null;

  function init(deps) {
    _getReferenceLibraryService = deps.getReferenceLibraryService;
    _getReferenceFeature = deps.getReferenceFeature;
    _getGenerationState = deps.getGenerationState;
  }

  function getReferenceLibraryService() {
    return _getReferenceLibraryService ? _getReferenceLibraryService() : null;
  }

  function getReferenceFeature() {
    return _getReferenceFeature ? _getReferenceFeature() : null;
  }

  function getGenerationState() {
    return _getGenerationState ? _getGenerationState() : { canGenerate: false };
  }

  function getProjectState() {
    return { currentProject: getAppState().get('currentProject') };
  }

  // --- Character References ---

  async function loadCharactersReferences() {
    var projectState = getProjectState();
    if (!projectState.currentProject) return;

    try {
      var libraryService = getReferenceLibraryService();
      var result = await libraryService.listCharacters(projectState.currentProject.id);
      if (result.ok) {
        charactersData = (result.data && result.data.characters) || [];
        renderCharactersReferences();
      } else {
        getSharedUtils().showToast('Error', result.error || 'Failed to load character references', 'error', 3000);
      }
    } catch (err) {
      console.error('Error loading character references:', err);
    }
  }

  async function loadLocationReferences() {
    var projectState = getProjectState();
    if (!projectState.currentProject) return;

    try {
      var libraryService = getReferenceLibraryService();
      var result = await libraryService.listLocations(projectState.currentProject.id);
      if (result.ok) {
        locationsData = (result.data && result.data.locations) || [];
        renderLocationReferences();
      } else {
        getSharedUtils().showToast('Error', result.error || 'Failed to load location references', 'error', 3000);
      }
    } catch (err) {
      console.error('Error loading location references:', err);
    }
  }

  async function uploadLocationReferenceImage(locationName, slotNum, file) {
    if (!file) return;
    var projectState = getProjectState();
    try {
      var result = await getReferenceFeature().uploadLocationReference({
        projectId: projectState.currentProject.id,
        locationName: locationName,
        slotNum: slotNum,
        file: file
      });
      if (result.ok) {
        getSharedUtils().showToast('Uploaded', 'Location reference ' + slotNum + ' uploaded', 'success', 2000);
        await loadLocationReferences();
      } else {
        getSharedUtils().showToast('Upload failed', result.error || 'Unknown error', 'error', 4000);
      }
    } catch (err) {
      getSharedUtils().showToast('Upload failed', err.message, 'error', 4000);
    }
  }

  function buildLocationImageSlot(location, slotNum) {
    var projectState = getProjectState();
    var image = location.images.find(function(img) { return img.slot === slotNum; });
    var slot = document.createElement('div');
    slot.className = 'reference-image-slot' + (image ? ' has-image' : '');
    slot.style.position = 'relative';

    slot.addEventListener('click', function() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/jpg';
      input.style.display = 'none';
      input.addEventListener('change', function() {
        if (input.files[0]) uploadLocationReferenceImage(location.name, slotNum, input.files[0]);
        input.remove();
      });
      document.body.appendChild(input);
      input.click();
    });

    slot.addEventListener('dragover', function(e) { e.preventDefault(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragleave', function(e) { e.preventDefault(); slot.classList.remove('drag-over'); });
    slot.addEventListener('drop', function(e) {
      e.preventDefault();
      slot.classList.remove('drag-over');
      var file = e.dataTransfer.files[0];
      if (file) uploadLocationReferenceImage(location.name, slotNum, file);
    });

    if (image) {
      var img = document.createElement('img');
      img.src = '/projects/' + projectState.currentProject.id + '/reference/locations/' + encodeURIComponent(location.name) + '/' + image.filename;
      img.alt = location.name + ' reference ' + slotNum;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '8px';
      slot.appendChild(img);

      var delBtn = document.createElement('button');
      delBtn.className = 'reference-image-delete';
      delBtn.textContent = '\u00d7';
      delBtn.title = 'Delete image';
      delBtn.addEventListener('click', async function(e) {
        e.stopPropagation();
        var libraryService = getReferenceLibraryService();
        var result = await libraryService.deleteLocationImage(projectState.currentProject.id, location.name, slotNum);
        if (result.ok) loadLocationReferences();
        else getSharedUtils().showToast('Error', result.error || 'Failed to delete image', 'error', 4000);
      });
      slot.appendChild(delBtn);
    } else {
      var icon = document.createElement('div');
      icon.className = 'upload-icon';
      icon.textContent = '+';
      var label = document.createElement('div');
      label.className = 'upload-label';
      label.textContent = 'Ref ' + slotNum;
      slot.appendChild(icon);
      slot.appendChild(label);
    }

    return slot;
  }

  function renderLocationReferences() {
    var projectState = getProjectState();
    var container = el('locationsReferenceList');
    if (!container) return;

    if (locationsData.length === 0) {
      container.innerHTML = '<div class="empty-state-small">No location references yet. Add your first location.</div>';
      return;
    }

    container.innerHTML = '';

    locationsData.forEach(function(location) {
      var card = document.createElement('div');
      card.className = 'character-reference-card';

      var header = document.createElement('div');
      header.className = 'character-reference-header';

      var title = document.createElement('h3');
      title.className = 'character-reference-title';
      title.textContent = '\ud83d\udccd ' + location.name;

      var delBtn = document.createElement('button');
      delBtn.className = 'character-reference-delete';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async function() {
        if (!confirm('Delete location "' + location.name + '" and all references?')) return;
        var libraryService = getReferenceLibraryService();
        var result = await libraryService.deleteLocation(projectState.currentProject.id, location.name);
        if (result.ok) loadLocationReferences();
        else getSharedUtils().showToast('Error', result.error || 'Failed to delete location', 'error', 4000);
      });

      header.appendChild(title);
      header.appendChild(delBtn);

      var slotsWrap = document.createElement('div');
      slotsWrap.className = 'reference-images-grid';
      for (var i = 1; i <= 3; i++) slotsWrap.appendChild(buildLocationImageSlot(location, i));

      card.appendChild(header);
      card.appendChild(slotsWrap);
      container.appendChild(card);
    });
  }

  // --- Character definition/prompt copy ---

  async function copyCharacterDefinition(characterName) {
    var utils = getSharedUtils();
    var char = charactersData.find(function(c) { return c.name === characterName; });
    if (!char || !char.definition) {
      utils.showToast('Empty', 'No definition to copy', 'warning', 2000);
      return;
    }
    try {
      await utils.copyText(char.definition);
      utils.showToast('Copied!', characterName + ' definition copied', 'success', 2000);
    } catch (err) {
      utils.showToast('Copy failed', 'Could not copy to clipboard', 'error', 3000);
    }
  }

  async function copyCharacterPrompt(characterName, slot) {
    var utils = getSharedUtils();
    var char = charactersData.find(function(c) { return c.name === characterName; });
    if (!char || !char.prompts || !char.prompts[slot - 1]) {
      utils.showToast('Empty', 'No prompt to copy', 'warning', 2000);
      return;
    }
    try {
      await utils.copyText(char.prompts[slot - 1]);
      utils.showToast('Copied!', 'Prompt ' + slot + ' (' + PROMPT_SLOT_LABELS[slot - 1] + ') copied', 'success', 2000);
    } catch (err) {
      utils.showToast('Copy failed', 'Could not copy to clipboard', 'error', 3000);
    }
  }

  // --- Drag-and-drop upload for character reference images ---

  async function handleDragDropUpload(characterName, slotNum, file) {
    if (!file) return;
    var utils = getSharedUtils();
    var projectState = getProjectState();
    utils.showToast('Uploading', 'Uploading reference image...', 'info', 2000);

    try {
      var result = await getReferenceFeature().uploadCharacterReference({
        projectId: projectState.currentProject.id,
        characterName: characterName,
        slotNum: slotNum,
        file: file
      });
      if (result.ok) {
        utils.showToast('Uploaded', 'Reference image ' + slotNum + ' uploaded', 'success', 2000);
        await loadCharactersReferences();
      } else {
        utils.showToast('Upload failed', result.error || 'Unknown error', 'error', 4000);
      }
    } catch (err) {
      utils.showToast('Upload failed', err.message, 'error', 4000);
    }
  }

  function buildSectionHeader(icon, titleText) {
    var header = document.createElement('div');
    header.className = 'character-section-header';
    var iconSpan = document.createElement('span');
    iconSpan.className = 'character-section-icon';
    iconSpan.textContent = icon;
    var titleSpan = document.createElement('span');
    titleSpan.className = 'character-section-title';
    titleSpan.textContent = titleText;
    header.appendChild(iconSpan);
    header.appendChild(titleSpan);
    return header;
  }

  function openReferenceImageUpload(characterName, slotNum) {
    var input = el('refImg-' + characterName + '-' + slotNum);
    if (input) input.click();
  }

  async function handleReferenceImageUpload(characterName, slotNum, inputEl) {
    var file = inputEl.files[0];
    if (!file) return;
    var projectState = getProjectState();
    var utils = getSharedUtils();

    if (!projectState.currentProject) {
      utils.showToast('Error', 'No active project', 'error', 3000);
      return;
    }

    try {
      utils.showToast('Uploading', 'Uploading reference image...', 'info', 2000);
      var result = await getReferenceFeature().uploadCharacterReference({
        projectId: projectState.currentProject.id,
        characterName: characterName,
        slotNum: slotNum,
        file: file
      });

      if (result.ok) {
        utils.showToast('Success', 'Reference image uploaded', 'success', 3000);
        await loadCharactersReferences();
      } else {
        utils.showToast('Error', result.error || 'Upload failed', 'error', 4000);
      }
    } catch (err) {
      utils.showToast('Error', 'Failed to upload: ' + err.message, 'error', 4000);
    }

    inputEl.value = '';
  }

  async function deleteReferenceImage(characterName, slotNum) {
    if (!confirm('Delete reference image ' + slotNum + ' for ' + characterName + '?')) return;
    var projectState = getProjectState();
    var utils = getSharedUtils();

    try {
      var libraryService = getReferenceLibraryService();
      var result = await libraryService.deleteCharacterImage(projectState.currentProject.id, characterName, slotNum);
      if (result.ok) {
        utils.showToast('Success', 'Reference image deleted', 'success', 3000);
        await loadCharactersReferences();
      } else {
        utils.showToast('Error', result.error || 'Delete failed', 'error', 4000);
      }
    } catch (err) {
      utils.showToast('Error', 'Failed to delete: ' + err.message, 'error', 4000);
    }
  }

  async function deleteCharacterReference(characterName) {
    if (!confirm('Delete all reference images for ' + characterName + '?')) return;
    var projectState = getProjectState();
    var utils = getSharedUtils();

    try {
      var libraryService = getReferenceLibraryService();
      var result = await libraryService.deleteCharacter(projectState.currentProject.id, characterName);
      if (result.ok) {
        utils.showToast('Success', 'Character references deleted', 'success', 3000);
        await loadCharactersReferences();
      } else {
        utils.showToast('Error', result.error || 'Delete failed', 'error', 4000);
      }
    } catch (err) {
      utils.showToast('Error', 'Failed to delete: ' + err.message, 'error', 4000);
    }
  }

  // --- Build image slot (with generation support) ---

  function buildImageSlot(char, slotNum, generateImageFn) {
    var projectState = getProjectState();
    var genState = getGenerationState();
    var image = char.images.find(function(img) { return img.slot === slotNum; });
    var generatedImage = char.generatedImages ? char.generatedImages.find(function(img) { return img.slot === slotNum; }) : null;
    var displayImage = image || generatedImage;
    var isGenerating = activeGenerations.has(char.name + '-' + slotNum);

    var slot = document.createElement('div');
    slot.className = 'reference-image-slot' + (displayImage ? ' has-image' : '') + (isGenerating ? ' generating' : '');
    slot.style.position = 'relative';
    if (!isGenerating) {
      slot.addEventListener('click', function() { openReferenceImageUpload(char.name, slotNum); });
    }

    // Drag-and-drop events
    slot.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragenter', function(e) { e.preventDefault(); e.stopPropagation(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragleave', function(e) { e.preventDefault(); e.stopPropagation(); slot.classList.remove('drag-over'); });
    slot.addEventListener('drop', function(e) {
      e.preventDefault(); e.stopPropagation(); slot.classList.remove('drag-over');
      var file = e.dataTransfer.files[0];
      if (file) handleDragDropUpload(char.name, slotNum, file);
    });

    // Show spinner overlay when generating
    if (isGenerating) {
      var overlay = document.createElement('div');
      overlay.className = 'generating-overlay';
      var spinner = document.createElement('div');
      spinner.className = 'generating-spinner';
      var text = document.createElement('div');
      text.className = 'generating-text';
      text.textContent = 'Generating...';
      overlay.appendChild(spinner);
      overlay.appendChild(text);
      slot.appendChild(overlay);
    } else if (displayImage) {
      var img = document.createElement('img');
      img.src = '/projects/' + encodeURIComponent(projectState.currentProject.id) + '/reference/characters/' + encodeURIComponent(char.name) + '/' + encodeURIComponent(displayImage.filename);
      img.className = 'reference-image-preview';
      img.alt = char.name + ' reference ' + slotNum;
      slot.appendChild(img);

      // Badge for AI-generated images
      if (!image && generatedImage) {
        var badge = document.createElement('div');
        badge.className = 'ai-generated-badge';
        badge.textContent = 'AI Generated';
        slot.appendChild(badge);
      }

      var overlayEl = document.createElement('div');
      overlayEl.className = 'reference-image-overlay';
      var actions = document.createElement('div');
      actions.className = 'reference-image-actions';

      var delImgBtn = document.createElement('button');
      delImgBtn.className = 'btn btn-secondary btn-sm';
      delImgBtn.textContent = '\ud83d\uddd1\ufe0f Delete';
      delImgBtn.addEventListener('click', function(e) { e.stopPropagation(); deleteReferenceImage(char.name, slotNum); });

      var replaceBtn = document.createElement('button');
      replaceBtn.className = 'btn btn-primary btn-sm';
      replaceBtn.textContent = '\ud83d\udce4 Replace';
      replaceBtn.addEventListener('click', function(e) { e.stopPropagation(); openReferenceImageUpload(char.name, slotNum); });

      actions.appendChild(delImgBtn);
      actions.appendChild(replaceBtn);

      if (genState.canGenerate && generateImageFn) {
        var regenBtn = document.createElement('button');
        regenBtn.className = 'btn btn-generate btn-sm';
        regenBtn.textContent = 'Regenerate';
        regenBtn.addEventListener('click', function(e) { e.stopPropagation(); generateImageFn(char.name, slotNum); });
        actions.appendChild(regenBtn);
      }

      overlayEl.appendChild(actions);
      slot.appendChild(overlayEl);
    } else {
      var iconDiv = document.createElement('div');
      iconDiv.className = 'reference-slot-icon';
      iconDiv.textContent = '\ud83d\udcf7';
      var labelDiv = document.createElement('div');
      labelDiv.className = 'reference-slot-label';
      labelDiv.textContent = PROMPT_SLOT_LABELS[slotNum - 1];
      var hintDiv = document.createElement('div');
      hintDiv.className = 'reference-slot-hint';
      hintDiv.textContent = 'Click or drag & drop';
      slot.appendChild(iconDiv);
      slot.appendChild(labelDiv);
      slot.appendChild(hintDiv);

      if (genState.canGenerate && generateImageFn) {
        var hasPrompt = char.prompts && char.prompts[slotNum - 1];
        if (hasPrompt) {
          var genBtn = document.createElement('button');
          genBtn.className = 'btn btn-generate btn-sm reference-slot-generate';
          genBtn.textContent = 'AI Generate';
          genBtn.addEventListener('click', function(e) { e.stopPropagation(); generateImageFn(char.name, slotNum); });
          slot.appendChild(genBtn);
        }
      }
    }

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'refImg-' + char.name + '-' + slotNum;
    fileInput.accept = 'image/png,image/jpeg,image/jpg';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function() { handleReferenceImageUpload(char.name, slotNum, this); });
    slot.appendChild(fileInput);

    return slot;
  }

  function renderCharactersReferences(generateImageFn) {
    var genState = getGenerationState();
    var container = el('charactersReferenceList');
    if (!container) return;

    container.innerHTML = '';

    if (charactersData.length === 0) {
      var placeholder = document.createElement('div');
      placeholder.className = 'placeholder-content';
      var p = document.createElement('p');
      p.textContent = 'No characters added yet. Add a character above to get started.';
      placeholder.appendChild(p);
      container.appendChild(placeholder);
      return;
    }

    charactersData.forEach(function(char) {
      var card = document.createElement('div');
      card.className = 'character-reference-card';
      card.dataset.character = char.name;

      // === Card Header ===
      var header = document.createElement('div');
      header.className = 'character-reference-header';
      var title = document.createElement('h3');
      title.className = 'character-reference-title';
      title.textContent = '\ud83d\udc64 ' + char.name;
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'character-reference-delete';
      deleteBtn.textContent = '\ud83d\uddd1\ufe0f Delete Character';
      deleteBtn.addEventListener('click', function() { deleteCharacterReference(char.name); });
      header.appendChild(title);
      header.appendChild(deleteBtn);
      card.appendChild(header);

      // === Section 1: Character Definition ===
      var defSection = document.createElement('div');
      defSection.className = 'character-definition-section';
      defSection.appendChild(buildSectionHeader('\ud83d\udcdd', 'Character Definition'));

      if (char.definition) {
        var defText = document.createElement('div');
        defText.className = 'character-definition-text';
        defText.textContent = char.definition;
        defSection.appendChild(defText);

        var defActions = document.createElement('div');
        defActions.className = 'character-definition-actions';
        var copyDefBtn = document.createElement('button');
        copyDefBtn.className = 'btn btn-secondary btn-sm';
        copyDefBtn.textContent = '\ud83d\udccb Copy Definition';
        copyDefBtn.addEventListener('click', function() { copyCharacterDefinition(char.name); });
        defActions.appendChild(copyDefBtn);
        defSection.appendChild(defActions);
      } else {
        var defPlaceholder = document.createElement('div');
        defPlaceholder.className = 'character-definition-placeholder';
        defPlaceholder.textContent = 'No definition yet \u2014 use Claude Code to generate a character definition.';
        defSection.appendChild(defPlaceholder);
      }

      card.appendChild(defSection);

      // === Section 2: Reference Image Prompts ===
      var promptsSection = document.createElement('div');
      promptsSection.className = 'character-prompts-section';
      promptsSection.appendChild(buildSectionHeader('\ud83c\udfa8', 'Reference Image Prompts'));

      var promptsGrid = document.createElement('div');
      promptsGrid.className = 'character-prompts-grid';

      [1, 2, 3].forEach(function(slotNum) {
        var promptCard = document.createElement('div');
        promptCard.className = 'character-prompt-card';

        var label = document.createElement('div');
        label.className = 'character-prompt-label';
        var numBadge = document.createElement('span');
        numBadge.className = 'prompt-slot-num';
        numBadge.textContent = slotNum;
        var labelText = document.createElement('span');
        labelText.textContent = PROMPT_SLOT_LABELS[slotNum - 1];
        label.appendChild(numBadge);
        label.appendChild(labelText);
        promptCard.appendChild(label);

        var promptContent = char.prompts && char.prompts[slotNum - 1];
        if (promptContent) {
          var promptTextEl = document.createElement('div');
          promptTextEl.className = 'character-prompt-text';
          promptTextEl.textContent = promptContent;
          promptCard.appendChild(promptTextEl);

          var promptActions = document.createElement('div');
          promptActions.className = 'character-prompt-actions';
          var copyPromptBtn = document.createElement('button');
          copyPromptBtn.className = 'btn btn-secondary btn-sm';
          copyPromptBtn.textContent = '\ud83d\udccb Copy';
          (function(cn, sn) {
            copyPromptBtn.addEventListener('click', function() { copyCharacterPrompt(cn, sn); });
          })(char.name, slotNum);
          promptActions.appendChild(copyPromptBtn);

          if (genState.canGenerate && generateImageFn) {
            var genPromptBtn = document.createElement('button');
            genPromptBtn.className = 'btn btn-generate btn-sm';
            genPromptBtn.textContent = 'Generate';
            (function(cn, sn) {
              genPromptBtn.addEventListener('click', function() { generateImageFn(cn, sn); });
            })(char.name, slotNum);
            promptActions.appendChild(genPromptBtn);
          }

          promptCard.appendChild(promptActions);
        } else {
          var promptPlaceholder = document.createElement('div');
          promptPlaceholder.className = 'character-prompt-placeholder';
          promptPlaceholder.textContent = 'Not generated yet';
          promptCard.appendChild(promptPlaceholder);
        }

        promptsGrid.appendChild(promptCard);
      });

      promptsSection.appendChild(promptsGrid);
      card.appendChild(promptsSection);

      // === Section 3: Reference Images (with drag-and-drop) ===
      var imagesSection = document.createElement('div');
      imagesSection.className = 'reference-images-section';
      imagesSection.appendChild(buildSectionHeader('\ud83d\uddbc\ufe0f', 'Reference Images'));

      var grid = document.createElement('div');
      grid.className = 'reference-images-grid';

      [1, 2, 3].forEach(function(slotNum) {
        grid.appendChild(buildImageSlot(char, slotNum, generateImageFn));
      });

      imagesSection.appendChild(grid);
      card.appendChild(imagesSection);

      container.appendChild(card);
    });
  }

  function getActiveGenerations() {
    return activeGenerations;
  }

  function getCharactersData() {
    return charactersData;
  }

  function getLocationsData() {
    return locationsData;
  }

  root.ReferenceManager = {
    init: init,
    loadCharactersReferences: loadCharactersReferences,
    loadLocationReferences: loadLocationReferences,
    renderCharactersReferences: renderCharactersReferences,
    renderLocationReferences: renderLocationReferences,
    buildImageSlot: buildImageSlot,
    buildLocationImageSlot: buildLocationImageSlot,
    handleDragDropUpload: handleDragDropUpload,
    openReferenceImageUpload: openReferenceImageUpload,
    handleReferenceImageUpload: handleReferenceImageUpload,
    deleteReferenceImage: deleteReferenceImage,
    deleteCharacterReference: deleteCharacterReference,
    getActiveGenerations: getActiveGenerations,
    getCharactersData: getCharactersData,
    getLocationsData: getLocationsData,
    PROMPT_SLOT_LABELS: PROMPT_SLOT_LABELS
  };
})(typeof window !== 'undefined' ? window : globalThis);
