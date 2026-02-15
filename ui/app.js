// Prompt Compiler UI - Application Logic
// Version: 2026-02-07 (Multi-Project Support)

let indexData = null;
let currentShot = null;
let currentVariation = 'A';
let currentTool = null;
let currentPlatform = 'all';
let currentLintFilter = 'all';
let currentProject = null;
let canGenerate = false;
let generateTokenSource = 'none';
const activeGenerations = new Set();
const appDeps = window.AppDeps && window.AppDeps.createAppDeps
  ? window.AppDeps.createAppDeps({ windowRef: window })
  : null;

function requireAppDeps() {
  if (!appDeps) {
    throw new Error('App dependency module is unavailable. Ensure ui/controllers/app-deps.js is loaded before app.js');
  }
  return appDeps;
}

let referenceUploadService = null;
let referenceLibraryService = null;
let contentService = null;
let projectService = null;
let previsMapCache = {};
let pendingGeneratedPreviews = null;
let githubAuthState = { connected: false, username: '', scopes: [], tokenSource: 'none' };
let agentActiveRunId = null;
let agentEventSource = null;
let agentRunCache = null;
let generationJobEventSource = null;
let activeGenerationJobId = null;
let generationMetricsCache = null;
let generationHistoryAutoRefreshTimer = null;
let generationHistoryRefreshInFlight = false;
let generationHistoryJobsById = new Map();
let generationDetailsJobId = null;

function createLegacyReferenceUploadService() {
  return {
    async uploadCharacterReference(input) {
      const file = input && input.file;
      if (!file || !/\.(png|jpg|jpeg)$/i.test(file.name)) {
        return { ok: false, error: 'Only PNG and JPEG images are supported' };
      }

      const formData = new FormData();
      formData.append('project', String(input.projectId || ''));
      formData.append('character', String(input.characterName || ''));
      formData.append('slot', String(input.slotNum || ''));
      formData.append('image', file);

      const response = await fetch('/api/upload/reference-image', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Upload failed' };
      }
      return { ok: true, data: result };
    },
    async uploadLocationReference(input) {
      const file = input && input.file;
      if (!file || !/\.(png|jpg|jpeg)$/i.test(file.name)) {
        return { ok: false, error: 'Only PNG and JPEG images are supported' };
      }

      const formData = new FormData();
      formData.append('project', String(input.projectId || ''));
      formData.append('location', String(input.locationName || ''));
      formData.append('slot', String(input.slotNum || ''));
      formData.append('image', file);

      const response = await fetch('/api/upload/location-reference-image', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Upload failed' };
      }
      return { ok: true, data: result };
    },
    async uploadShotRenderFrame(input) {
      const file = input && input.file;
      if (!file || !/\.(png|jpg|jpeg|webp)$/i.test(file.name)) {
        return { ok: false, error: 'Only PNG, JPEG, and WebP images are supported' };
      }

      const formData = new FormData();
      formData.append('project', String(input.projectId || ''));
      formData.append('shot', String(input.shotId || ''));
      formData.append('variation', String(input.variation || 'A').toUpperCase());
      formData.append('frame', String(input.frame || ''));
      formData.append('tool', String(input.tool || 'seedream').toLowerCase());
      formData.append('image', file);

      const response = await fetch('/api/upload/shot-render', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Upload failed' };
      }
      return { ok: true, data: result };
    }
  };
}

function createLegacyReferenceLibraryService() {
  return {
    async listCharacters(projectId) {
      const response = await fetch(`/api/references/characters?project=${projectId}`);
      const result = await response.json();
      if (!response.ok) {
        return { ok: false, error: result.error || 'Failed to load character references' };
      }
      return { ok: true, data: result };
    },
    async listLocations(projectId) {
      const response = await fetch(`/api/references/locations?project=${projectId}`);
      const result = await response.json();
      if (!response.ok) {
        return { ok: false, error: result.error || 'Failed to load location references' };
      }
      return { ok: true, data: result };
    },
    async addCharacter(projectId, characterName) {
      const response = await fetch(`/api/add-character?project=${projectId}&character=${encodeURIComponent(characterName)}`, {
        method: 'POST'
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Failed to add character' };
      }
      return { ok: true, data: result };
    },
    async deleteCharacter(projectId, characterName) {
      const response = await fetch(`/api/delete/character-reference?project=${projectId}&character=${characterName}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Failed to delete character' };
      }
      return { ok: true, data: result };
    },
    async deleteCharacterImage(projectId, characterName, slotNum) {
      const response = await fetch(`/api/delete/reference-image?project=${projectId}&character=${characterName}&slot=${slotNum}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Failed to delete image' };
      }
      return { ok: true, data: result };
    },
    async addLocation(projectId, locationName) {
      const response = await fetch(`/api/add-location?project=${projectId}&location=${encodeURIComponent(locationName)}`, {
        method: 'POST'
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Failed to add location' };
      }
      return { ok: true, data: result };
    },
    async deleteLocation(projectId, locationName) {
      const response = await fetch(`/api/delete/location-reference?project=${projectId}&location=${encodeURIComponent(locationName)}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Failed to delete location' };
      }
      return { ok: true, data: result };
    },
    async deleteLocationImage(projectId, locationName, slotNum) {
      const response = await fetch(`/api/delete/location-reference-image?project=${projectId}&location=${encodeURIComponent(locationName)}&slot=${slotNum}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Failed to delete image' };
      }
      return { ok: true, data: result };
    }
  };
}

function createLegacyContentService() {
  return {
    async saveContent(input) {
      const response = await fetch('/api/save/' + input.contentType, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: input.projectId,
          content: input.content
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Save failed' };
      }
      return { ok: true, data: result };
    },
    async loadContent(input) {
      const response = await fetch('/api/load/' + input.contentType + '?project=' + encodeURIComponent(input.projectId));
      const result = await response.json();
      if (!response.ok) {
        return { ok: false, error: result.error || 'Load failed' };
      }
      return { ok: true, data: result };
    }
  };
}

function createLegacyProjectService() {
  return {
    async listProjects() {
      const response = await fetch('/api/projects');
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Failed to load projects' };
      }
      return { ok: true, data: result };
    },
    async createProject(input) {
      const formData = new FormData();
      formData.append('name', String((input && input.name) || ''));
      formData.append('description', String((input && input.description) || ''));
      const response = await fetch('/api/projects', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        return { ok: false, error: result.error || 'Failed to create project' };
      }
      return { ok: true, data: result };
    }
  };
}

function getReferenceUploadService() {
  return requireAppDeps().getReferenceUploadService();
}

function getReferenceLibraryService() {
  if (referenceLibraryService) return referenceLibraryService;

  if (window.ReferenceLibraryService && window.ReferenceLibraryService.createReferenceLibraryService) {
    referenceLibraryService = window.ReferenceLibraryService.createReferenceLibraryService();
  } else {
    referenceLibraryService = createLegacyReferenceLibraryService();
  }
  return referenceLibraryService;
}

function getContentService() {
  return requireAppDeps().getContentService();
}

function getProjectService() {
  return requireAppDeps().getProjectService();
}

function getReferenceFeature() {
  return requireAppDeps().getReferenceFeature();
}

function getContentFeature() {
  return requireAppDeps().getContentFeature();
}

function getProjectFeature() {
  return requireAppDeps().getProjectFeature();
}

// Search debounce timer
let searchDebounceTimer = null;

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Copy text to clipboard with fallback
 */
async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

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

// DOM Elements
const shotList = document.getElementById('shotList');
const promptViewer = document.getElementById('promptViewer');
const emptyState = document.getElementById('emptyState');
const promptTitle = document.getElementById('promptTitle');
const promptTool = document.getElementById('promptTool');
const promptLintStatus = document.getElementById('promptLintStatus');
const promptText = document.getElementById('promptText');
const promptFile = document.getElementById('promptFile');
const promptVersion = document.getElementById('promptVersion');
const promptVersionRow = document.getElementById('promptVersionRow');
const variationSelector = document.getElementById('variationSelector');
const copyBtn = document.getElementById('copyBtn');
const copyFeedback = document.getElementById('copyFeedback');
const lintErrorsRow = document.getElementById('lintErrorsRow');
const lintErrorsList = document.getElementById('lintErrorsList');
const breadcrumbs = document.getElementById('breadcrumbs');
const generateShotBtn = document.getElementById('generateShotBtn');
const generateRefImageBtn = document.getElementById('generateRefImageBtn');
const autoUploadRefSetBtn = document.getElementById('autoUploadRefSetBtn');
const generationCancelBtn = document.getElementById('generationCancelBtn');
const refreshGenerationHistoryBtn = document.getElementById('refreshGenerationHistoryBtn');
const agentGeneratePromptBtn = document.getElementById('agentGeneratePromptBtn');
const replicateKeyBtn = document.getElementById('replicateKeyBtn');
const generationJobStatus = document.getElementById('generationJobStatus');
const generationMetrics = document.getElementById('generationMetrics');
const generationHistorySection = document.getElementById('generationHistorySection');
const generationHistoryList = document.getElementById('generationHistoryList');
const shotGenerationLayout = document.getElementById('shotGenerationLayout');
const shotRenders = document.getElementById('shotRenders');
const shotRendersGrid = document.getElementById('shotRendersGrid');
const continuityToggle = document.getElementById('continuityToggle');
const continuityNote = document.getElementById('continuityNote');
const refSetNote = document.getElementById('refSetNote');
const agentRunPanel = document.getElementById('agentRunPanel');
const githubAuthPill = document.getElementById('githubAuthPill');
const githubConnectBtn = document.getElementById('githubConnectBtn');
const githubLogoutBtn = document.getElementById('githubLogoutBtn');
const agentCancelRunBtn = document.getElementById('agentCancelRunBtn');
const agentRevertRunBtn = document.getElementById('agentRevertRunBtn');
const agentRunStatus = document.getElementById('agentRunStatus');
const agentRunFiles = document.getElementById('agentRunFiles');
const agentRunLog = document.getElementById('agentRunLog');
const previewContextBtn = document.getElementById('previewContextBtn');
const contextDrawer = document.getElementById('contextDrawer');
const contextDrawerOverlay = document.getElementById('contextDrawerOverlay');
const closeContextDrawerBtn = document.getElementById('closeContextDrawerBtn');
const contextDrawerContent = document.getElementById('contextDrawerContent');
const copyContextMarkdownBtn = document.getElementById('copyContextMarkdownBtn');
const downloadContextJsonBtn = document.getElementById('downloadContextJsonBtn');
const replicateKeyModal = document.getElementById('replicateKeyModal');
const replicateKeyModalOverlay = document.getElementById('replicateKeyModalOverlay');
const replicateKeyModalClose = document.getElementById('replicateKeyModalClose');
const replicateKeyInput = document.getElementById('replicateKeyInput');
const replicateKeyStatus = document.getElementById('replicateKeyStatus');
const saveReplicateKeyBtn = document.getElementById('saveReplicateKeyBtn');
const clearReplicateKeyBtn = document.getElementById('clearReplicateKeyBtn');
const generationChoiceModal = document.getElementById('generationChoiceModal');
const generationChoiceModalOverlay = document.getElementById('generationChoiceModalOverlay');
const generationChoiceModalClose = document.getElementById('generationChoiceModalClose');
const generationChoiceMeta = document.getElementById('generationChoiceMeta');
const generationChoiceGrid = document.getElementById('generationChoiceGrid');
const discardGeneratedBtn = document.getElementById('discardGeneratedBtn');
const closeGenerationChoiceBtn = document.getElementById('closeGenerationChoiceBtn');
const generationJobDetailsModal = document.getElementById('generationJobDetailsModal');
const generationJobDetailsModalOverlay = document.getElementById('generationJobDetailsModalOverlay');
const generationJobDetailsModalClose = document.getElementById('generationJobDetailsModalClose');
const generationJobDetailsCancelBtn = document.getElementById('generationJobDetailsCancelBtn');
const generationJobDetailsMeta = document.getElementById('generationJobDetailsMeta');
const generationJobInputJson = document.getElementById('generationJobInputJson');
const generationJobResultJson = document.getElementById('generationJobResultJson');
const generationJobFailureJson = document.getElementById('generationJobFailureJson');
const generationJobEventsJson = document.getElementById('generationJobEventsJson');
const generationRetryVariation = document.getElementById('generationRetryVariation');
const generationRetryMaxImages = document.getElementById('generationRetryMaxImages');
const generationRetryAspectRatio = document.getElementById('generationRetryAspectRatio');
const generationRetryRequireReference = document.getElementById('generationRetryRequireReference');
const generationRetryPreviewOnly = document.getElementById('generationRetryPreviewOnly');
const generationJobRetryDefaultBtn = document.getElementById('generationJobRetryDefaultBtn');
const generationJobRetryOverrideBtn = document.getElementById('generationJobRetryOverrideBtn');

// Stats
const statShots = document.getElementById('stat-shots');
const statPrompts = document.getElementById('stat-prompts');
const statPassed = document.getElementById('stat-passed');
const statFailed = document.getElementById('stat-failed');

// Navigation
const navItems = document.querySelectorAll('.nav-item');
const searchInput = document.getElementById('search');
const lintFilter = document.getElementById('lintFilter');
const focusModeBtn = document.getElementById('focusModeBtn');
const commandPaletteBtn = document.getElementById('commandPaletteBtn');
const commandPalette = document.getElementById('commandPalette');
const commandPaletteOverlay = document.getElementById('commandPaletteOverlay');
const mobileNavToggle = document.getElementById('mobileNavToggle');
const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
const mobilePanelOverlay = document.getElementById('mobilePanelOverlay');
const promptsNavBtn = document.getElementById('promptsNavBtn');
const workspaceNavButtons = document.querySelectorAll('.nav-item[data-workspace-url]');
const promptsWorkspace = document.getElementById('promptsWorkspace');
const workspaceShell = document.getElementById('workspaceShell');
const workspaceShellFrame = document.getElementById('workspaceShellFrame');
const workspaceShellTitle = document.getElementById('workspaceShellTitle');
const workspaceShellCloseBtn = document.getElementById('workspaceShellCloseBtn');
const workspaceShellLoading = document.getElementById('workspaceShellLoading');
const workspaceShellError = document.getElementById('workspaceShellError');
const workspaceShellErrorText = document.getElementById('workspaceShellErrorText');
const workspaceShellRetryBtn = document.getElementById('workspaceShellRetryBtn');
const workspaceShellOpenNewBtn = document.getElementById('workspaceShellOpenNewBtn');
const pageToolbarHeading = document.getElementById('pageToolbarHeading');
const pageToolbarSubtitle = document.getElementById('pageToolbarSubtitle');

// Sidebar toggle
const shotsSidebar = document.getElementById('shotsSidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const mainLayout = document.querySelector('.main-layout');
const emptyRunIndexBtn = document.getElementById('emptyRunIndex');
const emptyOpenGuideBtn = document.getElementById('emptyOpenGuide');
let lastWorkspaceUrl = '';
let workspaceLoadTimeoutId = null;
const WORKSPACE_LOAD_TIMEOUT_MS = 10000;
const WORKSPACE_VIEW_MAP = {
  prompts: { url: '', title: 'Step 5: Shots' },
  step1: { url: 'step1.html', title: 'Step 1: Theme' },
  step2: { url: 'step2.html', title: 'Step 2: Music' },
  step3: { url: 'step3.html', title: 'Step 3: Canon' },
  step4: { url: 'step4.html', title: 'Step 4: References' },
  storyboard: { url: 'storyboard.html', title: 'Step 6: Storyboard Preview' },
  guide: { url: 'guide.html', title: 'User Guide' }
};
const isEmbeddedWorkspacePage = new URLSearchParams(window.location.search).get('embedded') === '1';
if (isEmbeddedWorkspacePage) {
  document.body.classList.add('embedded-mode');
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

function updateToolbarContext(viewKey) {
  const target = WORKSPACE_VIEW_MAP[viewKey] || WORKSPACE_VIEW_MAP.prompts;
  if (!pageToolbarHeading || !pageToolbarSubtitle) return;

  if (viewKey === 'prompts') {
    pageToolbarHeading.textContent = 'Shot Review';
    pageToolbarSubtitle.textContent = 'Find a shot, verify its text and references, then generate outputs.';
    return;
  }

  pageToolbarHeading.textContent = target.title;
  pageToolbarSubtitle.textContent = 'Single-pane workspace view. Use the left navigation to switch steps.';
}

function showWorkspaceFrameLoading(message = 'Opening workspace...') {
  if (!workspaceShellLoading) return;
  const textEl = workspaceShellLoading.querySelector('.workspace-shell-loading-text');
  if (textEl) textEl.textContent = message;
  workspaceShellLoading.style.display = 'flex';
}

function hideWorkspaceFrameLoading() {
  if (!workspaceShellLoading) return;
  workspaceShellLoading.style.display = 'none';
}

function clearWorkspaceLoadTimeout() {
  if (!workspaceLoadTimeoutId) return;
  clearTimeout(workspaceLoadTimeoutId);
  workspaceLoadTimeoutId = null;
}

function startWorkspaceLoadTimeout(urlForMessage = '') {
  clearWorkspaceLoadTimeout();
  workspaceLoadTimeoutId = setTimeout(() => {
    if (!workspaceShell || workspaceShell.style.display === 'none') return;
    hideWorkspaceFrameLoading();
    const label = urlForMessage || lastWorkspaceUrl || 'workspace page';
    showWorkspaceError(`Timed out while loading "${label}". Retry or open in a new tab.`);
  }, WORKSPACE_LOAD_TIMEOUT_MS);
}

function showWorkspaceError(message = 'This workspace view could not be opened in this panel.') {
  if (!workspaceShellError) return;
  if (workspaceShellErrorText) workspaceShellErrorText.textContent = message;
  workspaceShellError.style.display = 'flex';
}

function hideWorkspaceError() {
  if (!workspaceShellError) return;
  workspaceShellError.style.display = 'none';
}

function setWorkspaceMode(enabled) {
  if (!mainLayout || !shotsSidebar) return;
  mainLayout.classList.toggle('workspace-pane-mode', enabled);
  if (enabled) {
    shotsSidebar.classList.remove('collapsed');
    mainLayout.classList.remove('sidebar-collapsed');
  }
}

// ===== PROJECT MANAGEMENT =====

/**
 * Load projects list and set active project
 */
async function loadProjects() {
  try {
    const feature = getProjectFeature();
    const result = await feature.loadProjects();
    if (!result.ok || !result.projects || result.projects.length === 0) {
      return false;
    }
    currentProject = result.currentProject;

    // Populate dropdown
    const selector = document.getElementById('projectSelector');
    if (selector) {
      selector.innerHTML = '';
      result.projects.forEach(p => {
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
  getProjectFeature().setActiveProjectId(projectId);
  location.reload();
}

/**
 * Create a new project
 */
async function createNewProject(name, description) {
  try {
    const result = await getProjectFeature().createProject({ name, description });
    if (!result.ok || !result.project) {
      throw new Error(result.error || 'Failed to create project');
    }
    location.reload();
  } catch (err) {
    console.error('Failed to create project:', err);
    throw err;
  }
}

/**
 * Load prompts index (project-aware)
 */
async function loadIndex() {
  const loadingOverlay = showLoading(document.body, 'Loading shots...');

  try {
    // Add project context to request
    const projectParam = currentProject ? `?project=${currentProject.id}` : '';
    const response = await fetch(`/prompts_index.json${projectParam}`);
    if (!response.ok) {
      throw new Error('Index file not found');
    }
    indexData = await response.json();
    previsMapCache = {};
    updateStats();
    renderShotList();

    // Select first shot if available
    if (indexData.shots && indexData.shots.length > 0) {
      selectShot(indexData.shots[0]);
      showToast('Loaded', `${indexData.totalShots} shots ready for review`, 'success', 2000);
    }
  } catch (err) {
    console.error('Failed to load index:', err);
    showEmptyState();
    showToast('No shots found', 'Run npm run index to refresh shot files', 'info', 0);
  } finally {
    hideLoading(loadingOverlay);
  }
}

/**
 * Update header stats
 */
function updateStats() {
  if (!indexData) return;

  if (statShots) statShots.textContent = indexData.totalShots || 0;
  if (statPrompts) statPrompts.textContent = indexData.totalPrompts || 0;

  const passed = indexData.allPrompts?.filter(p => p.lintStatus === 'PASS').length || 0;
  const failed = indexData.allPrompts?.filter(p => p.lintStatus === 'FAIL').length || 0;

  if (statPassed) statPassed.textContent = passed;
  if (statFailed) statFailed.textContent = failed;

  // Update navigation counts (may not exist on all pages)
  const countAll = document.getElementById('nav-count-all');
  const countKling = document.getElementById('nav-count-kling');
  const countNano = document.getElementById('nav-count-nanobanana');
  const countSuno = document.getElementById('nav-count-suno');
  const countSeedream = document.getElementById('nav-count-seedream');
  if (countAll) countAll.textContent = indexData.totalPrompts || 0;
  if (countKling) countKling.textContent = indexData.tools?.kling || 0;
  if (countNano) countNano.textContent = indexData.tools?.nanobanana || 0;
  if (countSuno) countSuno.textContent = indexData.tools?.suno || 0;
  if (countSeedream) countSeedream.textContent = indexData.tools?.seedream || 0;

  // Update filter counts in sidebar
  const filterAll = document.getElementById('filter-count-all');
  const filterKling = document.getElementById('filter-count-kling');
  const filterNano = document.getElementById('filter-count-nanobanana');
  const filterSuno = document.getElementById('filter-count-suno');
  const filterSeedream = document.getElementById('filter-count-seedream');
  if (filterAll) filterAll.textContent = indexData.totalPrompts || 0;
  if (filterKling) filterKling.textContent = indexData.tools?.kling || 0;
  if (filterNano) filterNano.textContent = indexData.tools?.nanobanana || 0;
  if (filterSuno) filterSuno.textContent = indexData.tools?.suno || 0;
  if (filterSeedream) filterSeedream.textContent = indexData.tools?.seedream || 0;
}

/**
 * Show empty state
 */
function showEmptyState() {
  if (emptyState) emptyState.style.display = 'block';
  if (promptViewer) promptViewer.style.display = 'none';
  if (breadcrumbs) breadcrumbs.style.display = 'none';
}

/**
 * Hide empty state
 */
function hideEmptyState() {
  if (emptyState) emptyState.style.display = 'none';
  if (promptViewer) promptViewer.style.display = 'block';
  if (breadcrumbs) breadcrumbs.style.display = 'flex';
}

/**
 * Update breadcrumbs
 */
function updateBreadcrumbs() {
  if (!currentShot || !currentTool) {
    breadcrumbs.style.display = 'none';
    return;
  }

  const platformNames = {
    all: 'All Shots',
    kling: 'Kling 3.0',
    nanobanana: 'Nano Banana',
    suno: 'Suno',
    seedream: 'SeedDream 4.5'
  };

  const parts = [
    { label: platformNames[currentPlatform] || 'All Shots', platform: currentPlatform },
    { label: currentShot.shotId, platform: null },
  ];

  // Add variation for tools with variations
  if (currentTool === 'kling' || currentTool === 'seedream') {
    parts.push({ label: `Variation ${currentVariation}`, platform: null });
  }

  breadcrumbs.innerHTML = '';

  parts.forEach((part, index) => {
    const item = document.createElement('div');
    item.className = 'breadcrumb-item';

    if (index > 0) {
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '›';
      breadcrumbs.appendChild(separator);
    }

    if (index === 0 && part.platform) {
      // Make platform clickable
      const link = document.createElement('button');
      link.className = 'breadcrumb-link';
      link.textContent = part.label;
      link.addEventListener('click', () => {
        // Switch platform
        navItems.forEach(nav => {
          if (nav.dataset.platform === part.platform) {
            nav.click();
          }
        });
      });
      item.appendChild(link);
    } else {
      item.textContent = part.label;
    }

    breadcrumbs.appendChild(item);
  });

  breadcrumbs.style.display = 'flex';
}

/**
 * Render shot list in sidebar
 */
function renderShotList() {
  if (!shotList) return;
  if (!indexData || !indexData.shots || indexData.shots.length === 0) {
    shotList.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">No shots match these filters. Adjust platform, lint state, or search.</p>';
    return;
  }

  const searchTerm = searchInput.value.toLowerCase();

  shotList.innerHTML = '';

  indexData.shots.forEach(shot => {
    // Filter by search
    if (searchTerm && !shot.shotId.toLowerCase().includes(searchTerm)) {
      return;
    }

    if (currentLintFilter !== 'all') {
      const shotPrompts = Object.values(shot.variations || {}).flat();
      const hasFail = shotPrompts.some(p => p.lintStatus === 'FAIL');
      const hasPass = shotPrompts.some(p => p.lintStatus === 'PASS');
      if (currentLintFilter === 'fail' && !hasFail) return;
      if (currentLintFilter === 'pass' && !hasPass) return;
    }

    // Filter by platform
    const hasKling = shot.variations.kling && shot.variations.kling.length > 0;
    const hasNano = shot.variations.nanobanana && shot.variations.nanobanana.length > 0;
    const hasSuno = shot.variations.suno && shot.variations.suno.length > 0;
    const hasSeedream = shot.variations.seedream && shot.variations.seedream.length > 0;

    if (currentPlatform !== 'all') {
      const platformMatch =
        (currentPlatform === 'kling' && hasKling) ||
        (currentPlatform === 'nanobanana' && hasNano) ||
        (currentPlatform === 'suno' && hasSuno) ||
        (currentPlatform === 'seedream' && hasSeedream);

      if (!platformMatch) {
        return;
      }
    } else {
      // For 'all', show shots that have at least one variation
      if (!hasKling && !hasNano && !hasSuno && !hasSeedream) {
        return;
      }
    }

    const tags = [];
    if (hasKling) tags.push({ className: 'kling', text: `Kling (${shot.variations.kling.length})` });
    if (hasNano) tags.push({ className: 'nanobanana', text: `Nano (${shot.variations.nanobanana.length})` });
    if (hasSuno) tags.push({ className: 'suno', text: `Suno (${shot.variations.suno.length})` });
    if (hasSeedream) tags.push({ className: 'seedream', text: `SeedDream (${shot.variations.seedream.length})` });

    if (window.UILayer?.createShotSidebarItem) {
      const shotItem = window.UILayer.createShotSidebarItem({
        shotId: shot.shotId,
        active: Boolean(currentShot && currentShot.shotId === shot.shotId),
        tags,
        onClick: () => selectShot(shot)
      });
      shotList.appendChild(shotItem);
    } else {
      const shotItem = document.createElement('div');
      shotItem.className = 'shot-item';
      if (currentShot && currentShot.shotId === shot.shotId) shotItem.classList.add('active');

      const header = document.createElement('div');
      header.className = 'shot-item-header';
      header.textContent = shot.shotId;

      const tools = document.createElement('div');
      tools.className = 'shot-item-tools';
      tags.forEach((tagData) => {
        const tag = document.createElement('span');
        tag.className = `tool-tag ${tagData.className}`;
        tag.textContent = tagData.text;
        tools.appendChild(tag);
      });

      shotItem.appendChild(header);
      shotItem.appendChild(tools);
      shotItem.addEventListener('click', () => selectShot(shot));
      shotList.appendChild(shotItem);
    }
  });
}

/**
 * Select a shot
 */
function selectShot(shot) {
  const previousShotId = currentShot ? currentShot.shotId : '';
  currentShot = shot;
  currentVariation = 'A';

  // Update active state in sidebar
  document.querySelectorAll('.shot-item').forEach(item => {
    item.classList.remove('active');
  });

  // Determine which tool to show based on current platform
  if (currentPlatform !== 'all') {
    currentTool = currentPlatform;
  } else {
    // Priority: SeedDream > Kling > Nano > Suno
    if (shot.variations.seedream && shot.variations.seedream.length > 0) {
      currentTool = 'seedream';
    } else if (shot.variations.kling && shot.variations.kling.length > 0) {
      currentTool = 'kling';
    } else if (shot.variations.nanobanana && shot.variations.nanobanana.length > 0) {
      currentTool = 'nanobanana';
    } else if (shot.variations.suno && shot.variations.suno.length > 0) {
      currentTool = 'suno';
    }
  }

  if (!previousShotId || previousShotId !== currentShot.shotId) {
    resetAgentRunUI({ clearLog: true });
  }
  updateAgentControlsForShot();
  renderPrompt();
}

/**
 * Get current prompt based on shot, tool, and variation
 */
function getCurrentPrompt() {
  if (!currentShot || !currentTool) return null;

  const prompts = currentShot.variations[currentTool];
  if (!prompts || prompts.length === 0) return null;

  // For tools with variations (Kling, SeedDream), find by variation
  if (currentTool === 'kling' || currentTool === 'seedream') {
    const prompt = prompts.find(p => p.variation === currentVariation);
    return prompt || prompts[0];
  }

  // For others, just return first
  return prompts[0];
}

/**
 * Render the selected prompt
 */
async function renderPrompt() {
  const prompt = getCurrentPrompt();
  if (!prompt) {
    resetAgentRunUI({ clearLog: true });
    updateAgentControlsForShot();
    showEmptyState();
    return;
  }

  hideEmptyState();

  // Update title
  promptTitle.textContent = currentShot.shotId;

  // Update tool badge
  promptTool.textContent = currentTool.toUpperCase();
  promptTool.className = `tool-badge ${currentTool}`;

  // Update lint status
  promptLintStatus.textContent = prompt.lintStatus || 'UNKNOWN';
  promptLintStatus.className = `lint-status ${prompt.lintStatus || 'UNKNOWN'}`;

  // Show/hide variation selector
  if (currentTool === 'kling' || currentTool === 'seedream') {
    variationSelector.style.display = 'flex';
    updateVariationButtons();
  } else {
    variationSelector.style.display = 'none';
  }

  // Load and display prompt content with loading state
  promptText.textContent = '';
  const loadingSpinner = document.createElement('div');
  loadingSpinner.className = 'loading-inline';
  loadingSpinner.innerHTML = '<div class="loading-spinner-small"></div> <span>Loading shot text...</span>';
  promptText.appendChild(loadingSpinner);

  try {
    const projectParam = currentProject ? `?project=${currentProject.id}` : '';
    const response = await fetch(`/${prompt.path}${projectParam}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const content = await response.text();

    // Parse and render prompt sections
    renderPromptSections(content, currentTool);
  } catch (err) {
    promptText.textContent = 'Could not load this shot file.';
    console.error('Failed to load prompt:', err);
    showToast('Load error', `Failed to load shot file: ${err.message}`, 'error', 3000);
  }

  // Update file info
  promptFile.textContent = prompt.path;

  // Update version if available
  if (prompt.version) {
    promptVersion.textContent = prompt.version;
    promptVersionRow.style.display = 'block';
  } else {
    promptVersionRow.style.display = 'none';
  }

  // Show lint errors if any
  if (prompt.lintErrors > 0) {
    lintErrorsRow.style.display = 'block';
    // Load lint report to show actual errors
    loadLintErrors(prompt.path);
  } else {
    lintErrorsRow.style.display = 'none';
  }

  // Update breadcrumbs
  updateBreadcrumbs();

  // Show generate button for SeedDream prompts (Kling uses uploaded frames, not AI generation)
  if (generateShotBtn) {
    if (canGenerate && currentTool === 'seedream') {
      generateShotBtn.style.display = 'inline-flex';
    } else {
      generateShotBtn.style.display = 'none';
    }
  }
  if (generateRefImageBtn) {
    if (canGenerate && currentTool === 'seedream') {
      generateRefImageBtn.style.display = 'inline-flex';
    } else {
      generateRefImageBtn.style.display = 'none';
    }
  }
  if (autoUploadRefSetBtn) {
    if (currentTool === 'seedream') {
      autoUploadRefSetBtn.style.display = 'inline-flex';
    } else {
      autoUploadRefSetBtn.style.display = 'none';
    }
  }
  if (agentGeneratePromptBtn) {
    if (currentTool) {
      agentGeneratePromptBtn.style.display = 'inline-flex';
    } else {
      agentGeneratePromptBtn.style.display = 'none';
    }
  }

  updateAgentControlsForShot();

  // Load existing shot renders + upload slots for SeedDream and Kling
  if (currentTool === 'seedream' || currentTool === 'kling') {
    loadShotRenders();
  } else if (shotRenders) {
    shotRenders.style.display = 'none';
    if (shotGenerationLayout) {
      shotGenerationLayout.style.display = currentShot ? 'grid' : 'none';
      shotGenerationLayout.style.gridTemplateColumns = '1fr';
    }
    if (continuityNote) {
      continuityNote.textContent = '';
      continuityNote.classList.remove('warning');
    }
    if (refSetNote) refSetNote.textContent = '';
    if (continuityToggle) continuityToggle.disabled = true;
  }
}

/**
 * Load and display lint errors for a prompt
 */
async function loadLintErrors(promptPath) {
  try {
    const projectParam = currentProject ? `?project=${currentProject.id}` : '';
    const response = await fetch(`/lint/report.json${projectParam}`);
    if (!response.ok) return; // Lint report may not exist yet
    const report = await response.json();

    const promptResult = report.promptValidation?.find(p => p.file === promptPath);
    if (promptResult && promptResult.errors && promptResult.errors.length > 0) {
      lintErrorsList.innerHTML = '';
      promptResult.errors.forEach(err => {
        const li = document.createElement('li');
        li.textContent = `[${err.rule}] ${err.message}`;
        lintErrorsList.appendChild(li);
      });
    }
  } catch (err) {
    console.error('Failed to load lint report:', err);
  }
}

/**
 * Update variation button states
 */
function updateVariationButtons() {
  const buttons = document.querySelectorAll('.variation-btn');
  // Get available variations for current shot+tool
  const available = new Set();
  if (currentShot && currentTool) {
    const prompts = currentShot.variations[currentTool] || [];
    prompts.forEach(p => { if (p.variation) available.add(p.variation); });
  }

  buttons.forEach(btn => {
    const variation = btn.dataset.variation;
    // Hide buttons for variations that don't exist
    if (available.size > 0 && !available.has(variation)) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
    }
    if (variation === currentVariation) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Parse and render prompt sections
 * @param {string} content - Raw prompt content
 * @param {string} tool - Tool name (kling, nanobanana, suno)
 */
function renderPromptSections(content, tool) {
  // Define section patterns for different tools
  const sectionPatterns = {
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

  const patterns = sectionPatterns[tool] || sectionPatterns.kling;
  const sectionsContainer = document.createElement('div');
  sectionsContainer.className = 'prompt-sections';

  let hasValidSections = false;

  patterns.forEach(({ name, icon, pattern }) => {
    const match = content.match(pattern);
    if (match && match[1] && match[1].trim()) {
      hasValidSections = true;
      const section = createPromptSection(name, icon, match[1].trim());
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
 * @param {string} title - Section title
 * @param {string} icon - Section icon
 * @param {string} content - Section content
 */
function createPromptSection(title, icon, content) {
  const section = document.createElement('div');
  section.className = 'prompt-section';

  const header = document.createElement('div');
  header.className = 'prompt-section-header';
  const titleDiv = document.createElement('div');
  titleDiv.className = 'prompt-section-title';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'prompt-section-icon';
  iconSpan.textContent = icon;
  const titleSpan = document.createElement('span');
  titleSpan.textContent = title;
  titleDiv.appendChild(iconSpan);
  titleDiv.appendChild(titleSpan);
  const toggleSpan = document.createElement('span');
  toggleSpan.className = 'prompt-section-toggle';
  toggleSpan.textContent = '\u25bc';
  header.appendChild(titleDiv);
  header.appendChild(toggleSpan);

  const body = document.createElement('div');
  body.className = 'prompt-section-body';

  const contentEl = document.createElement('div');
  contentEl.className = 'prompt-section-content';
  contentEl.textContent = content;

  const actions = document.createElement('div');
  actions.className = 'prompt-section-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-small';
  copyBtn.textContent = 'Copy Section';
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await copyText(content);
      showToast('Copied!', `${title} copied to clipboard`, 'success', 2000);
    } catch (err) {
      showToast('Failed to copy', 'Could not copy section', 'error', 3000);
    }
  });

  actions.appendChild(copyBtn);
  body.appendChild(contentEl);
  body.appendChild(actions);

  section.appendChild(header);
  section.appendChild(body);

  // Toggle collapse
  header.addEventListener('click', () => {
    section.classList.toggle('collapsed');
  });

  return section;
}

/**
 * Copy prompt to clipboard
 */
async function copyToClipboard() {
  // Get all section content
  const sections = document.querySelectorAll('.prompt-section-content');
  let fullText = '';

  if (sections.length > 0) {
    sections.forEach(section => {
      fullText += section.textContent + '\n\n';
    });
  } else {
    fullText = promptText.textContent;
  }

  try {
    await copyText(fullText.trim());
    showToast('Copied!', 'Shot text copied to clipboard', 'success', 2000);
  } catch (err) {
    showToast('Failed to copy', 'Could not copy shot text to clipboard', 'error', 3000);
  }
}

// Event Listeners

// Platform filter buttons in sidebar
const platformFilterBtns = document.querySelectorAll('.platform-filter-btn');
platformFilterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const platform = btn.dataset.platform;
    if (!platform) return;

    currentPlatform = platform;

    // Update active state on filter buttons
    platformFilterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Re-render shot list and select first matching shot
    renderShotList();

    // Auto-select first visible shot
    const firstShot = document.querySelector('.shot-item');
    if (firstShot) firstShot.click();
  });
});

// Variation selector
document.querySelectorAll('.variation-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentVariation = btn.dataset.variation;
    resetAgentRunUI({ clearLog: true });
    updateVariationButtons();
    renderPrompt();
  });
});

// Copy button
if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);

if (continuityToggle) {
  continuityToggle.addEventListener('change', async () => {
    if (!currentProject || !currentShot || currentTool !== 'seedream') return;
    const enabled = Boolean(continuityToggle.checked);
    try {
      await saveShotContinuityToggle(currentShot.shotId, enabled);
      await loadShotRenders();
    } catch (err) {
      continuityToggle.checked = !enabled;
      showToast('Continuity update failed', err.message, 'error', 4000);
    }
  });
}

// Search (debounced)
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(renderShotList, 250);
  });
}

if (emptyRunIndexBtn) {
  emptyRunIndexBtn.addEventListener('click', () => {
    showToast('Action needed', 'Run `npm run index` in the project root terminal.', 'info', 4000);
  });
}
if (emptyOpenGuideBtn) {
  emptyOpenGuideBtn.addEventListener('click', () => {
    openWorkspacePane('guide.html', 'User Guide');
  });
}

if (lintFilter) {
  lintFilter.addEventListener('change', (e) => {
    currentLintFilter = e.target.value;
    renderShotList();
  });
}


function closeMobilePanels() {
  if (!mainLayout) return;
  mainLayout.classList.remove('mobile-nav-open', 'mobile-sidebar-open');
  if (mobilePanelOverlay) mobilePanelOverlay.setAttribute('aria-hidden', 'true');
}

function toggleMobilePanel(panelType) {
  if (!mainLayout) return;
  const navOpen = mainLayout.classList.contains('mobile-nav-open');
  const sidebarOpen = mainLayout.classList.contains('mobile-sidebar-open');

  if (panelType === 'nav') {
    mainLayout.classList.toggle('mobile-nav-open', !navOpen);
    mainLayout.classList.remove('mobile-sidebar-open');
  } else if (panelType === 'sidebar') {
    mainLayout.classList.toggle('mobile-sidebar-open', !sidebarOpen);
    mainLayout.classList.remove('mobile-nav-open');
  }

  const isAnyOpen = mainLayout.classList.contains('mobile-nav-open') || mainLayout.classList.contains('mobile-sidebar-open');
  if (mobilePanelOverlay) mobilePanelOverlay.setAttribute('aria-hidden', isAnyOpen ? 'false' : 'true');
}

// Sidebar toggle
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    shotsSidebar.classList.toggle('collapsed');
    mainLayout.classList.toggle('sidebar-collapsed');

    // Update toggle button title
    if (shotsSidebar.classList.contains('collapsed')) {
      sidebarToggle.title = 'Expand sidebar';
    } else {
      sidebarToggle.title = 'Collapse sidebar';
    }
  });
}


if (mobileNavToggle) {
  mobileNavToggle.addEventListener('click', () => toggleMobilePanel('nav'));
}

if (mobileSidebarToggle) {
  mobileSidebarToggle.addEventListener('click', () => toggleMobilePanel('sidebar'));
}

if (mobilePanelOverlay) {
  mobilePanelOverlay.addEventListener('click', closeMobilePanels);
}

if (focusModeBtn) {
  focusModeBtn.addEventListener('click', () => {
    document.body.classList.toggle('focus-mode');
    focusModeBtn.textContent = document.body.classList.contains('focus-mode') ? 'Exit Focus' : 'Focus Mode';
  });
}

function openCommandPalette() {
  if (!commandPalette) return;
  commandPalette.style.display = 'block';
  commandPalette.setAttribute('aria-hidden', 'false');
}

function closeCommandPalette() {
  if (!commandPalette) return;
  commandPalette.style.display = 'none';
  commandPalette.setAttribute('aria-hidden', 'true');
}

function getViewKeyFromUrl(url) {
  const normalized = (url || '').toLowerCase();
  return Object.keys(WORKSPACE_VIEW_MAP).find((key) => WORKSPACE_VIEW_MAP[key].url === normalized) || 'prompts';
}

function getViewKeyFromPathname(pathname) {
  const file = (pathname || '').split('/').pop().toLowerCase();
  if (!file || file === 'index.html') return 'prompts';
  return Object.keys(WORKSPACE_VIEW_MAP).find((key) => WORKSPACE_VIEW_MAP[key].url === file) || null;
}

function buildEmbeddedWorkspaceUrl(url) {
  try {
    const next = new URL(url, window.location.href);
    next.searchParams.set('embedded', '1');
    return `${next.pathname}${next.search}${next.hash || ''}`;
  } catch {
    return url;
  }
}

function normalizeWorkspacePath(url) {
  if (!url) return '';
  try {
    const next = new URL(url, window.location.href);
    return `${next.pathname}${next.search}`;
  } catch {
    return String(url);
  }
}

function updateViewInUrl(view, replace = false) {
  const next = new URL(window.location.href);
  if (!view || view === 'prompts') {
    next.searchParams.delete('view');
  } else {
    next.searchParams.set('view', view);
  }
  if (replace) {
    window.history.replaceState({ view }, '', next);
  } else {
    window.history.pushState({ view }, '', next);
  }
}

function openWorkspacePane(url, title, options = {}) {
  const { updateHistory = true, replaceHistory = false, forceReload = false } = options;
  if (!workspaceShell || !workspaceShellFrame || !promptsWorkspace) return;
  const targetSrc = buildEmbeddedWorkspaceUrl(url);
  const currentSrc = workspaceShellFrame.getAttribute('src') || '';
  const isSameTarget = normalizeWorkspacePath(currentSrc) === normalizeWorkspacePath(targetSrc);

  setWorkspaceMode(true);
  hideWorkspaceError();
  promptsWorkspace.style.display = 'none';
  workspaceShell.style.display = 'block';
  lastWorkspaceUrl = url;

  if (!isSameTarget || forceReload) {
    showWorkspaceFrameLoading(`Opening ${title || 'workspace'}...`);
    startWorkspaceLoadTimeout(url);
    workspaceShellFrame.src = targetSrc;
  } else {
    hideWorkspaceFrameLoading();
    clearWorkspaceLoadTimeout();
  }

  if (workspaceShellTitle) workspaceShellTitle.textContent = title;
  workspaceNavButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.workspaceUrl === url);
  });
  if (promptsNavBtn) promptsNavBtn.classList.remove('active');
  updateToolbarContext(getViewKeyFromUrl(url));
  if (updateHistory) {
    updateViewInUrl(getViewKeyFromUrl(url), replaceHistory);
  }
}

function closeWorkspacePane(options = {}) {
  const { updateHistory = true, replaceHistory = false } = options;
  if (!workspaceShell || !promptsWorkspace) return;
  setWorkspaceMode(false);
  workspaceShell.style.display = 'none';
  clearWorkspaceLoadTimeout();
  hideWorkspaceFrameLoading();
  hideWorkspaceError();
  if (workspaceShellFrame) workspaceShellFrame.src = 'about:blank';
  promptsWorkspace.style.display = 'block';
  workspaceNavButtons.forEach((btn) => btn.classList.remove('active'));
  if (promptsNavBtn) promptsNavBtn.classList.add('active');
  updateToolbarContext('prompts');
  if (updateHistory) {
    updateViewInUrl('prompts', replaceHistory);
  }
}

function applyViewFromUrl(options = {}) {
  const { updateHistory = false, replaceHistory = true } = options;
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (!view || view === 'prompts') {
    closeWorkspacePane({ updateHistory, replaceHistory });
    return;
  }

  const target = WORKSPACE_VIEW_MAP[view];
  if (!target) {
    closeWorkspacePane({ updateHistory: true, replaceHistory: true });
    return;
  }
  updateToolbarContext(view);
  openWorkspacePane(target.url, target.title, { updateHistory, replaceHistory });
}

if (commandPaletteBtn) {
  commandPaletteBtn.addEventListener('click', openCommandPalette);
}
if (commandPaletteOverlay) {
  commandPaletteOverlay.addEventListener('click', closeCommandPalette);
}
document.querySelectorAll('.command-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.command;
    if (cmd === 'focus' && focusModeBtn) focusModeBtn.click();
    if (cmd === 'prompts') closeWorkspacePane();
    if (cmd === 'guide') openWorkspacePane('guide.html', 'User Guide');
    closeCommandPalette();
  });
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCommandPalette();
  }
  if (e.key === 'Escape') {
    closeCommandPalette();
    closeMobilePanels();
  }
});

// Project selector
const projectSelector = document.getElementById('projectSelector');
if (projectSelector) {
  projectSelector.addEventListener('change', (e) => {
    switchProject(e.target.value);
  });
}

workspaceNavButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    openWorkspacePane(btn.dataset.workspaceUrl, btn.dataset.workspaceTitle || 'Workspace');
    closeMobilePanels();
  });
});
if (promptsNavBtn) {
  promptsNavBtn.addEventListener('click', () => {
    closeWorkspacePane();
    closeMobilePanels();
  });
}
if (workspaceShellCloseBtn) {
  workspaceShellCloseBtn.addEventListener('click', closeWorkspacePane);
}
if (workspaceShellRetryBtn) {
  workspaceShellRetryBtn.addEventListener('click', () => {
    if (!lastWorkspaceUrl) return;
    hideWorkspaceError();
    openWorkspacePane(lastWorkspaceUrl, workspaceShellTitle?.textContent || 'Workspace', {
      updateHistory: false,
      forceReload: true
    });
  });
}
if (workspaceShellOpenNewBtn) {
  workspaceShellOpenNewBtn.addEventListener('click', () => {
    if (!lastWorkspaceUrl) return;
    window.open(lastWorkspaceUrl, '_blank', 'noopener');
  });
}

if (workspaceShellFrame) {
  workspaceShellFrame.addEventListener('error', () => {
    clearWorkspaceLoadTimeout();
    hideWorkspaceFrameLoading();
    showWorkspaceError('The workspace failed to load. Retry or open it in a new tab.');
  });

  workspaceShellFrame.addEventListener('load', () => {
    clearWorkspaceLoadTimeout();
    let innerUrl;
    try {
      innerUrl = new URL(workspaceShellFrame.contentWindow.location.href);
    } catch {
      // Ignore cross-origin iframe navigation (not expected in local app)
      hideWorkspaceFrameLoading();
      showWorkspaceError('The workspace page blocked embedding. Open it in a new tab.');
      return;
    }

    const frameText = (workspaceShellFrame.contentDocument?.body?.innerText || '').slice(0, 300);
    if (/404\s*-\s*file\s*not\s*found/i.test(frameText)) {
      hideWorkspaceFrameLoading();
      showWorkspaceError(`"${innerUrl.pathname}" returned a 404. Check that the file exists in /ui.`);
      return;
    }

    const view = getViewKeyFromPathname(innerUrl.pathname);
    if (!view) {
      hideWorkspaceFrameLoading();
      showWorkspaceError(`Unknown workspace route: ${innerUrl.pathname}`);
      return;
    }
    if (innerUrl.searchParams.get('embedded') !== '1' && view !== 'prompts') {
      const target = WORKSPACE_VIEW_MAP[view];
      if (target) {
        startWorkspaceLoadTimeout(target.url);
        workspaceShellFrame.src = buildEmbeddedWorkspaceUrl(target.url);
        return;
      }
    }

    const params = new URLSearchParams(window.location.search);
    const currentView = params.get('view') || 'prompts';

    if (view === 'prompts') {
      if (workspaceShell.style.display !== 'none') {
        closeWorkspacePane({ updateHistory: true, replaceHistory: false });
      } else if (currentView !== 'prompts') {
        updateViewInUrl('prompts', false);
      }
      hideWorkspaceFrameLoading();
      return;
    }

    const target = WORKSPACE_VIEW_MAP[view];
    if (!target) {
      hideWorkspaceFrameLoading();
      showWorkspaceError(`No workspace mapping found for "${view}".`);
      return;
    }

    if (workspaceShell.style.display === 'none') {
      openWorkspacePane(target.url, target.title, { updateHistory: currentView !== view, replaceHistory: true });
      return;
    }

    if (workspaceShellTitle) workspaceShellTitle.textContent = target.title;
    workspaceNavButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.workspaceUrl === target.url);
    });
    if (promptsNavBtn) promptsNavBtn.classList.remove('active');

    if (currentView !== view) {
      updateViewInUrl(view, false);
    }
    hideWorkspaceFrameLoading();
    hideWorkspaceError();
    updateToolbarContext(view);
  });
}

window.addEventListener('popstate', () => {
  applyViewFromUrl({ updateHistory: false });
});

// New project button
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

  const closeModal = () => {
    newProjectModal.style.display = 'none';
  };

  newProjectModalClose?.addEventListener('click', closeModal);
  newProjectModalOverlay?.addEventListener('click', closeModal);
  cancelNewProjectBtn?.addEventListener('click', closeModal);

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

// ========================================
// Upload Functionality
// ========================================

// Load AI Analysis Prompt
async function loadAnalysisPrompt() {
  try {
    const response = await fetch('/prompts/ai_music_analysis_prompt.txt');
    if (!response.ok) throw new Error('Failed to load prompt');
    return await response.text();
  } catch (err) {
    console.error('Error loading analysis prompt:', err);
    return 'Error loading prompt. Please check the console.';
  }
}

// Check upload status
async function checkUploadStatus() {
  if (!currentProject) return;

  try {
    const response = await fetch(`/api/upload-status?project=${currentProject.id}`);
    if (!response.ok) throw new Error('Failed to check status');

    const status = await response.json();

    // Update status indicators
    updateStatusIndicator('Music', status.music);
    updateStatusIndicator('Analysis', status.analysis);
    updateStatusIndicator('Suno', status.sunoPrompt);
    updateStatusIndicator('SongInfo', status.songInfo);
  } catch (err) {
    console.error('Error checking upload status:', err);
  }
}

function updateStatusIndicator(type, saved) {
  const iconId = `status${type}Icon`;
  const valueId = `status${type}Value`;

  const icon = document.getElementById(iconId);
  const value = document.getElementById(valueId);

  if (!icon || !value) return;

  if (saved) {
    icon.textContent = '✓';
    value.textContent = 'Saved';
    value.style.color = 'var(--success)';
  } else {
    icon.textContent = '○';
    value.textContent = 'Not saved';
    value.style.color = 'var(--text-tertiary)';
  }
}

// Upload file handler
async function uploadFile(file, endpoint, statusElementId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project', currentProject.id);

  const statusEl = document.getElementById(statusElementId);
  if (statusEl) {
    statusEl.textContent = 'Uploading...';
    statusEl.className = 'upload-status';
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();

    if (statusEl) {
      statusEl.textContent = `✓ ${file.name}`;
      statusEl.className = 'upload-status success';
    }

    showToast('Upload successful', `${file.name} uploaded`, 'success', 3000);
    await checkUploadStatus();

    return result;
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `✗ ${err.message}`;
      statusEl.className = 'upload-status error';
    }
    showToast('Upload failed', err.message, 'error', 4000);
    throw err;
  }
}

// Drag and drop handlers
function setupDragAndDrop(zoneId, inputId, endpoint, statusId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);

  if (!zone || !input) return;

  // Click to upload
  zone.addEventListener('click', () => input.click());

  // File input change
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await uploadFile(file, endpoint, statusId);
    }
  });

  // Drag and drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file) {
      await uploadFile(file, endpoint, statusId);
    }
  });
}

// Modal handlers
function setupModals() {
  // AI Analysis Prompt Modal
  const viewAnalysisPromptLink = document.getElementById('viewAnalysisPromptLink');
  const analysisPromptModal = document.getElementById('analysisPromptModal');
  const analysisPromptModalClose = document.getElementById('analysisPromptModalClose');
  const closeAnalysisPromptModal = document.getElementById('closeAnalysisPromptModal');
  const analysisPromptModalOverlay = document.getElementById('analysisPromptModalOverlay');
  const copyAnalysisPromptBtn = document.getElementById('copyAnalysisPromptBtn');

  if (viewAnalysisPromptLink) {
    viewAnalysisPromptLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const promptText = await loadAnalysisPrompt();
      document.getElementById('analysisPromptText').textContent = promptText;
      analysisPromptModal.style.display = 'flex';
    });
  }

  if (analysisPromptModalClose) {
    analysisPromptModalClose.addEventListener('click', () => {
      analysisPromptModal.style.display = 'none';
    });
  }

  if (closeAnalysisPromptModal) {
    closeAnalysisPromptModal.addEventListener('click', () => {
      analysisPromptModal.style.display = 'none';
    });
  }

  if (analysisPromptModalOverlay) {
    analysisPromptModalOverlay.addEventListener('click', () => {
      analysisPromptModal.style.display = 'none';
    });
  }

  if (copyAnalysisPromptBtn) {
    copyAnalysisPromptBtn.addEventListener('click', async () => {
      try {
        const promptText = document.getElementById('analysisPromptText').textContent;
        await copyText(promptText);
        showToast('Copied', 'AI analysis prompt copied to clipboard', 'success', 2000);
      } catch (err) {
        showToast('Failed to copy', 'Could not copy prompt', 'error', 3000);
      }
    });
  }

}

// Save text content
async function saveTextContent(content, contentType, statusElementId, label) {
  if (!currentProject?.id) {
    throw new Error('No active project selected');
  }
  const statusEl = document.getElementById(statusElementId);
  if (statusEl) {
    statusEl.textContent = 'Saving...';
    statusEl.className = 'text-input-status';
  }

  try {
    const result = await getContentFeature().saveContent({
      projectId: currentProject.id,
      contentType,
      content
    });

    if (!result.ok) {
      throw new Error(result.error || 'Save failed');
    }

    if (statusEl) {
      statusEl.textContent = `✓ Saved (${content.length} characters)`;
      statusEl.className = 'text-input-status success';
    }

    showToast('Saved successfully', `${label} saved`, 'success', 2000);
    await checkUploadStatus();

    return result.data;
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `✗ ${err.message}`;
      statusEl.className = 'text-input-status error';
    }
    showToast('Save failed', err.message, 'error', 4000);
    throw err;
  }
}

// Setup text input handlers
function setupTextInputs() {
  const saveSunoPromptBtn = document.getElementById('saveSunoPromptBtn');
  const saveSongInfoBtn = document.getElementById('saveSongInfoBtn');
  const saveAnalysisJsonBtn = document.getElementById('saveAnalysisJsonBtn');

  if (saveSunoPromptBtn) {
    saveSunoPromptBtn.addEventListener('click', async () => {
      const text = document.getElementById('sunoPromptText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter a Suno prompt', 'warning', 3000);
        return;
      }
      await saveTextContent(text, 'suno-prompt', 'sunoPromptTextStatus', 'Suno prompt');
    });
  }

  if (saveSongInfoBtn) {
    saveSongInfoBtn.addEventListener('click', async () => {
      const text = document.getElementById('songInfoText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter song info', 'warning', 3000);
        return;
      }
      await saveTextContent(text, 'song-info', 'songInfoTextStatus', 'Song info');
    });
  }

  if (saveAnalysisJsonBtn) {
    saveAnalysisJsonBtn.addEventListener('click', async () => {
      const text = document.getElementById('analysisJsonText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter analysis JSON', 'warning', 3000);
        return;
      }

      const validation = getContentFeature().validateAnalysisJson(text);

      if (!validation.ok) {
        showToast('Invalid JSON', validation.error, 'error', 4000);
        return;
      }

      await saveTextContent(validation.value, 'analysis', 'analysisJsonTextStatus', 'Analysis JSON');
    });
  }
}

// Load saved text content (Step 2 - Music)
async function loadTextContent() {
  if (!currentProject) return;

  try {
    const feature = getContentFeature();
    // Load Suno prompt
    const sunoResult = await feature.loadContent({ projectId: currentProject.id, contentType: 'suno-prompt' });
    if (sunoResult.ok) {
      const data = sunoResult.data || {};
      if (data.content) {
        const el = document.getElementById('sunoPromptText');
        if (el) {
          el.value = data.content;
          document.getElementById('sunoPromptTextStatus').textContent = `✓ Loaded (${data.content.length} characters)`;
          document.getElementById('sunoPromptTextStatus').className = 'text-input-status success';
        }
      }
    }

    // Load song info
    const songInfoResult = await feature.loadContent({ projectId: currentProject.id, contentType: 'song-info' });
    if (songInfoResult.ok) {
      const data = songInfoResult.data || {};
      if (data.content) {
        const el = document.getElementById('songInfoText');
        if (el) {
          el.value = data.content;
          document.getElementById('songInfoTextStatus').textContent = `✓ Loaded (${data.content.length} characters)`;
          document.getElementById('songInfoTextStatus').className = 'text-input-status success';
        }
      }
    }

    // Load analysis JSON
    const analysisResult = await feature.loadContent({ projectId: currentProject.id, contentType: 'analysis' });
    if (analysisResult.ok) {
      const data = analysisResult.data || {};
      if (data.content) {
        const el = document.getElementById('analysisJsonText');
        if (el) {
          el.value = data.content;
          document.getElementById('analysisJsonTextStatus').textContent = `✓ Loaded (${data.content.length} characters)`;
          document.getElementById('analysisJsonTextStatus').className = 'text-input-status success';
        }
      }
    }
  } catch (err) {
    console.error('Error loading text content:', err);
  }
}

// Load saved Step 1 content (Theme & Concept)
async function loadStep1Content() {
  if (!currentProject) return;
  const feature = getContentFeature();

  const contentTypes = [
    { id: 'conceptText', status: 'conceptTextStatus', endpoint: 'concept' },
    { id: 'inspirationText', status: 'inspirationTextStatus', endpoint: 'inspiration' },
    { id: 'moodText', status: 'moodTextStatus', endpoint: 'mood' },
    { id: 'genreText', status: 'genreTextStatus', endpoint: 'genre' }
  ];

  for (const type of contentTypes) {
    try {
      const result = await feature.loadContent({ projectId: currentProject.id, contentType: type.endpoint });
      if (result.ok) {
        const data = result.data || {};
        if (data.content) {
          const textEl = document.getElementById(type.id);
          const statusEl = document.getElementById(type.status);

          if (textEl) {
            textEl.value = data.content;
            if (statusEl) {
              statusEl.textContent = `✓ Loaded (${data.content.length} characters)`;
              statusEl.className = 'text-input-status success';
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error loading ${type.endpoint}:`, err);
    }
  }
}

// Setup Step 1 save handlers
function setupStep1TextInputs() {
  const saveConceptBtn = document.getElementById('saveConceptBtn');
  const saveInspirationBtn = document.getElementById('saveInspirationBtn');
  const saveMoodBtn = document.getElementById('saveMoodBtn');
  const saveGenreBtn = document.getElementById('saveGenreBtn');

  if (saveConceptBtn) {
    saveConceptBtn.addEventListener('click', async () => {
      const text = document.getElementById('conceptText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter project concept', 'warning', 3000);
        return;
      }
      await saveTextContent(text, 'concept', 'conceptTextStatus', 'Project concept');
    });
  }

  if (saveInspirationBtn) {
    saveInspirationBtn.addEventListener('click', async () => {
      const text = document.getElementById('inspirationText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter visual inspiration', 'warning', 3000);
        return;
      }
      await saveTextContent(text, 'inspiration', 'inspirationTextStatus', 'Visual inspiration');
    });
  }

  if (saveMoodBtn) {
    saveMoodBtn.addEventListener('click', async () => {
      const text = document.getElementById('moodText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter mood & tone', 'warning', 3000);
        return;
      }
      await saveTextContent(text, 'mood', 'moodTextStatus', 'Mood & tone');
    });
  }

  if (saveGenreBtn) {
    saveGenreBtn.addEventListener('click', async () => {
      const text = document.getElementById('genreText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter genre & style', 'warning', 3000);
        return;
      }
      await saveTextContent(text, 'genre', 'genreTextStatus', 'Genre & style');
    });
  }
}

/**
 * Setup collapsible sections with localStorage persistence
 */
function setupCollapsibleSections() {
  const collapsibleCards = document.querySelectorAll('.collapsible-card');

  collapsibleCards.forEach(card => {
    const collapseKey = card.getAttribute('data-collapse-key');
    const header = card.querySelector('.collapsible-header');
    const toggle = card.querySelector('.collapse-toggle');
    const icon = toggle.querySelector('.collapse-icon');

    // Load saved state from localStorage
    const savedState = localStorage.getItem(`collapse_${collapseKey}`);
    if (savedState === 'true') {
      card.classList.add('collapsed');
      icon.textContent = '+';
    } else {
      icon.textContent = '-';
    }

    // Toggle on header click
    header.addEventListener('click', (e) => {
      // Don't toggle if clicking on a link or button inside header
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
      }

      const isCollapsed = card.classList.toggle('collapsed');
      icon.textContent = isCollapsed ? '+' : '-';

      // Save state to localStorage
      localStorage.setItem(`collapse_${collapseKey}`, isCollapsed);
    });

    // Toggle on button click
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      header.click();
    });
  });
}

// Check and display music file
async function checkMusicFile() {
  if (!currentProject) return;

  try {
    const response = await fetch(`/api/upload-status?project=${currentProject.id}`);
    const data = await response.json();

    const musicControls = document.getElementById('musicControls');
    const musicPlayer = document.getElementById('musicPlayer');
    const musicFileInfo = document.getElementById('musicFileInfo');

    if (data.musicFile) {
      // Show controls
      if (musicControls) musicControls.style.display = 'block';

      // Set audio source
      if (musicPlayer) {
        musicPlayer.src = `/projects/${currentProject.id}/music/${data.musicFile}`;
      }

      // Show file info
      if (musicFileInfo) {
        const fileSize = data.musicFileSize ? `${(data.musicFileSize / 1024 / 1024).toFixed(2)} MB` : '';
        musicFileInfo.textContent = `${data.musicFile} ${fileSize}`;
      }
    } else {
      if (musicControls) musicControls.style.display = 'none';
    }
  } catch (err) {
    console.error('Error checking music file:', err);
  }
}

// Canon tab switching
function setupCanonTabs() {
  const tabs = document.querySelectorAll('.canon-tab');
  const tabContents = document.querySelectorAll('.canon-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');

      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active content
      tabContents.forEach(content => {
        if (content.id === `tab-${tabName}`) {
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

  const links = shot.intent.links;
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
    .map((block, idx) => {
      if (typeof block === 'string') {
        return { id: `SEG_${String(idx + 1).padStart(2, '0')}`, text: block };
      }
      const id = typeof block.id === 'string' && block.id.trim() ? block.id.trim() : `SEG_${String(idx + 1).padStart(2, '0')}`;
      const text = typeof block.text === 'string' ? block.text : '';
      const timecode = typeof block.timecode === 'string' ? block.timecode : '';
      return { id, text, timecode };
    })
    .filter(block => block.text || block.id);

  return scriptData;
}

function parseScriptJsonFromEditor() {
  const scriptTextarea = document.getElementById('scriptJson');
  if (!scriptTextarea) return null;
  const raw = scriptTextarea.value.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return normalizeScriptData(parsed);
  } catch (err) {
    return null;
  }
}

function getTranscriptBlocksFromScriptData(scriptData) {
  if (Array.isArray(scriptData.transcriptBlocks) && scriptData.transcriptBlocks.length > 0) {
    return scriptData.transcriptBlocks;
  }

  const fallback = [];
  if (typeof scriptData.youtubeContentScript === 'string' && scriptData.youtubeContentScript.trim()) {
    scriptData.youtubeContentScript
      .split(/\n{2,}/)
      .map(part => part.trim())
      .filter(Boolean)
      .forEach((text, idx) => {
        fallback.push({ id: `SEG_${String(idx + 1).padStart(2, '0')}`, text, timecode: '' });
      });
  }

  return fallback;
}

function jumpToTranscriptSegment(segmentId) {
  const el = document.querySelector(`[data-transcript-segment-id="${segmentId}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('quick-jump-highlight');
  setTimeout(() => el.classList.remove('quick-jump-highlight'), 1200);
}

function renderTranscriptBlocks(scriptData) {
  const transcriptBlocksEl = document.getElementById('transcriptBlocks');
  if (!transcriptBlocksEl) return;

  const transcriptBlocks = getTranscriptBlocksFromScriptData(scriptData);
  transcriptBlocksEl.innerHTML = '';

  if (transcriptBlocks.length === 0) {
    transcriptBlocksEl.innerHTML = '<div class="transcript-empty">No transcript blocks yet.</div>';
    return;
  }

  transcriptBlocks.forEach(block => {
    const card = document.createElement('article');
    card.className = 'transcript-block-card';
    card.dataset.transcriptSegmentId = block.id;

    const header = document.createElement('div');
    header.className = 'transcript-block-header';

    const idEl = document.createElement('span');
    idEl.className = 'transcript-segment-id';
    idEl.textContent = block.id;

    header.appendChild(idEl);

    if (block.timecode) {
      const timecodeEl = document.createElement('span');
      timecodeEl.className = 'transcript-timecode';
      timecodeEl.textContent = block.timecode;
      header.appendChild(timecodeEl);
    }

    const textEl = document.createElement('p');
    textEl.className = 'transcript-block-text';
    textEl.textContent = block.text || '(empty segment)';

    card.appendChild(header);
    card.appendChild(textEl);
    transcriptBlocksEl.appendChild(card);
  });
}

function renderShotCards(scriptData) {
  const shotCardsEl = document.getElementById('shotCards');
  if (!shotCardsEl) return;

  shotCardsEl.innerHTML = '';
  const shots = Array.isArray(scriptData.shots) ? scriptData.shots : [];

  if (shots.length === 0) {
    shotCardsEl.innerHTML = '<div class="transcript-empty">No shots found in script JSON.</div>';
    return;
  }

  shots.forEach((shot, idx) => {
    normalizeShotLinks(shot);

    const card = document.createElement('article');
    card.className = 'shot-list-card';

    const title = document.createElement('h4');
    title.className = 'shot-list-card-title';
    const shotId = shot.id || shot.shotId || `SHOT_${String(idx + 1).padStart(2, '0')}`;
    title.textContent = `${shotId} · Shot ${shot.shotNumber || idx + 1}`;

    const intent = document.createElement('p');
    intent.className = 'shot-list-card-intent';
    intent.textContent = shot.intent?.what || shot.intent?.why || 'No intent summary yet.';

    const chipGroup = document.createElement('div');
    chipGroup.className = 'shot-link-chip-group';

    const addChip = (label, values, jumpable = false) => {
      const chip = document.createElement('div');
      chip.className = 'shot-link-chip';

      const badge = document.createElement('span');
      badge.className = 'shot-link-chip-badge';
      badge.textContent = `${label}: ${values.length}`;
      chip.appendChild(badge);

      if (values.length) {
        const list = document.createElement('div');
        list.className = 'shot-link-chip-items';
        values.forEach(val => {
          const item = document.createElement(jumpable ? 'button' : 'span');
          item.className = jumpable ? 'quick-jump-chip' : 'shot-link-value';
          item.textContent = val;
          if (jumpable) {
            item.type = 'button';
            item.addEventListener('click', () => jumpToTranscriptSegment(val));
          }
          list.appendChild(item);
        });
        chip.appendChild(list);
      }

      chipGroup.appendChild(chip);
    };

    const transcriptSegments = shot.intent.links.transcriptSegments.map(String);
    const assets = shot.intent.links.assets.map(String);
    const references = shot.intent.links.references.map(String);

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
  const scriptTextarea = document.getElementById('scriptJson');
  if (!scriptTextarea) return;

  const parsed = parseScriptJsonFromEditor();
  if (!parsed) return;

  const youtubeScriptEl = document.getElementById('youtubeContentScript');
  if (youtubeScriptEl && document.activeElement !== youtubeScriptEl) {
    youtubeScriptEl.value = parsed.youtubeContentScript || '';
  }

  renderTranscriptBlocks(parsed);
  renderShotCards(parsed);
}

function buildScriptJsonFromViews() {
  const scriptTextarea = document.getElementById('scriptJson');
  if (!scriptTextarea) return '';

  const base = parseScriptJsonFromEditor() || normalizeScriptData({});
  const youtubeScriptEl = document.getElementById('youtubeContentScript');
  base.youtubeContentScript = youtubeScriptEl ? youtubeScriptEl.value : base.youtubeContentScript;

  if (!Array.isArray(base.transcriptBlocks) || base.transcriptBlocks.length === 0) {
    base.transcriptBlocks = getTranscriptBlocksFromScriptData(base);
  }

  base.shots = (base.shots || []).map(normalizeShotLinks);
  return JSON.stringify(base, null, 2);
}

// Save canon data
async function saveCanonData(type, content, statusElementId, label) {
  if (!currentProject) {
    showToast('Error', 'No active project', 'error', 3000);
    return;
  }

  try {
    // Validate JSON
    const parsed = JSON.parse(content);

    const response = await fetch(`/api/save/canon/${type}?project=${currentProject.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    const result = await response.json();

    if (result.success) {
      const statusEl = document.getElementById(statusElementId);
      if (statusEl) {
        statusEl.textContent = `✓ ${label} saved (${content.length} characters)`;
        statusEl.className = 'text-input-status success';
      }
      showToast('Success', `${label} saved successfully`, 'success', 3000);
    } else {
      showToast('Error', result.error || 'Failed to save', 'error', 4000);
    }
  } catch (err) {
    showToast('Invalid JSON', 'Please enter valid JSON format: ' + err.message, 'error', 4000);
  }
}

// Load canon data
async function loadCanonData() {
  if (!currentProject) return;

  const types = ['script', 'youtubeScript', 'transcript', 'assets', 'characters', 'locations', 'style', 'cinematography'];

  for (const type of types) {
    try {
      const response = await fetch(`/api/load/canon/${type}?project=${currentProject.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          const textarea = document.getElementById(`${type}Json`);
          if (textarea) {
            textarea.value = data.content;
            if (type === 'script') {
              syncScriptEditorViews();
            }
          }
          const statusEl = document.getElementById(`${type}Status`);
          if (statusEl) {
            statusEl.textContent = `✓ Loaded (${data.content.length} characters)`;
            statusEl.className = 'text-input-status success';
          }
        }
      }
    } catch (err) {
      console.error(`Error loading ${type}:`, err);
    }
  }
}

// Initialize uploads
function initializeUploads() {
  setupDragAndDrop('musicUploadZone', 'musicFileInput', '/api/upload/music', 'musicUploadStatus');
  setupTextInputs();
  setupStep1TextInputs();
  setupModals();
  setupCollapsibleSections();
  checkUploadStatus();
  loadTextContent();
  loadStep1Content();
  checkMusicFile();
}

// Delete music file handler
const deleteMusicBtn = document.getElementById('deleteMusicBtn');
if (deleteMusicBtn) {
  deleteMusicBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this music file?')) return;

    try {
      const response = await fetch(`/api/delete/music?project=${currentProject.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        showToast('Success', 'Music file deleted', 'success', 3000);
        document.getElementById('musicControls').style.display = 'none';
        document.getElementById('musicPlayer').src = '';
        await checkUploadStatus();
      } else {
        showToast('Error', result.error || 'Failed to delete music file', 'error', 4000);
      }
    } catch (err) {
      showToast('Error', 'Failed to delete music file: ' + err.message, 'error', 4000);
    }
  });
}

// Canon save button handlers

const saveYoutubeScriptBtn = document.getElementById('saveYoutubeScriptBtn');
if (saveYoutubeScriptBtn) {
  saveYoutubeScriptBtn.addEventListener('click', async () => {
    const content = document.getElementById('youtubeScriptJson').value.trim();
    if (!content) {
      showToast('Error', 'Please enter YouTube content script JSON', 'warning', 3000);
      return;
    }
    await saveCanonData('youtubeScript', content, 'youtubeScriptStatus', 'YouTube Script');
  });
}

const saveTranscriptBtn = document.getElementById('saveTranscriptBtn');
if (saveTranscriptBtn) {
  saveTranscriptBtn.addEventListener('click', async () => {
    const content = document.getElementById('transcriptJson').value.trim();
    if (!content) {
      showToast('Error', 'Please enter transcript JSON', 'warning', 3000);
      return;
    }
    await saveCanonData('transcript', content, 'transcriptStatus', 'Transcript');
  });
}

const saveAssetsBtn = document.getElementById('saveAssetsBtn');
if (saveAssetsBtn) {
  saveAssetsBtn.addEventListener('click', async () => {
    const content = document.getElementById('assetsJson').value.trim();
    if (!content) {
      showToast('Error', 'Please enter asset plan JSON', 'warning', 3000);
      return;
    }
    await saveCanonData('assets', content, 'assetsStatus', 'Asset Plan');
  });
}

const saveCharactersBtn = document.getElementById('saveCharactersBtn');
if (saveCharactersBtn) {
  saveCharactersBtn.addEventListener('click', async () => {
    const content = document.getElementById('charactersJson').value.trim();
    if (!content) {
      showToast('Error', 'Please enter characters JSON', 'warning', 3000);
      return;
    }
    await saveCanonData('characters', content, 'charactersStatus', 'Characters');
  });
}

const saveLocationsBtn = document.getElementById('saveLocationsBtn');
if (saveLocationsBtn) {
  saveLocationsBtn.addEventListener('click', async () => {
    const content = document.getElementById('locationsJson').value.trim();
    if (!content) {
      showToast('Error', 'Please enter locations JSON', 'warning', 3000);
      return;
    }
    await saveCanonData('locations', content, 'locationsStatus', 'Locations');
  });
}

const saveStyleBtn = document.getElementById('saveStyleBtn');
if (saveStyleBtn) {
  saveStyleBtn.addEventListener('click', async () => {
    const content = document.getElementById('styleJson').value.trim();
    if (!content) {
      showToast('Error', 'Please enter visual style JSON', 'warning', 3000);
      return;
    }
    await saveCanonData('style', content, 'styleStatus', 'Visual Style');
  });
}

const saveCinematographyBtn = document.getElementById('saveCinematographyBtn');
if (saveCinematographyBtn) {
  saveCinematographyBtn.addEventListener('click', async () => {
    const content = document.getElementById('cinematographyJson').value.trim();
    if (!content) {
      showToast('Error', 'Please enter cinematography JSON', 'warning', 3000);
      return;
    }
    await saveCanonData('cinematography', content, 'cinematographyStatus', 'Cinematography');
  });
}

const saveScriptBtn = document.getElementById('saveScriptBtn');
if (saveScriptBtn) {
  saveScriptBtn.addEventListener('click', async () => {
    const content = buildScriptJsonFromViews();
    if (!content) {
      showToast('Error', 'Please enter script JSON', 'warning', 3000);
      return;
    }
    document.getElementById('scriptJson').value = content;
    await saveCanonData('script', content, 'scriptStatus', 'Script');
    syncScriptEditorViews();
  });
}

// Call these in initialization (after DOM loads)
function initializeCanon() {
  if (document.querySelector('.canon-tab')) {
    setupCanonTabs();
    loadCanonData();

    const scriptTextarea = document.getElementById('scriptJson');
    if (scriptTextarea) {
      scriptTextarea.addEventListener('input', syncScriptEditorViews);
    }

    const youtubeScriptEl = document.getElementById('youtubeContentScript');
    if (youtubeScriptEl) {
      youtubeScriptEl.addEventListener('input', () => {
        const scriptTextareaEl = document.getElementById('scriptJson');
        if (!scriptTextareaEl) return;
        const merged = buildScriptJsonFromViews();
        if (!merged) return;
        scriptTextareaEl.value = merged;
        syncScriptEditorViews();
      });
    }
  }
}

// Reference Images - Characters
let charactersData = [];
let locationsData = [];

async function loadCharactersReferences() {
  if (!currentProject) return;

  try {
    const libraryService = getReferenceLibraryService();
    const result = await libraryService.listCharacters(currentProject.id);
    if (result.ok) {
      charactersData = (result.data && result.data.characters) || [];
      renderCharactersReferences();
    } else {
      showToast('Error', result.error || 'Failed to load character references', 'error', 3000);
    }
  } catch (err) {
    console.error('Error loading character references:', err);
  }
}


async function loadLocationReferences() {
  if (!currentProject) return;

  try {
    const libraryService = getReferenceLibraryService();
    const result = await libraryService.listLocations(currentProject.id);
    if (result.ok) {
      locationsData = (result.data && result.data.locations) || [];
      renderLocationReferences();
    } else {
      showToast('Error', result.error || 'Failed to load location references', 'error', 3000);
    }
  } catch (err) {
    console.error('Error loading location references:', err);
  }
}

async function uploadLocationReferenceImage(locationName, slotNum, file) {
  if (!file) return;
  try {
    const result = await getReferenceFeature().uploadLocationReference({
      projectId: currentProject.id,
      locationName,
      slotNum,
      file
    });
    if (result.ok) {
      showToast('Uploaded', `Location reference ${slotNum} uploaded`, 'success', 2000);
      await loadLocationReferences();
    } else {
      showToast('Upload failed', result.error || 'Unknown error', 'error', 4000);
    }
  } catch (err) {
    showToast('Upload failed', err.message, 'error', 4000);
  }
}

function buildLocationImageSlot(location, slotNum) {
  const image = location.images.find(img => img.slot === slotNum);
  const slot = document.createElement('div');
  slot.className = 'reference-image-slot' + (image ? ' has-image' : '');
  slot.style.position = 'relative';

  slot.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      if (input.files[0]) uploadLocationReferenceImage(location.name, slotNum, input.files[0]);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });

  slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drag-over'); });
  slot.addEventListener('dragleave', (e) => { e.preventDefault(); slot.classList.remove('drag-over'); });
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadLocationReferenceImage(location.name, slotNum, file);
  });

  if (image) {
    const img = document.createElement('img');
    img.src = `/projects/${currentProject.id}/reference/locations/${encodeURIComponent(location.name)}/${image.filename}`;
    img.alt = `${location.name} reference ${slotNum}`;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '8px';
    slot.appendChild(img);

    const delBtn = document.createElement('button');
    delBtn.className = 'reference-image-delete';
    delBtn.textContent = '×';
    delBtn.title = 'Delete image';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const libraryService = getReferenceLibraryService();
      const result = await libraryService.deleteLocationImage(currentProject.id, location.name, slotNum);
      if (result.ok) loadLocationReferences();
      else showToast('Error', result.error || 'Failed to delete image', 'error', 4000);
    });
    slot.appendChild(delBtn);
  } else {
    const icon = document.createElement('div');
    icon.className = 'upload-icon';
    icon.textContent = '+';
    const label = document.createElement('div');
    label.className = 'upload-label';
    label.textContent = `Ref ${slotNum}`;
    slot.appendChild(icon);
    slot.appendChild(label);
  }

  return slot;
}

function renderLocationReferences() {
  const container = document.getElementById('locationsReferenceList');
  if (!container) return;

  if (locationsData.length === 0) {
    container.innerHTML = '<div class="empty-state-small">No location references yet. Add your first location.</div>';
    return;
  }

  container.innerHTML = '';

  locationsData.forEach(location => {
    const card = document.createElement('div');
    card.className = 'character-reference-card';

    const header = document.createElement('div');
    header.className = 'character-reference-header';

    const title = document.createElement('h3');
    title.className = 'character-reference-title';
    title.textContent = '📍 ' + location.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'character-reference-delete';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete location "${location.name}" and all references?`)) return;
      const libraryService = getReferenceLibraryService();
      const result = await libraryService.deleteLocation(currentProject.id, location.name);
      if (result.ok) loadLocationReferences();
      else showToast('Error', result.error || 'Failed to delete location', 'error', 4000);
    });

    header.appendChild(title);
    header.appendChild(delBtn);

    const slotsWrap = document.createElement('div');
    slotsWrap.className = 'reference-images-grid';
    for (let i = 1; i <= 3; i++) slotsWrap.appendChild(buildLocationImageSlot(location, i));

    card.appendChild(header);
    card.appendChild(slotsWrap);
    container.appendChild(card);
  });
}

// Prompt slot labels
const PROMPT_SLOT_LABELS = ['Front View', '3/4 View', 'Close-Up'];

/**
 * Copy character definition to clipboard
 */
async function copyCharacterDefinition(characterName) {
  const char = charactersData.find(c => c.name === characterName);
  if (!char || !char.definition) {
    showToast('Empty', 'No definition to copy', 'warning', 2000);
    return;
  }
  try {
    await copyText(char.definition);
    showToast('Copied!', `${characterName} definition copied`, 'success', 2000);
  } catch (err) {
    showToast('Copy failed', 'Could not copy to clipboard', 'error', 3000);
  }
}

/**
 * Copy character prompt to clipboard
 */
async function copyCharacterPrompt(characterName, slot) {
  const char = charactersData.find(c => c.name === characterName);
  if (!char || !char.prompts || !char.prompts[slot - 1]) {
    showToast('Empty', 'No prompt to copy', 'warning', 2000);
    return;
  }
  try {
    await copyText(char.prompts[slot - 1]);
    showToast('Copied!', `Prompt ${slot} (${PROMPT_SLOT_LABELS[slot - 1]}) copied`, 'success', 2000);
  } catch (err) {
    showToast('Copy failed', 'Could not copy to clipboard', 'error', 3000);
  }
}

/**
 * Handle drag-and-drop file upload for image slots
 */
async function handleDragDropUpload(characterName, slotNum, file) {
  if (!file) return;
  showToast('Uploading', 'Uploading reference image...', 'info', 2000);

  try {
    const result = await getReferenceFeature().uploadCharacterReference({
      projectId: currentProject.id,
      characterName,
      slotNum,
      file
    });
    if (result.ok) {
      showToast('Uploaded', `Reference image ${slotNum} uploaded`, 'success', 2000);
      await loadCharactersReferences();
    } else {
      showToast('Upload failed', result.error || 'Unknown error', 'error', 4000);
    }
  } catch (err) {
    showToast('Upload failed', err.message, 'error', 4000);
  }
}

/**
 * Build a section header element
 */
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

/**
 * Build an image upload slot with drag-and-drop
 */
function buildImageSlot(char, slotNum) {
  const image = char.images.find(img => img.slot === slotNum);
  const generatedImage = char.generatedImages ? char.generatedImages.find(img => img.slot === slotNum) : null;
  const displayImage = image || generatedImage;
  const isGenerating = activeGenerations.has(`${char.name}-${slotNum}`);

  const slot = document.createElement('div');
  slot.className = 'reference-image-slot' + (displayImage ? ' has-image' : '') + (isGenerating ? ' generating' : '');
  slot.style.position = 'relative';
  if (!isGenerating) {
    slot.addEventListener('click', () => openReferenceImageUpload(char.name, slotNum));
  }

  // Drag-and-drop events
  slot.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    slot.classList.add('drag-over');
  });
  slot.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    slot.classList.add('drag-over');
  });
  slot.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    slot.classList.remove('drag-over');
  });
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    slot.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      handleDragDropUpload(char.name, slotNum, file);
    }
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
    img.src = `/projects/${encodeURIComponent(currentProject.id)}/reference/characters/${encodeURIComponent(char.name)}/${encodeURIComponent(displayImage.filename)}`;
    img.className = 'reference-image-preview';
    img.alt = `${char.name} reference ${slotNum}`;
    slot.appendChild(img);

    // Badge for AI-generated images
    if (!image && generatedImage) {
      const badge = document.createElement('div');
      badge.className = 'ai-generated-badge';
      badge.textContent = 'AI Generated';
      slot.appendChild(badge);
    }

    const overlay = document.createElement('div');
    overlay.className = 'reference-image-overlay';
    const actions = document.createElement('div');
    actions.className = 'reference-image-actions';

    const delImgBtn = document.createElement('button');
    delImgBtn.className = 'btn btn-secondary btn-sm';
    delImgBtn.textContent = '\ud83d\uddd1\ufe0f Delete';
    delImgBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteReferenceImage(char.name, slotNum); });

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'btn btn-primary btn-sm';
    replaceBtn.textContent = '\ud83d\udce4 Replace';
    replaceBtn.addEventListener('click', (e) => { e.stopPropagation(); openReferenceImageUpload(char.name, slotNum); });

    actions.appendChild(delImgBtn);
    actions.appendChild(replaceBtn);

    if (canGenerate) {
      const regenBtn = document.createElement('button');
      regenBtn.className = 'btn btn-generate btn-sm';
      regenBtn.textContent = 'Regenerate';
      regenBtn.addEventListener('click', (e) => { e.stopPropagation(); generateImage(char.name, slotNum); });
      actions.appendChild(regenBtn);
    }

    overlay.appendChild(actions);
    slot.appendChild(overlay);
  } else {
    const iconDiv = document.createElement('div');
    iconDiv.className = 'reference-slot-icon';
    iconDiv.textContent = '\ud83d\udcf7';
    const labelDiv = document.createElement('div');
    labelDiv.className = 'reference-slot-label';
    labelDiv.textContent = `${PROMPT_SLOT_LABELS[slotNum - 1]}`;
    const hintDiv = document.createElement('div');
    hintDiv.className = 'reference-slot-hint';
    hintDiv.textContent = 'Click or drag & drop';
    slot.appendChild(iconDiv);
    slot.appendChild(labelDiv);
    slot.appendChild(hintDiv);

    if (canGenerate) {
      const hasPrompt = char.prompts && char.prompts[slotNum - 1];
      if (hasPrompt) {
        const genBtn = document.createElement('button');
        genBtn.className = 'btn btn-generate btn-sm reference-slot-generate';
        genBtn.textContent = 'AI Generate';
        genBtn.addEventListener('click', (e) => { e.stopPropagation(); generateImage(char.name, slotNum); });
        slot.appendChild(genBtn);
      }
    }
  }

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = `refImg-${char.name}-${slotNum}`;
  fileInput.accept = 'image/png,image/jpeg,image/jpg';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', function() { handleReferenceImageUpload(char.name, slotNum, this); });
  slot.appendChild(fileInput);

  return slot;
}

function renderCharactersReferences() {
  const container = document.getElementById('charactersReferenceList');
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

  charactersData.forEach(char => {
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
    deleteBtn.addEventListener('click', () => deleteCharacterReference(char.name));
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
      copyDefBtn.addEventListener('click', () => copyCharacterDefinition(char.name));
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

    [1, 2, 3].forEach(slotNum => {
      const promptCard = document.createElement('div');
      promptCard.className = 'character-prompt-card';

      // Label
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

      // Prompt text or placeholder
      const promptContent = char.prompts && char.prompts[slotNum - 1];
      if (promptContent) {
        const promptText = document.createElement('div');
        promptText.className = 'character-prompt-text';
        promptText.textContent = promptContent;
        promptCard.appendChild(promptText);

        const promptActions = document.createElement('div');
        promptActions.className = 'character-prompt-actions';
        const copyPromptBtn = document.createElement('button');
        copyPromptBtn.className = 'btn btn-secondary btn-sm';
        copyPromptBtn.textContent = '\ud83d\udccb Copy';
        copyPromptBtn.addEventListener('click', () => copyCharacterPrompt(char.name, slotNum));
        promptActions.appendChild(copyPromptBtn);

        if (canGenerate) {
          const genPromptBtn = document.createElement('button');
          genPromptBtn.className = 'btn btn-generate btn-sm';
          genPromptBtn.textContent = 'Generate';
          genPromptBtn.addEventListener('click', () => generateImage(char.name, slotNum));
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

    [1, 2, 3].forEach(slotNum => {
      grid.appendChild(buildImageSlot(char, slotNum));
    });

    imagesSection.appendChild(grid);
    card.appendChild(imagesSection);

    container.appendChild(card);
  });
}

function openReferenceImageUpload(characterName, slotNum) {
  document.getElementById(`refImg-${characterName}-${slotNum}`).click();
}

async function handleReferenceImageUpload(characterName, slotNum, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  if (!currentProject) {
    showToast('Error', 'No active project', 'error', 3000);
    return;
  }

  try {
    showToast('Uploading', 'Uploading reference image...', 'info', 2000);
    const result = await getReferenceFeature().uploadCharacterReference({
      projectId: currentProject.id,
      characterName,
      slotNum,
      file
    });

    if (result.ok) {
      showToast('Success', 'Reference image uploaded', 'success', 3000);
      await loadCharactersReferences();
    } else {
      showToast('Error', result.error || 'Upload failed', 'error', 4000);
    }
  } catch (err) {
    showToast('Error', 'Failed to upload: ' + err.message, 'error', 4000);
  }

  inputEl.value = '';
}

async function deleteReferenceImage(characterName, slotNum) {
  if (!confirm(`Delete reference image ${slotNum} for ${characterName}?`)) return;

  try {
    const libraryService = getReferenceLibraryService();
    const result = await libraryService.deleteCharacterImage(currentProject.id, characterName, slotNum);
    if (result.ok) {
      showToast('Success', 'Reference image deleted', 'success', 3000);
      await loadCharactersReferences();
    } else {
      showToast('Error', result.error || 'Delete failed', 'error', 4000);
    }
  } catch (err) {
    showToast('Error', 'Failed to delete: ' + err.message, 'error', 4000);
  }
}

async function deleteCharacterReference(characterName) {
  if (!confirm(`Delete all reference images for ${characterName}?`)) return;

  try {
    const libraryService = getReferenceLibraryService();
    const result = await libraryService.deleteCharacter(currentProject.id, characterName);
    if (result.ok) {
      showToast('Success', 'Character references deleted', 'success', 3000);
      await loadCharactersReferences();
    } else {
      showToast('Error', result.error || 'Delete failed', 'error', 4000);
    }
  } catch (err) {
    showToast('Error', 'Failed to delete: ' + err.message, 'error', 4000);
  }
}

// Add Character Button Handler
const addCharacterBtn = document.getElementById('addCharacterBtn');
if (addCharacterBtn) {
  addCharacterBtn.addEventListener('click', async () => {
    const nameInput = document.getElementById('newCharacterName');
    const characterName = nameInput.value.trim();

    if (!characterName) {
      showToast('Error', 'Please enter a character name', 'warning', 3000);
      return;
    }

    if (charactersData.some(c => c.name.toLowerCase() === characterName.toLowerCase())) {
      showToast('Error', 'Character already exists', 'warning', 3000);
      return;
    }

    try {
      const libraryService = getReferenceLibraryService();
      const result = await libraryService.addCharacter(currentProject.id, characterName);
      if (result.ok) {
        showToast('Success', `Character "${characterName}" added`, 'success', 3000);
        nameInput.value = '';
        await loadCharactersReferences();
      } else {
        showToast('Error', result.error || 'Failed to add character', 'error', 4000);
      }
    } catch (err) {
      showToast('Error', 'Failed to add character: ' + err.message, 'error', 4000);
    }
  });
}


// Add Location Button Handler
const addLocationBtn = document.getElementById('addLocationBtn');
if (addLocationBtn) {
  addLocationBtn.addEventListener('click', async () => {
    const nameInput = document.getElementById('newLocationName');
    const locationName = nameInput.value.trim();

    if (!locationName) {
      showToast('Error', 'Please enter a location name', 'warning', 3000);
      return;
    }

    if (locationsData.some(l => l.name.toLowerCase() === locationName.toLowerCase())) {
      showToast('Error', 'Location already exists', 'warning', 3000);
      return;
    }

    try {
      const libraryService = getReferenceLibraryService();
      const result = await libraryService.addLocation(currentProject.id, locationName);
      if (result.ok) {
        showToast('Success', `Location "${locationName}" added`, 'success', 3000);
        nameInput.value = '';
        await loadLocationReferences();
      } else {
        showToast('Error', result.error || 'Failed to add location', 'error', 4000);
      }
    } catch (err) {
      showToast('Error', 'Failed to add location: ' + err.message, 'error', 4000);
    }
  });
}

// AI Image Generation
async function checkGenerateStatus() {
  try {
    const response = await fetch('/api/generate-status');
    if (response.ok) {
      const data = await response.json();
      canGenerate = data.configured === true;
      generateTokenSource = data.tokenSource || 'none';
      if (replicateKeyStatus) {
        if (canGenerate) {
          replicateKeyStatus.textContent = generateTokenSource === 'session'
            ? 'Configured (session key)'
            : 'Configured (.env key)';
        } else {
          replicateKeyStatus.textContent = 'Not configured';
        }
      }
    }
  } catch {
    canGenerate = false;
    generateTokenSource = 'none';
    if (replicateKeyStatus) replicateKeyStatus.textContent = 'Status check failed';
  }
}

function isTerminalRunStatus(status) {
  return status === 'completed' || status === 'failed' || status === 'canceled' || status === 'reverted';
}

function closeAgentEventStream() {
  if (!agentEventSource) return;
  agentEventSource.close();
  agentEventSource = null;
}

function resetAgentRunUI({ clearLog = true } = {}) {
  if (agentRunStatus) {
    agentRunStatus.textContent = 'No run started yet.';
  }
  if (agentRunFiles) {
    agentRunFiles.innerHTML = '';
  }
  if (clearLog && agentRunLog) {
    agentRunLog.textContent = '';
  }
  if (agentCancelRunBtn) {
    agentCancelRunBtn.disabled = true;
  }
  if (agentRevertRunBtn) {
    agentRevertRunBtn.disabled = true;
  }
  agentRunCache = null;
  agentActiveRunId = null;
  closeAgentEventStream();
}

function appendAgentLogLine(line) {
  if (!agentRunLog) return;
  const text = String(line || '').trim();
  if (!text) return;
  const maxLines = 200;
  const existing = agentRunLog.textContent ? agentRunLog.textContent.split('\n') : [];
  existing.push(text);
  if (existing.length > maxLines) {
    existing.splice(0, existing.length - maxLines);
  }
  agentRunLog.textContent = existing.join('\n');
  agentRunLog.scrollTop = agentRunLog.scrollHeight;
}

function updateGitHubAuthUI() {
  if (githubAuthPill) {
    githubAuthPill.classList.remove('connected', 'disconnected');
    if (githubAuthState.connected) {
      githubAuthPill.classList.add('connected');
      const who = githubAuthState.username ? `@${githubAuthState.username}` : 'connected';
      githubAuthPill.textContent = `GitHub ${who}`;
    } else {
      githubAuthPill.classList.add('disconnected');
      githubAuthPill.textContent = 'GitHub not connected';
    }
  }
  if (githubConnectBtn) {
    githubConnectBtn.style.display = githubAuthState.connected ? 'none' : 'inline-flex';
  }
  if (githubLogoutBtn) {
    githubLogoutBtn.style.display = githubAuthState.connected ? 'inline-flex' : 'none';
  }
}

function updateAgentControlsForShot() {
  const hasShot = Boolean(currentProject && currentShot && currentTool);
  const showRenders = hasShot && (currentTool === 'seedream' || currentTool === 'kling');

  if (agentGeneratePromptBtn) {
    agentGeneratePromptBtn.style.display = hasShot ? 'inline-flex' : 'none';
    agentGeneratePromptBtn.disabled = !hasShot;
  }
  if (shotGenerationLayout) {
    if (!hasShot) {
      shotGenerationLayout.style.display = 'none';
    } else {
      shotGenerationLayout.style.display = 'grid';
      shotGenerationLayout.style.gridTemplateColumns = showRenders ? '' : '1fr';
    }
  }
  if (agentRunPanel) {
    agentRunPanel.style.display = hasShot ? 'block' : 'none';
  }
}

function renderAgentRunFiles(run) {
  if (!agentRunFiles) return;
  const writes = Array.isArray(run?.writes) ? run.writes : [];
  if (writes.length === 0) {
    agentRunFiles.innerHTML = '';
    return;
  }

  const projectQuery = currentProject ? `?project=${encodeURIComponent(currentProject.id)}` : '';
  agentRunFiles.innerHTML = '';
  writes.forEach((write) => {
    const row = document.createElement('div');
    row.className = 'agent-run-file';
    const pathText = String(write.path || '').replace(/^\/+/, '');
    const anchor = document.createElement('a');
    anchor.href = `/${pathText}${projectQuery}`;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = pathText;
    const status = document.createElement('span');
    status.textContent = `[${write.result || 'written'}]`;
    row.appendChild(anchor);
    row.appendChild(status);
    agentRunFiles.appendChild(row);
  });
}

function renderAgentRunState(run) {
  if (!run) return;
  agentRunCache = run;
  const status = run.status || 'unknown';
  const step = run.step || '';
  const progress = Number.isFinite(run.progress) ? Math.max(0, Math.min(100, run.progress)) : 0;
  if (agentRunStatus) {
    const statusLabel = `${status}${step ? ` · ${step}` : ''}`;
    agentRunStatus.textContent = `${statusLabel} (${progress}%)`;
  }
  renderAgentRunFiles(run);

  const terminal = isTerminalRunStatus(status);
  if (agentCancelRunBtn) {
    agentCancelRunBtn.disabled = !agentActiveRunId || terminal;
  }
  if (agentRevertRunBtn) {
    const canRevert = Boolean(agentActiveRunId) && (status === 'completed' || status === 'failed' || status === 'canceled');
    agentRevertRunBtn.disabled = !canRevert;
  }
}

async function refreshGitHubAuthStatus({ silent = false } = {}) {
  try {
    const response = await fetch('/api/auth/github/status');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    githubAuthState = {
      connected: Boolean(data.connected),
      username: data.username || '',
      scopes: Array.isArray(data.scopes) ? data.scopes : [],
      tokenSource: data.tokenSource || 'none'
    };
  } catch (err) {
    githubAuthState = { connected: false, username: '', scopes: [], tokenSource: 'none' };
    if (!silent) {
      showToast('GitHub auth error', err.message || 'Failed to check auth status', 'error', 3500);
    }
  }
  updateGitHubAuthUI();
  return githubAuthState;
}

function startGitHubOAuth() {
  const returnTo = `${window.location.pathname}${window.location.search || ''}`;
  window.location.assign(`/api/auth/github/start?returnTo=${encodeURIComponent(returnTo)}`);
}

async function logoutGitHubOAuth() {
  try {
    const response = await fetch('/api/auth/github/logout', {
      method: 'POST'
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to logout');
    }
    githubAuthState = {
      connected: Boolean(result.connected),
      username: result.username || '',
      scopes: Array.isArray(result.scopes) ? result.scopes : [],
      tokenSource: result.tokenSource || 'none'
    };
    updateGitHubAuthUI();
    showToast('GitHub disconnected', 'OAuth session cleared for this browser session.', 'info', 2500);
  } catch (err) {
    showToast('Logout failed', err.message || 'Could not clear GitHub session', 'error', 3500);
  }
}

async function fetchAgentRunState(runId) {
  const response = await fetch(`/api/agents/prompt-runs/${encodeURIComponent(runId)}`);
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to fetch run state');
  }
  return result;
}

function connectAgentRunEvents(runId) {
  closeAgentEventStream();
  const source = new EventSource(`/api/agents/prompt-runs/${encodeURIComponent(runId)}/events`);
  agentEventSource = source;

  source.onmessage = (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data || '{}');
    } catch {
      payload = {};
    }

    const eventName = payload.event || 'event';
    if (eventName === 'stream_open') {
      appendAgentLogLine(`[stream] ${payload.status || 'open'}`);
      return;
    }

    const ts = payload.timestamp ? new Date(payload.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    const logSummary = payload.error?.message
      ? `${eventName}: ${payload.error.message}`
      : (payload.path ? `${eventName}: ${payload.path}` : eventName);
    appendAgentLogLine(`[${ts}] ${logSummary}`);

    if (payload.event === 'file_write_preview' && payload.preview) {
      appendAgentLogLine(`preview> ${String(payload.preview).replace(/\s+/g, ' ').slice(0, 220)}`);
    }

    if (payload.event === 'run_completed' || payload.event === 'run_failed' || payload.event === 'run_reverted') {
      closeAgentEventStream();
    }

    if (agentActiveRunId) {
      fetchAgentRunState(agentActiveRunId)
        .then((run) => {
          renderAgentRunState(run);
          if (isTerminalRunStatus(run.status)) {
            if (run.status === 'completed') {
              showToast('Agent run completed', `${run.shotId} ${run.variation}`, 'success', 2500);
              loadIndex();
            } else if (run.status === 'failed') {
              showToast('Agent run failed', run.error?.message || 'Unknown error', 'error', 5000);
            } else if (run.status === 'reverted') {
              showToast('Agent run reverted', `${run.shotId} ${run.variation}`, 'info', 3000);
              loadIndex();
            }
          }
        })
        .catch(() => {});
    }
  };

  source.onerror = () => {
    if (agentEventSource === source) {
      closeAgentEventStream();
      if (agentActiveRunId) {
        fetchAgentRunState(agentActiveRunId)
          .then(renderAgentRunState)
          .catch(() => {});
      }
    }
  };
}

async function startAgentPromptRun() {
  if (!currentProject || !currentShot || !currentTool) return;

  if (!githubAuthState.connected) {
    showToast('GitHub required', 'Connect GitHub first to run the in-app prompt agent.', 'warning', 3500);
    startGitHubOAuth();
    return;
  }

  if (agentGeneratePromptBtn) {
    agentGeneratePromptBtn.disabled = true;
    agentGeneratePromptBtn.textContent = 'Starting...';
  }
  if (agentRunLog && !agentRunLog.textContent.trim()) {
    appendAgentLogLine(`[${new Date().toLocaleTimeString()}] run queued`);
  }

  try {
    const response = await fetch('/api/agents/prompt-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: currentProject.id,
        shotId: currentShot.shotId,
        variation: currentVariation,
        mode: 'generate',
        tool: currentTool
      })
    });

    const result = await response.json();
    if (response.status === 409 && result.code === 'LOCK_CONFLICT') {
      throw new Error(`Shot is locked by active run ${result.activeRunId || ''}`.trim());
    }
    if (response.status === 401 && result.code === 'AUTH_REQUIRED') {
      throw new Error('GitHub auth session expired. Reconnect GitHub.');
    }
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to start run');
    }

    agentActiveRunId = result.runId;
    appendAgentLogLine(`[${new Date().toLocaleTimeString()}] run started: ${result.runId}`);
    const run = await fetchAgentRunState(result.runId);
    renderAgentRunState(run);
    connectAgentRunEvents(result.runId);
  } catch (err) {
    if (/auth/i.test(String(err.message || ''))) {
      refreshGitHubAuthStatus({ silent: true });
    }
    showToast('Agent run failed to start', err.message || 'Unknown error', 'error', 4500);
  } finally {
    if (agentGeneratePromptBtn) {
      agentGeneratePromptBtn.disabled = false;
      agentGeneratePromptBtn.textContent = 'Agent Generate Prompt';
    }
  }
}

async function cancelAgentRun() {
  if (!agentActiveRunId) return;
  try {
    const response = await fetch(`/api/agents/prompt-runs/${encodeURIComponent(agentActiveRunId)}/cancel`, {
      method: 'POST'
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to cancel run');
    }
    appendAgentLogLine(`[${new Date().toLocaleTimeString()}] cancel requested`);
    showToast('Cancel requested', 'Agent run will stop at the next safe step.', 'info', 2500);
    const run = await fetchAgentRunState(agentActiveRunId);
    renderAgentRunState(run);
  } catch (err) {
    showToast('Cancel failed', err.message || 'Could not cancel run', 'error', 3500);
  }
}

async function revertAgentRun() {
  if (!agentActiveRunId) return;
  try {
    const response = await fetch(`/api/agents/prompt-runs/${encodeURIComponent(agentActiveRunId)}/revert`, {
      method: 'POST'
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to revert run');
    }
    appendAgentLogLine(`[${new Date().toLocaleTimeString()}] reverted ${result.revertedCount || 0} file(s)`);
    showToast('Run reverted', `${result.revertedCount || 0} file(s) restored`, 'success', 3000);
    const run = await fetchAgentRunState(agentActiveRunId);
    renderAgentRunState(run);
    await loadIndex();
  } catch (err) {
    showToast('Revert failed', err.message || 'Could not revert run', 'error', 4000);
  }
}

function handleGitHubOAuthQueryFeedback() {
  const params = new URLSearchParams(window.location.search || '');
  const oauthState = params.get('gh_oauth');
  if (!oauthState) return;
  const message = params.get('gh_oauth_message') || '';

  if (oauthState === 'connected') {
    showToast('GitHub connected', 'OAuth session is active for prompt agents.', 'success', 3000);
  } else if (oauthState === 'error') {
    showToast('GitHub OAuth failed', message || 'Authorization did not complete', 'error', 5000);
  }

  params.delete('gh_oauth');
  params.delete('gh_oauth_message');
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
  window.history.replaceState({}, '', nextUrl);
}

async function generateImage(characterName, slotNum) {
  const genKey = `${characterName}-${slotNum}`;
  if (activeGenerations.has(genKey)) return;

  activeGenerations.add(genKey);
  renderCharactersReferences(); // re-render to show spinner

  const loadingToastId = showToast(
    'Generating Image...',
    `${characterName} - ${PROMPT_SLOT_LABELS[slotNum - 1]}`,
    'info',
    0
  );

  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: currentProject.id,
        mode: 'character',
        character: characterName,
        slot: slotNum
      })
    });

    const result = await response.json();
    dismissToast(loadingToastId);

    if (result.success) {
      showToast(
        'Image Generated',
        `${characterName} slot ${slotNum} - ${result.duration.toFixed(1)}s`,
        'success',
        5000
      );
      await loadCharactersReferences();
    } else {
      showToast('Generation Failed', result.error, 'error', 6000);
    }
  } catch (err) {
    dismissToast(loadingToastId);
    showToast('Generation Error', err.message, 'error', 6000);
  } finally {
    activeGenerations.delete(genKey);
    renderCharactersReferences();
  }
}

function closeGenerationJobStream() {
  if (!generationJobEventSource) return;
  generationJobEventSource.close();
  generationJobEventSource = null;
}

function setGenerationJobStatus(text = '', tone = '') {
  if (!generationJobStatus) return;
  generationJobStatus.textContent = text || '';
  generationJobStatus.classList.remove('running', 'error', 'success');
  if (tone) {
    generationJobStatus.classList.add(tone);
  }
}

function setGenerationControlsForActiveJob(active) {
  const isActive = Boolean(active);
  if (generationCancelBtn) {
    generationCancelBtn.style.display = isActive ? 'inline-flex' : 'none';
    generationCancelBtn.disabled = !isActive;
  }
}

function formatJobCreatedAt(isoString) {
  const ms = Date.parse(String(isoString || ''));
  if (!Number.isFinite(ms)) return 'unknown time';
  return new Date(ms).toLocaleString();
}

function formatJobDuration(job) {
  const startedMs = Date.parse(String(job && job.startedAt || ''));
  const finishedMs = Date.parse(String(job && job.finishedAt || ''));
  if (!Number.isFinite(startedMs) || !Number.isFinite(finishedMs) || finishedMs < startedMs) {
    return '';
  }
  return `${((finishedMs - startedMs) / 1000).toFixed(1)}s`;
}

function stopGenerationHistoryAutoRefresh() {
  if (!generationHistoryAutoRefreshTimer) return;
  clearInterval(generationHistoryAutoRefreshTimer);
  generationHistoryAutoRefreshTimer = null;
}

function setGenerationHistoryAutoRefresh(enabled) {
  if (!enabled) {
    stopGenerationHistoryAutoRefresh();
    return;
  }
  if (generationHistoryAutoRefreshTimer) return;
  generationHistoryAutoRefreshTimer = setInterval(async () => {
    if (generationHistoryRefreshInFlight) return;
    generationHistoryRefreshInFlight = true;
    try {
      await loadShotGenerationHistory();
      await loadGenerationMetrics();
    } finally {
      generationHistoryRefreshInFlight = false;
    }
  }, 4000);
}

function closeGenerationJobDetailsModal() {
  if (!generationJobDetailsModal) return;
  generationJobDetailsModal.style.display = 'none';
  generationDetailsJobId = null;
}

function buildFailureTrace(job) {
  const events = Array.isArray(job?.events) ? job.events : [];
  const lastFailedEvent = events
    .slice()
    .reverse()
    .find((evt) => evt && evt.event === 'job_failed');
  return {
    status: job?.status || 'unknown',
    error: job?.error || null,
    lastFailedEvent: lastFailedEvent || null
  };
}

function openGenerationJobDetailsModal(jobId) {
  if (!generationJobDetailsModal) return;
  const job = generationHistoryJobsById.get(jobId);
  if (!job) return;

  generationDetailsJobId = job.jobId;
  if (generationJobDetailsMeta) {
    generationJobDetailsMeta.textContent = `${job.jobId} · ${job.type} · ${job.status} · ${formatJobCreatedAt(job.createdAt)}`;
  }

  if (generationJobInputJson) {
    generationJobInputJson.textContent = JSON.stringify(job.input || {}, null, 2);
  }

  const resultView = {
    result: job.result || {},
    references: {
      source: job.result?.referenceSource || '',
      count: job.result?.referenceCount || 0,
      trimmed: Boolean(job.result?.referenceTrimmed),
      trimmedCount: job.result?.trimmedReferenceCount || 0
    }
  };
  if (generationJobResultJson) {
    generationJobResultJson.textContent = JSON.stringify(resultView, null, 2);
  }

  if (generationJobFailureJson) {
    generationJobFailureJson.textContent = JSON.stringify(buildFailureTrace(job), null, 2);
  }

  const eventTail = (Array.isArray(job.events) ? job.events : []).slice(-25);
  if (generationJobEventsJson) {
    generationJobEventsJson.textContent = JSON.stringify(eventTail, null, 2);
  }

  const variationValue = String(job.input?.variation || '').toUpperCase();
  if (generationRetryVariation) {
    generationRetryVariation.value = /^[A-D]$/.test(variationValue) ? variationValue : '';
  }
  if (generationRetryMaxImages) {
    const maxImages = Number(job.input?.maxImages);
    generationRetryMaxImages.value = Number.isFinite(maxImages) ? String(Math.max(1, Math.min(2, Math.floor(maxImages)))) : '';
  }
  if (generationRetryAspectRatio) {
    generationRetryAspectRatio.value = String(job.input?.aspect_ratio || '');
  }
  if (generationRetryRequireReference) {
    generationRetryRequireReference.checked = Boolean(job.input?.requireReference);
  }
  if (generationRetryPreviewOnly) {
    generationRetryPreviewOnly.checked = job.input?.previewOnly !== false;
  }

  const canRetry = ['failed', 'canceled', 'completed'].includes(String(job.status || ''));
  if (generationJobRetryDefaultBtn) generationJobRetryDefaultBtn.disabled = !canRetry || Boolean(activeGenerationJobId);
  if (generationJobRetryOverrideBtn) generationJobRetryOverrideBtn.disabled = !canRetry || Boolean(activeGenerationJobId);
  generationJobDetailsModal.style.display = 'flex';
}

function collectGenerationRetryOverridesFromForm() {
  const overrides = {};

  const variation = generationRetryVariation ? String(generationRetryVariation.value || '').trim().toUpperCase() : '';
  if (/^[A-D]$/.test(variation)) {
    overrides.variation = variation;
  }

  const maxImagesRaw = generationRetryMaxImages ? String(generationRetryMaxImages.value || '').trim() : '';
  if (maxImagesRaw) {
    const maxImages = Number(maxImagesRaw);
    if (Number.isFinite(maxImages)) {
      overrides.maxImages = Math.max(1, Math.min(2, Math.floor(maxImages)));
    }
  }

  const aspectRatio = generationRetryAspectRatio ? String(generationRetryAspectRatio.value || '').trim() : '';
  if (aspectRatio) {
    overrides.aspect_ratio = aspectRatio;
  }

  if (generationRetryRequireReference) {
    overrides.requireReference = Boolean(generationRetryRequireReference.checked);
  }

  if (generationRetryPreviewOnly) {
    overrides.previewOnly = Boolean(generationRetryPreviewOnly.checked);
  }

  return overrides;
}

async function retryGenerationJobFromDetails(useOverrides) {
  if (!generationDetailsJobId) return;
  const sourceJobId = generationDetailsJobId;
  const overrides = useOverrides ? collectGenerationRetryOverridesFromForm() : null;

  if (generationJobRetryDefaultBtn) generationJobRetryDefaultBtn.disabled = true;
  if (generationJobRetryOverrideBtn) generationJobRetryOverrideBtn.disabled = true;
  try {
    await retryGenerationJobFromHistory(sourceJobId, overrides);
  } finally {
    if (generationJobRetryDefaultBtn) generationJobRetryDefaultBtn.disabled = false;
    if (generationJobRetryOverrideBtn) generationJobRetryOverrideBtn.disabled = false;
  }
}

async function cancelGenerationJobById(jobId) {
  if (!jobId) return;
  try {
    const response = await fetch(`/api/generation-jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST'
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to cancel generation job');
    }
    if (jobId === activeGenerationJobId) {
      setGenerationJobStatus('Cancel requested...', 'running');
    }
    showToast('Cancel requested', 'Generation job cancellation requested.', 'info', 2500);
  } catch (err) {
    showToast('Cancel failed', err.message || 'Could not cancel generation job', 'error', 4000);
  } finally {
    await loadShotGenerationHistory();
    await loadGenerationMetrics();
  }
}

async function retryGenerationJobFromHistory(jobId, overrides = null) {
  if (!currentProject || !jobId) return;
  try {
    const payload = { projectId: currentProject.id };
    if (overrides && Object.keys(overrides).length > 0) {
      payload.overrides = overrides;
    }
    const response = await fetch(`/api/generation-jobs/${encodeURIComponent(jobId)}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    let runJobId = '';
    if (response.ok && result.success && result.jobId) {
      runJobId = result.jobId;
    } else if (response.status === 409 && result.code === 'LOCK_CONFLICT' && result.activeJobId) {
      runJobId = result.activeJobId;
      showToast('Generation In Progress', 'Using active generation job for this shot.', 'info', 2500);
    } else {
      throw new Error(result.error || 'Failed to retry generation');
    }

    closeGenerationJobDetailsModal();
    const job = await trackGenerationJob(runJobId, null);
    const output = job.result || {};
    if (Array.isArray(output.images) && output.images.length > 0) {
      openGenerationChoiceModal({
        shotId: output.shotId || currentShot?.shotId || '',
        variation: output.variation || currentVariation,
        tool: 'seedream',
        images: output.images
      });
    }

    await loadShotGenerationHistory();
  } catch (err) {
    showToast('Retry failed', err.message || 'Could not retry generation', 'error', 5000);
    await loadShotGenerationHistory();
  }
}

function renderShotGenerationHistory(jobs) {
  if (!generationHistoryList) return;
  generationHistoryList.innerHTML = '';
  const list = Array.isArray(jobs) ? jobs : [];
  generationHistoryJobsById = new Map(list.map((job) => [job.jobId, job]));

  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'generation-history-empty';
    empty.textContent = 'No generation jobs yet for this shot.';
    generationHistoryList.appendChild(empty);
    return;
  }

  list.slice(0, 16).forEach((job) => {
    const status = String(job.status || '').toLowerCase();
    const variation = String(job.input?.variation || 'A').toUpperCase();
    const requireReference = Boolean(job.input?.requireReference);
    const modeLabel = requireReference ? 'Ref image' : 'First+Last';
    const duration = formatJobDuration(job);
    const refCount = Number(job.result?.referenceCount || 0);
    const refMeta = refCount > 0 ? ` · refs ${refCount}` : '';

    const item = document.createElement('div');
    item.className = `generation-history-item status-${status}`;

    const top = document.createElement('div');
    top.className = 'generation-history-top';

    const main = document.createElement('div');
    main.className = 'generation-history-main';
    main.textContent = `Var ${variation} · ${modeLabel}${refMeta}`;

    const badge = document.createElement('span');
    badge.className = `render-variation-badge variation-${/^[A-D]$/.test(variation) ? variation : 'A'}`;
    badge.textContent = status || 'unknown';

    top.appendChild(main);
    top.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = 'generation-history-meta';
    meta.textContent = `${formatJobCreatedAt(job.createdAt)}${duration ? ` · ${duration}` : ''}`;

    item.appendChild(top);
    item.appendChild(meta);

    if (status === 'failed' && job.error?.message) {
      const error = document.createElement('div');
      error.className = 'generation-history-error';
      error.textContent = job.error.message;
      item.appendChild(error);
    }

    const actions = document.createElement('div');
    actions.className = 'generation-history-actions';

    const detailsBtn = document.createElement('button');
    detailsBtn.className = 'btn btn-secondary btn-sm';
    detailsBtn.textContent = 'Details';
    detailsBtn.addEventListener('click', () => openGenerationJobDetailsModal(job.jobId));
    actions.appendChild(detailsBtn);

    if (status === 'running' || status === 'queued') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary btn-sm';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.disabled = Boolean(activeGenerationJobId && activeGenerationJobId !== job.jobId);
      cancelBtn.addEventListener('click', () => cancelGenerationJobById(job.jobId));
      actions.appendChild(cancelBtn);
    }

    if (status === 'failed' || status === 'canceled') {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn btn-secondary btn-sm';
      retryBtn.textContent = 'Retry';
      retryBtn.disabled = Boolean(activeGenerationJobId);
      retryBtn.addEventListener('click', () => retryGenerationJobFromHistory(job.jobId));
      actions.appendChild(retryBtn);
    }

    item.appendChild(actions);
    generationHistoryList.appendChild(item);
  });
}

async function loadShotGenerationHistory() {
  if (!generationHistorySection || !generationHistoryList || !currentProject || !currentShot || currentTool !== 'seedream') {
    if (generationHistorySection) generationHistorySection.style.display = 'none';
    if (generationHistoryList) generationHistoryList.innerHTML = '';
    generationHistoryJobsById = new Map();
    setGenerationHistoryAutoRefresh(false);
    return;
  }

  generationHistorySection.style.display = 'block';
  try {
    const params = new URLSearchParams({
      project: currentProject.id,
      type: 'generate-shot',
      shotId: currentShot.shotId,
      limit: '40'
    });
    const response = await fetch(`/api/generation-jobs?${params.toString()}`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to load generation history');
    }
    const jobs = result.jobs || [];
    renderShotGenerationHistory(jobs);
    const hasActive = jobs.some((job) => {
      const status = String(job.status || '').toLowerCase();
      return status === 'running' || status === 'queued';
    });
    setGenerationHistoryAutoRefresh(hasActive);
  } catch {
    renderShotGenerationHistory([]);
    setGenerationHistoryAutoRefresh(false);
  }
}

async function loadGenerationMetrics() {
  if (!currentProject) {
    generationMetricsCache = null;
    if (generationMetrics) generationMetrics.textContent = '';
    return;
  }

  try {
    const response = await fetch(`/api/generation-jobs/metrics?project=${encodeURIComponent(currentProject.id)}&limit=150`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to load generation metrics');
    }

    generationMetricsCache = result.metrics || null;
    const counts = generationMetricsCache && generationMetricsCache.counts ? generationMetricsCache.counts : null;
    if (!counts) {
      if (generationMetrics) generationMetrics.textContent = '';
      return;
    }

    const terminal = (counts.completed || 0) + (counts.failed || 0) + (counts.canceled || 0);
    const successRate = Number(generationMetricsCache.successRate || 0).toFixed(1);
    const avgDuration = Number(generationMetricsCache.avgDurationSec || 0).toFixed(1);
    const running = Number(counts.running || 0);
    const summary = terminal > 0
      ? `Gen health ${successRate}% ok · avg ${avgDuration}s · running ${running}`
      : `Gen health pending · running ${running}`;
    if (generationMetrics) {
      generationMetrics.textContent = summary;
    }
  } catch {
    generationMetricsCache = null;
    if (generationMetrics) generationMetrics.textContent = '';
  }
}

async function cancelActiveGenerationJob() {
  if (!activeGenerationJobId) return;
  if (generationCancelBtn) generationCancelBtn.disabled = true;
  try {
    await cancelGenerationJobById(activeGenerationJobId);
  } finally {
    if (generationCancelBtn) generationCancelBtn.disabled = false;
  }
}

async function fetchGenerationJobState(jobId) {
  const response = await fetch(`/api/generation-jobs/${encodeURIComponent(jobId)}`);
  const result = await response.json();
  if (!response.ok || !result.success || !result.job) {
    throw new Error(result.error || 'Failed to fetch generation job state');
  }
  return result.job;
}

async function runGenerationJob(payload, onEvent) {
  const response = await fetch('/api/generation-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  const result = await response.json();

  let jobId = '';
  if (response.ok && result.success && result.jobId) {
    jobId = result.jobId;
  } else if (response.status === 409 && result.code === 'LOCK_CONFLICT' && result.activeJobId) {
    jobId = result.activeJobId;
    showToast('Generation In Progress', 'Using active generation job for this shot.', 'info', 2500);
  } else {
    throw new Error(result.error || 'Failed to start generation job');
  }

  return trackGenerationJob(jobId, onEvent);
}

function trackGenerationJob(jobId, onEvent) {
  const resolvedJobId = String(jobId || '').trim();
  if (!resolvedJobId) {
    return Promise.reject(new Error('Invalid generation job ID'));
  }

  activeGenerationJobId = resolvedJobId;
  setGenerationControlsForActiveJob(true);
  setGenerationJobStatus(`Generation job ${resolvedJobId.slice(0, 8)} started...`, 'running');

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;
    let source = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (source) {
        source.close();
        if (generationJobEventSource === source) {
          generationJobEventSource = null;
        }
        source = null;
      }
      if (activeGenerationJobId === resolvedJobId) {
        activeGenerationJobId = null;
        setGenerationControlsForActiveJob(false);
      }
      loadGenerationMetrics();
      loadShotGenerationHistory();
    };

    const finishWithState = async () => {
      if (settled) return;
      try {
        const job = await fetchGenerationJobState(resolvedJobId);
        if (job.status === 'completed') {
          settled = true;
          setGenerationJobStatus(`Generation completed (${job.jobId.slice(0, 8)})`, 'success');
          cleanup();
          resolve(job);
          return;
        }
        if (job.status === 'failed' || job.status === 'canceled') {
          settled = true;
          const tone = job.status === 'canceled' ? '' : 'error';
          setGenerationJobStatus(
            job.status === 'canceled'
              ? `Generation canceled (${job.jobId.slice(0, 8)})`
              : `Generation failed: ${job.error?.message || 'Unknown error'}`,
            tone
          );
          cleanup();
          reject(new Error(job.error?.message || `Generation ${job.status}`));
          return;
        }
      } catch (stateErr) {
        settled = true;
        setGenerationJobStatus(`Generation error: ${stateErr.message || 'Unknown error'}`, 'error');
        cleanup();
        reject(stateErr);
      }
    };

    closeGenerationJobStream();
    source = new EventSource(`/api/generation-jobs/${encodeURIComponent(resolvedJobId)}/events`);
    generationJobEventSource = source;

    source.onmessage = (event) => {
      let evt;
      try {
        evt = JSON.parse(event.data || '{}');
      } catch {
        evt = {};
      }

      if (typeof onEvent === 'function') {
        try { onEvent(evt); } catch { /* ignore UI callback errors */ }
      }

      if (evt.event === 'job_progress') {
        const stepLabel = String(evt.step || 'running').replace(/_/g, ' ');
        const progress = Number(evt.progress);
        const progressLabel = Number.isFinite(progress) ? `${Math.max(0, Math.min(100, Math.floor(progress)))}%` : '';
        setGenerationJobStatus(`Generating: ${stepLabel}${progressLabel ? ` (${progressLabel})` : ''}`, 'running');
      } else if (evt.event === 'job_cancel_requested') {
        setGenerationJobStatus('Cancel requested...', 'running');
      }

      if (evt.event === 'job_completed' || evt.event === 'job_failed' || evt.event === 'job_canceled') {
        finishWithState();
      }
    };

    source.onerror = () => {
      // If stream drops, fall back to authoritative job state.
      finishWithState();
    };

    timeoutId = setTimeout(async () => {
      if (settled) return;
      try {
        const job = await fetchGenerationJobState(resolvedJobId);
        if (job.status === 'completed') {
          settled = true;
          cleanup();
          resolve(job);
          return;
        }
      } catch {
        // ignore and report timeout below
      }
      settled = true;
      cleanup();
      reject(new Error('Generation job timed out'));
    }, 330000);
  });
}

// Shot Generation - Generate first+last frame via Replicate
async function generateShot() {
  if (!currentShot || !currentTool || currentTool !== 'seedream') return;

  if (generateShotBtn) {
    generateShotBtn.disabled = true;
    generateShotBtn.textContent = 'Generating...';
    generateShotBtn.classList.add('generating-shot');
  }

  const loadingToastId = showToast(
    'Generating Frames...',
    `${currentShot.shotId} - Variation ${currentVariation}`,
    'info',
    0
  );

  try {
    const job = await runGenerationJob({
      type: 'generate-shot',
      projectId: currentProject.id,
      input: {
        project: currentProject.id,
        shotId: currentShot.shotId,
        variation: currentVariation,
        tool: 'seedream',
        previewOnly: true
      }
    }, (evt) => {
      if (!generateShotBtn) return;
      if (evt.event !== 'job_progress') return;
      const progress = Number(evt.progress);
      if (!Number.isFinite(progress)) return;
      generateShotBtn.textContent = `Generating ${Math.max(1, Math.min(99, Math.floor(progress)))}%...`;
    });
    const result = job.result || {};
    dismissToast(loadingToastId);

    const refNote = result.hasReferenceImage
      ? ` (with ${result.referenceSource || 'reference image'})`
      : '';
    const trimNote = result.referenceTrimmed
      ? ` · trimmed ${Number(result.trimmedReferenceCount) || 0} ref(s) for API cap`
      : '';
    showToast(
      'Preview Generated',
      `${currentShot.shotId} ${currentVariation} - ${Number(result.duration || 0).toFixed(1)}s${refNote}${trimNote}`,
      'success',
      3500
    );
    openGenerationChoiceModal({
      shotId: currentShot.shotId,
      variation: currentVariation,
      tool: 'seedream',
      images: result.images || []
    });
  } catch (err) {
    dismissToast(loadingToastId);
    showToast('Generation Error', err.message, 'error', 6000);
  } finally {
    closeGenerationJobStream();
    if (generateShotBtn) {
      generateShotBtn.disabled = false;
      generateShotBtn.textContent = 'Generate Reference Frames';
      generateShotBtn.classList.remove('generating-shot');
    }
  }
}

// Shot Generation - Generate a single image using reference input
async function generateReferencedImage() {
  if (!currentShot || !currentTool || currentTool !== 'seedream') return;

  if (generateRefImageBtn) {
    generateRefImageBtn.disabled = true;
    generateRefImageBtn.textContent = 'Generating...';
  }

  const loadingToastId = showToast(
    'Generating Referenced Image...',
    `${currentShot.shotId} - Variation ${currentVariation}`,
    'info',
    0
  );

  try {
    const job = await runGenerationJob({
      type: 'generate-shot',
      projectId: currentProject.id,
      input: {
        project: currentProject.id,
        shotId: currentShot.shotId,
        variation: currentVariation,
        tool: 'seedream',
        maxImages: 1,
        requireReference: true,
        previewOnly: true
      }
    }, (evt) => {
      if (!generateRefImageBtn) return;
      if (evt.event !== 'job_progress') return;
      const progress = Number(evt.progress);
      if (!Number.isFinite(progress)) return;
      generateRefImageBtn.textContent = `Generating ${Math.max(1, Math.min(99, Math.floor(progress)))}%...`;
    });
    const result = job.result || {};
    dismissToast(loadingToastId);

    const refNote = result.referenceSource ? ` using ${result.referenceSource}` : '';
    const trimNote = result.referenceTrimmed
      ? ` · trimmed ${Number(result.trimmedReferenceCount) || 0} ref(s)`
      : '';
    showToast(
      'Preview Generated',
      `${currentShot.shotId} ${currentVariation} - ${Number(result.duration || 0).toFixed(1)}s${refNote}${trimNote}`,
      'success',
      3500
    );
    openGenerationChoiceModal({
      shotId: currentShot.shotId,
      variation: currentVariation,
      tool: 'seedream',
      images: result.images || []
    });
  } catch (err) {
    dismissToast(loadingToastId);
    showToast('Generation Error', err.message, 'error', 6000);
  } finally {
    closeGenerationJobStream();
    if (generateRefImageBtn) {
      generateRefImageBtn.disabled = false;
      generateRefImageBtn.textContent = 'Generate Image (Ref)';
    }
  }
}

function openReplicateKeyModal() {
  if (!replicateKeyModal) return;
  if (replicateKeyInput) replicateKeyInput.value = '';
  checkGenerateStatus();
  replicateKeyModal.style.display = 'flex';
}

function closeReplicateKeyModal() {
  if (!replicateKeyModal) return;
  replicateKeyModal.style.display = 'none';
}

async function saveSessionReplicateKey() {
  const token = (replicateKeyInput && replicateKeyInput.value ? replicateKeyInput.value.trim() : '');
  if (!token) {
    showToast('Missing key', 'Enter a Replicate API key first.', 'warning', 3000);
    return;
  }

  try {
    const response = await fetch('/api/session/replicate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to update key');
    }
    await checkGenerateStatus();
    showToast('Replicate key updated', result.message || 'Session key saved', 'success', 2500);
    closeReplicateKeyModal();
    renderPrompt();
  } catch (err) {
    showToast('Replicate key update failed', err.message, 'error', 5000);
  }
}

async function clearSessionReplicateKey() {
  try {
    const response = await fetch('/api/session/replicate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '' })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to clear session key');
    }
    await checkGenerateStatus();
    showToast('Replicate session key cleared', 'Now using .env key if available.', 'info', 3000);
    renderPrompt();
  } catch (err) {
    showToast('Failed to clear key', err.message, 'error', 5000);
  }
}

function closeGenerationChoiceModal() {
  if (!generationChoiceModal) return;
  generationChoiceModal.style.display = 'none';
  if (generationChoiceGrid) generationChoiceGrid.innerHTML = '';
  pendingGeneratedPreviews = null;
}

async function saveGeneratedPreview(previewPath, frame) {
  if (!pendingGeneratedPreviews || !currentProject) return;
  try {
    const response = await fetch('/api/save-shot-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: currentProject.id,
        shotId: pendingGeneratedPreviews.shotId,
        variation: pendingGeneratedPreviews.variation,
        tool: pendingGeneratedPreviews.tool || 'seedream',
        frame,
        previewPath,
        deletePreview: true
      })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to save selected image');
    }

    pendingGeneratedPreviews.paths = pendingGeneratedPreviews.paths.filter((p) => p !== previewPath);
    showToast('Saved', `Saved as ${frame} frame`, 'success', 2500);
    await loadShotRenders();
    if (pendingGeneratedPreviews.paths.length === 0) {
      closeGenerationChoiceModal();
    } else {
      openGenerationChoiceModal({
        shotId: pendingGeneratedPreviews.shotId,
        variation: pendingGeneratedPreviews.variation,
        tool: pendingGeneratedPreviews.tool,
        images: pendingGeneratedPreviews.paths
      });
    }
  } catch (err) {
    showToast('Save failed', err.message, 'error', 4500);
  }
}

async function discardPendingGeneratedPreviews() {
  if (!pendingGeneratedPreviews || !currentProject) {
    closeGenerationChoiceModal();
    return;
  }

  try {
    await fetch('/api/discard-shot-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: currentProject.id,
        shotId: pendingGeneratedPreviews.shotId,
        previewPaths: pendingGeneratedPreviews.paths
      })
    });
  } catch {
    // Best effort cleanup
  }

  showToast('Discarded', 'Generated previews were not saved.', 'info', 2500);
  closeGenerationChoiceModal();
}

function openGenerationChoiceModal(payload) {
  if (!generationChoiceModal || !generationChoiceGrid) return;
  const images = Array.isArray(payload.images) ? payload.images.filter(Boolean) : [];
  if (images.length === 0) {
    showToast('No previews', 'No generated image was returned to review.', 'warning', 3000);
    return;
  }

  pendingGeneratedPreviews = {
    shotId: payload.shotId,
    variation: payload.variation,
    tool: payload.tool || 'seedream',
    paths: images.slice()
  };

  const projectQuery = currentProject ? `?project=${encodeURIComponent(currentProject.id)}` : '';
  generationChoiceGrid.innerHTML = '';
  if (generationChoiceMeta) {
    generationChoiceMeta.textContent = `${payload.shotId} · Variation ${payload.variation} · ${images.length} option(s)`;
  }

  images.forEach((previewPath, index) => {
    const card = document.createElement('div');
    card.className = 'shot-render-card';

    const img = document.createElement('img');
    img.className = 'shot-render-image';
    img.src = `/${previewPath}${projectQuery}`;
    img.alt = `Generated Preview ${index + 1}`;
    img.loading = 'lazy';
    img.addEventListener('click', () => window.open(img.src, '_blank'));

    const label = document.createElement('div');
    label.className = 'shot-render-label';
    label.innerHTML = `<span class="render-frame-label">Option ${index + 1}</span><span class="render-variation-badge variation-${escapeHtml(payload.variation)}">Var ${escapeHtml(payload.variation)}</span>`;

    const actions = document.createElement('div');
    actions.className = 'prompt-actions';
    actions.style.padding = '8px 12px 12px';
    actions.style.gap = '8px';

    const saveFirstBtn = document.createElement('button');
    saveFirstBtn.className = 'btn btn-primary btn-sm';
    saveFirstBtn.textContent = 'Save as First';
    saveFirstBtn.addEventListener('click', () => saveGeneratedPreview(previewPath, 'first'));

    const saveLastBtn = document.createElement('button');
    saveLastBtn.className = 'btn btn-secondary btn-sm';
    saveLastBtn.textContent = 'Save as Last';
    saveLastBtn.addEventListener('click', () => saveGeneratedPreview(previewPath, 'last'));

    actions.appendChild(saveFirstBtn);
    actions.appendChild(saveLastBtn);
    card.appendChild(img);
    card.appendChild(label);
    card.appendChild(actions);
    generationChoiceGrid.appendChild(card);
  });

  generationChoiceModal.style.display = 'flex';
}

async function autoUploadShotReferenceSet() {
  if (!currentProject || !currentShot || currentTool !== 'seedream') return;

  if (autoUploadRefSetBtn) {
    autoUploadRefSetBtn.disabled = true;
    autoUploadRefSetBtn.textContent = 'Uploading...';
  }

  const loadingToastId = showToast(
    'Uploading Reference Set...',
    `${currentShot.shotId} - Variation ${currentVariation}`,
    'info',
    0
  );

  try {
    const response = await fetch('/api/upload/shot-reference-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: currentProject.id,
        shotId: currentShot.shotId,
        variation: currentVariation,
        tool: 'seedream',
        limit: 14
      })
    });

    const result = await response.json();
    dismissToast(loadingToastId);

    if (result.success) {
      showToast(
        'Reference Set Uploaded',
        `${currentShot.shotId} ${currentVariation}: ${result.uploadedCount} image(s)`,
        'success',
        4000
      );
      await loadShotRenders();
    } else {
      showToast('Upload Failed', result.error || 'Unknown error', 'error', 5000);
    }
  } catch (err) {
    dismissToast(loadingToastId);
    showToast('Upload Failed', err.message, 'error', 5000);
  } finally {
    if (autoUploadRefSetBtn) {
      autoUploadRefSetBtn.disabled = false;
      autoUploadRefSetBtn.textContent = 'Auto-Upload Ref Set (14)';
    }
  }
}

async function loadPrevisMap() {
  if (!currentProject) return {};
  const response = await fetch(`/api/storyboard/previs-map?project=${encodeURIComponent(currentProject.id)}`);
  if (!response.ok) {
    throw new Error('Failed to load previs map');
  }
  const result = await response.json();
  previsMapCache = result.previsMap || {};
  return previsMapCache;
}

async function saveShotContinuityToggle(shotId, enabled) {
  if (!currentProject || !shotId) return;
  const entry = (previsMapCache && previsMapCache[shotId]) || {};
  const payload = {
    project: currentProject.id,
    entry: {
      sourceType: entry.sourceType || 'manual',
      sourceRef: entry.sourceRef || '',
      notes: entry.notes || '',
      locked: Boolean(entry.locked),
      continuityDisabled: !enabled
    }
  };

  const response = await fetch(`/api/storyboard/previs-map/${encodeURIComponent(shotId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to save continuity setting');
  }
  previsMapCache[shotId] = result.entry || payload.entry;
}

// Load and display existing rendered frames + upload slots for current shot
async function loadShotRenders() {
  if (!shotRenders || !shotRendersGrid) return;

  if (!currentShot || (currentTool !== 'seedream' && currentTool !== 'kling')) {
    shotRenders.style.display = 'none';
    if (shotGenerationLayout) {
      shotGenerationLayout.style.display = currentShot ? 'grid' : 'none';
      shotGenerationLayout.style.gridTemplateColumns = '1fr';
    }
    if (continuityNote) {
      continuityNote.textContent = '';
      continuityNote.classList.remove('warning');
    }
    if (refSetNote) refSetNote.textContent = '';
    if (continuityToggle) continuityToggle.disabled = true;
    if (!activeGenerationJobId) {
      setGenerationControlsForActiveJob(false);
    }
    setGenerationHistoryAutoRefresh(false);
    if (generationHistorySection) generationHistorySection.style.display = 'none';
    if (generationHistoryList) generationHistoryList.innerHTML = '';
    setGenerationJobStatus('');
    if (generationMetrics) generationMetrics.textContent = '';
    return;
  }

  try {
    const projectParam = currentProject ? currentProject.id : 'default';
    if (currentTool === 'seedream') {
      try {
        await loadPrevisMap();
      } catch (mapErr) {
        console.warn('Could not load previs map for continuity:', mapErr);
        previsMapCache = {};
      }
    }
    const response = await fetch(`/api/shot-renders?project=${projectParam}&shot=${currentShot.shotId}`);
    if (!response.ok) {
      shotRenders.style.display = 'none';
      await loadShotGenerationHistory();
      return;
    }

    const data = await response.json();
    const toolRenders = data.renders?.[currentTool] || {};

    if (shotGenerationLayout) {
      shotGenerationLayout.style.display = 'grid';
      shotGenerationLayout.style.gridTemplateColumns = '';
    }
    if (agentRunPanel) {
      agentRunPanel.style.display = 'block';
    }
    shotRenders.style.display = 'block';
    shotRendersGrid.innerHTML = '';
    if (continuityToggle) {
      continuityToggle.disabled = currentTool !== 'seedream';
    }

    const projectParam2 = currentProject ? `?project=${currentProject.id}` : '';

    // Current variation: always show 2 upload/display slots (first + last frame)
    const currentRenders = toolRenders[currentVariation] || { first: null, last: null };
    let firstPath = currentRenders.first;
    let firstSlotMeta = {
      source: currentRenders.first ? 'direct' : 'none',
      text: currentRenders.first ? 'Manual' : 'Missing',
      canDelete: true
    };

    if (currentTool === 'seedream') {
      const resolvedFirst = data.resolved?.seedream?.[currentVariation]?.first || null;
      const continuityForVariation = data.continuity?.seedream?.byVariation?.[currentVariation] || null;

      firstPath = resolvedFirst?.path || null;

      if (resolvedFirst?.source === 'inherited') {
        firstSlotMeta = {
          source: 'inherited',
          text: `Inherited ${resolvedFirst.inheritedFromShotId || ''} A last`,
          canDelete: false
        };
      } else if (resolvedFirst?.source === 'direct') {
        firstSlotMeta = {
          source: 'direct',
          text: 'Manual',
          canDelete: true
        };
      } else {
        firstSlotMeta = {
          source: 'none',
          text: 'Missing',
          canDelete: true
        };
      }

      if (continuityToggle) {
        continuityToggle.checked = !Boolean(previsMapCache?.[currentShot.shotId]?.continuityDisabled);
      }

      if (continuityNote) {
        const reason = continuityForVariation?.reason || '';
        continuityNote.classList.remove('warning');
        if (reason === 'disabled_by_shot') {
          continuityNote.textContent = 'Auto continuity disabled for this shot.';
        } else if (resolvedFirst?.source === 'inherited') {
          continuityNote.textContent = `Using ${resolvedFirst.inheritedFromShotId || 'previous shot'} variation A last frame.`;
        } else if (resolvedFirst?.source === 'direct') {
          continuityNote.textContent = 'Manual first frame override is active.';
        } else if (reason === 'missing_previous_last') {
          continuityNote.textContent = 'Missing continuity source: previous shot has no variation A last frame.';
          continuityNote.classList.add('warning');
        } else if (reason === 'no_previous_shot') {
          continuityNote.textContent = 'No previous shot found in order.';
        } else {
          continuityNote.textContent = '';
        }
      }
      if (refSetNote) {
        const refCount = Array.isArray(currentRenders.refs) ? currentRenders.refs.length : 0;
        refSetNote.textContent = refCount > 0
          ? `First-frame reference set: ${refCount}/14 image(s) attached.`
          : 'First-frame reference set: 0/14. Click "Auto-Upload Ref Set (14)" to attach references.';
      }
    } else if (continuityNote) {
      continuityNote.textContent = '';
      continuityNote.classList.remove('warning');
      if (refSetNote) refSetNote.textContent = '';
    }

    const firstSlot = createFrameUploadSlot(
      currentShot.shotId, currentVariation, 'first', currentTool,
      firstPath, projectParam2, firstSlotMeta
    );
    shotRendersGrid.appendChild(firstSlot);

    const lastSlot = createFrameUploadSlot(
      currentShot.shotId, currentVariation, 'last', currentTool,
      currentRenders.last, projectParam2, {
        source: currentRenders.last ? 'direct' : 'none',
        text: currentRenders.last ? 'Manual' : 'Missing',
        canDelete: true
      }
    );
    shotRendersGrid.appendChild(lastSlot);

    // Other variations: show read-only thumbnails if they exist
    const otherVariations = Object.keys(toolRenders).filter(v => v !== currentVariation);
    for (const variation of otherVariations) {
      const renders = toolRenders[variation];
      if (!renders) continue;

      if (renders.first) {
        const card = createRenderCard(renders.first, 'First Frame', variation, projectParam2);
        shotRendersGrid.appendChild(card);
      }
      if (renders.last) {
        const card = createRenderCard(renders.last, 'Last Frame', variation, projectParam2);
        shotRendersGrid.appendChild(card);
      }
    }

    await loadShotGenerationHistory();
    loadGenerationMetrics();

  } catch (err) {
    console.error('Failed to load shot renders:', err);
    shotRenders.style.display = 'none';
    if (shotGenerationLayout) {
      shotGenerationLayout.style.display = currentShot ? 'grid' : 'none';
      shotGenerationLayout.style.gridTemplateColumns = '1fr';
    }
    if (continuityNote) {
      continuityNote.textContent = '';
      continuityNote.classList.remove('warning');
    }
    if (refSetNote) refSetNote.textContent = '';
    await loadShotGenerationHistory();
    loadGenerationMetrics();
  }
}

/**
 * Create a frame upload slot (with image preview or empty upload placeholder)
 */
function createFrameUploadSlot(shotId, variation, frame, tool, existingPath, projectParam, meta = null) {
  const slot = document.createElement('div');
  slot.className = 'frame-upload-slot' + (existingPath ? ' has-image' : '');
  const slotMeta = meta || {
    source: existingPath ? 'direct' : 'none',
    text: existingPath ? 'Manual' : 'Missing',
    canDelete: true
  };

  if (existingPath) {
    // Show existing image with delete overlay
    const img = document.createElement('img');
    img.className = 'shot-render-image';
    img.src = `/${existingPath}${projectParam}`;
    img.alt = `${frame === 'first' ? 'First' : 'Last'} Frame - Variation ${variation}`;
    img.loading = 'lazy';
    img.addEventListener('click', () => {
      window.open(img.src, '_blank');
    });
    slot.appendChild(img);

    // Overlay with delete + replace actions
    const overlay = document.createElement('div');
    overlay.className = 'frame-slot-overlay';

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'btn btn-primary btn-sm';
    replaceBtn.textContent = 'Replace';
    replaceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerFrameUpload(shotId, variation, frame, tool);
    });

    if (slotMeta.canDelete !== false) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-secondary btn-sm';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteShotRender(shotId, variation, frame, tool);
      });
      overlay.appendChild(delBtn);
    }
    overlay.appendChild(replaceBtn);
    slot.appendChild(overlay);
  } else {
    // Empty upload placeholder
    const icon = document.createElement('div');
    icon.className = 'frame-slot-icon';
    icon.textContent = frame === 'first' ? '1' : '2';

    const label = document.createElement('div');
    label.className = 'frame-slot-label';
    label.textContent = frame === 'first' ? 'First Frame' : 'Last Frame';

    const hint = document.createElement('div');
    hint.className = 'frame-slot-hint';
    hint.textContent = 'Click or drag & drop';

    slot.appendChild(icon);
    slot.appendChild(label);
    slot.appendChild(hint);

    slot.addEventListener('click', () => {
      triggerFrameUpload(shotId, variation, frame, tool);
    });
  }

  // Drag-and-drop
  slot.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    slot.classList.add('drag-over');
  });
  slot.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    slot.classList.remove('drag-over');
  });
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    slot.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadShotFrame(shotId, variation, frame, tool, file);
  });

  // Label bar
  const labelBar = document.createElement('div');
  labelBar.className = 'shot-render-label';
  const frameLabel = frame === 'first' ? 'First Frame' : 'Last Frame';
  labelBar.innerHTML = `<span class="render-frame-label">${frameLabel}<span class="render-frame-source source-${escapeHtml(slotMeta.source || 'none')}">${escapeHtml(slotMeta.text || '')}</span></span><span class="render-variation-badge variation-${variation}">Var ${variation}</span>`;
  slot.appendChild(labelBar);

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = `frame-${shotId}-${variation}-${frame}-${tool}`;
  fileInput.accept = 'image/png,image/jpeg,image/jpg,image/webp';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', function() {
    if (this.files[0]) uploadShotFrame(shotId, variation, frame, tool, this.files[0]);
    this.value = '';
  });
  slot.appendChild(fileInput);

  return slot;
}

/**
 * Trigger the hidden file input for frame upload
 */
function triggerFrameUpload(shotId, variation, frame, tool) {
  const input = document.getElementById(`frame-${shotId}-${variation}-${frame}-${tool}`);
  if (input) input.click();
}

/**
 * Upload a shot frame image
 */
async function uploadShotFrame(shotId, variation, frame, tool, file) {
  if (!file || !currentProject) return;

  const frameLabel = frame === 'first' ? 'First Frame' : 'Last Frame';
  showToast('Uploading', `${frameLabel} for ${shotId} ${variation}...`, 'info', 2000);

  try {
    const result = await getReferenceFeature().uploadShotRenderFrame({
      projectId: currentProject.id,
      shotId,
      variation,
      frame,
      tool,
      file
    });
    if (result.ok) {
      showToast('Uploaded', `${frameLabel} uploaded`, 'success', 2000);
      await loadShotRenders();
    } else {
      showToast('Upload failed', result.error || 'Unknown error', 'error', 4000);
    }
  } catch (err) {
    showToast('Upload failed', err.message, 'error', 4000);
  }
}

/**
 * Delete a shot render
 */
async function deleteShotRender(shotId, variation, frame, tool) {
  const frameLabel = frame === 'first' ? 'First Frame' : 'Last Frame';
  if (!confirm(`Delete ${frameLabel} for ${shotId} variation ${variation}?`)) return;

  try {
    const params = new URLSearchParams({
      project: currentProject.id,
      shot: shotId,
      variation: variation,
      frame: frame,
      tool: tool
    });

    const response = await fetch(`/api/delete/shot-render?${params}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showToast('Deleted', `${frameLabel} deleted`, 'success', 2000);
      await loadShotRenders();
    } else {
      showToast('Delete failed', result.error || 'Unknown error', 'error', 4000);
    }
  } catch (err) {
    showToast('Delete failed', err.message, 'error', 4000);
  }
}

function createRenderCard(imagePath, label, variation, projectParam) {
  const card = document.createElement('div');
  card.className = 'shot-render-card';
  if (variation === currentVariation) card.classList.add('current-variation');

  const img = document.createElement('img');
  img.className = 'shot-render-image';
  img.src = `/${imagePath}${projectParam}`;
  img.alt = `${label} - Variation ${variation}`;
  img.loading = 'lazy';
  img.addEventListener('click', () => {
    window.open(img.src, '_blank');
  });

  const labelEl = document.createElement('div');
  labelEl.className = 'shot-render-label';
  labelEl.innerHTML = `<span class="render-frame-label">${escapeHtml(label)}</span><span class="render-variation-badge variation-${variation}">Var ${variation}</span>`;

  card.appendChild(img);
  card.appendChild(labelEl);
  return card;
}

let latestContextBundle = null;

function renderContextDrawer(bundle) {
  if (!contextDrawerContent) return;
  const orderList = (bundle.selectedShotOrder || [])
    .map((s) => `<li>${escapeHtml(s.shotId)} - Variation ${escapeHtml(s.selectedVariation || 'none')}</li>`)
    .join('');

  const shotsHtml = (bundle.shots || []).map((shot) => {
    const refs = (shot.references || []).map((ref) => {
      const assets = ref.assets?.length ? ` (${ref.assets.length} asset${ref.assets.length > 1 ? 's' : ''})` : '';
      return `<li>${escapeHtml(ref.type)}: ${escapeHtml(ref.name || ref.id || 'Unknown')}${escapeHtml(assets)}</li>`;
    }).join('');
    return `
      <div class="context-block">
        <h3>${escapeHtml(shot.shotId)}</h3>
        <p><strong>Script:</strong> ${escapeHtml(shot.scriptSnippet?.what || shot.scriptSnippet?.why || 'N/A')}</p>
        <p><strong>Transcript:</strong> ${escapeHtml(shot.transcriptSnippet || 'N/A')}</p>
        <ul>${refs || '<li>No references</li>'}</ul>
      </div>`;
  }).join('');

  const warnings = (bundle.warnings || []).map((w) => `<div class="context-warning">⚠ ${escapeHtml(w)}</div>`).join('');

  contextDrawerContent.innerHTML = `
    <div class="context-block">
      <h3>Selected Shot Order</h3>
      <ul>${orderList || '<li>No selected shots</li>'}</ul>
    </div>
    <div class="context-block">
      <h3>Missing Context Warnings</h3>
      ${warnings || '<div>No warnings</div>'}
    </div>
    ${shotsHtml}
  `;
}

function bundleToMarkdown(bundle) {
  const order = (bundle.selectedShotOrder || []).map((s) => `- ${s.shotId}: Variation ${s.selectedVariation || 'none'}`).join('\n');
  const warnings = (bundle.warnings || []).map((w) => `- ⚠️ ${w}`).join('\n');
  const shots = (bundle.shots || []).map((shot) => {
    const refs = (shot.references || []).map((ref) => `- ${ref.type}: ${ref.name || ref.id}`).join('\n') || '- none';
    return `### ${shot.shotId}\n- Script: ${shot.scriptSnippet?.what || shot.scriptSnippet?.why || 'N/A'}\n- Transcript: ${shot.transcriptSnippet || 'N/A'}\n- Active references:\n${refs}`;
  }).join('\n\n');

  return `## AI Context Preview\n\n### Selected shot order\n${order || '- none'}\n\n### Missing context warnings\n${warnings || '- none'}\n\n${shots}`;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function openContextDrawer() {
  if (!currentProject) return;
  try {
    const response = await fetch(`/api/export/context-bundle?project=${currentProject.id}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Failed to generate context bundle');
    latestContextBundle = data.bundle;
    renderContextDrawer(latestContextBundle);
    contextDrawerOverlay.style.display = 'block';
    contextDrawer.classList.add('open');
    contextDrawer.removeAttribute('inert');
  } catch (err) {
    showToast('Preview failed', err.message, 'error', 3500);
  }
}

function closeContextDrawer() {
  if (!contextDrawer || !contextDrawerOverlay) return;
  contextDrawer.classList.remove('open');
  contextDrawerOverlay.style.display = 'none';
  contextDrawer.setAttribute('inert', '');
}

// Wire up generate shot button
if (generateShotBtn) {
  generateShotBtn.addEventListener('click', generateShot);
}
if (generateRefImageBtn) {
  generateRefImageBtn.addEventListener('click', generateReferencedImage);
}
if (autoUploadRefSetBtn) {
  autoUploadRefSetBtn.addEventListener('click', autoUploadShotReferenceSet);
}
if (generationCancelBtn) {
  generationCancelBtn.addEventListener('click', cancelActiveGenerationJob);
}
if (refreshGenerationHistoryBtn) {
  refreshGenerationHistoryBtn.addEventListener('click', () => {
    loadShotGenerationHistory();
  });
}
if (agentGeneratePromptBtn) {
  agentGeneratePromptBtn.addEventListener('click', startAgentPromptRun);
}
if (replicateKeyBtn) {
  replicateKeyBtn.addEventListener('click', openReplicateKeyModal);
}
if (githubConnectBtn) {
  githubConnectBtn.addEventListener('click', startGitHubOAuth);
}
if (githubLogoutBtn) {
  githubLogoutBtn.addEventListener('click', logoutGitHubOAuth);
}
if (agentCancelRunBtn) {
  agentCancelRunBtn.addEventListener('click', cancelAgentRun);
}
if (agentRevertRunBtn) {
  agentRevertRunBtn.addEventListener('click', revertAgentRun);
}
if (replicateKeyModalClose) {
  replicateKeyModalClose.addEventListener('click', closeReplicateKeyModal);
}
if (replicateKeyModalOverlay) {
  replicateKeyModalOverlay.addEventListener('click', closeReplicateKeyModal);
}
if (saveReplicateKeyBtn) {
  saveReplicateKeyBtn.addEventListener('click', saveSessionReplicateKey);
}
if (clearReplicateKeyBtn) {
  clearReplicateKeyBtn.addEventListener('click', clearSessionReplicateKey);
}
if (generationChoiceModalClose) {
  generationChoiceModalClose.addEventListener('click', closeGenerationChoiceModal);
}
if (generationChoiceModalOverlay) {
  generationChoiceModalOverlay.addEventListener('click', closeGenerationChoiceModal);
}
if (closeGenerationChoiceBtn) {
  closeGenerationChoiceBtn.addEventListener('click', closeGenerationChoiceModal);
}
if (discardGeneratedBtn) {
  discardGeneratedBtn.addEventListener('click', discardPendingGeneratedPreviews);
}
if (generationJobDetailsModalClose) {
  generationJobDetailsModalClose.addEventListener('click', closeGenerationJobDetailsModal);
}
if (generationJobDetailsModalOverlay) {
  generationJobDetailsModalOverlay.addEventListener('click', closeGenerationJobDetailsModal);
}
if (generationJobDetailsCancelBtn) {
  generationJobDetailsCancelBtn.addEventListener('click', closeGenerationJobDetailsModal);
}
if (generationJobRetryDefaultBtn) {
  generationJobRetryDefaultBtn.addEventListener('click', () => {
    retryGenerationJobFromDetails(false);
  });
}
if (generationJobRetryOverrideBtn) {
  generationJobRetryOverrideBtn.addEventListener('click', () => {
    retryGenerationJobFromDetails(true);
  });
}

if (previewContextBtn) {
  previewContextBtn.addEventListener('click', openContextDrawer);
}

if (closeContextDrawerBtn) {
  closeContextDrawerBtn.addEventListener('click', closeContextDrawer);
}

if (contextDrawerOverlay) {
  contextDrawerOverlay.addEventListener('click', closeContextDrawer);
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

window.addEventListener('beforeunload', () => {
  closeAgentEventStream();
  closeGenerationJobStream();
  stopGenerationHistoryAutoRefresh();
});

// Initialize character references
async function initializeReferences() {
  if (document.getElementById('charactersReferenceList')) {
    await checkGenerateStatus();
    loadCharactersReferences();
  }
  if (document.getElementById('locationsReferenceList')) {
    loadLocationReferences();
  }
}

// Initialize
(async () => {
  const isHomePage = window.location.pathname.endsWith('/home.html') || window.location.pathname === '/';
  if (isHomePage) {
    return;
  }

  handleGitHubOAuthQueryFeedback();
  await refreshGitHubAuthStatus({ silent: true });
  updateAgentControlsForShot();

  updateToolbarContext('prompts');
  const projectsLoaded = await loadProjects();
  if (projectsLoaded) {
    // Only load prompts index on the main prompts page (index.html)
    if (shotList) {
      await loadIndex();
      // Check generate status on prompts page for shot generation
      await checkGenerateStatus();
    }
    initializeUploads();
    initializeCanon();
    initializeReferences();
    applyViewFromUrl({ updateHistory: false, replaceHistory: true });
  } else {
    // No projects yet - show message
    showEmptyState();
    showToast('No projects found', 'Run npm run migrate to initialize multi-project support', 'info', 0);
  }
})();
