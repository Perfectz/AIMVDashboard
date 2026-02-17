// Storyboard Viewer - Application Logic
// Version: 2026-02-07 (Multi-Project Support)

let sequenceData = null;
let currentView = 'grid';
let dragShotId = null;
let saveStoryboardTimer = null;
let selectedShot = null;
let selectedVariation = null;
let currentProject = null;
let latestContextBundle = null;
let orderedStoryboardShots = [];
let previsMap = {};
let assetManifest = [];
let filteredAssets = [];
let currentReadinessData = null;
let currentReadinessFilter = 'all';
let commentsModalShot = null;
let reorderModeEnabled = false;
let bulkSelectedIds = new Set();
let filmstripIndex = 0;
let filmstripPlayInterval = null;
let filmstripShots = [];
let storyboardUploadService = null;
let projectService = null;
let reviewService = null;
let storyboardPageService = null;
let bootstrapService = null;
let lintReportService = null;
let promptLintSummary = { passed: 0, failed: 0, totalShots: 0 };
const projectContext = window.ProjectContext || null;
const projectActions = window.ProjectActions || null;
const PREVIS_REF_SLOT = '1';
const REVIEW_STATUSES = ['draft', 'in_review', 'approved', 'changes_requested'];
const REVIEW_STATUS_OPTIONS = REVIEW_STATUSES;
const REVIEW_STATUS_LABELS = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  changes_requested: 'Changes Requested'
};
const activeReviewFilters = new Set(REVIEW_STATUSES);

function formatReviewStatus(status) {
  return REVIEW_STATUS_LABELS[status] || status || 'Draft';
}

function resolveShotPreviewAsset(shot) {
  const preview = getShotPreviewAsset(shot);
  return {
    path: preview.path,
    source: preview.sourceType || null,
    isOverride: preview.isOverride,
    locked: preview.locked,
    notes: preview.notes
  };
}

function requireProjectContext() {
  if (!projectContext || typeof projectContext.getProjectIdFromQuery !== 'function' || typeof projectContext.navigateWithProject !== 'function') {
    throw new Error('ProjectContext is unavailable. Ensure ui/modules/project-context.js is loaded before storyboard.js');
  }
  return projectContext;
}

function getStoryboardUploadService() {
  if (storyboardUploadService) return storyboardUploadService;

  if (!window.StoryboardUploadService || !window.StoryboardUploadService.createStoryboardUploadService) {
    throw new Error('Upload service is unavailable');
  }

  storyboardUploadService = window.StoryboardUploadService.createStoryboardUploadService();
  return storyboardUploadService;
}


function getProjectService() {
  if (projectService) return projectService;
  if (!window.ProjectService || !window.ProjectService.createProjectService) {
    throw new Error('Project service is unavailable');
  }
  projectService = window.ProjectService.createProjectService();
  return projectService;
}

function getReviewService() {
  if (reviewService) return reviewService;
  if (!window.ReviewService || !window.ReviewService.createReviewService) {
    throw new Error('Review service is unavailable');
  }
  reviewService = window.ReviewService.createReviewService();
  return reviewService;
}

function getStoryboardPageService() {
  if (storyboardPageService) return storyboardPageService;
  if (!window.StoryboardPageService || !window.StoryboardPageService.createStoryboardPageService) {
    throw new Error('Storyboard page service is unavailable');
  }
  storyboardPageService = window.StoryboardPageService.createStoryboardPageService();
  return storyboardPageService;
}

// Shared utilities (from modules/shared-utils.js)
const { escapeHtml, copyText, showToast, dismissToast, showLoading, hideLoading, renderContextDrawer, bundleToMarkdown, downloadJson } = window.SharedUtils;

// DOM Elements (will be accessed via document.getElementById when needed)
// These are kept as variables for functions that use them repeatedly
let emptyState, gridView, timelineView, shotGrid, timelineTrack, timelineFilmstrip;
let shotModal, modalTitle, variationGrid, shotDetails;
let statShots, statReady, statPassed, statFailed;
let assetTypeFilter, assetStatusFilter, assetShotFilter, assetTableBody, assetCount, assetEmptyState;
let reviewFilterChips, readinessPanel, readinessCounts, readinessLists, readinessRecommendations, clearReadinessFilterBtn;
let timelineRuler, timelineCurrentIndicator, storyboardAudio;
let readinessBar, readinessSummary, readinessBarToggle, manifestToggleBtn, manifestBody, musicStatusPill, musicStatusAction;
let filmstripView, filmstripScrollTrack, filmstripPlayerStage, filmstripPlayerImage, filmstripPlayerVideo;
let filmstripPlayerLabel, filmstripPlayerCounter, filmstripPlayerEmpty, filmstripPlayBtn, filmstripSpeedSelect;
let filmstripMusicBar, filmstripMusicToggle, filmstripMusicProgress, filmstripMusicFill, filmstripMusicTime, filmstripMusicName;

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
  statShots = document.getElementById('stat-shots');
  statReady = document.getElementById('stat-ready');
  statPassed = document.getElementById('stat-passed');
  statFailed = document.getElementById('stat-failed');
  assetTypeFilter = document.getElementById('assetTypeFilter');
  assetStatusFilter = document.getElementById('assetStatusFilter');
  assetShotFilter = document.getElementById('assetShotFilter');
  assetTableBody = document.getElementById('assetTableBody');
  assetCount = document.getElementById('assetCount');
  assetEmptyState = document.getElementById('assetEmptyState');
  reviewFilterChips = document.getElementById('reviewFilterChips');
  readinessPanel = document.getElementById('readinessPanel');
  readinessCounts = document.getElementById('readinessCounts');
  readinessLists = document.getElementById('readinessLists');
  readinessRecommendations = document.getElementById('readinessRecommendations');
  clearReadinessFilterBtn = document.getElementById('clearReadinessFilterBtn');
  timelineRuler = document.getElementById('timelineRuler');
  timelineCurrentIndicator = document.getElementById('timelineCurrentIndicator');
  storyboardAudio = document.getElementById('storyboardAudio');
  readinessBar = document.getElementById('readinessBar');
  readinessSummary = document.getElementById('readinessSummary');
  readinessBarToggle = document.getElementById('readinessBarToggle');
  manifestToggleBtn = document.getElementById('manifestToggleBtn');
  manifestBody = document.getElementById('manifestBody');
  musicStatusPill = document.getElementById('musicStatusPill');
  musicStatusAction = document.getElementById('musicStatusAction');
  filmstripView = document.getElementById('filmstripView');
  filmstripScrollTrack = document.getElementById('filmstripScrollTrack');
  filmstripPlayerStage = document.getElementById('filmstripPlayerStage');
  filmstripPlayerImage = document.getElementById('filmstripPlayerImage');
  filmstripPlayerVideo = document.getElementById('filmstripPlayerVideo');
  filmstripPlayerLabel = document.getElementById('filmstripPlayerLabel');
  filmstripPlayerCounter = document.getElementById('filmstripPlayerCounter');
  filmstripPlayerEmpty = document.getElementById('filmstripPlayerEmpty');
  filmstripPlayBtn = document.getElementById('filmstripPlayBtn');
  filmstripSpeedSelect = document.getElementById('filmstripSpeedSelect');
  filmstripMusicBar = document.getElementById('filmstripMusicBar');
  filmstripMusicToggle = document.getElementById('filmstripMusicToggle');
  filmstripMusicProgress = document.getElementById('filmstripMusicProgress');
  filmstripMusicFill = document.getElementById('filmstripMusicFill');
  filmstripMusicTime = document.getElementById('filmstripMusicTime');
  filmstripMusicName = document.getElementById('filmstripMusicName');
}

function normalizeAssetManifest(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.assets)) return data.assets;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function collectShotIds(asset) {
  const used = asset.usedIn || asset.used_in || asset.usedInShots || asset.shotIds || [];
  if (Array.isArray(used)) return used.map(String);
  return [];
}

async function loadAssetManifest() {
  try {
    const result = await getStoryboardPageService().loadAssetManifest(currentProject && currentProject.id);
    if (!result.ok) {
      assetManifest = [];
      renderAssetPanel();
      return;
    }
    assetManifest = normalizeAssetManifest(result.data);
    renderAssetPanel();
  } catch (err) {
    console.warn('Asset manifest load failed:', err.message);
    assetManifest = [];
    renderAssetPanel();
  }
}

function initializeAssetFilters() {
  if (!assetTypeFilter || !assetStatusFilter || !assetShotFilter) return;

  [assetTypeFilter, assetStatusFilter, assetShotFilter].forEach(select => {
    select.addEventListener('change', () => renderAssetRows());
  });
}

function getAssetField(asset, keys, fallback = 'Unknown') {
  for (const key of keys) {
    if (asset[key]) return String(asset[key]);
  }
  return fallback;
}

function renderAssetPanel() {
  if (!assetTableBody || !assetTypeFilter || !assetStatusFilter || !assetShotFilter) return;

  const allTypes = new Set();
  const allStatuses = new Set();
  const allShots = new Set();

  assetManifest.forEach(asset => {
    allTypes.add(getAssetField(asset, ['type'], 'unspecified'));
    allStatuses.add(getAssetField(asset, ['status'], 'unknown'));
    collectShotIds(asset).forEach(shotId => allShots.add(shotId));
  });

  assetTypeFilter.innerHTML = '<option value="all">All Types</option>';
  [...allTypes].sort().forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    assetTypeFilter.appendChild(option);
  });

  assetStatusFilter.innerHTML = '<option value="all">All Statuses</option>';
  [...allStatuses].sort().forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    assetStatusFilter.appendChild(option);
  });

  assetShotFilter.innerHTML = '<option value="all">Any Shot</option>';
  [...allShots].sort().forEach(shotId => {
    const option = document.createElement('option');
    option.value = shotId;
    option.textContent = shotId;
    assetShotFilter.appendChild(option);
  });

  renderAssetRows();
}

function renderAssetRows() {
  if (!assetTableBody) return;

  const selectedType = assetTypeFilter?.value || 'all';
  const selectedStatus = assetStatusFilter?.value || 'all';
  const selectedShot = assetShotFilter?.value || 'all';

  filteredAssets = assetManifest.filter(asset => {
    const type = getAssetField(asset, ['type'], 'unspecified');
    const status = getAssetField(asset, ['status'], 'unknown');
    const usedIn = collectShotIds(asset);

    if (selectedType !== 'all' && type !== selectedType) return false;
    if (selectedStatus !== 'all' && status !== selectedStatus) return false;
    if (selectedShot !== 'all' && !usedIn.includes(selectedShot)) return false;
    return true;
  });

  assetTableBody.innerHTML = '';
  if (assetCount) {
    assetCount.textContent = `${filteredAssets.length} / ${assetManifest.length} assets`;
  }

  if (filteredAssets.length === 0) {
    if (assetEmptyState) assetEmptyState.style.display = 'block';
    return;
  }

  if (assetEmptyState) assetEmptyState.style.display = 'none';

  filteredAssets.forEach(asset => {
    const row = document.createElement('tr');
    const assetName = getAssetField(asset, ['id', 'name', 'assetId'], 'Unnamed');
    const type = getAssetField(asset, ['type'], 'unspecified');
    const status = getAssetField(asset, ['status'], 'unknown');
    const owner = getAssetField(asset, ['owner'], '-');
    const source = getAssetField(asset, ['source'], '-');
    const usedIn = collectShotIds(asset);
    const missing = String(status).toLowerCase().includes('missing') || usedIn.length === 0;
    const makeCell = (text) => {
      const td = document.createElement('td');
      td.textContent = text;
      return td;
    };

    row.appendChild(makeCell(assetName));
    row.appendChild(makeCell(type));
    row.appendChild(makeCell(status));
    row.appendChild(makeCell(owner));
    row.appendChild(makeCell(source));

    const usedInCell = document.createElement('td');
    usedInCell.className = 'asset-used-in';
    row.appendChild(usedInCell);

    const readinessCell = document.createElement('td');
    const readinessBadge = document.createElement('span');
    readinessBadge.className = `asset-readiness ${missing ? 'asset-badge-missing' : 'asset-badge-ready'}`;
    readinessBadge.textContent = missing ? 'Missing' : 'Ready';
    readinessCell.appendChild(readinessBadge);
    row.appendChild(readinessCell);

    if (usedIn.length === 0) {
      usedInCell.textContent = '-';
    } else {
      usedIn.forEach((shotId, index) => {
        const button = document.createElement('button');
        button.className = 'asset-shot-link';
        button.textContent = shotId;
        button.addEventListener('click', () => jumpToShot(shotId));
        usedInCell.appendChild(button);
        if (index < usedIn.length - 1) {
          usedInCell.appendChild(document.createTextNode(' '));
        }
      });
    }

    assetTableBody.appendChild(row);
  });
}

function jumpToShot(shotId) {
  if (!sequenceData?.selections?.length) {
    showToast('Storyboard unavailable', 'Load storyboard data first', 'warning', 2500);
    return;
  }

  const shot = sequenceData.selections.find(item => item.shotId === shotId);
  if (!shot) {
    showToast('Shot not found', `${shotId} is not in the current sequence`, 'warning', 3000);
    return;
  }

  if (currentView !== 'grid') {
    currentView = 'grid';
    document.querySelectorAll('.view-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === 'grid');
    });
    renderView();
  }

  const shotCards = [...document.querySelectorAll('.shot-card')];
  const target = shotCards.find(card => card.querySelector('.shot-id')?.textContent === shotId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('asset-shot-highlight');
    setTimeout(() => target.classList.remove('asset-shot-highlight'), 1200);
  }

  openShotModal(shot);
}

async function openContextDrawer() {
  if (!currentProject) return;
  try {
    const result = await getStoryboardPageService().loadContextBundlePreview(currentProject.id);
    if (!result.ok) throw new Error(result.error || 'Failed to generate context bundle');
    latestContextBundle = result.data;
    renderContextDrawer(latestContextBundle);

    const drawer = document.getElementById('contextDrawer');
    const overlay = document.getElementById('contextDrawerOverlay');
    if (overlay) overlay.style.display = 'block';
    if (drawer) {
      drawer.classList.add('open');
      drawer.removeAttribute('inert');
    }
  } catch (err) {
    showToast('Preview failed', err.message, 'error', 3500);
  }
}

function closeContextDrawer() {
  const drawer = document.getElementById('contextDrawer');
  const overlay = document.getElementById('contextDrawerOverlay');
  if (overlay) overlay.style.display = 'none';
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('inert', '');
  }
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
  } else {
    updateMusicDisplay('');
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
    const result = await getStoryboardPageService().uploadMusic({
      projectId: currentProject && currentProject.id,
      file
    });

    if (!result.ok) {
      throw new Error(result.error || 'Upload failed');
    }

    currentMusicFile = result.data.filePath;
    updateMusicDisplay(result.data.filePath);
    showToast('Music uploaded', file.name, 'success', 3000);

    await loadSequence();

  } catch (err) {
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
  const filename = filePath ? filePath.split('/').pop() : '';

  if (filePath) {
    filenameDisplay.textContent = filename;
    dropZone.dataset.hasFile = 'true';
  } else {
    filenameDisplay.textContent = '';
    dropZone.dataset.hasFile = 'false';
  }

  if (musicStatusPill) {
    musicStatusPill.textContent = filename ? `Music: ${filename}` : 'No music uploaded';
    musicStatusPill.classList.toggle('has-music', Boolean(filename));
  }
  if (musicStatusAction) {
    musicStatusAction.textContent = filename ? 'Replace' : 'Upload';
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
function normalizeShotReviewData(shot) {
  if (!shot || typeof shot !== 'object') return;

  if (!REVIEW_STATUSES.includes(shot.reviewStatus)) {
    shot.reviewStatus = 'draft';
  }

  if (!Array.isArray(shot.comments)) {
    shot.comments = [];
  } else {
    shot.comments = shot.comments
      .map((comment) => {
        if (!comment || typeof comment !== 'object') return null;
        const author = typeof comment.author === 'string' && comment.author.trim()
          ? comment.author.trim()
          : 'Reviewer';
        const text = typeof comment.text === 'string' ? comment.text.trim() : '';
        if (!text) return null;
        const timestamp = typeof comment.timestamp === 'string' && comment.timestamp.trim()
          ? comment.timestamp
          : new Date().toISOString();
        return { author, text, timestamp };
      })
      .filter(Boolean);
  }

  if (typeof shot.assignee !== 'string') {
    shot.assignee = '';
  }
}

function normalizeSequenceReviewData(sequence) {
  if (!sequence || typeof sequence !== 'object') return;
  if (!Array.isArray(sequence.selections)) {
    sequence.selections = [];
  }
  sequence.selections.forEach((shot) => normalizeShotReviewData(shot));
}

function updateMusicPreview() {
  syncAudioSource();
}

// ===== PROJECT MANAGEMENT =====

/**
 * Load projects list and set active project
 */
async function loadProjects() {
  try {
    const queryProjectId = requireProjectContext().getProjectIdFromQuery();
    const storedProjectId = (() => {
      try { return localStorage.getItem('activeProject') || ''; } catch { return ''; }
    })();

    let projects = [];
    let resolvedCurrentProject = null;

    const bootstrap = getBootstrapService();
    if (bootstrap) {
      const boot = await bootstrap.loadBootstrap({
        projectId: queryProjectId || storedProjectId,
        pageId: 'storyboard'
      });
      if (boot.ok && boot.data && Array.isArray(boot.data.projects) && boot.data.projects.length > 0) {
        projects = boot.data.projects;
        resolvedCurrentProject = boot.data.currentProject || projects[0];
      }
    }

    if (projects.length === 0) {
      const service = getProjectService();
      const result = await service.listProjects();
      if (!result.ok) {
        return false;
      }
      const data = result.data || {};
      if (!data.success || !Array.isArray(data.projects) || data.projects.length === 0) {
        return false;
      }
      projects = data.projects;
      const activeId = queryProjectId || storedProjectId || projects[0].id;
      resolvedCurrentProject = projects.find((p) => p.id === activeId) || projects[0];
    }

    if (!resolvedCurrentProject || !resolvedCurrentProject.id) {
      return false;
    }

    currentProject = resolvedCurrentProject;
    try { localStorage.setItem('activeProject', currentProject.id); } catch {}

    const selector = document.getElementById('projectSelector');
    if (selector) {
      selector.innerHTML = '';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        opt.selected = p.id === currentProject.id;
        selector.appendChild(opt);
      });
    }

    return true;
  } catch (err) {
    console.warn('Project load failed:', err.message);
    return false;
  }
}

/**
 * Switch to a different project
 */
async function switchProject(projectId) {
  const nextProjectId = String(projectId || '').trim();
  if (!nextProjectId) return;
  try { localStorage.setItem('activeProject', nextProjectId); } catch {}
  requireProjectContext().navigateWithProject(nextProjectId);
}

function getBootstrapService() {
  if (bootstrapService) return bootstrapService;
  if (!window.BootstrapService || !window.BootstrapService.createBootstrapService) {
    return null;
  }
  bootstrapService = window.BootstrapService.createBootstrapService();
  return bootstrapService;
}

function getLintReportService() {
  if (lintReportService) return lintReportService;
  if (!window.LintReportService || !window.LintReportService.createLintReportService) {
    throw new Error('Lint report service is unavailable');
  }
  lintReportService = window.LintReportService.createLintReportService();
  return lintReportService;
}

/**
 * Create a new project
 */
async function createNewProject(name, description) {
  try {
    const service = getProjectService();
    const result = await service.createProject({ name, description });
    if (!result.ok || !result.data || !result.data.project) {
      throw new Error(result.error || 'Failed to create project');
    }

    try { localStorage.setItem('activeProject', result.data.project.id); } catch {}
    requireProjectContext().navigateWithProject(result.data.project.id);
  } catch (err) {
    throw err;
  }
}

async function deleteActiveProject(projectId) {
  try {
    const service = getProjectService();
    const result = await service.deleteProject(projectId);
    if (!result.ok) {
      throw new Error(result.error || 'Failed to delete project');
    }

    const projectsResult = await service.listProjects();
    if (projectsResult.ok && projectsResult.data && Array.isArray(projectsResult.data.projects) && projectsResult.data.projects.length > 0) {
      const nextProjectId = projectsResult.data.projects[0].id;
      try { localStorage.setItem('activeProject', nextProjectId); } catch {}
      requireProjectContext().navigateWithProject(nextProjectId);
    } else {
      try { localStorage.removeItem('activeProject'); } catch {}
      requireProjectContext().navigateWithProject('');
    }
  } catch (err) {
    throw err;
  }
}


async function loadPrevisMap() {
  try {
    const service = getReviewService();
    const result = await service.loadPrevisMap(currentProject ? currentProject.id : '');
    if (!result.ok) {
      throw new Error(result.error || 'Failed to load previs map');
    }
    previsMap = result.data.previsMap || {};
  } catch (err) {
    console.warn('Previs map load failed:', err.message);
    previsMap = {};
  }
}

async function loadPromptLintSummary() {
  promptLintSummary = { passed: 0, failed: 0, totalShots: 0 };
  if (!currentProject?.id) return;

  try {
    const result = await getLintReportService().loadPromptsIndex(currentProject.id);
    if (!result.ok || !result.data) return;
    const data = result.data;

    const allPrompts = Array.isArray(data.allPrompts) ? data.allPrompts : [];
    promptLintSummary = {
      passed: allPrompts.filter((prompt) => prompt && prompt.lintStatus === 'PASS').length,
      failed: allPrompts.filter((prompt) => prompt && prompt.lintStatus === 'FAIL').length,
      totalShots: Number.isFinite(data.totalShots) ? data.totalShots : 0
    };
  } catch (err) {
    console.warn('Prompt lint summary load failed:', err.message);
    promptLintSummary = { passed: 0, failed: 0, totalShots: 0 };
  }
}

function getShotPrevisOverride(shotId) {
  if (!shotId || !previsMap || typeof previsMap !== 'object') {
    return null;
  }

  const entry = previsMap[shotId];
  return entry && typeof entry === 'object' ? entry : null;
}

function resolveRefSourcePath(sourceType, sourceRef) {
  if (!sourceRef) return null;

  if (sourceType === 'character_ref') {
    const [entityId, slot = PREVIS_REF_SLOT] = sourceRef.split(':');
    return `projects/${currentProject.id}/reference/characters/${entityId}/ref_${slot}.png`;
  }

  if (sourceType === 'location_ref') {
    const [entityId, slot = PREVIS_REF_SLOT] = sourceRef.split(':');
    return `projects/${currentProject.id}/reference/locations/${entityId}/ref_${slot}.png`;
  }

  return sourceRef;
}

function getFallbackPreviewAsset(shot) {
  const thumbnailPath = shot.renderFiles?.thumbnail;
  if (thumbnailPath) {
    return { path: thumbnailPath, sourceType: 'rendered_thumbnail', isOverride: false, locked: false, notes: '' };
  }

  const selectedVar = shot.selectedVariation || 'A';

  // Check seedream renders (first frame for the selected variation, then any variation)
  const seedreamFirst = shot.renderFiles?.seedream?.[selectedVar]?.first;
  if (seedreamFirst) {
    return { path: seedreamFirst, sourceType: 'rendered_first_frame', isOverride: false, locked: false, notes: '' };
  }
  // Try any seedream variation if selected doesn't have one
  const seedreamVariations = shot.renderFiles?.seedream;
  if (seedreamVariations) {
    for (const v of ['A', 'B', 'C', 'D']) {
      const firstPath = seedreamVariations[v]?.first;
      if (firstPath) {
        return { path: firstPath, sourceType: 'rendered_first_frame', isOverride: false, locked: false, notes: '' };
      }
    }
  }

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

async function loadSequence() {
  const loadingOverlay = showLoading(document.body, 'Loading storyboard...');

  try {
    const service = getReviewService();
    const result = await service.loadReviewSequence(currentProject ? currentProject.id : '');
    if (!result.ok) {
      throw new Error(result.error || 'Sequence file not found');
    }
    sequenceData = result.data;
    normalizeSequenceReviewData(sequenceData);
    orderedStoryboardShots = Array.isArray(sequenceData.selections) ? sequenceData.selections : [];
    updateMusicDisplay(sequenceData.musicFile || '');
    await loadPromptLintSummary();
    await loadReviewMetadata();
    updateStats();
    renderReviewFilterChips();
    renderView();

    if (orderedStoryboardShots.length > 0) {
      showToast('Storyboard loaded', `${orderedStoryboardShots.length} shots in order`, 'success', 2000);
    } else {
      showToast('No shots found', 'Add or save shot_list.json in Step 3', 'info', 4000);
    }
  } catch (err) {
    showEmptyState();
    showToast('Load failed', 'Could not load shot list/reference context', 'error', 4000);
  } finally {
    hideLoading(loadingOverlay);
  }
}

async function loadReviewMetadata() {
  try {
    const service = getReviewService();
    const result = await service.loadReviewMetadata(currentProject ? currentProject.id : '');
    if (!result.ok || !result.data || !result.data.success || !result.data.reviewMetadata || !sequenceData?.selections) return;

    sequenceData.selections.forEach((shot) => {
      const metadata = result.data.reviewMetadata[shot.shotId];
      if (!metadata) return;
      shot.reviewStatus = metadata.reviewStatus;
      shot.comments = metadata.comments;
      shot.assignee = metadata.assignee || shot.assignee || '';
      normalizeShotReviewData(shot);
    });
  } catch (err) {
    console.warn('Review metadata load failed:', err.message);
  }
}

function getFilteredShots() {
  if (!sequenceData?.selections) return [];
  if (activeReviewFilters.size === 0) {
    return sequenceData.selections;
  }
  return sequenceData.selections.filter(shot => activeReviewFilters.has(shot.reviewStatus));
}

function renderReviewFilterChips() {
  if (!reviewFilterChips || !sequenceData?.selections) return;
  reviewFilterChips.innerHTML = '';

  REVIEW_STATUSES.forEach((status) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    if (activeReviewFilters.has(status)) {
      chip.classList.add('active');
    }
    const count = sequenceData.selections.filter(shot => shot.reviewStatus === status).length;
    chip.textContent = `${REVIEW_STATUS_LABELS[status]} (${count})`;
    chip.addEventListener('click', () => {
      if (activeReviewFilters.has(status)) {
        activeReviewFilters.delete(status);
      } else {
        activeReviewFilters.add(status);
      }
      renderReviewFilterChips();
      renderView();
    });
    reviewFilterChips.appendChild(chip);
  });
}

/**
 * Update header stats
 */
function updateStats() {
  const totalShots = Array.isArray(orderedStoryboardShots) ? orderedStoryboardShots.length : 0;
  const readyShots = Array.isArray(orderedStoryboardShots)
    ? orderedStoryboardShots.filter((shot) => shotIsReadyForReview(shot)).length
    : 0;

  if (statShots) statShots.textContent = String(totalShots);
  if (statReady) statReady.textContent = String(readyShots);
  if (statPassed) statPassed.textContent = String(promptLintSummary.passed || 0);
  if (statFailed) statFailed.textContent = String(promptLintSummary.failed || 0);
}


function shotHasPreviewSource(shot) {
  // Check seedream variations
  const seedream = shot?.renderFiles?.seedream;
  if (seedream) {
    for (const v of ['A', 'B', 'C', 'D']) {
      if (seedream[v]?.first || seedream[v]?.last) return true;
    }
  }
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

function shotIsReadyForReview(shot) {
  return shotHasPreviewSource(shot) && shotHasSelectedVariation(shot);
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
    if (readinessBar) readinessBar.style.display = 'none';
    return;
  }

  const data = computeReadinessData();
  currentReadinessData = data;
  if (readinessBar) readinessBar.style.display = 'flex';
  if (readinessSummary) {
    const missingRenders = data.categories.missingPreview.length;
    const missingSelection = data.categories.missingSelection.length;
    readinessSummary.textContent = `${data.ready}/${data.total} shots ready | ${missingRenders} missing renders | ${missingSelection} not selected`;
  }
  const panelExpanded = readinessPanel.style.display === 'block';
  if (readinessBarToggle) {
    readinessBarToggle.textContent = panelExpanded ? 'Hide Details' : 'Show Details';
  }

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
    const result = await getStoryboardPageService().saveReadinessReport({
      projectId: currentProject.id,
      payload: report
    });

    if (!result.ok) {
      throw new Error(result.error || 'Failed to save readiness report');
    }

    showToast('Readiness report saved', result.data.path || `projects/${currentProject.id}/lint/readiness_report.json`, 'success', 3000);
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

function getOrderedShots() {
  if (!Array.isArray(sequenceData?.selections)) return [];
  return sequenceData.selections;
}

function updateReorderModeButtonLabel() {
  const btn = document.getElementById('timelineReorderBtn');
  if (!btn) return;
  btn.textContent = reorderModeEnabled ? 'Done Reordering' : 'Reorder';
}

function updateTimelineControlsVisibility() {
  if (!timelineFilmstrip) return;
  timelineFilmstrip.style.display = currentView === 'timeline' ? 'flex' : 'none';
}

async function saveEditorialOrder(orderedShotIds) {
  if (!Array.isArray(orderedShotIds) || !Array.isArray(sequenceData?.selections)) return;

  const byId = new Map(sequenceData.selections.map(shot => [shot.shotId, shot]));
  const reordered = [];

  orderedShotIds.forEach((shotId) => {
    const shot = byId.get(shotId);
    if (shot) reordered.push(shot);
  });

  sequenceData.selections.forEach((shot) => {
    if (!orderedShotIds.includes(shot.shotId)) reordered.push(shot);
  });

  sequenceData.selections = reordered;
  orderedStoryboardShots = sequenceData.selections;
  sequenceData.editorialOrder = reordered.map(shot => shot.shotId);
  await saveStoryboardSequence();
  renderView();
  showToast('Order saved', `${reordered.length} shots reordered`, 'success', 2000);
}

async function saveReviewUpdate(shotId, updates = {}) {
  if (!shotId || !sequenceData?.selections) {
    throw new Error('Shot sequence is not loaded');
  }

  const shot = sequenceData.selections.find(s => s.shotId === shotId);
  if (!shot) {
    throw new Error(`Shot '${shotId}' not found`);
  }

  const comments = Array.isArray(shot.comments) ? [...shot.comments] : [];
  if (typeof updates.appendComment === 'string' && updates.appendComment.trim()) {
    comments.push({
      author: (updates.author || 'Reviewer').trim() || 'Reviewer',
      text: updates.appendComment.trim(),
      timestamp: new Date().toISOString()
    });
  } else if (Array.isArray(updates.comments)) {
    comments.splice(0, comments.length, ...updates.comments);
  }

  const payload = {
    shotId,
    reviewStatus: updates.reviewStatus !== undefined ? updates.reviewStatus : shot.reviewStatus,
    comments,
    assignee: updates.assignee !== undefined ? String(updates.assignee || '').trim() : shot.assignee
  };

  const service = getReviewService();
  const result = await service.saveReviewMetadata({
    projectId: currentProject ? currentProject.id : '',
    payload
  });
  if (!result.ok) {
    throw new Error(result.error || 'Failed to save review metadata');
  }

  const metadata = result.data.reviewMetadata || {};
  shot.reviewStatus = metadata.reviewStatus || payload.reviewStatus || shot.reviewStatus;
  shot.comments = Array.isArray(metadata.comments) ? metadata.comments : comments;
  shot.assignee = typeof metadata.assignee === 'string'
    ? metadata.assignee
    : (payload.assignee || '');
  normalizeShotReviewData(shot);

  return shot;
}

function setDirtyState(dirty) {
  const indicator = document.getElementById('dirtyStateIndicator');
  if (!indicator) return;
  indicator.style.display = dirty ? 'inline-flex' : 'none';
}

function queueStoryboardSave() {
  if (saveStoryboardTimer) {
    clearTimeout(saveStoryboardTimer);
  }
  setDirtyState(true);
  saveStoryboardTimer = setTimeout(async () => {
    await saveStoryboardSequence();
    setDirtyState(false);
  }, 150);
}

async function saveStoryboardSequence() {
  if (!sequenceData || !Array.isArray(sequenceData.selections)) return;

  const payload = {
    selections: sequenceData.selections.map(shot => ({
      shotId: shot.shotId,
      selectedVariation: shot.selectedVariation || 'none',
      locked: !!shot.locked,
      sourceType: shot.sourceType || inferShotSource(shot),
      assignee: shot.assignee || ''
    })),
    editorialOrder: Array.isArray(sequenceData.editorialOrder) ? sequenceData.editorialOrder : []
  };

  try {
    const service = getReviewService();
    const result = await service.saveStoryboardSequence({
      projectId: currentProject ? currentProject.id : '',
      payload
    });
    if (!result.ok) {
      throw new Error(result.error || 'Failed to save storyboard sequence');
    }
  } catch (err) {
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
    if (filmstripView) filmstripView.style.display = 'none';
    timelineView.style.display = 'none';
    stopFilmstripSlideshow();
    renderGridView();
  } else if (currentView === 'filmstrip') {
    gridView.style.display = 'none';
    if (filmstripView) filmstripView.style.display = 'flex';
    timelineView.style.display = 'none';
    renderFilmstripView();
  } else {
    gridView.style.display = 'none';
    if (filmstripView) filmstripView.style.display = 'none';
    timelineView.style.display = 'block';
    stopFilmstripSlideshow();
    renderTimelineView();
  }
}

/**
 * Render grid view
 */
function renderBulkBar() {
  let bar = document.getElementById('bulkSelectBar');
  if (bulkSelectedIds.size === 0) {
    if (bar) bar.style.display = 'none';
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bulkSelectBar';
    bar.className = 'bulk-select-bar';
    shotGrid.parentElement.insertBefore(bar, shotGrid);
  }
  bar.style.display = 'flex';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-live', 'polite');
  bar.innerHTML = '<span class="bulk-count">' + bulkSelectedIds.size + '</span> selected' +
    '<button class="btn btn-sm btn-secondary" id="bulkSelectAll">Select All</button>' +
    '<button class="btn btn-sm btn-secondary" id="bulkDeselectAll">Deselect All</button>' +
    '<select class="bulk-status-select" id="bulkStatusSelect">' +
      '<option value="">Set Status...</option>' +
      REVIEW_STATUSES.map(function(s) { return '<option value="' + s + '">' + REVIEW_STATUS_LABELS[s] + '</option>'; }).join('') +
    '</select>' +
    '<button class="btn btn-sm btn-primary" id="bulkPinSelected">Pin Selected</button>' +
    '<button class="btn btn-sm btn-secondary" id="bulkUnpinSelected">Unpin Selected</button>';
  document.getElementById('bulkSelectAll').addEventListener('click', function() {
    var shots = getFilteredShotsForCurrentReadinessFilter(getFilteredShots());
    shots.forEach(function(s) { bulkSelectedIds.add(s.shotId); });
    renderGridView();
  });
  document.getElementById('bulkDeselectAll').addEventListener('click', function() {
    bulkSelectedIds.clear();
    renderGridView();
  });
  document.getElementById('bulkStatusSelect').addEventListener('change', async function(e) {
    var newStatus = e.target.value;
    if (!newStatus || !sequenceData?.selections) return;
    var ids = Array.from(bulkSelectedIds);
    var count = 0;
    for (var i = 0; i < ids.length; i++) {
      try {
        await saveReviewUpdate(ids[i], { reviewStatus: newStatus });
        count++;
      } catch (err) { /* continue with remaining */ }
    }
    showToast('Batch update', count + ' shots set to ' + formatReviewStatus(newStatus), 'success', 3000);
    bulkSelectedIds.clear();
    renderReviewFilterChips();
    renderView();
  });
  document.getElementById('bulkPinSelected').addEventListener('click', function() {
    if (!sequenceData || !sequenceData.selections) return;
    sequenceData.selections.forEach(function(s) {
      if (bulkSelectedIds.has(s.shotId)) s.locked = true;
    });
    bulkSelectedIds.clear();
    renderView();
    queueStoryboardSave();
  });
  document.getElementById('bulkUnpinSelected').addEventListener('click', function() {
    if (!sequenceData || !sequenceData.selections) return;
    sequenceData.selections.forEach(function(s) {
      if (bulkSelectedIds.has(s.shotId)) s.locked = false;
    });
    bulkSelectedIds.clear();
    renderView();
    queueStoryboardSave();
  });
}

function renderGridView() {
  shotGrid.innerHTML = '';
  const shots = getFilteredShotsForCurrentReadinessFilter(getFilteredShots());

  shots.forEach(shot => {
    const card = createShotCard(shot);
    shotGrid.appendChild(card);
  });

  if (shots.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'readiness-filter-empty';
    empty.textContent = 'No shots match this readiness filter.';
    shotGrid.appendChild(empty);
  }

  renderBulkBar();
}

/**
 * Create shot card element
 */
function createShotCard(shot) {
  const card = document.createElement('div');
  card.className = 'shot-card';
  if (shot.reviewStatus) card.classList.add(`status-${shot.reviewStatus}`);
  if (bulkSelectedIds.has(shot.shotId)) card.classList.add('bulk-selected');
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Shot ${shot.shotId}, ${formatReviewStatus(shot.reviewStatus)}`);
  card.addEventListener('click', () => openShotModal(shot));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openShotModal(shot); }
  });

  // Bulk checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'bulk-checkbox';
  checkbox.checked = bulkSelectedIds.has(shot.shotId);
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    if (checkbox.checked) bulkSelectedIds.add(shot.shotId);
    else bulkSelectedIds.delete(shot.shotId);
    card.classList.toggle('bulk-selected', checkbox.checked);
    renderBulkBar();
  });
  card.appendChild(checkbox);

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

  card.appendChild(thumbnail);

  // Info
  const info = document.createElement('div');
  info.className = 'shot-info';

  const header = document.createElement('div');
  header.className = 'shot-card-header';

  const shotId = document.createElement('div');
  shotId.className = 'shot-id';
  shotId.textContent = shot.shotId;
  shotId.setAttribute('data-editable', '');
  shotId.title = 'Double-click to edit';
  shotId.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const original = shot.shotId;
    const input = document.createElement('input');
    input.className = 'inline-edit-input';
    input.type = 'text';
    input.value = original;
    shotId.textContent = '';
    shotId.appendChild(input);
    input.focus();
    input.select();
    function commit() {
      const val = input.value.trim();
      if (val && val !== original) {
        shot.shotId = val;
        queueStoryboardSave();
      }
      shotId.textContent = shot.shotId;
    }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') { ke.preventDefault(); input.blur(); }
      if (ke.key === 'Escape') { input.value = original; input.blur(); }
    });
  });
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

  const metaItems = [];
  const previewMetaAsset = resolveShotPreviewAsset(shot);
  if (previewMetaAsset?.source) {
    metaItems.push({ label: 'Preview', value: previewMetaAsset.source });
  }

  if (shot.timing) {
    metaItems.push({ label: 'Duration', value: `${shot.timing.duration || 8}s` });

    if (shot.timing.musicSection) {
      metaItems.push({ label: 'Section', value: shot.timing.musicSection });
    }
  }

  if (window.UILayer?.renderMetaItems) {
    window.UILayer.renderMetaItems(meta, metaItems, 'shot-meta-item');
  } else {
    metaItems.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'shot-meta-item';
      row.textContent = `${item.label}: ${item.value}`;
      meta.appendChild(row);
    });
  }

  info.appendChild(meta);

  const reviewControls = document.createElement('div');
  reviewControls.className = 'shot-review-controls';

  const statusSelect = document.createElement('select');
  statusSelect.className = `shot-status-select status-${shot.reviewStatus}`;
  REVIEW_STATUSES.forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = REVIEW_STATUS_LABELS[status];
    option.selected = shot.reviewStatus === status;
    statusSelect.appendChild(option);
  });
  statusSelect.addEventListener('click', (e) => e.stopPropagation());
  statusSelect.addEventListener('change', async (e) => {
    e.stopPropagation();
    await updateShotReviewMetadata(shot.shotId, { reviewStatus: e.target.value });
    statusSelect.className = `shot-status-select status-${shot.reviewStatus}`;
  });
  reviewControls.appendChild(statusSelect);

  const commentsBtn = document.createElement('button');
  commentsBtn.type = 'button';
  commentsBtn.className = 'shot-comments-btn';
  commentsBtn.textContent = `Comments (${shot.comments.length})`;
  commentsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCommentsModal(shot);
  });
  reviewControls.appendChild(commentsBtn);

  info.appendChild(reviewControls);
  card.appendChild(info);

  return card;
}


function formatTimeLabel(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

async function loadShotListTiming() {
  try {
    const result = await getStoryboardPageService().loadCanonScript(currentProject && currentProject.id);
    if (!result.ok) return null;
    const payload = result.data;
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
    console.warn('Shot timing load failed:', err.message);
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
  if (!timelineTrack) return;
  timelineTrack.innerHTML = '';
  renderTimelineFilmstrip();

  const timingByShotId = await loadShotListTiming();
  const allRanges = deriveShotRanges(timingByShotId);
  const filteredIds = new Set(
    getFilteredShotsForCurrentReadinessFilter(getFilteredShots()).map(shot => shot.shotId)
  );
  const shotRanges = allRanges.filter(range => filteredIds.has(range.shot.shotId));

  if (shotRanges.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'readiness-filter-empty';
    empty.textContent = 'No shots match this readiness filter.';
    timelineTrack.appendChild(empty);
    return;
  }

  const sections = {};
  shotRanges.forEach(range => {
    const sectionName = range.musicSection || 'Unknown';
    if (!sections[sectionName]) {
      sections[sectionName] = [];
    }
    sections[sectionName].push(range);
  });

  Object.keys(sections).forEach(sectionName => {
    const sectionEl = createTimelineSection(sectionName, sections[sectionName]);
    timelineTrack.appendChild(sectionEl);
  });

  syncAudioSource();
  const totalDuration = Number(sequenceData?.totalDuration) || shotRanges[shotRanges.length - 1].end || 0;
  const durationEl = document.getElementById('timelineDuration');
  if (durationEl) durationEl.textContent = formatTimeLabel(totalDuration);
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
    applyPreviewNode(thumb, shot);

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
const SECTION_COLORS = {
  'Intro': '#FF6B6B', 'intro': '#FF6B6B',
  'Verse': '#4ECDC4', 'verse': '#4ECDC4', 'Verse 1': '#4ECDC4', 'Verse 2': '#5BD8D0',
  'Pre-Chorus': '#FFD93D', 'pre-chorus': '#FFD93D', 'Pre-chorus': '#FFD93D',
  'Chorus': '#45B7D1', 'chorus': '#45B7D1', 'Chorus 1': '#45B7D1', 'Chorus 2': '#52C4DE',
  'Bridge': '#FFA07A', 'bridge': '#FFA07A',
  'Outro': '#98D8C8', 'outro': '#98D8C8',
  'Instrumental': '#C19EF5', 'instrumental': '#C19EF5',
  'Unknown': '#666'
};

function getSectionColor(name) {
  return SECTION_COLORS[name] || SECTION_COLORS[name?.toLowerCase()] || '#666';
}

function createTimelineSection(sectionName, ranges) {
  const section = document.createElement('div');
  section.className = 'timeline-section';
  const sectionColor = getSectionColor(sectionName);
  section.style.borderLeft = `4px solid ${sectionColor}`;

  const header = document.createElement('div');
  header.className = 'section-header';

  const colorDot = document.createElement('span');
  colorDot.className = 'section-color-dot';
  colorDot.style.backgroundColor = sectionColor;
  header.appendChild(colorDot);

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

  ranges.forEach((range, index) => {
    const shotEl = createTimelineShot(range, index);
    shotsContainer.appendChild(shotEl);
  });

  section.appendChild(shotsContainer);

  return section;
}

/**
 * Create timeline shot element
 */
function createTimelineShot(range, index = null) {
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

  if (!reorderModeEnabled) {
    shotEl.addEventListener('click', () => openShotModal(shot));
  }

  applyPreviewNode(shotEl, shot);

  const label = document.createElement('div');
  label.className = 'timeline-shot-label';
  label.textContent = shot.shotId;
  shotEl.appendChild(label);

  if (reorderModeEnabled) {
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
  const loadingToast = showToast('Uploading...', `${shotId} - Option ${variation}`, 'info', 0);

  try {
    const uploadService = getStoryboardUploadService();
    const result = await uploadService.uploadKlingVariation({
      file,
      shotId,
      variation,
      projectId: currentProject ? currentProject.id : ''
    });

    if (!result.ok) {
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
    ['Review Status', REVIEW_STATUS_LABELS[selectedShot.reviewStatus] || 'Draft'],
    ['Comments', String(selectedShot.comments.length)]
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
  const assigneeLabel = document.createElement('label');
  assigneeLabel.setAttribute('for', 'shotAssigneeInput');
  const assigneeStrong = document.createElement('strong');
  assigneeStrong.textContent = 'Assignee:';
  assigneeLabel.appendChild(assigneeStrong);

  const assigneeInput = document.createElement('input');
  assigneeInput.id = 'shotAssigneeInput';
  assigneeInput.type = 'text';
  assigneeInput.value = selectedShot.assignee || '';
  assigneeInput.placeholder = 'Name or @handle';

  const assigneeSave = document.createElement('button');
  assigneeSave.className = 'btn btn-small btn-secondary';
  assigneeSave.id = 'saveAssigneeBtn';
  assigneeSave.type = 'button';
  assigneeSave.textContent = 'Save Assignee';

  assigneeWrap.appendChild(assigneeLabel);
  assigneeWrap.appendChild(assigneeInput);
  assigneeWrap.appendChild(assigneeSave);
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

async function updateShotReviewMetadata(shotId, updates) {
  try {
    await saveReviewUpdate(shotId, updates);
  } catch (err) {
    showToast('Save failed', err.message, 'error', 4000);
    return false;
  }

  renderReviewFilterChips();
  renderView();
  if (selectedShot?.shotId === shotId) {
    renderShotDetails();
  }
  return true;
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
  const newCommentText = document.getElementById('newCommentText');
  commentsModal.style.display = 'none';
  if (newCommentText) newCommentText.value = '';
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

    const header = document.createElement('div');
    header.className = 'comment-header';

    const author = document.createElement('span');
    author.className = 'comment-author';
    author.textContent = comment.author || 'Reviewer';
    header.appendChild(author);

    const timestamp = document.createElement('span');
    timestamp.className = 'comment-time';
    timestamp.textContent = new Date(comment.timestamp).toLocaleString();
    header.appendChild(timestamp);

    const text = document.createElement('div');
    text.className = 'comment-text';
    text.textContent = comment.text;

    item.appendChild(header);
    item.appendChild(text);
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

// ===== FILMSTRIP VIEW =====

/**
 * Fetch first/last frame render paths for a single shot from the API.
 * Returns { first: string|null, last: string|null } for the selected variation.
 */
async function fetchShotFrames(shotId, variation) {
  const projectId = currentProject ? currentProject.id : '';
  const params = new URLSearchParams({ shot: shotId, project: projectId });
  try {
    const res = await fetch('/api/shot-renders?' + params.toString());
    if (!res.ok) return { first: null, last: null };
    const data = await res.json();
    if (!data.success) return { first: null, last: null };

    const renders = data.renders || {};
    const v = variation || 'A';

    // Check seedream first (primary), then kling
    const seedream = renders.seedream && renders.seedream[v];
    if (seedream) {
      return { first: seedream.first || null, last: seedream.last || null };
    }

    const kling = renders.kling && renders.kling[v];
    if (kling) {
      return { first: kling.first || null, last: kling.last || null };
    }

    return { first: null, last: null };
  } catch {
    return { first: null, last: null };
  }
}

/**
 * Build the ordered frame list for the filmstrip.
 * Each entry: { shotId, variation, frame ('first'|'last'), path, shotIndex }
 * Fetches renders from the API for each shot with a selected variation.
 */
async function collectFilmstripFrames() {
  const shots = getOrderedShots();
  const selected = shots.filter(shot =>
    shot.selectedVariation && shot.selectedVariation !== 'none'
  );

  if (selected.length === 0) return [];

  // Fetch renders for all selected shots in parallel
  const renderResults = await Promise.all(
    selected.map(shot => fetchShotFrames(shot.shotId, shot.selectedVariation))
  );

  const frames = [];
  selected.forEach((shot, i) => {
    const renders = renderResults[i];
    if (renders.first) {
      frames.push({
        shotId: shot.shotId,
        variation: shot.selectedVariation,
        frame: 'first',
        path: renders.first,
        shotIndex: i
      });
    }
    if (renders.last) {
      frames.push({
        shotId: shot.shotId,
        variation: shot.selectedVariation,
        frame: 'last',
        path: renders.last,
        shotIndex: i
      });
    }
    // If neither first nor last exists, try the legacy preview path as a fallback
    if (!renders.first && !renders.last) {
      const preview = getShotPreviewAsset(shot);
      if (preview.path) {
        frames.push({
          shotId: shot.shotId,
          variation: shot.selectedVariation,
          frame: 'preview',
          path: preview.path,
          shotIndex: i
        });
      }
    }
  });

  return frames;
}

/**
 * Render the entire filmstrip view: scroll track + player stage.
 */
async function renderFilmstripView() {
  if (!filmstripScrollTrack || !filmstripPlayerStage) return;

  const loadingOverlay = showLoading(filmstripPlayerStage, 'Loading frames...');

  try {
    const frames = await collectFilmstripFrames();
    // Store as the flat frame list used by the player
    filmstripShots = frames;
    filmstripScrollTrack.innerHTML = '';

    if (frames.length === 0) {
      if (filmstripPlayerEmpty) filmstripPlayerEmpty.style.display = 'flex';
      if (filmstripPlayerImage) filmstripPlayerImage.classList.remove('active');
      if (filmstripPlayerVideo) filmstripPlayerVideo.classList.remove('active');
      if (filmstripPlayerLabel) filmstripPlayerLabel.textContent = '';
      if (filmstripPlayerCounter) filmstripPlayerCounter.textContent = '';
      return;
    }

    if (filmstripPlayerEmpty) filmstripPlayerEmpty.style.display = 'none';

    frames.forEach((entry, index) => {
      const frameEl = document.createElement('div');
      frameEl.className = 'filmstrip-frame';
      if (index === filmstripIndex) frameEl.classList.add('active');
      frameEl.addEventListener('click', () => {
        filmstripIndex = index;
        updateFilmstripPlayer();
        updateFilmstripActiveFrame();
      });

      const indexBadge = document.createElement('div');
      indexBadge.className = 'filmstrip-frame-index';
      indexBadge.textContent = String(index + 1);
      frameEl.appendChild(indexBadge);

      const thumb = document.createElement('div');
      thumb.className = 'filmstrip-frame-thumb';

      if (entry.path && /\.(mp4|mov)$/i.test(entry.path)) {
        const video = document.createElement('video');
        video.src = `/${entry.path}`;
        video.muted = true;
        video.preload = 'metadata';
        thumb.appendChild(video);
      } else if (entry.path) {
        const img = document.createElement('img');
        img.src = `/${entry.path}`;
        img.alt = entry.shotId;
        thumb.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'filmstrip-frame-placeholder';
        placeholder.textContent = entry.shotId;
        thumb.appendChild(placeholder);
      }

      const label = document.createElement('div');
      label.className = 'filmstrip-frame-label';
      const frameLabel = entry.frame === 'first' ? 'First'
        : entry.frame === 'last' ? 'Last'
        : 'Preview';
      label.textContent = `${entry.shotId} ${frameLabel}`;

      frameEl.appendChild(thumb);
      frameEl.appendChild(label);
      filmstripScrollTrack.appendChild(frameEl);
    });

    // Clamp index
    if (filmstripIndex >= frames.length) filmstripIndex = 0;
    updateFilmstripPlayer();
    updateFilmstripActiveFrame();
    syncFilmstripMusicSource();
  } finally {
    hideLoading(loadingOverlay);
  }
}

/**
 * Update the main player stage to show the current filmstrip frame.
 */
function updateFilmstripPlayer() {
  if (!filmstripPlayerImage || !filmstripPlayerVideo || filmstripShots.length === 0) return;

  const entry = filmstripShots[filmstripIndex];
  if (!entry) return;

  const isVideo = entry.path && /\.(mp4|mov)$/i.test(entry.path);

  if (isVideo) {
    filmstripPlayerVideo.src = `/${entry.path}`;
    filmstripPlayerVideo.classList.add('active');
    filmstripPlayerImage.classList.remove('active');
    filmstripPlayerVideo.currentTime = 0;
    filmstripPlayerVideo.play().catch(() => {});
  } else if (entry.path) {
    filmstripPlayerImage.src = `/${entry.path}`;
    filmstripPlayerImage.classList.add('active');
    filmstripPlayerVideo.classList.remove('active');
    filmstripPlayerVideo.pause();
  }

  if (filmstripPlayerLabel) {
    const frameLabel = entry.frame === 'first' ? 'First Frame'
      : entry.frame === 'last' ? 'Last Frame'
      : 'Preview';
    filmstripPlayerLabel.textContent = `${entry.shotId} — ${frameLabel} (${entry.variation})`;
  }

  if (filmstripPlayerCounter) {
    filmstripPlayerCounter.textContent = `${filmstripIndex + 1} / ${filmstripShots.length}`;
  }
}

/**
 * Highlight the active frame in the scroll track and scroll it into view.
 */
function updateFilmstripActiveFrame() {
  if (!filmstripScrollTrack) return;
  const frames = filmstripScrollTrack.querySelectorAll('.filmstrip-frame');
  frames.forEach((frame, i) => {
    frame.classList.toggle('active', i === filmstripIndex);
  });

  const activeFrame = frames[filmstripIndex];
  if (activeFrame) {
    activeFrame.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

/**
 * Advance to the next filmstrip frame (wraps around).
 */
function filmstripNext() {
  if (filmstripShots.length === 0) return;
  filmstripIndex = (filmstripIndex + 1) % filmstripShots.length;
  updateFilmstripPlayer();
  updateFilmstripActiveFrame();
}

/**
 * Go to the previous filmstrip frame (wraps around).
 */
function filmstripPrev() {
  if (filmstripShots.length === 0) return;
  filmstripIndex = (filmstripIndex - 1 + filmstripShots.length) % filmstripShots.length;
  updateFilmstripPlayer();
  updateFilmstripActiveFrame();
}

/**
 * Start the auto-play slideshow.
 */
function startFilmstripSlideshow() {
  stopFilmstripSlideshow();
  if (filmstripShots.length <= 1) return;

  const speed = Number(filmstripSpeedSelect?.value) || 4000;

  if (filmstripPlayBtn) {
    filmstripPlayBtn.textContent = 'Pause';
    filmstripPlayBtn.classList.add('playing');
  }

  // Start music playback if available
  if (storyboardAudio && storyboardAudio.src && storyboardAudio.src !== window.location.href && storyboardAudio.paused) {
    storyboardAudio.play().catch(() => {});
  }

  filmstripPlayInterval = setInterval(() => {
    filmstripNext();
  }, speed);
}

/**
 * Stop the auto-play slideshow.
 */
function stopFilmstripSlideshow() {
  if (filmstripPlayInterval) {
    clearInterval(filmstripPlayInterval);
    filmstripPlayInterval = null;
  }
  if (filmstripPlayBtn) {
    filmstripPlayBtn.textContent = 'Play';
    filmstripPlayBtn.classList.remove('playing');
  }
  // Pause music when slideshow stops
  if (storyboardAudio && !storyboardAudio.paused) {
    storyboardAudio.pause();
  }
}

/**
 * Toggle slideshow play/pause.
 */
function toggleFilmstripSlideshow() {
  if (filmstripPlayInterval) {
    stopFilmstripSlideshow();
  } else {
    startFilmstripSlideshow();
  }
}

// ===== FILMSTRIP MUSIC PLAYBACK =====

function formatMusicTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Set up the music bar with the current music file from sequence data.
 */
function syncFilmstripMusicSource() {
  if (!storyboardAudio) return;

  const musicFile = sequenceData?.musicFile;
  if (!musicFile) {
    storyboardAudio.removeAttribute('src');
    storyboardAudio.load();
    if (filmstripMusicBar) filmstripMusicBar.classList.remove('has-music', 'playing');
    if (filmstripMusicName) filmstripMusicName.textContent = 'No music';
    if (filmstripMusicTime) filmstripMusicTime.textContent = '0:00 / 0:00';
    if (filmstripMusicFill) filmstripMusicFill.style.width = '0%';
    return;
  }

  const normalized = musicFile.startsWith('/') ? musicFile : `/${musicFile}`;
  if (storyboardAudio.getAttribute('src') !== normalized) {
    storyboardAudio.src = normalized;
    storyboardAudio.load();
  }

  if (filmstripMusicBar) filmstripMusicBar.classList.add('has-music');
  if (filmstripMusicName) {
    filmstripMusicName.textContent = musicFile.split('/').pop() || 'Music';
  }
}

function updateFilmstripMusicTime() {
  if (!storyboardAudio || !filmstripMusicTime) return;
  const current = storyboardAudio.currentTime || 0;
  const duration = storyboardAudio.duration || 0;
  filmstripMusicTime.textContent = `${formatMusicTime(current)} / ${formatMusicTime(duration)}`;

  if (filmstripMusicFill && duration > 0) {
    filmstripMusicFill.style.width = `${(current / duration) * 100}%`;
  }
}

function toggleFilmstripMusic() {
  if (!storyboardAudio) return;
  if (!storyboardAudio.src || storyboardAudio.src === window.location.href) {
    showToast('No music', 'Upload an MP3 file first using the Upload button above', 'warning', 3000);
    return;
  }

  if (storyboardAudio.paused) {
    storyboardAudio.play().catch(() => {
      showToast('Playback blocked', 'Click the music button again to play', 'warning', 2500);
    });
  } else {
    storyboardAudio.pause();
  }
}

function bindFilmstripMusicEvents() {
  if (!storyboardAudio) return;

  storyboardAudio.addEventListener('play', () => {
    if (filmstripMusicBar) filmstripMusicBar.classList.add('playing');
    if (filmstripMusicToggle) filmstripMusicToggle.textContent = 'Pause';
  });

  storyboardAudio.addEventListener('pause', () => {
    if (filmstripMusicBar) filmstripMusicBar.classList.remove('playing');
    if (filmstripMusicToggle) filmstripMusicToggle.textContent = 'Music';
  });

  storyboardAudio.addEventListener('ended', () => {
    if (filmstripMusicBar) filmstripMusicBar.classList.remove('playing');
    if (filmstripMusicToggle) filmstripMusicToggle.textContent = 'Music';
    if (filmstripMusicFill) filmstripMusicFill.style.width = '0%';
  });

  storyboardAudio.addEventListener('timeupdate', updateFilmstripMusicTime);

  storyboardAudio.addEventListener('loadedmetadata', () => {
    updateFilmstripMusicTime();
  });

  // Click on progress bar to seek
  if (filmstripMusicProgress) {
    filmstripMusicProgress.addEventListener('click', (e) => {
      if (!storyboardAudio.duration) return;
      const rect = filmstripMusicProgress.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      storyboardAudio.currentTime = ratio * storyboardAudio.duration;
    });
  }

  if (filmstripMusicToggle) {
    filmstripMusicToggle.addEventListener('click', toggleFilmstripMusic);
  }
}

/**
 * Initialize filmstrip button event listeners.
 */
function initializeFilmstripControls() {
  const prevBtn = document.getElementById('filmstripPrevBtn');
  const nextBtn = document.getElementById('filmstripNextBtn');
  const playBtn = document.getElementById('filmstripPlayBtn');
  const speedSelect = document.getElementById('filmstripSpeedSelect');

  if (prevBtn) prevBtn.addEventListener('click', () => { stopFilmstripSlideshow(); filmstripPrev(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { stopFilmstripSlideshow(); filmstripNext(); });
  if (playBtn) playBtn.addEventListener('click', toggleFilmstripSlideshow);
  if (speedSelect) {
    speedSelect.addEventListener('change', () => {
      const label = speedSelect.options[speedSelect.selectedIndex]?.text || '';
      showToast('Speed changed', `Playback speed: ${label}`, 'info', 1500);
      if (filmstripPlayInterval) {
        startFilmstripSlideshow(); // restart with new speed
      }
    });
  }

  bindFilmstripMusicEvents();

  // Keyboard navigation when filmstrip view is active
  document.addEventListener('keydown', (e) => {
    if (currentView !== 'filmstrip') return;
    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      stopFilmstripSlideshow();
      filmstripNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stopFilmstripSlideshow();
      filmstripPrev();
    } else if (e.key === ' ') {
      e.preventDefault();
      toggleFilmstripSlideshow();
    } else if (e.key === 'm' || e.key === 'M') {
      toggleFilmstripMusic();
    }
  });
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

function exportSelectionsJson() {
  if (!sequenceData?.selections?.length) {
    showToast('No selections', 'Load a storyboard first', 'warning', 3000);
    return;
  }
  const selections = sequenceData.selections.map(s => ({
    shotId: s.shotId,
    selectedVariation: s.selectedVariation || 'none',
    reviewStatus: s.reviewStatus || 'draft',
    duration: s.timing?.duration || null,
    musicSection: s.timing?.musicSection || null,
    locked: !!s.locked,
    assignee: s.assignee || '',
    commentsCount: Array.isArray(s.comments) ? s.comments.length : 0
  }));
  const data = {
    projectId: currentProject?.id || 'unknown',
    exportedAt: new Date().toISOString(),
    totalShots: selections.length,
    approved: selections.filter(s => s.reviewStatus === 'approved').length,
    editorialOrder: sequenceData.editorialOrder || selections.map(s => s.shotId),
    selections
  };
  downloadJson(`storyboard-selections-${currentProject?.id || 'project'}.json`, data);
  showToast('Exported', `${selections.length} shot selections saved as JSON`, 'success', 3000);
}

async function fetchContextBundle(includePromptTemplates = true) {
  const result = await getStoryboardPageService().exportContextBundle({
    projectId: currentProject && currentProject.id,
    includePromptTemplates
  });

  if (!result.ok) {
    throw new Error(result.error || 'Failed to export context bundle');
  }

  return result.data;
}

async function copyContextForAI() {
  try {
    const bundle = await fetchContextBundle(true);
    const contextText = `${bundle.markdown}\n\n\n---\n\nJSON Bundle:\n\n${JSON.stringify(bundle, null, 2)}`;
    await navigator.clipboard.writeText(contextText);
    showToast('Copied', 'Context bundle copied to clipboard', 'success', 3000);
  } catch (err) {
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
    showToast('Download failed', err.message, 'error', 4000);
  }
}

// Event Listeners

/**
 * Initialize view tabs
 */
let gridFocusIndex = -1;

function initializeGridKeyboardNav() {
  document.addEventListener('keydown', (e) => {
    if (currentView !== 'grid') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (shotModal && shotModal.style.display === 'flex') return;

    const cards = [...document.querySelectorAll('.shot-card')];
    if (cards.length === 0) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      gridFocusIndex = Math.min(gridFocusIndex + 1, cards.length - 1);
      cards[gridFocusIndex]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      gridFocusIndex = Math.max(gridFocusIndex - 1, 0);
      cards[gridFocusIndex]?.focus();
    } else if (e.key === 'r' || e.key === 'R') {
      if (gridFocusIndex >= 0 && gridFocusIndex < cards.length) {
        const shots = getFilteredShotsForCurrentReadinessFilter(getFilteredShots());
        const shot = shots[gridFocusIndex];
        if (shot) updateShotReviewMetadata(shot.shotId, { reviewStatus: 'in_review' });
      }
    } else if (e.key === 'a' && !e.ctrlKey && !e.metaKey) {
      if (gridFocusIndex >= 0 && gridFocusIndex < cards.length) {
        const shots = getFilteredShotsForCurrentReadinessFilter(getFilteredShots());
        const shot = shots[gridFocusIndex];
        if (shot) updateShotReviewMetadata(shot.shotId, { reviewStatus: 'approved' });
      }
    } else if (e.key === 'p' || e.key === 'P') {
      if (gridFocusIndex >= 0 && gridFocusIndex < cards.length) {
        const shots = getFilteredShotsForCurrentReadinessFilter(getFilteredShots());
        const shot = shots[gridFocusIndex];
        if (shot) {
          shot.locked = !shot.locked;
          renderView();
          queueStoryboardSave();
        }
      }
    } else if (e.key === 'c') {
      if (gridFocusIndex >= 0 && gridFocusIndex < cards.length) {
        const shots = getFilteredShotsForCurrentReadinessFilter(getFilteredShots());
        const shot = shots[gridFocusIndex];
        if (shot) openCommentsModal(shot);
      }
    } else if (e.key === '?') {
      showToast('Keyboard shortcuts', 'Arrows: navigate | Enter: open | R: review | A: approve | P: pin | C: comments', 'info', 5000);
    }
  });
}

function initializeViewTabs() {
  const viewTabs = document.querySelectorAll('.view-tab');
  if (!viewTabs || viewTabs.length === 0) return;

  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      currentView = tab.dataset.view;
      gridFocusIndex = -1;
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
  const exportSelectionsBtn = document.getElementById('exportSelectionsBtn');
  const copyContextBtn = document.getElementById('copyContextBtn');
  const downloadContextBtn = document.getElementById('downloadContextBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const previewContextBtn = document.getElementById('previewContextBtn');
  const storyboardFocusBtn = document.getElementById('storyboardFocusBtn');
  const modalClose = document.getElementById('modalClose');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCancel = document.getElementById('modal-cancel');
  const modalSave = document.getElementById('modal-save');
  const closeContextDrawerBtn = document.getElementById('closeContextDrawerBtn');
  const contextDrawerOverlay = document.getElementById('contextDrawerOverlay');
  const copyContextMarkdownBtn = document.getElementById('copyContextMarkdownBtn');
  const downloadContextJsonBtn = document.getElementById('downloadContextJsonBtn');
  const commentsModalClose = document.getElementById('commentsModalClose');
  const commentsModalOverlay = document.getElementById('commentsModalOverlay');
  const addCommentBtn = document.getElementById('addCommentBtn');
  const saveReadinessReportBtn = document.getElementById('saveReadinessReportBtn');
  const clearReadinessFilterBtnLocal = document.getElementById('clearReadinessFilterBtn');

  if (exportBtn) exportBtn.addEventListener('click', exportPDF);
  if (exportSelectionsBtn) exportSelectionsBtn.addEventListener('click', exportSelectionsJson);
  if (copyContextBtn) copyContextBtn.addEventListener('click', copyContextForAI);
  if (downloadContextBtn) downloadContextBtn.addEventListener('click', downloadContextBundle);
  if (refreshBtn) refreshBtn.addEventListener('click', loadSequence);
  if (previewContextBtn) previewContextBtn.addEventListener('click', openContextDrawer);
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
  if (commentsModalClose) commentsModalClose.addEventListener('click', closeCommentsModal);
  if (commentsModalOverlay) commentsModalOverlay.addEventListener('click', closeCommentsModal);
  if (addCommentBtn) addCommentBtn.addEventListener('click', addCommentToCurrentShot);
  if (closeContextDrawerBtn) closeContextDrawerBtn.addEventListener('click', closeContextDrawer);
  if (contextDrawerOverlay) contextDrawerOverlay.addEventListener('click', closeContextDrawer);
  if (saveReadinessReportBtn) saveReadinessReportBtn.addEventListener('click', saveReadinessReport);
  if (clearReadinessFilterBtnLocal) {
    clearReadinessFilterBtnLocal.addEventListener('click', () => {
      currentReadinessFilter = 'all';
      renderView();
    });
  }
  if (readinessBarToggle && readinessPanel) {
    readinessBarToggle.addEventListener('click', () => {
      const expanded = readinessPanel.style.display !== 'none';
      readinessPanel.style.display = expanded ? 'none' : 'block';
      readinessBarToggle.textContent = expanded ? 'Show Details' : 'Hide Details';
    });
  }
  if (manifestToggleBtn && manifestBody) {
    manifestToggleBtn.addEventListener('click', () => {
      const isOpen = manifestBody.style.display !== 'none';
      manifestBody.style.display = isOpen ? 'none' : 'block';
      manifestToggleBtn.textContent = isOpen ? 'Show Manifest' : 'Hide Manifest';
    });
  }
  if (musicStatusAction) {
    musicStatusAction.addEventListener('click', () => {
      const section = document.getElementById('musicUploadSection');
      if (!section) return;
      const expanded = section.style.display !== 'none';
      section.style.display = expanded ? 'none' : 'block';
      musicStatusAction.textContent = expanded ? 'Upload' : 'Hide Upload';
    });
  }
  if (copyContextMarkdownBtn) {
    copyContextMarkdownBtn.addEventListener('click', async () => {
      if (!latestContextBundle) return;
      await copyText(bundleToMarkdown(latestContextBundle));
      showToast('Copied', 'AI context copied as markdown', 'success', 2000);
    });
  }
  if (downloadContextJsonBtn) {
    downloadContextJsonBtn.addEventListener('click', () => {
      if (!latestContextBundle) return;
      downloadJson(`context-bundle-${currentProject?.id || 'project'}.json`, latestContextBundle);
      showToast('Downloaded', 'Context bundle JSON saved', 'success', 2000);
    });
  }

  // Empty state navigation buttons
  const goToStep3Btn = document.getElementById('goToStep3Btn');
  const goToStep5Btn = document.getElementById('goToStep5Btn');
  if (goToStep3Btn) {
    goToStep3Btn.addEventListener('click', () => {
      const projectId = currentProject?.id || '';
      window.location.href = projectId ? `step3.html?project=${encodeURIComponent(projectId)}` : 'step3.html';
    });
  }
  if (goToStep5Btn) {
    goToStep5Btn.addEventListener('click', () => {
      const projectId = currentProject?.id || '';
      window.location.href = projectId ? `index.html?project=${encodeURIComponent(projectId)}` : 'index.html';
    });
  }

  if (manifestBody) {
    manifestBody.style.display = 'none';
  }
  if (readinessPanel) {
    readinessPanel.style.display = 'none';
  }
  if (musicStatusAction) {
    const section = document.getElementById('musicUploadSection');
    if (section) section.style.display = 'none';
  }
}

// Project selector event listeners
const projectSelector = document.getElementById('projectSelector');
if (projectSelector) {
  projectSelector.addEventListener('change', (e) => {
    switchProject(e.target.value);
  });
}

if (projectActions && typeof projectActions.bindProjectActions === 'function') {
  projectActions.bindProjectActions({
    showToast,
    dismissToast,
    getCurrentProject: () => currentProject,
    createProject: async ({ name, description }) => {
      await createNewProject(name, description);
    },
    deleteProject: async ({ projectId }) => {
      await deleteActiveProject(projectId);
    },
    confirmDeleteMessage: (project) => {
      const projectId = project && project.id ? project.id : '';
      const projectName = project && project.name ? project.name : projectId;
      return `Delete project "${projectName}"? This cannot be undone.`;
    }
  });
}

function setupPageChatBridge() {
  window.PageChatBridge = {
    pageId: 'storyboard',
    getProjectId() {
      if (currentProject && currentProject.id) return String(currentProject.id);
      return window.SharedUtils ? window.SharedUtils.getProjectId() : 'default';
    },
    collectLiveState() {
      return {
        pageId: 'storyboard',
        url: window.location.pathname + (window.location.search || ''),
        view: currentView,
        selectedShot: selectedShot ? selectedShot.shotId : '',
        selectedVariation: selectedVariation || '',
        shotCount: Array.isArray(sequenceData?.selections) ? sequenceData.selections.length : 0
      };
    },
    async onAppliedChanges() {
      return;
    }
  };
}

// Initialize
(async () => {
  setupPageChatBridge();

  // Initialize DOM elements first
  initializeDOMElements();

  const projectsLoaded = await loadProjects();
  if (projectsLoaded) {
    initializeViewTabs();
    initializeButtons();
    initializeFilmstripControls();
    initializeGridKeyboardNav();
    initializeAssetFilters();
    await loadSequence();
    await loadAssetManifest();
    initMusicUpload();
  } else {
    showEmptyState();
    showToast('No projects found', 'Run npm run migrate to initialize multi-project support', 'info', 0);
  }
})();

