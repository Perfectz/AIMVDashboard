const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PAGE_ID_REGEX = /^(home|step1|step2|step3|step4|index|storyboard|guide)$/;
const MAX_SESSION_MESSAGES = 400;
const MAX_PENDING_PROPOSALS = 40;

function createId(prefix) {
  if (crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function clampArray(list, maxLength) {
  const arr = Array.isArray(list) ? list : [];
  if (arr.length <= maxLength) return arr;
  return arr.slice(arr.length - maxLength);
}

function createPageChatStoreService({ projectManager }) {
  if (!projectManager || typeof projectManager.getProjectPath !== 'function') {
    throw new Error('createPageChatStoreService requires projectManager');
  }

  function validatePageId(pageId) {
    const normalized = String(pageId || '').trim().toLowerCase();
    if (!PAGE_ID_REGEX.test(normalized)) {
      const err = new Error(`Unsupported pageId: ${pageId}`);
      err.statusCode = 400;
      throw err;
    }
    return normalized;
  }

  function getBaseDir(projectId) {
    return projectManager.getProjectPath(projectId, path.join('rendered', 'storyboard', 'page_chat'));
  }

  function getSessionsDir(projectId) {
    return path.join(getBaseDir(projectId), 'sessions');
  }

  function getAppliesDir(projectId, sessionId = '') {
    const base = path.join(getBaseDir(projectId), 'applies');
    return sessionId ? path.join(base, sessionId) : base;
  }

  function getSummariesDir(projectId) {
    return path.join(getBaseDir(projectId), 'summaries');
  }

  function getSessionPath(projectId, sessionId) {
    return path.join(getSessionsDir(projectId), `${sessionId}.json`);
  }

  function getSummaryPath(projectId, pageId) {
    return path.join(getSummariesDir(projectId), `${validatePageId(pageId)}.json`);
  }

  function getApplyManifestPath(projectId, sessionId, applyId) {
    return path.join(getAppliesDir(projectId, sessionId), `${applyId}.json`);
  }

  function ensureDirectories(projectId, sessionId = '') {
    const dirs = [
      getSessionsDir(projectId),
      getSummariesDir(projectId),
      getAppliesDir(projectId)
    ];
    if (sessionId) {
      dirs.push(getAppliesDir(projectId, sessionId));
    }
    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  function normalizeSession(session) {
    if (!session || typeof session !== 'object') {
      throw new Error('Invalid chat session payload');
    }
    const normalized = {
      sessionId: String(session.sessionId || '').trim(),
      projectId: String(session.projectId || '').trim(),
      pageId: validatePageId(session.pageId),
      url: String(session.url || '').trim(),
      createdAt: String(session.createdAt || new Date().toISOString()),
      updatedAt: String(session.updatedAt || new Date().toISOString()),
      messages: clampArray(session.messages, MAX_SESSION_MESSAGES),
      pendingProposals: clampArray(session.pendingProposals, MAX_PENDING_PROPOSALS),
      applies: Array.isArray(session.applies) ? session.applies.slice(-100) : []
    };
    if (!normalized.sessionId) {
      throw new Error('sessionId is required');
    }
    if (!normalized.projectId) {
      throw new Error('projectId is required');
    }
    return normalized;
  }

  function updateSummary(projectId, pageId, session) {
    const summaryPath = getSummaryPath(projectId, pageId);
    writeJson(summaryPath, {
      pageId: validatePageId(pageId),
      projectId,
      lastSessionId: session.sessionId,
      messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
      updatedAt: session.updatedAt || new Date().toISOString()
    });
  }

  function getStatus(projectId, pageId) {
    const summaryPath = getSummaryPath(projectId, pageId);
    const summary = readJson(summaryPath, null);
    if (!summary) {
      return {
        lastSessionId: null,
        messageCount: 0,
        updatedAt: null
      };
    }
    return {
      lastSessionId: summary.lastSessionId || null,
      messageCount: Number(summary.messageCount) || 0,
      updatedAt: summary.updatedAt || null
    };
  }

  function loadSession(projectId, sessionId) {
    if (!sessionId) return null;
    const sessionPath = getSessionPath(projectId, sessionId);
    const loaded = readJson(sessionPath, null);
    if (!loaded) return null;
    try {
      return normalizeSession(loaded);
    } catch {
      return null;
    }
  }

  function saveSession(sessionInput) {
    const session = normalizeSession(sessionInput);
    ensureDirectories(session.projectId, session.sessionId);
    const sessionPath = getSessionPath(session.projectId, session.sessionId);
    writeJson(sessionPath, session);
    updateSummary(session.projectId, session.pageId, session);
    return session;
  }

  function openOrCreateSession({ projectId, pageId, url }) {
    const normalizedPageId = validatePageId(pageId);
    ensureDirectories(projectId);

    const status = getStatus(projectId, normalizedPageId);
    if (status.lastSessionId) {
      const existing = loadSession(projectId, status.lastSessionId);
      if (existing) {
        return { session: existing, created: false };
      }
    }

    const now = new Date().toISOString();
    const session = {
      sessionId: createId('chat'),
      projectId,
      pageId: normalizedPageId,
      url: String(url || '').trim(),
      createdAt: now,
      updatedAt: now,
      messages: [],
      pendingProposals: [],
      applies: []
    };
    saveSession(session);
    return { session, created: true };
  }

  function addMessage(projectId, sessionId, message) {
    const session = loadSession(projectId, sessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }
    const entry = message && typeof message === 'object'
      ? {
          id: String(message.id || createId('msg')),
          role: String(message.role || 'assistant'),
          text: String(message.text || ''),
          createdAt: String(message.createdAt || new Date().toISOString()),
          meta: message.meta && typeof message.meta === 'object' ? message.meta : {}
        }
      : null;
    if (!entry || !entry.text.trim()) {
      throw new Error('Message text is required');
    }
    session.messages.push(entry);
    session.messages = clampArray(session.messages, MAX_SESSION_MESSAGES);
    session.updatedAt = new Date().toISOString();
    saveSession(session);
    return { session, entry };
  }

  function setPendingProposals(projectId, sessionId, proposals) {
    const session = loadSession(projectId, sessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }
    session.pendingProposals = clampArray(Array.isArray(proposals) ? proposals : [], MAX_PENDING_PROPOSALS);
    session.updatedAt = new Date().toISOString();
    saveSession(session);
    return session;
  }

  function appendApply(projectId, sessionId, applySummary) {
    const session = loadSession(projectId, sessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }
    const summary = {
      applyId: String(applySummary.applyId || ''),
      createdAt: String(applySummary.createdAt || new Date().toISOString()),
      revertedAt: applySummary.revertedAt || null,
      revertedCount: Number(applySummary.revertedCount || 0),
      appliedCount: Number(applySummary.appliedCount || 0)
    };
    if (!summary.applyId) {
      throw new Error('applyId is required');
    }
    session.applies.push(summary);
    session.applies = session.applies.slice(-100);
    session.updatedAt = new Date().toISOString();
    saveSession(session);
    return session;
  }

  function markApplyReverted(projectId, sessionId, applyId, revertedCount) {
    const session = loadSession(projectId, sessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }
    const apply = (session.applies || []).find((item) => item && item.applyId === applyId);
    if (apply) {
      apply.revertedAt = new Date().toISOString();
      apply.revertedCount = Number(revertedCount || 0);
    }
    session.updatedAt = new Date().toISOString();
    saveSession(session);
    return session;
  }

  function saveApplyManifest(projectId, sessionId, applyId, manifest) {
    ensureDirectories(projectId, sessionId);
    const manifestPath = getApplyManifestPath(projectId, sessionId, applyId);
    writeJson(manifestPath, manifest);
    return manifestPath;
  }

  function loadApplyManifest(projectId, sessionId, applyId) {
    const manifestPath = getApplyManifestPath(projectId, sessionId, applyId);
    return readJson(manifestPath, null);
  }

  return {
    validatePageId,
    createSessionId: () => createId('chat'),
    createMessageId: () => createId('msg'),
    createProposalId: () => createId('prop'),
    createApplyId: () => createId('apply'),
    getBaseDir,
    getSessionsDir,
    getSummariesDir,
    getAppliesDir,
    getSessionPath,
    getSummaryPath,
    getApplyManifestPath,
    getStatus,
    loadSession,
    saveSession,
    openOrCreateSession,
    addMessage,
    setPendingProposals,
    appendApply,
    markApplyReverted,
    saveApplyManifest,
    loadApplyManifest
  };
}

module.exports = {
  createPageChatStoreService
};
