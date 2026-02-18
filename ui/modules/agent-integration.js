(function(root) {
  'use strict';

  // Lazy accessors
  function getSharedUtils() { return root.SharedUtils; }
  function getAppState() { return root.AppState; }

  var el = getSharedUtils().el;

  // Service dependency injected by app.js
  var _loadIndexFn = null;
  var agentRuntimeService = null;
  var generationReadinessService = null;

  function init(deps) {
    _loadIndexFn = deps.loadIndex || null;
  }

  function getAgentRuntimeService() {
    if (agentRuntimeService) return agentRuntimeService;
    if (!root.AgentRuntimeService || !root.AgentRuntimeService.createAgentRuntimeService) {
      throw new Error('AgentRuntimeService.createAgentRuntimeService is required');
    }
    agentRuntimeService = root.AgentRuntimeService.createAgentRuntimeService();
    return agentRuntimeService;
  }

  function getGenerationReadinessService() {
    if (generationReadinessService) return generationReadinessService;
    if (!root.GenerationReadinessService || !root.GenerationReadinessService.createGenerationReadinessService) {
      throw new Error('GenerationReadinessService.createGenerationReadinessService is required');
    }
    generationReadinessService = root.GenerationReadinessService.createGenerationReadinessService();
    return generationReadinessService;
  }

  function classifyError(error, fallbackCode) {
    if (root.ErrorTaxonomy && typeof root.ErrorTaxonomy.classify === 'function') {
      return root.ErrorTaxonomy.classify(error, fallbackCode || 'SERVER_ERROR');
    }
    return {
      code: fallbackCode || 'SERVER_ERROR',
      message: (error && error.message) ? String(error.message) : 'Unexpected error',
      raw: error || null
    };
  }

  function toUserMessage(classified) {
    if (root.ErrorTaxonomy && typeof root.ErrorTaxonomy.toUserMessage === 'function') {
      return root.ErrorTaxonomy.toUserMessage(classified);
    }
    return classified && classified.message ? classified.message : 'Unexpected error';
  }

  function getAgentState() {
    var appState = getAppState();
    return {
      get githubAuthState() { return appState.get('githubAuthState'); },
      set githubAuthState(v) { appState.set('githubAuthState', v); },
      get agentActiveRunId() { return appState.get('agentActiveRunId'); },
      set agentActiveRunId(v) { appState.set('agentActiveRunId', v); },
      get agentEventSource() { return appState.get('agentEventSource'); },
      set agentEventSource(v) { appState.set('agentEventSource', v); },
      get agentRunCache() { return appState.get('agentRunCache'); },
      set agentRunCache(v) { appState.set('agentRunCache', v); }
    };
  }

  function getProjectState() {
    return { currentProject: getAppState().get('currentProject') };
  }

  function getPromptsState() {
    var appState = getAppState();
    return {
      get currentShot() { return appState.get('currentShot'); },
      get currentVariation() { return appState.get('currentVariation'); },
      get currentTool() { return appState.get('currentTool'); }
    };
  }

  async function checkGenerateStatus() {
    var appState = getAppState();
    try {
      var result = await getGenerationReadinessService().getGenerateStatus();
      if (result.ok) {
        var data = result.data || {};
        appState.set('canGenerate', data.configured === true);
        appState.set('generateTokenSource', data.tokenSource || 'none');
        var replicateKeyStatus = el('replicateKeyStatus');
        if (replicateKeyStatus) {
          if (data.configured === true) {
            if (data.tokenSource === 'session') {
              replicateKeyStatus.textContent = 'Configured (session key)';
            } else if (data.tokenSource === 'local') {
              replicateKeyStatus.textContent = 'Configured (local-only key)';
            } else {
              replicateKeyStatus.textContent = 'Configured (.env key)';
            }
          } else {
            replicateKeyStatus.textContent = 'Not configured';
          }
        }
      }
    } catch (e) {
      appState.set('canGenerate', false);
      appState.set('generateTokenSource', 'none');
      var replicateKeyStatus = el('replicateKeyStatus');
      if (replicateKeyStatus) replicateKeyStatus.textContent = 'Status check failed';
    }
  }

  function isTerminalRunStatus(status) {
    return status === 'completed' || status === 'failed' || status === 'canceled' || status === 'reverted';
  }

  function closeAgentEventStream() {
    var agentState = getAgentState();
    if (!agentState.agentEventSource) return;
    agentState.agentEventSource.close();
    agentState.agentEventSource = null;
  }

  function resetAgentRunUI(opts) {
    opts = opts || {};
    var clearLog = opts.clearLog !== undefined ? opts.clearLog : true;
    var agentState = getAgentState();
    var agentRunStatus = el('agentRunStatus');
    var agentRunFiles = el('agentRunFiles');
    var agentRunLog = el('agentRunLog');
    var agentCancelRunBtn = el('agentCancelRunBtn');
    var agentRevertRunBtn = el('agentRevertRunBtn');

    if (agentRunStatus) agentRunStatus.textContent = 'No run started yet.';
    if (agentRunFiles) agentRunFiles.innerHTML = '';
    if (clearLog && agentRunLog) agentRunLog.textContent = '';
    if (agentCancelRunBtn) agentCancelRunBtn.disabled = true;
    if (agentRevertRunBtn) agentRevertRunBtn.disabled = true;
    agentState.agentRunCache = null;
    agentState.agentActiveRunId = null;
    closeAgentEventStream();
  }

  function appendAgentLogLine(line) {
    var agentRunLog = el('agentRunLog');
    if (!agentRunLog) return;
    var text = String(line || '').trim();
    if (!text) return;
    var maxLines = 200;
    var existing = agentRunLog.textContent ? agentRunLog.textContent.split('\n') : [];
    existing.push(text);
    if (existing.length > maxLines) {
      existing.splice(0, existing.length - maxLines);
    }
    agentRunLog.textContent = existing.join('\n');
    agentRunLog.scrollTop = agentRunLog.scrollHeight;
  }

  function updateGitHubAuthUI() {
    var agentState = getAgentState();
    var githubAuthPill = el('githubAuthPill');
    var githubConnectBtn = el('githubConnectBtn');
    var githubLogoutBtn = el('githubLogoutBtn');

    if (githubAuthPill) {
      githubAuthPill.classList.remove('connected', 'disconnected');
      if (agentState.githubAuthState.connected) {
        githubAuthPill.classList.add('connected');
        var who = agentState.githubAuthState.username ? '@' + agentState.githubAuthState.username : 'connected';
        githubAuthPill.textContent = 'GitHub ' + who;
      } else {
        githubAuthPill.classList.add('disconnected');
        githubAuthPill.textContent = 'GitHub not connected';
      }
    }
    if (githubConnectBtn) {
      githubConnectBtn.style.display = agentState.githubAuthState.connected ? 'none' : 'inline-flex';
    }
    if (githubLogoutBtn) {
      githubLogoutBtn.style.display = agentState.githubAuthState.connected ? 'inline-flex' : 'none';
    }
  }

  function updateAgentControlsForShot() {
    var projectState = getProjectState();
    var promptsState = getPromptsState();
    var hasShot = Boolean(projectState.currentProject && promptsState.currentShot && promptsState.currentTool);
    var showRenders = hasShot && (promptsState.currentTool === 'seedream' || promptsState.currentTool === 'kling');

    var agentGeneratePromptBtn = el('agentGeneratePromptBtn');
    var shotGenerationLayout = el('shotGenerationLayout');
    var agentRunPanel = el('agentRunPanel');

    if (agentGeneratePromptBtn) {
      agentGeneratePromptBtn.style.display = hasShot ? 'inline-flex' : 'none';
      agentGeneratePromptBtn.disabled = !hasShot;
    }
    if (shotGenerationLayout) {
      if (!hasShot) {
        shotGenerationLayout.style.display = 'none';
      } else {
        shotGenerationLayout.style.display = 'grid';
        shotGenerationLayout.style.gridTemplateColumns = showRenders ? '' : '1fr';
      }
    }
    if (agentRunPanel) {
      agentRunPanel.style.display = hasShot ? 'block' : 'none';
    }
  }

  function renderAgentRunFiles(run) {
    var agentRunFilesEl = el('agentRunFiles');
    if (!agentRunFilesEl) return;
    var writes = Array.isArray(run && run.writes) ? run.writes : [];
    if (writes.length === 0) {
      agentRunFilesEl.innerHTML = '';
      return;
    }

    var projectState = getProjectState();
    var projectQuery = projectState.currentProject ? '?project=' + encodeURIComponent(projectState.currentProject.id) : '';
    agentRunFilesEl.innerHTML = '';
    writes.forEach(function(write) {
      var row = document.createElement('div');
      row.className = 'agent-run-file';
      var pathText = String(write.path || '').replace(/^\/+/, '');
      var anchor = document.createElement('a');
      anchor.href = '/' + pathText + projectQuery;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = pathText;
      var status = document.createElement('span');
      status.textContent = '[' + (write.result || 'written') + ']';
      row.appendChild(anchor);
      row.appendChild(status);
      agentRunFilesEl.appendChild(row);
    });
  }

  function renderAgentRunState(run) {
    if (!run) return;
    var agentState = getAgentState();
    agentState.agentRunCache = run;
    var status = run.status || 'unknown';
    var step = run.step || '';
    var progress = Number.isFinite(run.progress) ? Math.max(0, Math.min(100, run.progress)) : 0;
    var agentRunStatus = el('agentRunStatus');
    if (agentRunStatus) {
      var statusLabel = status + (step ? ' \u00b7 ' + step : '');
      agentRunStatus.textContent = statusLabel + ' (' + progress + '%)';
    }
    renderAgentRunFiles(run);

    var terminal = isTerminalRunStatus(status);
    var agentCancelRunBtn = el('agentCancelRunBtn');
    var agentRevertRunBtn = el('agentRevertRunBtn');
    if (agentCancelRunBtn) {
      agentCancelRunBtn.disabled = !agentState.agentActiveRunId || terminal;
    }
    if (agentRevertRunBtn) {
      var canRevert = Boolean(agentState.agentActiveRunId) && (status === 'completed' || status === 'failed' || status === 'canceled');
      agentRevertRunBtn.disabled = !canRevert;
    }
  }

  async function refreshGitHubAuthStatus(opts) {
    opts = opts || {};
    var silent = opts.silent || false;
    var agentState = getAgentState();
    var utils = getSharedUtils();

    try {
      var result = await getAgentRuntimeService().getGitHubStatus();
      if (!result.ok) {
        var statusErr = new Error(result.error || ('HTTP ' + result.status));
        statusErr.code = result.code || 'AUTH_REQUIRED';
        throw statusErr;
      }
      var data = result.data || {};
      agentState.githubAuthState = {
        connected: Boolean(data.connected),
        username: data.username || '',
        scopes: Array.isArray(data.scopes) ? data.scopes : [],
        tokenSource: data.tokenSource || 'none'
      };
    } catch (err) {
      agentState.githubAuthState = { connected: false, username: '', scopes: [], tokenSource: 'none' };
      if (!silent) {
        var classified = classifyError(err, 'AUTH_REQUIRED');
        utils.showToast('GitHub auth error', toUserMessage(classified), 'error', 3500);
      }
    }
    updateGitHubAuthUI();
    return agentState.githubAuthState;
  }

  function startGitHubOAuth() {
    var returnTo = window.location.pathname + (window.location.search || '');
    window.location.assign('/api/auth/github/start?returnTo=' + encodeURIComponent(returnTo));
  }

  async function logoutGitHubOAuth() {
    var agentState = getAgentState();
    var utils = getSharedUtils();
    try {
      var result = await getAgentRuntimeService().logoutGitHub();
      if (!result.ok) {
        var logoutErr = new Error(result.error || 'Failed to logout');
        logoutErr.code = result.code || 'AUTH_REQUIRED';
        throw logoutErr;
      }
      var payload = result.data || {};
      agentState.githubAuthState = {
        connected: Boolean(payload.connected),
        username: payload.username || '',
        scopes: Array.isArray(payload.scopes) ? payload.scopes : [],
        tokenSource: payload.tokenSource || 'none'
      };
      updateGitHubAuthUI();
      utils.showToast('GitHub disconnected', 'OAuth session cleared for this browser session.', 'info', 2500);
    } catch (err) {
      var classified = classifyError(err, 'AUTH_REQUIRED');
      utils.showToast('Logout failed', toUserMessage(classified), 'error', 3500);
    }
  }

  async function fetchAgentRunState(runId) {
    var result = await getAgentRuntimeService().getRun(runId);
    if (!result.ok) {
      var runErr = new Error(result.error || 'Failed to fetch run state');
      runErr.code = result.code || 'SERVER_ERROR';
      throw runErr;
    }
    return result.data || {};
  }

  function connectAgentRunEvents(runId) {
    var agentState = getAgentState();
    var utils = getSharedUtils();
    closeAgentEventStream();
    var source = getAgentRuntimeService().createRunEventsSource(runId);
    agentState.agentEventSource = source;

    source.onmessage = function(event) {
      var payload;
      try {
        payload = JSON.parse(event.data || '{}');
      } catch (e) {
        payload = {};
      }

      var eventName = payload.event || 'event';
      if (eventName === 'stream_open') {
        appendAgentLogLine('[stream] ' + (payload.status || 'open'));
        return;
      }

      var ts = payload.timestamp ? new Date(payload.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
      var logSummary = (payload.error && payload.error.message)
        ? eventName + ': ' + payload.error.message
        : (payload.path ? eventName + ': ' + payload.path : eventName);
      appendAgentLogLine('[' + ts + '] ' + logSummary);

      if (payload.event === 'file_write_preview' && payload.preview) {
        appendAgentLogLine('preview> ' + String(payload.preview).replace(/\s+/g, ' ').slice(0, 220));
      }

      if (payload.event === 'run_completed' || payload.event === 'run_failed' || payload.event === 'run_reverted') {
        closeAgentEventStream();
      }

      if (agentState.agentActiveRunId) {
        fetchAgentRunState(agentState.agentActiveRunId)
          .then(function(run) {
            renderAgentRunState(run);
            if (isTerminalRunStatus(run.status)) {
              if (run.status === 'completed') {
                utils.showToast('Agent run completed', run.shotId + ' ' + run.variation, 'success', 2500);
                if (_loadIndexFn) _loadIndexFn();
              } else if (run.status === 'failed') {
                utils.showToast('Agent run failed', (run.error && run.error.message) || 'Unknown error', 'error', 5000);
              } else if (run.status === 'reverted') {
                utils.showToast('Agent run reverted', run.shotId + ' ' + run.variation, 'info', 3000);
                if (_loadIndexFn) _loadIndexFn();
              }
            }
          })
          .catch(function() {});
      }
    };

    source.onerror = function() {
      if (agentState.agentEventSource === source) {
        closeAgentEventStream();
        if (agentState.agentActiveRunId) {
          fetchAgentRunState(agentState.agentActiveRunId)
            .then(renderAgentRunState)
            .catch(function() {});
        }
      }
    };
  }

  async function startAgentPromptRun() {
    var projectState = getProjectState();
    var promptsState = getPromptsState();
    var agentState = getAgentState();
    var utils = getSharedUtils();
    if (!projectState.currentProject || !promptsState.currentShot || !promptsState.currentTool) return;

    var providerStatus = getAppState().get('aiProviderStatus');
    var activeProvider = providerStatus ? providerStatus.activeProvider : 'github';
    if (activeProvider === 'github' && !agentState.githubAuthState.connected) {
      utils.showToast('GitHub required', 'Connect GitHub first to run the in-app prompt agent.', 'warning', 3500);
      startGitHubOAuth();
      return;
    }
    if (activeProvider !== 'github') {
      var pInfo = providerStatus && providerStatus.providers ? providerStatus.providers[activeProvider] : null;
      if (!pInfo || !pInfo.configured) {
        utils.showToast('API key required', 'Configure your ' + activeProvider + ' API key in AI Settings first.', 'warning', 3500);
        openAiProviderModal();
        return;
      }
    }

    var agentGeneratePromptBtn = el('agentGeneratePromptBtn');
    var agentRunLog = el('agentRunLog');
    if (agentGeneratePromptBtn) {
      agentGeneratePromptBtn.disabled = true;
      agentGeneratePromptBtn.textContent = 'Starting...';
    }
    if (agentRunLog && !agentRunLog.textContent.trim()) {
      appendAgentLogLine('[' + new Date().toLocaleTimeString() + '] run queued');
    }

    try {
      var traceId = 'agent_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      var result = await getAgentRuntimeService().startRun({
        projectId: projectState.currentProject.id,
        shotId: promptsState.currentShot.shotId,
        variation: promptsState.currentVariation,
        mode: 'generate',
        tool: promptsState.currentTool,
        traceId: traceId
      });

      var payload = result.data || {};
      if (result.status === 409 && result.code === 'LOCK_CONFLICT') {
        var conflictErr = new Error(('Shot is locked by active run ' + (payload.activeRunId || '')).trim());
        conflictErr.code = 'LOCK_CONFLICT';
        throw conflictErr;
      }
      if (result.status === 401 && (result.code === 'AUTH_REQUIRED' || result.code === 'PROVIDER_NOT_CONFIGURED')) {
        var authErr = new Error(result.error || 'Authentication/session required');
        authErr.code = result.code;
        throw authErr;
      }
      if (!result.ok || !payload.runId) {
        var startErr = new Error(result.error || 'Failed to start run');
        startErr.code = result.code || 'SERVER_ERROR';
        throw startErr;
      }

      agentState.agentActiveRunId = payload.runId;
      appendAgentLogLine('[' + new Date().toLocaleTimeString() + '] run started: ' + payload.runId + ' [' + traceId + ']');
      var run = await fetchAgentRunState(payload.runId);
      renderAgentRunState(run);
      connectAgentRunEvents(payload.runId);
    } catch (err) {
      if (/auth/i.test(String(err.message || ''))) {
        refreshGitHubAuthStatus({ silent: true });
      }
      var classified = classifyError(err, 'SERVER_ERROR');
      utils.showToast('Agent run failed to start', toUserMessage(classified), 'error', 4500);
    } finally {
      if (agentGeneratePromptBtn) {
        agentGeneratePromptBtn.disabled = false;
        agentGeneratePromptBtn.textContent = 'Agent Generate Prompt';
      }
    }
  }

  async function cancelAgentRun() {
    var agentState = getAgentState();
    var utils = getSharedUtils();
    if (!agentState.agentActiveRunId) return;
    try {
      var result = await getAgentRuntimeService().cancelRun(agentState.agentActiveRunId);
      if (!result.ok) {
        throw new Error(result.error || 'Failed to cancel run');
      }
      appendAgentLogLine('[' + new Date().toLocaleTimeString() + '] cancel requested');
      utils.showToast('Cancel requested', 'Agent run will stop at the next safe step.', 'info', 2500);
      var run = await fetchAgentRunState(agentState.agentActiveRunId);
      renderAgentRunState(run);
    } catch (err) {
      var classified = classifyError(err, 'SERVER_ERROR');
      utils.showToast('Cancel failed', toUserMessage(classified), 'error', 3500);
    }
  }

  async function revertAgentRun() {
    var agentState = getAgentState();
    var utils = getSharedUtils();
    if (!agentState.agentActiveRunId) return;
    try {
      var result = await getAgentRuntimeService().revertRun(agentState.agentActiveRunId);
      if (!result.ok) {
        throw new Error(result.error || 'Failed to revert run');
      }
      var payload = result.data || {};
      appendAgentLogLine('[' + new Date().toLocaleTimeString() + '] reverted ' + (payload.revertedCount || 0) + ' file(s)');
      utils.showToast('Run reverted', (payload.revertedCount || 0) + ' file(s) restored', 'success', 3000);
      var run = await fetchAgentRunState(agentState.agentActiveRunId);
      renderAgentRunState(run);
      if (_loadIndexFn) await _loadIndexFn();
    } catch (err) {
      var classified = classifyError(err, 'SERVER_ERROR');
      utils.showToast('Revert failed', toUserMessage(classified), 'error', 4000);
    }
  }

  function handleGitHubOAuthQueryFeedback() {
    var utils = getSharedUtils();
    var params = new URLSearchParams(window.location.search || '');
    var oauthState = params.get('gh_oauth');
    if (!oauthState) return;
    var message = params.get('gh_oauth_message') || '';

    if (oauthState === 'connected') {
      utils.showToast('GitHub connected', 'OAuth session is active for prompt agents.', 'success', 3000);
    } else if (oauthState === 'error') {
      utils.showToast('GitHub OAuth failed', message || 'Authorization did not complete', 'error', 5000);
    }

    params.delete('gh_oauth');
    params.delete('gh_oauth_message');
    var nextQuery = params.toString();
    var nextUrl = window.location.pathname + (nextQuery ? '?' + nextQuery : '') + (window.location.hash || '');
    window.history.replaceState({}, '', nextUrl);
  }

  // ===== AI Provider Modal =====

  async function refreshAiProviderStatus() {
    try {
      var result = await getAgentRuntimeService().getAiProviderStatus();
      if (result.ok) {
        var data = result.data || {};
        getAppState().set('aiProviderStatus', data);
        return data;
      }
    } catch (e) {
      console.warn('[agent-integration]', e.message || e);
    }
    return null;
  }

  function renderAiProviderModal(status) {
    if (!status) return;
    var providers = status.providers || {};
    var active = status.activeProvider || 'github';

    var radios = document.querySelectorAll('input[name="aiProvider"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].checked = radios[i].value === active;
      var option = radios[i].closest('.ai-provider-option');
      if (option) {
        option.classList.toggle('active', radios[i].value === active);
      }
    }

    var anthropicModel = el('aiProviderAnthropicModel');
    var openaiModel = el('aiProviderOpenaiModel');
    var githubModel = el('aiProviderGithubModel');
    if (anthropicModel && providers.anthropic) anthropicModel.textContent = providers.anthropic.model || '';
    if (openaiModel && providers.openai) openaiModel.textContent = providers.openai.model || '';
    if (githubModel && providers.github) githubModel.textContent = providers.github.model || '';

    var anthropicStatus = el('anthropicKeyStatus');
    var openaiStatus = el('openaiKeyStatus');
    var githubStatus = el('githubProviderStatus');

    if (anthropicStatus && providers.anthropic) {
      anthropicStatus.textContent = providers.anthropic.configured
        ? 'Configured (' + providers.anthropic.tokenSource + ')'
        : 'Not configured';
    }
    if (openaiStatus && providers.openai) {
      openaiStatus.textContent = providers.openai.configured
        ? 'Configured (' + providers.openai.tokenSource + ')'
        : 'Not configured';
    }
    if (githubStatus) {
      var agentState = getAgentState();
      githubStatus.textContent = agentState.githubAuthState.connected
        ? 'Connected as @' + (agentState.githubAuthState.username || 'user')
        : 'Not connected';
    }
  }

  async function openAiProviderModal() {
    var modal = el('aiProviderModal');
    if (!modal) return;
    modal.style.display = 'flex';
    var status = await refreshAiProviderStatus();
    renderAiProviderModal(status);
  }

  function closeAiProviderModal() {
    var modal = el('aiProviderModal');
    if (modal) modal.style.display = 'none';
  }

  async function setActiveAiProvider(provider) {
    try {
      var result = await getAgentRuntimeService().setActiveAiProvider(provider);
      if (result.ok) {
        var data = result.data || {};
        getAppState().set('aiProviderStatus', data);
        renderAiProviderModal(data);
        getSharedUtils().showToast('Provider changed', 'Active AI provider set to ' + provider, 'success', 2500);
      }
    } catch (e) {
      console.warn('[agent-integration]', e.message || e);
    }
  }

  async function saveAiProviderKey(provider) {
    var inputId = provider === 'anthropic' ? 'anthropicKeyInput' : 'openaiKeyInput';
    var input = el(inputId);
    if (!input) return;
    var key = input.value.trim();
    if (!key) {
      getSharedUtils().showToast('Key required', 'Enter an API key to save.', 'warning', 2500);
      return;
    }
    try {
      var result = await getAgentRuntimeService().saveAiProviderKey(provider, key);
      if (result.ok) {
        var data = result.data || {};
        input.value = '';
        getAppState().set('aiProviderStatus', data);
        renderAiProviderModal(data);
        getSharedUtils().showToast('Key saved', provider + ' session key saved.', 'success', 2500);
      } else {
        throw new Error(result.error || 'Failed to save key');
      }
    } catch (e) {
      getSharedUtils().showToast('Error', 'Failed to save key.', 'error', 3000);
    }
  }

  async function clearAiProviderKey(provider) {
    try {
      var result = await getAgentRuntimeService().saveAiProviderKey(provider, '');
      if (result.ok) {
        var data = result.data || {};
        getAppState().set('aiProviderStatus', data);
        renderAiProviderModal(data);
        getSharedUtils().showToast('Key cleared', provider + ' session key cleared.', 'info', 2500);
      }
    } catch (e) {
      console.warn('[agent-integration]', e.message || e);
    }
  }

  function initAiProviderModal() {
    var btn = el('aiProviderBtn');
    if (btn) btn.addEventListener('click', openAiProviderModal);

    var closeBtn = el('aiProviderModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeAiProviderModal);

    var overlay = el('aiProviderModalOverlay');
    if (overlay) overlay.addEventListener('click', closeAiProviderModal);

    var doneBtn = el('aiProviderModalDone');
    if (doneBtn) doneBtn.addEventListener('click', closeAiProviderModal);

    var radios = document.querySelectorAll('input[name="aiProvider"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function() {
        if (this.checked) setActiveAiProvider(this.value);
      });
    }

    var saveAnthropicBtn = el('saveAnthropicKeyBtn');
    if (saveAnthropicBtn) saveAnthropicBtn.addEventListener('click', function() { saveAiProviderKey('anthropic'); });

    var clearAnthropicBtn = el('clearAnthropicKeyBtn');
    if (clearAnthropicBtn) clearAnthropicBtn.addEventListener('click', function() { clearAiProviderKey('anthropic'); });

    var saveOpenaiBtn = el('saveOpenaiKeyBtn');
    if (saveOpenaiBtn) saveOpenaiBtn.addEventListener('click', function() { saveAiProviderKey('openai'); });

    var clearOpenaiBtn = el('clearOpenaiKeyBtn');
    if (clearOpenaiBtn) clearOpenaiBtn.addEventListener('click', function() { clearAiProviderKey('openai'); });

    // Pre-fetch status
    refreshAiProviderStatus();
  }

  root.AgentIntegration = {
    init: init,
    checkGenerateStatus: checkGenerateStatus,
    isTerminalRunStatus: isTerminalRunStatus,
    closeAgentEventStream: closeAgentEventStream,
    resetAgentRunUI: resetAgentRunUI,
    appendAgentLogLine: appendAgentLogLine,
    updateGitHubAuthUI: updateGitHubAuthUI,
    updateAgentControlsForShot: updateAgentControlsForShot,
    renderAgentRunFiles: renderAgentRunFiles,
    renderAgentRunState: renderAgentRunState,
    refreshGitHubAuthStatus: refreshGitHubAuthStatus,
    startGitHubOAuth: startGitHubOAuth,
    logoutGitHubOAuth: logoutGitHubOAuth,
    fetchAgentRunState: fetchAgentRunState,
    connectAgentRunEvents: connectAgentRunEvents,
    startAgentPromptRun: startAgentPromptRun,
    cancelAgentRun: cancelAgentRun,
    revertAgentRun: revertAgentRun,
    handleGitHubOAuthQueryFeedback: handleGitHubOAuthQueryFeedback,
    initAiProviderModal: initAiProviderModal,
    openAiProviderModal: openAiProviderModal,
    refreshAiProviderStatus: refreshAiProviderStatus
  };
})(typeof window !== 'undefined' ? window : globalThis);
