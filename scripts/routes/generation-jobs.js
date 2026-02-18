function registerGenerationJobRoutes(router, ctx) {
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
    generationJobs,
    startGenerationJob,
    sendSseEvent,
    corsHeadersForRequest
  } = ctx;

  router.get('/api/generation-jobs', wrapAsync(async (req, res) => {
    const rawProjectId = String(req.query.project || req.query.projectId || '').trim();
    const projectId = rawProjectId
      ? resolveProjectId(rawProjectId, { required: true })
      : '';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(200, Math.floor(limitRaw)))
      : 50;
    const filterType = String(req.query.type || '').trim();
    const filterShotId = String(req.query.shotId || '').trim();
    const filterVariation = String(req.query.variation || '').toUpperCase().trim();
    const statusRaw = String(req.query.status || '').trim();
    const statusFilter = statusRaw
      ? new Set(statusRaw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))
      : null;

    if (filterShotId) sanitizePathSegment(filterShotId, SHOT_ID_REGEX, 'shotId');
    if (filterVariation) sanitizePathSegment(filterVariation, VARIATION_REGEX, 'variation');

    let jobs = generationJobs.listJobs(projectId, limit);
    if (filterType) {
      jobs = jobs.filter((job) => String(job.type || '').toLowerCase() === filterType.toLowerCase());
    }
    if (filterShotId) {
      jobs = jobs.filter((job) => String(job.input?.shotId || '') === filterShotId);
    }
    if (filterVariation) {
      jobs = jobs.filter((job) => String(job.input?.variation || 'A').toUpperCase() === filterVariation);
    }
    if (statusFilter && statusFilter.size > 0) {
      jobs = jobs.filter((job) => statusFilter.has(String(job.status || '').toLowerCase()));
    }

    sendJSON(res, 200, { success: true, jobs });
  }));

  router.get('/api/generation-jobs/metrics', wrapAsync(async (req, res) => {
    const rawProjectId = String(req.query.project || req.query.projectId || '').trim();
    const projectId = rawProjectId
      ? resolveProjectId(rawProjectId, { required: true })
      : '';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(1000, Math.floor(limitRaw)))
      : 200;
    const metrics = generationJobs.getMetrics(projectId, limit);
    sendJSON(res, 200, { success: true, metrics });
  }));

  router.post('/api/generation-jobs', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const type = String(payload.type || '').trim();
    if (!['generate-shot', 'generate-image'].includes(type)) {
      throw new Error('type must be "generate-shot" or "generate-image"');
    }

    const baseInput = payload.input && typeof payload.input === 'object' && !Array.isArray(payload.input)
      ? { ...payload.input }
      : { ...payload };
    delete baseInput.type;

    const projectId = resolveProjectId(
      payload.projectId
        || payload.project
        || baseInput.projectId
        || baseInput.project
        || projectManager.getActiveProject(),
      { required: true }
    );

    const input = {
      ...baseInput,
      project: projectId
    };
    delete input.projectId;

    try {
      const created = startGenerationJob(projectId, type, input);
      sendJSON(res, 200, {
        success: true,
        jobId: created.jobId,
        lockKey: created.lockKey || '',
        status: created.status,
        startedAt: created.createdAt
      });
    } catch (createErr) {
      if (createErr && createErr.code === 'LOCK_CONFLICT') {
        const activeJob = generationJobs.getJob(createErr.activeJobId);
        sendJSON(res, 409, {
          success: false,
          error: createErr.message || 'Generation target is currently locked',
          code: 'LOCK_CONFLICT',
          activeJobId: createErr.activeJobId || null,
          activeJob: activeJob || null
        });
        return;
      }
      throw createErr;
    }
  }));

  router.get('/api/generation-jobs/:jobId/events', (req, res) => {
    const jobId = String(req.params.jobId || '').trim();
    const job = generationJobs.getJob(jobId);
    if (!job) {
      sendJSON(res, 404, { success: false, error: 'Job not found' });
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
      jobId,
      status: job.status,
      timestamp: new Date().toISOString()
    });

    const safeSseWrite = (data) => {
      if (res.writableEnded || res.destroyed) return false;
      try { res.write(data); return true; } catch { return false; }
    };

    (job.events || []).forEach((evt) => sendSseEvent(res, evt));

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeatId);
      unsubscribe();
    };

    const unsubscribe = generationJobs.subscribe(jobId, (evt) => {
      if (res.writableEnded || res.destroyed) { cleanup(); return; }
      sendSseEvent(res, evt);
      if (evt.event === 'job_completed' || evt.event === 'job_failed' || evt.event === 'job_canceled') {
        safeSseWrite(': done\n\n');
      }
    });

    const heartbeatId = setInterval(() => {
      if (!safeSseWrite(': ping\n\n')) cleanup();
    }, require('../config').SSE_HEARTBEAT_MS);

    req.on('close', cleanup);
    res.on('error', cleanup);
  });

  router.get('/api/generation-jobs/:jobId', (req, res) => {
    const jobId = String(req.params.jobId || '').trim();
    const job = generationJobs.getJob(jobId);
    if (!job) {
      sendJSON(res, 404, { success: false, error: 'Job not found' });
      return;
    }
    sendJSON(res, 200, { success: true, job });
  });

  router.post('/api/generation-jobs/:jobId/cancel', (req, res) => {
    const jobId = String(req.params.jobId || '').trim();
    const job = generationJobs.getJob(jobId);
    if (!job) {
      sendJSON(res, 404, { success: false, error: 'Job not found' });
      return;
    }

    const canceled = generationJobs.cancelJob(jobId);
    if (!canceled) {
      sendJSON(res, 409, { success: false, error: 'Job is already finished and cannot be canceled' });
      return;
    }
    sendJSON(res, 200, { success: true, jobId, status: 'cancel_requested' });
  });

  router.post('/api/generation-jobs/:jobId/retry', wrapAsync(async (req, res) => {
    const sourceJobId = String(req.params.jobId || '').trim();
    const sourceJob = generationJobs.getJob(sourceJobId);
    if (!sourceJob) {
      sendJSON(res, 404, { success: false, error: 'Source job not found' });
      return;
    }

    if (!['completed', 'failed', 'canceled'].includes(String(sourceJob.status || ''))) {
      sendJSON(res, 409, {
        success: false,
        error: 'Cannot retry while source job is still active',
        code: 'SOURCE_JOB_ACTIVE'
      });
      return;
    }

    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(
      payload.projectId
        || payload.project
        || sourceJob.projectId
        || projectManager.getActiveProject(),
      { required: true }
    );

    const input = {
      ...(sourceJob.input || {}),
      project: projectId
    };
    delete input.projectId;

    const overrides = payload.overrides && typeof payload.overrides === 'object'
      ? payload.overrides
      : {};
    if (sourceJob.type === 'generate-shot') {
      if (Object.prototype.hasOwnProperty.call(overrides, 'variation')) {
        input.variation = sanitizePathSegment(
          String(overrides.variation || '').toUpperCase(),
          VARIATION_REGEX,
          'variation'
        );
      }
      if (Object.prototype.hasOwnProperty.call(overrides, 'maxImages')) {
        const maxImagesRaw = Number(overrides.maxImages);
        if (!Number.isFinite(maxImagesRaw)) {
          throw new Error('maxImages must be a number');
        }
        input.maxImages = Math.max(1, Math.min(2, Math.floor(maxImagesRaw)));
      }
      if (Object.prototype.hasOwnProperty.call(overrides, 'requireReference')) {
        input.requireReference = Boolean(overrides.requireReference);
      }
      if (Object.prototype.hasOwnProperty.call(overrides, 'autoPrepareRefSet')) {
        input.autoPrepareRefSet = Boolean(overrides.autoPrepareRefSet);
      }
      if (Object.prototype.hasOwnProperty.call(overrides, 'useContinuity')) {
        input.useContinuity = Boolean(overrides.useContinuity);
      }
      if (Object.prototype.hasOwnProperty.call(overrides, 'referencePolicy')) {
        const policy = String(overrides.referencePolicy || '').trim();
        if (!policy) {
          throw new Error('referencePolicy must be a non-empty string');
        }
        input.referencePolicy = policy;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, 'aspect_ratio')) {
        const aspect = String(overrides.aspect_ratio || '').trim();
        input.aspect_ratio = aspect;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, 'size')) {
        input.size = String(overrides.size || '').trim();
      }
      if (Object.prototype.hasOwnProperty.call(overrides, 'previewOnly')) {
        input.previewOnly = Boolean(overrides.previewOnly);
      }
      if (Object.prototype.hasOwnProperty.call(overrides, 'width')) {
        const width = Number(overrides.width);
        input.width = Number.isFinite(width) && width > 0 ? Math.floor(width) : undefined;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, 'height')) {
        const height = Number(overrides.height);
        input.height = Number.isFinite(height) && height > 0 ? Math.floor(height) : undefined;
      }
      if (Object.prototype.hasOwnProperty.call(input, 'width') && input.width === undefined) delete input.width;
      if (Object.prototype.hasOwnProperty.call(input, 'height') && input.height === undefined) delete input.height;
    }

    try {
      const created = startGenerationJob(projectId, sourceJob.type, input);
      sendJSON(res, 200, {
        success: true,
        retriedFrom: sourceJobId,
        jobId: created.jobId,
        status: created.status,
        startedAt: created.createdAt
      });
    } catch (retryErr) {
      if (retryErr && retryErr.code === 'LOCK_CONFLICT') {
        const activeJob = generationJobs.getJob(retryErr.activeJobId);
        sendJSON(res, 409, {
          success: false,
          error: retryErr.message || 'Generation target is currently locked',
          code: 'LOCK_CONFLICT',
          activeJobId: retryErr.activeJobId || null,
          activeJob: activeJob || null
        });
        return;
      }
      throw retryErr;
    }
  }));
}

module.exports = {
  registerGenerationJobRoutes
};
