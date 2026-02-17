(function(root) {
  'use strict';

  // Lazy accessors
  function getSharedUtils() { return root.SharedUtils; }
  function getAppState() { return root.AppState; }

  const el = getSharedUtils().el;

  // Module-local state
  let charactersData = [];
  let locationsData = [];
  const activeGenerations = new Set();

  // Prompt slot labels
  const PROMPT_SLOT_LABELS = ['Front View', '3/4 View', 'Close-Up'];
  const LOCATION_PROMPT_SLOT_LABELS = ['Wide Shot', 'Detail Shot', 'Atmosphere'];
  const DEFAULT_REFERENCE_SLOT_COUNT = 4;
  const MAX_REFERENCE_SLOT_COUNT = 14;

  function fileListToArray(fileList) {
    return Array.prototype.slice.call(fileList || []);
  }

  function normalizeFiles(fileCollection) {
    if (!fileCollection) return [];
    if (Array.isArray(fileCollection)) return fileCollection.filter(Boolean);
    if (typeof fileCollection.length === 'number') return fileListToArray(fileCollection).filter(Boolean);
    return [fileCollection];
  }

  function normalizeSlotNumber(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return 1;
    if (parsed > MAX_REFERENCE_SLOT_COUNT) return MAX_REFERENCE_SLOT_COUNT;
    return parsed;
  }

  function getHighestSlot(entity) {
    let maxSlot = 0;
    const collections = [entity && entity.images, entity && entity.generatedImages];
    collections.forEach(function(collection) {
      if (!Array.isArray(collection)) return;
      collection.forEach(function(item) {
        const slot = parseInt(item && item.slot, 10);
        if (Number.isInteger(slot) && slot > maxSlot) {
          maxSlot = slot;
        }
      });
    });
    return maxSlot;
  }

  function getVisibleSlotCount(entity) {
    let highestSlot = getHighestSlot(entity);
    if (highestSlot > MAX_REFERENCE_SLOT_COUNT) highestSlot = MAX_REFERENCE_SLOT_COUNT;
    return Math.max(DEFAULT_REFERENCE_SLOT_COUNT, highestSlot);
  }

  function getReferenceSlotLabel(slotNum, labels) {
    const explicit = labels && labels[slotNum - 1];
    return explicit || ('Reference ' + slotNum);
  }

  function getReferenceInputId(characterName, slotNum) {
    return 'refImg-' + encodeURIComponent(String(characterName || '')) + '-' + String(slotNum || '');
  }

  // --- Service accessors (resolved lazily via window references set by app.js) ---
  let _getReferenceLibraryService = null;
  let _getReferenceFeature = null;
  let _getGenerationState = null;

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
    const projectState = getProjectState();
    if (!projectState.currentProject) return;

    try {
      const libraryService = getReferenceLibraryService();
      const result = await libraryService.listCharacters(projectState.currentProject.id);
      if (result.ok) {
        charactersData = (result.data && result.data.characters) || [];
        renderCharactersReferences();
      } else {
        getSharedUtils().showToast('Error', result.error || 'Failed to load character references', 'error', 3000);
      }
    } catch (err) {
      /* silently handled */
    }
  }

  async function loadLocationReferences() {
    const projectState = getProjectState();
    if (!projectState.currentProject) return;

    try {
      const libraryService = getReferenceLibraryService();
      const result = await libraryService.listLocations(projectState.currentProject.id);
      if (result.ok) {
        locationsData = (result.data && result.data.locations) || [];
        renderLocationReferences();
      } else {
        getSharedUtils().showToast('Error', result.error || 'Failed to load location references', 'error', 3000);
      }
    } catch (err) {
      /* silently handled */
    }
  }

  async function uploadLocationReferenceImage(locationName, slotNum, file, options) {
    if (!file) return { ok: false, error: 'No file selected' };
    const opts = options || {};
    const projectState = getProjectState();
    if (!projectState.currentProject) {
      if (!opts.suppressToast) {
        getSharedUtils().showToast('Upload failed', 'No active project', 'error', 4000);
      }
      return { ok: false, error: 'No active project' };
    }
    try {
      const result = await getReferenceFeature().uploadLocationReference({
        projectId: projectState.currentProject.id,
        locationName: locationName,
        slotNum: slotNum,
        file: file
      });
      if (result.ok) {
        if (!opts.suppressToast) {
          getSharedUtils().showToast('Uploaded', 'Location reference ' + slotNum + ' uploaded', 'success', 2000);
        }
        if (!opts.suppressReload) {
          await loadLocationReferences();
        }
        return { ok: true };
      } else {
        if (!opts.suppressToast) {
          getSharedUtils().showToast('Upload failed', result.error || 'Unknown error', 'error', 4000);
        }
        return { ok: false, error: result.error || 'Unknown error' };
      }
    } catch (err) {
      if (!opts.suppressToast) {
        getSharedUtils().showToast('Upload failed', err.message, 'error', 4000);
      }
      return { ok: false, error: err.message };
    }
  }

  async function uploadLocationReferenceImages(locationName, startSlotNum, files) {
    const utils = getSharedUtils();
    const startSlot = normalizeSlotNumber(startSlotNum);
    const normalizedFiles = normalizeFiles(files);
    if (normalizedFiles.length === 0) return;

    const maxUploads = Math.max(0, MAX_REFERENCE_SLOT_COUNT - startSlot + 1);
    const uploadQueue = normalizedFiles.slice(0, maxUploads);
    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < uploadQueue.length; i++) {
      const slot = startSlot + i;
      const result = await uploadLocationReferenceImage(locationName, slot, uploadQueue[i], {
        suppressToast: uploadQueue.length > 1,
        suppressReload: true
      });
      if (result && result.ok) uploadedCount++;
      else failedCount++;
    }

    if (uploadQueue.length > 0) {
      await loadLocationReferences();
    }

    if (uploadQueue.length > 1) {
      if (uploadedCount > 0) {
        utils.showToast('Uploaded', uploadedCount + ' location reference image(s) uploaded', 'success', 2500);
      }
      if (failedCount > 0) {
        utils.showToast('Partial upload', failedCount + ' image(s) failed to upload', 'warning', 3500);
      }
    }

    if (normalizedFiles.length > uploadQueue.length) {
      utils.showToast('Limit reached', 'Only slots 1-' + MAX_REFERENCE_SLOT_COUNT + ' are available', 'warning', 3500);
    }
  }

  function buildLocationImageSlot(location, slotNum) {
    const projectState = getProjectState();
    const image = location.images.find(function(img) { return Number(img.slot) === slotNum; });
    const slot = document.createElement('div');
    slot.className = 'reference-image-slot' + (image ? ' has-image' : '');
    slot.style.position = 'relative';

    slot.addEventListener('click', function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/jpg,image/webp';
      input.multiple = true;
      input.style.display = 'none';
      input.addEventListener('change', function() {
        const files = normalizeFiles(input.files);
        if (files.length > 0) uploadLocationReferenceImages(location.name, slotNum, files);
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
      const files = normalizeFiles(e.dataTransfer && e.dataTransfer.files);
      if (files.length > 0) uploadLocationReferenceImages(location.name, slotNum, files);
    });

    if (image) {
      const img = document.createElement('img');
      img.src = '/projects/' + encodeURIComponent(projectState.currentProject.id) + '/reference/locations/' + encodeURIComponent(location.name) + '/' + encodeURIComponent(image.filename);
      img.alt = location.name + ' reference ' + slotNum;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '8px';
      slot.appendChild(img);

      const delBtn = document.createElement('button');
      delBtn.className = 'reference-image-delete';
      delBtn.textContent = '\u00d7';
      delBtn.title = 'Delete image';
      delBtn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const libraryService = getReferenceLibraryService();
        const result = await libraryService.deleteLocationImage(projectState.currentProject.id, location.name, slotNum);
        if (result.ok) loadLocationReferences();
        else getSharedUtils().showToast('Error', result.error || 'Failed to delete image', 'error', 4000);
      });
      slot.appendChild(delBtn);
    } else {
      const icon = document.createElement('div');
      icon.className = 'upload-icon';
      icon.textContent = '+';
      const label = document.createElement('div');
      label.className = 'upload-label';
      label.textContent = 'Ref ' + slotNum;
      slot.appendChild(icon);
      slot.appendChild(label);
    }

    return slot;
  }

  function renderLocationReferences(generateImageFn) {
    const genState = getGenerationState();
    const projectState = getProjectState();
    const container = el('locationsReferenceList');
    if (!container) return;

    if (locationsData.length === 0) {
      container.innerHTML = '<div class="empty-state-small">No location references yet. Add your first location.</div>';
      return;
    }

    container.innerHTML = '';

    locationsData.forEach(function(location) {
      const card = document.createElement('div');
      card.className = 'character-reference-card';
      card.dataset.location = location.name;

      // === Card Header ===
      const header = document.createElement('div');
      header.className = 'character-reference-header';

      const title = document.createElement('h3');
      title.className = 'character-reference-title';
      title.textContent = '\ud83d\udccd ' + location.name;

      const delBtn = document.createElement('button');
      delBtn.className = 'character-reference-delete';
      delBtn.textContent = '\ud83d\uddd1\ufe0f Delete Location';
      delBtn.addEventListener('click', async function() {
        if (!confirm('Delete location "' + location.name + '" and all references?')) return;
        const libraryService = getReferenceLibraryService();
        const result = await libraryService.deleteLocation(projectState.currentProject.id, location.name);
        if (result.ok) loadLocationReferences();
        else getSharedUtils().showToast('Error', result.error || 'Failed to delete location', 'error', 4000);
      });

      header.appendChild(title);
      header.appendChild(delBtn);
      card.appendChild(header);

      // === Section 1: Location Definition ===
      const defSection = document.createElement('div');
      defSection.className = 'character-definition-section';
      defSection.appendChild(buildSectionHeader('\ud83d\udcdd', 'Location Definition'));

      if (location.definition) {
        const defText = document.createElement('div');
        defText.className = 'character-definition-text';
        defText.textContent = location.definition;
        defSection.appendChild(defText);

        const defActions = document.createElement('div');
        defActions.className = 'character-definition-actions';
        const copyDefBtn = document.createElement('button');
        copyDefBtn.className = 'btn btn-secondary btn-sm';
        copyDefBtn.textContent = '\ud83d\udccb Copy Definition';
        copyDefBtn.addEventListener('click', function() { copyLocationDefinition(location.name); });
        defActions.appendChild(copyDefBtn);
        defSection.appendChild(defActions);
      } else {
        const defPlaceholder = document.createElement('div');
        defPlaceholder.className = 'character-definition-placeholder';
        defPlaceholder.textContent = 'No definition yet \u2014 use Claude Code to generate a location definition.';
        defSection.appendChild(defPlaceholder);
      }

      card.appendChild(defSection);

      // === Section 2: Reference Image Prompts ===
      const promptsSection = document.createElement('div');
      promptsSection.className = 'character-prompts-section';
      promptsSection.appendChild(buildSectionHeader('\ud83c\udfa8', 'Reference Image Prompts'));

      const promptsGrid = document.createElement('div');
      promptsGrid.className = 'character-prompts-grid';

      [1, 2, 3].forEach(function(slotNum) {
        const promptCard = document.createElement('div');
        promptCard.className = 'character-prompt-card';

        const label = document.createElement('div');
        label.className = 'character-prompt-label';
        const numBadge = document.createElement('span');
        numBadge.className = 'prompt-slot-num';
        numBadge.textContent = slotNum;
        const labelText = document.createElement('span');
        labelText.textContent = LOCATION_PROMPT_SLOT_LABELS[slotNum - 1];
        label.appendChild(numBadge);
        label.appendChild(labelText);
        promptCard.appendChild(label);

        const promptContent = location.prompts && location.prompts[slotNum - 1];
        if (promptContent) {
          const promptTextEl = document.createElement('div');
          promptTextEl.className = 'character-prompt-text';
          promptTextEl.textContent = promptContent;
          promptCard.appendChild(promptTextEl);

          const promptActions = document.createElement('div');
          promptActions.className = 'character-prompt-actions';
          const copyPromptBtn = document.createElement('button');
          copyPromptBtn.className = 'btn btn-secondary btn-sm';
          copyPromptBtn.textContent = '\ud83d\udccb Copy';
          (function(ln, sn) {
            copyPromptBtn.addEventListener('click', function() { copyLocationPrompt(ln, sn); });
          })(location.name, slotNum);
          promptActions.appendChild(copyPromptBtn);

          if (genState.canGenerate && generateImageFn) {
            const genPromptBtn = document.createElement('button');
            genPromptBtn.className = 'btn btn-generate btn-sm';
            genPromptBtn.textContent = 'Generate';
            (function(ln, sn) {
              genPromptBtn.addEventListener('click', function() { generateImageFn(ln, sn); });
            })(location.name, slotNum);
            promptActions.appendChild(genPromptBtn);
          }

          promptCard.appendChild(promptActions);
        } else {
          const promptPlaceholder = document.createElement('div');
          promptPlaceholder.className = 'character-prompt-placeholder';
          promptPlaceholder.textContent = 'Not generated yet';
          promptCard.appendChild(promptPlaceholder);
        }

        promptsGrid.appendChild(promptCard);
      });

      promptsSection.appendChild(promptsGrid);
      card.appendChild(promptsSection);

      // === Section 3: Reference Images ===
      const imagesSection = document.createElement('div');
      imagesSection.className = 'reference-images-section';
      imagesSection.appendChild(buildSectionHeader('\ud83d\uddbc\ufe0f', 'Reference Images'));

      const slotsWrap = document.createElement('div');
      slotsWrap.className = 'reference-images-grid';
      const locationSlotCount = getVisibleSlotCount(location);
      for (let i = 1; i <= locationSlotCount; i++) slotsWrap.appendChild(buildLocationImageSlot(location, i));

      imagesSection.appendChild(slotsWrap);
      card.appendChild(imagesSection);

      container.appendChild(card);
    });
  }

  // --- Character definition/prompt copy ---

  async function copyCharacterDefinition(characterName) {
    const utils = getSharedUtils();
    const char = charactersData.find(function(c) { return c.name === characterName; });
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
    const utils = getSharedUtils();
    const char = charactersData.find(function(c) { return c.name === characterName; });
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

  // --- Location definition/prompt copy ---

  async function copyLocationDefinition(locationName) {
    const utils = getSharedUtils();
    const loc = locationsData.find(function(l) { return l.name === locationName; });
    if (!loc || !loc.definition) {
      utils.showToast('Empty', 'No definition to copy', 'warning', 2000);
      return;
    }
    try {
      await utils.copyText(loc.definition);
      utils.showToast('Copied!', locationName + ' definition copied', 'success', 2000);
    } catch (err) {
      utils.showToast('Copy failed', 'Could not copy to clipboard', 'error', 3000);
    }
  }

  async function copyLocationPrompt(locationName, slot) {
    const utils = getSharedUtils();
    const loc = locationsData.find(function(l) { return l.name === locationName; });
    if (!loc || !loc.prompts || !loc.prompts[slot - 1]) {
      utils.showToast('Empty', 'No prompt to copy', 'warning', 2000);
      return;
    }
    try {
      await utils.copyText(loc.prompts[slot - 1]);
      utils.showToast('Copied!', 'Prompt ' + slot + ' (' + LOCATION_PROMPT_SLOT_LABELS[slot - 1] + ') copied', 'success', 2000);
    } catch (err) {
      utils.showToast('Copy failed', 'Could not copy to clipboard', 'error', 3000);
    }
  }

  // --- Drag-and-drop upload for character reference images ---

  async function uploadCharacterReferenceImage(characterName, slotNum, file, options) {
    if (!file) return { ok: false, error: 'No file selected' };
    const opts = options || {};
    const utils = getSharedUtils();
    const projectState = getProjectState();
    if (!projectState.currentProject) {
      if (!opts.suppressToast) {
        utils.showToast('Upload failed', 'No active project', 'error', 4000);
      }
      return { ok: false, error: 'No active project' };
    }

    try {
      const result = await getReferenceFeature().uploadCharacterReference({
        projectId: projectState.currentProject.id,
        characterName: characterName,
        slotNum: slotNum,
        file: file
      });
      if (result.ok) {
        if (!opts.suppressToast) {
          utils.showToast('Uploaded', 'Reference image ' + slotNum + ' uploaded', 'success', 2000);
        }
        if (!opts.suppressReload) {
          await loadCharactersReferences();
        }
        return { ok: true };
      }
      if (!opts.suppressToast) {
        utils.showToast('Upload failed', result.error || 'Unknown error', 'error', 4000);
      }
      return { ok: false, error: result.error || 'Unknown error' };
    } catch (err) {
      if (!opts.suppressToast) {
        utils.showToast('Upload failed', err.message, 'error', 4000);
      }
      return { ok: false, error: err.message };
    }
  }

  async function uploadCharacterReferenceImages(characterName, startSlotNum, files) {
    const utils = getSharedUtils();
    const startSlot = normalizeSlotNumber(startSlotNum);
    const normalizedFiles = normalizeFiles(files);
    if (normalizedFiles.length === 0) return;

    const maxUploads = Math.max(0, MAX_REFERENCE_SLOT_COUNT - startSlot + 1);
    const uploadQueue = normalizedFiles.slice(0, maxUploads);
    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < uploadQueue.length; i++) {
      const slot = startSlot + i;
      const result = await uploadCharacterReferenceImage(characterName, slot, uploadQueue[i], {
        suppressToast: uploadQueue.length > 1,
        suppressReload: true
      });
      if (result && result.ok) uploadedCount++;
      else failedCount++;
    }

    if (uploadQueue.length > 0) {
      await loadCharactersReferences();
    }

    if (uploadQueue.length > 1) {
      if (uploadedCount > 0) {
        utils.showToast('Uploaded', uploadedCount + ' reference image(s) uploaded', 'success', 2500);
      }
      if (failedCount > 0) {
        utils.showToast('Partial upload', failedCount + ' image(s) failed to upload', 'warning', 3500);
      }
    }

    if (normalizedFiles.length > uploadQueue.length) {
      utils.showToast('Limit reached', 'Only slots 1-' + MAX_REFERENCE_SLOT_COUNT + ' are available', 'warning', 3500);
    }
  }

  async function handleDragDropUpload(characterName, slotNum, files) {
    const normalizedFiles = normalizeFiles(files);
    if (normalizedFiles.length === 0) return;
    await uploadCharacterReferenceImages(characterName, slotNum, normalizedFiles);
  }

  function buildSectionHeader(icon, titleText) {
    const header = document.createElement('div');
    header.className = 'character-section-header';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'character-section-icon';
    iconSpan.textContent = icon;
    const titleSpan = document.createElement('span');
    titleSpan.className = 'character-section-title';
    titleSpan.textContent = titleText;
    header.appendChild(iconSpan);
    header.appendChild(titleSpan);
    return header;
  }

  function openReferenceImageUpload(characterName, slotNum) {
    const input = el(getReferenceInputId(characterName, slotNum));
    if (input) input.click();
  }

  async function handleReferenceImageUpload(characterName, slotNum, inputEl) {
    const files = normalizeFiles(inputEl && inputEl.files);
    if (files.length === 0) return;
    const projectState = getProjectState();
    const utils = getSharedUtils();

    if (!projectState.currentProject) {
      utils.showToast('Error', 'No active project', 'error', 3000);
      return;
    }

    await uploadCharacterReferenceImages(characterName, slotNum, files);

    inputEl.value = '';
  }

  async function deleteReferenceImage(characterName, slotNum) {
    if (!confirm('Delete reference image ' + slotNum + ' for ' + characterName + '?')) return;
    const projectState = getProjectState();
    const utils = getSharedUtils();

    try {
      const libraryService = getReferenceLibraryService();
      const result = await libraryService.deleteCharacterImage(projectState.currentProject.id, characterName, slotNum);
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
    const projectState = getProjectState();
    const utils = getSharedUtils();

    try {
      const libraryService = getReferenceLibraryService();
      const result = await libraryService.deleteCharacter(projectState.currentProject.id, characterName);
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
    const projectState = getProjectState();
    const genState = getGenerationState();
    const image = char.images.find(function(img) { return Number(img.slot) === slotNum; });
    const generatedImage = char.generatedImages ? char.generatedImages.find(function(img) { return Number(img.slot) === slotNum; }) : null;
    const displayImage = image || generatedImage;
    const isGenerating = activeGenerations.has(char.name + '-' + slotNum);

    const slot = document.createElement('div');
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
      const files = normalizeFiles(e.dataTransfer && e.dataTransfer.files);
      if (files.length > 0) handleDragDropUpload(char.name, slotNum, files);
    });

    // Show spinner overlay when generating
    if (isGenerating) {
      const overlay = document.createElement('div');
      overlay.className = 'generating-overlay';
      const spinner = document.createElement('div');
      spinner.className = 'generating-spinner';
      const text = document.createElement('div');
      text.className = 'generating-text';
      text.textContent = 'Generating...';
      overlay.appendChild(spinner);
      overlay.appendChild(text);
      slot.appendChild(overlay);
    } else if (displayImage) {
      const img = document.createElement('img');
      img.src = '/projects/' + encodeURIComponent(projectState.currentProject.id) + '/reference/characters/' + encodeURIComponent(char.name) + '/' + encodeURIComponent(displayImage.filename);
      img.className = 'reference-image-preview';
      img.alt = char.name + ' reference ' + slotNum;
      slot.appendChild(img);

      // Badge for AI-generated images
      if (!image && generatedImage) {
        const badge = document.createElement('div');
        badge.className = 'ai-generated-badge';
        badge.textContent = 'AI Generated';
        slot.appendChild(badge);
      }

      const overlayEl = document.createElement('div');
      overlayEl.className = 'reference-image-overlay';
      const actions = document.createElement('div');
      actions.className = 'reference-image-actions';

      const delImgBtn = document.createElement('button');
      delImgBtn.className = 'btn btn-secondary btn-sm';
      delImgBtn.textContent = '\ud83d\uddd1\ufe0f Delete';
      delImgBtn.addEventListener('click', function(e) { e.stopPropagation(); deleteReferenceImage(char.name, slotNum); });

      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'btn btn-primary btn-sm';
      replaceBtn.textContent = '\ud83d\udce4 Replace';
      replaceBtn.addEventListener('click', function(e) { e.stopPropagation(); openReferenceImageUpload(char.name, slotNum); });

      actions.appendChild(delImgBtn);
      actions.appendChild(replaceBtn);

      if (genState.canGenerate && generateImageFn) {
        const regenBtn = document.createElement('button');
        regenBtn.className = 'btn btn-generate btn-sm';
        regenBtn.textContent = 'Regenerate';
        regenBtn.addEventListener('click', function(e) { e.stopPropagation(); generateImageFn(char.name, slotNum); });
        actions.appendChild(regenBtn);
      }

      overlayEl.appendChild(actions);
      slot.appendChild(overlayEl);
    } else {
      const iconDiv = document.createElement('div');
      iconDiv.className = 'reference-slot-icon';
      iconDiv.textContent = '\ud83d\udcf7';
      const labelDiv = document.createElement('div');
      labelDiv.className = 'reference-slot-label';
      labelDiv.textContent = getReferenceSlotLabel(slotNum, PROMPT_SLOT_LABELS);
      const hintDiv = document.createElement('div');
      hintDiv.className = 'reference-slot-hint';
      hintDiv.textContent = 'Click or drag & drop';
      slot.appendChild(iconDiv);
      slot.appendChild(labelDiv);
      slot.appendChild(hintDiv);

      if (genState.canGenerate && generateImageFn) {
        const hasPrompt = char.prompts && char.prompts[slotNum - 1];
        if (hasPrompt) {
          const genBtn = document.createElement('button');
          genBtn.className = 'btn btn-generate btn-sm reference-slot-generate';
          genBtn.textContent = 'AI Generate';
          genBtn.addEventListener('click', function(e) { e.stopPropagation(); generateImageFn(char.name, slotNum); });
          slot.appendChild(genBtn);
        }
      }
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = getReferenceInputId(char.name, slotNum);
    fileInput.accept = 'image/png,image/jpeg,image/jpg,image/webp';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function() { handleReferenceImageUpload(char.name, slotNum, this); });
    slot.appendChild(fileInput);

    return slot;
  }

  function renderCharactersReferences(generateImageFn) {
    const genState = getGenerationState();
    const container = el('charactersReferenceList');
    if (!container) return;

    container.innerHTML = '';

    if (charactersData.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder-content';
      const p = document.createElement('p');
      p.textContent = 'No characters added yet. Add a character above to get started.';
      placeholder.appendChild(p);
      container.appendChild(placeholder);
      return;
    }

    charactersData.forEach(function(char) {
      const card = document.createElement('div');
      card.className = 'character-reference-card';
      card.dataset.character = char.name;

      // === Card Header ===
      const header = document.createElement('div');
      header.className = 'character-reference-header';
      const title = document.createElement('h3');
      title.className = 'character-reference-title';
      title.textContent = '\ud83d\udc64 ' + char.name;
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'character-reference-delete';
      deleteBtn.textContent = '\ud83d\uddd1\ufe0f Delete Character';
      deleteBtn.addEventListener('click', function() { deleteCharacterReference(char.name); });
      header.appendChild(title);
      header.appendChild(deleteBtn);
      card.appendChild(header);

      // === Section 1: Character Definition ===
      const defSection = document.createElement('div');
      defSection.className = 'character-definition-section';
      defSection.appendChild(buildSectionHeader('\ud83d\udcdd', 'Character Definition'));

      if (char.definition) {
        const defText = document.createElement('div');
        defText.className = 'character-definition-text';
        defText.textContent = char.definition;
        defSection.appendChild(defText);

        const defActions = document.createElement('div');
        defActions.className = 'character-definition-actions';
        const copyDefBtn = document.createElement('button');
        copyDefBtn.className = 'btn btn-secondary btn-sm';
        copyDefBtn.textContent = '\ud83d\udccb Copy Definition';
        copyDefBtn.addEventListener('click', function() { copyCharacterDefinition(char.name); });
        defActions.appendChild(copyDefBtn);
        defSection.appendChild(defActions);
      } else {
        const defPlaceholder = document.createElement('div');
        defPlaceholder.className = 'character-definition-placeholder';
        defPlaceholder.textContent = 'No definition yet \u2014 use Claude Code to generate a character definition.';
        defSection.appendChild(defPlaceholder);
      }

      card.appendChild(defSection);

      // === Section 2: Reference Image Prompts ===
      const promptsSection = document.createElement('div');
      promptsSection.className = 'character-prompts-section';
      promptsSection.appendChild(buildSectionHeader('\ud83c\udfa8', 'Reference Image Prompts'));

      const promptsGrid = document.createElement('div');
      promptsGrid.className = 'character-prompts-grid';

      [1, 2, 3].forEach(function(slotNum) {
        const promptCard = document.createElement('div');
        promptCard.className = 'character-prompt-card';

        const label = document.createElement('div');
        label.className = 'character-prompt-label';
        const numBadge = document.createElement('span');
        numBadge.className = 'prompt-slot-num';
        numBadge.textContent = slotNum;
        const labelText = document.createElement('span');
        labelText.textContent = PROMPT_SLOT_LABELS[slotNum - 1];
        label.appendChild(numBadge);
        label.appendChild(labelText);
        promptCard.appendChild(label);

        const promptContent = char.prompts && char.prompts[slotNum - 1];
        if (promptContent) {
          const promptTextEl = document.createElement('div');
          promptTextEl.className = 'character-prompt-text';
          promptTextEl.textContent = promptContent;
          promptCard.appendChild(promptTextEl);

          const promptActions = document.createElement('div');
          promptActions.className = 'character-prompt-actions';
          const copyPromptBtn = document.createElement('button');
          copyPromptBtn.className = 'btn btn-secondary btn-sm';
          copyPromptBtn.textContent = '\ud83d\udccb Copy';
          (function(cn, sn) {
            copyPromptBtn.addEventListener('click', function() { copyCharacterPrompt(cn, sn); });
          })(char.name, slotNum);
          promptActions.appendChild(copyPromptBtn);

          if (genState.canGenerate && generateImageFn) {
            const genPromptBtn = document.createElement('button');
            genPromptBtn.className = 'btn btn-generate btn-sm';
            genPromptBtn.textContent = 'Generate';
            (function(cn, sn) {
              genPromptBtn.addEventListener('click', function() { generateImageFn(cn, sn); });
            })(char.name, slotNum);
            promptActions.appendChild(genPromptBtn);
          }

          promptCard.appendChild(promptActions);
        } else {
          const promptPlaceholder = document.createElement('div');
          promptPlaceholder.className = 'character-prompt-placeholder';
          promptPlaceholder.textContent = 'Not generated yet';
          promptCard.appendChild(promptPlaceholder);
        }

        promptsGrid.appendChild(promptCard);
      });

      promptsSection.appendChild(promptsGrid);
      card.appendChild(promptsSection);

      // === Section 3: Reference Images (with drag-and-drop) ===
      const imagesSection = document.createElement('div');
      imagesSection.className = 'reference-images-section';
      imagesSection.appendChild(buildSectionHeader('\ud83d\uddbc\ufe0f', 'Reference Images'));

      const grid = document.createElement('div');
      grid.className = 'reference-images-grid';

      const charSlotCount = getVisibleSlotCount(char);
      for (let slotNum = 1; slotNum <= charSlotCount; slotNum++) {
        grid.appendChild(buildImageSlot(char, slotNum, generateImageFn));
      }

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
    PROMPT_SLOT_LABELS: PROMPT_SLOT_LABELS,
    LOCATION_PROMPT_SLOT_LABELS: LOCATION_PROMPT_SLOT_LABELS
  };
})(typeof window !== 'undefined' ? window : globalThis);
