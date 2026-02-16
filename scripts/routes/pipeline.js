function registerPipelineRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    jsonBody,
    MAX_BODY_SIZE,
    resolveProjectId,
    projectManager,
    getPipelineStatus,
    updatePipelineStatus,
    runCompile,
    runLinter,
    runGenerateIndex
  } = ctx;

  router.get('/api/pipeline/status', wrapAsync(async (req, res) => {
    const projectId = resolveProjectId(
      req.query.project
        || req.query.projectId
        || projectManager.getActiveProject(),
      { required: true }
    );
    const status = getPipelineStatus(projectId);
    sendJSON(res, 200, { success: true, status });
  }));

  router.post('/api/pipeline/:action', wrapAsync(async (req, res) => {
    const action = String(req.params.action || '').trim().toLowerCase();
    const allowedActions = new Set(['compile', 'lint', 'reindex', 'run-all']);
    if (!allowedActions.has(action)) {
      sendJSON(res, 404, { success: false, error: 'Unknown pipeline action' });
      return;
    }

    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(
      payload.project
        || payload.projectId
        || req.query.project
        || req.query.projectId
        || projectManager.getActiveProject(),
      { required: true }
    );

    const startedAt = new Date().toISOString();
    const result = {
      action,
      projectId,
      startedAt,
      finishedAt: null,
      success: false,
      step: action,
      compile: null,
      lint: null,
      reindex: null
    };

    if (action === 'compile' || action === 'run-all') {
      result.compile = runCompile(projectId, { quiet: true, all: false });
      result.step = 'compile';
      if (result.compile.success) {
        updatePipelineStatus(projectId, { lastCompileAt: new Date().toISOString() });
      }
    }

    if ((action === 'lint' || action === 'run-all') && (!result.compile || result.compile.success)) {
      result.lint = runLinter(projectId, { quiet: true });
      result.step = 'lint';
      updatePipelineStatus(projectId, {
        lastLintAt: new Date().toISOString(),
        lintSummary: result.lint.summary || null
      });
    }

    if ((action === 'reindex' || action === 'run-all') && (!result.compile || result.compile.success)) {
      result.reindex = runGenerateIndex(projectId, { quiet: true });
      result.step = 'reindex';
      if (result.reindex.success) {
        updatePipelineStatus(projectId, { lastReindexAt: new Date().toISOString() });
      }
    }

    if (action === 'compile') {
      result.success = Boolean(result.compile && result.compile.success);
    } else if (action === 'lint') {
      result.success = Boolean(result.lint && result.lint.success);
    } else if (action === 'reindex') {
      result.success = Boolean(result.reindex && result.reindex.success);
    } else {
      result.success = Boolean(
        (!result.compile || result.compile.success)
        && (!result.lint || result.lint.success)
        && (!result.reindex || result.reindex.success)
      );
    }

    result.finishedAt = new Date().toISOString();
    const statusPatch = {
      lastRun: {
        action,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        success: result.success,
        step: result.step
      }
    };
    if (action === 'run-all') {
      statusPatch.lastRunAllAt = result.finishedAt;
    }
    updatePipelineStatus(projectId, statusPatch);

    const statusCode = result.success ? 200 : 400;
    sendJSON(res, statusCode, {
      success: result.success,
      result,
      status: getPipelineStatus(projectId)
    });
  }));
}

module.exports = {
  registerPipelineRoutes
};
