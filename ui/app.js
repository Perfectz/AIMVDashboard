// Prompt Compiler UI - Application Logic
// Version: 2026-02-07 (Multi-Project Support)

let indexData = null;
let currentShot = null;
let currentVariation = 'A';
let currentTool = null;
let currentPlatform = 'all';
let currentProject = null;

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

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.id = toastId;

  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Close">×</button>
    ${duration > 0 ? '<div class="toast-progress"></div>' : ''}
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => dismissToast(toastId));

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

// Stats
const statShots = document.getElementById('stat-shots');
const statPrompts = document.getElementById('stat-prompts');
const statPassed = document.getElementById('stat-passed');
const statFailed = document.getElementById('stat-failed');

// Navigation
const navItems = document.querySelectorAll('.nav-item');
const searchInput = document.getElementById('search');

// Sidebar toggle
const shotsSidebar = document.getElementById('shotsSidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const mainLayout = document.querySelector('.main-layout');

/**
 * Show loading state
 * @param {HTMLElement} container - Container to show loading in
 * @param {string} message - Loading message
 */
function showLoading(container, message = 'Loading...') {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">${message}</div>
  `;
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
    const activeId = localStorage.getItem('activeProject') || data.projects[0].id;
    currentProject = data.projects.find(p => p.id === activeId) || data.projects[0];

    // Populate dropdown
    const selector = document.getElementById('projectSelector');
    if (selector) {
      selector.innerHTML = data.projects.map(p =>
        `<option value="${p.id}" ${p.id === currentProject.id ? 'selected' : ''}>
          ${p.name}
        </option>`
      ).join('');
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

    // Switch to the new project
    localStorage.setItem('activeProject', result.project.id);
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

  statShots.textContent = indexData.totalShots || 0;
  statPrompts.textContent = indexData.totalPrompts || 0;

  const passed = indexData.allPrompts?.filter(p => p.lintStatus === 'PASS').length || 0;
  const failed = indexData.allPrompts?.filter(p => p.lintStatus === 'FAIL').length || 0;

  statPassed.textContent = passed;
  statFailed.textContent = failed;

  // Update navigation counts
  document.getElementById('nav-count-all').textContent = indexData.totalPrompts || 0;
  document.getElementById('nav-count-kling').textContent = indexData.tools?.kling || 0;
  document.getElementById('nav-count-nanobanana').textContent = indexData.tools?.nanobanana || 0;
  document.getElementById('nav-count-suno').textContent = indexData.tools?.suno || 0;
}

/**
 * Show empty state
 */
function showEmptyState() {
  emptyState.style.display = 'block';
  promptViewer.style.display = 'none';
  breadcrumbs.style.display = 'none';
}

/**
 * Hide empty state
 */
function hideEmptyState() {
  emptyState.style.display = 'none';
  promptViewer.style.display = 'block';
  breadcrumbs.style.display = 'flex';
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
    suno: 'Suno'
  };

  const parts = [
    { label: platformNames[currentPlatform] || 'All Prompts', platform: currentPlatform },
    { label: currentShot.shotId, platform: null },
  ];

  // Add variation for Kling
  if (currentTool === 'kling') {
    parts.push({ label: `Option ${currentVariation}`, platform: null });
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

    // Filter by platform
    const hasKling = shot.variations.kling && shot.variations.kling.length > 0;
    const hasNano = shot.variations.nanobanana && shot.variations.nanobanana.length > 0;
    const hasSuno = shot.variations.suno && shot.variations.suno.length > 0;

    if (currentPlatform !== 'all') {
      const platformMatch =
        (currentPlatform === 'kling' && hasKling) ||
        (currentPlatform === 'nanobanana' && hasNano) ||
        (currentPlatform === 'suno' && hasSuno);

      if (!platformMatch) {
        return;
      }
    } else {
      // For 'all', show shots that have at least one variation
      if (!hasKling && !hasNano && !hasSuno) {
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
    // Priority: Kling > Nano > Suno
    if (shot.variations.kling && shot.variations.kling.length > 0) {
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

  // For Kling, find by variation
  if (currentTool === 'kling') {
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
  if (currentTool === 'kling') {
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
    const response = await fetch(`/${prompt.path}`);
    const content = await response.text();

    // Parse and render prompt sections
    renderPromptSections(content, currentTool);
  } catch (err) {
    promptText.textContent = 'Error loading prompt file.';
    console.error('Failed to load prompt:', err);
    showToast('Load error', 'Failed to load prompt file', 'error', 3000);
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
}

/**
 * Load and display lint errors for a prompt
 */
async function loadLintErrors(promptPath) {
  try {
    const response = await fetch('/lint/report.json');
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
  buttons.forEach(btn => {
    const variation = btn.dataset.variation;
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
      { name: 'Scene Description', icon: '🎬', pattern: /^(.*?)(?=Camera:|Negative Prompt:|$)/s },
      { name: 'Camera', icon: '📷', pattern: /Camera:(.*?)(?=Negative Prompt:|$)/s },
      { name: 'Negative Prompt', icon: '🚫', pattern: /Negative Prompt:(.*?)$/s }
    ],
    nanobanana: [
      { name: 'Scene Description', icon: '🖼️', pattern: /^(.*?)(?=Style:|Negative Prompt:|$)/s },
      { name: 'Style', icon: '🎨', pattern: /Style:(.*?)(?=Negative Prompt:|$)/s },
      { name: 'Negative Prompt', icon: '🚫', pattern: /Negative Prompt:(.*?)$/s }
    ],
    suno: [
      { name: 'Full Prompt', icon: '🎵', pattern: /^(.*)$/s }
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
  header.innerHTML = `
    <div class="prompt-section-title">
      <span class="prompt-section-icon">${icon}</span>
      <span>${title}</span>
    </div>
    <span class="prompt-section-toggle">▼</span>
  `;

  const body = document.createElement('div');
  body.className = 'prompt-section-body';

  const contentEl = document.createElement('div');
  contentEl.className = 'prompt-section-content';
  contentEl.textContent = content;

  const actions = document.createElement('div');
  actions.className = 'prompt-section-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-small';
  copyBtn.innerHTML = '📋 Copy Section';
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
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
    await navigator.clipboard.writeText(fullText.trim());
    showToast('Copied!', 'Full prompt copied to clipboard', 'success', 2000);
  } catch (err) {
    showToast('Failed to copy', 'Could not copy prompt to clipboard', 'error', 3000);
  }
}

// Event Listeners

// Navigation
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const platform = item.dataset.platform;

    // Handle storyboard navigation
    if (platform === 'storyboard') {
      window.location.href = 'storyboard.html';
      return;
    }

    currentPlatform = platform;

    // Update active state
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    // Re-render shot list
    renderShotList();
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
copyBtn.addEventListener('click', copyToClipboard);

// Search
searchInput.addEventListener('input', renderShotList);

// Sidebar toggle
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

// Project selector
const projectSelector = document.getElementById('projectSelector');
if (projectSelector) {
  projectSelector.addEventListener('change', (e) => {
    switchProject(e.target.value);
  });
}

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

// Initialize
(async () => {
  const projectsLoaded = await loadProjects();
  if (projectsLoaded) {
    await loadIndex();
  } else {
    // No projects yet - show message
    showEmptyState();
    showToast('No projects found', 'Run npm run migrate to initialize multi-project support', 'info', 0);
  }
})();
