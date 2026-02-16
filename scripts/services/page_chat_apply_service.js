const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ContentFileService } = require('./content_file_service');

const EDITABLE_BY_PAGE = {
  step1: { content: new Set(['concept', 'inspiration', 'mood', 'genre']), canon: new Set(), shotPrompt: false },
  step2: { content: new Set(['suno-prompt', 'song-info', 'analysis']), canon: new Set(), shotPrompt: false },
  step3: { content: new Set(), canon: new Set(['script', 'youtubeScript', 'transcript', 'assets', 'characters', 'locations', 'style', 'cinematography']), shotPrompt: false },
  index: { content: new Set(), canon: new Set(), shotPrompt: true }
};

function hashContent(content) {
  return `sha256:${crypto.createHash('sha256').update(String(content || ''), 'utf8').digest('hex')}`;
}

function normalizeRelativePath(projectPath, absolutePath) {
  return path.relative(projectPath, absolutePath).replace(/\\/g, '/');
}

function atomicWriteFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = `${filePath}.tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function ensureEditableTargetForPage(pageId, target) {
  const rules = EDITABLE_BY_PAGE[pageId] || null;
  if (!rules) {
    throw new Error(`Page ${pageId} is read-only`);
  }
  if (!target || typeof target !== 'object') {
    throw new Error('Invalid proposal target');
  }

  if (target.kind === 'content') {
    if (!rules.content.has(target.contentType)) {
      throw new Error(`Target not allowed on ${pageId}: content ${target.contentType}`);
    }
    return;
  }

  if (target.kind === 'canon') {
    if (!rules.canon.has(target.canonType)) {
      throw new Error(`Target not allowed on ${pageId}: canon ${target.canonType}`);
    }
    return;
  }

  if (target.kind === 'shot_prompt') {
    if (!rules.shotPrompt) {
      throw new Error(`Target not allowed on ${pageId}: shot prompt edits`);
    }
    return;
  }

  throw new Error(`Unsupported proposal target kind: ${target.kind}`);
}

function createPageChatApplyService({ projectManager, canonFilename, contextService }) {
  if (!projectManager || typeof projectManager.getProjectPath !== 'function') {
    throw new Error('createPageChatApplyService requires projectManager');
  }
  if (typeof canonFilename !== 'function') {
    throw new Error('createPageChatApplyService requires canonFilename');
  }
  if (!contextService || typeof contextService.resolveShotPromptTarget !== 'function') {
    throw new Error('createPageChatApplyService requires contextService');
  }

  function normalizeNewContentForTarget(target, newContentRaw) {
    const newContent = String(newContentRaw || '');
    if (!newContent.trim()) {
      throw new Error('newContent is required');
    }

    if (target.kind === 'content') {
      const config = ContentFileService.CONTENT_TYPES[target.contentType];
      if (!config) {
        throw new Error(`Unsupported content type: ${target.contentType}`);
      }
      if (newContent.length > config.maxSize) {
        throw new Error(`Content too large for ${target.contentType}`);
      }
      if (config.isJson) {
        let parsed;
        try {
          parsed = JSON.parse(newContent);
        } catch (err) {
          throw new Error(`Invalid JSON format: ${err.message}`);
        }
        if (typeof config.validateJson === 'function') {
          config.validateJson(parsed);
        }
        return JSON.stringify(parsed, null, 2);
      }
      return newContent;
    }

    if (target.kind === 'canon') {
      try {
        JSON.parse(newContent);
      } catch (err) {
        throw new Error(`Invalid JSON format: ${err.message}`);
      }
      return newContent;
    }

    if (target.kind === 'shot_prompt') {
      if (newContent.length > 250000) {
        throw new Error('Shot prompt content too large');
      }
      return newContent;
    }

    throw new Error(`Unsupported target kind: ${target.kind}`);
  }

  function resolveTargetWriteInfo(projectId, target) {
    const projectPath = projectManager.getProjectPath(projectId);

    if (target.kind === 'content') {
      const config = ContentFileService.CONTENT_TYPES[target.contentType];
      if (!config) {
        throw new Error(`Unsupported content type: ${target.contentType}`);
      }
      const absolutePath = path.join(projectPath, config.subdir, config.filename);
      return {
        absolutePath,
        relativePath: `${config.subdir}/${config.filename}`
      };
    }

    if (target.kind === 'canon') {
      const absolutePath = path.join(projectPath, 'bible', canonFilename(target.canonType));
      return {
        absolutePath,
        relativePath: `bible/${canonFilename(target.canonType)}`
      };
    }

    if (target.kind === 'shot_prompt') {
      const resolved = contextService.resolveShotPromptTarget(projectId, target);
      return {
        absolutePath: resolved.absolutePath,
        relativePath: resolved.relativePath
      };
    }

    throw new Error(`Unsupported target kind: ${target.kind}`);
  }

  function applyProposals({
    projectId,
    pageId,
    sessionId,
    applyId,
    proposals,
    conflictPolicy = 'chat_wins',
    store
  }) {
    if (!Array.isArray(proposals) || proposals.length === 0) {
      throw new Error('No proposals selected');
    }
    if (!store || typeof store.getApplyManifestPath !== 'function') {
      throw new Error('Store is required for apply operation');
    }

    const projectPath = projectManager.getProjectPath(projectId);
    const createdAt = new Date().toISOString();
    const applyDir = path.dirname(store.getApplyManifestPath(projectId, sessionId, applyId));
    const snapshotDir = path.join(applyDir, `${applyId}_snapshots`);
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const applied = [];
    const manifestWrites = [];

    proposals.forEach((proposal, index) => {
      const proposalId = String(proposal.proposalId || '').trim();
      if (!proposalId) {
        throw new Error('proposalId is required');
      }
      const target = proposal.target && typeof proposal.target === 'object' ? proposal.target : null;
      ensureEditableTargetForPage(pageId, target);

      const writeInfo = resolveTargetWriteInfo(projectId, target);
      const normalizedContent = normalizeNewContentForTarget(target, proposal.newContent);

      const beforeContent = fs.existsSync(writeInfo.absolutePath)
        ? fs.readFileSync(writeInfo.absolutePath, 'utf8')
        : '';
      const beforeHash = hashContent(beforeContent);
      const baseHash = String(proposal.baseHash || '');
      const conflictDetected = Boolean(baseHash && baseHash !== beforeHash);
      if (conflictDetected && conflictPolicy !== 'chat_wins') {
        throw new Error(`Conflict detected for ${proposalId}`);
      }

      const snapshotFilename = `${String(index + 1).padStart(2, '0')}_${proposalId.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
      const snapshotPathAbs = path.join(snapshotDir, snapshotFilename);
      fs.writeFileSync(snapshotPathAbs, beforeContent, 'utf8');

      atomicWriteFile(writeInfo.absolutePath, normalizedContent);
      const afterHash = hashContent(normalizedContent);
      const relativePath = normalizeRelativePath(projectPath, writeInfo.absolutePath);

      const writeRecord = {
        proposalId,
        target,
        path: relativePath,
        beforeHash,
        baseHash,
        newHash: afterHash,
        conflict: {
          detected: conflictDetected,
          policy: conflictPolicy,
          overrode: conflictDetected && conflictPolicy === 'chat_wins'
        },
        beforeSnapshotPath: normalizeRelativePath(projectPath, snapshotPathAbs),
        writtenAt: new Date().toISOString(),
        result: 'written'
      };
      manifestWrites.push(writeRecord);

      applied.push({
        proposalId,
        target,
        path: relativePath,
        conflict: writeRecord.conflict,
        newHash: afterHash
      });
    });

    const manifest = {
      success: true,
      applyId,
      projectId,
      pageId,
      sessionId,
      createdAt,
      status: 'applied',
      revertedAt: null,
      writes: manifestWrites
    };

    store.saveApplyManifest(projectId, sessionId, applyId, manifest);
    store.appendApply(projectId, sessionId, {
      applyId,
      createdAt,
      appliedCount: applied.length,
      revertedCount: 0,
      revertedAt: null
    });

    return {
      applyId,
      applied,
      manifest
    };
  }

  function undoApply({ projectId, sessionId, applyId, store }) {
    if (!store || typeof store.loadApplyManifest !== 'function') {
      throw new Error('Store is required for undo operation');
    }
    const projectPath = projectManager.getProjectPath(projectId);
    const manifest = store.loadApplyManifest(projectId, sessionId, applyId);
    if (!manifest) {
      throw new Error('Apply manifest not found');
    }

    if (manifest.status === 'reverted') {
      return {
        applyId,
        revertedCount: 0,
        alreadyReverted: true
      };
    }

    const writes = Array.isArray(manifest.writes) ? manifest.writes : [];
    let revertedCount = 0;

    writes.forEach((writeRecord) => {
      if (!writeRecord || writeRecord.result === 'reverted') return;
      const snapshotRelPath = String(writeRecord.beforeSnapshotPath || '').replace(/^\/+/, '');
      const snapshotAbs = path.join(projectPath, snapshotRelPath);
      if (!fs.existsSync(snapshotAbs)) {
        return;
      }
      const restoreContent = fs.readFileSync(snapshotAbs, 'utf8');
      const targetAbs = path.join(projectPath, String(writeRecord.path || '').replace(/^\/+/, ''));
      atomicWriteFile(targetAbs, restoreContent);
      writeRecord.result = 'reverted';
      writeRecord.revertedAt = new Date().toISOString();
      revertedCount += 1;
    });

    manifest.status = 'reverted';
    manifest.revertedAt = new Date().toISOString();
    manifest.revertedCount = revertedCount;
    store.saveApplyManifest(projectId, sessionId, applyId, manifest);
    store.markApplyReverted(projectId, sessionId, applyId, revertedCount);

    return {
      applyId,
      revertedCount,
      alreadyReverted: false
    };
  }

  return {
    hashContent,
    applyProposals,
    undoApply,
    ensureEditableTargetForPage,
    resolveTargetWriteInfo,
    normalizeNewContentForTarget
  };
}

module.exports = {
  createPageChatApplyService,
  hashContent
};
