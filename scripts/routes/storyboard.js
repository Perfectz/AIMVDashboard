const fs = require('fs');
const path = require('path');
const { createVideoAssemblyService } = require('../services/video_assembly_service');

function registerStoryboardRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    jsonBody,
    MAX_BODY_SIZE,
    getProjectContext,
    resolveProjectId,
    projectManager,
    sanitizePathSegment,
    SHOT_ID_REGEX,
    VARIATION_REGEX,
    readPrevisMapFile,
    writePrevisMapFile,
    validatePrevisEntry,
    readSequenceFile,
    writeSequenceFile,
    normalizeSequenceReviewFields,
    normalizeShotReviewFields,
    normalizeAssignee,
    getReviewMetadataMap,
    sanitizeReviewMetadata,
    writeJsonPreserveEol,
    listShotRenderEntries
  } = ctx;

  router.get('/api/storyboard/previs-map', wrapAsync(async (req, res) => {
    const { projectId } = getProjectContext(req);
    const previsMap = readPrevisMapFile(projectId);
    sendJSON(res, 200, { success: true, projectId, previsMap });
  }));

  router.put('/api/storyboard/previs-map/:shotId', wrapAsync(async (req, res) => {
    const shotId = String(req.params.shotId || '').trim();
    const payload = await jsonBody(req, MAX_BODY_SIZE);

    sanitizePathSegment(shotId, SHOT_ID_REGEX, 'shot');
    const { project, entry } = payload;
    const projectId = resolveProjectId(project || projectManager.getActiveProject(), { required: true });

    const sanitizedEntry = validatePrevisEntry(entry);
    const previsMap = readPrevisMapFile(projectId);
    previsMap[shotId] = sanitizedEntry;
    writePrevisMapFile(previsMap, projectId);

    sendJSON(res, 200, { success: true, shotId, entry: sanitizedEntry });
  }));

  router.delete('/api/storyboard/previs-map/:shotId', wrapAsync(async (req, res) => {
    const shotId = String(req.params.shotId || '').trim();
    sanitizePathSegment(shotId, SHOT_ID_REGEX, 'shot');
    const projectId = resolveProjectId(req.query.project || projectManager.getActiveProject(), { required: true });

    const previsMap = readPrevisMapFile(projectId);
    delete previsMap[shotId];
    writePrevisMapFile(previsMap, projectId);

    sendJSON(res, 200, { success: true, shotId });
  }));

  router.get('/api/review/sequence', wrapAsync(async (req, res) => {
    const { projectId } = getProjectContext(req, { required: true });
    const sequence = readSequenceFile(projectId);
    normalizeSequenceReviewFields(sequence);
    if (!Array.isArray(sequence.selections)) {
      sequence.selections = [];
    }
    if (!Array.isArray(sequence.editorialOrder)) {
      sequence.editorialOrder = sequence.selections.map((shot) => shot.shotId);
    }
    sequence.totalShots = sequence.selections.length;

    // Enrich each shot's renderFiles with discovered renders from disk
    if (listShotRenderEntries) {
      for (const shot of sequence.selections) {
        const discovered = listShotRenderEntries(projectId, shot.shotId);
        if (!shot.renderFiles) shot.renderFiles = {};
        shot.renderFiles.seedream = discovered.seedream || {};
        // Merge kling discovered files into existing (prefer disk over empty stored entries)
        const storedKling = shot.renderFiles.kling || {};
        const discoveredKling = discovered.kling || {};
        shot.renderFiles.kling = Object.keys(discoveredKling).length > 0 ? discoveredKling : storedKling;
        // Preserve nano from stored data (nano not discovered by listShotRenderEntries)
        if (!shot.renderFiles.nano) shot.renderFiles.nano = {};
      }
    }

    writeSequenceFile(sequence, projectId);
    sendJSON(res, 200, { success: true, ...sequence });
  }));

  router.post('/api/storyboard/sequence', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(
      req.query.project || payload.project || projectManager.getActiveProject(),
      { required: true }
    );
    const sequence = readSequenceFile(projectId);
    normalizeSequenceReviewFields(sequence);

    if (Array.isArray(payload.selections)) {
      const existingById = new Map((sequence.selections || []).map((shot) => [shot.shotId, shot]));
      const merged = [];
      const seen = new Set();

      payload.selections.forEach((incoming) => {
        const shotId = sanitizePathSegment(String(incoming.shotId || ''), SHOT_ID_REGEX, 'shotId');
        const shot = existingById.get(shotId) || {
          shotId,
          selectedVariation: 'none',
          status: 'not_rendered',
          reviewStatus: 'draft',
          comments: [],
          assignee: '',
          renderFiles: { kling: {}, nano: {} }
        };

        if (incoming.selectedVariation !== undefined) {
          const selectedVariation = String(incoming.selectedVariation || 'none').trim();
          if (selectedVariation !== 'none' && !VARIATION_REGEX.test(selectedVariation)) {
            throw new Error(`Invalid selectedVariation for ${shotId}`);
          }
          shot.selectedVariation = selectedVariation || 'none';
        }

        if (incoming.locked !== undefined) {
          shot.locked = Boolean(incoming.locked);
        }

        if (incoming.sourceType !== undefined) {
          shot.sourceType = String(incoming.sourceType || '').trim().slice(0, 64) || shot.sourceType || 'Manual';
        }

        if (incoming.assignee !== undefined) {
          shot.assignee = normalizeAssignee(incoming.assignee);
        }

        normalizeShotReviewFields(shot);
        merged.push(shot);
        seen.add(shotId);
      });

      (sequence.selections || []).forEach((shot) => {
        if (!seen.has(shot.shotId)) {
          merged.push(shot);
        }
      });

      sequence.selections = merged;
    }

    if (Array.isArray(payload.editorialOrder)) {
      sequence.editorialOrder = payload.editorialOrder
        .map((shotId) => sanitizePathSegment(String(shotId || ''), SHOT_ID_REGEX, 'shotId'))
        .filter((shotId, idx, arr) => shotId && arr.indexOf(shotId) === idx);
    } else {
      sequence.editorialOrder = (sequence.selections || []).map((shot) => shot.shotId);
    }

    sequence.totalShots = Array.isArray(sequence.selections) ? sequence.selections.length : 0;
    writeSequenceFile(sequence, projectId);
    sendJSON(res, 200, { success: true, sequence });
  }));

  router.post('/api/storyboard/readiness-report', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(
      req.query.project || payload.project || projectManager.getActiveProject(),
      { required: true }
    );
    const lintDir = projectManager.getProjectPath(projectId, 'lint');
    if (!fs.existsSync(lintDir)) {
      fs.mkdirSync(lintDir, { recursive: true });
    }

    const reportPath = path.join(lintDir, 'readiness_report.json');
    writeJsonPreserveEol(reportPath, payload);
    sendJSON(res, 200, {
      success: true,
      path: `projects/${projectId}/lint/readiness_report.json`
    });
  }));

  router.get('/api/load/review-metadata', wrapAsync(async (req, res) => {
    const { projectId } = getProjectContext(req, { required: true });
    const sequence = readSequenceFile(projectId);
    const reviewMetadata = getReviewMetadataMap(sequence);
    writeSequenceFile(sequence, projectId);
    sendJSON(res, 200, { success: true, reviewMetadata });
  }));

  router.post('/api/save/review-metadata', wrapAsync(async (req, res) => {
    const parsed = await jsonBody(req, MAX_BODY_SIZE);
    const { projectId } = getProjectContext(req, { required: true });
    const shotId = sanitizePathSegment(parsed.shotId, SHOT_ID_REGEX, 'shotId');

    const sequence = readSequenceFile(projectId);
    if (!Array.isArray(sequence.selections)) {
      sequence.selections = [];
    }

    const shot = sequence.selections.find((item) => item.shotId === shotId);
    if (!shot) {
      sendJSON(res, 404, { success: false, error: `Shot '${shotId}' not found` });
      return;
    }

    const current = sanitizeReviewMetadata(shot);
    const updates = {
      reviewStatus: parsed.reviewStatus !== undefined ? parsed.reviewStatus : current.reviewStatus,
      comments: parsed.comments !== undefined ? parsed.comments : current.comments,
      assignee: parsed.assignee !== undefined ? parsed.assignee : current.assignee
    };
    const normalized = sanitizeReviewMetadata(updates);

    shot.reviewStatus = normalized.reviewStatus;
    shot.comments = normalized.comments;
    shot.assignee = normalized.assignee;
    writeSequenceFile(sequence, projectId);

    sendJSON(res, 200, {
      success: true,
      shotId,
      reviewMetadata: normalized
    });
  }));

  // --- Video Assembly / Export ---
  const videoAssembly = createVideoAssemblyService({ projectManager });

  router.get('/api/storyboard/ffmpeg-status', wrapAsync(async (_req, res) => {
    const status = await videoAssembly.checkFfmpeg();
    sendJSON(res, 200, { success: true, ffmpeg: status });
  }));

  router.post('/api/storyboard/export-video', wrapAsync(async (req, res) => {
    const data = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(
      data.project || data.projectId || projectManager.getActiveProject(),
      { required: true }
    );

    // Build shots list from sequence.json selections or from request
    let shots = Array.isArray(data.shots) ? data.shots : [];
    if (shots.length === 0) {
      // Auto-build from sequence.json
      const sequence = readSequenceFile(projectId);
      const shotEntries = Array.isArray(sequence.shots) ? sequence.shots : [];
      shots = shotEntries.map((entry) => ({
        shotId: entry.shotId || entry.id,
        variation: entry.selectedVariation || entry.variation || 'A',
        duration: entry.duration || 8
      })).filter((s) => s.shotId);
    }

    if (shots.length === 0) {
      sendJSON(res, 400, {
        success: false,
        error: 'No shots found. Select variations in the storyboard first, or provide shots in the request.'
      });
      return;
    }

    try {
      const result = await videoAssembly.assembleVideo(projectId, {
        shots,
        includeMusic: data.includeMusic !== false,
        fps: data.fps || 24,
        resolution: data.resolution || '1920x1080',
        outputFilename: data.outputFilename || 'export.mp4'
      });
      sendJSON(res, 200, result);
    } catch (err) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
  }));
}

module.exports = {
  registerStoryboardRoutes
};
