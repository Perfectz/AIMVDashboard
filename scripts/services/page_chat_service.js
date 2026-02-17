const { MAX_CHAT_MESSAGE_CHARS, MAX_CHAT_MODEL_HISTORY } = require('../config');
const MAX_MESSAGE_CHARS = MAX_CHAT_MESSAGE_CHARS;
const MAX_MODEL_HISTORY = MAX_CHAT_MODEL_HISTORY;
const MAX_PROPOSAL_CONTENT = 250000;

function clip(value, maxChars) {
  const text = String(value || '');
  if (!Number.isFinite(maxChars) || maxChars <= 0) return text;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function coerceConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.6;
  return Math.max(0, Math.min(1, num));
}

function normalizeProposalTarget(rawTarget) {
  const target = rawTarget && typeof rawTarget === 'object' ? rawTarget : {};
  const kind = String(target.kind || '').trim();
  if (kind === 'content') {
    return {
      kind,
      contentType: String(target.contentType || '').trim()
    };
  }
  if (kind === 'canon') {
    return {
      kind,
      canonType: String(target.canonType || '').trim()
    };
  }
  if (kind === 'shot_prompt') {
    return {
      kind,
      shotId: String(target.shotId || '').trim(),
      variation: String(target.variation || '').trim().toUpperCase(),
      tool: String(target.tool || '').trim().toLowerCase()
    };
  }
  return null;
}

function extractFirstJsonObject(text) {
  const input = String(text || '');
  const start = input.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let idx = start; idx < input.length; idx += 1) {
    const ch = input[idx];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, idx + 1);
      }
    }
  }

  return null;
}

function parseModelJsonResponse(rawContent) {
  const text = String(rawContent || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const candidate = extractFirstJsonObject(text);
    if (!candidate) return null;
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

const PROPOSAL_PAGES = new Set(['index', 'step1', 'step2', 'step3']);

function buildSystemPrompt(pageId) {
  const base = 'You are Page Chat Copilot — an AI agent for an AI music video editor.';
  const awareness = [
    'You have full awareness of the project across all workflow steps.',
    'Context documents include the current focus document plus background data from other steps (concept, song info, canon docs, etc.).',
    'Background docs (labeled "Step 1 —", "Step 2 —", "Canon —") give you project-wide knowledge.',
    'Cross-reference other steps when relevant (e.g., suggest characters that match the concept, or cinematography that fits the song mood).'
  ].join(' ');

  const proposalRules = [
    'When you have concrete content to add or edit, include it as proposals using the allowedTargets list.',
    'Only propose edits to targets in the allowedTargets list. Never propose file paths or unsupported targets.',
    'If a document is empty, propose starter content based on what you know from the project.'
  ].join(' ');

  const format = [
    'Return strict JSON only using this schema:',
    '{"assistantMessage":string,"proposals":[{"summary":string,"target":object,"newContent":string,"reason":string,"confidence":number}]}',
    'The assistantMessage MUST be a thorough, detailed explanation — write as much as needed.',
    'Use markdown formatting in assistantMessage for readability (headers, bullet points, bold, etc.).',
    'Always provide a helpful assistantMessage even if you have no proposals.'
  ].join(' ');

  return [base, awareness, proposalRules, format].join(' ');
}

function buildModelMessages(session, context, userMessage) {
  const history = Array.isArray(session.messages) ? session.messages.slice(-MAX_MODEL_HISTORY) : [];
  const modelHistory = history
    .filter((entry) => entry && typeof entry.text === 'string' && entry.text.trim())
    .map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: clip(entry.text, 2000)
    }));

  const allowedTargets = (context.allowedTargets || []).map((target) => {
    if (target.kind === 'content') {
      return { kind: 'content', contentType: target.contentType };
    }
    if (target.kind === 'canon') {
      return { kind: 'canon', canonType: target.canonType };
    }
    return {
      kind: 'shot_prompt',
      shotId: target.shotId,
      variation: target.variation,
      tool: target.tool
    };
  });

  const payload = {
    mode: context.editable ? 'editable' : 'read_only',
    pageId: context.pageId,
    userMessage: clip(userMessage, MAX_MESSAGE_CHARS),
    warnings: context.warnings || [],
    allowedTargets,
    contextDocs: (context.contextDocs || []).map((doc) => ({
      id: doc.id,
      label: doc.label,
      kind: doc.kind,
      exists: Boolean(doc.exists),
      truncated: Boolean(doc.truncated),
      content: doc.content
    })),
    pageState: context.pageState || {}
  };

  return [
    { role: 'system', content: buildSystemPrompt(context.pageId) },
    ...modelHistory,
    { role: 'user', content: JSON.stringify(payload) }
  ];
}

function createPageChatService({ store, contextService, applyService, aiProvider }) {
  if (!store || typeof store.loadSession !== 'function') {
    throw new Error('createPageChatService requires store');
  }
  if (!contextService || typeof contextService.buildContext !== 'function') {
    throw new Error('createPageChatService requires contextService');
  }
  if (!applyService || typeof applyService.applyProposals !== 'function') {
    throw new Error('createPageChatService requires applyService');
  }

  function getStatus(projectId, pageId) {
    return store.getStatus(projectId, pageId);
  }

  function openOrCreateSession({ projectId, pageId, url }) {
    return store.openOrCreateSession({ projectId, pageId, url });
  }

  function loadSession(projectId, sessionId) {
    return store.loadSession(projectId, sessionId);
  }

  async function generateProposals({ projectId, sessionId, message, pageState, accessToken }) {
    const session = store.loadSession(projectId, sessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }

    const trimmedMessage = String(message || '').trim();
    if (!trimmedMessage) {
      throw new Error('message is required');
    }
    const clippedMessage = clip(trimmedMessage, MAX_MESSAGE_CHARS);

    store.addMessage(projectId, sessionId, {
      id: store.createMessageId(),
      role: 'user',
      text: clippedMessage,
      createdAt: new Date().toISOString()
    });

    const refreshedSession = store.loadSession(projectId, sessionId);
    const context = contextService.buildContext({
      projectId,
      pageId: refreshedSession.pageId,
      pageState
    });

    const warnings = [];
    const provider = aiProvider ? aiProvider.getActiveProvider() : 'github';
    const providerConfig = {};
    if (provider === 'github') {
      if (!accessToken) {
        const authErr = new Error('GitHub OAuth session required');
        authErr.code = 'AUTH_REQUIRED';
        throw authErr;
      }
      providerConfig.token = accessToken;
    }

    const messages = buildModelMessages(refreshedSession, context, clippedMessage);
    const generateFn = aiProvider ? aiProvider.generate : null;
    if (!generateFn) {
      const err = new Error('AI provider service not configured');
      err.code = 'PROVIDER_NOT_CONFIGURED';
      throw err;
    }
    const modelResult = await generateFn(providerConfig, {
      messages,
      temperature: 0.2,
      maxTokens: 16384
    });

    const rawContent = String(modelResult.content || '');
    const expectsJson = PROPOSAL_PAGES.has(context.pageId);

    let assistantMessageRaw = '';
    let rawProposals = [];

    if (expectsJson) {
      const parsed = parseModelJsonResponse(rawContent);
      if (!parsed || typeof parsed !== 'object') {
        warnings.push('Model output was not valid JSON; no proposals generated.');
        assistantMessageRaw = rawContent || 'I reviewed the context but could not produce a structured proposal this time.';
      } else {
        assistantMessageRaw = typeof parsed.assistantMessage === 'string' ? parsed.assistantMessage : '';
        rawProposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];
      }
    } else {
      // Plain text pages (step1, step2, step3, etc.) — use raw content directly
      assistantMessageRaw = rawContent || 'No recommendations available for this context.';
    }
    const proposals = [];

    rawProposals.forEach((rawProposal) => {
      if (!rawProposal || typeof rawProposal !== 'object') return;
      const target = normalizeProposalTarget(rawProposal.target);
      if (!target) {
        warnings.push('Skipped proposal with invalid target shape.');
        return;
      }
      const allowed = contextService.findAllowedTarget(context, target);
      if (!allowed) {
        warnings.push(`Skipped disallowed target proposal: ${JSON.stringify(target)}`);
        return;
      }

      const newContent = String(rawProposal.newContent || '');
      if (!newContent.trim()) {
        warnings.push(`Skipped proposal with empty newContent for ${allowed.targetKey}`);
        return;
      }
      if (newContent.length > MAX_PROPOSAL_CONTENT) {
        warnings.push(`Skipped proposal exceeding max size for ${allowed.targetKey}`);
        return;
      }

      proposals.push({
        proposalId: store.createProposalId(),
        summary: clip(String(rawProposal.summary || `Update ${allowed.targetKey}`), 240),
        target,
        targetKey: allowed.targetKey,
        newContent,
        reason: clip(String(rawProposal.reason || ''), 500),
        confidence: coerceConfidence(rawProposal.confidence),
        baseHash: applyService.hashContent(allowed.currentContent || ''),
        warnings: []
      });
    });

    const assistantMessage = clip(assistantMessageRaw, 12000);
    store.addMessage(projectId, sessionId, {
      id: store.createMessageId(),
      role: 'assistant',
      text: assistantMessage,
      createdAt: new Date().toISOString(),
      meta: {
        proposalCount: proposals.length,
        warningCount: warnings.length
      }
    });

    store.setPendingProposals(projectId, sessionId, proposals);

    return {
      assistantMessage,
      proposals,
      warnings
    };
  }

  function applySelectedProposals({ projectId, sessionId, proposalIds }) {
    const session = store.loadSession(projectId, sessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }

    const ids = Array.isArray(proposalIds)
      ? proposalIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    if (ids.length === 0) {
      throw new Error('proposalIds is required');
    }

    const pending = Array.isArray(session.pendingProposals) ? session.pendingProposals : [];
    const selected = pending.filter((proposal) => ids.includes(proposal.proposalId));
    if (selected.length === 0) {
      throw new Error('No matching pending proposals found');
    }

    const applyId = store.createApplyId();
    const result = applyService.applyProposals({
      projectId,
      pageId: session.pageId,
      sessionId,
      applyId,
      proposals: selected,
      store
    });

    const remaining = pending.filter((proposal) => !ids.includes(proposal.proposalId));
    store.setPendingProposals(projectId, sessionId, remaining);
    store.addMessage(projectId, sessionId, {
      id: store.createMessageId(),
      role: 'assistant',
      text: `Applied ${selected.length} proposal${selected.length === 1 ? '' : 's'} successfully.`,
      createdAt: new Date().toISOString(),
      meta: { applyId }
    });

    return {
      applyId: result.applyId,
      applied: result.applied
    };
  }

  function undoApply({ projectId, sessionId, applyId }) {
    const session = store.loadSession(projectId, sessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }

    const result = applyService.undoApply({
      projectId,
      sessionId,
      applyId,
      store
    });

    store.addMessage(projectId, sessionId, {
      id: store.createMessageId(),
      role: 'assistant',
      text: result.alreadyReverted
        ? `Apply ${applyId} was already reverted.`
        : `Undo complete for ${applyId}. Restored ${result.revertedCount} change${result.revertedCount === 1 ? '' : 's'}.`,
      createdAt: new Date().toISOString(),
      meta: { applyId, revertedCount: result.revertedCount }
    });

    return {
      applyId: result.applyId,
      revertedCount: result.revertedCount,
      alreadyReverted: result.alreadyReverted
    };
  }

  return {
    getStatus,
    openOrCreateSession,
    loadSession,
    generateProposals,
    applySelectedProposals,
    undoApply,
    parseModelJsonResponse,
    normalizeProposalTarget,
    buildModelMessages
  };
}

module.exports = {
  createPageChatService,
  parseModelJsonResponse,
  normalizeProposalTarget
};
