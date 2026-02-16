function mapPageChatError(err) {
  if (!err) return { status: 500, code: 'PAGE_CHAT_ERROR' };
  if (err.code === 'AUTH_REQUIRED') {
    return { status: 401, code: 'AUTH_REQUIRED' };
  }
  if (err.code === 'PROVIDER_NOT_CONFIGURED') {
    return { status: 401, code: 'PROVIDER_NOT_CONFIGURED' };
  }
  const msg = String(err.message || '').toLowerCase();
  if (msg.includes('not found')) {
    return { status: 404, code: 'NOT_FOUND' };
  }
  if (
    msg.includes('required')
    || msg.includes('invalid')
    || msg.includes('unsupported')
    || msg.includes('disallowed')
    || msg.includes('read-only')
    || msg.includes('no proposals selected')
  ) {
    return { status: 400, code: 'BAD_REQUEST' };
  }
  return { status: err.statusCode || 500, code: err.code || 'PAGE_CHAT_ERROR' };
}

function resolvePageChatProjectId(ctx, req, payload = null) {
  const payloadProject = payload && (payload.projectId || payload.project);
  const queryProject = req.query && req.query.project;
  const active = ctx.projectManager.getActiveProject();
  return ctx.resolveProjectId(payloadProject || queryProject || active, { required: true });
}

function registerPageChatRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    jsonBody,
    MAX_BODY_SIZE,
    ensureSession,
    getGitHubAuthPayload,
    pageChatService,
    pageChatStore,
    aiProvider
  } = ctx;

  router.get('/api/page-chat/status', wrapAsync(async (req, res) => {
    const projectId = resolvePageChatProjectId(ctx, req);
    const pageId = pageChatStore.validatePageId(req.query.page || req.query.pageId || 'index');
    const session = ensureSession(req, res);
    const memory = pageChatService.getStatus(projectId, pageId);

    sendJSON(res, 200, {
      success: true,
      projectId,
      pageId,
      auth: getGitHubAuthPayload(session),
      memory
    });
  }));

  router.post('/api/page-chat/sessions', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolvePageChatProjectId(ctx, req, payload);
    const pageId = pageChatStore.validatePageId(payload.pageId || payload.page || 'index');
    const url = typeof payload.url === 'string' ? payload.url : '';

    const opened = pageChatService.openOrCreateSession({
      projectId,
      pageId,
      url
    });

    sendJSON(res, 200, {
      success: true,
      sessionId: opened.session.sessionId,
      projectId,
      pageId,
      createdAt: opened.session.createdAt,
      openedExisting: !opened.created
    });
  }));

  router.get('/api/page-chat/sessions/:sessionId', wrapAsync(async (req, res) => {
    const projectId = resolvePageChatProjectId(ctx, req);
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) {
      sendJSON(res, 400, { success: false, error: 'sessionId is required' });
      return;
    }

    const session = pageChatService.loadSession(projectId, sessionId);
    if (!session) {
      sendJSON(res, 404, { success: false, error: 'Chat session not found' });
      return;
    }

    sendJSON(res, 200, {
      success: true,
      session
    });
  }));

  router.post('/api/page-chat/sessions/:sessionId/messages', wrapAsync(async (req, res) => {
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

    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolvePageChatProjectId(ctx, req, payload);
    const sessionId = String(req.params.sessionId || '').trim();

    try {
      const result = await pageChatService.generateProposals({
        projectId,
        sessionId,
        message: payload.message,
        pageState: payload.pageState,
        accessToken: (session.githubAuth && session.githubAuth.accessToken) || ''
      });
      sendJSON(res, 200, {
        success: true,
        assistantMessage: result.assistantMessage,
        proposals: result.proposals,
        warnings: result.warnings || []
      });
    } catch (err) {
      const mapped = mapPageChatError(err);
      sendJSON(res, mapped.status, {
        success: false,
        error: err.message || 'Failed to process chat message',
        code: mapped.code
      });
    }
  }));

  router.post('/api/page-chat/sessions/:sessionId/apply', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolvePageChatProjectId(ctx, req, payload);
    const sessionId = String(req.params.sessionId || '').trim();

    try {
      const result = pageChatService.applySelectedProposals({
        projectId,
        sessionId,
        proposalIds: payload.proposalIds
      });
      sendJSON(res, 200, {
        success: true,
        applyId: result.applyId,
        applied: result.applied
      });
    } catch (err) {
      const mapped = mapPageChatError(err);
      sendJSON(res, mapped.status, {
        success: false,
        error: err.message || 'Failed to apply proposals',
        code: mapped.code
      });
    }
  }));

  router.post('/api/page-chat/sessions/:sessionId/undo', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolvePageChatProjectId(ctx, req, payload);
    const sessionId = String(req.params.sessionId || '').trim();
    const applyId = String(payload.applyId || '').trim();

    if (!applyId) {
      sendJSON(res, 400, { success: false, error: 'applyId is required' });
      return;
    }

    try {
      const result = pageChatService.undoApply({
        projectId,
        sessionId,
        applyId
      });
      sendJSON(res, 200, {
        success: true,
        applyId: result.applyId,
        revertedCount: result.revertedCount,
        alreadyReverted: result.alreadyReverted
      });
    } catch (err) {
      const mapped = mapPageChatError(err);
      sendJSON(res, mapped.status, {
        success: false,
        error: err.message || 'Failed to undo apply',
        code: mapped.code
      });
    }
  }));
}

module.exports = {
  registerPageChatRoutes
};
