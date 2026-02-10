// Storyboard Viewer - Application Logic
// Version: 2026-02-07 (Multi-Project Support)

let sequenceData = null;
let currentView = 'grid';
let dragShotId = null;
let saveStoryboardTimer = null;
let selectedShot = null;
let selectedVariation = null;
let currentProject = null;
let currentReviewFilter = 'all';
let commentsModalShot = null;

const REVIEW_STATUS_OPTIONS = ['draft', 'ready_for_review', 'changes_requested', 'approved'];

// Toast notification system
const toastContainer = document.getElementById('toastContainer');
let toastIdCounter = 0;

/**
 * Show a toast notification
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in ms (0 = no auto-dismiss)
 */
function showToast(title, message = '', type = 'info', duration = 3000) {
  const toastId = `toast-${toastIdCounter++}`;

  const icons = {
    success: '\u2713',
    error: '\u2717',
    warning: '\u26A0',
    info: 'i'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.id = toastId;

  const iconEl = document.createElement('div');
  iconEl.className = 'toast-icon';
  iconEl.textContent = icons[type] || icons.info;

  const contentEl = document.createElement('div');
  contentEl.className = 'toast-content';

  const titleEl = document.createElement('div');
  titleEl.className = 'toast-title';
  titleEl.textContent = title;
  contentEl.appendChild(titleEl);

  if (message) {
    const msgEl = document.createElement('div');
    msgEl.className = 'toast-message';
    msgEl.textContent = message;
    contentEl.appendChild(msgEl);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', () => dismissToast(toastId));

  toast.appendChild(iconEl);
  toast.appendChild(contentEl);
  toast.appendChild(closeBtn);

  if (duration > 0) {
    const progress = document.createElement('div');
    progress.className = 'toast-progress';
    toast.appendChild(progress);
  }

  toastContainer.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => dismissToast(toastId), duration);
  }

  return toastId;
}

/**
 * Dismiss a toast notification
 * @param {string} toastId - ID of toast to dismiss
 */
function dismissToast(toastId) {
  const toast = document.getElementById(toastId);
  if (!toast) return;

  toast.classList.add('toast-dismissing');
  setTimeout(() => {
    toast.remove();
  }, 200);
}

// DOM Elements (will be accessed via document.getElementById when needed)
// These are kept as variables for functions that use them repeatedly
let emptyState, gridView, timelineView, shotGrid, timelineTrack, timelineFilmstrip;
let shotModal, modalTitle, variationGrid, shotDetails;
let statTotalShots, statRendered, statSelected, statDuration;
let readinessPanel, readinessCounts, readinessLists, readinessRecommendations;
let clearReadinessFilterBtn, saveReadinessReportBtn;
let currentReadinessFilter = 'all';
let currentReadinessData = null;

/**
 * Initialize DOM element references
 */
function initializeDOMElements() {
  emptyState = document.getElementById('emptyState');
  gridView = document.getElementById('gridView');
  timelineView = document.getElementById('timelineView');
  shotGrid = document.getElementById('shotGrid');
  timelineTrack = document.getElementById('timelineTrack');
  timelineFilmstrip = document.getElementById('timelineFilmstrip');
  shotModal = document.getElementById('shotModal');
  modalTitle = document.getElementById('modalTitle');
  variationGrid = document.getElementById('variationGrid');
  shotDetails = document.getElementById('shotDetails');
  statTotalShots = document.getElementById('stat-total-shots');
  statRendered = document.getElementById('stat-rendered');
  statSelected = document.getElementById('stat-selected');
  statDuration = document.getElementById('stat-duration');
  readinessPanel = document.getElementById('readinessPanel');
  readinessCounts = document.getElementById('readinessCounts');
  readinessLists = document.getElementById('readinessLists');
  readinessRecommendations = document.getElementById('readinessRecommendations');
  clearReadinessFilterBtn = document.getElementById('clearReadinessFilterBtn');
  saveReadinessReportBtn = document.getElementById('saveReadinessReportBtn');
}


function getDefaultShotOrder(shots) {
  const sortedShots = [...shots];
  sortedShots.sort((a, b) => {
    const aFromShotList = shotListOrderMap.get(a.shotId);
    const bFromShotList = shotListOrderMap.get(b.shotId);

    if (Number.isFinite(aFromShotList) && Number.isFinite(bFromShotList)) {
      return aFromShotList - bFromShotList;
    }
    if (Number.isFinite(aFromShotList)) return -1;
    if (Number.isFinite(bFromShotList)) return 1;

    const aNum = Number(a.shotNumber);
    const bNum = Number(b.shotNumber);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    if (Number.isFinite(aNum)) return -1;
    if (Number.isFinite(bNum)) return 1;
    return String(a.shotId || '').localeCompare(String(b.shotId || ''));
  });
  return sortedShots.map(shot => shot.shotId).filter(Boolean);
}

function getOrderedShots() {
  if (!sequenceData || !Array.isArray(sequenceData.selections)) return [];

  const shotsById = new Map();
  sequenceData.selections.forEach(shot => {
    if (shot?.shotId) shotsById.set(shot.shotId, shot);
  });

  const order = [];
  const seen = new Set();
  const editorialOrder = Array.isArray(sequenceData.editorialOrder) ? sequenceData.editorialOrder : [];

  editorialOrder.forEach(shotId => {
    if (shotsById.has(shotId) && !seen.has(shotId)) {
      order.push(shotId);
      seen.add(shotId);
    }
  });

  const fallbackOrder = getDefaultShotOrder(sequenceData.selections);
  fallbackOrder.forEach(shotId => {
    if (!seen.has(shotId) && shotsById.has(shotId)) {
      order.push(shotId);
      seen.add(shotId);
    }
  });

  return order.map(shotId => shotsById.get(shotId));
}

function updateTimelineControlsVisibility() {
  const reorderModeBtn = document.getElementById('reorderModeBtn');
  const resetOrderBtn = document.getElementById('resetOrderBtn');
  const isTimeline = currentView === 'timeline' && sequenceData?.selections?.length > 0;

  if (reorderModeBtn) reorderModeBtn.style.display = isTimeline ? 'inline-flex' : 'none';
  if (resetOrderBtn) resetOrderBtn.style.display = isTimeline ? 'inline-flex' : 'none';
}

function updateReorderModeButtonLabel() {
  const reorderModeBtn = document.getElementById('reorderModeBtn');
  if (!reorderModeBtn) return;
  reorderModeBtn.textContent = `Reorder Mode: ${reorderModeEnabled ? 'On' : 'Off'}`;
  reorderModeBtn.classList.toggle('is-active', reorderModeEnabled);
}

function setReorderMode(enabled) {
  reorderModeEnabled = Boolean(enabled);
  updateReorderModeButtonLabel();
  renderView();
}

async function saveEditorialOrder(editorialOrder, { successMessage = 'Editorial order saved' } = {}) {
  if (!Array.isArray(editorialOrder)) return;

  const loadingToast = showToast('Saving order...', '', 'info', 0);

  try {
    const payload = {
      project: currentProject?.id || null,
      editorialOrder
    };

    const response = await fetch('/api/storyboard/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to save order');
    }

    sequenceData.editorialOrder = editorialOrder;
    dismissToast(loadingToast);
    showToast('Success', successMessage, 'success', 2000);
    renderView();
  } catch (err) {
    dismissToast(loadingToast);
    showToast('Save failed', err.message, 'error', 4000);
  }
}

async function resetToShotListOrder() {
  if (!sequenceData?.selections?.length) return;

  const fallbackOrder = getDefaultShotOrder(sequenceData.selections);
  await saveEditorialOrder(fallbackOrder, { successMessage: 'Reset to shot list order' });
}

/**
 * Show loading state
 * @param {HTMLElement} container - Container to show loading in
 * @param {string} message - Loading message
 */
function showLoading(container, message = 'Loading...') {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  const text = document.createElement('div');
  text.className = 'loading-text';
  text.textContent = message;
  overlay.appendChild(spinner);
  overlay.appendChild(text);
  container.style.position = 'relative';
  container.appendChild(overlay);
  return overlay;
}

/**
 * Hide loading state
 * @param {HTMLElement} overlay - The loading overlay to remove
 */
function hideLoading(overlay) {
  if (overlay && overlay.parentNode) {
    overlay.remove();
  }
}


function normalizeShotReviewData(shot) {
  if (!shot || typeof shot !== 'object') return;
  if (!REVIEW_STATUS_OPTIONS.includes(shot.reviewStatus)) shot.reviewStatus = 'draft';
  if (typeof shot.assignee !== 'string') shot.assignee = '';
  if (!Array.isArray(shot.comments)) shot.comments = [];
}

function formatReviewStatus(status) {
  return (status || 'draft').replace(/_/g, ' ');
}

function getFilteredShots() {
  if (!sequenceData || !Array.isArray(sequenceData.selections)) return [];
  return sequenceData.selections.filter(shot => {
    normalizeShotReviewData(shot);
    return currentReviewFilter === 'all' || shot.reviewStatus === currentReviewFilter;
  });
}

async function saveReviewUpdate(shotId, updates) {
  const payload = {
    project: currentProject?.id,
    shotId,
    ...updates
  };

  const response = await fetch('/api/review/shot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to save review update');
  }
  return result.shot;
}

// ===== MUSIC UPLOAD =====

let currentMusicFile = null;

/**
 * Initialize music upload functionality
 */
function initMusicUpload() {
  const dropZone = document.getElementById('musicDropZone');
  const fileInput = document.getElementById('musicFileInput');
  const filenameDisplay = document.getElementById('musicFilename');

  if (!dropZone || !fileInput) return;

  // Click to browse
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadMusicFile(file);
  });

  // Drag and drop handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) uploadMusicFile(files[0]);
  });

  // Load existing music file
  if (sequenceData?.musicFile) {
    currentMusicFile = sequenceData.musicFile;
    updateMusicDisplay(sequenceData.musicFile);
    updateMusicPreview();
  }
}

/**
 * Upload music file to server
 */
async function uploadMusicFile(file) {
  // Validate
  if (!file.name.toLowerCase().endsWith('.mp3')) {
    showToast('Invalid file', 'Please upload an MP3 file', 'error', 4000);
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    showToast('File too large', 'Maximum size is 50MB', 'error', 4000);
    return;
  }

  const dropZone = document.getElementById('musicDropZone');
  const progressBar = showUploadProgress(dropZone);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const projectParam = currentProject ? `?project=${currentProject.id}` : '';
    const response = await fetch(`/api/upload/music${projectParam}`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    currentMusicFile = result.filePath;
    updateMusicDisplay(result.filePath);
    showToast('Music uploaded', file.name, 'success', 3000);

    await loadSequence();

  } catch (err) {
    console.error('Music upload error:', err);
    showToast('Upload failed', err.message, 'error', 4000);
  } finally {
    hideUploadProgress(progressBar);
  }
}

/**
 * Update music display
 */
function updateMusicDisplay(filePath) {
  const dropZone = document.getElementById('musicDropZone');
  const filenameDisplay = document.getElementById('musicFilename');

  if (filePath) {
    const filename = filePath.split('/').pop();
    filenameDisplay.textContent = filename;
    dropZone.dataset.hasFile = 'true';
  } else {
    filenameDisplay.textContent = '';
    dropZone.dataset.hasFile = 'false';
  }
}

/**
 * Show upload progress
 */
function showUploadProgress(container) {
  const progress = document.createElement('div');
  progress.className = 'upload-progress';
  progress.innerHTML = '<div class="upload-progress-bar" style="width: 0%"></div>';
  container.appendChild(progress);

  setTimeout(() => {
    const bar = progress.querySelector('.upload-progress-bar');
    bar.style.width = '90%';
  }, 100);

  return progress;
}

/**
 * Hide upload progress
 */
function hideUploadProgress(progressElement) {
  if (!progressElement) return;

  const bar = progressElement.querySelector('.upload-progress-bar');
  bar.style.width = '100%';

  setTimeout(() => {
    progressElement.remove();
  }, 300);
}

/**
 * Load storyboard sequence data
 */
// ===== PROJECT MANAGEMENT =====

/**
 * Load projects list and set active project
 */
async function loadProjects() {
  try {
    const response = await fetch('/api/projects');
    const data = await response.json();

    if (!data.success || data.projects.length === 0) {
      return false;
    }

    const activeId = localStorage.getItem('activeProject') || data.projects[0].id;
    currentProject = data.projects.find(p => p.id === activeId) || data.projects[0];

    const selector = document.getElementById('projectSelector');
    if (selector) {
      selector.innerHTML = '';
      data.projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        opt.selected = p.id === currentProject.id;
        selector.appendChild(opt);
      });
    }

    return true;
  } catch (err) {
    console.error('Failed to load projects:', err);
    return false;
  }
}

/**
 * Switch to a different project
 */
async function switchProject(projectId) {
  localStorage.setItem('activeProject', projectId);
  location.reload();
}

/**
 * Create a new project
 */
async function createNewProject(name, description) {
  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);

    const response = await fetch('/api/projects', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to create project');
    }

    localStorage.setItem('activeProject', result.project.id);
    location.reload();
  } catch (err) {
    console.error('Failed to create project:', err);
    throw err;
  }
}


async function loadPrevisMap() {
  try {
    const projectParam = currentProject ? `?project=${currentProject.id}` : '';
    const response = await fetch(`/api/storyboard/previs-map${projectParam}`);
    if (!response.ok) {
      throw new Error('Failed to load previs map');
    }

    const result = await response.json();
    previsMap = result.previsMap || {};
  } catch (err) {
    console.warn('Failed to load previs map:', err);
    previsMap = {};
  }
}

function getShotPrevisOverride(shotId) {
  if (!shotId || !previsMap || typeof previsMap !== 'object') {
    return null;
  }

  const entry = previsMap[shotId];
  return entry && typeof entry === 'object' ? entry : null;
}

function getDefaultCharacterRef(shot) {
  const characterId = shot?.characterId || shot?.characterRef;
  if (!characterId) return null;
  return `${characterId}:${PREVIS_REF_SLOT}`;
}

function getDefaultLocationRef(shot) {
  const locationId = shot?.locationId || shot?.locationRef;
  if (!locationId) return null;
  return `${locationId}:${PREVIS_REF_SLOT}`;
}

function resolveRefSourcePath(sourceType, sourceRef) {
  if (!sourceRef) return null;

  if (sourceType === 'character_ref') {
    const [entityId, slot = PREVIS_REF_SLOT] = sourceRef.split(':');
    return `projects/${currentProject.id}/reference/characters/${entityId}/${slot}.png`;
  }

  if (sourceType === 'location_ref') {
    const [entityId, slot = PREVIS_REF_SLOT] = sourceRef.split(':');
    return `projects/${currentProject.id}/reference/locations/${entityId}/${slot}.png`;
  }

  return sourceRef;
}

function getFallbackPreviewAsset(shot) {
  const thumbnailPath = shot.renderFiles?.thumbnail;
  if (thumbnailPath) {
    return { path: thumbnailPath, sourceType: 'rendered_thumbnail', isOverride: false, locked: false, notes: '' };
  }

  const selectedVar = shot.selectedVariation || 'A';
  const videoPath = shot.renderFiles?.kling?.[selectedVar];
  if (videoPath) {
    return { path: videoPath, sourceType: 'rendered_video', isOverride: false, locked: false, notes: '' };
  }

  const firstFramePath = shot.renderFiles?.nano?.firstFrame || shot.renderFiles?.nanobanana?.firstFrame;
  if (firstFramePath) {
    return { path: firstFramePath, sourceType: 'rendered_first_frame', isOverride: false, locked: false, notes: '' };
  }

  return { path: null, sourceType: null, isOverride: false, locked: false, notes: '' };
}

function getShotPreviewAsset(shot) {
  const override = getShotPrevisOverride(shot.shotId);
  if (override?.sourceRef) {
    return {
      path: resolveRefSourcePath(override.sourceType, override.sourceRef),
      sourceType: override.sourceType,
      isOverride: true,
      locked: !!override.locked,
      notes: override.notes || ''
    };
  }

  return getFallbackPreviewAsset(shot);
}

function applyPreviewNode(container, shot) {
  const preview = getShotPreviewAsset(shot);

  if (preview.path && /\.(mp4|mov)$/i.test(preview.path)) {
    const video = document.createElement('video');
    video.src = `/${preview.path}`;
    video.muted = true;
    video.preload = 'metadata';
    container.appendChild(video);
  } else if (preview.path) {
    const img = document.createElement('img');
    img.src = `/${preview.path}`;
    img.alt = shot.shotId;
    container.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'VIDEO';
    container.appendChild(placeholder);
  }

  return preview;
}

async function saveShotPrevisOverride(shotId, entry) {
  const payload = {
    project: currentProject?.id,
    entry
  };

  const response = await fetch(`/api/storyboard/previs-map/${encodeURIComponent(shotId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to save previs override');
  }

  previsMap[shotId] = result.entry;
}

async function resetShotPrevisOverride(shotId) {
  const projectParam = currentProject ? `?project=${currentProject.id}` : '';
  const response = await fetch(`/api/storyboard/previs-map/${encodeURIComponent(shotId)}${projectParam}`, {
    method: 'DELETE'
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to reset previs override');
  }

  delete previsMap[shotId];
}

async function loadSequence() {
  const loadingOverlay = showLoading(document.body, 'Loading storyboard...');

  try {
    const projectParam = currentProject ? `?project=${currentProject.id}` : '';
    const response = await fetch(`/api/review/sequence${projectParam}`);
    if (!response.ok) {
      throw new Error('Sequence file not found');
    }
    sequenceData = await response.json();
    if (Array.isArray(sequenceData.selections)) {
      sequenceData.selections.forEach(ensureStoryboardMetadata);
    }
    updateStats();
    renderView();

    if (orderedStoryboardShots.length > 0) {
      showToast('Storyboard loaded', `${orderedStoryboardShots.length} shots in order`, 'success', 2000);
    } else {
      showToast('No shots found', 'Add or save shot_list.json in Step 3', 'info', 4000);
    }
  } catch (err) {
    console.error('Failed to load storyboard context:', err);
    showEmptyState();
    showToast('Load failed', 'Could not load shot list/reference context', 'error', 4000);
  } finally {
    hideLoading(loadingOverlay);
  }
}

/**
 * Update header stats
 */
function updateStats() {
  if (!orderedStoryboardShots || orderedStoryboardShots.length === 0) {
    statTotalShots.textContent = 0;
    statRendered.textContent = 0;
    statSelected.textContent = 0;
    statDuration.textContent = '0s';
    return;
  }

  const totalShots = orderedStoryboardShots.length;
  const rendered = orderedStoryboardShots.filter(s => (
    s.renderFiles?.thumbnail || s.renderFiles?.kling || s.renderFiles?.nanobanana
  )).length;
  const selected = orderedStoryboardShots.filter(s =>
    s.selectedVariation && s.selectedVariation !== 'none'
  ).length;
  const duration = sequenceData.totalDuration || 0;

  statTotalShots.textContent = totalShots;
  statRendered.textContent = rendered;
  statSelected.textContent = selected;
  statDuration.textContent = `${duration}s`;
}


function shotHasPreviewSource(shot) {
  return Boolean(
    shot?.renderFiles?.thumbnail ||
    shot?.renderFiles?.kling?.A ||
    shot?.renderFiles?.kling?.B ||
    shot?.renderFiles?.kling?.C ||
    shot?.renderFiles?.kling?.D ||
    shot?.renderFiles?.nano?.firstFrame ||
    shot?.renderFiles?.nano?.lastFrame
  );
}

function shotHasCharacterRefs(shot) {
  const refs = shot?.characterRefs || shot?.characters;
  if (!Array.isArray(refs)) return false;
  return refs.some(ref => typeof ref === 'string' ? ref.trim() : ref?.id);
}

function shotHasLocationRefs(shot) {
  const refs = shot?.locationRefs || shot?.locations;
  if (Array.isArray(refs)) {
    return refs.some(ref => typeof ref === 'string' ? ref.trim() : ref?.id);
  }
  if (refs && typeof refs === 'object') {
    return Boolean(refs.id || refs.name);
  }
  return false;
}

function shotHasSelectedVariation(shot) {
  return Boolean(shot?.selectedVariation && shot.selectedVariation !== 'none');
}

function computeReadinessData() {
  const shots = sequenceData?.selections || [];
  const categories = {
    missingPreview: [],
    missingCharacterRefs: [],
    missingLocationRefs: [],
    missingSelection: []
  };

  shots.forEach(shot => {
    if (!shotHasPreviewSource(shot)) categories.missingPreview.push(shot);
    if (!shotHasCharacterRefs(shot)) categories.missingCharacterRefs.push(shot);
    if (!shotHasLocationRefs(shot)) categories.missingLocationRefs.push(shot);
    if (!shotHasSelectedVariation(shot)) categories.missingSelection.push(shot);
  });

  const blockedSet = new Set();
  Object.values(categories).forEach(list => list.forEach(shot => blockedSet.add(shot.shotId)));

  return {
    total: shots.length,
    ready: shots.length - blockedSet.size,
    blocked: blockedSet.size,
    categories,
    blockedShotIds: Array.from(blockedSet)
  };
}

function createReadinessFilterLink(filterKey, count, label) {
  const button = document.createElement('button');
  button.className = 'readiness-filter-link';
  if (currentReadinessFilter === filterKey) button.classList.add('active');
  button.textContent = `${label}: ${count}`;
  button.addEventListener('click', () => {
    currentReadinessFilter = filterKey;
    renderView();
  });
  return button;
}

function renderReadinessPanel() {
  if (!readinessPanel) return;

  if (!sequenceData?.selections?.length) {
    readinessPanel.style.display = 'none';
    return;
  }

  const data = computeReadinessData();
  currentReadinessData = data;
  readinessPanel.style.display = 'block';

  readinessCounts.innerHTML = '';
  readinessLists.innerHTML = '';
  readinessRecommendations.innerHTML = '';

  const readyBadge = document.createElement('div');
  readyBadge.className = 'readiness-count readiness-ready';
  readyBadge.textContent = `Ready: ${data.ready}`;
  readinessCounts.appendChild(readyBadge);

  const blockedBadge = document.createElement('div');
  blockedBadge.className = 'readiness-count readiness-blocked';
  blockedBadge.textContent = `Blocked: ${data.blocked}`;
  readinessCounts.appendChild(blockedBadge);

  const listItems = [
    ['missingPreview', 'No preview source', 'Add thumbnail or render output for each shot.'],
    ['missingCharacterRefs', 'Missing character refs', 'Attach characterRefs/characters IDs so tools can preserve identity continuity.'],
    ['missingLocationRefs', 'Missing location refs', 'Attach locationRefs/locations IDs so environment consistency is enforced.'],
    ['missingSelection', 'No selected variation/render', 'Set selectedVariation to A/B/C/D after review in the modal.']
  ];

  listItems.forEach(([key, label, recommendation]) => {
    const list = data.categories[key];

    const group = document.createElement('div');
    group.className = 'readiness-group';

    const title = document.createElement('div');
    title.className = 'readiness-group-title';
    title.appendChild(createReadinessFilterLink(key, list.length, label));
    group.appendChild(title);

    const shotsWrap = document.createElement('div');
    shotsWrap.className = 'readiness-shot-list';
    if (list.length === 0) {
      const clear = document.createElement('span');
      clear.className = 'readiness-clear';
      clear.textContent = 'None';
      shotsWrap.appendChild(clear);
    } else {
      list.slice(0, 8).forEach(shot => {
        const chip = document.createElement('button');
        chip.className = 'readiness-shot-chip';
        chip.textContent = shot.shotId;
        chip.addEventListener('click', () => openShotModal(shot));
        shotsWrap.appendChild(chip);
      });
      if (list.length > 8) {
        const extra = document.createElement('span');
        extra.className = 'readiness-extra';
        extra.textContent = `+${list.length - 8} more`;
        shotsWrap.appendChild(extra);
      }
    }
    group.appendChild(shotsWrap);
    readinessLists.appendChild(group);

    if (list.length > 0) {
      const rec = document.createElement('div');
      rec.className = 'readiness-recommendation';
      rec.textContent = `${label}: ${recommendation}`;
      readinessRecommendations.appendChild(rec);
    }
  });

  clearReadinessFilterBtn.style.display = currentReadinessFilter === 'all' ? 'none' : 'inline-flex';
}

function getFilteredShotsForCurrentReadinessFilter(shots) {
  if (!currentReadinessData || currentReadinessFilter === 'all') {
    return shots;
  }

  const validFilters = {
    missingPreview: 'missingPreview',
    missingCharacterRefs: 'missingCharacterRefs',
    missingLocationRefs: 'missingLocationRefs',
    missingSelection: 'missingSelection',
    blocked: 'blocked'
  };

  if (currentReadinessFilter === 'blocked') {
    const blockedIds = new Set(currentReadinessData.blockedShotIds);
    return shots.filter(shot => blockedIds.has(shot.shotId));
  }

  const categoryKey = validFilters[currentReadinessFilter];
  if (!categoryKey) return shots;

  const allowedIds = new Set(currentReadinessData.categories[categoryKey].map(shot => shot.shotId));
  return shots.filter(shot => allowedIds.has(shot.shotId));
}

async function saveReadinessReport() {
  if (!currentProject?.id || !currentReadinessData) {
    showToast('Report unavailable', 'Load a project first', 'warning', 3000);
    return;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    projectId: currentProject.id,
    totalShots: currentReadinessData.total,
    readyShots: currentReadinessData.ready,
    blockedShots: currentReadinessData.blocked,
    blockedShotIds: currentReadinessData.blockedShotIds,
    categories: {
      missingPreview: currentReadinessData.categories.missingPreview.map(s => s.shotId),
      missingCharacterRefs: currentReadinessData.categories.missingCharacterRefs.map(s => s.shotId),
      missingLocationRefs: currentReadinessData.categories.missingLocationRefs.map(s => s.shotId),
      missingSelection: currentReadinessData.categories.missingSelection.map(s => s.shotId)
    }
  };

  try {
    const response = await fetch(`/projects/${currentProject.id}/lint/readiness_report.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report, null, 2)
    });

    if (!response.ok) {
      throw new Error('Direct save route not available in this environment');
    }

    showToast('Readiness report saved', `projects/${currentProject.id}/lint/readiness_report.json`, 'success', 3000);
  } catch (err) {
    const fallbackText = JSON.stringify(report, null, 2);
    await copyText(fallbackText);
    showToast('Save unavailable', 'Copied readiness_report.json content to clipboard', 'warning', 4500);
  }
}

/**
 * Show empty state
 */
function showEmptyState() {
  emptyState.style.display = 'block';
  gridView.style.display = 'none';
  timelineView.style.display = 'none';
}

/**
 * Hide empty state
 */
function hideEmptyState() {
  emptyState.style.display = 'none';
}


function ensureStoryboardMetadata(shot) {
  if (!shot) return;
  if (typeof shot.locked !== 'boolean') {
    shot.locked = false;
  }
  if (!shot.sourceType) {
    shot.sourceType = inferShotSource(shot);
  }
}

function inferShotSource(shot) {
  if (shot.status && shot.status !== 'not_rendered') return 'Rendered';
  const noteBlob = `${shot.notes || ''} ${(shot.description || '')}`.toLowerCase();
  if (noteBlob.includes('character')) return 'Character Ref';
  if (noteBlob.includes('location')) return 'Location Ref';
  return 'Manual';
}

function getSourceBadgeClass(sourceType) {
  switch (sourceType) {
    case 'Rendered': return 'source-rendered';
    case 'Character Ref': return 'source-character';
    case 'Location Ref': return 'source-location';
    default: return 'source-manual';
  }
}

function queueStoryboardSave() {
  if (saveStoryboardTimer) {
    clearTimeout(saveStoryboardTimer);
  }
  saveStoryboardTimer = setTimeout(() => {
    saveStoryboardSequence();
  }, 150);
}

async function saveStoryboardSequence() {
  if (!sequenceData || !Array.isArray(sequenceData.selections)) return;

  const projectParam = currentProject ? `?project=${currentProject.id}` : '';
  const payload = {
    selections: sequenceData.selections.map(shot => ({
      shotId: shot.shotId,
      locked: !!shot.locked,
      sourceType: shot.sourceType || inferShotSource(shot)
    }))
  };

  try {
    const response = await fetch(`/api/storyboard/sequence${projectParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to save storyboard sequence');
    }
  } catch (err) {
    console.error('Failed to persist storyboard sequence:', err);
    showToast('Save failed', err.message, 'error', 4000);
  }
}

function moveShotInSequence(fromShotId, toShotId) {
  if (!fromShotId || !toShotId || fromShotId === toShotId || !sequenceData?.selections) return false;

  const fromIndex = sequenceData.selections.findIndex(s => s.shotId === fromShotId);
  const toIndex = sequenceData.selections.findIndex(s => s.shotId === toShotId);

  if (fromIndex < 0 || toIndex < 0) return false;

  const [moved] = sequenceData.selections.splice(fromIndex, 1);
  sequenceData.selections.splice(toIndex, 0, moved);
  return true;
}

/**
 * Render current view
 */
function renderView() {
  if (!orderedStoryboardShots || orderedStoryboardShots.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();
  renderReadinessPanel();

  updateTimelineControlsVisibility();

  if (currentView === 'grid') {
    gridView.style.display = 'block';
    timelineView.style.display = 'none';
    renderGridView();
  } else {
    gridView.style.display = 'none';
    timelineView.style.display = 'block';
    renderTimelineView();
  }
}

/**
 * Render grid view
 */
function renderGridView() {
  shotGrid.innerHTML = '';

  const filteredShots = getFilteredShotsForCurrentReadinessFilter(sequenceData.selections);

  filteredShots.forEach(shot => {
    const card = createShotCard(shot);
    shotGrid.appendChild(card);
  });

  if (filteredShots.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'readiness-filter-empty';
    empty.textContent = 'No shots match this readiness filter.';
    shotGrid.appendChild(empty);
  }
}

/**
 * Create shot card element
 */
function createShotCard(shot) {
  const card = document.createElement('div');
  card.className = 'shot-card';
  card.addEventListener('click', () => openShotModal(shot));

  // Thumbnail
  const thumbnail = document.createElement('div');
  thumbnail.className = 'shot-thumbnail';

  const preview = applyPreviewNode(thumbnail, shot);

  // Selection badge
  if (shot.selectedVariation && shot.selectedVariation !== 'none') {
    const badge = document.createElement('div');
    badge.className = 'shot-selection-badge';
    badge.textContent = `Option ${shot.selectedVariation}`;
    thumbnail.appendChild(badge);
  }

  // Review status dropdown
  const reviewStatus = document.createElement('select');
  reviewStatus.className = 'shot-status-select';
  REVIEW_STATUS_OPTIONS.forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = formatReviewStatus(status);
    reviewStatus.appendChild(option);
  });
  reviewStatus.value = shot.reviewStatus || 'draft';
  reviewStatus.addEventListener('click', (e) => e.stopPropagation());
  reviewStatus.addEventListener('change', async (e) => {
    e.stopPropagation();
    try {
      const updatedShot = await saveReviewUpdate(shot.shotId, { reviewStatus: e.target.value });
      Object.assign(shot, updatedShot);
      normalizeShotReviewData(shot);
      showToast('Review status updated', `${shot.shotId} → ${formatReviewStatus(shot.reviewStatus)}`, 'success', 2000);
      if (selectedShot?.shotId === shot.shotId) {
        selectedShot = shot;
        renderShotDetails();
      }
      renderView();
    } catch (err) {
      showToast('Failed to update status', err.message, 'error', 3500);
    }
  });
  thumbnail.appendChild(reviewStatus);

  const commentsBtn = document.createElement('button');
  commentsBtn.className = 'shot-comments-btn';
  commentsBtn.textContent = `Comments (${shot.comments?.length || 0})`;
  commentsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCommentsModal(shot);
  });
  thumbnail.appendChild(commentsBtn);

  card.appendChild(thumbnail);

  // Info
  const info = document.createElement('div');
  info.className = 'shot-info';

  const header = document.createElement('div');
  header.className = 'shot-card-header';

  const shotId = document.createElement('div');
  shotId.className = 'shot-id';
  shotId.textContent = shot.shotId;
  header.appendChild(shotId);

  const lockBtn = document.createElement('button');
  lockBtn.className = `shot-lock-btn ${shot.locked ? 'locked' : ''}`;
  lockBtn.type = 'button';
  lockBtn.textContent = shot.locked ? '\ud83d\udccc Pinned' : 'Pin';
  lockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    shot.locked = !shot.locked;
    renderView();
    queueStoryboardSave();
  });
  header.appendChild(lockBtn);

  info.appendChild(header);

  const sourceBadge = document.createElement('div');
  sourceBadge.className = `shot-source-badge ${getSourceBadgeClass(shot.sourceType)}`;
  sourceBadge.textContent = shot.sourceType;
  info.appendChild(sourceBadge);

  const meta = document.createElement('div');
  meta.className = 'shot-meta';

  const previewMetaAsset = resolveShotPreviewAsset(shot);
  if (previewMetaAsset?.source) {
    const source = document.createElement('div');
    source.className = 'shot-meta-item';
    source.textContent = `Preview: ${previewMetaAsset.source}`;
    meta.appendChild(source);
  }

  if (shot.timing) {
    const duration = document.createElement('div');
    duration.className = 'shot-meta-item';
    duration.textContent = `Duration: ${shot.timing.duration || 8}s`;
    meta.appendChild(duration);

    if (shot.timing.musicSection) {
      const section = document.createElement('div');
      section.className = 'shot-meta-item';
      section.textContent = `Section: ${shot.timing.musicSection}`;
      meta.appendChild(section);
    }
  }

  info.appendChild(meta);
  card.appendChild(info);

  return card;
}


function formatTimeLabel(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function getProjectQueryParam() {
  return currentProject ? `?project=${encodeURIComponent(currentProject.id)}` : '';
}

async function loadShotListTiming() {
  try {
    const response = await fetch(`/api/load/canon/script${getProjectQueryParam()}`);
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || !payload.content) return null;

    const parsed = JSON.parse(payload.content);
    const shots = Array.isArray(parsed?.shots) ? parsed.shots : [];
    const timingByShotId = {};

    shots.forEach(shot => {
      const shotId = shot?.id;
      const timing = shot?.timing || {};
      if (!shotId) return;
      const start = Number(timing.start);
      const duration = Number(timing.duration);
      const end = Number(timing.end);
      if (!Number.isFinite(start)) return;
      const safeDuration = Number.isFinite(duration) && duration > 0
        ? duration
        : (Number.isFinite(end) && end > start ? end - start : 0);
      timingByShotId[shotId] = {
        start,
        duration: safeDuration,
        end: Number.isFinite(end) && end >= start ? end : start + safeDuration,
        musicSection: timing.musicSection || null
      };
    });

    return Object.keys(timingByShotId).length > 0 ? timingByShotId : null;
  } catch (err) {
    console.warn('Could not load shot_list timing:', err);
    return null;
  }
}

function deriveShotRanges(timingByShotId) {
  const selections = Array.isArray(sequenceData?.selections) ? sequenceData.selections : [];
  const totalDuration = Number(sequenceData?.totalDuration) || 0;

  if (selections.length === 0) return [];

  const hasCompleteTiming = Boolean(timingByShotId) && selections.every(shot => timingByShotId[shot.shotId]);
  if (hasCompleteTiming) {
    return selections
      .map((shot, index) => {
        const timing = timingByShotId[shot.shotId];
        return {
          shot,
          index,
          start: timing.start,
          end: timing.end,
          duration: Math.max(0.001, timing.duration || (timing.end - timing.start) || 0.001),
          musicSection: timing.musicSection || shot.timing?.musicSection || 'Unknown'
        };
      })
      .sort((a, b) => a.start - b.start || a.index - b.index);
  }

  const fallbackTotal = totalDuration > 0 ? totalDuration : selections.length * 8;
  const slice = fallbackTotal / selections.length;
  return selections.map((shot, index) => {
    const start = index * slice;
    const end = (index + 1) * slice;
    return {
      shot,
      index,
      start,
      end,
      duration: Math.max(0.001, end - start),
      musicSection: shot.timing?.musicSection || 'Unknown'
    };
  });
}

function syncAudioSource() {
  if (!storyboardAudio) return;
  if (!sequenceData?.musicFile) {
    storyboardAudio.removeAttribute('src');
    storyboardAudio.load();
    return;
  }
  const normalized = sequenceData.musicFile.startsWith('/') ? sequenceData.musicFile : `/${sequenceData.musicFile}`;
  if (storyboardAudio.getAttribute('src') !== normalized) {
    storyboardAudio.src = normalized;
    storyboardAudio.load();
  }
}

function updateCurrentTimeIndicator(currentTime, totalDuration) {
  if (!timelineCurrentIndicator) return;
  const safeTotal = totalDuration > 0 ? totalDuration : 1;
  const ratio = Math.min(1, Math.max(0, currentTime / safeTotal));
  timelineCurrentIndicator.style.left = `${ratio * 100}%`;
}

function highlightActiveShot(currentTime, shotRanges) {
  const active = shotRanges.find(r => currentTime >= r.start && currentTime < r.end) || shotRanges[shotRanges.length - 1] || null;
  document.querySelectorAll('.timeline-shot').forEach(el => {
    if (active && el.dataset.shotId === active.shot.shotId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

function bindTimelinePlayback(shotRanges, totalDuration) {
  if (!storyboardAudio || !timelineRuler) return;

  const seekTo = (seconds) => {
    const max = totalDuration > 0 ? totalDuration : (storyboardAudio.duration || 0);
    const target = Math.max(0, Math.min(seconds, max || seconds));
    storyboardAudio.currentTime = target;
    updateCurrentTimeIndicator(target, totalDuration || storyboardAudio.duration || 1);
    highlightActiveShot(target, shotRanges);
  };

  const seekFromPointerEvent = (event) => {
    const rect = timelineRuler.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const max = totalDuration > 0 ? totalDuration : (storyboardAudio.duration || 0);
    seekTo(ratio * max);
  };

  timelineRuler.onclick = seekFromPointerEvent;
  timelineRuler.onkeydown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    seekTo((storyboardAudio.currentTime || 0) + delta);
  };

  storyboardAudio.ontimeupdate = () => {
    const current = storyboardAudio.currentTime || 0;
    const safeTotal = totalDuration > 0 ? totalDuration : (storyboardAudio.duration || 1);
    updateCurrentTimeIndicator(current, safeTotal);
    highlightActiveShot(current, shotRanges);
  };

  storyboardAudio.onloadedmetadata = () => {
    const effective = totalDuration > 0 ? totalDuration : (storyboardAudio.duration || 0);
    const durationEl = document.getElementById('timelineDuration');
    if (durationEl) durationEl.textContent = formatTimeLabel(effective);
    updateCurrentTimeIndicator(storyboardAudio.currentTime || 0, effective || 1);
  };

  updateCurrentTimeIndicator(storyboardAudio.currentTime || 0, totalDuration || 1);
  highlightActiveShot(storyboardAudio.currentTime || 0, shotRanges);
}

/**
 * Render timeline view
 */
async function renderTimelineView() {
  timelineTrack.innerHTML = '';
  renderTimelineFilmstrip();

  const sections = {};
  const filteredShots = getFilteredShotsForCurrentReadinessFilter(sequenceData.selections);

  filteredShots.forEach(shot => {
    const sectionName = shot.timing?.musicSection || 'Unknown';
    if (!sections[sectionName]) {
      sections[sectionName] = [];
    }
    sections[sectionName].push(range);
  });

  Object.keys(sections).forEach(sectionName => {
    const sectionEl = createTimelineSection(sectionName, sections[sectionName]);
    timelineTrack.appendChild(sectionEl);
  });

  bindTimelinePlayback(shotRanges, totalDuration);
}


function renderTimelineFilmstrip() {
  if (!timelineFilmstrip) return;
  timelineFilmstrip.innerHTML = '';

  sequenceData.selections.forEach(shot => {
    const item = document.createElement('div');
    item.className = `filmstrip-item ${shot.locked ? 'locked' : ''}`;
    item.draggable = !shot.locked;
    item.dataset.shotId = shot.shotId;

    item.addEventListener('dragstart', (e) => {
      if (shot.locked) {
        e.preventDefault();
        return;
      }
      dragShotId = shot.shotId;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', shot.shotId);
    });

    item.addEventListener('dragend', () => {
      dragShotId = null;
      document.querySelectorAll('.filmstrip-item').forEach(el => el.classList.remove('dragging', 'drop-target'));
    });

    item.addEventListener('dragover', (e) => {
      if (!dragShotId || dragShotId === shot.shotId || shot.locked) return;
      e.preventDefault();
      item.classList.add('drop-target');
    });

    item.addEventListener('dragleave', () => item.classList.remove('drop-target'));

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drop-target');
      const fromShotId = e.dataTransfer.getData('text/plain') || dragShotId;
      if (!fromShotId) return;
      const moved = moveShotInSequence(fromShotId, shot.shotId);
      if (moved) {
        renderView();
        queueStoryboardSave();
      }
    });

    const thumb = document.createElement('div');
    thumb.className = 'filmstrip-thumb';
    const thumbnailPath = shot.renderFiles?.thumbnail;
    if (thumbnailPath) {
      const img = document.createElement('img');
      img.src = `/${thumbnailPath}`;
      img.alt = shot.shotId;
      thumb.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'filmstrip-placeholder';
      placeholder.textContent = shot.shotId;
      thumb.appendChild(placeholder);
    }

    const meta = document.createElement('div');
    meta.className = 'filmstrip-meta';

    const label = document.createElement('div');
    label.className = 'filmstrip-label';
    label.textContent = shot.shotId;
    meta.appendChild(label);

    const source = document.createElement('div');
    source.className = `shot-source-badge ${getSourceBadgeClass(shot.sourceType)}`;
    source.textContent = shot.sourceType;
    meta.appendChild(source);

    const lock = document.createElement('button');
    lock.type = 'button';
    lock.className = `filmstrip-lock ${shot.locked ? 'locked' : ''}`;
    lock.textContent = shot.locked ? 'Unpin' : 'Pin';
    lock.addEventListener('click', (e) => {
      e.stopPropagation();
      shot.locked = !shot.locked;
      renderView();
      queueStoryboardSave();
    });

    item.appendChild(thumb);
    item.appendChild(meta);
    item.appendChild(lock);
    timelineFilmstrip.appendChild(item);
  });
}

/**
 * Create timeline section element
 */
function createTimelineSection(sectionName, ranges) {
  const section = document.createElement('div');
  section.className = 'timeline-section';

  const header = document.createElement('div');
  header.className = 'section-header';

  const name = document.createElement('div');
  name.className = 'section-name';
  name.textContent = sectionName;
  header.appendChild(name);

  if (ranges.length > 0) {
    const time = document.createElement('div');
    time.className = 'section-time';
    const firstRange = ranges[0];
    const lastRange = ranges[ranges.length - 1];
    time.textContent = `${formatTimeLabel(firstRange.start)} - ${formatTimeLabel(lastRange.end)}`;
    header.appendChild(time);
  }

  section.appendChild(header);

  const shotsContainer = document.createElement('div');
  shotsContainer.className = 'section-shots';

  ranges.forEach(range => {
    const shotEl = createTimelineShot(range);
    shotsContainer.appendChild(shotEl);
  });

  section.appendChild(shotsContainer);

  return section;
}

/**
 * Create timeline shot element
 */
function createTimelineShot(range) {
  const shot = range.shot;
  const shotEl = document.createElement('div');
  shotEl.className = 'timeline-shot';
  shotEl.dataset.shotId = shot.shotId;
  shotEl.style.cursor = 'pointer';
  shotEl.addEventListener('click', () => {
    if (storyboardAudio) {
      storyboardAudio.currentTime = range.start;
      storyboardAudio.play().catch(() => {});
    }
  });

  if (!reorderMode) {
    shotEl.addEventListener('click', () => openShotModal(shot));
  }

  applyPreviewNode(shotEl, shot);

  const label = document.createElement('div');
  label.className = 'timeline-shot-label';
  label.textContent = shot.shotId;
  shotEl.appendChild(label);

  if (reorderMode) {
    shotEl.classList.add('reorderable');
    shotEl.draggable = true;
    shotEl.dataset.shotId = shot.shotId;

    const dragHandle = document.createElement('div');
    dragHandle.className = 'timeline-shot-drag-handle';
    dragHandle.textContent = index !== null ? `#${index + 1}` : '\u2630';
    shotEl.appendChild(dragHandle);

    shotEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', shot.shotId);
      shotEl.classList.add('dragging');
    });

    shotEl.addEventListener('dragend', () => {
      shotEl.classList.remove('dragging');
      document.querySelectorAll('.timeline-shot.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    shotEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      shotEl.classList.add('drag-over');
    });

    shotEl.addEventListener('dragleave', () => {
      shotEl.classList.remove('drag-over');
    });

    shotEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      shotEl.classList.remove('drag-over');

      const sourceShotId = e.dataTransfer.getData('text/plain');
      const targetShotId = shot.shotId;
      if (!sourceShotId || sourceShotId === targetShotId) return;

      const currentOrder = getOrderedShots().map(s => s.shotId);
      const sourceIndex = currentOrder.indexOf(sourceShotId);
      const targetIndex = currentOrder.indexOf(targetShotId);
      if (sourceIndex < 0 || targetIndex < 0) return;

      currentOrder.splice(sourceIndex, 1);
      currentOrder.splice(targetIndex, 0, sourceShotId);

      await saveEditorialOrder(currentOrder);
    });
  }

  return shotEl;
}

/**
 * Open shot detail modal
 */
function openShotModal(shot) {
  selectedShot = shot;
  selectedVariation = shot.selectedVariation || null;

  modalTitle.textContent = shot.shotId;
  renderVariationGrid();
  renderShotDetails();

  shotModal.style.display = 'flex';
}

/**
 * Close modal
 */
function closeModal() {
  shotModal.style.display = 'none';
  selectedShot = null;
  selectedVariation = null;
}

/**
 * Render variation comparison grid
 */
function renderVariationGrid() {
  variationGrid.innerHTML = '';

  const variations = ['A', 'B', 'C', 'D'];
  variations.forEach(variation => {
    const card = createVariationCard(variation);
    variationGrid.appendChild(card);
  });
}

/**
 * Create variation card
 */
function createVariationCard(variation) {
  const card = document.createElement('div');
  card.className = 'variation-card';
  if (selectedVariation === variation) {
    card.classList.add('selected');
  }

  card.addEventListener('click', () => {
    selectedVariation = variation;
    // Re-render to update selection
    document.querySelectorAll('.variation-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
  });

  const header = document.createElement('div');
  header.className = 'variation-header';

  const label = document.createElement('div');
  label.className = 'variation-label';
  label.textContent = `Option ${variation}`;
  header.appendChild(label);

  const check = document.createElement('div');
  check.className = 'variation-check';
  check.textContent = '\u2713';
  header.appendChild(check);

  card.appendChild(header);

  const preview = document.createElement('div');
  preview.className = 'variation-preview';

  const videoPath = selectedShot.renderFiles?.kling?.[variation];
  if (videoPath) {
    // Show existing video
    const video = document.createElement('video');
    video.src = `/${videoPath}`;
    video.controls = true;
    video.preload = 'metadata';
    preview.appendChild(video);
  } else {
    // Show drop zone
    const dropZone = document.createElement('div');
    dropZone.className = 'variation-drop-zone';
    dropZone.innerHTML = `
      <div class="drop-zone-content">
        <span class="drop-zone-icon">MP4</span>
        <span class="drop-zone-label">Drop MP4 here</span>
      </div>
    `;
    preview.appendChild(dropZone);

    // Setup drag-and-drop
    setupVariationDropZone(dropZone, selectedShot.shotId, variation);
  }

  card.appendChild(preview);

  // Add camera info if available from prompts
  const info = document.createElement('div');
  info.className = 'variation-info';
  info.textContent = `Variation ${variation}`;
  card.appendChild(info);

  return card;
}

/**
 * Setup variation drop zone handlers
 */
function setupVariationDropZone(dropZone, shotId, variation) {
  // Drag over
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  // Drag leave
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });

  // Drop
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadShotFile(files[0], shotId, variation);
    }
  });

  // Click to browse
  dropZone.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card selection

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp4,.mov';
    input.onchange = async (e) => {
      if (e.target.files.length > 0) {
        await uploadShotFile(e.target.files[0], shotId, variation);
      }
    };
    input.click();
  });
}

/**
 * Upload shot variation file
 */
async function uploadShotFile(file, shotId, variation) {
  // Validate
  const ext = file.name.toLowerCase();
  if (!ext.endsWith('.mp4') && !ext.endsWith('.mov')) {
    showToast('Invalid file', 'Please upload MP4 or MOV', 'error', 4000);
    return;
  }

  if (file.size > 500 * 1024 * 1024) {
    showToast('File too large', 'Maximum size is 500MB', 'error', 4000);
    return;
  }

  const loadingToast = showToast('Uploading...', `${shotId} - Option ${variation}`, 'info', 0);

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('shotId', shotId);
    formData.append('variation', variation);
    formData.append('fileType', 'kling');

    const projectParam = currentProject ? `?project=${currentProject.id}` : '';
    const response = await fetch(`/api/upload/shot${projectParam}`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    dismissToast(loadingToast);
    showToast('Upload complete', `${shotId} - Option ${variation}`, 'success', 3000);

    // Reload sequence
    await loadSequence();

    // Refresh modal if still open
    if (selectedShot && selectedShot.shotId === shotId) {
      renderVariationGrid();
    }

  } catch (err) {
    console.error('Shot upload error:', err);
    dismissToast(loadingToast);
    showToast('Upload failed', err.message, 'error', 4000);
  }
}

/**
 * Render shot details
 */
function renderShotDetails() {
  shotDetails.innerHTML = '';
  const h3 = document.createElement('h3');
  h3.textContent = 'Shot Details';
  shotDetails.appendChild(h3);

  const override = getShotPrevisOverride(selectedShot.shotId);
  const fields = [
    ['Shot ID', selectedShot.shotId],
    ['Duration', (selectedShot.timing?.duration || 8) + 's'],
    ['Music Section', selectedShot.timing?.musicSection || 'N/A'],
    ['Status', selectedShot.status || 'not_rendered'],
    ['Review', formatReviewStatus(selectedShot.reviewStatus || 'draft')],
    ['Assignee', selectedShot.assignee || 'Unassigned']
  ];

  if (override) {
    fields.push(['Preview Source', override.sourceType]);
    fields.push(['Locked', override.locked ? 'Yes' : 'No']);
  }

  if (selectedShot.notes) fields.push(['Notes', selectedShot.notes]);

  fields.forEach(([label, value]) => {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = label + ': ';
    p.appendChild(strong);
    p.appendChild(document.createTextNode(value));
    shotDetails.appendChild(p);
  });


  const assigneeWrap = document.createElement('div');
  assigneeWrap.className = 'assignee-editor';
  assigneeWrap.innerHTML = `
    <label for="shotAssigneeInput"><strong>Assignee:</strong></label>
    <input id="shotAssigneeInput" type="text" value="${selectedShot.assignee || ''}" placeholder="Name or @handle" />
    <button class="btn btn-small btn-secondary" id="saveAssigneeBtn">Save Assignee</button>
  `;
  shotDetails.appendChild(assigneeWrap);

  const saveAssigneeBtn = document.getElementById('saveAssigneeBtn');
  const shotAssigneeInput = document.getElementById('shotAssigneeInput');
  if (saveAssigneeBtn && shotAssigneeInput) {
    saveAssigneeBtn.addEventListener('click', async () => {
      try {
        const updatedShot = await saveReviewUpdate(selectedShot.shotId, { assignee: shotAssigneeInput.value });
        Object.assign(selectedShot, updatedShot);
        normalizeShotReviewData(selectedShot);
        showToast('Assignee updated', `${selectedShot.shotId} assigned`, 'success', 2000);
        renderView();
        renderShotDetails();
      } catch (err) {
        showToast('Failed to save assignee', err.message, 'error', 3500);
      }
    });
  }
}

async function setShotPrevisFromSource(sourceType) {
  if (!selectedShot) return;

  let sourceRef = null;
  if (sourceType === 'character_ref') {
    sourceRef = getDefaultCharacterRef(selectedShot);
    if (!sourceRef) {
      showToast('No character reference', `${selectedShot.shotId} has no characterRef/characterId`, 'warning', 3000);
      return;
    }
  } else if (sourceType === 'location_ref') {
    sourceRef = getDefaultLocationRef(selectedShot);
    if (!sourceRef) {
      showToast('No location reference', `${selectedShot.shotId} has no locationRef/locationId`, 'warning', 3000);
      return;
    }
  } else {
    const preview = getFallbackPreviewAsset(selectedShot);
    sourceRef = preview.path;
    if (!sourceRef) {
      showToast('No rendered source', 'No rendered preview asset is available for this shot', 'warning', 3000);
      return;
    }
    sourceType = preview.sourceType || 'rendered_thumbnail';
  }

  try {
    const existing = getShotPrevisOverride(selectedShot.shotId);
    await saveShotPrevisOverride(selectedShot.shotId, {
      sourceType,
      sourceRef,
      locked: existing?.locked || false,
      notes: existing?.notes || ''
    });

    showToast('Preview source updated', `${selectedShot.shotId}: ${sourceType}`, 'success', 2000);
    renderShotDetails();
    renderView();
  } catch (err) {
    showToast('Failed to update source', err.message, 'error', 3000);
  }
}

async function toggleShotPrevisLock() {
  if (!selectedShot) return;

  const existing = getShotPrevisOverride(selectedShot.shotId);
  const fallbackPreview = getFallbackPreviewAsset(selectedShot);
  const nextLocked = !(existing?.locked || false);

  if (!existing && !fallbackPreview.path) {
    showToast('Cannot lock selection', 'No preview source available to lock', 'warning', 3000);
    return;
  }

  const sourceType = existing?.sourceType || fallbackPreview.sourceType || 'rendered_video';
  const sourceRef = existing?.sourceRef || fallbackPreview.path;

  try {
    await saveShotPrevisOverride(selectedShot.shotId, {
      sourceType,
      sourceRef,
      locked: nextLocked,
      notes: existing?.notes || ''
    });

    showToast(nextLocked ? 'Selection locked' : 'Selection unlocked', selectedShot.shotId, 'success', 2000);
    renderShotDetails();
    renderView();
  } catch (err) {
    showToast('Failed to update lock', err.message, 'error', 3000);
  }
}

async function handleResetShotPrevis() {
  if (!selectedShot) return;

  try {
    await resetShotPrevisOverride(selectedShot.shotId);
    showToast('Reset to auto', `${selectedShot.shotId} now follows auto preview resolution`, 'success', 2000);
    renderShotDetails();
    renderView();
  } catch (err) {
    showToast('Reset failed', err.message, 'error', 3000);
  }
}


/**
 * Save selection
 */
async function saveSelection() {
  if (!selectedShot || !selectedVariation) {
    showToast('No selection', 'Please select a variation first', 'warning', 3000);
    return;
  }

  // Update sequence data
  const shotIndex = sequenceData.selections.findIndex(s => s.shotId === selectedShot.shotId);
  if (shotIndex !== -1) {
    sequenceData.selections[shotIndex].selectedVariation = selectedVariation;
  } else {
    sequenceData.selections.push({
      shotId: selectedShot.shotId,
      shotNumber: selectedShot.shotNumber || null,
      selectedVariation,
      timing: selectedShot.timing || null,
      renderFiles: selectedShot.renderFiles || {},
      status: selectedShot.status || 'reference_preview'
    });
  }

  const orderedIndex = orderedStoryboardShots.findIndex(s => s.shotId === selectedShot.shotId);
  if (orderedIndex !== -1) {
    orderedStoryboardShots[orderedIndex].selectedVariation = selectedVariation;
  }

  // In a real implementation, this would save to the server
  // For now, just update local state and re-render
  console.log(`Selected variation ${selectedVariation} for ${selectedShot.shotId}`);

  queueStoryboardSave();
  showToast('Selection saved', `${selectedShot.shotId}: Option ${selectedVariation}`, 'success', 2000);
  closeModal();
  renderView();
  updateStats();
}

function openCommentsModal(shot) {
  commentsModalShot = shot;
  const commentsModal = document.getElementById('commentsModal');
  const commentsTitle = document.getElementById('commentsModalTitle');
  const newCommentText = document.getElementById('newCommentText');
  commentsTitle.textContent = `${shot.shotId} Comments`;
  newCommentText.value = '';
  renderCommentsList();
  commentsModal.style.display = 'flex';
}

function closeCommentsModal() {
  const commentsModal = document.getElementById('commentsModal');
  commentsModal.style.display = 'none';
  commentsModalShot = null;
}

function renderCommentsList() {
  const commentsList = document.getElementById('commentsList');
  commentsList.innerHTML = '';

  const comments = commentsModalShot?.comments || [];
  if (comments.length === 0) {
    commentsList.innerHTML = '<p class="comments-empty">No comments yet.</p>';
    return;
  }

  comments.forEach(comment => {
    const item = document.createElement('div');
    item.className = 'comment-item';

    const text = document.createElement('div');
    text.className = 'comment-text';
    text.textContent = comment.text;

    const timestamp = document.createElement('div');
    timestamp.className = 'comment-time';
    timestamp.textContent = new Date(comment.timestamp).toLocaleString();

    item.appendChild(text);
    item.appendChild(timestamp);
    commentsList.appendChild(item);
  });
}

async function addCommentToCurrentShot() {
  if (!commentsModalShot) return;
  const newCommentText = document.getElementById('newCommentText');
  const text = newCommentText.value.trim();
  if (!text) {
    showToast('Comment required', 'Please type feedback before saving', 'warning', 2500);
    return;
  }

  try {
    const updatedShot = await saveReviewUpdate(commentsModalShot.shotId, { appendComment: text });
    Object.assign(commentsModalShot, updatedShot);
    normalizeShotReviewData(commentsModalShot);
    newCommentText.value = '';
    renderCommentsList();
    showToast('Comment added', commentsModalShot.shotId, 'success', 2000);
    if (selectedShot?.shotId === commentsModalShot.shotId) {
      selectedShot = commentsModalShot;
      renderShotDetails();
    }
    renderView();
  } catch (err) {
    showToast('Failed to add comment', err.message, 'error', 3500);
  }
}

/**
 * Export storyboard as PDF
 */
function exportPDF() {
  showToast('Exporting PDF', 'Opening print dialog...', 'info', 2000);
  setTimeout(() => {
    window.print();
  }, 300);
}

async function fetchContextBundle(includePromptTemplates = true) {
  const response = await fetch('/api/export/context-bundle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: currentProject?.id,
      includePromptTemplates
    })
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to export context bundle');
  }

  return result.bundle;
}

async function copyContextForAI() {
  try {
    const bundle = await fetchContextBundle(true);
    const contextText = `${bundle.markdown}\n\n\n---\n\nJSON Bundle:\n\n${JSON.stringify(bundle, null, 2)}`;
    await navigator.clipboard.writeText(contextText);
    showToast('Copied', 'Context bundle copied to clipboard', 'success', 3000);
  } catch (err) {
    console.error('Copy context error:', err);
    showToast('Copy failed', err.message, 'error', 4000);
  }
}

async function downloadContextBundle() {
  try {
    const bundle = await fetchContextBundle(true);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const projectSlug = currentProject?.id || 'project';
    link.href = url;
    link.download = `${projectSlug}_context_bundle.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Downloaded', 'Context bundle JSON downloaded', 'success', 3000);
  } catch (err) {
    console.error('Download context error:', err);
    showToast('Download failed', err.message, 'error', 4000);
  }
}

// Event Listeners

/**
 * Initialize view tabs
 */
function initializeViewTabs() {
  const viewTabs = document.querySelectorAll('.view-tab');
  if (!viewTabs || viewTabs.length === 0) return;

  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      currentView = tab.dataset.view;
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (currentView !== 'timeline' && reorderModeEnabled) {
        reorderModeEnabled = false;
        updateReorderModeButtonLabel();
      }
      renderView();
    });
  });
}

/**
 * Initialize button event listeners
 */
function initializeButtons() {
  const exportBtn = document.getElementById('exportBtn');
  const copyContextBtn = document.getElementById('copyContextBtn');
  const downloadContextBtn = document.getElementById('downloadContextBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const reorderModeBtn = document.getElementById('reorderModeBtn');
  const resetOrderBtn = document.getElementById('resetOrderBtn');
  const storyboardFocusBtn = document.getElementById('storyboardFocusBtn');
  const modalClose = document.getElementById('modalClose');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCancel = document.getElementById('modal-cancel');
  const modalSave = document.getElementById('modal-save');
  const reviewFilter = document.getElementById('reviewFilter');
  const commentsModalClose = document.getElementById('commentsModalClose');
  const commentsModalOverlay = document.getElementById('commentsModalOverlay');
  const addCommentBtn = document.getElementById('addCommentBtn');

  if (exportBtn) exportBtn.addEventListener('click', exportPDF);
  if (copyContextBtn) copyContextBtn.addEventListener('click', copyContextForAI);
  if (downloadContextBtn) downloadContextBtn.addEventListener('click', downloadContextBundle);
  if (refreshBtn) refreshBtn.addEventListener('click', loadSequence);
  if (reviewFilter) {
    reviewFilter.addEventListener('change', (e) => {
      currentReviewFilter = e.target.value;
      renderView();
    });
  }
  if (storyboardFocusBtn) {
    storyboardFocusBtn.addEventListener('click', () => {
      document.body.classList.toggle('focus-mode');
      storyboardFocusBtn.textContent = document.body.classList.contains('focus-mode') ? 'Exit Focus' : 'Focus Mode';
    });
  }
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
  if (modalCancel) modalCancel.addEventListener('click', closeModal);
  if (modalSave) modalSave.addEventListener('click', saveSelection);
  if (clearReadinessFilterBtn) {
    clearReadinessFilterBtn.addEventListener('click', () => {
      currentReadinessFilter = 'all';
      renderView();
    });
  }
  if (saveReadinessReportBtn) saveReadinessReportBtn.addEventListener('click', saveReadinessReport);
}

// Project selector event listeners
const projectSelector = document.getElementById('projectSelector');
if (projectSelector) {
  projectSelector.addEventListener('change', (e) => {
    switchProject(e.target.value);
  });
}

// New project modal event listeners
const newProjectBtn = document.getElementById('newProjectBtn');
const newProjectModal = document.getElementById('newProjectModal');
const newProjectModalClose = document.getElementById('newProjectModalClose');
const newProjectModalOverlay = document.getElementById('newProjectModalOverlay');
const cancelNewProjectBtn = document.getElementById('cancelNewProject');
const createNewProjectBtn = document.getElementById('createNewProject');

if (newProjectBtn && newProjectModal) {
  newProjectBtn.addEventListener('click', () => {
    newProjectModal.style.display = 'flex';
    document.getElementById('projectName').value = '';
    document.getElementById('projectDescription').value = '';
  });

  const closeNewProjectModal = () => {
    newProjectModal.style.display = 'none';
  };

  newProjectModalClose?.addEventListener('click', closeNewProjectModal);
  newProjectModalOverlay?.addEventListener('click', closeNewProjectModal);
  cancelNewProjectBtn?.addEventListener('click', closeNewProjectModal);

  createNewProjectBtn?.addEventListener('click', async () => {
    const name = document.getElementById('projectName').value.trim();
    const description = document.getElementById('projectDescription').value.trim();

    if (!name) {
      showToast('Error', 'Project name is required', 'error', 3000);
      return;
    }

    const loadingToast = showToast('Creating project...', name, 'info', 0);

    try {
      await createNewProject(name, description);
    } catch (err) {
      dismissToast(loadingToast);
      showToast('Failed to create project', err.message, 'error', 4000);
    }
  });
}

// Initialize
(async () => {
  // Initialize DOM elements first
  initializeDOMElements();

  const projectsLoaded = await loadProjects();
  if (projectsLoaded) {
    initializeViewTabs();
    initializeButtons();
    updateReorderModeButtonLabel();
    await loadSequence();
    initMusicUpload();
  } else {
    showEmptyState();
    showToast('No projects found', 'Run npm run migrate to initialize multi-project support', 'info', 0);
  }
})();

