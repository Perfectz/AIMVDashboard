// Storyboard Viewer - Application Logic
// Version: 2026-02-07 (Multi-Project Support)

let sequenceData = null;
let currentView = 'grid';
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
let emptyState, gridView, timelineView, shotGrid, timelineTrack;
let shotModal, modalTitle, variationGrid, shotDetails;
let statTotalShots, statRendered, statSelected, statDuration;

/**
 * Initialize DOM element references
 */
function initializeDOMElements() {
  emptyState = document.getElementById('emptyState');
  gridView = document.getElementById('gridView');
  timelineView = document.getElementById('timelineView');
  shotGrid = document.getElementById('shotGrid');
  timelineTrack = document.getElementById('timelineTrack');
  shotModal = document.getElementById('shotModal');
  modalTitle = document.getElementById('modalTitle');
  variationGrid = document.getElementById('variationGrid');
  shotDetails = document.getElementById('shotDetails');
  statTotalShots = document.getElementById('stat-total-shots');
  statRendered = document.getElementById('stat-rendered');
  statSelected = document.getElementById('stat-selected');
  statDuration = document.getElementById('stat-duration');
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

async function loadSequence() {
  const loadingOverlay = showLoading(document.body, 'Loading storyboard...');

  try {
    const projectParam = currentProject ? `?project=${currentProject.id}` : '';
    const response = await fetch(`/api/review/sequence${projectParam}`);
    if (!response.ok) {
      throw new Error('Sequence file not found');
    }
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Failed to load sequence');
    }
    sequenceData = payload.sequence;
    sequenceData.selections?.forEach(normalizeShotReviewData);
    updateStats();
    renderView();

    if (sequenceData.selections && sequenceData.selections.length > 0) {
      showToast('Storyboard loaded', `${sequenceData.selections.length} shots`, 'success', 2000);
    }
  } catch (err) {
    console.error('Failed to load sequence:', err);
    showEmptyState();
    showToast('No storyboard data', 'Add rendered assets to get started', 'info', 0);
  } finally {
    hideLoading(loadingOverlay);
  }
}

/**
 * Update header stats
 */
function updateStats() {
  if (!sequenceData || !sequenceData.selections) {
    statTotalShots.textContent = 0;
    statRendered.textContent = 0;
    statSelected.textContent = 0;
    statDuration.textContent = '0s';
    return;
  }

  const totalShots = sequenceData.selections.length;
  const rendered = sequenceData.selections.filter(s =>
    s.status && s.status !== 'not_rendered'
  ).length;
  const selected = sequenceData.selections.filter(s =>
    s.selectedVariation && s.selectedVariation !== 'none'
  ).length;
  const duration = sequenceData.totalDuration || 0;

  statTotalShots.textContent = totalShots;
  statRendered.textContent = rendered;
  statSelected.textContent = selected;
  statDuration.textContent = `${duration}s`;
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

/**
 * Render current view
 */
function renderView() {
  if (!sequenceData || !sequenceData.selections || sequenceData.selections.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();

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

  const shots = getFilteredShots();

  shots.forEach(shot => {
    const card = createShotCard(shot);
    shotGrid.appendChild(card);
  });
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

  // Try to find thumbnail or video
  const thumbnailPath = shot.renderFiles?.thumbnail;
  const selectedVar = shot.selectedVariation || 'A';
  const videoPath = shot.renderFiles?.kling?.[selectedVar];

  if (thumbnailPath) {
    const img = document.createElement('img');
    img.src = `/${thumbnailPath}`;
    img.alt = shot.shotId;
    thumbnail.appendChild(img);
  } else if (videoPath) {
    const video = document.createElement('video');
    video.src = `/${videoPath}`;
    video.muted = true;
    video.preload = 'metadata';
    thumbnail.appendChild(video);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'VIDEO';
    thumbnail.appendChild(placeholder);
  }

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

  const shotId = document.createElement('div');
  shotId.className = 'shot-id';
  shotId.textContent = shot.shotId;
  info.appendChild(shotId);

  const meta = document.createElement('div');
  meta.className = 'shot-meta';

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

/**
 * Render timeline view
 */
function renderTimelineView() {
  timelineTrack.innerHTML = '';

  // Group shots by music section
  const sections = {};
  const shots = getFilteredShots();

  shots.forEach(shot => {
    const sectionName = shot.timing?.musicSection || 'Unknown';
    if (!sections[sectionName]) {
      sections[sectionName] = [];
    }
    sections[sectionName].push(shot);
  });

  // Render each section
  Object.keys(sections).forEach(sectionName => {
    const sectionEl = createTimelineSection(sectionName, sections[sectionName]);
    timelineTrack.appendChild(sectionEl);
  });
}

/**
 * Create timeline section element
 */
function createTimelineSection(sectionName, shots) {
  const section = document.createElement('div');
  section.className = 'timeline-section';

  const header = document.createElement('div');
  header.className = 'section-header';

  const name = document.createElement('div');
  name.className = 'section-name';
  name.textContent = sectionName;
  header.appendChild(name);

  if (shots.length > 0 && shots[0].timing) {
    const time = document.createElement('div');
    time.className = 'section-time';
    const firstShot = shots[0];
    const lastShot = shots[shots.length - 1];
    time.textContent = `${firstShot.timing.start}s - ${lastShot.timing.end}s`;
    header.appendChild(time);
  }

  section.appendChild(header);

  const shotsContainer = document.createElement('div');
  shotsContainer.className = 'section-shots';

  shots.forEach(shot => {
    const shotEl = createTimelineShot(shot);
    shotsContainer.appendChild(shotEl);
  });

  section.appendChild(shotsContainer);

  return section;
}

/**
 * Create timeline shot element
 */
function createTimelineShot(shot) {
  const shotEl = document.createElement('div');
  shotEl.className = 'timeline-shot';
  shotEl.addEventListener('click', () => openShotModal(shot));

  const thumbnailPath = shot.renderFiles?.thumbnail;
  if (thumbnailPath) {
    const img = document.createElement('img');
    img.src = `/${thumbnailPath}`;
    img.alt = shot.shotId;
    shotEl.appendChild(img);
  }

  const label = document.createElement('div');
  label.className = 'timeline-shot-label';
  label.textContent = shot.shotId;
  shotEl.appendChild(label);

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

  const fields = [
    ['Shot ID', selectedShot.shotId],
    ['Duration', (selectedShot.timing?.duration || 8) + 's'],
    ['Music Section', selectedShot.timing?.musicSection || 'N/A'],
    ['Status', selectedShot.status || 'not_rendered'],
    ['Review', formatReviewStatus(selectedShot.reviewStatus || 'draft')],
    ['Assignee', selectedShot.assignee || 'Unassigned']
  ];
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
  }

  // In a real implementation, this would save to the server
  // For now, just update local state and re-render
  console.log(`Selected variation ${selectedVariation} for ${selectedShot.shotId}`);

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
      renderView();
    });
  });
}

/**
 * Initialize button event listeners
 */
function initializeButtons() {
  const exportBtn = document.getElementById('exportBtn');
  const refreshBtn = document.getElementById('refreshBtn');
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
  if (commentsModalClose) commentsModalClose.addEventListener('click', closeCommentsModal);
  if (commentsModalOverlay) commentsModalOverlay.addEventListener('click', closeCommentsModal);
  if (addCommentBtn) addCommentBtn.addEventListener('click', addCommentToCurrentShot);
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
    await loadSequence();
    initMusicUpload();
  } else {
    showEmptyState();
    showToast('No projects found', 'Run npm run migrate to initialize multi-project support', 'info', 0);
  }
})();


