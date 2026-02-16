/**
 * Pipeline status tracking service.
 * Extracted from serve_ui.js — Phase 4 architecture optimization.
 */

const path = require('path');
const { safeReadJson } = require('../shared');

function createPipelineStatusService({ projectManager }) {
  const pipelineStatusStore = new Map();

  function readPromptsIndexSummary(projectId) {
    const projectPath = projectManager.getProjectPath(projectId);
    const indexPath = path.join(projectPath, 'prompts_index.json');
    const fallback = {
      promptCount: 0,
      shotCount: 0,
      tools: {}
    };

    const parsed = safeReadJson(indexPath, null);
    if (!parsed || typeof parsed !== 'object') return fallback;

    return {
      promptCount: Number(parsed.totalPrompts) || 0,
      shotCount: Number(parsed.totalShots) || 0,
      tools: parsed.tools && typeof parsed.tools === 'object' ? parsed.tools : {}
    };
  }

  function getPipelineStatus(projectId) {
    const existing = pipelineStatusStore.get(projectId);
    const summary = readPromptsIndexSummary(projectId);
    const base = existing || {
      projectId,
      lastCompileAt: null,
      lastLintAt: null,
      lastReindexAt: null,
      lastRunAllAt: null,
      lastRun: null,
      lintSummary: null
    };

    return {
      ...base,
      promptCount: summary.promptCount,
      shotCount: summary.shotCount,
      tools: summary.tools
    };
  }

  function updatePipelineStatus(projectId, patch = {}) {
    const current = getPipelineStatus(projectId);
    const next = {
      ...current,
      ...patch,
      projectId
    };
    pipelineStatusStore.set(projectId, next);
    return next;
  }

  return {
    readPromptsIndexSummary,
    getPipelineStatus,
    updatePipelineStatus
  };
}

module.exports = { createPipelineStatusService };
