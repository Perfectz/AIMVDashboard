// Prompt Compiler UI - Application Logic
// Version: 2026-02-07 (Multi-Project Support)
// Refactored: Functions extracted to ui/modules/ (Phase 6 architecture)

// ========================================
// State Management
// ========================================

const appState = window.AppState && typeof window.AppState.get === 'function' && typeof window.AppState.set === 'function'
  ? window.AppState
  : null;
if (!appState) {
  throw new Error('AppState is unavailable. Ensure ui/modules/state.js is loaded before app.js');
}
const stateDefaults = {
  'indexData': null,
  'currentShot': null,
  'currentVariation': 'A',
  'currentTool': null,
  'currentPlatform': 'all',
  'currentLintFilter': 'all',
  'currentProject': null,
  'canGenerate': false,
  'generateTokenSource': 'none',
  'previsMapCache': {},
  'pendingGeneratedPreviews': null,
  'githubAuthState': { connected: false, username: '', scopes: [], tokenSource: 'none' },
  'agentActiveRunId': null,
  'agentEventSource': null,
  'agentRunCache': null,
  'generationJobEventSource': null,
  'activeGenerationJobId': null,
  'generationMetricsCache': null,
  'generationHistoryAutoRefreshTimer': null,
  'generationHistoryRefreshInFlight': false,
  'generationHistoryJobsById': new Map(),
  'generationDetailsJobId': null,
  'shotPreflightCache': new Map(),
  'lastShotPreflight': null,
  'searchDebounceTimer': null,
  'cachedPromptContent': {}
};

Object.keys(stateDefaults).forEach((key) => {
  if (typeof appState.get(key) === 'undefined') {
    appState.set(key, stateDefaults[key]);
  }
});

function createStateScope(keys) {
  const scope = {};
  keys.forEach((key) => {
    Object.defineProperty(scope, key, {
      enumerable: true,
      configurable: false,
      get() {
        return appState.get(key);
      },
      set(value) {
        appState.set(key, value);
      }
    });
  });
  return scope;
}

const projectState = createStateScope([
  'currentProject'
]);

const promptsState = createStateScope([
  'indexData',
  'currentShot',
  'currentVariation',
  'currentTool',
  'currentPlatform',
  'currentLintFilter',
  'searchDebounceTimer',
  'cachedPromptContent'
]);

const generationState = createStateScope([
  'canGenerate',
  'generateTokenSource',
  'pendingGeneratedPreviews',
  'generationJobEventSource',
  'activeGenerationJobId',
  'generationMetricsCache',
  'generationHistoryAutoRefreshTimer',
  'generationHistoryRefreshInFlight',
  'generationHistoryJobsById',
  'generationDetailsJobId',
  'shotPreflightCache',
  'lastShotPreflight'
]);

const agentState = createStateScope([
  'githubAuthState',
  'agentActiveRunId',
  'agentEventSource',
  'agentRunCache'
]);

const reviewState = createStateScope([
  'previsMapCache'
]);

const appDeps = window.AppDeps && window.AppDeps.createAppDeps
  ? window.AppDeps.createAppDeps({ windowRef: window })
  : null;
const projectContext = window.ProjectContext || null;
const projectActions = window.ProjectActions || null;

function requireProjectContext() {
  if (!projectContext || typeof projectContext.getProjectIdFromQuery !== 'function' || typeof projectContext.navigateWithProject !== 'function') {
    throw new Error('ProjectContext is unavailable. Ensure ui/modules/project-context.js is loaded before app.js');
  }
  return projectContext;
}

function requireAppDeps() {
  if (!appDeps) {
    throw new Error('App dependency module is unavailable. Ensure ui/controllers/app-deps.js is loaded before app.js');
  }
  return appDeps;
}

// ========================================
// Legacy Service Factories
// ========================================

let referenceLibraryService = null;
let bootstrapService = null;
let contextBundleService = null;
let generationReadinessService = null;

const shotFlowStore = window.ShotFlowState && typeof window.ShotFlowState.createShotFlowStore === 'function'
  ? window.ShotFlowState.createShotFlowStore({
      variation: promptsState.currentVariation || 'A',
      tool: promptsState.currentTool || '',
      shotId: promptsState.currentShot && promptsState.currentShot.shotId ? promptsState.currentShot.shotId : ''
    })
  : null;
if (shotFlowStore) {
  window.__shotFlowStore = shotFlowStore;
}

function dispatchShotFlowEvent(type, payload) {
  if (!shotFlowStore || typeof shotFlowStore.dispatch !== 'function') return;
  shotFlowStore.dispatch({ type, payload: payload || {} });
}


function getReferenceUploadService() {
  return requireAppDeps().getReferenceUploadService();
}

function getBootstrapService() {
  if (bootstrapService) return bootstrapService;
  if (!window.BootstrapService || !window.BootstrapService.createBootstrapService) {
    return null;
  }
  bootstrapService = window.BootstrapService.createBootstrapService();
  return bootstrapService;
}

function getReferenceLibraryService() {
  if (referenceLibraryService) return referenceLibraryService;
  if (!window.ReferenceLibraryService || !window.ReferenceLibraryService.createReferenceLibraryService) {
    throw new Error('ReferenceLibraryService.createReferenceLibraryService is required. Ensure ui/services/reference-library-service.js is loaded before app.js');
  }
  referenceLibraryService = window.ReferenceLibraryService.createReferenceLibraryService();
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

function getContextBundleService() {
  if (contextBundleService) return contextBundleService;
  if (!window.ContextBundleService || !window.ContextBundleService.createContextBundleService) {
    throw new Error('ContextBundleService.createContextBundleService is required');
  }
  contextBundleService = window.ContextBundleService.createContextBundleService();
  return contextBundleService;
}

function getGenerationReadinessService() {
  if (generationReadinessService) return generationReadinessService;
  if (!window.GenerationReadinessService || !window.GenerationReadinessService.createGenerationReadinessService) {
    throw new Error('GenerationReadinessService.createGenerationReadinessService is required');
  }
  generationReadinessService = window.GenerationReadinessService.createGenerationReadinessService();
  return generationReadinessService;
}

// ========================================
// Module Imports (from ui/modules/)
// ========================================

// Shared utilities (from modules/shared-utils.js)
const { escapeHtml, copyText, showToast, dismissToast, showLoading, hideLoading, renderContextDrawer, bundleToMarkdown, downloadJson } = window.SharedUtils;

// PromptViewer module
const {
  PLATFORM_LABELS,
  getShotLintState,
  getFilteredShots: getFilteredShotsFromModule,
  renderShotList: renderShotListFromModule,
  getCurrentPrompt: getCurrentPromptFromModule,
  updateVariationButtons: updateVariationButtonsFromModule,
  renderPromptSections,
  createPromptSection,
  loadLintErrors: loadLintErrorsFromModule,
  copyToClipboard
} = window.PromptViewer;

// GenerationWorkflow module
const { closeGenerationJobStream, stopGenerationHistoryAutoRefresh, generateShot, generateImage, generateReferencedImage, runGenerationJob, trackGenerationJob, loadShotRenders, createFrameUploadSlot, openGenerationChoiceModal, closeGenerationChoiceModal, openReplicateKeyModal, closeReplicateKeyModal, saveSessionReplicateKey, clearSessionReplicateKey, loadPrevisMap, loadShotGenerationHistory, loadGenerationMetrics, openGenerationJobDetailsModal, closeGenerationJobDetailsModal, cancelActiveGenerationJob, cancelGenerationJobById, retryGenerationJobFromHistory, retryGenerationJobFromDetails, discardPendingGeneratedPreviews, saveGeneratedPreview, setGenerationJobStatus, setGenerationControlsForActiveJob, saveVariationChosen, loadVariationChosenState, saveSelectedReferences, refSelectAll, refClearAll } = window.GenerationWorkflow;

// AgentIntegration module
const { checkGenerateStatus, isTerminalRunStatus, closeAgentEventStream, resetAgentRunUI, appendAgentLogLine, updateGitHubAuthUI, updateAgentControlsForShot, renderAgentRunFiles, renderAgentRunState, refreshGitHubAuthStatus, startGitHubOAuth, logoutGitHubOAuth, fetchAgentRunState, connectAgentRunEvents, startAgentPromptRun, cancelAgentRun, revertAgentRun, handleGitHubOAuthQueryFeedback } = window.AgentIntegration;

// ReferenceManager module
const { loadCharactersReferences, loadLocationReferences, renderCharactersReferences, renderLocationReferences, buildImageSlot, buildLocationImageSlot, handleDragDropUpload, openReferenceImageUpload, handleReferenceImageUpload, deleteReferenceImage, deleteCharacterReference, PROMPT_SLOT_LABELS } = window.ReferenceManager;

// CanonEditor module
const { setupCanonTabs, normalizeShotLinks, normalizeScriptData, parseScriptJsonFromEditor, getTranscriptBlocksFromScriptData, jumpToTranscriptSegment, renderTranscriptBlocks, renderShotCards, syncScriptEditorViews, buildScriptJsonFromViews, setupCanonShortcutLinks, setupPipelineActions } = window.CanonEditor;

function getFilteredShots() {
  return getFilteredShotsFromModule(promptsState);
}

function renderShotList() {
  return renderShotListFromModule(promptsState, selectShot);
}

function getCurrentPrompt() {
  return getCurrentPromptFromModule(promptsState);
}

function updateVariationButtons() {
  return updateVariationButtonsFromModule(promptsState);
}

function loadLintErrors(promptPath) {
  return loadLintErrorsFromModule(promptPath, projectState);
}

// Initialize modules that require dependency injection
window.GenerationWorkflow.init({
  getReferenceFeature,
  renderPrompt: () => renderPrompt()
});

window.AgentIntegration.init({
  loadIndex: () => loadIndex()
});
window.AgentIntegration.initAiProviderModal();

window.ReferenceManager.init({
  getReferenceLibraryService: () => getReferenceLibraryService(),
  getReferenceFeature: () => getReferenceFeature(),
  getGenerationState: () => generationState
});

// ========================================
// DOM Elements
// ========================================

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
const referenceSelector = document.getElementById('referenceSelector');
const referenceSelectorList = document.getElementById('referenceSelectorList');
const refSelectAllBtn = document.getElementById('refSelectAllBtn');
const refClearAllBtn = document.getElementById('refClearAllBtn');
const referenceSelectorCount = document.getElementById('referenceSelectorCount');
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
const continuityNote = document.getElementById('continuityNote');
const variationChosenCheckbox = document.getElementById('variationChosenCheckbox');
const variationChosenLabel = document.getElementById('variationChosenLabel');
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
const quickAcceptGeneratedBtn = document.getElementById('quickAcceptGeneratedBtn');
const quickAcceptAndNextBtn = document.getElementById('quickAcceptAndNextBtn');
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

// Unified prompt view
const imagePromptBlock = document.getElementById('imagePromptBlock');
const imagePromptContent = document.getElementById('imagePromptContent');
const videoPromptBlock = document.getElementById('videoPromptBlock');
const videoPromptContent = document.getElementById('videoPromptContent');

// Stats
const statShots = document.getElementById('stat-shots');
const statReady = document.getElementById('stat-ready');
const statPassed = document.getElementById('stat-passed');
const statFailed = document.getElementById('stat-failed');

// Navigation
const platformFilter = document.getElementById('platformFilter');
const shotSelector = document.getElementById('shotSelector');
const toggleShotListBtn = document.getElementById('toggleShotListBtn');
const shotListPanel = document.getElementById('shotListPanel');
const searchInput = document.getElementById('search');
const lintFilter = document.getElementById('lintFilter');
const mobileNavToggle = document.getElementById('mobileNavToggle');
const mobilePanelOverlay = document.getElementById('mobilePanelOverlay');
const pageToolbarHeading = document.getElementById('pageToolbarHeading');
const pageToolbarSubtitle = document.getElementById('pageToolbarSubtitle');

// Sidebar toggle
const mainLayout = document.querySelector('.main-layout');
const emptyRunIndexBtn = document.getElementById('emptyRunIndex');
const emptyOpenGuideBtn = document.getElementById('emptyOpenGuide');
const promptContent = document.getElementById('promptContent');
const toggleAdvancedActionsBtn = document.getElementById('toggleAdvancedActionsBtn');
const advancedActionsPanel = document.getElementById('advancedActionsPanel');
const shotReadiness = document.getElementById('shotReadiness');
const refreshReadinessBtn = document.getElementById('refreshReadinessBtn');
const readinessReplicate = document.getElementById('readinessReplicate');
const readinessPrompt = document.getElementById('readinessPrompt');
const readinessContinuity = document.getElementById('readinessContinuity');
const readinessRefs = document.getElementById('readinessRefs');
const readinessMessage = document.getElementById('readinessMessage');
const referenceProvenance = document.getElementById('referenceProvenance');

// App-level state
let cachedReadyShotCount = 0;
const isEmbeddedWorkspacePage = new URLSearchParams(window.location.search).get('embedded') === '1';
if (isEmbeddedWorkspacePage) {
  document.body.classList.add('embedded-mode');
}

// ========================================
// Project Management
// ========================================

async function loadProjects() {
  try {
    const feature = getProjectFeature();
    const projectFromQuery = requireProjectContext().getProjectIdFromQuery();
    if (projectFromQuery) {
      feature.setActiveProjectId(projectFromQuery);
    }
    const storedProjectId = feature.getActiveProjectId ? feature.getActiveProjectId() : '';
    let projects = [];
    let currentProject = null;

    const bootstrap = getBootstrapService();
    if (bootstrap) {
      const bootResult = await bootstrap.loadBootstrap({
        projectId: projectFromQuery || storedProjectId,
        pageId: detectPageChatPageId() || 'index'
      });
      if (bootResult.ok && bootResult.data && Array.isArray(bootResult.data.projects) && bootResult.data.projects.length > 0) {
        projects = bootResult.data.projects;
        currentProject = bootResult.data.currentProject || projects[0];
      }
    }

    if (!currentProject || projects.length === 0) {
      const result = await feature.loadProjects();
      if (!result.ok || !result.projects || result.projects.length === 0) {
        return false;
      }
      projects = result.projects;
      currentProject = result.currentProject;
    }

    projectState.currentProject = currentProject;
    if (projectState.currentProject && projectState.currentProject.id) {
      feature.setActiveProjectId(projectState.currentProject.id);
    }

    const selector = document.getElementById('projectSelector');
    if (selector) {
      selector.innerHTML = '';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        opt.selected = p.id === projectState.currentProject.id;
        selector.appendChild(opt);
      });
    }

    return true;
  } catch (err) {
    /* silently handled */
    return false;
  }
}

async function switchProject(projectId) {
  const nextProjectId = String(projectId || '').trim();
  if (!nextProjectId) return;
  getProjectFeature().setActiveProjectId(nextProjectId);
  requireProjectContext().navigateWithProject(nextProjectId);
}

async function createNewProject(name, description) {
  try {
    const result = await getProjectFeature().createProject({ name, description });
    if (!result.ok || !result.project) {
      throw new Error(result.error || 'Failed to create project');
    }
    requireProjectContext().navigateWithProject(result.project.id);
  } catch (err) {
    throw err;
  }
}

async function deleteActiveProject(projectId) {
  try {
    const feature = getProjectFeature();
    const result = await feature.deleteProject(projectId);
    if (!result.ok) {
      throw new Error(result.error || 'Failed to delete project');
    }

    const projectsResult = await feature.loadProjects();
    if (projectsResult.ok && projectsResult.currentProject && projectsResult.currentProject.id) {
      feature.setActiveProjectId(projectsResult.currentProject.id);
      requireProjectContext().navigateWithProject(projectsResult.currentProject.id);
    } else {
      feature.setActiveProjectId('');
      requireProjectContext().navigateWithProject('');
    }
  } catch (err) {
    throw err;
  }
}

// ========================================
// Shot & Prompt Loading
// ========================================

async function loadIndex() {
  const loadingOverlay = showLoading(document.body, 'Loading shots...');

  try {
    const projectParam = projectState.currentProject ? `?project=${projectState.currentProject.id}` : '';
    const response = await fetch(`/prompts_index.json${projectParam}`);
    if (!response.ok) {
      throw new Error('Index file not found');
    }
    promptsState.indexData = await response.json();
    reviewState.previsMapCache = {};
    generationState.shotPreflightCache = new Map();
    generationState.lastShotPreflight = null;
    await refreshReadyShotCount();
    updateStats();
    if (platformFilter) platformFilter.value = promptsState.currentPlatform || 'all';
    if (lintFilter) lintFilter.value = promptsState.currentLintFilter || 'all';
    renderShotList();

    const initialShots = getFilteredShots();
    if (initialShots.length > 0) {
      selectShot(initialShots[0]);
      showToast('Loaded', `${promptsState.indexData.totalShots} shots ready for review`, 'success', 2000);
    }
  } catch (err) {
    showEmptyState();
    showToast('No shots found', 'Run npm run index to refresh shot files', 'info', 0);
  } finally {
    hideLoading(loadingOverlay);
  }
}

function shotHasStoryboardRender(shot) {
  if (!shot || typeof shot !== 'object') return false;
  if (shot.previewPath || shot.previewImage || shot.previewVideo) return true;
  const renderFiles = shot.renderFiles || {};
  if (renderFiles.thumbnail) return true;
  if (renderFiles.kling && Object.keys(renderFiles.kling).length > 0) return true;
  if (renderFiles.nanobanana && Object.keys(renderFiles.nanobanana).length > 0) return true;
  if (renderFiles.nano && Object.keys(renderFiles.nano).length > 0) return true;
  if (renderFiles.seedream && Object.keys(renderFiles.seedream).length > 0) return true;
  return false;
}

function shotIsReadyForReview(shot) {
  if (!shot) return false;
  const selected = shot.selectedVariation && shot.selectedVariation !== 'none';
  return Boolean(selected && shotHasStoryboardRender(shot));
}

async function refreshReadyShotCount() {
  cachedReadyShotCount = 0;
  if (!projectState.currentProject) return cachedReadyShotCount;

  try {
    const projectParam = encodeURIComponent(projectState.currentProject.id);
    const response = await fetch(`/api/review/sequence?project=${projectParam}`);
    const data = await response.json();
    if (!response.ok || !data || !Array.isArray(data.selections)) {
      return cachedReadyShotCount;
    }
    cachedReadyShotCount = data.selections.filter(shotIsReadyForReview).length;
  } catch (err) {
    /* silently handled */
    cachedReadyShotCount = 0;
  }
  return cachedReadyShotCount;
}

function updateStats() {
  if (!promptsState.indexData) return;

  if (statShots) statShots.textContent = promptsState.indexData.totalShots || 0;
  if (statReady) statReady.textContent = cachedReadyShotCount || 0;

  const passed = promptsState.indexData.allPrompts?.filter((prompt) => prompt.lintStatus === 'PASS').length || 0;
  const failed = promptsState.indexData.allPrompts?.filter((prompt) => prompt.lintStatus === 'FAIL').length || 0;

  if (statPassed) statPassed.textContent = passed;
  if (statFailed) statFailed.textContent = failed;

  const countAll = document.getElementById('nav-count-all');
  if (countAll) countAll.textContent = promptsState.indexData.totalPrompts || 0;
}

function showEmptyState() {
  if (emptyState) emptyState.style.display = 'block';
  if (promptViewer) promptViewer.style.display = 'none';
  if (breadcrumbs) breadcrumbs.style.display = 'none';
}

function hideEmptyState() {
  if (emptyState) emptyState.style.display = 'none';
  if (promptViewer) promptViewer.style.display = 'block';
  if (breadcrumbs) breadcrumbs.style.display = 'flex';
}

function updateBreadcrumbs() {
  if (!promptsState.currentShot || !promptsState.currentTool) {
    breadcrumbs.style.display = 'none';
    return;
  }

  const parts = [
    { label: 'Step 5: Shots' },
    { label: promptsState.currentShot.shotId },
    { label: `Variation ${promptsState.currentVariation}` }
  ];

  breadcrumbs.innerHTML = '';

  parts.forEach((part, index) => {
    const item = document.createElement('div');
    item.className = 'breadcrumb-item';

    if (index > 0) {
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '\u203a';
      breadcrumbs.appendChild(separator);
    }
    item.textContent = part.label;

    breadcrumbs.appendChild(item);
  });

  breadcrumbs.style.display = 'flex';
}

// ========================================
// Image / Video Tool Helpers
// ========================================

/**
 * Check if a tool name is an image generation tool.
 */
function isImageTool(tool) {
  return tool === 'seedream' || tool === 'nanobanana';
}

/**
 * Determine the active image tool for a shot (seedream preferred, then nanobanana).
 */
function getImageToolForShot(shot) {
  if (!shot) return null;
  if (shot.variations.seedream && shot.variations.seedream.length > 0) return 'seedream';
  if (shot.variations.nanobanana && shot.variations.nanobanana.length > 0) return 'nanobanana';
  return null;
}

/**
 * Fetch prompt content for a specific tool+variation, using cache when available.
 */
async function fetchPromptContent(tool, variation) {
  const shot = promptsState.currentShot;
  if (!shot) return null;

  // Check cache first
  const cached = promptsState.cachedPromptContent[tool]
    && promptsState.cachedPromptContent[tool][variation];
  if (cached) return cached;

  // Find the prompt in the shot's variations
  const prompts = shot.variations[tool];
  if (!prompts || prompts.length === 0) return null;
  const prompt = prompts.find(p => p.variation === variation) || prompts[0];
  if (!prompt || !prompt.path) return null;

  const projectParam = projectState.currentProject ? `?project=${projectState.currentProject.id}` : '';
  try {
    const response = await fetch(`/${prompt.path}${projectParam}`);
    if (!response.ok) return null;
    const content = await response.text();
    // Cache it
    if (!promptsState.cachedPromptContent[tool]) {
      promptsState.cachedPromptContent[tool] = {};
    }
    promptsState.cachedPromptContent[tool][variation] = content;
    return content;
  } catch {
    return null;
  }
}

// ========================================
// Shot Selection & Prompt Rendering
// ========================================

function selectShot(shot) {
  const previousShotId = promptsState.currentShot ? promptsState.currentShot.shotId : '';
  promptsState.currentShot = shot;
  promptsState.currentVariation = 'A';

  document.querySelectorAll('.shot-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.shotId === shot.shotId) {
      item.classList.add('active');
    }
  });
  if (shotSelector) {
    shotSelector.value = shot.shotId;
  }
  if (advancedActionsPanel && toggleAdvancedActionsBtn) {
    advancedActionsPanel.style.display = 'none';
    toggleAdvancedActionsBtn.textContent = 'Show Advanced';
  }
  if (referenceProvenance) {
    referenceProvenance.style.display = 'none';
    referenceProvenance.textContent = '';
  }
  generationState.lastShotPreflight = null;

  // Clear prompt content cache on shot change
  promptsState.cachedPromptContent = {};

  // Set currentTool to image tool (for generation features); fallback to kling
  const imageTool = getImageToolForShot(shot);
  if (imageTool) {
    promptsState.currentTool = imageTool;
  } else if (shot.variations.kling && shot.variations.kling.length > 0) {
    promptsState.currentTool = 'kling';
  } else {
    promptsState.currentTool = null;
  }

  if (!previousShotId || previousShotId !== promptsState.currentShot.shotId) {
    resetAgentRunUI({ clearLog: true });
  }
  dispatchShotFlowEvent('SHOT_SELECTED', {
    shotId: shot && shot.shotId ? shot.shotId : '',
    variation: 'A',
    tool: promptsState.currentTool || ''
  });
  updateAgentControlsForShot();
  renderPrompt();
}

async function renderPrompt() {
  const shot = promptsState.currentShot;
  if (!shot || !promptsState.currentTool) {
    resetAgentRunUI({ clearLog: true });
    updateAgentControlsForShot();
    showEmptyState();
    return;
  }

  hideEmptyState();

  const imageTool = getImageToolForShot(shot);
  const hasKling = shot.variations.kling && shot.variations.kling.length > 0;
  const variation = promptsState.currentVariation;

  // Header
  promptTitle.textContent = shot.shotId;
  const badges = [];
  if (imageTool) badges.push('IMAGE');
  if (hasKling) badges.push('VIDEO');
  promptTool.textContent = badges.join(' + ') || '';
  promptTool.className = 'tool-badge image';

  // Lint status from the image prompt (primary)
  const prompt = getCurrentPrompt();
  if (prompt) {
    promptLintStatus.textContent = prompt.lintStatus || 'UNKNOWN';
    promptLintStatus.className = `lint-status ${prompt.lintStatus || 'UNKNOWN'}`;
  }

  // Variation selector
  variationSelector.style.display = 'flex';
  updateVariationButtons();

  // --- Render Image Prompt block ---
  if (imageTool && imagePromptBlock && imagePromptContent) {
    imagePromptBlock.style.display = 'block';
    imagePromptContent.textContent = '';

    const imageContent = await fetchPromptContent(imageTool, variation);
    if (imageContent) {
      renderPromptSections(imageContent, imageTool, imagePromptContent);
    } else {
      imagePromptContent.textContent = 'No image prompt available for this variation.';
    }
  } else if (imagePromptBlock) {
    imagePromptBlock.style.display = 'none';
  }

  // --- Render frames (between image and video prompts) ---
  if (imageTool && promptsState.currentTool === 'seedream') {
    await loadShotRenders();
  } else {
    if (shotRenders) shotRenders.style.display = 'none';
    if (shotGenerationLayout) {
      shotGenerationLayout.style.display = shot ? 'grid' : 'none';
      shotGenerationLayout.style.gridTemplateColumns = '1fr';
    }
    if (continuityNote) { continuityNote.textContent = ''; continuityNote.classList.remove('warning'); }
    if (referenceSelector) referenceSelector.style.display = 'none';
  }

  // --- Render Video Prompt block ---
  if (hasKling && videoPromptBlock && videoPromptContent) {
    videoPromptBlock.style.display = 'block';
    videoPromptContent.textContent = '';

    const videoContent = await fetchPromptContent('kling', variation);
    if (videoContent) {
      renderPromptSections(videoContent, 'kling', videoPromptContent);
    } else {
      videoPromptContent.textContent = 'No video prompt available for this variation.';
    }
  } else if (videoPromptBlock) {
    videoPromptBlock.style.display = 'none';
  }

  // Prompt info (show image prompt file if available, else kling)
  if (prompt) {
    promptFile.textContent = prompt.path;
    if (prompt.version) {
      promptVersion.textContent = prompt.version;
      promptVersionRow.style.display = 'block';
    } else {
      promptVersionRow.style.display = 'none';
    }
    if (prompt.lintErrors > 0) {
      lintErrorsRow.style.display = 'block';
      loadLintErrors(prompt.path);
    } else {
      lintErrorsRow.style.display = 'none';
    }
  }

  updateBreadcrumbs();

  // Generation features (seedream only)
  if (shotReadiness) {
    shotReadiness.style.display = promptsState.currentTool === 'seedream' ? 'block' : 'none';
  }
  if (generateShotBtn) {
    generateShotBtn.style.display = promptsState.currentTool === 'seedream' ? 'inline-flex' : 'none';
  }
  if (generateRefImageBtn) {
    generateRefImageBtn.style.display = promptsState.currentTool === 'seedream' ? 'inline-flex' : 'none';
  }
  if (agentGeneratePromptBtn) {
    agentGeneratePromptBtn.style.display = promptsState.currentTool ? 'inline-flex' : 'none';
  }
  if (referenceProvenance) {
    referenceProvenance.style.display = 'none';
    referenceProvenance.textContent = '';
  }

  updateAgentControlsForShot();

  // Generation history + metrics
  if (promptsState.currentTool === 'seedream' || hasKling) {
    await loadShotGenerationHistory();
    loadGenerationMetrics();
    loadVariationChosenState();
  } else {
    clearShotReadinessView();
  }
}

// ========================================
// Shot Readiness Helpers
// ========================================

function getShotPreflightCache() {
  let cache = generationState.shotPreflightCache;
  if (!(cache instanceof Map)) {
    cache = new Map();
    generationState.shotPreflightCache = cache;
  }
  return cache;
}

function getCurrentPreflightCacheKey() {
  if (!projectState.currentProject || !promptsState.currentShot || promptsState.currentTool !== 'seedream') return '';
  return [
    projectState.currentProject.id,
    promptsState.currentShot.shotId,
    promptsState.currentVariation,
    promptsState.currentTool
  ].join(':');
}

function clearCurrentShotPreflightCache() {
  const key = getCurrentPreflightCacheKey();
  if (!key) return;
  getShotPreflightCache().delete(key);
}

function setReadinessPill(element, tone, text) {
  if (!element) return;
  element.classList.remove('good', 'warn', 'bad', 'pending');
  element.classList.add(tone || 'pending');
  element.textContent = text || 'unknown';
}

function clearShotReadinessView() {
  setReadinessPill(readinessReplicate, 'pending', 'Replicate: unknown');
  setReadinessPill(readinessPrompt, 'pending', 'Prompt: unknown');
  setReadinessPill(readinessContinuity, 'pending', 'Continuity: unknown');
  setReadinessPill(readinessRefs, 'pending', 'References: unknown');
  if (readinessMessage) readinessMessage.textContent = '';
}

function renderShotGenerationPreflight(preflight) {
  if (!preflight || !preflight.readiness) {
    clearShotReadinessView();
    dispatchShotFlowEvent('PREFLIGHT_LOADED', { readiness: null, continuity: null });
    return;
  }
  const readiness = preflight.readiness;
  const continuity = readiness.continuity || {};
  const continuitySource = continuity.source || 'none';
  const refsTotal = Number(readiness.uploadedRefSetCount || 0) + Number(readiness.autoCollectableRefCount || 0) + (continuity.path ? 1 : 0);

  setReadinessPill(
    readinessReplicate,
    readiness.replicateConfigured ? 'good' : 'bad',
    readiness.replicateConfigured ? 'Replicate: configured' : 'Replicate: missing key'
  );
  setReadinessPill(
    readinessPrompt,
    readiness.promptFound ? 'good' : 'bad',
    readiness.promptFound ? 'Prompt: found' : 'Prompt: missing'
  );
  setReadinessPill(
    readinessContinuity,
    continuitySource === 'inherited' || continuitySource === 'direct' ? 'good' : 'warn',
    continuitySource === 'inherited'
      ? 'Continuity: inherited'
      : continuitySource === 'direct'
        ? 'Continuity: manual'
        : 'Continuity: none'
  );
  setReadinessPill(
    readinessRefs,
    refsTotal > 0 ? 'good' : 'warn',
    `References: ${refsTotal} potential`
  );

  if (readinessMessage) {
    const actionText = preflight.recommendedAction === 'generate'
      ? 'Ready to generate.'
      : preflight.recommendedAction === 'set_replicate_key'
        ? 'Set Replicate key before generating.'
        : preflight.recommendedAction === 'fix_prompt'
          ? 'Fix missing SeedDream prompt file first.'
          : 'Upload or prepare references before generating.';
    readinessMessage.textContent = actionText;
  }

  dispatchShotFlowEvent('PREFLIGHT_LOADED', {
    readiness,
    continuity
  });
}

async function loadShotGenerationPreflight(options = {}) {
  const force = Boolean(options.force);
  const silent = options.silent !== false;
  if (!projectState.currentProject || !promptsState.currentShot || promptsState.currentTool !== 'seedream') {
    generationState.lastShotPreflight = null;
    clearShotReadinessView();
    return null;
  }

  const key = getCurrentPreflightCacheKey();
  const cache = getShotPreflightCache();
  if (!force && key && cache.has(key)) {
    const cached = cache.get(key);
    generationState.lastShotPreflight = cached;
    renderShotGenerationPreflight(cached);
    return cached;
  }

  try {
    const params = new URLSearchParams({
      project: projectState.currentProject.id,
      shotId: promptsState.currentShot.shotId,
      variation: promptsState.currentVariation,
      tool: 'seedream'
    });
    const response = await fetch(`/api/shot-generation/preflight?${params.toString()}`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to load preflight status');
    }
    if (key) {
      cache.set(key, result);
    }
    generationState.lastShotPreflight = result;
    renderShotGenerationPreflight(result);
    return result;
  } catch (err) {
    generationState.lastShotPreflight = null;
    clearShotReadinessView();
    dispatchShotFlowEvent('ERROR_SET', {
      code: 'SERVER_ERROR',
      message: err && err.message ? err.message : 'Preflight check failed'
    });
    if (!silent) {
      showToast('Preflight check failed', err.message || 'Unknown error', 'error', 4000);
    }
    return null;
  }
}

function selectNextFilteredShot() {
  if (!promptsState.currentShot || !promptsState.indexData || !Array.isArray(promptsState.indexData.shots)) {
    return false;
  }
  const filtered = getFilteredShots();
  if (!Array.isArray(filtered) || filtered.length === 0) return false;
  const currentIndex = filtered.findIndex((shot) => shot.shotId === promptsState.currentShot.shotId);
  if (currentIndex < 0 || currentIndex >= filtered.length - 1) {
    return false;
  }
  const nextShot = filtered[currentIndex + 1];
  if (!nextShot) return false;
  selectShot(nextShot);
  return true;
}

async function quickAcceptGeneratedPreviews(options = {}) {
  if (!generationState.pendingGeneratedPreviews || !projectState.currentProject) return false;
  const goToNext = Boolean(options.nextShot);
  const pending = generationState.pendingGeneratedPreviews;
  const frameAssignments = Array.isArray(pending.frameAssignments) ? pending.frameAssignments : [];
  const firstAssignment = frameAssignments.find((item) => item && item.frame === 'first' && item.path);
  const lastAssignment = frameAssignments.find((item) => item && item.frame === 'last' && item.path);
  const firstPreviewPath = (firstAssignment && firstAssignment.path) || pending.paths[0] || '';
  const lastPreviewPath = (lastAssignment && lastAssignment.path)
    || (pending.paths.length > 1 ? pending.paths[1] : '');
  if (!firstPreviewPath) {
    showToast('Quick accept unavailable', 'No generated images available to save.', 'warning', 3000);
    return false;
  }

  const selections = [{ frame: 'first', previewPath: firstPreviewPath }];
  if (lastPreviewPath && lastPreviewPath !== firstPreviewPath) {
    selections.push({ frame: 'last', previewPath: lastPreviewPath });
  }

  try {
    const result = await getGenerationReadinessService().saveShotPreviews({
      project: projectState.currentProject.id,
      shotId: pending.shotId,
      variation: pending.variation,
      tool: pending.tool || 'seedream',
      selections,
      deletePreview: true
    });
    if (!result.ok) {
      throw new Error(result.error || 'Failed to save generated outputs');
    }
    showToast('Saved', 'Saved first and last frames.', 'success', 2500);
    dispatchShotFlowEvent('PREVIEWS_SAVED', { shotId: pending.shotId, variation: pending.variation });
    closeGenerationChoiceModal();
    clearCurrentShotPreflightCache();
    await loadShotRenders({ forcePreflight: true });

    if (goToNext) {
      const moved = selectNextFilteredShot();
      if (!moved) {
        showToast('End of shot list', 'No next shot available in current filters.', 'info', 2200);
      }
    }
    return true;
  } catch (err) {
    dispatchShotFlowEvent('ERROR_SET', {
      code: 'SERVER_ERROR',
      message: err && err.message ? err.message : 'Quick accept failed'
    });
    showToast('Quick accept failed', err.message || 'Unknown error', 'error', 4500);
    return false;
  }
}

// ========================================
// Upload Functionality
// ========================================

async function loadAnalysisPrompt() {
  try {
    const response = await fetch('/prompts/ai_music_analysis_prompt.txt');
    if (!response.ok) throw new Error('Failed to load prompt');
    return await response.text();
  } catch (err) {
    /* silently handled */
    return 'Error loading prompt. Please try again.';
  }
}

async function checkUploadStatus() {
  if (!projectState.currentProject) return;

  try {
    const response = await fetch(`/api/upload-status?project=${projectState.currentProject.id}`);
    if (!response.ok) throw new Error('Failed to check status');

    const status = await response.json();

    updateStatusIndicator('Music', status.music);
    updateStatusIndicator('Analysis', status.analysis);
    updateStatusIndicator('Suno', status.sunoPrompt);
    updateStatusIndicator('SongInfo', status.songInfo);
  } catch (err) {
    /* silently handled */
  }
}

function updateStatusIndicator(type, saved) {
  const iconId = `status${type}Icon`;
  const valueId = `status${type}Value`;

  const icon = document.getElementById(iconId);
  const value = document.getElementById(valueId);

  if (!icon || !value) return;

  if (saved) {
    icon.textContent = '\u2713';
    value.textContent = 'Saved';
    value.style.color = 'var(--success)';
  } else {
    icon.textContent = '\u25CB';
    value.textContent = 'Not saved';
    value.style.color = 'var(--text-tertiary)';
  }
}

async function uploadFile(file, endpoint, statusElementId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project', projectState.currentProject.id);

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
      statusEl.textContent = `\u2713 ${file.name}`;
      statusEl.className = 'upload-status success';
    }

    showToast('Upload successful', `${file.name} uploaded`, 'success', 3000);
    await checkUploadStatus();

    return result;
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `\u2717 ${err.message}`;
      statusEl.className = 'upload-status error';
    }
    showToast('Upload failed', err.message, 'error', 4000);
    throw err;
  }
}

function setupDragAndDrop(zoneId, inputId, endpoint, statusId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);

  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await uploadFile(file, endpoint, statusId);
    }
  });

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

function setupModals() {
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

function initAutoSave() {
  if (typeof window.AutoSave === 'undefined') return;
  const projectGetter = () => projectState.currentProject?.id;

  // Step 1 content fields
  [
    { id: 'conceptText', contentType: 'concept', statusId: 'conceptTextStatus' },
    { id: 'inspirationText', contentType: 'inspiration', statusId: 'inspirationTextStatus' },
    { id: 'moodText', contentType: 'mood', statusId: 'moodTextStatus' },
    { id: 'genreText', contentType: 'genre', statusId: 'genreTextStatus' }
  ].forEach(f => {
    const el = document.getElementById(f.id);
    if (el) AutoSave.attach(el, { type: 'content', contentType: f.contentType, projectGetter, statusElementId: f.statusId });
  });

  // Step 2 content fields
  [
    { id: 'sunoPromptText', contentType: 'suno-prompt', statusId: 'sunoPromptTextStatus' },
    { id: 'songInfoText', contentType: 'song-info', statusId: 'songInfoTextStatus' },
    { id: 'analysisJsonText', contentType: 'analysis', statusId: 'analysisJsonTextStatus' }
  ].forEach(f => {
    const el = document.getElementById(f.id);
    if (el) AutoSave.attach(el, { type: 'content', contentType: f.contentType, projectGetter, statusElementId: f.statusId });
  });

  // Step 3 canon fields (excluding script which has special build logic)
  [
    { id: 'youtubeScriptJson', canonType: 'youtubeScript', statusId: 'youtubeScriptStatus' },
    { id: 'transcriptJson', canonType: 'transcript', statusId: 'transcriptStatus' },
    { id: 'assetsJson', canonType: 'assets', statusId: 'assetsStatus' },
    { id: 'charactersJson', canonType: 'characters', statusId: 'charactersStatus' },
    { id: 'locationsJson', canonType: 'locations', statusId: 'locationsStatus' },
    { id: 'styleJson', canonType: 'style', statusId: 'styleStatus' },
    { id: 'cinematographyJson', canonType: 'cinematography', statusId: 'cinematographyStatus' }
  ].forEach(f => {
    const el = document.getElementById(f.id);
    if (el) AutoSave.attach(el, { type: 'canon', canonType: f.canonType, projectGetter, statusElementId: f.statusId });
  });
}

async function loadTextContent() {
  if (!projectState.currentProject) return;

  try {
    const feature = getContentFeature();
    const sunoResult = await feature.loadContent({ projectId: projectState.currentProject.id, contentType: 'suno-prompt' });
    if (sunoResult.ok) {
      const data = sunoResult.data || {};
      if (data.content) {
        const el = document.getElementById('sunoPromptText');
        if (el) {
          el.value = data.content;
          document.getElementById('sunoPromptTextStatus').textContent = `\u2713 Loaded (${data.content.length} characters)`;
          document.getElementById('sunoPromptTextStatus').className = 'text-input-status success';
        }
      }
    }

    const songInfoResult = await feature.loadContent({ projectId: projectState.currentProject.id, contentType: 'song-info' });
    if (songInfoResult.ok) {
      const data = songInfoResult.data || {};
      if (data.content) {
        const el = document.getElementById('songInfoText');
        if (el) {
          el.value = data.content;
          document.getElementById('songInfoTextStatus').textContent = `\u2713 Loaded (${data.content.length} characters)`;
          document.getElementById('songInfoTextStatus').className = 'text-input-status success';
        }
      }
    }

    const analysisResult = await feature.loadContent({ projectId: projectState.currentProject.id, contentType: 'analysis' });
    if (analysisResult.ok) {
      const data = analysisResult.data || {};
      if (data.content) {
        const el = document.getElementById('analysisJsonText');
        if (el) {
          el.value = data.content;
          document.getElementById('analysisJsonTextStatus').textContent = `\u2713 Loaded (${data.content.length} characters)`;
          document.getElementById('analysisJsonTextStatus').className = 'text-input-status success';
        }
      }
    }
  } catch (err) {
    /* silently handled */
  }
}

async function loadStep1Content() {
  if (!projectState.currentProject) return;
  const feature = getContentFeature();

  const contentTypes = [
    { id: 'conceptText', status: 'conceptTextStatus', endpoint: 'concept' },
    { id: 'inspirationText', status: 'inspirationTextStatus', endpoint: 'inspiration' },
    { id: 'moodText', status: 'moodTextStatus', endpoint: 'mood' },
    { id: 'genreText', status: 'genreTextStatus', endpoint: 'genre' }
  ];

  for (const type of contentTypes) {
    try {
      const result = await feature.loadContent({ projectId: projectState.currentProject.id, contentType: type.endpoint });
      if (result.ok) {
        const data = result.data || {};
        if (data.content) {
          const textEl = document.getElementById(type.id);
          const statusEl = document.getElementById(type.status);

          if (textEl) {
            textEl.value = data.content;
            if (statusEl) {
              statusEl.textContent = `\u2713 Loaded (${data.content.length} characters)`;
              statusEl.className = 'text-input-status success';
            }
          }
        }
      }
    } catch (err) {
      /* silently handled */
    }
  }
}

function setupCollapsibleSections() {
  const collapsibleCards = document.querySelectorAll('.collapsible-card');

  collapsibleCards.forEach(card => {
    const collapseKey = card.getAttribute('data-collapse-key');
    const header = card.querySelector('.collapsible-header');
    const toggle = card.querySelector('.collapse-toggle');
    const icon = toggle.querySelector('.collapse-icon');

    const savedState = localStorage.getItem(`collapse_${collapseKey}`);
    if (savedState === 'true') {
      card.classList.add('collapsed');
      icon.textContent = '+';
    } else {
      icon.textContent = '-';
    }

    header.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
      }

      const isCollapsed = card.classList.toggle('collapsed');
      icon.textContent = isCollapsed ? '+' : '-';
      localStorage.setItem(`collapse_${collapseKey}`, isCollapsed);
    });

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      header.click();
    });
  });
}

function setupPromptPageCollapsibles() {
  const defaultCollapsed = new Set([
    'step5-gen-history',
    'step5-references',
    'step5-prompt-info'
  ]);

  document.querySelectorAll('[data-collapse-key]').forEach(section => {
    const key = section.getAttribute('data-collapse-key');
    if (!key.startsWith('step5-')) return;

    const header = section.querySelector(
      '.prompt-block-header, .collapsible-section-header'
    );
    const toggle = section.querySelector('.prompt-block-toggle');
    if (!header) return;

    const saved = localStorage.getItem(`collapse_${key}`);
    const shouldCollapse = saved !== null
      ? saved === 'true'
      : defaultCollapsed.has(key);

    if (shouldCollapse) {
      section.classList.add('collapsed');
      if (toggle) toggle.textContent = '\u25b6';
    } else {
      if (toggle) toggle.textContent = '\u25bc';
    }

    header.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

      const isCollapsed = section.classList.toggle('collapsed');
      if (toggle) toggle.textContent = isCollapsed ? '\u25b6' : '\u25bc';
      localStorage.setItem(`collapse_${key}`, isCollapsed);
    });
  });
}

async function checkMusicFile() {
  if (!projectState.currentProject) return;

  try {
    const response = await fetch(`/api/upload-status?project=${projectState.currentProject.id}`);
    const data = await response.json();

    const musicControls = document.getElementById('musicControls');
    const musicPlayer = document.getElementById('musicPlayer');
    const musicFileInfo = document.getElementById('musicFileInfo');

    if (data.musicFile) {
      if (musicControls) musicControls.style.display = 'block';
      if (musicPlayer) {
        musicPlayer.src = `/projects/${projectState.currentProject.id}/music/${data.musicFile}`;
      }
      if (musicFileInfo) {
        const fileSize = data.musicFileSize ? `${(data.musicFileSize / 1024 / 1024).toFixed(2)} MB` : '';
        musicFileInfo.textContent = `${data.musicFile} ${fileSize}`;
      }
    } else {
      if (musicControls) musicControls.style.display = 'none';
    }
  } catch (err) {
    /* silently handled */
  }
}

// ========================================
// Canon Management
// ========================================

async function saveCanonData(type, content, statusElementId, label) {
  if (!projectState.currentProject) {
    showToast('Error', 'No active project', 'error', 3000);
    return;
  }

  try {
    const parsed = JSON.parse(content);

    const response = await fetch(`/api/save/canon/${type}?project=${projectState.currentProject.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    const result = await response.json();

    if (result.success) {
      const statusEl = document.getElementById(statusElementId);
      if (statusEl) {
        statusEl.textContent = `\u2713 ${label} saved (${content.length} characters)`;
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

async function loadCanonData() {
  if (!projectState.currentProject) return;

  const types = ['script', 'youtubeScript', 'transcript', 'assets', 'characters', 'locations', 'style', 'cinematography'];

  for (const type of types) {
    try {
      const response = await fetch(`/api/load/canon/${type}?project=${projectState.currentProject.id}`);
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
            statusEl.textContent = `\u2713 Loaded (${data.content.length} characters)`;
            statusEl.className = 'text-input-status success';
          }
        }
      }
    } catch (err) {
      /* silently handled */
    }
  }
}

function initializeUploads() {
  setupDragAndDrop('musicUploadZone', 'musicFileInput', '/api/upload/music', 'musicUploadStatus');
  initAutoSave();
  setupModals();
  setupCollapsibleSections();
  checkUploadStatus();
  loadTextContent();
  loadStep1Content();
  checkMusicFile();
}

function initializeCanon() {
  if (document.querySelector('.canon-tab')) {
    setupCanonTabs();
    setupPipelineActions();
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

async function initializeReferences() {
  if (document.getElementById('charactersReferenceList')) {
    await checkGenerateStatus();
    loadCharactersReferences();
  }
  if (document.getElementById('locationsReferenceList')) {
    loadLocationReferences();
  }
}

// ========================================
// Context Drawer
// ========================================

let latestContextBundle = null;

async function openContextDrawer() {
  if (!projectState.currentProject) return;
  try {
    const result = await getContextBundleService().loadPreview(projectState.currentProject.id);
    if (!result.ok || !result.data || !result.data.success) {
      throw new Error(result.error || 'Failed to generate context bundle');
    }
    latestContextBundle = result.data.bundle;
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

// (Shot frame upload/delete/render card helpers are now in GenerationWorkflow module)

// ========================================
// Mobile Panel Helpers
// ========================================

function closeMobilePanels() {
  if (!mainLayout) return;
  mainLayout.classList.remove('mobile-nav-open');
  if (mobilePanelOverlay) mobilePanelOverlay.setAttribute('aria-hidden', 'true');
}

function toggleMobilePanel(panelType) {
  if (!mainLayout) return;
  const navOpen = mainLayout.classList.contains('mobile-nav-open');

  if (panelType === 'nav') {
    mainLayout.classList.toggle('mobile-nav-open', !navOpen);
  }

  const isAnyOpen = mainLayout.classList.contains('mobile-nav-open');
  if (mobilePanelOverlay) mobilePanelOverlay.setAttribute('aria-hidden', isAnyOpen ? 'false' : 'true');
}

function detectPageChatPageId() {
  const pathname = String(window.location.pathname || '').toLowerCase();
  if (pathname.endsWith('/step1.html')) return 'step1';
  if (pathname.endsWith('/step2.html')) return 'step2';
  if (pathname.endsWith('/step3.html')) return 'step3';
  if (pathname.endsWith('/step4.html')) return 'step4';
  if (pathname.endsWith('/index.html')) return 'index';
  return '';
}

function collectPageChatFieldValue(id) {
  const element = document.getElementById(id);
  if (!element) return '';
  if (typeof element.value === 'string') return element.value;
  return element.textContent || '';
}

function collectPageChatLiveState(pageId) {
  const state = {
    pageId,
    url: window.location.pathname + (window.location.search || ''),
    selection: {},
    fields: {}
  };

  if (pageId === 'step1') {
    state.fields = {
      concept: collectPageChatFieldValue('conceptText'),
      inspiration: collectPageChatFieldValue('inspirationText'),
      mood: collectPageChatFieldValue('moodText'),
      genre: collectPageChatFieldValue('genreText')
    };
  } else if (pageId === 'step2') {
    state.fields = {
      sunoPrompt: collectPageChatFieldValue('sunoPromptText'),
      songInfo: collectPageChatFieldValue('songInfoText'),
      analysis: collectPageChatFieldValue('analysisJsonText')
    };
  } else if (pageId === 'step3') {
    state.fields = {
      script: collectPageChatFieldValue('scriptJson'),
      youtubeScript: collectPageChatFieldValue('youtubeScriptJson'),
      transcript: collectPageChatFieldValue('transcriptJson'),
      assets: collectPageChatFieldValue('assetsJson'),
      characters: collectPageChatFieldValue('charactersJson'),
      locations: collectPageChatFieldValue('locationsJson'),
      style: collectPageChatFieldValue('styleJson'),
      cinematography: collectPageChatFieldValue('cinematographyJson')
    };
  } else if (pageId === 'index') {
    state.selection = {
      shotId: promptsState.currentShot?.shotId || '',
      variation: promptsState.currentVariation || 'A',
      tool: promptsState.currentTool || 'seedream'
    };
    state.fields = {
      promptPath: promptFile ? String(promptFile.textContent || '') : '',
      promptText: promptText ? String(promptText.textContent || '') : ''
    };
  } else if (pageId === 'step4') {
    state.fields = {
      characterCount: Array.isArray(window.ReferenceManager?.getCharactersData?.()) ? window.ReferenceManager.getCharactersData().length : 0,
      locationCount: Array.isArray(window.ReferenceManager?.getLocationsData?.()) ? window.ReferenceManager.getLocationsData().length : 0
    };
  }

  return state;
}

async function refreshAfterPageChatApply(pageId) {
  if (pageId === 'step1') {
    await loadStep1Content();
    return;
  }
  if (pageId === 'step2') {
    await loadTextContent();
    return;
  }
  if (pageId === 'step3') {
    await loadCanonData();
    return;
  }
  if (pageId === 'index') {
    if (promptsState.currentShot) {
      await renderPrompt();
    }
    return;
  }
}

function setupPageChatBridge() {
  const pageId = detectPageChatPageId();
  if (!pageId) return;

  window.PageChatBridge = {
    pageId,
    getProjectId() {
      return projectState.currentProject?.id || '';
    },
    collectLiveState() {
      return collectPageChatLiveState(pageId);
    },
    async onAppliedChanges() {
      await refreshAfterPageChatApply(pageId);
    }
  };
}

// ========================================
// Event Listeners
// ========================================

function syncFiltersToUrl() {
  const url = new URL(window.location.href);
  const search = searchInput ? searchInput.value.trim() : '';
  if (search) url.searchParams.set('q', search); else url.searchParams.delete('q');
  if (promptsState.currentPlatform !== 'all') url.searchParams.set('platform', promptsState.currentPlatform); else url.searchParams.delete('platform');
  if (promptsState.currentLintFilter !== 'all') url.searchParams.set('lint', promptsState.currentLintFilter); else url.searchParams.delete('lint');
  window.history.replaceState(null, '', url.toString());
}

function restoreFiltersFromUrl() {
  const url = new URL(window.location.href);
  const q = url.searchParams.get('q');
  const platform = url.searchParams.get('platform');
  const lint = url.searchParams.get('lint');
  if (q && searchInput) searchInput.value = q;
  if (platform && platformFilter) { promptsState.currentPlatform = platform; platformFilter.value = platform; }
  if (lint && lintFilter) { promptsState.currentLintFilter = lint; lintFilter.value = lint; }
}

restoreFiltersFromUrl();

if (platformFilter) {
  platformFilter.addEventListener('change', (event) => {
    promptsState.currentPlatform = event.target.value || 'all';
    renderShotList();
    syncFiltersToUrl();
  });
}

if (shotSelector) {
  shotSelector.addEventListener('change', (event) => {
    const shotId = event.target.value;
    if (!shotId || !promptsState.indexData?.shots) return;
    const shot = promptsState.indexData.shots.find((entry) => entry.shotId === shotId);
    if (shot) {
      selectShot(shot);
    }
  });
}

if (toggleShotListBtn && shotListPanel) {
  toggleShotListBtn.addEventListener('click', () => {
    const isOpen = shotListPanel.style.display !== 'none';
    shotListPanel.style.display = isOpen ? 'none' : 'block';
    toggleShotListBtn.textContent = isOpen ? 'Shot List' : 'Hide Shot List';
  });
}

// Variation selector
document.querySelectorAll('.variation-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    promptsState.currentVariation = btn.dataset.variation;
    dispatchShotFlowEvent('VARIATION_CHANGED', { variation: promptsState.currentVariation });
    resetAgentRunUI({ clearLog: true });
    updateVariationButtons();
    renderPrompt();
  });
});


// Copy button
if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);

if (toggleAdvancedActionsBtn && advancedActionsPanel) {
  toggleAdvancedActionsBtn.addEventListener('click', () => {
    const isOpen = advancedActionsPanel.style.display !== 'none';
    advancedActionsPanel.style.display = isOpen ? 'none' : 'flex';
    toggleAdvancedActionsBtn.textContent = isOpen ? 'Show Advanced' : 'Hide Advanced';
  });
}

if (refreshReadinessBtn) {
  refreshReadinessBtn.addEventListener('click', () => {
    loadShotGenerationPreflight({ force: true, silent: false });
  });
}

if (referenceSelectorList) {
  referenceSelectorList.addEventListener('click', (e) => {
    var tile = e.target.closest('.reference-thumb-tile');
    if (!tile || tile.classList.contains('unavailable')) return;
    var checkbox = tile.querySelector('input[type="checkbox"]');
    if (!checkbox || checkbox.disabled) return;
    checkbox.checked = !checkbox.checked;
    tile.classList.toggle('selected', checkbox.checked);
    saveSelectedReferences();
  });
}

if (refSelectAllBtn) {
  refSelectAllBtn.addEventListener('click', refSelectAll);
}

if (refClearAllBtn) {
  refClearAllBtn.addEventListener('click', refClearAll);
}

if (variationChosenCheckbox) {
  variationChosenCheckbox.addEventListener('change', async () => {
    if (!projectState.currentProject || !promptsState.currentShot) return;
    const chosen = Boolean(variationChosenCheckbox.checked);
    try {
      await saveVariationChosen(chosen);
      if (variationChosenLabel) variationChosenLabel.classList.toggle('is-chosen', chosen);
      showToast(chosen ? 'Variation chosen' : 'Variation unmarked',
        chosen ? `${promptsState.currentVariation} marked as chosen for ${promptsState.currentShot.shotId}` : 'Selection cleared',
        chosen ? 'success' : 'info', 3000);
    } catch (err) {
      variationChosenCheckbox.checked = !chosen;
      showToast('Failed to save choice', err.message, 'error', 4000);
    }
  });
}

// Search (debounced)
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(promptsState.searchDebounceTimer);
    promptsState.searchDebounceTimer = setTimeout(() => { renderShotList(); syncFiltersToUrl(); }, 250);
  });
}

if (emptyRunIndexBtn) {
  emptyRunIndexBtn.addEventListener('click', () => {
    showToast('Action needed', 'Run `npm run index` in the project root terminal.', 'info', 4000);
  });
}
if (emptyOpenGuideBtn) {
  emptyOpenGuideBtn.addEventListener('click', () => {
    window.open('guide.html', '_blank');
  });
}

if (lintFilter) {
  lintFilter.addEventListener('change', (e) => {
    promptsState.currentLintFilter = e.target.value;
    renderShotList();
    syncFiltersToUrl();
  });
}

if (mobileNavToggle) {
  mobileNavToggle.addEventListener('click', () => toggleMobilePanel('nav'));
}

if (mobilePanelOverlay) {
  mobilePanelOverlay.addEventListener('click', closeMobilePanels);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMobilePanels();
    return;
  }

  // Arrow-key shot navigation (only when not in input/textarea)
  const tag = (e.target.tagName || '').toLowerCase();
  const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
  if (isInput) return;

  const shots = promptsState.indexData?.shots;
  if (!shots || shots.length === 0) return;

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const currentId = promptsState.currentShot?.shotId;
    const filteredShots = window.PromptViewer ? window.PromptViewer.getFilteredShots(promptsState) : shots;
    const idx = filteredShots.findIndex((s) => s.shotId === currentId);
    let nextIdx;
    if (e.key === 'ArrowDown') {
      nextIdx = idx < filteredShots.length - 1 ? idx + 1 : 0;
    } else {
      nextIdx = idx > 0 ? idx - 1 : filteredShots.length - 1;
    }
    selectShot(filteredShots[nextIdx]);
    const activeEl = document.querySelector(`.shot-item[data-shot-id="${filteredShots[nextIdx].shotId}"]`);
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    return;
  }

  // Left/Right to switch variations
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const variations = ['A', 'B', 'C', 'D'];
    const curIdx = variations.indexOf(promptsState.currentVariation);
    if (curIdx === -1) return;
    let nextVar;
    if (e.key === 'ArrowRight') {
      nextVar = curIdx < variations.length - 1 ? variations[curIdx + 1] : variations[0];
    } else {
      nextVar = curIdx > 0 ? variations[curIdx - 1] : variations[variations.length - 1];
    }
    promptsState.currentVariation = nextVar;
    updateVariationButtons();
    renderPrompt();
    return;
  }
});

// Project selector
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
    getCurrentProject: () => projectState.currentProject,
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

// Delete music file handler
const deleteMusicBtn = document.getElementById('deleteMusicBtn');
if (deleteMusicBtn) {
  deleteMusicBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this music file?')) return;

    try {
      const response = await fetch(`/api/delete/music?project=${projectState.currentProject.id}`, {
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

// Script save button handler (kept - uses special buildScriptJsonFromViews logic)
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

    const charactersData = window.ReferenceManager.getCharactersData();
    if (charactersData.some(c => c.name.toLowerCase() === characterName.toLowerCase())) {
      showToast('Error', 'Character already exists', 'warning', 3000);
      return;
    }

    try {
      const libraryService = getReferenceLibraryService();
      const result = await libraryService.addCharacter(projectState.currentProject.id, characterName);
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

    const locationsData = window.ReferenceManager.getLocationsData();
    if (locationsData.some(l => l.name.toLowerCase() === locationName.toLowerCase())) {
      showToast('Error', 'Location already exists', 'warning', 3000);
      return;
    }

    try {
      const libraryService = getReferenceLibraryService();
      const result = await libraryService.addLocation(projectState.currentProject.id, locationName);
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

// Wire up generate shot button
if (generateShotBtn) {
  generateShotBtn.addEventListener('click', generateShot);
}
if (generateRefImageBtn) {
  generateRefImageBtn.addEventListener('click', generateReferencedImage);
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
if (quickAcceptGeneratedBtn) {
  quickAcceptGeneratedBtn.addEventListener('click', () => {
    quickAcceptGeneratedPreviews({ nextShot: false });
  });
}
if (quickAcceptAndNextBtn) {
  quickAcceptAndNextBtn.addEventListener('click', () => {
    quickAcceptGeneratedPreviews({ nextShot: true });
  });
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
    downloadJson(`context-bundle-${projectState.currentProject?.id || 'project'}.json`, latestContextBundle);
    showToast('Downloaded', 'Context bundle JSON saved', 'success', 2000);
  });
}

window.addEventListener('beforeunload', (e) => {
  closeAgentEventStream();
  closeGenerationJobStream();
  stopGenerationHistoryAutoRefresh();
  if (window.AutoSave && window.AutoSave.hasDirtyFields()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ========================================
// Application Initialization
// ========================================

(async () => {
  const isHomePage = window.location.pathname.endsWith('/home.html') || window.location.pathname === '/';
  if (isHomePage) {
    return;
  }

  setupPageChatBridge();

  handleGitHubOAuthQueryFeedback();
  await refreshGitHubAuthStatus({ silent: true });
  updateAgentControlsForShot();

  if (typeof updateToolbarContext === 'function') {
    updateToolbarContext('prompts');
  }
  const projectsLoaded = await loadProjects();
  if (projectsLoaded) {
    // Only load prompts index on the main prompts page (index.html)
    if (shotList) {
      await loadIndex();
      // Check generate status on prompts page for shot generation
      await checkGenerateStatus();
      setupPromptPageCollapsibles();
    }
    initializeUploads();
    initializeCanon();
    initializeReferences();
    if (typeof applyViewFromUrl === 'function') {
      applyViewFromUrl({ updateHistory: false, replaceHistory: true });
    }
  } else {
    // No projects yet - show message
    showEmptyState();
    showToast('No projects found', 'Run npm run migrate to initialize multi-project support', 'info', 0);
  }
})();
