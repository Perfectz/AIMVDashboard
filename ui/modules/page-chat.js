(function(root) {
  'use strict';

  var state = {
    initialized: false,
    loading: false,
    projectId: '',
    pageId: 'index',
    sessionId: '',
    auth: { connected: false, username: '', tokenSource: 'none' },
    oauthConfig: { configured: false, source: 'none', clientIdPreview: '' },
    oauthConfigOpen: false,
    aiProvider: { activeProvider: 'github', providers: {} },
    keyInputOpen: false,
    messages: [],
    proposals: [],
    lastApplyId: '',
    bridge: null,
    service: null
  };

  var dom = {};

  function notify(title, message, tone, durationMs) {
    if (root.SharedUtils && typeof root.SharedUtils.showToast === 'function') {
      root.SharedUtils.showToast(title, message, tone || 'info', durationMs || 2800);
      return;
    }
    if (tone === 'error') {
      console.error('[PageChat]', title + ':', message);
      return;
    }
    console.log('[PageChat]', title + ':', message);
  }

  var escapeHtml = root.SharedUtils.escapeHtml;

  function getMountNode() {
    var mount = document.getElementById('globalPageChatMount');
    if (mount) return mount;
    mount = document.createElement('div');
    mount.id = 'globalPageChatMount';
    document.body.appendChild(mount);
    return mount;
  }

  function renderShell() {
    var mount = getMountNode();
    mount.innerHTML = '' +
      '<aside class="page-chat-shell collapsed" id="pageChatShell">' +
        '<button class="page-chat-tab" id="pageChatToggleBtn" type="button">Chat</button>' +
        '<div class="page-chat-panel">' +
          '<div class="page-chat-header">' +
            '<div class="page-chat-title-wrap">' +
              '<div class="page-chat-title">Page Copilot</div>' +
              '<div class="page-chat-sub" id="pageChatHeaderMeta">Page context</div>' +
            '</div>' +
            '<button class="btn btn-secondary btn-sm" id="pageChatCollapseBtn" type="button">Hide</button>' +
          '</div>' +
          '<div class="page-chat-provider" id="pageChatProviderRow">' +
            '<label class="page-chat-provider-label">AI Provider</label>' +
            '<select class="page-chat-provider-select" id="pageChatProviderSelect">' +
              '<option value="anthropic">Claude (Anthropic)</option>' +
              '<option value="openai">OpenAI</option>' +
              '<option value="github">GitHub Models</option>' +
            '</select>' +
            '<span class="page-chat-provider-status" id="pageChatProviderStatus"></span>' +
          '</div>' +
          '<div class="page-chat-key-config" id="pageChatKeyConfig" style="display:none;">' +
            '<input id="pageChatApiKeyInput" type="password" placeholder="Paste API key..." autocomplete="off" />' +
            '<div class="page-chat-key-actions">' +
              '<button class="btn btn-primary btn-sm" id="pageChatKeySaveBtn" type="button">Save Key</button>' +
              '<button class="btn btn-secondary btn-sm" id="pageChatKeyClearBtn" type="button">Clear</button>' +
            '</div>' +
            '<div class="page-chat-key-note">Session-only. Lost on server restart.</div>' +
          '</div>' +
          '<div class="page-chat-auth" id="pageChatAuthRow"></div>' +
          '<div class="page-chat-oauth-config" id="pageChatOAuthConfig" style="display:none;">' +
            '<div class="page-chat-oauth-title">Session OAuth App</div>' +
            '<input id="pageChatOauthClientId" type="text" placeholder="GitHub OAuth Client ID" autocomplete="off" />' +
            '<input id="pageChatOauthClientSecret" type="password" placeholder="GitHub OAuth Client Secret" autocomplete="off" />' +
            '<div class="page-chat-oauth-actions">' +
              '<button class="btn btn-primary btn-sm" id="pageChatOauthSaveBtn" type="button">Save Session OAuth</button>' +
              '<button class="btn btn-secondary btn-sm" id="pageChatOauthClearBtn" type="button">Clear</button>' +
              '<button class="btn btn-secondary btn-sm" id="pageChatOauthCancelBtn" type="button">Cancel</button>' +
            '</div>' +
            '<div class="page-chat-oauth-note">Stored only in this browser session on the running server.</div>' +
          '</div>' +
          '<div class="page-chat-messages" id="pageChatMessages"></div>' +
          '<div class="page-chat-proposals" id="pageChatProposals"></div>' +
          '<div class="page-chat-actions">' +
            '<button class="btn btn-secondary btn-sm" id="pageChatApplyAllBtn" type="button" disabled>Apply All</button>' +
            '<button class="btn btn-secondary btn-sm" id="pageChatUndoBtn" type="button" disabled>Undo Last</button>' +
          '</div>' +
          '<div class="page-chat-compose">' +
            '<textarea id="pageChatInput" rows="3" placeholder="Ask Copilot to review or edit this page..."></textarea>' +
            '<button class="btn btn-primary" id="pageChatSendBtn" type="button">Send</button>' +
          '</div>' +
        '</div>' +
      '</aside>';

    dom.shell = document.getElementById('pageChatShell');
    dom.toggleBtn = document.getElementById('pageChatToggleBtn');
    dom.collapseBtn = document.getElementById('pageChatCollapseBtn');
    dom.headerMeta = document.getElementById('pageChatHeaderMeta');
    dom.providerSelect = document.getElementById('pageChatProviderSelect');
    dom.providerStatus = document.getElementById('pageChatProviderStatus');
    dom.keyConfig = document.getElementById('pageChatKeyConfig');
    dom.apiKeyInput = document.getElementById('pageChatApiKeyInput');
    dom.keySaveBtn = document.getElementById('pageChatKeySaveBtn');
    dom.keyClearBtn = document.getElementById('pageChatKeyClearBtn');
    dom.authRow = document.getElementById('pageChatAuthRow');
    dom.oauthConfig = document.getElementById('pageChatOAuthConfig');
    dom.oauthClientId = document.getElementById('pageChatOauthClientId');
    dom.oauthClientSecret = document.getElementById('pageChatOauthClientSecret');
    dom.oauthSaveBtn = document.getElementById('pageChatOauthSaveBtn');
    dom.oauthClearBtn = document.getElementById('pageChatOauthClearBtn');
    dom.oauthCancelBtn = document.getElementById('pageChatOauthCancelBtn');
    dom.messages = document.getElementById('pageChatMessages');
    dom.proposals = document.getElementById('pageChatProposals');
    dom.applyAllBtn = document.getElementById('pageChatApplyAllBtn');
    dom.undoBtn = document.getElementById('pageChatUndoBtn');
    dom.input = document.getElementById('pageChatInput');
    dom.sendBtn = document.getElementById('pageChatSendBtn');
  }

  function targetSummary(target) {
    if (!target || typeof target !== 'object') return 'Unknown target';
    if (target.kind === 'content') return 'Content: ' + target.contentType;
    if (target.kind === 'canon') return 'Canon: ' + target.canonType;
    if (target.kind === 'shot_prompt') {
      return 'Shot Prompt: ' + target.shotId + ' ' + target.variation + ' ' + target.tool;
    }
    return 'Unknown target';
  }

  function renderHeader() {
    if (!dom.headerMeta) return;
    var projectLabel = state.projectId || 'project';
    dom.headerMeta.textContent = state.pageId + ' - ' + projectLabel;
  }

  function setOAuthPanelOpen(open) {
    state.oauthConfigOpen = Boolean(open);
    if (!dom.oauthConfig) return;
    dom.oauthConfig.style.display = state.oauthConfigOpen ? 'block' : 'none';
    if (state.oauthConfigOpen && dom.oauthClientId) {
      dom.oauthClientId.focus();
    }
  }

  function getOAuthConfigText() {
    if (!state.oauthConfig || !state.oauthConfig.configured) return 'OAuth app: missing';
    var source = state.oauthConfig.source || 'session';
    var preview = state.oauthConfig.clientIdPreview ? ' (' + state.oauthConfig.clientIdPreview + ')' : '';
    return 'OAuth app: ' + source + preview;
  }

  async function refreshOAuthConfig() {
    if (!state.service || typeof state.service.getGithubOAuthConfig !== 'function') return;
    var configResult = await state.service.getGithubOAuthConfig();
    if (!configResult.ok) {
      state.oauthConfig = { configured: false, source: 'none', clientIdPreview: '' };
      return;
    }
    state.oauthConfig = configResult.data || { configured: false, source: 'none', clientIdPreview: '' };
  }

  async function refreshAiProvider() {
    if (!state.service || typeof state.service.getAiProviderStatus !== 'function') return;
    var result = await state.service.getAiProviderStatus();
    if (result.ok && result.data) {
      state.aiProvider = {
        activeProvider: result.data.activeProvider || 'github',
        providers: result.data.providers || {}
      };
    }
  }

  function renderProvider() {
    var active = state.aiProvider.activeProvider || 'github';
    if (dom.providerSelect) {
      dom.providerSelect.value = active;
    }

    var info = state.aiProvider.providers[active];
    var statusText = '';
    if (info) {
      var model = info.model || '';
      var configured = info.configured;
      statusText = model + (configured ? '' : ' (no key)');
    }
    if (dom.providerStatus) {
      dom.providerStatus.textContent = statusText;
      dom.providerStatus.classList.toggle('unconfigured', info && !info.configured);
    }

    // Show key input for API-key providers, hide for GitHub
    var showKey = active !== 'github';
    if (dom.keyConfig) {
      dom.keyConfig.style.display = showKey ? 'block' : 'none';
    }
    if (dom.apiKeyInput) {
      var placeholder = active === 'anthropic' ? 'Paste Anthropic API key (sk-ant-...)' : 'Paste OpenAI API key (sk-...)';
      dom.apiKeyInput.placeholder = placeholder;
    }

    // Show GitHub auth row only when GitHub is active
    if (dom.authRow) {
      dom.authRow.style.display = active === 'github' ? '' : 'none';
    }
    if (dom.oauthConfig && active !== 'github') {
      dom.oauthConfig.style.display = 'none';
    }
  }

  async function onProviderChange() {
    var selected = dom.providerSelect ? dom.providerSelect.value : 'github';
    var result = await state.service.setActiveAiProvider(selected);
    if (!result.ok) {
      notify('Provider error', result.error || 'Could not switch provider', 'error', 3200);
      return;
    }
    if (result.data) {
      state.aiProvider = {
        activeProvider: result.data.activeProvider || selected,
        providers: result.data.providers || state.aiProvider.providers
      };
    }
    renderProvider();
    renderAuth();
    notify('Provider switched', 'Now using ' + selected, 'success', 2000);
  }

  async function onKeySave() {
    var active = state.aiProvider.activeProvider || '';
    if (active === 'github') return;
    var key = dom.apiKeyInput ? String(dom.apiKeyInput.value || '').trim() : '';
    if (!key) {
      notify('Key required', 'Paste an API key first.', 'warning', 2500);
      return;
    }
    var result = await state.service.setAiProviderKey(active, key);
    if (!result.ok) {
      notify('Key error', result.error || 'Could not save key', 'error', 3200);
      return;
    }
    if (dom.apiKeyInput) dom.apiKeyInput.value = '';
    if (result.data) {
      state.aiProvider = {
        activeProvider: result.data.activeProvider || active,
        providers: result.data.providers || state.aiProvider.providers
      };
    }
    renderProvider();
    notify('Key saved', active + ' API key saved for this session.', 'success', 2500);
  }

  async function onKeyClear() {
    var active = state.aiProvider.activeProvider || '';
    if (active === 'github') return;
    var result = await state.service.setAiProviderKey(active, '');
    if (!result.ok) {
      notify('Clear error', result.error || 'Could not clear key', 'error', 3200);
      return;
    }
    if (dom.apiKeyInput) dom.apiKeyInput.value = '';
    if (result.data) {
      state.aiProvider = {
        activeProvider: result.data.activeProvider || active,
        providers: result.data.providers || state.aiProvider.providers
      };
    }
    renderProvider();
    notify('Key cleared', active + ' session key removed.', 'info', 2200);
  }

  function renderAuth() {
    if (!dom.authRow) return;
    var oauthText = getOAuthConfigText();

    if (state.auth.connected) {
      var who = state.auth.username ? '@' + state.auth.username : 'connected';
      dom.authRow.innerHTML = '' +
        '<span class="page-chat-auth-pill connected">GitHub ' + escapeHtml(who) + '</span>' +
        '<span class="page-chat-auth-meta">' + escapeHtml(oauthText) + '</span>' +
        '<button class="btn btn-secondary btn-sm" id="pageChatConfigBtn" type="button">OAuth App</button>';
      var configBtnConnected = document.getElementById('pageChatConfigBtn');
      if (configBtnConnected) {
        configBtnConnected.addEventListener('click', function() {
          setOAuthPanelOpen(!state.oauthConfigOpen);
        });
      }
      return;
    }

    dom.authRow.innerHTML = '' +
      '<span class="page-chat-auth-pill disconnected">GitHub disconnected</span>' +
      '<span class="page-chat-auth-meta">' + escapeHtml(oauthText) + '</span>' +
      '<button class="btn btn-secondary btn-sm" id="pageChatConfigBtn" type="button">OAuth App</button>' +
      '<button class="btn btn-secondary btn-sm" id="pageChatConnectBtn" type="button">Connect</button>';

    var configBtn = document.getElementById('pageChatConfigBtn');
    if (configBtn) {
      configBtn.addEventListener('click', function() {
        setOAuthPanelOpen(!state.oauthConfigOpen);
      });
    }

    var connectBtn = document.getElementById('pageChatConnectBtn');
    if (connectBtn) {
      connectBtn.addEventListener('click', function() {
        if (!state.oauthConfig.configured) {
          setOAuthPanelOpen(true);
          notify('OAuth app required', 'Enter GitHub OAuth client ID + secret for this session first.', 'warning', 4000);
          return;
        }
        var returnTo = root.location.pathname + (root.location.search || '');
        root.location.assign('/api/auth/github/start?returnTo=' + encodeURIComponent(returnTo));
      });
    }
  }

  function renderMessages() {
    if (!dom.messages) return;
    var html = '';
    if (!state.messages.length) {
      html = '<div class="page-chat-empty">Chat is ready. Ask for edits or checks.</div>';
    } else {
      html = state.messages.map(function(message) {
        var role = message.role === 'assistant' ? 'assistant' : 'user';
        var text = escapeHtml(message.text || '');
        return '<div class="page-chat-msg ' + role + '"><div class="page-chat-msg-role">' + role + '</div><div class="page-chat-msg-text">' + text + '</div></div>';
      }).join('');
    }
    dom.messages.innerHTML = html;
    dom.messages.scrollTop = dom.messages.scrollHeight;
  }

  function renderProposals() {
    if (!dom.proposals) return;
    if (!state.proposals.length) {
      dom.proposals.innerHTML = '<div class="page-chat-empty">No pending proposals.</div>';
      if (dom.applyAllBtn) dom.applyAllBtn.disabled = true;
      return;
    }

    var html = state.proposals.map(function(proposal) {
      var summary = escapeHtml(proposal.summary || 'Update');
      var target = escapeHtml(targetSummary(proposal.target));
      var reason = proposal.reason ? '<div class="page-chat-proposal-reason">' + escapeHtml(proposal.reason) + '</div>' : '';
      var preview = '<pre class="page-chat-proposal-preview">' + escapeHtml(String(proposal.newContent || '').slice(0, 280)) + '</pre>';
      return '' +
        '<div class="page-chat-proposal" data-proposal-id="' + escapeHtml(proposal.proposalId) + '">' +
          '<div class="page-chat-proposal-head">' +
            '<strong>' + summary + '</strong>' +
            '<button class="btn btn-secondary btn-sm page-chat-apply-one" data-proposal-id="' + escapeHtml(proposal.proposalId) + '" type="button">Apply</button>' +
          '</div>' +
          '<div class="page-chat-proposal-target">' + target + '</div>' +
          reason +
          preview +
        '</div>';
    }).join('');

    dom.proposals.innerHTML = html;
    if (dom.applyAllBtn) dom.applyAllBtn.disabled = false;

    dom.proposals.querySelectorAll('.page-chat-apply-one').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var proposalId = btn.getAttribute('data-proposal-id');
        applyProposals([proposalId]);
      });
    });
  }

  function setCollapsed(collapsed) {
    if (!dom.shell) return;
    dom.shell.classList.toggle('collapsed', Boolean(collapsed));
  }

  function setLoading(loading) {
    state.loading = Boolean(loading);
    if (dom.sendBtn) dom.sendBtn.disabled = state.loading;
    if (dom.input) dom.input.disabled = state.loading;
  }

  function refreshDerivedState(sessionPayload) {
    var session = sessionPayload && sessionPayload.session ? sessionPayload.session : sessionPayload;
    if (!session || typeof session !== 'object') return;
    state.messages = Array.isArray(session.messages) ? session.messages.slice(-60) : [];
    state.proposals = Array.isArray(session.pendingProposals) ? session.pendingProposals : [];
    var applies = Array.isArray(session.applies) ? session.applies : [];
    var lastApply = applies.length ? applies[applies.length - 1] : null;
    state.lastApplyId = lastApply && lastApply.applyId ? lastApply.applyId : state.lastApplyId;
    if (dom.undoBtn) {
      dom.undoBtn.disabled = !state.lastApplyId;
    }
  }

  async function saveOAuthConfig() {
    if (!state.service || typeof state.service.setGithubOAuthConfig !== 'function') return;
    var clientId = dom.oauthClientId ? String(dom.oauthClientId.value || '').trim() : '';
    var clientSecret = dom.oauthClientSecret ? String(dom.oauthClientSecret.value || '').trim() : '';
    if (!clientId || !clientSecret) {
      notify('OAuth app missing', 'Client ID and client secret are required.', 'warning', 3200);
      return;
    }

    var result = await state.service.setGithubOAuthConfig({
      clientId: clientId,
      clientSecret: clientSecret
    });
    if (!result.ok) {
      notify('OAuth save failed', result.error || 'Could not save OAuth config', 'error', 4200);
      return;
    }

    if (dom.oauthClientSecret) dom.oauthClientSecret.value = '';
    state.oauthConfig = result.data || state.oauthConfig;
    setOAuthPanelOpen(false);
    renderAuth();
    notify('OAuth updated', 'Session OAuth app config saved.', 'success', 2200);
  }

  async function clearOAuthConfig() {
    if (!state.service || typeof state.service.setGithubOAuthConfig !== 'function') return;
    var result = await state.service.setGithubOAuthConfig({ clear: true });
    if (!result.ok) {
      notify('OAuth clear failed', result.error || 'Could not clear OAuth config', 'error', 4200);
      return;
    }
    if (dom.oauthClientId) dom.oauthClientId.value = '';
    if (dom.oauthClientSecret) dom.oauthClientSecret.value = '';
    state.oauthConfig = result.data || { configured: false, source: 'none', clientIdPreview: '' };
    setOAuthPanelOpen(false);
    renderAuth();
    notify('OAuth cleared', 'Session OAuth app config removed.', 'info', 2200);
  }

  async function ensureProjectId() {
    var attempts = 0;
    while (attempts < 15) {
      var projectId = '';
      try {
        projectId = String(state.bridge.getProjectId() || '').trim();
      } catch (_) {
        projectId = '';
      }
      if (projectId) {
        return projectId;
      }
      attempts += 1;
      await new Promise(function(resolve) { setTimeout(resolve, 200); });
    }
    return 'default';
  }

  async function bootstrapSession() {
    state.projectId = await ensureProjectId();
    renderHeader();

    var statusResult = await state.service.getStatus({
      projectId: state.projectId,
      pageId: state.pageId
    });

    if (!statusResult.ok) {
      notify('Chat status error', statusResult.error || 'Unable to load status', 'error', 3200);
      return;
    }

    state.auth = statusResult.data.auth || { connected: false, username: '', tokenSource: 'none' };
    await refreshAiProvider();
    renderProvider();
    await refreshOAuthConfig();
    renderAuth();

    var openResult = await state.service.openSession({
      projectId: state.projectId,
      pageId: state.pageId,
      url: root.location.pathname + (root.location.search || '')
    });

    if (!openResult.ok) {
      notify('Chat session error', openResult.error || 'Unable to open chat session', 'error', 3200);
      return;
    }

    state.sessionId = openResult.data.sessionId;
    var sessionResult = await state.service.loadSession({
      projectId: state.projectId,
      sessionId: state.sessionId
    });

    if (sessionResult.ok) {
      refreshDerivedState(sessionResult.data);
      renderMessages();
      renderProposals();
    }
  }

  async function sendMessage() {
    if (state.loading) return;
    var text = dom.input ? String(dom.input.value || '').trim() : '';
    if (!text) return;
    if (!state.sessionId) {
      notify('Chat unavailable', 'Session not ready yet.', 'warning', 2500);
      return;
    }

    state.messages.push({ role: 'user', text: text });
    renderMessages();
    if (dom.input) dom.input.value = '';

    setLoading(true);
    try {
      var liveState = {};
      try {
        liveState = state.bridge.collectLiveState();
      } catch (_) {
        liveState = { pageId: state.pageId };
      }

      var result = await state.service.sendMessage({
        projectId: state.projectId,
        sessionId: state.sessionId,
        message: text,
        pageState: liveState
      });

      if (!result.ok) {
        if (result.code === 'AUTH_REQUIRED') {
          notify('GitHub auth required', 'Connect GitHub to use Copilot suggestions.', 'warning', 3800);
        } else if (result.code === 'PROVIDER_NOT_CONFIGURED') {
          var prov = state.aiProvider.activeProvider || 'AI provider';
          notify('API key needed', prov + ' API key is not configured. Add it above.', 'warning', 4200);
        } else {
          notify('Chat error', result.error || 'Failed to process request', 'error', 3800);
        }
        await bootstrapSession();
        return;
      }

      state.messages.push({ role: 'assistant', text: result.data.assistantMessage || '' });
      state.proposals = Array.isArray(result.data.proposals) ? result.data.proposals : [];
      if (Array.isArray(result.data.warnings) && result.data.warnings.length) {
        notify('Chat warnings', result.data.warnings.join(' | '), 'warning', 4200);
      }
      renderMessages();
      renderProposals();
    } finally {
      setLoading(false);
    }
  }

  async function applyProposals(proposalIds) {
    var ids = Array.isArray(proposalIds) ? proposalIds.filter(Boolean) : [];
    if (!ids.length) return;
    if (!state.sessionId) return;

    var result = await state.service.applyProposals({
      projectId: state.projectId,
      sessionId: state.sessionId,
      proposalIds: ids
    });
    if (!result.ok) {
      notify('Apply failed', result.error || 'Could not apply proposals', 'error', 3800);
      return;
    }

    state.lastApplyId = result.data.applyId || state.lastApplyId;
    if (dom.undoBtn) dom.undoBtn.disabled = !state.lastApplyId;

    var appliedIds = new Set(ids);
    state.proposals = state.proposals.filter(function(proposal) {
      return !appliedIds.has(proposal.proposalId);
    });
    renderProposals();

    try {
      await state.bridge.onAppliedChanges(result.data.applied || []);
    } catch (_) {
      // Keep chat UX responsive even if page refresh hook fails.
    }

    notify('Applied', 'Changes saved to project files.', 'success', 2500);
  }

  async function undoLastApply() {
    if (!state.lastApplyId || !state.sessionId) return;
    var result = await state.service.undoApply({
      projectId: state.projectId,
      sessionId: state.sessionId,
      applyId: state.lastApplyId
    });
    if (!result.ok) {
      notify('Undo failed', result.error || 'Could not undo apply', 'error', 3800);
      return;
    }

    try {
      await state.bridge.onAppliedChanges([{ undo: true, applyId: state.lastApplyId }]);
    } catch (_) {
      // ignore bridge refresh failures
    }

    notify('Undo complete', 'Reverted latest chat apply.', 'success', 2500);
  }

  function bindEvents() {
    if (dom.toggleBtn) {
      dom.toggleBtn.addEventListener('click', function() {
        setCollapsed(false);
      });
    }
    if (dom.collapseBtn) {
      dom.collapseBtn.addEventListener('click', function() {
        setCollapsed(true);
      });
    }
    if (dom.sendBtn) {
      dom.sendBtn.addEventListener('click', sendMessage);
    }
    if (dom.input) {
      dom.input.addEventListener('keydown', function(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          sendMessage();
        }
      });
    }
    if (dom.applyAllBtn) {
      dom.applyAllBtn.addEventListener('click', function() {
        var ids = state.proposals.map(function(proposal) { return proposal.proposalId; });
        applyProposals(ids);
      });
    }
    if (dom.undoBtn) {
      dom.undoBtn.addEventListener('click', undoLastApply);
    }
    if (dom.oauthSaveBtn) {
      dom.oauthSaveBtn.addEventListener('click', saveOAuthConfig);
    }
    if (dom.oauthClearBtn) {
      dom.oauthClearBtn.addEventListener('click', clearOAuthConfig);
    }
    if (dom.oauthCancelBtn) {
      dom.oauthCancelBtn.addEventListener('click', function() {
        setOAuthPanelOpen(false);
      });
    }
    if (dom.providerSelect) {
      dom.providerSelect.addEventListener('change', onProviderChange);
    }
    if (dom.keySaveBtn) {
      dom.keySaveBtn.addEventListener('click', onKeySave);
    }
    if (dom.keyClearBtn) {
      dom.keyClearBtn.addEventListener('click', onKeyClear);
    }
  }

  async function init() {
    if (state.initialized) return;
    if (!root.PageChatService || !root.PageChatService.createPageChatService) return;
    if (!root.PageChatAdapters || !root.PageChatAdapters.getBridge) return;

    state.bridge = root.PageChatAdapters.getBridge();
    state.pageId = String(state.bridge.pageId || root.PageChatAdapters.detectPageId(root.location.pathname) || 'index');
    state.service = root.PageChatService.createPageChatService();

    renderShell();
    bindEvents();
    renderHeader();
    setCollapsed(true);

    state.initialized = true;
    await bootstrapSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      init();
    });
  } else {
    init();
  }

  root.PageChat = {
    init: init,
    applyProposals: applyProposals,
    undoLastApply: undoLastApply
  };
})(typeof window !== 'undefined' ? window : globalThis);
