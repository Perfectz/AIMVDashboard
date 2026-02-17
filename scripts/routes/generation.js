const fs = require('fs');
const path = require('path');
const Busboy = require('busboy');
const { GENERATION_SOCKET_TIMEOUT_MS } = require('../config');

function registerGenerationRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    jsonBody,
    MAX_BODY_SIZE,
    resolveProjectId,
    sanitizePathSegment,
    SHOT_ID_REGEX,
    VARIATION_REGEX,
    IMAGE_EXTENSIONS,
    MAX_REFERENCE_IMAGES,
    projectManager,
    safeResolve,
    parseRequestUrl,
    replicate,
    executeGenerateImageTask,
    executeGenerateShotTask,
    buildShotGenerationPreflight,
    isPreviewPathForShot,
    listShotRenderEntries,
    readPrevisMapFile,
    resolveSeedreamContinuityForShot,
    resolvePreviousShotLastFrame,
    getOrderedReferenceFiles,
    collectShotReferenceImagePaths,
    syncShotReferenceSetFiles,
    readSequenceFile
  } = ctx;

  router.get('/api/generate-status', (_req, res) => {
    sendJSON(res, 200, {
      configured: replicate.isConfigured(),
      tokenSource: replicate.getTokenSource()
    });
  });

  router.get('/api/shot-reference-options', wrapAsync(async (req, res) => {
    const projectId = resolveProjectId(req.query.project || projectManager.getActiveProject(), { required: true });
    const shotId = sanitizePathSegment(String(req.query.shot || ''), SHOT_ID_REGEX, 'shotId');
    const projectPath = projectManager.getProjectPath(projectId);

    const options = [];

    // 1. Continuity: previous shot's chosen variation last frame
    const continuityInfo = resolvePreviousShotLastFrame(projectId, shotId);
    if (continuityInfo.previousShotId) {
      options.push({
        id: 'continuity:prev_last',
        category: 'continuity',
        label: 'Previous Shot Last Frame',
        sublabel: continuityInfo.previousShotId + ' Var ' + (continuityInfo.variation || 'A'),
        path: continuityInfo.path || null,
        available: Boolean(continuityInfo.available)
      });
    }

    // 2. All character references in project
    const charsDir = path.join(projectPath, 'reference', 'characters');
    if (fs.existsSync(charsDir)) {
      const charDirs = fs.readdirSync(charsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      for (const charId of charDirs) {
        const charDir = path.join(charsDir, charId);
        const files = getOrderedReferenceFiles(charDir);
        for (const file of files) {
          options.push({
            id: 'char:' + charId + '/' + file,
            category: 'character',
            entityId: charId,
            label: charId,
            sublabel: file,
            path: 'reference/characters/' + charId + '/' + file,
            available: true
          });
        }
      }
    }

    // 3. All location references in project
    const locsDir = path.join(projectPath, 'reference', 'locations');
    if (fs.existsSync(locsDir)) {
      const locDirs = fs.readdirSync(locsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      for (const locId of locDirs) {
        const locDir = path.join(locsDir, locId);
        const files = getOrderedReferenceFiles(locDir);
        for (const file of files) {
          options.push({
            id: 'loc:' + locId + '/' + file,
            category: 'location',
            entityId: locId,
            label: locId,
            sublabel: file,
            path: 'reference/locations/' + locId + '/' + file,
            available: true
          });
        }
      }
    }

    sendJSON(res, 200, {
      success: true,
      projectId,
      shotId,
      options,
      maxSelectable: MAX_REFERENCE_IMAGES - 1
    });
  }));

  router.post('/api/session/replicate-key', wrapAsync(async (req, res) => {
    const data = await jsonBody(req, MAX_BODY_SIZE);
    const token = typeof data.token === 'string' ? data.token.trim() : '';
    if (!token) {
      replicate.clearSessionToken();
      sendJSON(res, 200, {
        success: true,
        configured: replicate.isConfigured(),
        tokenSource: replicate.getTokenSource(),
        message: 'Session token cleared'
      });
      return;
    }

    replicate.setSessionToken(token);
    sendJSON(res, 200, {
      success: true,
      configured: replicate.isConfigured(),
      tokenSource: replicate.getTokenSource(),
      message: 'Session token updated'
    });
  }));

  router.post('/api/generate-image', wrapAsync(async (req, res) => {
    req.setTimeout(GENERATION_SOCKET_TIMEOUT_MS);
    res.setTimeout(GENERATION_SOCKET_TIMEOUT_MS);

    const data = await jsonBody(req, MAX_BODY_SIZE);
    try {
      const result = await executeGenerateImageTask(data);
      sendJSON(res, 200, {
        success: true,
        images: result.images,
        predictionId: result.predictionId,
        duration: result.duration
      });
    } catch (genErr) {
      const statusCode = genErr.statusCode || 500;
      sendJSON(res, statusCode, { success: false, error: genErr.message });
    }
  }));

  router.post('/api/generate-shot', wrapAsync(async (req, res) => {
    req.setTimeout(GENERATION_SOCKET_TIMEOUT_MS);
    res.setTimeout(GENERATION_SOCKET_TIMEOUT_MS);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Wed, 30 Sep 2026 00:00:00 GMT');
    const data = await jsonBody(req, MAX_BODY_SIZE);
    try {
      const result = await executeGenerateShotTask(data);
      sendJSON(res, 200, {
        success: true,
        images: result.images,
        frameAssignments: result.frameAssignments || [],
        generationMode: result.generationMode || '',
        isFirstLastPair: Boolean(result.isFirstLastPair),
        predictionId: result.predictionId,
        duration: result.duration,
        hasReferenceImage: result.hasReferenceImage,
        referenceSource: result.referenceSource,
        referenceCount: result.referenceCount,
        referenceTrimmed: result.referenceTrimmed,
        trimmedReferenceCount: result.trimmedReferenceCount,
        previewOnly: result.previewOnly,
        referenceManifest: result.referenceManifest || [],
        preflightSnapshot: result.preflightSnapshot || null
      });
    } catch (genErr) {
      const statusCode = genErr.statusCode && genErr.statusCode >= 400 && genErr.statusCode < 500
        ? 502
        : (genErr.statusCode || 500);
      sendJSON(res, statusCode, { success: false, error: genErr.message });
    }
  }));

  router.get('/api/shot-generation/preflight', wrapAsync(async (req, res) => {
    const projectId = resolveProjectId(req.query.project || projectManager.getActiveProject(), { required: true });
    const shotId = sanitizePathSegment(String(req.query.shotId || req.query.shot || ''), SHOT_ID_REGEX, 'shot');
    const variation = sanitizePathSegment(String(req.query.variation || 'A').toUpperCase(), VARIATION_REGEX, 'variation');
    const tool = sanitizePathSegment(String(req.query.tool || 'seedream').toLowerCase(), /^(seedream)$/, 'tool');
    const requireReferenceRaw = String(req.query.requireReference || '').trim().toLowerCase();
    const requireReference = requireReferenceRaw === '' ? true : requireReferenceRaw !== 'false';

    const preflight = buildShotGenerationPreflight({
      project: projectId,
      shotId,
      variation,
      tool,
      requireReference
    });
    sendJSON(res, 200, preflight);
  }));

  router.post('/api/save-shot-preview', wrapAsync(async (req, res) => {
    const data = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(data.project || projectManager.getActiveProject(), { required: true });
    const shotId = sanitizePathSegment(data.shotId, SHOT_ID_REGEX, 'shot');
    const variation = sanitizePathSegment((data.variation || 'A').toUpperCase(), VARIATION_REGEX, 'variation');
    const tool = sanitizePathSegment((data.tool || 'seedream').toLowerCase(), /^(seedream|kling)$/, 'tool');
    const frame = sanitizePathSegment((data.frame || '').toLowerCase(), /^(first|last)$/, 'frame');
    const previewPath = String(data.previewPath || '').trim();
    if (!previewPath) {
      throw new Error('previewPath is required');
    }
    if (!isPreviewPathForShot(shotId, previewPath)) {
      throw new Error('previewPath must point to this shot preview folder');
    }

    const projectPath = projectManager.getProjectPath(projectId);
    const cleanPreviewPath = previewPath.replace(/^\/+/, '');
    const previewAbs = safeResolve(projectPath, cleanPreviewPath);
    if (!fs.existsSync(previewAbs)) {
      throw new Error('Preview image not found');
    }

    const ext = path.extname(previewAbs).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      throw new Error('Invalid preview image format');
    }

    const shotDir = safeResolve(projectPath, 'rendered', 'shots', shotId);
    if (!fs.existsSync(shotDir)) {
      fs.mkdirSync(shotDir, { recursive: true });
    }

    fs.readdirSync(shotDir).forEach((file) => {
      if (file.startsWith(`${tool}_${variation}_${frame}.`)) {
        fs.unlinkSync(path.join(shotDir, file));
      }
    });

    const newFilename = `${tool}_${variation}_${frame}${ext}`;
    const saveAbs = path.join(shotDir, newFilename);
    fs.copyFileSync(previewAbs, saveAbs);

    if (data.deletePreview !== false) {
      try {
        fs.unlinkSync(previewAbs);
      } catch {
        // ignore cleanup error
      }
    }

    const relativePath = `rendered/shots/${shotId}/${newFilename}`;
    sendJSON(res, 200, {
      success: true,
      projectId,
      shotId,
      variation,
      frame,
      tool,
      path: relativePath
    });
  }));

  router.post('/api/save-shot-previews', wrapAsync(async (req, res) => {
    const data = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(data.project || projectManager.getActiveProject(), { required: true });
    const shotId = sanitizePathSegment(data.shotId, SHOT_ID_REGEX, 'shot');
    const variation = sanitizePathSegment((data.variation || 'A').toUpperCase(), VARIATION_REGEX, 'variation');
    const tool = sanitizePathSegment((data.tool || 'seedream').toLowerCase(), /^(seedream|kling)$/, 'tool');
    const selections = Array.isArray(data.selections) ? data.selections : [];
    if (selections.length === 0) {
      throw new Error('selections array is required');
    }

    const projectPath = projectManager.getProjectPath(projectId);
    const shotDir = safeResolve(projectPath, 'rendered', 'shots', shotId);
    if (!fs.existsSync(shotDir)) {
      fs.mkdirSync(shotDir, { recursive: true });
    }

    const saved = [];
    const previewAbsToDelete = [];
    const framesSeen = new Set();

    selections.forEach((selectionRaw) => {
      const selection = selectionRaw && typeof selectionRaw === 'object' ? selectionRaw : {};
      const frame = sanitizePathSegment((selection.frame || '').toLowerCase(), /^(first|last)$/, 'frame');
      const previewPath = String(selection.previewPath || '').trim();
      if (!previewPath) {
        throw new Error('previewPath is required for each selection');
      }
      if (framesSeen.has(frame)) {
        throw new Error(`Duplicate frame selection: ${frame}`);
      }
      framesSeen.add(frame);
      if (!isPreviewPathForShot(shotId, previewPath)) {
        throw new Error('previewPath must point to this shot preview folder');
      }

      const cleanPreviewPath = previewPath.replace(/^\/+/, '');
      const previewAbs = safeResolve(projectPath, cleanPreviewPath);
      if (!fs.existsSync(previewAbs)) {
        throw new Error(`Preview image not found: ${previewPath}`);
      }
      const ext = path.extname(previewAbs).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) {
        throw new Error('Invalid preview image format');
      }

      fs.readdirSync(shotDir).forEach((file) => {
        if (file.startsWith(`${tool}_${variation}_${frame}.`)) {
          fs.unlinkSync(path.join(shotDir, file));
        }
      });

      const newFilename = `${tool}_${variation}_${frame}${ext}`;
      const saveAbs = path.join(shotDir, newFilename);
      fs.copyFileSync(previewAbs, saveAbs);
      saved.push({
        frame,
        path: `rendered/shots/${shotId}/${newFilename}`
      });
      previewAbsToDelete.push(previewAbs);
    });

    if (data.deletePreview !== false) {
      previewAbsToDelete.forEach((previewAbs) => {
        try {
          if (fs.existsSync(previewAbs)) {
            fs.unlinkSync(previewAbs);
          }
        } catch {
          // ignore cleanup errors
        }
      });
    }

    sendJSON(res, 200, {
      success: true,
      projectId,
      shotId,
      variation,
      tool,
      saved
    });
  }));

  router.post('/api/discard-shot-preview', wrapAsync(async (req, res) => {
    const data = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(data.project || projectManager.getActiveProject(), { required: true });
    const shotId = sanitizePathSegment(data.shotId, SHOT_ID_REGEX, 'shot');
    const projectPath = projectManager.getProjectPath(projectId);
    const paths = Array.isArray(data.previewPaths) ? data.previewPaths : [];

    let deleted = 0;
    paths.forEach((previewPathRaw) => {
      const previewPath = String(previewPathRaw || '').trim();
      if (!previewPath) return;
      if (!isPreviewPathForShot(shotId, previewPath)) return;
      const cleanPath = previewPath.replace(/^\/+/, '');
      let abs;
      try {
        abs = safeResolve(projectPath, cleanPath);
      } catch {
        return;
      }
      if (fs.existsSync(abs)) {
        try {
          fs.unlinkSync(abs);
          deleted += 1;
        } catch {
          // ignore per-file failure
        }
      }
    });

    sendJSON(res, 200, { success: true, deleted });
  }));

  router.get('/api/shot-renders', wrapAsync(async (req, res) => {
    const shotId = req.query.shot;

    if (!shotId) {
      sendJSON(res, 400, { success: false, error: 'shot parameter is required.' });
      return;
    }

    const projectId = resolveProjectId(req.query.project || projectManager.getActiveProject(), { required: true });
    sanitizePathSegment(shotId, SHOT_ID_REGEX, 'shot');

    const renders = listShotRenderEntries(projectId, shotId);
    const previsMap = readPrevisMapFile(projectId);
    const seedreamResolved = resolveSeedreamContinuityForShot(projectId, shotId, renders, previsMap);

    sendJSON(res, 200, {
      success: true,
      renders,
      resolved: {
        seedream: seedreamResolved.resolved
      },
      continuity: {
        seedream: seedreamResolved.continuity
      }
    });
  }));

  router.post('/api/upload/shot-render', (req, res) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 20 * 1024 * 1024 } });
    let projectId = projectManager.getActiveProject();
    let shotId = '';
    let variation = 'A';
    let frame = '';
    let tool = 'seedream';
    let fileExt = '';
    const fileChunks = [];

    busboy.on('field', (name, val) => {
      if (name === 'project') projectId = val;
      if (name === 'shot') shotId = val;
      if (name === 'variation') variation = val;
      if (name === 'frame') frame = val;
      if (name === 'tool') tool = val;
    });

    busboy.on('file', (_name, file, info) => {
      fileExt = path.extname(info.filename);
      file.on('data', (chunk) => { fileChunks.push(chunk); });
      file.on('error', () => {
        /* ignored — file stream error; clear chunks */
        fileChunks.length = 0;
      });
    });

    busboy.on('close', () => {
      if (fileChunks.length === 0 || !shotId || !frame) {
        sendJSON(res, 400, { success: false, error: 'Missing file, shot ID, or frame type' });
        return;
      }

      if (!['first', 'last'].includes(frame)) {
        sendJSON(res, 400, { success: false, error: 'frame must be "first" or "last"' });
        return;
      }

      if (!['seedream', 'kling'].includes(tool)) {
        sendJSON(res, 400, { success: false, error: 'tool must be "seedream" or "kling"' });
        return;
      }

      try {
        projectId = resolveProjectId(projectId, { required: true });
        sanitizePathSegment(shotId, SHOT_ID_REGEX, 'shot');
        sanitizePathSegment(variation, VARIATION_REGEX, 'variation');
        if (!IMAGE_EXTENSIONS.has(fileExt.toLowerCase())) {
          throw new Error('Invalid image format');
        }

        const shotDir = safeResolve(projectManager.getProjectPath(projectId), 'rendered', 'shots', shotId);
        if (!fs.existsSync(shotDir)) {
          fs.mkdirSync(shotDir, { recursive: true });
        }

        fs.readdirSync(shotDir).forEach((file) => {
          if (file.startsWith(`${tool}_${variation}_${frame}.`)) {
            fs.unlinkSync(path.join(shotDir, file));
          }
        });

        const newFilename = `${tool}_${variation}_${frame}${fileExt}`;
        const savePath = path.join(shotDir, newFilename);
        fs.writeFileSync(savePath, Buffer.concat(fileChunks));

        const relativePath = `rendered/shots/${shotId}/${newFilename}`;
        sendJSON(res, 200, { success: true, filename: newFilename, path: relativePath });
      } catch (uploadErr) {
        sendJSON(res, 500, { success: false, error: `Failed to save image: ${uploadErr.message}` });
      }
    });

    req.pipe(busboy);
  });

  router.post('/api/upload/shot-reference-set', wrapAsync(async (req, res) => {
    const data = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(data.project || projectManager.getActiveProject(), { required: true });
    const shotId = sanitizePathSegment(data.shotId, SHOT_ID_REGEX, 'shot');
    const variation = sanitizePathSegment((data.variation || 'A').toUpperCase(), VARIATION_REGEX, 'variation');
    const tool = sanitizePathSegment((data.tool || 'seedream').toLowerCase(), /^(seedream|kling)$/, 'tool');
    const requestedLimit = Number(data.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(MAX_REFERENCE_IMAGES, Math.floor(requestedLimit)))
      : MAX_REFERENCE_IMAGES;

    const projectPath = projectManager.getProjectPath(projectId);
    const sourcePaths = collectShotReferenceImagePaths(projectPath, shotId, limit);
    const uploadedPaths = syncShotReferenceSetFiles(projectPath, shotId, tool, variation, sourcePaths, limit);

    sendJSON(res, 200, {
      success: true,
      projectId,
      shotId,
      variation,
      tool,
      limit,
      uploadedCount: uploadedPaths.length,
      uploadedPaths
    });
  }));

  router.delete('/api/delete/shot-render', wrapAsync(async (req, res) => {
    const urlObj = parseRequestUrl(req);
    const shotId = urlObj.searchParams.get('shot');
    const variation = urlObj.searchParams.get('variation') || 'A';
    const frame = urlObj.searchParams.get('frame');
    const tool = urlObj.searchParams.get('tool') || 'seedream';

    if (!shotId || !frame) {
      sendJSON(res, 400, { success: false, error: 'shot and frame parameters are required' });
      return;
    }

    const projectId = resolveProjectId(urlObj.searchParams.get('project') || projectManager.getActiveProject(), { required: true });
    sanitizePathSegment(shotId, SHOT_ID_REGEX, 'shot');
    sanitizePathSegment(variation, VARIATION_REGEX, 'variation');
    sanitizePathSegment(frame, /^(first|last)$/, 'frame');
    sanitizePathSegment(tool, /^(seedream|kling)$/, 'tool');
    const shotDir = safeResolve(projectManager.getProjectPath(projectId), 'rendered', 'shots', shotId);

    if (!fs.existsSync(shotDir)) {
      sendJSON(res, 404, { success: false, error: 'Shot directory not found' });
      return;
    }

    const files = fs.readdirSync(shotDir);
    const fileToDelete = files.find((file) => file.startsWith(`${tool}_${variation}_${frame}.`));
    if (fileToDelete) {
      fs.unlinkSync(path.join(shotDir, fileToDelete));
      sendJSON(res, 200, { success: true, message: 'Render deleted' });
    } else {
      sendJSON(res, 404, { success: false, error: 'Render file not found' });
    }
  }));
}

module.exports = {
  registerGenerationRoutes
};
