// Storyboard Viewer - Application Logic
// Version: 2026-02-07 (Multi-Project Support)

let sequenceData = null;
let currentView = 'grid';
let selectedShot = null;
let selectedVariation = null;
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
const emptyState = document.getElementById('emptyState');
const gridView = document.getElementById('gridView');
const timelineView = document.getElementById('timelineView');
const shotGrid = document.getElementById('shotGrid');
const timelineTrack = document.getElementById('timelineTrack');
const shotModal = document.getElementById('shotModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const variationGrid = document.getElementById('variationGrid');
const shotDetails = document.getElementById('shotDetails');

// Stats
const statTotalShots = document.getElementById('stat-total-shots');
const statRendered = document.getElementById('stat-rendered');
const statSelected = document.getElementById('stat-selected');
const statDuration = document.getElementById('stat-duration');

// Buttons
const exportBtn = document.getElementById('exportBtn');
const refreshBtn = document.getElementById('refreshBtn');
const viewTabs = document.querySelectorAll('.view-tab');
const modalCancel = document.getElementById('modal-cancel');
const modalSave = document.getElementById('modal-save');

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
    const response = await fetch(`/rendered/storyboard/sequence.json${projectParam}`);
    if (!response.ok) {
      throw new Error('Sequence file not found');
    }
    sequenceData = await response.json();
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

  sequenceData.selections.forEach(shot => {
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
    placeholder.textContent = '🎬';
    thumbnail.appendChild(placeholder);
  }

  // Selection badge
  if (shot.selectedVariation && shot.selectedVariation !== 'none') {
    const badge = document.createElement('div');
    badge.className = 'shot-selection-badge';
    badge.textContent = `Option ${shot.selectedVariation}`;
    thumbnail.appendChild(badge);
  }

  // Status badge
  if (shot.status) {
    const statusBadge = document.createElement('div');
    statusBadge.className = 'shot-status-badge';
    statusBadge.textContent = shot.status.replace('_', ' ');
    thumbnail.appendChild(statusBadge);
  }

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
    duration.textContent = `⏱ ${shot.timing.duration || 8}s`;
    meta.appendChild(duration);

    if (shot.timing.musicSection) {
      const section = document.createElement('div');
      section.className = 'shot-meta-item';
      section.textContent = `🎵 ${shot.timing.musicSection}`;
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
  sequenceData.selections.forEach(shot => {
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
  check.textContent = '✓';
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
        <span class="drop-zone-icon">🎬</span>
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
  shotDetails.innerHTML = `
    <h3>Shot Details</h3>
    <p><strong>Shot ID:</strong> ${selectedShot.shotId}</p>
    <p><strong>Duration:</strong> ${selectedShot.timing?.duration || 8}s</p>
    <p><strong>Music Section:</strong> ${selectedShot.timing?.musicSection || 'N/A'}</p>
    <p><strong>Status:</strong> ${selectedShot.status || 'not_rendered'}</p>
    ${selectedShot.notes ? `<p><strong>Notes:</strong> ${selectedShot.notes}</p>` : ''}
  `;
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

// View tabs
viewTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    currentView = tab.dataset.view;
    viewTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderView();
  });
});

// Buttons
exportBtn.addEventListener('click', exportPDF);
refreshBtn.addEventListener('click', loadSequence);

// Modal
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalSave.addEventListener('click', saveSelection);

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
    await loadSequence();
    initMusicUpload();
  } else {
    showEmptyState();
    showToast('No projects found', 'Run npm run migrate to initialize multi-project support', 'info', 0);
  }
})();
