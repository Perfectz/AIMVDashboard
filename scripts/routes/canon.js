const fs = require('fs');
const path = require('path');

function registerCanonRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    jsonBody,
    MAX_BODY_SIZE,
    resolveProjectId,
    projectManager,
    ALLOWED_CANON_TYPES,
    canonFilename
  } = ctx;

  router.post('/api/save/canon/:type', wrapAsync(async (req, res) => {
    const type = String(req.params.type || '').trim();

    if (!ALLOWED_CANON_TYPES.includes(type)) {
      const err = new Error(`Invalid canon type: ${type}`);
      err.statusCode = 400;
      throw err;
    }

    const projectId = resolveProjectId(req.query.project || projectManager.getActiveProject(), { required: true });
    const data = await jsonBody(req, MAX_BODY_SIZE);
    const { content } = data;
    const bibleDir = projectManager.getProjectPath(projectId, 'bible');
    if (!fs.existsSync(bibleDir)) {
      fs.mkdirSync(bibleDir, { recursive: true });
    }

    const filename = canonFilename(type);
    const filePath = path.join(bibleDir, filename);
    JSON.parse(content);
    fs.writeFileSync(filePath, content, 'utf8');
    sendJSON(res, 200, { success: true, message: `${type} saved` });
  }));

  router.get('/api/load/canon/:type', wrapAsync(async (req, res) => {
    const type = String(req.params.type || '').trim();
    const projectId = resolveProjectId(req.query.project || projectManager.getActiveProject(), { required: true });
    const filename = canonFilename(type);
    const filePath = path.join(projectManager.getProjectPath(projectId, 'bible'), filename);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      sendJSON(res, 200, { content });
    } else {
      sendJSON(res, 404, { content: null });
    }
  }));
}

module.exports = {
  registerCanonRoutes
};
