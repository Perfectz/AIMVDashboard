const fs = require('fs');
const path = require('path');
const { ContentFileService } = require('./content_file_service');
const { resolvePromptTargetPath } = require('./agent_prompt_tools');
const { safeResolve, sanitizePathSegment } = require('../shared');

const SHOT_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const VARIATION_REGEX = /^[A-D]$/;
const TOOL_REGEX = /^(seedream|kling|nanobanana|suno)$/;

const STEP1_CONTENT_TYPES = ['concept', 'inspiration', 'mood', 'genre'];
const STEP2_CONTENT_TYPES = ['suno-prompt', 'song-info', 'analysis'];
const STEP3_CANON_TYPES = ['script', 'youtubeScript', 'transcript', 'assets', 'characters', 'locations', 'style', 'cinematography'];
const READ_ONLY_PAGES = new Set(['home', 'step4', 'storyboard', 'guide']);
const PAGE_IDS = new Set(['home', 'step1', 'step2', 'step3', 'step4', 'index', 'storyboard', 'guide']);
const MAX_DOC_CHARS = 12000;
const MAX_BG_DOC_CHARS = 3000;

function truncate(value, maxChars = MAX_DOC_CHARS) {
  const text = String(value || '');
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, Math.max(0, maxChars - 4))}\n...`,
    truncated: true
  };
}

function normalizePageState(input) {
  if (!input || typeof input !== 'object') {
    return {};
  }
  try {
    const raw = JSON.stringify(input);
    if (raw.length > 120000) {
      return { pageId: input.pageId, warning: 'pageState payload too large, truncated at source' };
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function targetToKey(target) {
  if (!target || typeof target !== 'object') return '';
  if (target.kind === 'content') {
    return `content:${target.contentType}`;
  }
  if (target.kind === 'canon') {
    return `canon:${target.canonType}`;
  }
  if (target.kind === 'shot_prompt') {
    return `shot_prompt:${target.shotId}:${target.variation}:${target.tool}`;
  }
  return '';
}

function createPageChatContextService({ projectManager, canonFilename }) {
  if (!projectManager || typeof projectManager.getProjectPath !== 'function') {
    throw new Error('createPageChatContextService requires projectManager');
  }
  if (typeof canonFilename !== 'function') {
    throw new Error('createPageChatContextService requires canonFilename');
  }

  const contentService = new ContentFileService(projectManager);

  function validatePageId(pageId) {
    const normalized = String(pageId || '').trim().toLowerCase();
    if (!PAGE_IDS.has(normalized)) {
      const err = new Error(`Unsupported pageId: ${pageId}`);
      err.statusCode = 400;
      throw err;
    }
    return normalized;
  }

  function readCanonContent(projectId, canonType) {
    const fileName = canonFilename(canonType);
    const bibleDir = projectManager.getProjectPath(projectId, 'bible');
    const filePath = path.join(bibleDir, fileName);
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8');
  }

  function resolveShotPromptTarget(projectId, rawTarget) {
    const target = rawTarget && typeof rawTarget === 'object' ? rawTarget : {};
    const shotId = sanitizePathSegment(String(target.shotId || ''), SHOT_ID_REGEX, 'shotId');
    const variation = sanitizePathSegment(String(target.variation || 'A').toUpperCase(), VARIATION_REGEX, 'variation');
    const tool = sanitizePathSegment(String(target.tool || 'seedream').toLowerCase(), TOOL_REGEX, 'tool');

    const projectPath = projectManager.getProjectPath(projectId);
    const relativePath = String(resolvePromptTargetPath(projectPath, shotId, variation, tool) || '').replace(/\\/g, '/');
    const absolutePath = safeResolve(projectPath, relativePath);
    const exists = fs.existsSync(absolutePath);
    const content = exists ? fs.readFileSync(absolutePath, 'utf8') : '';

    return {
      kind: 'shot_prompt',
      shotId,
      variation,
      tool,
      targetKey: `shot_prompt:${shotId}:${variation}:${tool}`,
      relativePath,
      absolutePath,
      currentContent: content,
      exists
    };
  }

  function resolveContentTarget(projectId, contentType) {
    const currentContent = contentService.load(projectId, contentType);
    const config = ContentFileService.CONTENT_TYPES[contentType];
    return {
      kind: 'content',
      contentType,
      targetKey: `content:${contentType}`,
      relativePath: `${config.subdir}/${config.filename}`,
      currentContent,
      exists: Boolean(currentContent)
    };
  }

  function resolveCanonTarget(projectId, canonType) {
    const filename = canonFilename(canonType);
    const currentContent = readCanonContent(projectId, canonType);
    return {
      kind: 'canon',
      canonType,
      targetKey: `canon:${canonType}`,
      relativePath: `bible/${filename}`,
      currentContent,
      exists: Boolean(currentContent)
    };
  }

  function buildStepTargets(projectId, contentTypes, kind) {
    if (kind === 'content') {
      return contentTypes.map((contentType) => resolveContentTarget(projectId, contentType));
    }
    return contentTypes.map((canonType) => resolveCanonTarget(projectId, canonType));
  }

  function loadBackgroundDocs(projectId, pageId, activeCanonTab) {
    const docs = [];
    const focusKeys = new Set();

    // Determine which keys are already the primary focus (skip those)
    if (pageId === 'step1') {
      STEP1_CONTENT_TYPES.forEach((t) => focusKeys.add(`content:${t}`));
    } else if (pageId === 'step2') {
      STEP2_CONTENT_TYPES.forEach((t) => focusKeys.add(`content:${t}`));
    } else if (pageId === 'step3' && activeCanonTab) {
      focusKeys.add(`canon:${activeCanonTab}`);
    }

    // Step 1 content as background
    STEP1_CONTENT_TYPES.forEach((contentType) => {
      const key = `content:${contentType}`;
      if (focusKeys.has(key)) return;
      try {
        const raw = contentService.load(projectId, contentType);
        if (!raw) return;
        const clipped = truncate(raw, MAX_BG_DOC_CHARS);
        docs.push({
          id: `bg:${key}`,
          label: `Step 1 — ${contentType}`,
          kind: 'background',
          content: clipped.text,
          truncated: clipped.truncated,
          exists: true
        });
      } catch (_) { /* skip missing */ }
    });

    // Step 2 content as background
    STEP2_CONTENT_TYPES.forEach((contentType) => {
      const key = `content:${contentType}`;
      if (focusKeys.has(key)) return;
      try {
        const raw = contentService.load(projectId, contentType);
        if (!raw) return;
        const clipped = truncate(raw, MAX_BG_DOC_CHARS);
        docs.push({
          id: `bg:${key}`,
          label: `Step 2 — ${contentType}`,
          kind: 'background',
          content: clipped.text,
          truncated: clipped.truncated,
          exists: true
        });
      } catch (_) { /* skip missing */ }
    });

    // Step 3 canon as background (all tabs except current focus)
    STEP3_CANON_TYPES.forEach((canonType) => {
      const key = `canon:${canonType}`;
      if (focusKeys.has(key)) return;
      try {
        const raw = readCanonContent(projectId, canonType);
        if (!raw) return;
        const clipped = truncate(raw, MAX_BG_DOC_CHARS);
        docs.push({
          id: `bg:${key}`,
          label: `Canon — ${canonType}`,
          kind: 'background',
          content: clipped.text,
          truncated: clipped.truncated,
          exists: true
        });
      } catch (_) { /* skip missing */ }
    });

    return docs;
  }

  function buildContext(params = {}) {
    const projectId = String(params.projectId || '').trim();
    const pageId = validatePageId(params.pageId);
    const pageState = normalizePageState(params.pageState);
    const warnings = [];
    const contextDocs = [];
    let allowedTargets = [];
    let activeCanonTab = '';

    if (pageId === 'step1') {
      allowedTargets = buildStepTargets(projectId, STEP1_CONTENT_TYPES, 'content');
    } else if (pageId === 'step2') {
      allowedTargets = buildStepTargets(projectId, STEP2_CONTENT_TYPES, 'content');
    } else if (pageId === 'step3') {
      activeCanonTab = pageState.activeCanonTab ? String(pageState.activeCanonTab).trim() : '';
      var step3Types = activeCanonTab && STEP3_CANON_TYPES.includes(activeCanonTab)
        ? [activeCanonTab]
        : STEP3_CANON_TYPES;
      allowedTargets = buildStepTargets(projectId, step3Types, 'canon');
    } else if (pageId === 'index') {
      const selection = pageState.selection && typeof pageState.selection === 'object'
        ? pageState.selection
        : {};
      if (!selection.shotId) {
        warnings.push('Select a shot before requesting prompt edits.');
      } else {
        try {
          const target = resolveShotPromptTarget(projectId, selection);
          allowedTargets = [target];
        } catch (err) {
          warnings.push(`Unable to resolve selected shot prompt: ${err.message}`);
        }
      }
    } else if (READ_ONLY_PAGES.has(pageId)) {
      allowedTargets = [];
    }

    // Primary focus docs (editable)
    allowedTargets.forEach((target) => {
      const clipped = truncate(target.currentContent || '');
      contextDocs.push({
        id: target.targetKey,
        label: target.relativePath || target.targetKey,
        kind: target.kind,
        content: clipped.text,
        truncated: clipped.truncated,
        exists: Boolean(target.exists)
      });
      if (!target.exists) {
        warnings.push(`No existing content found for ${target.targetKey}; proposal may create first version.`);
      }
    });

    // Background context from other steps (read-only)
    const bgDocs = loadBackgroundDocs(projectId, pageId, activeCanonTab);
    bgDocs.forEach((doc) => contextDocs.push(doc));

    const liveStateText = truncate(JSON.stringify(pageState, null, 2), 10000);
    contextDocs.push({
      id: 'page_state',
      label: 'Live page state',
      kind: 'page_state',
      content: liveStateText.text,
      truncated: liveStateText.truncated,
      exists: true
    });

    const editable = allowedTargets.length > 0;

    return {
      projectId,
      pageId,
      editable,
      allowedTargets,
      contextDocs,
      pageState,
      warnings
    };
  }

  function findAllowedTarget(context, rawTarget) {
    const key = targetToKey(rawTarget);
    if (!key) return null;
    const allowedTargets = Array.isArray(context && context.allowedTargets)
      ? context.allowedTargets
      : [];
    return allowedTargets.find((target) => target.targetKey === key) || null;
  }

  return {
    validatePageId,
    targetToKey,
    buildContext,
    findAllowedTarget,
    resolveShotPromptTarget,
    resolveContentTarget,
    resolveCanonTarget
  };
}

module.exports = {
  createPageChatContextService,
  targetToKey
};
