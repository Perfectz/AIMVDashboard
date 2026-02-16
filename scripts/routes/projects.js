function registerProjectRoutes(router, ctx) {
  const {
    projectManager,
    sendJSON,
    wrapAsync,
    parseMultipartData
  } = ctx;

  router.get('/api/projects', wrapAsync(async (req, res) => {
    const projects = projectManager.listProjects();
    sendJSON(res, 200, { success: true, projects });
  }));

  router.get('/api/projects/:id', wrapAsync(async (req, res) => {
    try {
      const project = projectManager.getProject(req.params.id);
      sendJSON(res, 200, { success: true, project });
    } catch (err) {
      err.statusCode = 404;
      throw err;
    }
  }));

  router.post('/api/projects', (req, res) => {
    parseMultipartData(req, (err, parsed) => {
      const fields = (parsed && parsed.fields) || {};
      if (err) {
        sendJSON(res, 400, { success: false, error: 'Invalid request' });
        return;
      }

      const name = typeof fields.name === 'string' ? fields.name.trim() : '';
      const description = typeof fields.description === 'string' ? fields.description : '';
      if (!name) {
        sendJSON(res, 400, { success: false, error: 'Project name is required' });
        return;
      }

      try {
        const project = projectManager.createProject(name, description);
        sendJSON(res, 201, { success: true, project });
      } catch (createErr) {
        sendJSON(res, 400, { success: false, error: createErr.message });
      }
    });
  });

  router.put('/api/projects/:id', (req, res) => {
    const projectId = req.params.id;
    parseMultipartData(req, (err, parsed) => {
      const fields = (parsed && parsed.fields) || {};
      if (err) {
        sendJSON(res, 400, { success: false, error: 'Invalid request' });
        return;
      }

      try {
        const updates = {};
        if (fields.name) updates.name = fields.name;
        if (fields.description) updates.description = fields.description;
        if (fields.music) updates.music = JSON.parse(fields.music);
        if (fields.visualStyle) updates.visualStyle = JSON.parse(fields.visualStyle);
        if (fields.stats) updates.stats = JSON.parse(fields.stats);

        const project = projectManager.updateProject(projectId, updates);
        sendJSON(res, 200, { success: true, project });
      } catch (updateErr) {
        sendJSON(res, 400, { success: false, error: updateErr.message });
      }
    });
  });

  router.delete('/api/projects/:id', wrapAsync(async (req, res) => {
    try {
      projectManager.deleteProject(req.params.id);
      sendJSON(res, 200, { success: true, message: 'Project deleted' });
    } catch (err) {
      err.statusCode = err.statusCode || 400;
      throw err;
    }
  }));
}

module.exports = {
  registerProjectRoutes
};
