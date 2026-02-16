/**
 * Context bundle building service.
 * Extracted from serve_ui.js — Phase 4 architecture optimization.
 */

const fs = require('fs');
const path = require('path');
const { safeReadJson, safeReadText, safeResolve } = require('../shared');
const { resolveTimedTranscriptForShot } = require('./timed_context_service');

function createContextBundleService({ projectManager }) {

  function buildContextBundle(projectId) {
    const projectPath = projectManager.getProjectPath(projectId);
    const sequence = safeReadJson(path.join(projectPath, 'rendered', 'storyboard', 'sequence.json'), { selections: [] }) || { selections: [] };
    const shotList = safeReadJson(path.join(projectPath, 'bible', 'shot_list.json'), {});
    const characters = safeReadJson(path.join(projectPath, 'bible', 'characters.json'), {});
    const locations = safeReadJson(path.join(projectPath, 'bible', 'locations.json'), {});
    const analysis = safeReadJson(path.join(projectPath, 'music', 'analysis.json'), {});
    const songInfo = safeReadText(path.join(projectPath, 'music', 'song_info.txt'), '');

    const selections = Array.isArray(sequence.selections) ? sequence.selections : [];
    const selectionByShotId = new Map(
      selections
        .filter((shot) => shot && shot.shotId)
        .map((shot) => [shot.shotId, shot])
    );

    const editorialOrder = Array.isArray(sequence.editorialOrder) && sequence.editorialOrder.length > 0
      ? sequence.editorialOrder.filter(Boolean)
      : selections.map((shot) => shot && shot.shotId).filter(Boolean);

    const selectionOrder = [];
    const seenSelectionIds = new Set();
    editorialOrder.forEach((shotId, index) => {
      const shot = selectionByShotId.get(shotId) || { shotId, selectedVariation: 'none', shotNumber: index + 1, timing: {} };
      selectionOrder.push({
        order: selectionOrder.length + 1,
        shotId,
        selectedVariation: shot.selectedVariation || 'none',
        shotNumber: shot.shotNumber,
        timing: shot.timing || {}
      });
      seenSelectionIds.add(shotId);
    });

    selections.forEach((shot) => {
      if (!shot || !shot.shotId || seenSelectionIds.has(shot.shotId)) return;
      selectionOrder.push({
        order: selectionOrder.length + 1,
        shotId: shot.shotId,
        selectedVariation: shot.selectedVariation || 'none',
        shotNumber: shot.shotNumber,
        timing: shot.timing || {}
      });
    });

    const scriptShots = Array.isArray(shotList.shots) ? shotList.shots : [];
    const scriptByShotId = new Map(scriptShots.map((shot) => [shot.id || shot.shotId, shot]));
    const charById = new Map((characters.characters || []).map((c) => [c.id || c.name, c]));
    const locById = new Map((locations.locations || []).map((l) => [l.id || l.name, l]));

    const transcriptLines = [];
    (analysis.sections || []).forEach((section) => {
      if (section?.lyrics) transcriptLines.push(section.lyrics);
      if (section?.transcript) transcriptLines.push(section.transcript);
    });
    if (transcriptLines.length === 0 && songInfo) transcriptLines.push(songInfo);

    const shots = selectionOrder.map((selection) => {
      const scriptShot = scriptByShotId.get(selection.shotId) || {};
      const references = [];

      (scriptShot.characters || []).forEach((charRef) => {
        const charData = charById.get(charRef.id) || {};
        const refDir = safeResolve(projectPath, 'reference', 'characters', charRef.id || '');
        let images = [];
        if (charRef.id && fs.existsSync(refDir)) {
          images = fs.readdirSync(refDir).filter((name) => /^ref_\d+\.(png|jpg|jpeg|webp)$/i.test(name));
        }
        references.push({
          type: 'character',
          id: charRef.id || 'unknown',
          name: charData.name || charRef.id || 'Unknown character',
          assets: images
        });
      });

      if (scriptShot.location?.id) {
        const locData = locById.get(scriptShot.location.id) || {};
        references.push({
          type: 'location',
          id: scriptShot.location.id,
          name: locData.name || scriptShot.location.id,
          assets: []
        });
      }

      return {
        shotId: selection.shotId,
        selectedVariation: selection.selectedVariation,
        scriptSnippet: {
          what: scriptShot.intent?.what || '',
          why: scriptShot.intent?.why || '',
          notes: scriptShot.notes || ''
        },
        transcriptSnippet: resolveTimedTranscriptForShot({
          shot: scriptShot?.timing ? scriptShot : { timing: selection.timing || {} },
          analysis,
          songInfo,
          preferredSectionId: scriptShot?.timing?.musicSection || selection.timing?.musicSection || ''
        }).snippet,
        references
      };
    });

    const warnings = [];
    if (selectionOrder.length === 0) warnings.push('No selected shots found in storyboard sequence.');
    if (scriptShots.length === 0) warnings.push('No script shot list found (bible/shot_list.json).');
    if (transcriptLines.length === 0) warnings.push('No transcript/song snippets found (music/analysis.json or music/song_info.txt).');

    shots.forEach((shot) => {
      if (!shot.scriptSnippet.what && !shot.scriptSnippet.why) {
        warnings.push(`${shot.shotId}: Missing script intent context.`);
      }
      if (!shot.references.length) {
        warnings.push(`${shot.shotId}: No active references mapped.`);
      }
      if (!shot.transcriptSnippet) {
        warnings.push(`${shot.shotId}: No timed transcript context matched.`);
      }
      shot.references.forEach((ref) => {
        if (ref.type === 'character' && ref.assets.length === 0) {
          warnings.push(`${shot.shotId}: Character ${ref.id} has no reference images.`);
        }
      });
    });

    return {
      generatedAt: new Date().toISOString(),
      projectId,
      selectedShotOrder: selectionOrder,
      shots,
      warnings
    };
  }

  return {
    buildContextBundle
  };
}

module.exports = { createContextBundleService };
