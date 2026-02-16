const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  initRunManifest,
  writeFileWithSnapshot,
  updateManifestStatus,
  loadManifest,
  revertManifestWrites
} = require('./agent_file_guard_service');
const {
  loadShotContext,
  buildAgentMessages,
  buildFallbackPrompt,
  validatePromptStructure,
  refreshIndex
} = require('./agent_prompt_tools');
const projectManager = require('../project_manager');

function createRunId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

class AgentRuntimeService {
  constructor(options) {
    this.runs = new Map();
    this.shotLocks = new Map(); // key => runId
    this._aiProvider = options && options.aiProvider ? options.aiProvider : null;
  }

  getLockKey(projectId, shotId) {
    return `${projectId}:${shotId}`;
  }

  listLocks(projectId = '') {
    const prefix = projectId ? `${projectId}:` : '';
    const out = [];
    for (const [key, runId] of this.shotLocks.entries()) {
      if (prefix && !key.startsWith(prefix)) continue;
      const run = this.runs.get(runId);
      const [pId, shotId] = key.split(':');
      out.push({
        projectId: pId,
        shotId,
        runId,
        status: run ? run.status : 'unknown',
        startedAt: run ? run.startedAt : null
      });
    }
    return out;
  }

  getRun(runId) {
    return this.runs.get(runId) || null;
  }

  serializeRun(run) {
    if (!run) return null;
    return {
      runId: run.runId,
      projectId: run.projectId,
      shotId: run.shotId,
      variation: run.variation,
      mode: run.mode,
      status: run.status,
      step: run.step,
      progress: run.progress,
      steps: run.steps || [],
      writes: run.writes || [],
      lintSummary: run.lintSummary || null,
      error: run.error || null,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt || null
    };
  }

  subscribe(runId, listener) {
    const run = this.getRun(runId);
    if (!run) return () => {};
    run.listeners.add(listener);
    return () => {
      run.listeners.delete(listener);
    };
  }

  emit(run, event, payload = {}) {
    const message = {
      event,
      runId: run.runId,
      timestamp: new Date().toISOString(),
      ...payload
    };
    for (const listener of run.listeners) {
      try {
        listener(message);
      } catch {
        // ignore listener failure
      }
    }
    run.events.push(message);
    if (run.events.length > 200) run.events.shift();

    if (run.manifestPath) {
      try {
        const logPath = path.join(path.dirname(run.manifestPath), 'events.log');
        fs.appendFileSync(logPath, `${JSON.stringify(message)}\n`, 'utf8');
      } catch {
        // ignore disk log failure
      }
    }
  }

  setStep(run, step, progress) {
    run.step = step;
    run.progress = progress;
    run.steps = Array.isArray(run.steps) ? run.steps : [];
    run.steps.push({
      step,
      progress,
      at: new Date().toISOString()
    });
    if (run.steps.length > 300) {
      run.steps.shift();
    }
  }

  createRun(input, authContext) {
    const projectId = input.projectId;
    const shotId = input.shotId;
    const variation = String(input.variation || 'A').toUpperCase();
    const mode = input.mode || 'generate';
    const tool = (input.tool || 'seedream').toLowerCase();
    const instruction = input.instruction || '';

    const lockKey = this.getLockKey(projectId, shotId);
    if (this.shotLocks.has(lockKey)) {
      const activeRunId = this.shotLocks.get(lockKey);
      const err = new Error('Shot is currently locked by another run');
      err.code = 'LOCK_CONFLICT';
      err.activeRunId = activeRunId;
      throw err;
    }

    const runId = createRunId();
    const run = {
      runId,
      projectId,
      shotId,
      variation,
      mode,
      tool,
      instruction,
      status: 'queued',
      step: 'queued',
      progress: 0,
      steps: [],
      writes: [],
      lintSummary: null,
      error: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      listeners: new Set(),
      events: [],
      authContext: authContext || {},
      canceled: false,
      manifestPath: null,
      snapshotDir: null
    };

    this.runs.set(runId, run);
    this.shotLocks.set(lockKey, runId);
    setImmediate(() => this.executeRun(run).catch(() => {}));
    return run;
  }

  cancelRun(runId) {
    const run = this.getRun(runId);
    if (!run) return false;
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'canceled') return false;
    run.canceled = true;
    this.setStep(run, 'cancel_requested', run.progress || 0);
    this.emit(run, 'run_cancel_requested', { step: run.step });
    return true;
  }

  assertNotCanceled(run) {
    if (!run.canceled) return;
    const err = new Error('Run canceled by user');
    err.code = 'CANCELED';
    throw err;
  }

  async executeRun(run) {
    const projectPath = projectManager.getProjectPath(run.projectId);
    const { manifestPath, snapshotDir } = initRunManifest(projectPath, run);
    run.manifestPath = manifestPath;
    run.snapshotDir = snapshotDir;

    try {
      run.status = 'running';
      this.setStep(run, 'run_started', 5);
      this.emit(run, 'run_started', { step: run.step, progress: run.progress });

      this.assertNotCanceled(run);
      this.setStep(run, 'load_shot_context', 15);
      this.emit(run, 'tool_call', { tool: 'load_shot_context', step: run.step, progress: run.progress });
      const context = loadShotContext({
        projectId: run.projectId,
        shotId: run.shotId,
        variation: run.variation,
        tool: run.tool
      });

      this.assertNotCanceled(run);
      this.setStep(run, 'propose_prompt_blocks', 35);
      this.emit(run, 'tool_call', { tool: 'propose_prompt_blocks', step: run.step, progress: run.progress });

      const aiProvider = this._aiProvider;
      if (!aiProvider) {
        throw new Error('AI provider service not configured');
      }
      const provider = aiProvider.getActiveProvider();
      const providerConfig = {};
      if (provider === 'github') {
        const token = run.authContext && run.authContext.accessToken ? run.authContext.accessToken : '';
        if (!token) {
          const authErr = new Error('GitHub OAuth session required to run prompt agent');
          authErr.code = 'AUTH_REQUIRED';
          throw authErr;
        }
        providerConfig.token = token;
      }

      const messages = buildAgentMessages(context, run.instruction);
      const modelResult = await aiProvider.generate(providerConfig, { messages });
      const proposedContent = modelResult.content || buildFallbackPrompt(context, run.instruction);

      this.assertNotCanceled(run);
      this.setStep(run, 'validate_prompt_structure', 50);
      this.emit(run, 'tool_call', { tool: 'validate_prompt_structure', step: run.step, progress: run.progress });
      const validation = validatePromptStructure(proposedContent, run.tool);
      if (!validation.ok) {
        const validationErr = new Error(validation.errors.join('; '));
        validationErr.code = 'VALIDATION_FAILED';
        throw validationErr;
      }

      this.assertNotCanceled(run);
      this.setStep(run, 'file_write_preview', 65);
      this.emit(run, 'file_write_preview', {
        path: context.promptRelativePath,
        preview: proposedContent.slice(0, 280),
        step: run.step,
        progress: run.progress
      });

      const writeRecord = writeFileWithSnapshot({
        projectPath,
        relativePath: context.promptRelativePath,
        content: proposedContent,
        manifestPath: run.manifestPath,
        snapshotDir: run.snapshotDir
      });
      run.writes.push(writeRecord);
      this.emit(run, 'file_written', {
        path: writeRecord.path,
        afterHash: writeRecord.afterHash,
        step: 'file_written'
      });

      this.assertNotCanceled(run);
      this.setStep(run, 'refresh_index', 80);
      this.emit(run, 'tool_call', { tool: 'refresh_index', step: run.step, progress: run.progress });
      const indexResult = refreshIndex(run.projectId);
      if (!indexResult.ok) {
        const idxErr = new Error(indexResult.stderr || 'generate_index failed');
        idxErr.code = 'INDEX_FAILED';
        throw idxErr;
      }

      this.setStep(run, 'lint_result', 90);
      run.lintSummary = { pass: 1, fail: 0, warnings: validation.warnings.length };
      this.emit(run, 'lint_result', { lintSummary: run.lintSummary, step: run.step, progress: run.progress });

      run.status = 'completed';
      this.setStep(run, 'run_completed', 100);
      run.finishedAt = new Date().toISOString();
      updateManifestStatus(run.manifestPath, run.status, run.finishedAt);
      this.emit(run, 'run_completed', this.serializeRun(run));
    } catch (err) {
      run.finishedAt = new Date().toISOString();
      if (err.code === 'CANCELED') {
        run.status = 'canceled';
      } else {
        run.status = 'failed';
      }
      run.error = { code: err.code || 'RUN_FAILED', message: err.message || 'Agent run failed' };
      updateManifestStatus(run.manifestPath, run.status, run.finishedAt);
      this.emit(run, 'run_failed', {
        status: run.status,
        error: run.error,
        finishedAt: run.finishedAt
      });
    } finally {
      const lockKey = this.getLockKey(run.projectId, run.shotId);
      if (this.shotLocks.get(lockKey) === run.runId) {
        this.shotLocks.delete(lockKey);
      }
    }
  }

  revertRun(runId) {
    const run = this.getRun(runId);
    if (!run) throw new Error('Run not found');
    if (!run.manifestPath) throw new Error('Run manifest missing');
    if (run.status === 'queued' || run.status === 'running') {
      throw new Error('Cannot revert while run is active');
    }

    const projectPath = projectManager.getProjectPath(run.projectId);
    const result = revertManifestWrites(projectPath, run.manifestPath);
    run.status = 'reverted';
    run.finishedAt = run.finishedAt || new Date().toISOString();
    run.writes = (run.writes || []).map((w) => ({ ...w, result: 'reverted' }));
    const indexResult = refreshIndex(run.projectId);
    this.emit(run, 'run_reverted', {
      revertedCount: result.revertedCount,
      indexRefreshed: Boolean(indexResult && indexResult.ok)
    });
    return {
      revertedCount: result.revertedCount,
      indexRefreshed: Boolean(indexResult && indexResult.ok)
    };
  }

  getManifest(runId) {
    const run = this.getRun(runId);
    if (!run || !run.manifestPath) return null;
    return loadManifest(run.manifestPath);
  }
}

module.exports = {
  AgentRuntimeService
};
