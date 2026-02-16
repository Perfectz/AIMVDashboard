const { parseBusboyUpload } = require('../middleware/busboy-upload');
const { ReferenceEntityHandler } = require('../services/reference_entity_handler');

function resolveProjectFromQuery(ctx, projectValue) {
  return ctx.resolveProjectId(projectValue || ctx.projectManager.getActiveProject(), { required: true });
}

function normalizeUploadError(error) {
  const message = String((error && error.message) || '');
  if (message === 'File too large') {
    return { status: 413, message: 'File too large' };
  }
  if (
    message.startsWith('Invalid') ||
    message.startsWith('Missing') ||
    message.includes('project') ||
    message.startsWith('Project ') ||
    message.includes('already exists')
  ) {
    return { status: 400, message };
  }
  return { status: 500, message };
}

function registerEntityRoutes(router, ctx, config) {
  const {
    sendJSON,
    wrapAsync,
    resolveProjectId,
    projectManager
  } = ctx;
  const {
    handler,
    pluralKey,
    listPath,
    addPath,
    uploadPath,
    deleteImagePath,
    deleteEntityPath,
    queryKey
  } = config;

  router.get(listPath, wrapAsync(async (req, res) => {
    const projectId = resolveProjectFromQuery(ctx, req.query.project);
    const entities = handler.list(projectId);
    sendJSON(res, 200, { success: true, [pluralKey]: entities });
  }));

  router.post(addPath, wrapAsync(async (req, res) => {
    try {
      const projectId = resolveProjectFromQuery(ctx, req.query.project);
      handler.add(projectId, req.query[queryKey]);
      sendJSON(res, 200, { success: true, message: `${handler.entityLabel} added` });
    } catch (err) {
      const normalized = normalizeUploadError(err);
      sendJSON(res, normalized.status, { success: false, error: normalized.message });
    }
  }));

  router.post(uploadPath, wrapAsync(async (req, res) => {
    try {
      const parsed = await parseBusboyUpload(req, { maxFileSize: 20 * 1024 * 1024 });
      const uploadProject = parsed.fields.project || projectManager.getActiveProject();
      const projectId = resolveProjectId(uploadProject, { required: true });
      const slot = parsed.fields.slot;
      const entityName = parsed.fields[queryKey];

      if (!entityName || !slot || !parsed.fileBuffer) {
        sendJSON(res, 400, { success: false, error: `Missing file, ${queryKey} name, or slot number` });
        return;
      }

      const filename = handler.uploadImage(projectId, entityName, slot, parsed.fileExt, parsed.fileBuffer);
      sendJSON(res, 200, { success: true, message: 'Image uploaded', filename });
    } catch (err) {
      const normalized = normalizeUploadError(err);
      sendJSON(res, normalized.status, { success: false, error: normalized.message });
    }
  }));

  router.delete(deleteImagePath, wrapAsync(async (req, res) => {
    try {
      const projectId = resolveProjectFromQuery(ctx, req.query.project);
      const wasDeleted = handler.deleteImage(projectId, req.query[queryKey], req.query.slot);
      if (!wasDeleted) {
        sendJSON(res, 404, { success: false, error: 'Image not found' });
        return;
      }
      sendJSON(res, 200, { success: true, message: 'Image deleted' });
    } catch (err) {
      const normalized = normalizeUploadError(err);
      sendJSON(res, normalized.status, { success: false, error: normalized.message });
    }
  }));

  router.delete(deleteEntityPath, wrapAsync(async (req, res) => {
    try {
      const projectId = resolveProjectFromQuery(ctx, req.query.project);
      const wasDeleted = handler.deleteEntity(projectId, req.query[queryKey]);
      if (!wasDeleted) {
        sendJSON(res, 404, { success: false, error: `${handler.entityLabel} not found` });
        return;
      }
      sendJSON(res, 200, { success: true, message: `${handler.entityLabel} deleted` });
    } catch (err) {
      const normalized = normalizeUploadError(err);
      sendJSON(res, normalized.status, { success: false, error: normalized.message });
    }
  }));
}

function registerReferenceRoutes(router, ctx) {
  const {
    safeResolve,
    sanitizePathSegment,
    CHARACTER_REGEX,
    LOCATION_REGEX,
    IMAGE_EXTENSIONS,
    projectManager
  } = ctx;

  const characterHandler = new ReferenceEntityHandler({
    entityType: 'character',
    entityLabel: 'Character',
    regex: CHARACTER_REGEX,
    subdir: 'reference/characters',
    includeGeneratedImages: true,
    includeDefinition: true,
    includePrompts: true,
    maxSlot: 14,
    projectManager,
    safeResolve,
    sanitizePathSegment,
    imageExtensions: IMAGE_EXTENSIONS
  });

  const locationHandler = new ReferenceEntityHandler({
    entityType: 'location',
    entityLabel: 'Location',
    regex: LOCATION_REGEX,
    subdir: 'reference/locations',
    includeGeneratedImages: false,
    includeDefinition: false,
    includePrompts: false,
    maxSlot: 14,
    projectManager,
    safeResolve,
    sanitizePathSegment,
    imageExtensions: IMAGE_EXTENSIONS
  });

  registerEntityRoutes(router, ctx, {
    handler: characterHandler,
    pluralKey: 'characters',
    listPath: '/api/references/characters',
    addPath: '/api/add-character',
    uploadPath: '/api/upload/reference-image',
    deleteImagePath: '/api/delete/reference-image',
    deleteEntityPath: '/api/delete/character-reference',
    queryKey: 'character'
  });

  registerEntityRoutes(router, ctx, {
    handler: locationHandler,
    pluralKey: 'locations',
    listPath: '/api/references/locations',
    addPath: '/api/add-location',
    uploadPath: '/api/upload/location-reference-image',
    deleteImagePath: '/api/delete/location-reference-image',
    deleteEntityPath: '/api/delete/location-reference',
    queryKey: 'location'
  });
}

module.exports = {
  registerReferenceRoutes
};
