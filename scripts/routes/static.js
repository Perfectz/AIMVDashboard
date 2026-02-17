const path = require('path');

function registerStaticRoutes(router, ctx) {
  const {
    sendJSON,
    getProjectContext,
    projectManager,
    safeResolve,
    ROOT_DIR,
    UI_DIR,
    PROJECTS_DIR,
    serveFile
  } = ctx;

  router.get('*', (req, res) => {
    const requestPath = req.path || '/';

    if (requestPath.startsWith('/api/')) {
      sendJSON(res, 404, { success: false, error: 'Not found' });
      return;
    }

    let filePath;
    let projectId;
    try {
      projectId = getProjectContext(req).projectId;
    } catch (ctxErr) {
      sendJSON(res, 400, { success: false, error: ctxErr.message });
      return;
    }

    try {
      if (requestPath.startsWith('/rendered/')) {
        const cleanPath = requestPath.replace(/^\/+/, '');
        filePath = safeResolve(projectManager.getProjectPath(projectId), cleanPath);
      } else if (requestPath.startsWith('/music/')) {
        const cleanPath = requestPath.replace(/^\/+/, '');
        filePath = safeResolve(projectManager.getProjectPath(projectId), cleanPath);
      } else if (requestPath.startsWith('/reference/')) {
        const cleanPath = requestPath.replace(/^\/+/, '');
        filePath = safeResolve(projectManager.getProjectPath(projectId), cleanPath);
      } else if (requestPath.startsWith('/projects/')) {
        const cleanPath = requestPath.replace(/^\/projects\//, '');
        filePath = safeResolve(PROJECTS_DIR, cleanPath);
      } else if (requestPath === '/') {
        filePath = path.join(UI_DIR, 'home.html');
      } else if (requestPath === '/index.html') {
        filePath = path.join(UI_DIR, 'index.html');
      } else if (requestPath.startsWith('/ui/')) {
        filePath = safeResolve(ROOT_DIR, requestPath.replace(/^\/+/, ''));
      } else if (requestPath.startsWith('/prompts_index.json')) {
        filePath = path.join(projectManager.getProjectPath(projectId), 'prompts_index.json');
      } else if (requestPath.startsWith('/lint/report.json')) {
        filePath = path.join(projectManager.getProjectPath(projectId), 'lint', 'report.json');
      } else if (requestPath === '/prompts/ai_music_analysis_prompt.txt') {
        filePath = path.join(ROOT_DIR, 'prompts', 'ai_music_analysis_prompt.txt');
      } else if (requestPath.startsWith('/prompts/')) {
        const cleanPath = requestPath.replace(/^\/+/, '');
        filePath = safeResolve(projectManager.getProjectPath(projectId), cleanPath);
      } else {
        filePath = safeResolve(UI_DIR, requestPath.replace(/^\/+/, ''));
      }
    } catch {
      res.writeHead(403, { 'Content-Type': 'text/html' });
      res.end('<h1>403 - Forbidden</h1>');
      return;
    }

    const normalizedPath = path.resolve(filePath);
    if (!normalizedPath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/html' });
      res.end('<h1>403 - Forbidden</h1>');
      return;
    }

    serveFile(res, filePath);
  });
}

module.exports = {
  registerStaticRoutes
};
