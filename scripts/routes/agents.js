function registerAgentRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    jsonBody,
    MAX_BODY_SIZE,
    resolveProjectId,
    projectManager,
    sanitizePathSegment,
    SHOT_ID_REGEX,
    VARIATION_REGEX,
    AGENT_MODES,
    AGENT_TOOLS,
    ensureSession,
    agentRuntime,
    aiProvider,
    sendSseEvent,
    corsHeadersForRequest
  } = ctx;

  router.get('/api/agents/locks', wrapAsync(async (req, res) => {
    const rawProjectId = String(req.query.projectId || '').trim();
    const projectId = rawProjectId
      ? resolveProjectId(rawProjectId, { required: true })
      : '';
    sendJSON(res, 200, {
      success: true,
      locks: agentRuntime.listLocks(projectId)
    });
  }));

  router.post('/api/agents/prompt-runs', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(
      payload.projectId || payload.project || projectManager.getActiveProject(),
      { required: true }
    );
    const shotId = sanitizePathSegment(String(payload.shotId || ''), SHOT_ID_REGEX, 'shotId');
    const variation = sanitizePathSegment(String(payload.variation || 'A').toUpperCase(), VARIATION_REGEX, 'variation');
    const mode = sanitizePathSegment(String(payload.mode || 'generate').toLowerCase(), /^(generate|revise)$/, 'mode');
    const tool = String(payload.tool || 'seedream').toLowerCase();
    if (!AGENT_MODES.has(mode)) {
      throw new Error('mode must be generate or revise');
    }
    if (!AGENT_TOOLS.has(tool)) {
      throw new Error('tool must be seedream, kling, nanobanana, or suno');
    }
    const instruction = typeof payload.instruction === 'string' ? payload.instruction.slice(0, 2000) : '';

    const session = ensureSession(req, res);
    const provider = aiProvider ? aiProvider.getActiveProvider() : 'github';
    if (provider === 'github' && (!session.githubAuth || !session.githubAuth.accessToken)) {
      sendJSON(res, 401, {
        success: false,
        error: 'GitHub OAuth session required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }
    if (provider !== 'github' && aiProvider && !aiProvider.isConfigured(provider)) {
      sendJSON(res, 401, {
        success: false,
        error: provider + ' API key not configured',
        code: 'PROVIDER_NOT_CONFIGURED'
      });
      return;
    }

    let run;
    try {
      run = agentRuntime.createRun(
        {
          projectId,
          shotId,
          variation,
          mode,
          tool,
          instruction
        },
        {
          accessToken: (session.githubAuth && session.githubAuth.accessToken) || '',
          username: (session.githubAuth && session.githubAuth.username) || ''
        }
      );
    } catch (createErr) {
      if (createErr && createErr.code === 'LOCK_CONFLICT') {
        sendJSON(res, 409, {
          success: false,
          error: createErr.message || 'Shot is currently locked',
          code: 'LOCK_CONFLICT',
          activeRunId: createErr.activeRunId || null
        });
        return;
      }
      throw createErr;
    }

    sendJSON(res, 200, {
      success: true,
      runId: run.runId,
      lockAcquired: true,
      startedAt: run.startedAt
    });
  }));

  router.get('/api/agents/prompt-runs/:runId', (req, res) => {
    const runId = String(req.params.runId || '').trim();
    const run = agentRuntime.getRun(runId);
    if (!run) {
      sendJSON(res, 404, { success: false, error: 'Run not found' });
      return;
    }
    sendJSON(res, 200, { success: true, ...agentRuntime.serializeRun(run) });
  });

  router.get('/api/agents/prompt-runs/:runId/events', (req, res) => {
    const runId = String(req.params.runId || '').trim();
    const run = agentRuntime.getRun(runId);
    if (!run) {
      sendJSON(res, 404, { success: false, error: 'Run not found' });
      return;
    }

    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    };
    const corsHeaders = corsHeadersForRequest(req);
    Object.assign(headers, corsHeaders);
    res.writeHead(200, headers);

    sendSseEvent(res, {
      event: 'stream_open',
      runId,
      status: run.status,
      timestamp: new Date().toISOString()
    });
    (run.events || []).forEach((evt) => sendSseEvent(res, evt));

    const unsubscribe = agentRuntime.subscribe(runId, (evt) => {
      sendSseEvent(res, evt);
      if (evt.event === 'run_completed' || evt.event === 'run_failed' || evt.event === 'run_reverted') {
        res.write(': done\n\n');
      }
    });

    const heartbeatId = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeatId);
      unsubscribe();
    });
  });

  router.post('/api/agents/prompt-runs/:runId/cancel', (req, res) => {
    const runId = String(req.params.runId || '').trim();
    const run = agentRuntime.getRun(runId);
    if (!run) {
      sendJSON(res, 404, { success: false, error: 'Run not found' });
      return;
    }
    const canceled = agentRuntime.cancelRun(runId);
    if (!canceled) {
      sendJSON(res, 409, { success: false, error: 'Run is already finished and cannot be canceled' });
      return;
    }
    sendJSON(res, 200, { success: true, runId, status: 'cancel_requested' });
  });

  router.post('/api/agents/prompt-runs/:runId/revert', wrapAsync(async (req, res) => {
    const runId = String(req.params.runId || '').trim();
    const run = agentRuntime.getRun(runId);
    if (!run) {
      sendJSON(res, 404, { success: false, error: 'Run not found' });
      return;
    }
    if (run.status === 'queued' || run.status === 'running') {
      sendJSON(res, 409, { success: false, error: 'Cannot revert while run is active' });
      return;
    }

    const result = agentRuntime.revertRun(runId);
    sendJSON(res, 200, {
      success: true,
      runId,
      revertedCount: result.revertedCount
    });
  }));
}

module.exports = {
  registerAgentRoutes
};
