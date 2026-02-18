(function(root) {
  'use strict';

  // Lazy accessors
  function getSharedUtils() { return root.SharedUtils; }
  function getAppState() { return root.AppState; }

  var el = getSharedUtils().el;

  // Dependencies injected by app.js
  var _getReferenceFeature = null;
  var _renderPromptFn = null;
  var generationJobsService = null;
  var generationReadinessService = null;
  var reviewService = null;

  function init(deps) {
    _getReferenceFeature = deps.getReferenceFeature || null;
    _renderPromptFn = deps.renderPrompt || null;
  }

  function getReferenceFeature() {
    return _getReferenceFeature ? _getReferenceFeature() : null;
  }

  function getGenerationJobsService() {
    if (generationJobsService) return generationJobsService;
    if (!root.GenerationJobsService || !root.GenerationJobsService.createGenerationJobsService) {
      throw new Error('GenerationJobsService.createGenerationJobsService is required');
    }
    generationJobsService = root.GenerationJobsService.createGenerationJobsService();
    return generationJobsService;
  }

  function getGenerationReadinessService() {
    if (generationReadinessService) return generationReadinessService;
    if (!root.GenerationReadinessService || !root.GenerationReadinessService.createGenerationReadinessService) {
      throw new Error('GenerationReadinessService.createGenerationReadinessService is required');
    }
    generationReadinessService = root.GenerationReadinessService.createGenerationReadinessService();
    return generationReadinessService;
  }

  function getReviewService() {
    if (reviewService) return reviewService;
    if (!root.ReviewService || !root.ReviewService.createReviewService) {
      throw new Error('ReviewService.createReviewService is required');
    }
    reviewService = root.ReviewService.createReviewService();
    return reviewService;
  }

  function classifyError(error, fallbackCode) {
    if (root.ErrorTaxonomy && typeof root.ErrorTaxonomy.classify === 'function') {
      return root.ErrorTaxonomy.classify(error, fallbackCode || 'SERVER_ERROR');
    }
    return {
      code: fallbackCode || 'SERVER_ERROR',
      message: (error && error.message) ? String(error.message) : 'Unexpected error',
      raw: error || null
    };
  }

  function toUserMessage(classified) {
    if (root.ErrorTaxonomy && typeof root.ErrorTaxonomy.toUserMessage === 'function') {
      return root.ErrorTaxonomy.toUserMessage(classified);
    }
    return classified && classified.message ? classified.message : 'Unexpected error';
  }

  function dispatchShotFlowEvent(type, payload) {
    var store = root.__shotFlowStore;
    if (!store || typeof store.dispatch !== 'function') return;
    store.dispatch({ type: type, payload: payload || {} });
  }

  function getGenerationState() {
    var appState = getAppState();
    return {
      get canGenerate() { return appState.get('canGenerate'); },
      get generateTokenSource() { return appState.get('generateTokenSource'); },
      get pendingGeneratedPreviews() { return appState.get('pendingGeneratedPreviews'); },
      set pendingGeneratedPreviews(v) { appState.set('pendingGeneratedPreviews', v); },
      get generationJobEventSource() { return appState.get('generationJobEventSource'); },
      set generationJobEventSource(v) { appState.set('generationJobEventSource', v); },
      get activeGenerationJobId() { return appState.get('activeGenerationJobId'); },
      set activeGenerationJobId(v) { appState.set('activeGenerationJobId', v); },
      get generationMetricsCache() { return appState.get('generationMetricsCache'); },
      set generationMetricsCache(v) { appState.set('generationMetricsCache', v); },
      get generationHistoryAutoRefreshTimer() { return appState.get('generationHistoryAutoRefreshTimer'); },
      set generationHistoryAutoRefreshTimer(v) { appState.set('generationHistoryAutoRefreshTimer', v); },
      get generationHistoryRefreshInFlight() { return appState.get('generationHistoryRefreshInFlight'); },
      set generationHistoryRefreshInFlight(v) { appState.set('generationHistoryRefreshInFlight', v); },
      get generationHistoryJobsById() { return appState.get('generationHistoryJobsById'); },
      set generationHistoryJobsById(v) { appState.set('generationHistoryJobsById', v); },
      get generationDetailsJobId() { return appState.get('generationDetailsJobId'); },
      set generationDetailsJobId(v) { appState.set('generationDetailsJobId', v); }
    };
  }

  function getProjectState() {
    return { currentProject: getAppState().get('currentProject') };
  }

  function getPromptsState() {
    var appState = getAppState();
    return {
      get currentShot() { return appState.get('currentShot'); },
      get currentVariation() { return appState.get('currentVariation'); },
      get currentTool() { return appState.get('currentTool'); }
    };
  }

  function getReviewState() {
    var appState = getAppState();
    return {
      get previsMapCache() { return appState.get('previsMapCache'); },
      set previsMapCache(v) { appState.set('previsMapCache', v); }
    };
  }

  // --- Generation Job Stream ---

  function closeGenerationJobStream() {
    var gs = getGenerationState();
    if (!gs.generationJobEventSource) return;
    gs.generationJobEventSource.close();
    gs.generationJobEventSource = null;
  }

  function setGenerationJobStatus(text, tone) {
    var generationJobStatus = el('generationJobStatus');
    if (!generationJobStatus) return;
    generationJobStatus.textContent = text || '';
    generationJobStatus.classList.remove('running', 'error', 'success');
    if (tone) generationJobStatus.classList.add(tone);
  }

  function setGenerationControlsForActiveJob(active) {
    var isActive = Boolean(active);
    var generationCancelBtn = el('generationCancelBtn');
    if (generationCancelBtn) {
      generationCancelBtn.style.display = isActive ? 'inline-flex' : 'none';
      generationCancelBtn.disabled = !isActive;
    }
  }

  function formatJobCreatedAt(isoString) {
    var ms = Date.parse(String(isoString || ''));
    if (!Number.isFinite(ms)) return 'unknown time';
    return new Date(ms).toLocaleString();
  }

  function formatJobDuration(job) {
    var startedMs = Date.parse(String(job && job.startedAt || ''));
    var finishedMs = Date.parse(String(job && job.finishedAt || ''));
    if (!Number.isFinite(startedMs) || !Number.isFinite(finishedMs) || finishedMs < startedMs) return '';
    return ((finishedMs - startedMs) / 1000).toFixed(1) + 's';
  }

  // --- Generation History ---

  function stopGenerationHistoryAutoRefresh() {
    var gs = getGenerationState();
    if (!gs.generationHistoryAutoRefreshTimer) return;
    clearInterval(gs.generationHistoryAutoRefreshTimer);
    gs.generationHistoryAutoRefreshTimer = null;
  }

  function setGenerationHistoryAutoRefresh(enabled) {
    var gs = getGenerationState();
    if (!enabled) {
      stopGenerationHistoryAutoRefresh();
      return;
    }
    if (gs.generationHistoryAutoRefreshTimer) return;
    gs.generationHistoryAutoRefreshTimer = setInterval(async function() {
      if (gs.generationHistoryRefreshInFlight) return;
      gs.generationHistoryRefreshInFlight = true;
      try {
        await loadShotGenerationHistory();
        await loadGenerationMetrics();
      } finally {
        gs.generationHistoryRefreshInFlight = false;
      }
    }, 4000);
  }

  // --- Page Visibility: pause auto-refresh when tab is hidden ---
  var _autoRefreshWasActive = false;
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      var gs = getGenerationState();
      _autoRefreshWasActive = !!gs.generationHistoryAutoRefreshTimer;
      if (_autoRefreshWasActive) stopGenerationHistoryAutoRefresh();
    } else {
      if (_autoRefreshWasActive) {
        _autoRefreshWasActive = false;
        setGenerationHistoryAutoRefresh(true);
      }
    }
  });

  // --- Generation Details Modal ---

  function closeGenerationJobDetailsModal() {
    var generationJobDetailsModal = el('generationJobDetailsModal');
    if (!generationJobDetailsModal) return;
    generationJobDetailsModal.style.display = 'none';
    getGenerationState().generationDetailsJobId = null;
  }

  function buildFailureTrace(job) {
    var events = Array.isArray(job && job.events) ? job.events : [];
    var lastFailedEvent = events.slice().reverse().find(function(evt) { return evt && evt.event === 'job_failed'; });
    return {
      status: (job && job.status) || 'unknown',
      error: (job && job.error) || null,
      lastFailedEvent: lastFailedEvent || null
    };
  }

  function openGenerationJobDetailsModal(jobId) {
    var gs = getGenerationState();
    var generationJobDetailsModal = el('generationJobDetailsModal');
    if (!generationJobDetailsModal) return;
    var job = gs.generationHistoryJobsById.get(jobId);
    if (!job) return;

    gs.generationDetailsJobId = job.jobId;
    var generationJobDetailsMeta = el('generationJobDetailsMeta');
    if (generationJobDetailsMeta) {
      generationJobDetailsMeta.textContent = job.jobId + ' \u00b7 ' + job.type + ' \u00b7 ' + job.status + ' \u00b7 ' + formatJobCreatedAt(job.createdAt);
    }

    var generationJobInputJson = el('generationJobInputJson');
    if (generationJobInputJson) {
      generationJobInputJson.textContent = JSON.stringify(job.input || {}, null, 2);
    }

    var resultView = {
      result: job.result || {},
      references: {
        source: (job.result && job.result.referenceSource) || '',
        count: (job.result && job.result.referenceCount) || 0,
        trimmed: Boolean(job.result && job.result.referenceTrimmed),
        trimmedCount: (job.result && job.result.trimmedReferenceCount) || 0
      }
    };
    var generationJobResultJson = el('generationJobResultJson');
    if (generationJobResultJson) {
      generationJobResultJson.textContent = JSON.stringify(resultView, null, 2);
    }

    var generationJobFailureJson = el('generationJobFailureJson');
    if (generationJobFailureJson) {
      generationJobFailureJson.textContent = JSON.stringify(buildFailureTrace(job), null, 2);
    }

    var eventTail = (Array.isArray(job.events) ? job.events : []).slice(-25);
    var generationJobEventsJson = el('generationJobEventsJson');
    if (generationJobEventsJson) {
      generationJobEventsJson.textContent = JSON.stringify(eventTail, null, 2);
    }

    var variationValue = String((job.input && job.input.variation) || '').toUpperCase();
    var generationRetryVariation = el('generationRetryVariation');
    if (generationRetryVariation) {
      generationRetryVariation.value = /^[A-D]$/.test(variationValue) ? variationValue : '';
    }
    var generationRetryMaxImages = el('generationRetryMaxImages');
    if (generationRetryMaxImages) {
      var maxImages = Number(job.input && job.input.maxImages);
      generationRetryMaxImages.value = Number.isFinite(maxImages) ? String(Math.max(1, Math.min(2, Math.floor(maxImages)))) : '';
    }
    var generationRetryAspectRatio = el('generationRetryAspectRatio');
    if (generationRetryAspectRatio) {
      generationRetryAspectRatio.value = String((job.input && job.input.aspect_ratio) || '');
    }
    var generationRetryRequireReference = el('generationRetryRequireReference');
    if (generationRetryRequireReference) {
      generationRetryRequireReference.checked = Boolean(job.input && job.input.requireReference);
    }
    var generationRetryPreviewOnly = el('generationRetryPreviewOnly');
    if (generationRetryPreviewOnly) {
      generationRetryPreviewOnly.checked = (job.input && job.input.previewOnly) !== false;
    }

    var canRetry = ['failed', 'canceled', 'completed'].includes(String(job.status || ''));
    var generationJobRetryDefaultBtn = el('generationJobRetryDefaultBtn');
    var generationJobRetryOverrideBtn = el('generationJobRetryOverrideBtn');
    if (generationJobRetryDefaultBtn) generationJobRetryDefaultBtn.disabled = !canRetry || Boolean(gs.activeGenerationJobId);
    if (generationJobRetryOverrideBtn) generationJobRetryOverrideBtn.disabled = !canRetry || Boolean(gs.activeGenerationJobId);
    generationJobDetailsModal.style.display = 'flex';
  }

  function collectGenerationRetryOverridesFromForm() {
    var overrides = {};

    var generationRetryVariation = el('generationRetryVariation');
    var variation = generationRetryVariation ? String(generationRetryVariation.value || '').trim().toUpperCase() : '';
    if (/^[A-D]$/.test(variation)) overrides.variation = variation;

    var generationRetryMaxImages = el('generationRetryMaxImages');
    var maxImagesRaw = generationRetryMaxImages ? String(generationRetryMaxImages.value || '').trim() : '';
    if (maxImagesRaw) {
      var maxImages = Number(maxImagesRaw);
      if (Number.isFinite(maxImages)) overrides.maxImages = Math.max(1, Math.min(2, Math.floor(maxImages)));
    }

    var generationRetryAspectRatio = el('generationRetryAspectRatio');
    var aspectRatio = generationRetryAspectRatio ? String(generationRetryAspectRatio.value || '').trim() : '';
    if (aspectRatio) overrides.aspect_ratio = aspectRatio;

    var generationRetryRequireReference = el('generationRetryRequireReference');
    if (generationRetryRequireReference) overrides.requireReference = Boolean(generationRetryRequireReference.checked);

    var generationRetryPreviewOnly = el('generationRetryPreviewOnly');
    if (generationRetryPreviewOnly) overrides.previewOnly = Boolean(generationRetryPreviewOnly.checked);

    return overrides;
  }

  // --- Core Generation Job Engine ---

  async function fetchGenerationJobState(jobId) {
    var result = await getGenerationJobsService().getJob(jobId);
    if (!result.ok || !result.data || !result.data.job) {
      var stateErr = new Error(result.error || 'Failed to fetch generation job state');
      stateErr.code = result.code || 'SERVER_ERROR';
      throw stateErr;
    }
    return result.data.job;
  }

  async function runGenerationJob(payload, onEvent) {
    var utils = getSharedUtils();
    var traceId = (payload && payload.traceId)
      ? String(payload.traceId)
      : ('gen_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));
    var requestPayload = Object.assign({}, payload || {}, { traceId: traceId });
    var result = await getGenerationJobsService().startJob(requestPayload);

    var jobId = '';
    var data = result.data || {};
    if (result.ok && data.jobId) {
      jobId = data.jobId;
    } else if (result.status === 409 && result.code === 'LOCK_CONFLICT' && data.activeJobId) {
      jobId = data.activeJobId;
      utils.showToast('Generation In Progress', 'Using active generation job for this shot.', 'info', 2500);
    } else {
      var startErr = new Error(result.error || 'Failed to start generation job');
      startErr.code = result.code || 'SERVER_ERROR';
      throw startErr;
    }

    dispatchShotFlowEvent('JOB_STARTED', { jobId: jobId, traceId: traceId });
    return trackGenerationJob(jobId, onEvent, traceId);
  }

  function trackGenerationJob(jobId, onEvent, traceId) {
    var gs = getGenerationState();
    var resolvedJobId = String(jobId || '').trim();
    if (!resolvedJobId) {
      return Promise.reject(new Error('Invalid generation job ID'));
    }

    gs.activeGenerationJobId = resolvedJobId;
    setGenerationControlsForActiveJob(true);
    setGenerationJobStatus('Generation job ' + resolvedJobId.slice(0, 8) + ' started... [' + (traceId || 'trace') + ']', 'running');

    var SSE_MAX_RECONNECTS = 3;
    var SSE_RECONNECT_BASE_MS = 1000;
    var POLL_INTERVAL_MS = 3000;
    var JOB_TIMEOUT_MS = 330000;

    return new Promise(function(resolve, reject) {
      var settled = false;
      var timeoutId = null;
      var pollTimerId = null;
      var source = null;
      var sseReconnectCount = 0;
      var reconnectTimerId = null;

      var cleanup = function() {
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        if (pollTimerId) { clearTimeout(pollTimerId); pollTimerId = null; }
        if (reconnectTimerId) { clearTimeout(reconnectTimerId); reconnectTimerId = null; }
        if (source) {
          source.close();
          if (gs.generationJobEventSource === source) gs.generationJobEventSource = null;
          source = null;
        }
        if (gs.activeGenerationJobId === resolvedJobId) {
          gs.activeGenerationJobId = null;
          setGenerationControlsForActiveJob(false);
        }
        loadGenerationMetrics();
        loadShotGenerationHistory();
      };

      var schedulePoll = function() {
        if (settled || pollTimerId) return;
        pollTimerId = setTimeout(function() {
          pollTimerId = null;
          finishWithState();
        }, POLL_INTERVAL_MS);
      };

      var finishWithState = async function() {
        if (settled) return;
        try {
          var job = await fetchGenerationJobState(resolvedJobId);
          if (job.status === 'completed') {
            settled = true;
            setGenerationJobStatus('Generation completed (' + job.jobId.slice(0, 8) + ')', 'success');
            dispatchShotFlowEvent('JOB_COMPLETED', {
              jobId: resolvedJobId,
              traceId: traceId || '',
              status: 'completed',
              previews: (job.result && Array.isArray(job.result.images)) ? job.result.images : []
            });
            cleanup();
            resolve(job);
            return;
          }
          if (job.status === 'failed' || job.status === 'canceled') {
            settled = true;
            var tone = job.status === 'canceled' ? '' : 'error';
            setGenerationJobStatus(
              job.status === 'canceled'
                ? 'Generation canceled (' + job.jobId.slice(0, 8) + ')'
                : 'Generation failed: ' + ((job.error && job.error.message) || 'Unknown error'),
              tone
            );
            if (job.status === 'failed') {
              dispatchShotFlowEvent('ERROR_SET', {
                code: (job.error && job.error.code) || 'SERVER_ERROR',
                message: (job.error && job.error.message) || 'Generation failed'
              });
            } else {
              dispatchShotFlowEvent('JOB_COMPLETED', {
                jobId: resolvedJobId,
                traceId: traceId || '',
                status: 'canceled',
                previews: []
              });
            }
            cleanup();
            reject(new Error((job.error && job.error.message) || 'Generation ' + job.status));
            return;
          }
          // Job still running — poll again as fallback in case SSE drops
          schedulePoll();
        } catch (stateErr) {
          // Transient fetch error — retry instead of failing immediately
          schedulePoll();
        }
      };

      function attachSseHandlers(src) {
        src.onmessage = function(event) {
          // Reset reconnect count on successful message
          sseReconnectCount = 0;

          var evt;
          try { evt = JSON.parse(event.data || '{}'); } catch (e) { evt = {}; }

          if (typeof onEvent === 'function') {
            try { onEvent(evt); } catch (e) { /* callback error ignored */ }
          }

          if (evt.event === 'job_progress') {
            var stepLabel = String(evt.step || 'running').replace(/_/g, ' ');
            var progress = Number(evt.progress);
            var progressLabel = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.floor(progress))) + '%' : '';
            setGenerationJobStatus('Generating: ' + stepLabel + (progressLabel ? ' (' + progressLabel + ')' : ''), 'running');
            dispatchShotFlowEvent('JOB_PROGRESS', {
              jobId: resolvedJobId,
              traceId: traceId || '',
              step: String(evt.step || ''),
              progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0
            });
          } else if (evt.event === 'job_cancel_requested') {
            setGenerationJobStatus('Cancel requested...', 'running');
          }

          if (evt.event === 'job_completed' || evt.event === 'job_failed' || evt.event === 'job_canceled') {
            finishWithState();
          }
        };

        src.onerror = function() {
          if (settled) return;
          // Close the broken connection
          src.close();
          if (gs.generationJobEventSource === src) gs.generationJobEventSource = null;
          source = null;

          if (sseReconnectCount < SSE_MAX_RECONNECTS) {
            // Exponential backoff: 1s, 2s, 4s
            var delay = SSE_RECONNECT_BASE_MS * Math.pow(2, sseReconnectCount);
            sseReconnectCount++;
            reconnectTimerId = setTimeout(function() {
              reconnectTimerId = null;
              if (settled) return;
              connectSse();
            }, delay);
          } else {
            // Exhausted SSE reconnects — fall back to polling
            finishWithState();
          }
        };
      }

      function connectSse() {
        if (settled) return;
        closeGenerationJobStream();
        source = getGenerationJobsService().createJobEventsSource(resolvedJobId);
        gs.generationJobEventSource = source;
        attachSseHandlers(source);
      }

      connectSse();

      timeoutId = setTimeout(async function() {
        if (settled) return;
        try {
          var job = await fetchGenerationJobState(resolvedJobId);
          if (job.status === 'completed') { settled = true; cleanup(); resolve(job); return; }
        } catch (e) { /* timeout check failed */ }
        settled = true;
        cleanup();
        reject(new Error('Generation job timed out'));
      }, JOB_TIMEOUT_MS);
    });
  }

  // --- Shot Generation ---

  async function generateShot() {
    var promptsState = getPromptsState();
    var projectState = getProjectState();
    var utils = getSharedUtils();
    if (!promptsState.currentShot || !promptsState.currentTool || promptsState.currentTool !== 'seedream') return;

    // Wait for any pending reference selection save to complete
    if (_pendingReferenceSave) {
      await _pendingReferenceSave;
    }

    var generateShotBtn = el('generateShotBtn');
    if (generateShotBtn) {
      generateShotBtn.disabled = true;
      generateShotBtn.textContent = 'Generating...';
      generateShotBtn.classList.add('generating-shot');
    }

    var loadingToastId = utils.showToast(
      'Generating Frames...',
      promptsState.currentShot.shotId + ' - Variation ' + promptsState.currentVariation,
      'info', 0
    );

    try {
      var job = await runGenerationJob({
        type: 'generate-shot',
        projectId: projectState.currentProject.id,
        input: {
          project: projectState.currentProject.id,
          shotId: promptsState.currentShot.shotId,
          variation: promptsState.currentVariation,
          tool: 'seedream',
          previewOnly: true
        }
      }, function(evt) {
        if (!generateShotBtn) return;
        if (evt.event !== 'job_progress') return;
        var progress = Number(evt.progress);
        if (!Number.isFinite(progress)) return;
        generateShotBtn.textContent = 'Generating ' + Math.max(1, Math.min(99, Math.floor(progress))) + '%...';
      });
      var result = job.result || {};
      utils.dismissToast(loadingToastId);

      var refNote = result.hasReferenceImage ? ' (with ' + (result.referenceSource || 'reference image') + ')' : '';
      var trimNote = result.referenceTrimmed ? ' \u00b7 trimmed ' + (Number(result.trimmedReferenceCount) || 0) + ' ref(s) for API cap' : '';
      utils.showToast(
        'Generated Output Ready',
        promptsState.currentShot.shotId + ' ' + promptsState.currentVariation + ' - ' + Number(result.duration || 0).toFixed(1) + 's' + refNote + trimNote,
        'success', 3500
      );
      openGenerationChoiceModal({
        shotId: promptsState.currentShot.shotId,
        variation: promptsState.currentVariation,
        tool: 'seedream',
        images: result.images || [],
        frameAssignments: result.frameAssignments || []
      });
    } catch (err) {
      utils.dismissToast(loadingToastId);
      var classified = classifyError(err, 'SERVER_ERROR');
      utils.showToast('Generation Error', toUserMessage(classified), 'error', 6000);
      dispatchShotFlowEvent('ERROR_SET', { code: classified.code, message: classified.message });
    } finally {
      closeGenerationJobStream();
      if (generateShotBtn) {
        generateShotBtn.disabled = false;
        generateShotBtn.textContent = 'Generate Shot';
        generateShotBtn.classList.remove('generating-shot');
      }
    }
  }

  async function generateReferencedImage() {
    var promptsState = getPromptsState();
    var projectState = getProjectState();
    var utils = getSharedUtils();
    if (!promptsState.currentShot || !promptsState.currentTool || promptsState.currentTool !== 'seedream') return;

    // Wait for any pending reference selection save to complete
    if (_pendingReferenceSave) {
      await _pendingReferenceSave;
    }

    var generateRefImageBtn = el('generateRefImageBtn');
    if (generateRefImageBtn) {
      generateRefImageBtn.disabled = true;
      generateRefImageBtn.textContent = 'Generating...';
    }

    var loadingToastId = utils.showToast(
      'Generating Referenced Image...',
      promptsState.currentShot.shotId + ' - Variation ' + promptsState.currentVariation,
      'info', 0
    );

    try {
      var job = await runGenerationJob({
        type: 'generate-shot',
        projectId: projectState.currentProject.id,
        input: {
          project: projectState.currentProject.id,
          shotId: promptsState.currentShot.shotId,
          variation: promptsState.currentVariation,
          tool: 'seedream',
          maxImages: 1,
          requireReference: true,
          previewOnly: true
        }
      }, function(evt) {
        if (!generateRefImageBtn) return;
        if (evt.event !== 'job_progress') return;
        var progress = Number(evt.progress);
        if (!Number.isFinite(progress)) return;
        generateRefImageBtn.textContent = 'Generating ' + Math.max(1, Math.min(99, Math.floor(progress))) + '%...';
      });
      var result = job.result || {};
      utils.dismissToast(loadingToastId);

      var refNote = result.referenceSource ? ' using ' + result.referenceSource : '';
      var trimNote = result.referenceTrimmed ? ' \u00b7 trimmed ' + (Number(result.trimmedReferenceCount) || 0) + ' ref(s)' : '';
      utils.showToast(
        'Generated Output Ready',
        promptsState.currentShot.shotId + ' ' + promptsState.currentVariation + ' - ' + Number(result.duration || 0).toFixed(1) + 's' + refNote + trimNote,
        'success', 3500
      );
      openGenerationChoiceModal({
        shotId: promptsState.currentShot.shotId,
        variation: promptsState.currentVariation,
        tool: 'seedream',
        images: result.images || [],
        frameAssignments: result.frameAssignments || []
      });
    } catch (err) {
      utils.dismissToast(loadingToastId);
      var classified = classifyError(err, 'SERVER_ERROR');
      utils.showToast('Generation Error', toUserMessage(classified), 'error', 6000);
      dispatchShotFlowEvent('ERROR_SET', { code: classified.code, message: classified.message });
    } finally {
      closeGenerationJobStream();
      if (generateRefImageBtn) {
        generateRefImageBtn.disabled = false;
        generateRefImageBtn.textContent = 'Generate Single Ref Image';
      }
    }
  }

  // --- Replicate Key Modal ---

  function openReplicateKeyModal() {
    var replicateKeyModal = el('replicateKeyModal');
    var replicateKeyInput = el('replicateKeyInput');
    if (!replicateKeyModal) return;
    if (replicateKeyInput) replicateKeyInput.value = '';
    if (root.AgentIntegration) root.AgentIntegration.checkGenerateStatus();
    replicateKeyModal.style.display = 'flex';
  }

  function closeReplicateKeyModal() {
    var replicateKeyModal = el('replicateKeyModal');
    if (!replicateKeyModal) return;
    replicateKeyModal.style.display = 'none';
  }

  async function saveSessionReplicateKey() {
    var utils = getSharedUtils();
    var replicateKeyInput = el('replicateKeyInput');
    var token = (replicateKeyInput && replicateKeyInput.value ? replicateKeyInput.value.trim() : '');
    if (!token) {
      utils.showToast('Missing key', 'Enter a Replicate API key first.', 'warning', 3000);
      return;
    }

    try {
      var result = await getGenerationReadinessService().setSessionReplicateKey(token);
      if (!result.ok) {
        var saveErr = new Error(result.error || 'Failed to update key');
        saveErr.code = result.code || 'CONFIG_MISSING';
        throw saveErr;
      }
      if (root.AgentIntegration) await root.AgentIntegration.checkGenerateStatus();
      utils.showToast('Replicate key updated', (result.data && result.data.message) || 'Session key saved', 'success', 2500);
      closeReplicateKeyModal();
      if (_renderPromptFn) _renderPromptFn();
    } catch (err) {
      var classified = classifyError(err, 'CONFIG_MISSING');
      utils.showToast('Replicate key update failed', toUserMessage(classified), 'error', 5000);
      dispatchShotFlowEvent('ERROR_SET', { code: classified.code, message: classified.message });
    }
  }

  async function clearSessionReplicateKey() {
    var utils = getSharedUtils();
    try {
      var result = await getGenerationReadinessService().setSessionReplicateKey('');
      if (!result.ok) {
        var clearErr = new Error(result.error || 'Failed to clear session key');
        clearErr.code = result.code || 'CONFIG_MISSING';
        throw clearErr;
      }
      if (root.AgentIntegration) await root.AgentIntegration.checkGenerateStatus();
      utils.showToast('Replicate session key cleared', 'Now using configured default key (.env/local) if available.', 'info', 3000);
      if (_renderPromptFn) _renderPromptFn();
    } catch (err) {
      var classified = classifyError(err, 'CONFIG_MISSING');
      utils.showToast('Failed to clear key', toUserMessage(classified), 'error', 5000);
      dispatchShotFlowEvent('ERROR_SET', { code: classified.code, message: classified.message });
    }
  }

  // --- Generation Choice Modal ---

  function normalizeFrameAssignments(images, assignments) {
    var imageList = Array.isArray(images) ? images.filter(Boolean) : [];
    var normalized = [];
    var seen = new Set();
    var byPath = new Map();

    if (Array.isArray(assignments)) {
      assignments.forEach(function(item) {
        if (!item) return;
        var path = String(item.path || '').trim();
        if (!path || seen.has(path)) return;
        var frame = String(item.frame || '').trim().toLowerCase();
        if (frame !== 'first' && frame !== 'last') frame = '';
        var entry = { frame: frame, path: path };
        normalized.push(entry);
        seen.add(path);
        byPath.set(path, entry);
      });
    }

    if (imageList.length === 2) {
      var firstPath = imageList[0];
      var lastPath = imageList[1];
      if (!byPath.has(firstPath)) {
        var firstEntry = { frame: 'first', path: firstPath };
        normalized.unshift(firstEntry);
        byPath.set(firstPath, firstEntry);
      } else if (!byPath.get(firstPath).frame) {
        byPath.get(firstPath).frame = 'first';
      }
      if (!byPath.has(lastPath)) {
        var lastEntry = { frame: 'last', path: lastPath };
        normalized.push(lastEntry);
        byPath.set(lastPath, lastEntry);
      } else if (!byPath.get(lastPath).frame) {
        byPath.get(lastPath).frame = 'last';
      }
    }

    imageList.forEach(function(path) {
      if (!byPath.has(path)) {
        var entry = { frame: '', path: path };
        normalized.push(entry);
        byPath.set(path, entry);
      }
    });

    return normalized.filter(function(item) {
      return imageList.includes(item.path);
    });
  }

  function hasFirstLastPair(assignments) {
    if (!Array.isArray(assignments) || assignments.length < 2) return false;
    var hasFirst = assignments.some(function(item) { return item && item.frame === 'first'; });
    var hasLast = assignments.some(function(item) { return item && item.frame === 'last'; });
    return hasFirst && hasLast;
  }

  function closeGenerationChoiceModal() {
    var gs = getGenerationState();
    var generationChoiceModal = el('generationChoiceModal');
    var generationChoiceGrid = el('generationChoiceGrid');
    if (!generationChoiceModal) return;
    generationChoiceModal.style.display = 'none';
    if (generationChoiceGrid) generationChoiceGrid.innerHTML = '';
    gs.pendingGeneratedPreviews = null;
  }

  async function saveGeneratedPreview(previewPath, frame) {
    var gs = getGenerationState();
    var projectState = getProjectState();
    var utils = getSharedUtils();
    if (!gs.pendingGeneratedPreviews || !projectState.currentProject) return;
    try {
      var result = await getGenerationReadinessService().saveShotPreview({
        project: projectState.currentProject.id,
        shotId: gs.pendingGeneratedPreviews.shotId,
        variation: gs.pendingGeneratedPreviews.variation,
        tool: gs.pendingGeneratedPreviews.tool || 'seedream',
        frame: frame,
        previewPath: previewPath,
        deletePreview: true
      });
      if (!result.ok) {
        var saveErr = new Error(result.error || 'Failed to save selected image');
        saveErr.code = result.code || 'SERVER_ERROR';
        throw saveErr;
      }

      gs.pendingGeneratedPreviews.paths = gs.pendingGeneratedPreviews.paths.filter(function(p) { return p !== previewPath; });
      if (Array.isArray(gs.pendingGeneratedPreviews.frameAssignments)) {
        gs.pendingGeneratedPreviews.frameAssignments = gs.pendingGeneratedPreviews.frameAssignments.filter(function(item) {
          return item && item.path !== previewPath;
        });
      }
      utils.showToast('Saved', 'Saved as ' + frame + ' frame', 'success', 2500);
      dispatchShotFlowEvent('PREVIEWS_SAVED', { frame: frame });
      await loadShotRenders();
      if (gs.pendingGeneratedPreviews.paths.length === 0) {
        closeGenerationChoiceModal();
      } else {
        openGenerationChoiceModal({
          shotId: gs.pendingGeneratedPreviews.shotId,
          variation: gs.pendingGeneratedPreviews.variation,
          tool: gs.pendingGeneratedPreviews.tool,
          images: gs.pendingGeneratedPreviews.paths,
          frameAssignments: gs.pendingGeneratedPreviews.frameAssignments
        });
      }
    } catch (err) {
      var classified = classifyError(err, 'SERVER_ERROR');
      utils.showToast('Save failed', toUserMessage(classified), 'error', 4500);
      dispatchShotFlowEvent('ERROR_SET', { code: classified.code, message: classified.message });
    }
  }

  async function discardPendingGeneratedPreviews() {
    var gs = getGenerationState();
    var projectState = getProjectState();
    var utils = getSharedUtils();
    if (!gs.pendingGeneratedPreviews || !projectState.currentProject) {
      closeGenerationChoiceModal();
      return;
    }

    try {
      await getGenerationReadinessService().discardShotPreview({
        project: projectState.currentProject.id,
        shotId: gs.pendingGeneratedPreviews.shotId,
        previewPaths: gs.pendingGeneratedPreviews.paths
      });
    } catch (e) {
      // Best effort cleanup
    }

    utils.showToast('Discarded', 'Generated previews were not saved.', 'info', 2500);
    closeGenerationChoiceModal();
  }

  function openGenerationChoiceModal(payload) {
    var gs = getGenerationState();
    var utils = getSharedUtils();
    var generationChoiceModal = el('generationChoiceModal');
    var generationChoiceGrid = el('generationChoiceGrid');
    var generationChoiceMeta = el('generationChoiceMeta');
    if (!generationChoiceModal || !generationChoiceGrid) return;
    var images = Array.isArray(payload.images) ? payload.images.filter(Boolean) : [];
    if (images.length === 0) {
      utils.showToast('No previews', 'No generated image was returned to review.', 'warning', 3000);
      return;
    }
    var frameAssignments = normalizeFrameAssignments(images, payload.frameAssignments);
    var isFirstLastPair = hasFirstLastPair(frameAssignments);

    gs.pendingGeneratedPreviews = {
      shotId: payload.shotId,
      variation: payload.variation,
      tool: payload.tool || 'seedream',
      paths: images.slice(),
      frameAssignments: frameAssignments
    };

    var projectState = getProjectState();
    var projectQuery = projectState.currentProject ? '?project=' + encodeURIComponent(projectState.currentProject.id) : '';
    generationChoiceGrid.innerHTML = '';
    if (generationChoiceMeta) {
      generationChoiceMeta.textContent = payload.shotId + ' \u00b7 Variation ' + payload.variation + ' \u00b7 '
        + (isFirstLastPair ? 'First + Last pair ready' : (images.length + ' option(s)'));
    }

    frameAssignments.forEach(function(assignment, index) {
      var previewPath = assignment.path;
      var mappedFrame = assignment.frame;
      var card = document.createElement('div');
      card.className = 'shot-render-card';

      var img = document.createElement('img');
      img.className = 'shot-render-image';
      img.src = '/' + previewPath + projectQuery;
      img.alt = 'Generated Preview ' + (index + 1);
      img.loading = 'lazy';
      img.addEventListener('click', function() { window.open(img.src, '_blank'); });

      var label = document.createElement('div');
      label.className = 'shot-render-label';
      var cardLabel = mappedFrame === 'first'
        ? 'First Frame Candidate'
        : (mappedFrame === 'last' ? 'Last Frame Candidate' : ('Option ' + (index + 1)));
      label.innerHTML = '<span class="render-frame-label">' + cardLabel + '</span><span class="render-variation-badge variation-' + utils.escapeHtml(payload.variation) + '">Var ' + utils.escapeHtml(payload.variation) + '</span>';

      var actions = document.createElement('div');
      actions.className = 'prompt-actions';
      actions.style.padding = '8px 12px 12px';
      actions.style.gap = '8px';

      var saveFirstBtn = document.createElement('button');
      saveFirstBtn.className = 'btn btn-primary btn-sm';
      saveFirstBtn.textContent = mappedFrame === 'first' ? 'Save First' : 'Save as First';
      (function(pp) {
        saveFirstBtn.addEventListener('click', function() { saveGeneratedPreview(pp, 'first'); });
      })(previewPath);

      var saveLastBtn = document.createElement('button');
      saveLastBtn.className = 'btn btn-secondary btn-sm';
      saveLastBtn.textContent = mappedFrame === 'last' ? 'Save Last' : 'Save as Last';
      (function(pp) {
        saveLastBtn.addEventListener('click', function() { saveGeneratedPreview(pp, 'last'); });
      })(previewPath);

      actions.appendChild(saveFirstBtn);
      actions.appendChild(saveLastBtn);
      card.appendChild(img);
      card.appendChild(label);
      card.appendChild(actions);
      generationChoiceGrid.appendChild(card);
    });

    generationChoiceModal.style.display = 'flex';
  }

  // --- Previs Map & Continuity ---

  async function loadPrevisMap() {
    var projectState = getProjectState();
    var reviewState = getReviewState();
    if (!projectState.currentProject) return {};
    var result = await getGenerationReadinessService().loadPrevisMap(projectState.currentProject.id);
    if (!result.ok) {
      var mapErr = new Error(result.error || 'Failed to load previs map');
      mapErr.code = result.code || 'SERVER_ERROR';
      throw mapErr;
    }
    reviewState.previsMapCache = (result.data && result.data.previsMap) || {};
    return reviewState.previsMapCache;
  }

  async function saveShotReferenceMode(shotId, mode) {
    var projectState = getProjectState();
    var reviewState = getReviewState();
    if (!projectState.currentProject || !shotId) return;
    var entry = (reviewState.previsMapCache && reviewState.previsMapCache[shotId]) || {};
    var payload = {
      project: projectState.currentProject.id,
      entry: {
        sourceType: entry.sourceType || 'manual',
        sourceRef: entry.sourceRef || '',
        notes: entry.notes || '',
        locked: Boolean(entry.locked),
        referenceMode: mode || 'continuity'
      }
    };

    var result = await getGenerationReadinessService().savePrevisMapEntry(projectState.currentProject.id, shotId, payload.entry);
    if (!result.ok) {
      var saveErr = new Error(result.error || 'Failed to save reference mode');
      saveErr.code = result.code || 'SERVER_ERROR';
      throw saveErr;
    }
    reviewState.previsMapCache[shotId] = (result.data && result.data.entry) || payload.entry;
  }

  async function saveShotContinuityToggle(shotId, enabled) {
    return saveShotReferenceMode(shotId, enabled ? 'continuity' : 'none');
  }

  // --- Variation Chosen ---

  async function loadVariationChosenState() {
    var promptsState = getPromptsState();
    var projectState = getProjectState();
    var checkbox = el('variationChosenCheckbox');
    var label = el('variationChosenLabel');
    if (!checkbox || !label) return;

    if (!promptsState.currentShot) {
      label.style.display = 'none';
      return;
    }

    label.style.display = 'flex';
    try {
      var result = await getReviewService().loadReviewSequence(projectState.currentProject ? projectState.currentProject.id : undefined);
      if (result.ok && result.data && Array.isArray(result.data.selections)) {
        var shotEntry = result.data.selections.find(function(s) { return s.shotId === promptsState.currentShot.shotId; });
        var isChosen = shotEntry && shotEntry.selectedVariation === promptsState.currentVariation;
        checkbox.checked = Boolean(isChosen);
        label.classList.toggle('is-chosen', Boolean(isChosen));
      } else {
        checkbox.checked = false;
        label.classList.remove('is-chosen');
      }
    } catch (err) {
      console.warn('[generation-workflow] loadVariationChosenState failed:', err.message || err);
      checkbox.checked = false;
      label.classList.remove('is-chosen');
    }
  }

  async function saveVariationChosen(chosen) {
    var promptsState = getPromptsState();
    var projectState = getProjectState();
    if (!promptsState.currentShot) return;

    var payload = {
      selections: [{
        shotId: promptsState.currentShot.shotId,
        selectedVariation: chosen ? promptsState.currentVariation : 'none'
      }]
    };

    var result = await getReviewService().saveStoryboardSequence({
      projectId: projectState.currentProject ? projectState.currentProject.id : undefined,
      payload: payload
    });
    if (!result.ok) {
      throw new Error(result.error || 'Failed to save chosen variation');
    }
  }

  // --- Reference Selector ---

  var _referenceOptionsCache = null;
  var _pendingReferenceSave = null;

  async function loadReferenceOptions() {
    var promptsState = getPromptsState();
    var projectState = getProjectState();
    var reviewState = getReviewState();
    var referenceSelector = el('referenceSelector');
    var referenceSelectorList = el('referenceSelectorList');

    if (!referenceSelector || !referenceSelectorList) return;
    if (!promptsState.currentShot || promptsState.currentTool !== 'seedream') {
      referenceSelector.style.display = 'none';
      return;
    }

    referenceSelector.style.display = 'block';

    try {
      var result = await getGenerationReadinessService().loadReferenceOptions({
        projectId: projectState.currentProject ? projectState.currentProject.id : '',
        shotId: promptsState.currentShot.shotId
      });

      if (!result.ok || !result.data) {
        referenceSelectorList.innerHTML = '<div style="padding:0.5rem 0.75rem;color:var(--text-muted);font-size:12px;">No reference data available.</div>';
        return;
      }

      var options = result.data.options || [];
      var maxSelectable = result.data.maxSelectable || 13;
      _referenceOptionsCache = { options: options, maxSelectable: maxSelectable };

      // Get current selections from previs map
      var cachedEntry = reviewState.previsMapCache && reviewState.previsMapCache[promptsState.currentShot.shotId];
      var currentMode = (cachedEntry && cachedEntry.referenceMode) || 'continuity';
      var savedSelections = (cachedEntry && Array.isArray(cachedEntry.selectedReferences)) ? cachedEntry.selectedReferences : [];

      var activeSelections;
      if (currentMode === 'custom') {
        // Custom mode: use exactly what the user saved (even if empty)
        activeSelections = new Set(savedSelections);
      } else if (currentMode === 'none') {
        activeSelections = new Set();
      } else {
        // Default (continuity): select all available
        activeSelections = new Set();
        for (var i = 0; i < options.length; i++) {
          if (options[i].available) activeSelections.add(options[i].id);
        }
      }

      renderReferenceSelectorList(options, activeSelections, maxSelectable);
    } catch (err) {
      console.warn('[generation-workflow] loadReferenceOptions failed:', err.message || err);
      referenceSelectorList.innerHTML = '<div style="padding:0.5rem 0.75rem;color:var(--text-muted);font-size:12px;">Failed to load references.</div>';
    }
  }

  function renderReferenceSelectorList(options, activeSelections, maxSelectable) {
    var referenceSelectorList = el('referenceSelectorList');
    if (!referenceSelectorList) return;
    var projectState = getProjectState();
    var projectParam = projectState.currentProject ? '?project=' + projectState.currentProject.id : '';

    referenceSelectorList.innerHTML = '';
    var lastCategory = '';
    var lastEntityId = '';
    var currentThumbGrid = null;

    for (var i = 0; i < options.length; i++) {
      var opt = options[i];

      // Category header (Continuity, Characters, Locations)
      if (opt.category !== lastCategory) {
        lastCategory = opt.category;
        lastEntityId = '';
        var catHeader = document.createElement('div');
        catHeader.className = 'reference-category-header';
        catHeader.textContent = opt.category === 'continuity' ? 'Continuity' : opt.category === 'character' ? 'Characters' : 'Locations';
        referenceSelectorList.appendChild(catHeader);
      }

      // Entity sub-group (e.g., CHAR_HOST, LOC_NEON_ALLEY)
      var entityKey = opt.entityId || opt.id;
      if (entityKey !== lastEntityId) {
        lastEntityId = entityKey;
        var entityGroup = document.createElement('div');
        entityGroup.className = 'reference-entity-group';

        if (opt.entityId) {
          var entityLabel = document.createElement('div');
          entityLabel.className = 'reference-entity-label';
          entityLabel.textContent = opt.label;
          entityGroup.appendChild(entityLabel);
        }

        var thumbGrid = document.createElement('div');
        thumbGrid.className = 'reference-thumb-grid';
        entityGroup.appendChild(thumbGrid);
        currentThumbGrid = thumbGrid;
        referenceSelectorList.appendChild(entityGroup);
      }

      // Thumbnail tile
      var tile = document.createElement('div');
      tile.className = 'reference-thumb-tile';
      tile.dataset.refId = opt.id;

      if (!opt.available) {
        tile.classList.add('unavailable');
      } else if (activeSelections.has(opt.id)) {
        tile.classList.add('selected');
      }

      // Hidden checkbox for save/count logic compatibility
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = opt.id;
      checkbox.checked = opt.available && activeSelections.has(opt.id);
      checkbox.disabled = !opt.available;
      checkbox.className = 'reference-hidden-checkbox';
      tile.appendChild(checkbox);

      // Thumbnail image or placeholder
      if (opt.path && opt.available) {
        var thumb = document.createElement('img');
        thumb.className = 'reference-tile-img';
        thumb.loading = 'lazy';
        thumb.src = '/' + opt.path + projectParam;
        thumb.alt = opt.label + ' - ' + (opt.sublabel || '');
        thumb.onerror = function() { this.style.display = 'none'; };
        tile.appendChild(thumb);
      } else {
        var placeholder = document.createElement('div');
        placeholder.className = 'reference-tile-placeholder';
        placeholder.textContent = 'N/A';
        tile.appendChild(placeholder);
      }

      // Checkmark overlay
      var checkOverlay = document.createElement('div');
      checkOverlay.className = 'reference-tile-check';
      checkOverlay.innerHTML = '&#10003;';
      tile.appendChild(checkOverlay);

      // Sublabel
      var sublabel = document.createElement('div');
      sublabel.className = 'reference-tile-sublabel';
      sublabel.textContent = opt.sublabel || opt.label;
      tile.appendChild(sublabel);

      currentThumbGrid.appendChild(tile);
    }

    updateReferenceSelectorCount();
  }

  function updateReferenceSelectorCount() {
    var referenceSelectorList = el('referenceSelectorList');
    var countEl = el('referenceSelectorCount');
    if (!referenceSelectorList || !countEl) return;
    var checkboxes = referenceSelectorList.querySelectorAll('input[type="checkbox"]');
    var checked = 0;
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) checked++;
    }
    var max = (_referenceOptionsCache && _referenceOptionsCache.maxSelectable) || 13;
    countEl.textContent = checked + ' / ' + max + ' selected';
  }

  async function saveSelectedReferences() {
    var promptsState = getPromptsState();
    var projectState = getProjectState();
    var reviewState = getReviewState();
    var utils = getSharedUtils();
    var referenceSelectorList = el('referenceSelectorList');
    if (!referenceSelectorList || !promptsState.currentShot || !projectState.currentProject) return;

    var checkboxes = referenceSelectorList.querySelectorAll('input[type="checkbox"]');
    var selectedIds = [];
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) selectedIds.push(checkboxes[i].value);
    }

    var entry = (reviewState.previsMapCache && reviewState.previsMapCache[promptsState.currentShot.shotId]) || {};
    var payload = {
      sourceType: entry.sourceType || 'manual',
      sourceRef: entry.sourceRef || '',
      notes: entry.notes || '',
      locked: Boolean(entry.locked),
      referenceMode: 'custom',
      selectedReferences: selectedIds
    };

    var savePromise = (async function() {
      try {
        var result = await getGenerationReadinessService().savePrevisMapEntry(
          projectState.currentProject.id,
          promptsState.currentShot.shotId,
          payload
        );
        if (result.ok) {
          reviewState.previsMapCache[promptsState.currentShot.shotId] = (result.data && result.data.entry) || payload;
        } else {
          utils.showToast('Reference save failed', 'Your selection may not be used during generation.', 'warning', 3000);
        }
      } catch (err) {
        utils.showToast('Reference save failed', 'Your selection may not be used during generation.', 'warning', 3000);
      }
    })();
    _pendingReferenceSave = savePromise;
    await savePromise;
    if (_pendingReferenceSave === savePromise) {
      _pendingReferenceSave = null;
    }

    updateReferenceSelectorCount();
  }

  function refSelectAll() {
    var referenceSelectorList = el('referenceSelectorList');
    if (!referenceSelectorList) return;
    var tiles = referenceSelectorList.querySelectorAll('.reference-thumb-tile:not(.unavailable)');
    for (var i = 0; i < tiles.length; i++) {
      var cb = tiles[i].querySelector('input[type="checkbox"]');
      if (cb) cb.checked = true;
      tiles[i].classList.add('selected');
    }
    saveSelectedReferences();
  }

  function refClearAll() {
    var referenceSelectorList = el('referenceSelectorList');
    if (!referenceSelectorList) return;
    var tiles = referenceSelectorList.querySelectorAll('.reference-thumb-tile');
    for (var i = 0; i < tiles.length; i++) {
      var cb = tiles[i].querySelector('input[type="checkbox"]');
      if (cb) cb.checked = false;
      tiles[i].classList.remove('selected');
    }
    saveSelectedReferences();
  }

  // --- Shot Renders ---

  async function loadShotRenders() {
    var promptsState = getPromptsState();
    var projectState = getProjectState();
    var reviewState = getReviewState();
    var gs = getGenerationState();
    var utils = getSharedUtils();

    var shotRenders = el('shotRenders');
    var shotRendersGrid = el('shotRendersGrid');
    var shotGenerationLayout = el('shotGenerationLayout');
    var continuityNote = el('continuityNote');
    var referenceSelector = el('referenceSelector');
    var generationHistorySection = el('generationHistorySection');
    var generationHistoryList = el('generationHistoryList');
    var generationMetrics = el('generationMetrics');
    if (!shotRenders || !shotRendersGrid) return;

    if (!promptsState.currentShot || (promptsState.currentTool !== 'seedream' && promptsState.currentTool !== 'kling')) {
      shotRenders.style.display = 'none';
      if (shotGenerationLayout) {
        shotGenerationLayout.style.display = promptsState.currentShot ? 'grid' : 'none';
        shotGenerationLayout.style.gridTemplateColumns = '1fr';
      }
      if (continuityNote) { continuityNote.textContent = ''; continuityNote.classList.remove('warning'); }
      if (referenceSelector) referenceSelector.style.display = 'none';
      if (!gs.activeGenerationJobId) setGenerationControlsForActiveJob(false);
      setGenerationHistoryAutoRefresh(false);
      if (generationHistorySection) generationHistorySection.style.display = 'none';
      if (generationHistoryList) generationHistoryList.innerHTML = '';
      setGenerationJobStatus('');
      if (generationMetrics) generationMetrics.textContent = '';
      return;
    }

    try {
      var projectParam = projectState.currentProject ? projectState.currentProject.id : 'default';
      if (promptsState.currentTool === 'seedream') {
        try { await loadPrevisMap(); } catch (mapErr) {
          console.warn('[generation-workflow] loadPrevisMap failed:', mapErr.message || mapErr);
          reviewState.previsMapCache = {};
        }
      }
      var rendersResult = await getGenerationReadinessService().loadShotRenders(projectParam, promptsState.currentShot.shotId);
      if (!rendersResult.ok || !rendersResult.data) {
        shotRenders.style.display = 'none';
        await loadShotGenerationHistory();
        return;
      }

      var data = rendersResult.data;
      var toolRenders = (data.renders && data.renders[promptsState.currentTool]) || {};

      if (shotGenerationLayout) { shotGenerationLayout.style.display = 'grid'; shotGenerationLayout.style.gridTemplateColumns = ''; }
      shotRenders.style.display = 'block';
      shotRendersGrid.innerHTML = '';

      var projectParam2 = projectState.currentProject ? '?project=' + projectState.currentProject.id : '';

      // Current variation
      var currentRenders = toolRenders[promptsState.currentVariation] || { first: null, last: null };
      var firstPath = currentRenders.first;
      var firstSlotMeta = {
        source: currentRenders.first ? 'direct' : 'none',
        text: currentRenders.first ? 'Manual' : 'Missing',
        canDelete: true
      };

      if (promptsState.currentTool === 'seedream') {
        var resolvedFirst = (data.resolved && data.resolved.seedream && data.resolved.seedream[promptsState.currentVariation] && data.resolved.seedream[promptsState.currentVariation].first) || null;
        var continuityForVariation = (data.continuity && data.continuity.seedream && data.continuity.seedream.byVariation && data.continuity.seedream.byVariation[promptsState.currentVariation]) || null;

        firstPath = resolvedFirst && resolvedFirst.path || null;

        if (resolvedFirst && resolvedFirst.source === 'inherited') {
          firstSlotMeta = { source: 'inherited', text: 'Inherited ' + (resolvedFirst.inheritedFromShotId || '') + ' A last', canDelete: false };
        } else if (resolvedFirst && resolvedFirst.source === 'direct') {
          firstSlotMeta = { source: 'direct', text: 'Manual', canDelete: true };
        } else {
          firstSlotMeta = { source: 'none', text: 'Missing', canDelete: true };
        }

        if (continuityNote) {
          var reason = continuityForVariation && continuityForVariation.reason || '';
          continuityNote.classList.remove('warning');
          if (resolvedFirst && resolvedFirst.source === 'inherited') {
            var inheritVar = (resolvedFirst.inheritedFromVariation || 'A');
            continuityNote.textContent = 'Using ' + ((resolvedFirst && resolvedFirst.inheritedFromShotId) || 'previous shot') + ' variation ' + inheritVar + ' last frame.';
          } else if (resolvedFirst && resolvedFirst.source === 'direct') {
            continuityNote.textContent = 'Manual first frame override is active.';
          } else if (reason === 'missing_previous_last') {
            continuityNote.textContent = 'Missing continuity source: previous shot has no last frame for chosen variation.';
            continuityNote.classList.add('warning');
          } else if (reason === 'no_previous_shot') {
            continuityNote.textContent = 'No previous shot found in order.';
          } else {
            continuityNote.textContent = '';
          }
        }
        await loadReferenceOptions();
      } else {
        if (continuityNote) { continuityNote.textContent = ''; continuityNote.classList.remove('warning'); }
        if (referenceSelector) referenceSelector.style.display = 'none';
      }

      var firstSlot = createFrameUploadSlot(
        promptsState.currentShot.shotId, promptsState.currentVariation, 'first', promptsState.currentTool,
        firstPath, projectParam2, firstSlotMeta
      );
      shotRendersGrid.appendChild(firstSlot);

      var lastSlot = createFrameUploadSlot(
        promptsState.currentShot.shotId, promptsState.currentVariation, 'last', promptsState.currentTool,
        currentRenders.last, projectParam2, {
          source: currentRenders.last ? 'direct' : 'none',
          text: currentRenders.last ? 'Manual' : 'Missing',
          canDelete: true
        }
      );
      shotRendersGrid.appendChild(lastSlot);

      await loadShotGenerationHistory();
      loadGenerationMetrics();
      loadVariationChosenState();

    } catch (err) {
      console.warn('[generation-workflow] loadShotRenders failed:', err.message || err);
      shotRenders.style.display = 'none';
      if (shotGenerationLayout) {
        shotGenerationLayout.style.display = promptsState.currentShot ? 'grid' : 'none';
        shotGenerationLayout.style.gridTemplateColumns = '1fr';
      }
      if (continuityNote) { continuityNote.textContent = ''; continuityNote.classList.remove('warning'); }
      if (referenceSelector) referenceSelector.style.display = 'none';
      await loadShotGenerationHistory();
      loadGenerationMetrics();
      loadVariationChosenState();
    }
  }

  // --- Frame Upload Slot ---

  function createFrameUploadSlot(shotId, variation, frame, tool, existingPath, projectParam, meta) {
    var utils = getSharedUtils();
    var slot = document.createElement('div');
    slot.className = 'frame-upload-slot' + (existingPath ? ' has-image' : '');
    var slotMeta = meta || {
      source: existingPath ? 'direct' : 'none',
      text: existingPath ? 'Manual' : 'Missing',
      canDelete: true
    };

    if (existingPath) {
      var img = document.createElement('img');
      img.className = 'shot-render-image';
      img.src = '/' + existingPath + projectParam;
      img.alt = (frame === 'first' ? 'First' : 'Last') + ' Frame - Variation ' + variation;
      img.loading = 'lazy';
      img.addEventListener('click', function() { window.open(img.src, '_blank'); });
      slot.appendChild(img);

      var overlay = document.createElement('div');
      overlay.className = 'frame-slot-overlay';

      var replaceBtn = document.createElement('button');
      replaceBtn.className = 'btn btn-primary btn-sm';
      replaceBtn.textContent = 'Replace';
      replaceBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        triggerFrameUpload(shotId, variation, frame, tool);
      });

      if (slotMeta.canDelete !== false) {
        var delBtn = document.createElement('button');
        delBtn.className = 'btn btn-secondary btn-sm';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          deleteShotRender(shotId, variation, frame, tool);
        });
        overlay.appendChild(delBtn);
      }
      overlay.appendChild(replaceBtn);
      slot.appendChild(overlay);
    } else {
      var iconEl = document.createElement('div');
      iconEl.className = 'frame-slot-icon';
      iconEl.textContent = frame === 'first' ? '1' : '2';
      var labelEl = document.createElement('div');
      labelEl.className = 'frame-slot-label';
      labelEl.textContent = frame === 'first' ? 'First Frame' : 'Last Frame';
      var hintEl = document.createElement('div');
      hintEl.className = 'frame-slot-hint';
      hintEl.textContent = 'Click or drag & drop';
      slot.appendChild(iconEl);
      slot.appendChild(labelEl);
      slot.appendChild(hintEl);
      slot.addEventListener('click', function() { triggerFrameUpload(shotId, variation, frame, tool); });
    }

    // Drag-and-drop
    slot.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragleave', function(e) { e.preventDefault(); e.stopPropagation(); slot.classList.remove('drag-over'); });
    slot.addEventListener('drop', function(e) {
      e.preventDefault(); e.stopPropagation(); slot.classList.remove('drag-over');
      var file = e.dataTransfer.files[0];
      if (file) uploadShotFrame(shotId, variation, frame, tool, file);
    });

    // Label bar
    var labelBar = document.createElement('div');
    labelBar.className = 'shot-render-label';
    var frameLabel = frame === 'first' ? 'First Frame' : 'Last Frame';
    labelBar.innerHTML = '<span class="render-frame-label">' + frameLabel + '<span class="render-frame-source source-' + utils.escapeHtml(slotMeta.source || 'none') + '">' + utils.escapeHtml(slotMeta.text || '') + '</span></span><span class="render-variation-badge variation-' + variation + '">Var ' + variation + '</span>';
    slot.appendChild(labelBar);

    // Hidden file input
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'frame-' + shotId + '-' + variation + '-' + frame + '-' + tool;
    fileInput.accept = 'image/png,image/jpeg,image/jpg,image/webp';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function() {
      if (this.files[0]) uploadShotFrame(shotId, variation, frame, tool, this.files[0]);
      this.value = '';
    });
    slot.appendChild(fileInput);

    return slot;
  }

  function triggerFrameUpload(shotId, variation, frame, tool) {
    var input = el('frame-' + shotId + '-' + variation + '-' + frame + '-' + tool);
    if (input) input.click();
  }

  async function uploadShotFrame(shotId, variation, frame, tool, file) {
    var projectState = getProjectState();
    var utils = getSharedUtils();
    if (!file || !projectState.currentProject) return;

    var frameLabel = frame === 'first' ? 'First Frame' : 'Last Frame';
    utils.showToast('Uploading', frameLabel + ' for ' + shotId + ' ' + variation + '...', 'info', 2000);

    try {
      var result = await getReferenceFeature().uploadShotRenderFrame({
        projectId: projectState.currentProject.id,
        shotId: shotId,
        variation: variation,
        frame: frame,
        tool: tool,
        file: file
      });
      if (result.ok) {
        utils.showToast('Uploaded', frameLabel + ' uploaded', 'success', 2000);
        await loadShotRenders();
      } else {
        utils.showToast('Upload failed', result.error || 'Unknown error', 'error', 4000);
      }
    } catch (err) {
      utils.showToast('Upload failed', err.message, 'error', 4000);
    }
  }

  async function deleteShotRender(shotId, variation, frame, tool) {
    var projectState = getProjectState();
    var utils = getSharedUtils();
    var frameLabel = frame === 'first' ? 'First Frame' : 'Last Frame';
    if (!confirm('Delete ' + frameLabel + ' for ' + shotId + ' variation ' + variation + '?')) return;

    try {
      var result = await getGenerationReadinessService().deleteShotRender({
        projectId: projectState.currentProject.id,
        shotId: shotId,
        variation: variation,
        frame: frame,
        tool: tool
      });

      if (result.ok) {
        utils.showToast('Deleted', frameLabel + ' deleted', 'success', 2000);
        await loadShotRenders();
      } else {
        utils.showToast('Delete failed', result.error || 'Unknown error', 'error', 4000);
      }
    } catch (err) {
      utils.showToast('Delete failed', err.message, 'error', 4000);
    }
  }

  function createRenderCard(imagePath, label, variation, projectParam) {
    var promptsState = getPromptsState();
    var utils = getSharedUtils();
    var card = document.createElement('div');
    card.className = 'shot-render-card';
    if (variation === promptsState.currentVariation) card.classList.add('current-variation');

    var img = document.createElement('img');
    img.className = 'shot-render-image';
    img.src = '/' + imagePath + projectParam;
    img.alt = label + ' - Variation ' + variation;
    img.loading = 'lazy';
    img.addEventListener('click', function() { window.open(img.src, '_blank'); });

    var labelEl = document.createElement('div');
    labelEl.className = 'shot-render-label';
    labelEl.innerHTML = '<span class="render-frame-label">' + utils.escapeHtml(label) + '</span><span class="render-variation-badge variation-' + variation + '">Var ' + variation + '</span>';

    card.appendChild(img);
    card.appendChild(labelEl);
    return card;
  }

  // --- Generation History ---

  function renderShotGenerationHistory(jobs) {
    var gs = getGenerationState();
    var generationHistoryList = el('generationHistoryList');
    if (!generationHistoryList) return;
    generationHistoryList.innerHTML = '';
    var list = Array.isArray(jobs) ? jobs : [];
    gs.generationHistoryJobsById = new Map(list.map(function(job) { return [job.jobId, job]; }));

    if (list.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'generation-history-empty';
      empty.textContent = 'No generation jobs yet for this shot.';
      generationHistoryList.appendChild(empty);
      return;
    }

    list.slice(0, 16).forEach(function(job) {
      var status = String(job.status || '').toLowerCase();
      var variation = String((job.input && job.input.variation) || 'A').toUpperCase();
      var requireReference = Boolean(job.input && job.input.requireReference);
      var requestedMaxImages = Number(job.input && job.input.maxImages);
      var frameAssignments = Array.isArray(job.result && job.result.frameAssignments) ? job.result.frameAssignments : [];
      var modeLabel = hasFirstLastPair(frameAssignments) || requestedMaxImages === 2
        ? 'First+Last'
        : (requireReference ? 'Ref image' : 'Single image');
      var duration = formatJobDuration(job);
      var refCount = Number((job.result && job.result.referenceCount) || 0);
      var refMeta = refCount > 0 ? ' \u00b7 refs ' + refCount : '';

      var item = document.createElement('div');
      item.className = 'generation-history-item status-' + status;

      var top = document.createElement('div');
      top.className = 'generation-history-top';
      var main = document.createElement('div');
      main.className = 'generation-history-main';
      main.textContent = 'Var ' + variation + ' \u00b7 ' + modeLabel + refMeta;
      var badge = document.createElement('span');
      badge.className = 'render-variation-badge variation-' + (/^[A-D]$/.test(variation) ? variation : 'A');
      badge.textContent = status || 'unknown';
      top.appendChild(main);
      top.appendChild(badge);

      var meta = document.createElement('div');
      meta.className = 'generation-history-meta';
      meta.textContent = formatJobCreatedAt(job.createdAt) + (duration ? ' \u00b7 ' + duration : '');

      item.appendChild(top);
      item.appendChild(meta);

      if (status === 'failed' && job.error && job.error.message) {
        var error = document.createElement('div');
        error.className = 'generation-history-error';
        error.textContent = job.error.message;
        item.appendChild(error);
      }

      var actions = document.createElement('div');
      actions.className = 'generation-history-actions';

      var detailsBtn = document.createElement('button');
      detailsBtn.className = 'btn btn-secondary btn-sm';
      detailsBtn.textContent = 'Details';
      (function(jid) {
        detailsBtn.addEventListener('click', function() { openGenerationJobDetailsModal(jid); });
      })(job.jobId);
      actions.appendChild(detailsBtn);

      if (status === 'running' || status === 'queued') {
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary btn-sm';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.disabled = Boolean(gs.activeGenerationJobId && gs.activeGenerationJobId !== job.jobId);
        (function(jid) {
          cancelBtn.addEventListener('click', function() { cancelGenerationJobById(jid); });
        })(job.jobId);
        actions.appendChild(cancelBtn);
      }

      if (status === 'failed' || status === 'canceled') {
        var retryBtn = document.createElement('button');
        retryBtn.className = 'btn btn-secondary btn-sm';
        retryBtn.textContent = 'Retry';
        retryBtn.disabled = Boolean(gs.activeGenerationJobId);
        (function(jid) {
          retryBtn.addEventListener('click', function() { retryGenerationJobFromHistory(jid); });
        })(job.jobId);
        actions.appendChild(retryBtn);
      }

      item.appendChild(actions);
      generationHistoryList.appendChild(item);
    });
  }

  async function loadShotGenerationHistory() {
    var gs = getGenerationState();
    var promptsState = getPromptsState();
    var projectState = getProjectState();
    var generationHistorySection = el('generationHistorySection');
    var generationHistoryList = el('generationHistoryList');

    if (!generationHistorySection || !generationHistoryList || !projectState.currentProject || !promptsState.currentShot || promptsState.currentTool !== 'seedream') {
      if (generationHistorySection) generationHistorySection.style.display = 'none';
      if (generationHistoryList) generationHistoryList.innerHTML = '';
      gs.generationHistoryJobsById = new Map();
      setGenerationHistoryAutoRefresh(false);
      return;
    }

    generationHistorySection.style.display = 'block';
    try {
      var params = {
        project: projectState.currentProject.id,
        type: 'generate-shot',
        shotId: promptsState.currentShot.shotId,
        limit: 40
      };
      var result = await getGenerationJobsService().listJobs(params);
      if (!result.ok) {
        throw new Error(result.error || 'Failed to load generation history');
      }
      var jobs = (result.data && result.data.jobs) || [];
      renderShotGenerationHistory(jobs);
      var hasActive = jobs.some(function(job) {
        var status = String(job.status || '').toLowerCase();
        return status === 'running' || status === 'queued';
      });
      setGenerationHistoryAutoRefresh(hasActive);
    } catch (e) {
      renderShotGenerationHistory([]);
      setGenerationHistoryAutoRefresh(false);
    }
  }

  async function loadGenerationMetrics() {
    var gs = getGenerationState();
    var projectState = getProjectState();
    var generationMetricsEl = el('generationMetrics');

    if (!projectState.currentProject) {
      gs.generationMetricsCache = null;
      if (generationMetricsEl) generationMetricsEl.textContent = '';
      return;
    }

    try {
      var result = await getGenerationJobsService().getMetrics(projectState.currentProject.id, 150);
      if (!result.ok) {
        throw new Error(result.error || 'Failed to load generation metrics');
      }

      gs.generationMetricsCache = (result.data && result.data.metrics) || null;
      var counts = gs.generationMetricsCache && gs.generationMetricsCache.counts ? gs.generationMetricsCache.counts : null;
      if (!counts) {
        if (generationMetricsEl) generationMetricsEl.textContent = '';
        return;
      }

      var terminal = (counts.completed || 0) + (counts.failed || 0) + (counts.canceled || 0);
      var successRate = Number(gs.generationMetricsCache.successRate || 0).toFixed(1);
      var avgDuration = Number(gs.generationMetricsCache.avgDurationSec || 0).toFixed(1);
      var running = Number(counts.running || 0);
      var summary = terminal > 0
        ? 'Gen health ' + successRate + '% ok \u00b7 avg ' + avgDuration + 's \u00b7 running ' + running
        : 'Gen health pending \u00b7 running ' + running;
      if (generationMetricsEl) generationMetricsEl.textContent = summary;
    } catch (e) {
      gs.generationMetricsCache = null;
      if (generationMetricsEl) generationMetricsEl.textContent = '';
    }
  }

  async function cancelActiveGenerationJob() {
    var gs = getGenerationState();
    var generationCancelBtn = el('generationCancelBtn');
    if (!gs.activeGenerationJobId) return;
    if (generationCancelBtn) generationCancelBtn.disabled = true;
    try {
      await cancelGenerationJobById(gs.activeGenerationJobId);
    } finally {
      if (generationCancelBtn) generationCancelBtn.disabled = false;
    }
  }

  async function cancelGenerationJobById(jobId) {
    var gs = getGenerationState();
    var utils = getSharedUtils();
    if (!jobId) return;
    try {
      var result = await getGenerationJobsService().cancelJob(jobId);
      if (!result.ok) {
        throw new Error(result.error || 'Failed to cancel generation job');
      }
      if (jobId === gs.activeGenerationJobId) {
        setGenerationJobStatus('Cancel requested...', 'running');
      }
      utils.showToast('Cancel requested', 'Generation job cancellation requested.', 'info', 2500);
    } catch (err) {
      utils.showToast('Cancel failed', err.message || 'Could not cancel generation job', 'error', 4000);
    } finally {
      await loadShotGenerationHistory();
      await loadGenerationMetrics();
    }
  }

  async function retryGenerationJobFromHistory(jobId, overrides) {
    var projectState = getProjectState();
    var promptsState = getPromptsState();
    var utils = getSharedUtils();
    if (!projectState.currentProject || !jobId) return;
    try {
      var payload = { projectId: projectState.currentProject.id };
      if (overrides && Object.keys(overrides).length > 0) {
        payload.overrides = overrides;
      }
      var result = await getGenerationJobsService().retryJob(jobId, payload);
      var data = result.data || {};

      var runJobId = '';
      if (result.ok && data.jobId) {
        runJobId = data.jobId;
      } else if (result.status === 409 && result.code === 'LOCK_CONFLICT' && data.activeJobId) {
        runJobId = data.activeJobId;
        utils.showToast('Generation In Progress', 'Using active generation job for this shot.', 'info', 2500);
      } else {
        throw new Error(result.error || 'Failed to retry generation');
      }

      closeGenerationJobDetailsModal();
      var job = await trackGenerationJob(runJobId, null);
      var output = job.result || {};
      if (Array.isArray(output.images) && output.images.length > 0) {
        openGenerationChoiceModal({
          shotId: output.shotId || (promptsState.currentShot && promptsState.currentShot.shotId) || '',
          variation: output.variation || promptsState.currentVariation,
          tool: 'seedream',
          images: output.images,
          frameAssignments: output.frameAssignments || []
        });
      }

      await loadShotGenerationHistory();
    } catch (err) {
      utils.showToast('Retry failed', err.message || 'Could not retry generation', 'error', 5000);
      await loadShotGenerationHistory();
    }
  }

  async function retryGenerationJobFromDetails(useOverrides) {
    var gs = getGenerationState();
    if (!gs.generationDetailsJobId) return;
    var sourceJobId = gs.generationDetailsJobId;
    var overrides = useOverrides ? collectGenerationRetryOverridesFromForm() : null;

    var generationJobRetryDefaultBtn = el('generationJobRetryDefaultBtn');
    var generationJobRetryOverrideBtn = el('generationJobRetryOverrideBtn');
    if (generationJobRetryDefaultBtn) generationJobRetryDefaultBtn.disabled = true;
    if (generationJobRetryOverrideBtn) generationJobRetryOverrideBtn.disabled = true;
    try {
      await retryGenerationJobFromHistory(sourceJobId, overrides);
    } finally {
      if (generationJobRetryDefaultBtn) generationJobRetryDefaultBtn.disabled = false;
      if (generationJobRetryOverrideBtn) generationJobRetryOverrideBtn.disabled = false;
    }
  }

  // --- Generate Image for character references ---

  async function generateImage(characterName, slotNum) {
    var refMgr = root.ReferenceManager;
    var activeGenerations = refMgr ? refMgr.getActiveGenerations() : new Set();
    var projectState = getProjectState();
    var utils = getSharedUtils();

    var genKey = characterName + '-' + slotNum;
    if (activeGenerations.has(genKey)) return;

    activeGenerations.add(genKey);
    if (refMgr) refMgr.renderCharactersReferences(generateImage);

    var loadingToastId = utils.showToast(
      'Generating Image...',
      characterName + ' - ' + (root.ReferenceManager && root.ReferenceManager.PROMPT_SLOT_LABELS ? root.ReferenceManager.PROMPT_SLOT_LABELS[slotNum - 1] : 'Slot ' + slotNum),
      'info', 0
    );

    try {
      var result = await getGenerationReadinessService().generateImage({
        project: projectState.currentProject.id,
        mode: 'character',
        character: characterName,
        slot: slotNum
      });
      utils.dismissToast(loadingToastId);

      if (result.ok) {
        var payload = result.data || {};
        utils.showToast(
          'Image Generated',
          characterName + ' slot ' + slotNum + ' - ' + Number(payload.duration || 0).toFixed(1) + 's',
          'success', 5000
        );
        if (refMgr) await refMgr.loadCharactersReferences();
      } else {
        utils.showToast('Generation Failed', result.error, 'error', 6000);
      }
    } catch (err) {
      utils.dismissToast(loadingToastId);
      utils.showToast('Generation Error', err.message, 'error', 6000);
    } finally {
      activeGenerations.delete(genKey);
      if (refMgr) refMgr.renderCharactersReferences(generateImage);
    }
  }

  root.GenerationWorkflow = {
    init: init,
    closeGenerationJobStream: closeGenerationJobStream,
    stopGenerationHistoryAutoRefresh: stopGenerationHistoryAutoRefresh,
    generateShot: generateShot,
    generateImage: generateImage,
    generateReferencedImage: generateReferencedImage,
    runGenerationJob: runGenerationJob,
    trackGenerationJob: trackGenerationJob,
    loadShotRenders: loadShotRenders,
    createFrameUploadSlot: createFrameUploadSlot,
    openGenerationChoiceModal: openGenerationChoiceModal,
    closeGenerationChoiceModal: closeGenerationChoiceModal,
    openReplicateKeyModal: openReplicateKeyModal,
    closeReplicateKeyModal: closeReplicateKeyModal,
    saveSessionReplicateKey: saveSessionReplicateKey,
    clearSessionReplicateKey: clearSessionReplicateKey,
    loadPrevisMap: loadPrevisMap,
    saveShotContinuityToggle: saveShotContinuityToggle,
    saveShotReferenceMode: saveShotReferenceMode,
    loadReferenceOptions: loadReferenceOptions,
    saveSelectedReferences: saveSelectedReferences,
    refSelectAll: refSelectAll,
    refClearAll: refClearAll,
    loadShotGenerationHistory: loadShotGenerationHistory,
    loadGenerationMetrics: loadGenerationMetrics,
    refreshGenerationMetrics: loadGenerationMetrics,
    openGenerationJobDetailsModal: openGenerationJobDetailsModal,
    closeGenerationJobDetailsModal: closeGenerationJobDetailsModal,
    cancelActiveGenerationJob: cancelActiveGenerationJob,
    cancelGenerationJobById: cancelGenerationJobById,
    retryGenerationJobFromHistory: retryGenerationJobFromHistory,
    retryGenerationJobFromDetails: retryGenerationJobFromDetails,
    discardPendingGeneratedPreviews: discardPendingGeneratedPreviews,
    saveGeneratedPreview: saveGeneratedPreview,
    setGenerationJobStatus: setGenerationJobStatus,
    setGenerationControlsForActiveJob: setGenerationControlsForActiveJob,
    saveVariationChosen: saveVariationChosen,
    loadVariationChosenState: loadVariationChosenState
  };
})(typeof window !== 'undefined' ? window : globalThis);
