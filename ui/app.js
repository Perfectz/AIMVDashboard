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
const activeGenerations = new Set();

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
const shotRenders = document.getElementById('shotRenders');
const shotRendersGrid = document.getElementById('shotRendersGrid');

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
  prompts: { url: '', title: 'Step 5: Prompts' },
  step1: { url: 'step1.html', title: 'Step 1: Theme' },
  step2: { url: 'step2.html', title: 'Step 2: Music' },
  step3: { url: 'step3.html', title: 'Step 3: Canon' },
  step4: { url: 'step4.html', title: 'Step 4: References' },
  storyboard: { url: 'storyboard.html', title: 'Step 6: Storyboard' },
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
    pageToolbarHeading.textContent = 'Prompt Review';
    pageToolbarSubtitle.textContent = 'Search, validate, copy, and generate in one place.';
    return;
  }

  pageToolbarHeading.textContent = target.title;
  pageToolbarSubtitle.textContent = 'Single-pane workspace view. Use the left navigation to switch steps.';
}

function showWorkspaceFrameLoading(message = 'Loading workspace...') {
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

function showWorkspaceError(message = 'The page could not be loaded in this panel.') {
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
    const response = await fetch('/api/projects');
    const data = await response.json();

    if (!data.success || data.projects.length === 0) {
      // No projects yet - wait for migration
      return false;
    }

    // Get active project from localStorage or use first project
    let activeId;
    try { activeId = localStorage.getItem('activeProject'); } catch { /* private browsing */ }
    activeId = activeId || data.projects[0].id;
    currentProject = data.projects.find(p => p.id === activeId) || data.projects[0];

    // Populate dropdown
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
  try { localStorage.setItem('activeProject', projectId); } catch { /* private browsing */ }
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

    // Switch to the new project
    try { localStorage.setItem('activeProject', result.project.id); } catch { /* private browsing */ }
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
  const loadingOverlay = showLoading(document.body, 'Loading prompts...');

  try {
    // Add project context to request
    const projectParam = currentProject ? `?project=${currentProject.id}` : '';
    const response = await fetch(`/prompts_index.json${projectParam}`);
    if (!response.ok) {
      throw new Error('Index file not found');
    }
    indexData = await response.json();
    updateStats();
    renderShotList();

    // Select first shot if available
    if (indexData.shots && indexData.shots.length > 0) {
      selectShot(indexData.shots[0]);
      showToast('Loaded', `${indexData.totalShots} shots loaded`, 'success', 2000);
    }
  } catch (err) {
    console.error('Failed to load index:', err);
    showEmptyState();
    showToast('No prompts found', 'Run npm run index to generate prompts', 'info', 0);
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
    all: 'All Prompts',
    kling: 'Kling 3.0',
    nanobanana: 'Nano Banana',
    suno: 'Suno',
    seedream: 'SeedDream 4.5'
  };

  const parts = [
    { label: platformNames[currentPlatform] || 'All Prompts', platform: currentPlatform },
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
    shotList.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">No shots found</p>';
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

    const shotItem = document.createElement('div');
    shotItem.className = 'shot-item';
    if (currentShot && currentShot.shotId === shot.shotId) {
      shotItem.classList.add('active');
    }

    const header = document.createElement('div');
    header.className = 'shot-item-header';
    header.textContent = shot.shotId;

    const tools = document.createElement('div');
    tools.className = 'shot-item-tools';

    if (hasKling) {
      const tag = document.createElement('span');
      tag.className = 'tool-tag kling';
      tag.textContent = `Kling (${shot.variations.kling.length})`;
      tools.appendChild(tag);
    }

    if (hasNano) {
      const tag = document.createElement('span');
      tag.className = 'tool-tag nanobanana';
      tag.textContent = `Nano (${shot.variations.nanobanana.length})`;
      tools.appendChild(tag);
    }

    if (hasSuno) {
      const tag = document.createElement('span');
      tag.className = 'tool-tag suno';
      tag.textContent = `Suno (${shot.variations.suno.length})`;
      tools.appendChild(tag);
    }

    if (hasSeedream) {
      const tag = document.createElement('span');
      tag.className = 'tool-tag seedream';
      tag.textContent = `SeedDream (${shot.variations.seedream.length})`;
      tools.appendChild(tag);
    }

    shotItem.appendChild(header);
    shotItem.appendChild(tools);
    shotItem.addEventListener('click', () => selectShot(shot));

    shotList.appendChild(shotItem);
  });
}

/**
 * Select a shot
 */
function selectShot(shot) {
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
  loadingSpinner.innerHTML = '<div class="loading-spinner-small"></div> <span>Loading prompt...</span>';
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
    promptText.textContent = 'Error loading prompt file.';
    console.error('Failed to load prompt:', err);
    showToast('Load error', `Failed to load prompt: ${err.message}`, 'error', 3000);
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

  // Load existing shot renders + upload slots for SeedDream and Kling
  if (currentTool === 'seedream' || currentTool === 'kling') {
    loadShotRenders();
  } else if (shotRenders) {
    shotRenders.style.display = 'none';
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
  copyBtn.innerHTML = 'Copy Copy Section';
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
    showToast('Copied!', 'Full prompt copied to clipboard', 'success', 2000);
  } catch (err) {
    showToast('Failed to copy', 'Could not copy prompt to clipboard', 'error', 3000);
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
    updateVariationButtons();
    renderPrompt();
  });
});

// Copy button
if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);

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
    showWorkspaceFrameLoading(`Loading ${title || 'workspace'}...`);
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
  });
});
if (promptsNavBtn) {
  promptsNavBtn.addEventListener('click', () => closeWorkspacePane());
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
async function saveTextContent(content, endpoint, statusElementId, label) {
  const statusEl = document.getElementById(statusElementId);
  if (statusEl) {
    statusEl.textContent = 'Saving...';
    statusEl.className = 'text-input-status';
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project: currentProject.id,
        content: content
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Save failed');
    }

    const result = await response.json();

    if (statusEl) {
      statusEl.textContent = `✓ Saved (${content.length} characters)`;
      statusEl.className = 'text-input-status success';
    }

    showToast('Saved successfully', `${label} saved`, 'success', 2000);
    await checkUploadStatus();

    return result;
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
      await saveTextContent(text, '/api/save/suno-prompt', 'sunoPromptTextStatus', 'Suno prompt');
    });
  }

  if (saveSongInfoBtn) {
    saveSongInfoBtn.addEventListener('click', async () => {
      const text = document.getElementById('songInfoText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter song info', 'warning', 3000);
        return;
      }
      await saveTextContent(text, '/api/save/song-info', 'songInfoTextStatus', 'Song info');
    });
  }

  if (saveAnalysisJsonBtn) {
    saveAnalysisJsonBtn.addEventListener('click', async () => {
      const text = document.getElementById('analysisJsonText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter analysis JSON', 'warning', 3000);
        return;
      }

      // Validate JSON format
      try {
        const parsed = JSON.parse(text);

        // Basic validation - check required fields
        if (!parsed.version || !parsed.duration || !parsed.bpm || !parsed.sections) {
          showToast('Invalid JSON', 'Missing required fields (version, duration, bpm, sections)', 'error', 4000);
          return;
        }

        await saveTextContent(text, '/api/save/analysis', 'analysisJsonTextStatus', 'Analysis JSON');
      } catch (err) {
        showToast('Invalid JSON', 'Please enter valid JSON format: ' + err.message, 'error', 4000);
      }
    });
  }
}

// Load saved text content (Step 2 - Music)
async function loadTextContent() {
  if (!currentProject) return;

  try {
    // Load Suno prompt
    const sunoResponse = await fetch(`/api/load/suno-prompt?project=${currentProject.id}`);
    if (sunoResponse.ok) {
      const data = await sunoResponse.json();
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
    const songInfoResponse = await fetch(`/api/load/song-info?project=${currentProject.id}`);
    if (songInfoResponse.ok) {
      const data = await songInfoResponse.json();
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
    const analysisResponse = await fetch(`/api/load/analysis?project=${currentProject.id}`);
    if (analysisResponse.ok) {
      const data = await analysisResponse.json();
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

  const contentTypes = [
    { id: 'conceptText', status: 'conceptTextStatus', endpoint: 'concept' },
    { id: 'inspirationText', status: 'inspirationTextStatus', endpoint: 'inspiration' },
    { id: 'moodText', status: 'moodTextStatus', endpoint: 'mood' },
    { id: 'genreText', status: 'genreTextStatus', endpoint: 'genre' }
  ];

  for (const type of contentTypes) {
    try {
      const response = await fetch(`/api/load/${type.endpoint}?project=${currentProject.id}`);
      if (response.ok) {
        const data = await response.json();
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
      await saveTextContent(text, '/api/save/concept', 'conceptTextStatus', 'Project concept');
    });
  }

  if (saveInspirationBtn) {
    saveInspirationBtn.addEventListener('click', async () => {
      const text = document.getElementById('inspirationText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter visual inspiration', 'warning', 3000);
        return;
      }
      await saveTextContent(text, '/api/save/inspiration', 'inspirationTextStatus', 'Visual inspiration');
    });
  }

  if (saveMoodBtn) {
    saveMoodBtn.addEventListener('click', async () => {
      const text = document.getElementById('moodText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter mood & tone', 'warning', 3000);
        return;
      }
      await saveTextContent(text, '/api/save/mood', 'moodTextStatus', 'Mood & tone');
    });
  }

  if (saveGenreBtn) {
    saveGenreBtn.addEventListener('click', async () => {
      const text = document.getElementById('genreText').value.trim();
      if (!text) {
        showToast('Error', 'Please enter genre & style', 'warning', 3000);
        return;
      }
      await saveTextContent(text, '/api/save/genre', 'genreTextStatus', 'Genre & style');
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

  const types = ['script', 'characters', 'locations', 'style', 'cinematography'];

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

async function loadCharactersReferences() {
  if (!currentProject) return;

  try {
    const response = await fetch(`/api/references/characters?project=${currentProject.id}`);
    if (response.ok) {
      const data = await response.json();
      charactersData = data.characters || [];
      renderCharactersReferences();
    }
  } catch (err) {
    console.error('Error loading character references:', err);
  }
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
function handleDragDropUpload(characterName, slotNum, file) {
  if (!file) return;
  if (!/\.(png|jpg|jpeg)$/i.test(file.name)) {
    showToast('Invalid file', 'Only PNG and JPEG images are supported', 'warning', 3000);
    return;
  }

  // Fields MUST come before file - busboy processes in order
  const formData = new FormData();
  formData.append('project', currentProject.id);
  formData.append('character', characterName);
  formData.append('slot', slotNum);
  formData.append('image', file);

  showToast('Uploading', 'Uploading reference image...', 'info', 2000);

  fetch('/api/upload/reference-image', {
    method: 'POST',
    body: formData
  })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        showToast('Uploaded', `Reference image ${slotNum} uploaded`, 'success', 2000);
        loadCharactersReferences();
      } else {
        showToast('Upload failed', result.error || 'Unknown error', 'error', 4000);
      }
    })
    .catch(err => {
      showToast('Upload failed', err.message, 'error', 4000);
    });
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

  // Fields MUST come before file - busboy processes in order
  const formData = new FormData();
  formData.append('project', currentProject.id);
  formData.append('character', characterName);
  formData.append('slot', slotNum);
  formData.append('image', file);

  try {
    showToast('Uploading', 'Uploading reference image...', 'info', 2000);

    const response = await fetch('/api/upload/reference-image', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
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
    const response = await fetch(`/api/delete/reference-image?project=${currentProject.id}&character=${characterName}&slot=${slotNum}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
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
    const response = await fetch(`/api/delete/character-reference?project=${currentProject.id}&character=${characterName}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
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
      const response = await fetch(`/api/add-character?project=${currentProject.id}&character=${encodeURIComponent(characterName)}`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
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

// AI Image Generation
async function checkGenerateStatus() {
  try {
    const response = await fetch('/api/generate-status');
    if (response.ok) {
      const data = await response.json();
      canGenerate = data.configured === true;
    }
  } catch {
    canGenerate = false;
  }
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
    const response = await fetch('/api/generate-shot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: currentProject.id,
        shotId: currentShot.shotId,
        variation: currentVariation,
        tool: 'seedream'
      })
    });

    const result = await response.json();
    dismissToast(loadingToastId);

    if (result.success) {
      const refNote = result.hasReferenceImage ? ' (with reference image)' : '';
      showToast(
        'Frames Generated',
        `${currentShot.shotId} ${currentVariation} - ${result.duration.toFixed(1)}s${refNote}`,
        'success',
        5000
      );
      await loadShotRenders();
    } else {
      showToast('Generation Failed', result.error, 'error', 6000);
    }
  } catch (err) {
    dismissToast(loadingToastId);
    showToast('Generation Error', err.message, 'error', 6000);
  } finally {
    if (generateShotBtn) {
      generateShotBtn.disabled = false;
      generateShotBtn.textContent = 'Generate First + Last Frame';
      generateShotBtn.classList.remove('generating-shot');
    }
  }
}

// Load and display existing rendered frames + upload slots for current shot
async function loadShotRenders() {
  if (!shotRenders || !shotRendersGrid) return;

  if (!currentShot || (currentTool !== 'seedream' && currentTool !== 'kling')) {
    shotRenders.style.display = 'none';
    return;
  }

  try {
    const projectParam = currentProject ? currentProject.id : 'default';
    const response = await fetch(`/api/shot-renders?project=${projectParam}&shot=${currentShot.shotId}`);
    if (!response.ok) {
      shotRenders.style.display = 'none';
      return;
    }

    const data = await response.json();
    const toolRenders = data.renders?.[currentTool] || {};

    shotRenders.style.display = 'block';
    shotRendersGrid.innerHTML = '';

    const projectParam2 = currentProject ? `?project=${currentProject.id}` : '';

    // Current variation: always show 2 upload/display slots (first + last frame)
    const currentRenders = toolRenders[currentVariation] || { first: null, last: null };

    const firstSlot = createFrameUploadSlot(
      currentShot.shotId, currentVariation, 'first', currentTool,
      currentRenders.first, projectParam2
    );
    shotRendersGrid.appendChild(firstSlot);

    const lastSlot = createFrameUploadSlot(
      currentShot.shotId, currentVariation, 'last', currentTool,
      currentRenders.last, projectParam2
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

  } catch (err) {
    console.error('Failed to load shot renders:', err);
    shotRenders.style.display = 'none';
  }
}

/**
 * Create a frame upload slot (with image preview or empty upload placeholder)
 */
function createFrameUploadSlot(shotId, variation, frame, tool, existingPath, projectParam) {
  const slot = document.createElement('div');
  slot.className = 'frame-upload-slot' + (existingPath ? ' has-image' : '');

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

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-secondary btn-sm';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteShotRender(shotId, variation, frame, tool);
    });

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'btn btn-primary btn-sm';
    replaceBtn.textContent = 'Replace';
    replaceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerFrameUpload(shotId, variation, frame, tool);
    });

    overlay.appendChild(delBtn);
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
  labelBar.innerHTML = `<span class="render-frame-label">${frameLabel}</span><span class="render-variation-badge variation-${variation}">Var ${variation}</span>`;
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

  if (!/\.(png|jpg|jpeg|webp)$/i.test(file.name)) {
    showToast('Invalid file', 'Only PNG, JPEG, and WebP images are supported', 'warning', 3000);
    return;
  }

  const formData = new FormData();
  formData.append('project', currentProject.id);
  formData.append('shot', shotId);
  formData.append('variation', variation);
  formData.append('frame', frame);
  formData.append('tool', tool);
  formData.append('image', file);

  const frameLabel = frame === 'first' ? 'First Frame' : 'Last Frame';
  showToast('Uploading', `${frameLabel} for ${shotId} ${variation}...`, 'info', 2000);

  try {
    const response = await fetch('/api/upload/shot-render', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
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

// Wire up generate shot button
if (generateShotBtn) {
  generateShotBtn.addEventListener('click', generateShot);
}

// Initialize character references
async function initializeReferences() {
  if (document.getElementById('charactersReferenceList')) {
    await checkGenerateStatus();
    loadCharactersReferences();
  }
}

// Initialize
(async () => {
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



