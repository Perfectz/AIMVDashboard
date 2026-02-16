function normalizePageId(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'index';
  if (/^[a-z0-9_-]{1,40}$/.test(raw)) return raw;
  return 'index';
}

function buildPageDefaults(pageId) {
  const defaults = {
    pageId,
    variation: 'A',
    tool: pageId === 'index' ? 'seedream' : '',
    previewOnly: true,
    requireReference: true,
    platform: 'all'
  };
  return defaults;
}

function registerBootstrapRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    resolveProjectId,
    projectManager,
    ensureSession,
    getGitHubAuthPayload,
    getGitHubOAuthConfigPayload,
    replicate,
    getPipelineStatus
  } = ctx;

  router.get('/api/app/bootstrap', wrapAsync(async (req, res) => {
    const session = ensureSession(req, res);
    const pageId = normalizePageId(req.query.page || req.query.pageId || 'index');
    const projects = projectManager.listProjects();

    let currentProject = null;
    if (projects.length > 0) {
      const requestedProject = String(req.query.project || req.query.projectId || '').trim();
      let currentProjectId = '';
      if (requestedProject) {
        try {
          currentProjectId = resolveProjectId(requestedProject, { required: true });
        } catch {
          currentProjectId = '';
        }
      }
      if (!currentProjectId) {
        const active = projectManager.getActiveProject();
        if (active && projects.some((project) => project.id === active)) {
          currentProjectId = active;
        } else {
          currentProjectId = projects[0].id;
        }
      }

      currentProject = projects.find((project) => project.id === currentProjectId) || projects[0];
      if (currentProject && currentProject.id) {
        try {
          projectManager.setActiveProject(currentProject.id);
        } catch {
          // Ignore active project sync failures in bootstrap path.
        }
      }
    }

    const pipeline = currentProject && currentProject.id
      ? getPipelineStatus(currentProject.id)
      : null;

    sendJSON(res, 200, {
      success: true,
      projects,
      currentProject,
      auth: {
        github: getGitHubAuthPayload(session),
        oauthConfig: getGitHubOAuthConfigPayload(session)
      },
      generation: {
        replicateConfigured: replicate.isConfigured(),
        tokenSource: replicate.getTokenSource()
      },
      pipeline,
      pageDefaults: buildPageDefaults(pageId)
    });
  }));
}

module.exports = {
  registerBootstrapRoutes
};
