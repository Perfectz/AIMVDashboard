const { ContentFileService } = require('../services/content_file_service');

const SUPPORTED_CONTENT_TYPES = [
  'suno-prompt',
  'song-info',
  'analysis',
  'concept',
  'inspiration',
  'mood',
  'genre'
];

const LOAD_ERROR_MESSAGES = {
  'suno-prompt': 'Failed to load Suno prompt',
  'song-info': 'Failed to load song info',
  analysis: 'Failed to load analysis JSON',
  concept: 'Failed to load concept',
  inspiration: 'Failed to load inspiration',
  mood: 'Failed to load mood',
  genre: 'Failed to load genre'
};

const SAVE_SUCCESS_MESSAGES = {
  'suno-prompt': 'Suno prompt saved successfully',
  'song-info': 'Song info saved successfully',
  analysis: 'Analysis JSON saved successfully'
};

function isClientContentError(error) {
  const message = String((error && error.message) || '');
  return message.startsWith('Unknown content type')
    || message.startsWith('Invalid content')
    || message.startsWith('Content too large')
    || message.startsWith('Invalid JSON format')
    || message.startsWith('Missing required fields');
}

function registerContentRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    jsonBody,
    MAX_BODY_SIZE,
    resolveProjectId,
    projectManager,
    getProjectContext,
    buildContextBundle
  } = ctx;
  const contentFileService = new ContentFileService(projectManager);

  function handleSave(req, res, forcedContentType) {
    return wrapAsync(async (innerReq, innerRes) => {
      const payload = await jsonBody(innerReq, MAX_BODY_SIZE);
      const contentType = forcedContentType || innerReq.params.contentType;
      const safeProjectId = resolveProjectId(payload.project, { required: true });

      try {
        const saved = contentFileService.save(safeProjectId, contentType, payload.content);
        const response = {
          success: true,
          filePath: saved.filePath
        };

        if (SAVE_SUCCESS_MESSAGES[contentType]) {
          response.message = SAVE_SUCCESS_MESSAGES[contentType];
        }

        if (contentType === 'analysis' && saved.parsedJson) {
          response.sections = Array.isArray(saved.parsedJson.sections) ? saved.parsedJson.sections.length : 0;
          response.duration = saved.parsedJson.duration;
          response.bpm = saved.parsedJson.bpm;
        }

        sendJSON(innerRes, 200, response);
      } catch (saveErr) {
        if (isClientContentError(saveErr)) {
          sendJSON(innerRes, 400, { success: false, error: saveErr.message });
          return;
        }
        sendJSON(innerRes, 500, { success: false, error: `Failed to save content: ${saveErr.message}` });
      }
    })(req, res);
  }

  function handleLoad(req, res, forcedContentType) {
    try {
      const { projectId } = getProjectContext(req);
      const contentType = forcedContentType || req.params.contentType;
      const content = contentFileService.load(projectId, contentType);
      sendJSON(res, 200, { content });
    } catch (loadErr) {
      if (isClientContentError(loadErr)) {
        sendJSON(res, 400, { error: loadErr.message });
        return;
      }
      const contentType = forcedContentType || req.params.contentType;
      const fallbackMessage = LOAD_ERROR_MESSAGES[contentType] || 'Failed to load content';
      sendJSON(res, 500, { error: fallbackMessage, details: loadErr.message });
    }
  }

  SUPPORTED_CONTENT_TYPES.forEach((contentType) => {
    router.post(`/api/save/${contentType}`, (req, res) => {
      handleSave(req, res, contentType);
    });
    router.get(`/api/load/${contentType}`, (req, res) => {
      handleLoad(req, res, contentType);
    });
  });

  router.post('/api/save/:contentType', (req, res) => {
    handleSave(req, res);
  });

  router.get('/api/load/:contentType', (req, res) => {
    handleLoad(req, res);
  });

  router.post('/api/export/context-bundle', wrapAsync(async (req, res) => {
    const parsed = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(parsed.project || getProjectContext(req).projectId, { required: true });
    const includePromptTemplates = Boolean(parsed.includePromptTemplates);
    const bundle = buildContextBundle(projectId, { includePromptTemplates });
    sendJSON(res, 200, { success: true, bundle });
  }));

  router.get('/api/export/context-bundle', wrapAsync(async (req, res) => {
    const projectId = resolveProjectId(req.query.project || getProjectContext(req).projectId, { required: true });
    const bundle = buildContextBundle(projectId);
    sendJSON(res, 200, { success: true, bundle });
  }));
}

module.exports = {
  registerContentRoutes
};
