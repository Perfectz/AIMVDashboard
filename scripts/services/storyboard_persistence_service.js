/**
 * Storyboard persistence service (sequence.json + previs_map.json).
 * Extracted from serve_ui.js — Phase 4 architecture optimization.
 */

const fs = require('fs');
const path = require('path');
const { writeJsonPreserveEol } = require('../shared');
const { sanitizeReviewMetadata } = require('./review_metadata_service');

const MAX_ASSIGNEE_LENGTH = 80;
const PREVIS_SOURCE_TYPES = new Set([
  'character_ref',
  'location_ref',
  'rendered_thumbnail',
  'rendered_video',
  'rendered_first_frame',
  'rendered_last_frame',
  'manual'
]);

function createStoryboardPersistenceService({ projectManager }) {

  function getStoryboardPersistencePath(projectId = 'default') {
    const base = path.join(projectManager.getProjectPath(projectId, 'rendered'), 'storyboard');
    const sequencePath = path.join(base, 'sequence.json');
    const previsPath = path.join(base, 'previs_map.json');

    if (fs.existsSync(sequencePath) || !fs.existsSync(previsPath)) {
      return sequencePath;
    }
    return previsPath;
  }

  function normalizeAssignee(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return trimmed.length > MAX_ASSIGNEE_LENGTH ? trimmed.slice(0, MAX_ASSIGNEE_LENGTH) : trimmed;
  }

  function normalizeShotReviewFields(shot) {
    if (!shot || typeof shot !== 'object') return false;
    let changed = false;

    const normalized = sanitizeReviewMetadata(shot);
    if (shot.reviewStatus !== normalized.reviewStatus) {
      shot.reviewStatus = normalized.reviewStatus;
      changed = true;
    }

    if (!Array.isArray(shot.comments) || JSON.stringify(shot.comments) !== JSON.stringify(normalized.comments)) {
      shot.comments = normalized.comments;
      changed = true;
    }

    const assignee = normalizeAssignee(shot.assignee);
    if (shot.assignee !== assignee) {
      shot.assignee = assignee;
      changed = true;
    }

    return changed;
  }

  function normalizeSequenceReviewFields(sequence) {
    if (!sequence || typeof sequence !== 'object') return false;
    if (!Array.isArray(sequence.selections)) {
      sequence.selections = [];
      return true;
    }

    let changed = false;
    sequence.selections.forEach((shot) => {
      if (normalizeShotReviewFields(shot)) changed = true;
    });

    return changed;
  }

  function readSequenceFile(projectId = 'default') {
    const sequencePath = getStoryboardPersistencePath(projectId);

    try {
      const data = fs.readFileSync(sequencePath, 'utf8');
      const sequence = JSON.parse(data);
      if (normalizeSequenceReviewFields(sequence)) {
        writeSequenceFile(sequence, projectId);
      }
      return sequence;
    } catch (err) {
      return {
        version: "2026-02-07",
        projectName: "AI Music Video Project",
        totalShots: 0,
        totalDuration: 0,
        musicFile: "",
        selections: [],
        editorialOrder: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }

  function writeSequenceFile(data, projectId = 'default') {
    const sequencePath = getStoryboardPersistencePath(projectId);
    data.lastUpdated = new Date().toISOString();
    writeJsonPreserveEol(sequencePath, data);
  }

  function getPrevisMapPath(projectId = 'default') {
    return path.join(projectManager.getProjectPath(projectId, 'rendered'), 'storyboard', 'previs_map.json');
  }

  function readPrevisMapFile(projectId = 'default') {
    const previsPath = getPrevisMapPath(projectId);
    try {
      if (!fs.existsSync(previsPath)) return {};
      const parsed = JSON.parse(fs.readFileSync(previsPath, 'utf8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writePrevisMapFile(previsMap, projectId = 'default') {
    const previsPath = getPrevisMapPath(projectId);
    writeJsonPreserveEol(previsPath, previsMap || {});
  }

  function validatePrevisEntry(entry) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Invalid previs entry');
    }

    const sourceTypeRaw = typeof entry.sourceType === 'string' ? entry.sourceType.trim() : '';
    const sourceType = sourceTypeRaw || 'manual';
    if (!PREVIS_SOURCE_TYPES.has(sourceType)) {
      throw new Error('Invalid previs sourceType');
    }

    const sourceRef = typeof entry.sourceRef === 'string' ? entry.sourceRef.trim() : '';
    const notes = typeof entry.notes === 'string' ? entry.notes.trim().slice(0, 500) : '';
    const locked = Boolean(entry.locked);

    const REFERENCE_MODES = new Set(['canon', 'continuity', 'none', 'custom']);
    const referenceMode = REFERENCE_MODES.has(entry.referenceMode) ? entry.referenceMode : 'continuity';

    const REF_ID_PATTERN = /^(continuity|char|loc):[A-Za-z0-9_\/.:\-]+$/;
    let selectedReferences = [];
    if (referenceMode === 'custom' && Array.isArray(entry.selectedReferences)) {
      selectedReferences = entry.selectedReferences
        .filter((id) => typeof id === 'string' && id.length <= 256 && REF_ID_PATTERN.test(id) && !id.includes('..'))
        .slice(0, 14);
    }

    const continuityDisabled = referenceMode === 'custom'
      ? !selectedReferences.includes('continuity:prev_last')
      : referenceMode !== 'continuity';

    return {
      sourceType,
      sourceRef,
      notes,
      locked,
      continuityDisabled,
      referenceMode,
      selectedReferences
    };
  }

  return {
    getStoryboardPersistencePath,
    readSequenceFile,
    writeSequenceFile,
    normalizeAssignee,
    normalizeShotReviewFields,
    normalizeSequenceReviewFields,
    getPrevisMapPath,
    readPrevisMapFile,
    writePrevisMapFile,
    validatePrevisEntry,
    MAX_ASSIGNEE_LENGTH,
    PREVIS_SOURCE_TYPES
  };
}

module.exports = { createStoryboardPersistenceService };
