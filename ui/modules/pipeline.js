(function initPipelineModule() {
  let pipelineService = null;

  function getPipelineService() {
    if (pipelineService) return pipelineService;
    if (!window.PipelineService || !window.PipelineService.createPipelineService) {
      throw new Error('PipelineService.createPipelineService is required');
    }
    pipelineService = window.PipelineService.createPipelineService();
    return pipelineService;
  }

  function resolveProjectId() {
    return window.SharedUtils.getProjectId();
  }

  function getToast() {
    if (typeof window.showToast === 'function') return window.showToast;
    return () => {};
  }

  function formatTime(iso) {
    if (!iso) return 'never';
    const ms = Date.parse(String(iso));
    if (!Number.isFinite(ms)) return 'never';
    return new Date(ms).toLocaleString();
  }

  function statusText(status) {
    if (!status || typeof status !== 'object') return 'Pipeline status unavailable';
    const lint = status.lintSummary || {};
    const lintPart = status.lastLintAt
      ? `Lint ${Number(lint.passed || 0)} pass / ${Number(lint.failed || 0)} fail`
      : 'Lint not run';
    const compilePart = `Compile: ${formatTime(status.lastCompileAt)}`;
    const indexPart = `Index: ${formatTime(status.lastReindexAt)}`;
    const countPart = `Prompts: ${Number(status.promptCount || 0)}`;
    return `${compilePart} · ${lintPart} · ${indexPart} · ${countPart}`;
  }

  function renderStatus(status) {
    const text = statusText(status);
    const statusEl = document.getElementById('pipelineStatus');
    if (statusEl) statusEl.textContent = text;

    const homeStatusEl = document.getElementById('homePipelineStatus');
    if (homeStatusEl) homeStatusEl.textContent = text;
  }

  async function fetchPipelineStatus() {
    const projectId = resolveProjectId();
    const result = await getPipelineService().getStatus(projectId);
    if (!result.ok) {
      const err = new Error(result.error || 'Failed to load pipeline status');
      err.code = result.code || 'SERVER_ERROR';
      throw err;
    }
    const payload = result.data || {};
    return payload.status || {};
  }

  async function updatePipelineStatus() {
    try {
      const status = await fetchPipelineStatus();
      renderStatus(status);
      return status;
    } catch (err) {
      const message = err && err.message ? err.message : 'Pipeline status unavailable';
      const statusEl = document.getElementById('pipelineStatus');
      if (statusEl) statusEl.textContent = message;
      const homeStatusEl = document.getElementById('homePipelineStatus');
      if (homeStatusEl) homeStatusEl.textContent = message;
      return null;
    }
  }

  async function runPipeline(action) {
    const toast = getToast();
    const projectId = resolveProjectId();
    const runBtn = document.getElementById('runPipelineBtn');
    const homeRunBtn = document.getElementById('homeRunPipelineBtn');
    const buttons = [runBtn, homeRunBtn].filter(Boolean);

    buttons.forEach((btn) => { btn.disabled = true; });
    toast('Pipeline', `Running ${action} for ${projectId}...`, 'info', 2000);

    try {
      const result = await getPipelineService().run(action, projectId);
      if (!result.ok) {
        const err = new Error(result.error || `Pipeline ${action} failed`);
        err.code = result.code || 'SERVER_ERROR';
        throw err;
      }

      const payload = result.data || {};
      renderStatus(payload.status || {});
      toast('Pipeline', `${action} completed`, 'success', 2500);

      if ((action === 'compile' || action === 'reindex' || action === 'run-all') && typeof window.loadIndex === 'function') {
        try {
          await window.loadIndex();
        } catch (refreshErr) {
          /* silently handled */
        }
      }
      return result;
    } catch (err) {
      toast('Pipeline', err.message || `Failed to run ${action}`, 'error', 3500);
      throw err;
    } finally {
      buttons.forEach((btn) => { btn.disabled = false; });
      updatePipelineStatus();
    }
  }

  function wirePipelineButtons() {
    const runBtn = document.getElementById('runPipelineBtn');
    if (runBtn) {
      runBtn.addEventListener('click', () => runPipeline('run-all'));
    }

    const homeRunBtn = document.getElementById('homeRunPipelineBtn');
    if (homeRunBtn) {
      homeRunBtn.addEventListener('click', () => runPipeline('run-all'));
    }

    const selector = document.getElementById('projectSelector');
    if (selector) {
      selector.addEventListener('change', () => {
        setTimeout(() => {
          updatePipelineStatus();
        }, 10);
      });
    }
  }

  window.PipelineUI = {
    runPipeline,
    updatePipelineStatus
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wirePipelineButtons();
      updatePipelineStatus();
    });
  } else {
    wirePipelineButtons();
    updatePipelineStatus();
  }
})();
