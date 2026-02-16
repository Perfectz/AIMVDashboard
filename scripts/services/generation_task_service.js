/**
 * Generation task execution service.
 * Extracted from serve_ui.js — Phase 4 architecture optimization.
 */

const fs = require('fs');
const path = require('path');
const { safeResolve, sanitizePathSegment } = require('../shared');

const SHOT_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const VARIATION_REGEX = /^[A-D]$/;
const MAX_REFERENCE_IMAGES = 14;
const DEFAULT_REFERENCE_POLICY = 'continuity_then_uploaded_then_canon';

function createGenerationTaskService({
  projectManager,
  replicate,
  generationJobs,
  renderManagement,
  storyboardPersistence
}) {

  function resolveProjectId(value, opts) {
    const { required = true } = opts || {};
    const projectId = value || projectManager.getActiveProject();
    if (!projectId) {
      if (!required) return projectManager.getActiveProject();
      throw new Error('project is required');
    }
    if (!/^[a-z0-9-]{1,50}$/.test(projectId)) {
      throw new Error('Invalid project ID');
    }
    if (!projectManager.projectExists(projectId)) {
      throw new Error(`Project '${projectId}' not found`);
    }
    return projectId;
  }

  function createHttpError(message, statusCode = 400, code = '') {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (code) err.code = code;
    return err;
  }

  function createCanceledError(message = 'Generation canceled') {
    const err = new Error(message);
    err.code = 'CANCELED';
    return err;
  }

  function ensureNotCanceled(isCanceled, message = 'Generation canceled') {
    if (typeof isCanceled === 'function' && isCanceled()) {
      throw createCanceledError(message);
    }
  }

  function reportGenerationProgress(onProgress, step, progress, payload = {}) {
    if (typeof onProgress !== 'function') return;
    try {
      onProgress(step, progress, payload);
    } catch {
      // ignore progress callback errors
    }
  }

  function mapReplicateStatusToProgress(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'sending') return 56;
    if (normalized === 'starting') return 63;
    if (normalized === 'processing') return 72;
    if (normalized === 'succeeded') return 84;
    if (normalized === 'failed') return 84;
    if (normalized === 'canceled') return 84;
    return 68;
  }

  function buildGenerationJobLockKey(projectId, type, input = {}) {
    const normalizedType = String(type || '').trim();
    if (normalizedType === 'generate-shot') {
      const shotId = String(input.shotId || '').trim();
      const variation = String(input.variation || 'A').toUpperCase().trim();
      if (shotId) {
        return `${projectId}:generate-shot:${shotId}:${variation}`;
      }
    }
    if (normalizedType === 'generate-image') {
      const mode = String(input.mode || '').trim();
      if (mode === 'character') {
        const character = String(input.character || '').trim();
        const slot = String(input.slot || '').trim();
        if (character && slot) {
          return `${projectId}:generate-image:character:${character}:${slot}`;
        }
      }
    }
    return '';
  }

  function startGenerationJob(projectId, type, input) {
    const lockKey = buildGenerationJobLockKey(projectId, type, input);
    const created = generationJobs.createJob({
      projectId,
      type,
      lockKey,
      input
    });

    generationJobs.runJob(created.jobId, async ({ emit, setStep, isCanceled }) => {
      emit('tool_call', { tool: type, step: 'job_dispatch', progress: 5 });
      const controls = {
        isCanceled,
        onProgress: (step, progress, progressPayload = {}) => {
          setStep(step, progress, progressPayload);
        }
      };

      if (type === 'generate-shot') {
        return executeGenerateShotTask(input, controls);
      }
      if (type === 'generate-image') {
        return executeGenerateImageTask(input, controls);
      }

      throw createHttpError(`Unsupported generation job type: ${type}`, 400);
    });

    return created;
  }

  function parseGenerateShotPrompt(projectPath, shotId, variation) {
    const shotNum = String(shotId || '').replace(/^SHOT_/i, '');
    const promptPath = path.join(projectPath, 'prompts', 'seedream', `shot_${shotNum}_${variation}.txt`);
    if (!fs.existsSync(promptPath)) {
      throw createHttpError(`Prompt file not found: prompts/seedream/shot_${shotNum}_${variation}.txt`, 404);
    }

    const promptContent = fs.readFileSync(promptPath, 'utf-8');
    const promptStart = promptContent.indexOf('--- SEEDREAM PROMPT ---');
    const negStart = promptContent.indexOf('--- NEGATIVE PROMPT');
    let prompt = promptContent;
    if (promptStart !== -1 && negStart !== -1) {
      prompt = promptContent.substring(promptStart + '--- SEEDREAM PROMPT ---'.length, negStart).trim();
    } else if (promptStart !== -1) {
      prompt = promptContent.substring(promptStart + '--- SEEDREAM PROMPT ---'.length).trim();
    }

    if (!prompt) {
      throw createHttpError('Could not extract prompt text from file.', 400);
    }

    return { promptPath, prompt };
  }

  function buildShotGenerationPreflight(data = {}) {
    const projectId = resolveProjectId(data.project || data.projectId || projectManager.getActiveProject(), { required: true });
    const shotId = sanitizePathSegment(String(data.shotId || ''), SHOT_ID_REGEX, 'shot');
    const variation = sanitizePathSegment(String(data.variation || 'A').toUpperCase(), VARIATION_REGEX, 'variation');
    const tool = sanitizePathSegment(String(data.tool || 'seedream').toLowerCase(), /^(seedream)$/, 'tool');
    const requireReference = data.requireReference !== false;

    const projectPath = projectManager.getProjectPath(projectId);
    let promptFound = false;
    try {
      const parsed = parseGenerateShotPrompt(projectPath, shotId, variation);
      promptFound = Boolean(parsed && parsed.prompt);
    } catch {
      promptFound = false;
    }

    const renders = renderManagement.listShotRenderEntries(projectId, shotId);
    const previsMap = storyboardPersistence.readPrevisMapFile(projectId);
    const continuityResolution = renderManagement.resolveSeedreamContinuityForShot(projectId, shotId, renders, previsMap);
    const continuityForVariation = continuityResolution.continuity?.byVariation?.[variation] || {};
    const resolvedFirst = continuityResolution.resolved?.[variation]?.first || {};

    const uploadedRefSetCount = Array.isArray(renders.seedream?.[variation]?.refs)
      ? renders.seedream[variation].refs.length
      : 0;
    const autoCollectableRefCount = renderManagement.collectShotReferenceImagePaths(projectPath, shotId, MAX_REFERENCE_IMAGES).length;
    const potentialRefCount = (resolvedFirst.path ? 1 : 0) + uploadedRefSetCount + autoCollectableRefCount;
    const replicateConfigured = replicate.isConfigured();

    let recommendedAction = 'generate';
    if (!replicateConfigured) {
      recommendedAction = 'set_replicate_key';
    } else if (!promptFound) {
      recommendedAction = 'fix_prompt';
    } else if (requireReference && potentialRefCount === 0) {
      recommendedAction = 'upload_refs';
    }

    return {
      success: true,
      projectId,
      shotId,
      variation,
      tool,
      readiness: {
        replicateConfigured,
        promptFound,
        continuity: {
          source: resolvedFirst.source || 'none',
          reason: continuityForVariation.reason || 'unknown',
          path: resolvedFirst.path || null
        },
        uploadedRefSetCount,
        autoCollectableRefCount
      },
      recommendedAction,
      defaults: {
        maxImages: 2,
        previewOnly: true,
        requireReference: true,
        autoPrepareRefSet: true
      }
    };
  }

  async function executeGenerateImageTask(data, controls = {}) {
    const onProgress = typeof controls.onProgress === 'function' ? controls.onProgress : null;
    const isCanceled = typeof controls.isCanceled === 'function' ? controls.isCanceled : () => false;

    reportGenerationProgress(onProgress, 'validate_request', 5);
    const projectId = resolveProjectId(data.project || data.projectId || projectManager.getActiveProject(), { required: true });
    ensureNotCanceled(isCanceled);

    const mode = String(data.mode || 'character');
    const character = data.character;
    const slot = Number(data.slot);
    const size = data.size || '2K';
    const aspectRatio = data.aspect_ratio || (mode === 'character' ? '3:4' : '16:9');

    if (!replicate.isConfigured()) {
      throw createHttpError('Replicate API token not configured. Add REPLICATE_API_TOKEN to .env file.', 500);
    }

    let prompt = '';
    let savePath = '';
    let relativePath = '';

    if (mode === 'character') {
      if (!character || !slot) {
        throw createHttpError('Character and slot are required for character mode.', 400);
      }

      const charDir = safeResolve(projectManager.getProjectPath(projectId), 'reference', 'characters', String(character));
      if (!fs.existsSync(charDir)) {
        throw createHttpError(`Character '${character}' not found.`, 404);
      }

      const promptPath = path.join(charDir, `prompt_0${slot}.txt`);
      if (!fs.existsSync(promptPath)) {
        throw createHttpError(`No prompt_0${slot}.txt found for ${character}.`, 404);
      }

      prompt = fs.readFileSync(promptPath, 'utf-8').trim();
      savePath = path.join(charDir, `generated_0${slot}.png`);
      relativePath = `reference/characters/${character}/generated_0${slot}.png`;
    } else {
      prompt = String(data.prompt || '').trim();
      if (!prompt) {
        throw createHttpError('Prompt text is required for arbitrary mode.', 400);
      }

      const genDir = safeResolve(projectManager.getProjectPath(projectId), 'rendered', 'generated');
      if (!fs.existsSync(genDir)) {
        fs.mkdirSync(genDir, { recursive: true });
      }
      const filename = `gen_${Date.now()}.png`;
      savePath = path.join(genDir, filename);
      relativePath = `rendered/generated/${filename}`;
    }

    reportGenerationProgress(onProgress, 'create_prediction', 50, { mode });
    ensureNotCanceled(isCanceled);

    const genOptions = {
      size,
      aspect_ratio: aspectRatio,
      max_images: data.max_images || 1
    };
    if (data.sequential_image_generation) genOptions.sequential_image_generation = data.sequential_image_generation;
    if (data.image_input) genOptions.image_input = data.image_input;
    if (data.width) genOptions.width = data.width;
    if (data.height) genOptions.height = data.height;

    const result = await replicate.createPrediction(
      prompt,
      genOptions,
      (status) => reportGenerationProgress(onProgress, 'prediction_status', mapReplicateStatusToProgress(status), { status }),
      isCanceled
    );

    reportGenerationProgress(onProgress, 'download_outputs', 88);
    ensureNotCanceled(isCanceled);

    const outputs = Array.isArray(result.output) ? result.output : [result.output];
    const savedImages = [];

    for (let i = 0; i < outputs.length; i++) {
      ensureNotCanceled(isCanceled);

      let imgPath = savePath;
      let imgRelative = relativePath;
      if (i > 0) {
        const ext = path.extname(savePath);
        const base = savePath.slice(0, -ext.length);
        imgPath = `${base}_${String.fromCharCode(98 + i)}${ext}`;
        const relExt = path.extname(relativePath);
        const relBase = relativePath.slice(0, -relExt.length);
        imgRelative = `${relBase}_${String.fromCharCode(98 + i)}${relExt}`;
      }

      await replicate.downloadImage(outputs[i], imgPath);
      savedImages.push(imgRelative);
      reportGenerationProgress(onProgress, 'download_outputs', 88 + Math.min(8, Math.floor(((i + 1) / outputs.length) * 8)));
    }

    return {
      images: savedImages,
      predictionId: result.predictionId,
      duration: result.duration
    };
  }

  async function executeGenerateShotTask(data, controls = {}) {
    const onProgress = typeof controls.onProgress === 'function' ? controls.onProgress : null;
    const isCanceled = typeof controls.isCanceled === 'function' ? controls.isCanceled : () => false;

    reportGenerationProgress(onProgress, 'validate_request', 5);
    const projectId = resolveProjectId(data.project || data.projectId || projectManager.getActiveProject(), { required: true });
    const shotId = sanitizePathSegment(String(data.shotId || ''), SHOT_ID_REGEX, 'shot');
    const variation = sanitizePathSegment(String(data.variation || 'A').toUpperCase(), VARIATION_REGEX, 'variation');
    const requestedMaxImages = Number(data.maxImages);
    const maxImages = Number.isFinite(requestedMaxImages)
      ? Math.max(1, Math.min(2, Math.floor(requestedMaxImages)))
      : 2;
    const requireReference = data.requireReference !== false;
    const previewOnly = Boolean(data.previewOnly);
    const autoPrepareRefSet = data.autoPrepareRefSet !== false;
    const useContinuity = data.useContinuity !== false;
    const referencePolicy = String(data.referencePolicy || DEFAULT_REFERENCE_POLICY).trim().toLowerCase();
    if (referencePolicy !== DEFAULT_REFERENCE_POLICY) {
      throw createHttpError(`referencePolicy must be "${DEFAULT_REFERENCE_POLICY}"`, 400);
    }

    if (!replicate.isConfigured()) {
      throw createHttpError('Replicate API token not configured. Add REPLICATE_API_TOKEN to .env file.', 500);
    }
    ensureNotCanceled(isCanceled);

    const projectPath = projectManager.getProjectPath(projectId);

    reportGenerationProgress(onProgress, 'load_prompt', 18);
    const { prompt } = parseGenerateShotPrompt(projectPath, shotId, variation);
    ensureNotCanceled(isCanceled);

    reportGenerationProgress(onProgress, 'resolve_continuity', 28);
    const previewMap = storyboardPersistence.readPrevisMapFile(projectId);
    const currentShotRenders = renderManagement.listShotRenderEntries(projectId, shotId);
    const continuityResolution = renderManagement.resolveSeedreamContinuityForShot(projectId, shotId, currentShotRenders, previewMap);
    const resolvedFirst = continuityResolution.resolved?.[variation]?.first || null;
    const continuityReason = continuityResolution.continuity?.byVariation?.[variation]?.reason
      || continuityResolution.continuity?.reason
      || 'unknown';

    reportGenerationProgress(onProgress, 'collect_references', 40);
    const refList = { inputs: [], sources: [] };
    let referenceManifest = [];
    const addReference = (dataUri, sourceType, sourceId, sourcePath = null) => {
      const added = renderManagement.addReferenceDataUriIfPossible(refList, dataUri, `${sourceType}:${sourceId}`);
      if (!added) return false;
      referenceManifest.push({
        order: referenceManifest.length + 1,
        sourceType,
        sourceId,
        path: sourcePath || undefined
      });
      return true;
    };

    if (useContinuity && resolvedFirst && resolvedFirst.path) {
      const continuityRef = renderManagement.imagePathToDataUri(projectId, resolvedFirst.path);
      addReference(
        continuityRef,
        'continuity',
        resolvedFirst.source === 'inherited'
          ? (resolvedFirst.inheritedFromShotId || 'unknown')
          : 'manual',
        resolvedFirst.path || null
      );
    }

    let uploadedFirstRefs = currentShotRenders.seedream?.[variation]?.refs || [];
    const autoCollectablePaths = renderManagement.collectShotReferenceImagePaths(projectPath, shotId, MAX_REFERENCE_IMAGES);
    if (autoPrepareRefSet && uploadedFirstRefs.length === 0 && autoCollectablePaths.length > 0) {
      uploadedFirstRefs = renderManagement.syncShotReferenceSetFiles(
        projectPath,
        shotId,
        'seedream',
        variation,
        autoCollectablePaths,
        MAX_REFERENCE_IMAGES
      );
    }

    uploadedFirstRefs.forEach((refPath, idx) => {
      const refDataUri = renderManagement.imagePathToDataUri(projectId, refPath);
      addReference(refDataUri, 'uploaded_ref_set', String(idx + 1), refPath);
    });

    const shotListPath = path.join(projectPath, 'bible', 'shot_list.json');
    if (fs.existsSync(shotListPath)) {
      try {
        const shotList = JSON.parse(fs.readFileSync(shotListPath, 'utf-8'));
        const shot = shotList.shots
          ? shotList.shots.find((s) => s.shotId === shotId || s.id === shotId)
          : null;

        if (shot && shot.characters && shot.characters.length > 0) {
          const prioritizedCharacters = shot.characters
            .slice()
            .sort((a, b) => (a.prominence === 'primary' ? -1 : 0) - (b.prominence === 'primary' ? -1 : 0));

          for (const characterRef of prioritizedCharacters) {
            ensureNotCanceled(isCanceled);
            const charId = characterRef.id;
            if (!charId) continue;
            const charDir = path.join(projectPath, 'reference', 'characters', charId);
            if (!fs.existsSync(charDir)) continue;

            const candidates = [
              'ref_1.png', 'ref_1.jpg', 'ref_1.jpeg', 'ref_1.webp',
              'ref_2.png', 'ref_2.jpg', 'ref_2.jpeg', 'ref_2.webp',
              'generated_01.png'
            ];

            for (const candidate of candidates) {
              if (refList.inputs.length >= MAX_REFERENCE_IMAGES) break;
              const refPath = path.join(charDir, candidate);
              if (!fs.existsSync(refPath)) continue;

              const relativeRefPath = renderManagement.normalizeRelativeProjectPath(projectPath, refPath);
              const refDataUri = renderManagement.imagePathToDataUri(projectId, relativeRefPath);
              if (!refDataUri) continue;
              addReference(refDataUri, 'character', `${charId}/${candidate}`, relativeRefPath);
            }
            if (refList.inputs.length >= MAX_REFERENCE_IMAGES) break;
          }
        }

        if (shot && shot.location && shot.location.id && refList.inputs.length < MAX_REFERENCE_IMAGES) {
          const locationId = String(shot.location.id).trim();
          if (locationId) {
            const locationDir = path.join(projectPath, 'reference', 'locations', locationId);
            const locationFiles = renderManagement.getOrderedReferenceFiles(locationDir);
            for (const file of locationFiles) {
              if (refList.inputs.length >= MAX_REFERENCE_IMAGES) break;
              ensureNotCanceled(isCanceled);

              const refPath = path.join(locationDir, file);
              const relativeRefPath = renderManagement.normalizeRelativeProjectPath(projectPath, refPath);
              const refDataUri = renderManagement.imagePathToDataUri(projectId, relativeRefPath);
              if (!refDataUri) continue;
              addReference(refDataUri, 'location', `${locationId}/${file}`, relativeRefPath);
            }
          }
        }
      } catch (shotListErr) {
        console.warn(`[Generate Shot] Could not read shot_list.json: ${shotListErr.message}`);
      }
    }

    const maxInputForRequestedOutput = Math.max(0, 15 - maxImages);
    let trimmedReferenceCount = 0;
    if (refList.inputs.length > maxInputForRequestedOutput) {
      trimmedReferenceCount = refList.inputs.length - maxInputForRequestedOutput;
      refList.inputs = refList.inputs.slice(0, maxInputForRequestedOutput);
      refList.sources = refList.sources.slice(0, maxInputForRequestedOutput);
      referenceManifest = referenceManifest
        .slice(0, maxInputForRequestedOutput)
        .map((entry, idx) => ({ ...entry, order: idx + 1 }));
    }

    if (requireReference && refList.inputs.length === 0) {
      throw createHttpError('Reference image is required for this action, but none was found for this shot.', 400);
    }

    reportGenerationProgress(onProgress, 'create_prediction', 56, { referenceCount: refList.inputs.length });
    ensureNotCanceled(isCanceled);

    const requestedAspectRatio = typeof data.aspect_ratio === 'string'
      ? data.aspect_ratio.trim()
      : '';
    const genOptions = {
      aspect_ratio: requestedAspectRatio || (refList.inputs.length > 0 ? 'match_input_image' : '16:9'),
      max_images: maxImages
    };
    if (maxImages > 1) {
      genOptions.sequential_image_generation = 'auto';
    }
    if (typeof data.size === 'string' && data.size.trim()) {
      genOptions.size = data.size.trim();
    }
    if (data.width) genOptions.width = data.width;
    if (data.height) genOptions.height = data.height;
    if (refList.inputs.length > 0) {
      genOptions.image_input = refList.inputs;
    }

    const result = await replicate.createPrediction(
      prompt,
      genOptions,
      (status) => reportGenerationProgress(onProgress, 'prediction_status', mapReplicateStatusToProgress(status), { status }),
      isCanceled
    );

    ensureNotCanceled(isCanceled);
    reportGenerationProgress(onProgress, 'download_outputs', 88);

    const outputs = Array.isArray(result.output) ? result.output : [result.output];
    const savedImages = [];
    const labels = ['first', 'last'];

    if (previewOnly) {
      const previewDir = renderManagement.getShotPreviewDir(projectPath, shotId);
      if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
      }

      const stamp = Date.now();
      for (let i = 0; i < outputs.length && i < 2; i++) {
        ensureNotCanceled(isCanceled);
        const filename = `seedream_${variation}_preview_${stamp}_${labels[i]}.png`;
        const saveFilePath = path.join(previewDir, filename);
        await replicate.downloadImage(outputs[i], saveFilePath);
        savedImages.push(`rendered/shots/${shotId}/preview/${filename}`);
        reportGenerationProgress(onProgress, 'download_outputs', 88 + Math.min(8, Math.floor(((i + 1) / Math.min(outputs.length, 2)) * 8)));
      }
    } else {
      const shotDir = path.join(projectPath, 'rendered', 'shots', shotId);
      if (!fs.existsSync(shotDir)) {
        fs.mkdirSync(shotDir, { recursive: true });
      }

      for (let i = 0; i < outputs.length && i < 2; i++) {
        ensureNotCanceled(isCanceled);
        const filename = `seedream_${variation}_${labels[i]}.png`;
        const saveFilePath = path.join(shotDir, filename);
        await replicate.downloadImage(outputs[i], saveFilePath);
        savedImages.push(`rendered/shots/${shotId}/${filename}`);
        reportGenerationProgress(onProgress, 'download_outputs', 88 + Math.min(8, Math.floor(((i + 1) / Math.min(outputs.length, 2)) * 8)));
      }
    }

    return {
      images: savedImages,
      predictionId: result.predictionId,
      duration: result.duration,
      hasReferenceImage: refList.inputs.length > 0,
      referenceSource: refList.sources.join(', '),
      referenceCount: refList.inputs.length,
      referenceTrimmed: trimmedReferenceCount > 0,
      trimmedReferenceCount,
      previewOnly,
      referenceManifest,
      preflightSnapshot: {
        projectId,
        shotId,
        variation,
        tool: 'seedream',
        continuity: {
          source: useContinuity && resolvedFirst && resolvedFirst.path ? (resolvedFirst.source || 'direct') : 'none',
          reason: useContinuity ? continuityReason : 'disabled_by_request',
          path: useContinuity && resolvedFirst ? (resolvedFirst.path || null) : null
        },
        referenceCounts: {
          uploadedRefSetCount: uploadedFirstRefs.length,
          autoCollectableRefCount: autoCollectablePaths.length,
          totalUsed: refList.inputs.length,
          trimmedReferenceCount
        },
        options: {
          maxImages,
          previewOnly,
          requireReference,
          autoPrepareRefSet,
          useContinuity,
          referencePolicy
        }
      }
    };
  }

  return {
    createHttpError,
    createCanceledError,
    ensureNotCanceled,
    reportGenerationProgress,
    mapReplicateStatusToProgress,
    buildGenerationJobLockKey,
    startGenerationJob,
    parseGenerateShotPrompt,
    buildShotGenerationPreflight,
    executeGenerateImageTask,
    executeGenerateShotTask
  };
}

module.exports = { createGenerationTaskService };
