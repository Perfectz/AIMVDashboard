/**
 * Render and reference file management service.
 * Extracted from serve_ui.js — Phase 4 architecture optimization.
 */

const fs = require('fs');
const path = require('path');
const { safeResolve, safeReadJson } = require('../shared');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function createRenderManagementService({ projectManager, storyboardPersistence }) {

  function parseShotSortValue(shotId) {
    const match = String(shotId || '').match(/^SHOT_(\d{1,4})$/i);
    if (!match) return null;
    return Number(match[1]);
  }

  function sortShotIds(ids = []) {
    return ids.slice().sort((a, b) => {
      const aNum = parseShotSortValue(a);
      const bNum = parseShotSortValue(b);
      if (aNum != null && bNum != null) return aNum - bNum;
      if (aNum != null) return -1;
      if (bNum != null) return 1;
      return String(a).localeCompare(String(b));
    });
  }

  function ensureVariationEntry(entries, tool, variation) {
    if (!entries[tool][variation]) {
      entries[tool][variation] = { first: null, last: null, refs: [] };
    } else if (!Array.isArray(entries[tool][variation].refs)) {
      entries[tool][variation].refs = [];
    }
    return entries[tool][variation];
  }

  function listShotRenderEntries(projectId, shotId) {
    const entries = { seedream: {}, kling: {} };
    const shotDir = safeResolve(projectManager.getProjectPath(projectId), 'rendered', 'shots', shotId);
    if (!fs.existsSync(shotDir)) {
      return entries;
    }

    try {
      const files = fs.readdirSync(shotDir);
      const refsByVariation = {};
      for (const file of files) {
        const match = file.match(/^(seedream|kling)_([A-D])_(first|last)\.(png|jpg|jpeg|webp)$/);
        if (match) {
          const [, tool, variation, frame] = match;
          const slot = ensureVariationEntry(entries, tool, variation);
          slot[frame] = `rendered/shots/${shotId}/${file}`;
          continue;
        }

        const refMatch = file.match(/^(seedream|kling)_([A-D])_first_ref_(\d{2})\.(png|jpg|jpeg|webp)$/);
        if (!refMatch) continue;

        const [, tool, variation, orderRaw] = refMatch;
        const order = Number(orderRaw);
        const slot = ensureVariationEntry(entries, tool, variation);
        if (!refsByVariation[tool]) refsByVariation[tool] = {};
        if (!refsByVariation[tool][variation]) refsByVariation[tool][variation] = [];
        refsByVariation[tool][variation].push({
          order,
          path: `rendered/shots/${shotId}/${file}`
        });
        slot.refs = [];
      }

      Object.keys(refsByVariation).forEach((tool) => {
        Object.keys(refsByVariation[tool]).forEach((variation) => {
          const slot = ensureVariationEntry(entries, tool, variation);
          slot.refs = refsByVariation[tool][variation]
            .sort((a, b) => a.order - b.order)
            .map((entry) => entry.path);
        });
      });
      ['seedream', 'kling'].forEach((tool) => {
        Object.keys(entries[tool]).forEach((variation) => {
          ensureVariationEntry(entries, tool, variation);
        });
      });
    } catch {
      /* ignored — shot dir read error; return empty entries */
    }

    return entries;
  }

  function getOrderedReferenceFiles(referenceDir) {
    if (!fs.existsSync(referenceDir)) return [];
    const files = fs.readdirSync(referenceDir).filter((file) => {
      const ext = path.extname(file).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) return false;
      return /^(ref_\d+|generated_\d+)\.(png|jpg|jpeg|webp)$/i.test(file);
    });

    return files.sort((a, b) => {
      const aRef = a.match(/^ref_(\d+)/i);
      const bRef = b.match(/^ref_(\d+)/i);
      if (aRef && bRef) return Number(aRef[1]) - Number(bRef[1]);
      if (aRef) return -1;
      if (bRef) return 1;
      return a.localeCompare(b);
    });
  }

  function collectShotReferenceImagePaths(projectPath, shotId, maxCount = 14) {
    const shotListPath = path.join(projectPath, 'bible', 'shot_list.json');
    const shotList = safeReadJson(shotListPath, {});
    const shots = Array.isArray(shotList.shots) ? shotList.shots : [];
    const shot = shots.find((item) => item?.shotId === shotId || item?.id === shotId);
    if (!shot) return [];

    const selected = [];
    const seen = new Set();
    const addCandidate = (absPath) => {
      if (!absPath || seen.has(absPath) || selected.length >= maxCount) return;
      seen.add(absPath);
      selected.push(absPath);
    };

    const characters = Array.isArray(shot.characters) ? shot.characters.slice() : [];
    characters.sort((a, b) => (a?.prominence === 'primary' ? -1 : 0) - (b?.prominence === 'primary' ? -1 : 0));
    for (const charRef of characters) {
      if (selected.length >= maxCount) break;
      const charId = charRef?.id;
      if (!charId) continue;
      const charDir = path.join(projectPath, 'reference', 'characters', charId);
      const files = getOrderedReferenceFiles(charDir);
      files.forEach((file) => addCandidate(path.join(charDir, file)));
    }

    if (selected.length < maxCount) {
      const locationId = shot?.location?.id;
      if (locationId) {
        const locationDir = path.join(projectPath, 'reference', 'locations', locationId);
        const files = getOrderedReferenceFiles(locationDir);
        files.forEach((file) => addCandidate(path.join(locationDir, file)));
      }
    }

    return selected.slice(0, maxCount);
  }

  function syncShotReferenceSetFiles(projectPath, shotId, tool, variation, sourcePaths, maxCount = 14) {
    const shotDir = path.join(projectPath, 'rendered', 'shots', shotId);
    if (!fs.existsSync(shotDir)) {
      fs.mkdirSync(shotDir, { recursive: true });
    }

    const prefix = `${tool}_${variation}_first_ref_`;
    fs.readdirSync(shotDir).forEach((file) => {
      if (file.startsWith(prefix)) {
        fs.unlinkSync(path.join(shotDir, file));
      }
    });

    const saved = [];
    sourcePaths.slice(0, maxCount).forEach((sourcePath, index) => {
      const ext = path.extname(sourcePath).toLowerCase() || '.png';
      const filename = `${tool}_${variation}_first_ref_${String(index + 1).padStart(2, '0')}${ext}`;
      const targetPath = path.join(shotDir, filename);
      fs.copyFileSync(sourcePath, targetPath);
      saved.push(`rendered/shots/${shotId}/${filename}`);
    });

    return saved;
  }

  function normalizeRelativeProjectPath(projectPath, absPath) {
    return path.relative(projectPath, absPath).replace(/\\/g, '/');
  }

  function addReferenceDataUriIfPossible(refList, dataUri, sourceTag) {
    if (!dataUri || refList.inputs.length >= 14) return false;
    if (refList.inputs.includes(dataUri)) return false;
    refList.inputs.push(dataUri);
    refList.sources.push(sourceTag);
    return true;
  }

  function getOrderedShotIds(projectId) {
    const ordered = [];
    const seen = new Set();
    const sequence = storyboardPersistence.readSequenceFile(projectId);

    const sequenceIds = Array.isArray(sequence.editorialOrder) && sequence.editorialOrder.length > 0
      ? sequence.editorialOrder
      : Array.isArray(sequence.selections) ? sequence.selections.map((shot) => shot && shot.shotId).filter(Boolean) : [];

    sequenceIds.forEach((shotId) => {
      if (seen.has(shotId)) return;
      seen.add(shotId);
      ordered.push(shotId);
    });

    if (ordered.length > 0) {
      return ordered;
    }

    const promptsIndexPath = path.join(projectManager.getProjectPath(projectId), 'prompts_index.json');
    const promptsIndex = safeReadJson(promptsIndexPath, {});
    const idsFromIndex = Array.isArray(promptsIndex.shots)
      ? promptsIndex.shots.map((shot) => shot && shot.shotId).filter(Boolean)
      : [];

    return sortShotIds(idsFromIndex);
  }

  function getPreviousShotId(currentShotId, orderedShotIds) {
    if (!Array.isArray(orderedShotIds) || !currentShotId) return null;
    const idx = orderedShotIds.indexOf(currentShotId);
    if (idx <= 0) return null;
    return orderedShotIds[idx - 1] || null;
  }

  function resolveSeedreamContinuityForShot(projectId, shotId, renders, previsMap) {
    const orderedShotIds = getOrderedShotIds(projectId);
    const previousShotId = getPreviousShotId(shotId, orderedShotIds);
    const previousRenders = previousShotId ? listShotRenderEntries(projectId, previousShotId) : { seedream: {} };

    // Use previous shot's chosen variation instead of always A
    const sequence = storyboardPersistence.readSequenceFile(projectId);
    const prevSelection = previousShotId
      ? (sequence.selections || []).find((s) => s.shotId === previousShotId)
      : null;
    const prevChosenVariation = (prevSelection && prevSelection.selectedVariation && prevSelection.selectedVariation !== 'none')
      ? prevSelection.selectedVariation
      : 'A';
    const previousLastChosen = previousRenders.seedream?.[prevChosenVariation]?.last || null;
    const continuityDisabled = Boolean(previsMap?.[shotId]?.continuityDisabled);

    const resolvedSeedream = {};
    const continuityByVariation = {};

    ['A', 'B', 'C', 'D'].forEach((variation) => {
      const directFirst = renders.seedream?.[variation]?.first || null;
      const directLast = renders.seedream?.[variation]?.last || null;

      let firstPath = null;
      let firstSource = 'none';
      let reason = null;
      let inheritedFromShotId = null;

      if (directFirst) {
        firstPath = directFirst;
        firstSource = 'direct';
        reason = 'manual_override';
      } else if (continuityDisabled) {
        reason = 'disabled_by_shot';
      } else if (!previousShotId) {
        reason = 'no_previous_shot';
      } else if (!previousLastChosen) {
        reason = 'missing_previous_last';
      } else {
        firstPath = previousLastChosen;
        firstSource = 'inherited';
        inheritedFromShotId = previousShotId;
        reason = 'inherited_from_previous_last';
      }

      resolvedSeedream[variation] = {
        first: {
          path: firstPath,
          source: firstSource,
          inheritedFromShotId,
          inheritedFromVariation: inheritedFromShotId ? prevChosenVariation : null,
          inheritedFromFrame: inheritedFromShotId ? 'last' : null
        },
        last: {
          path: directLast,
          source: directLast ? 'direct' : 'none'
        }
      };

      continuityByVariation[variation] = {
        enabled: !continuityDisabled,
        disabledByShot: continuityDisabled,
        sourceShotId: inheritedFromShotId,
        sourceVariation: inheritedFromShotId ? prevChosenVariation : null,
        sourceFrame: inheritedFromShotId ? 'last' : null,
        reason
      };
    });

    return {
      resolved: resolvedSeedream,
      continuity: {
        enabled: !continuityDisabled,
        disabledByShot: continuityDisabled,
        sourceShotId: previousShotId,
        sourceFrame: previousLastChosen ? 'last' : null,
        reason: continuityDisabled
          ? 'disabled_by_shot'
          : (!previousShotId ? 'no_previous_shot' : (previousLastChosen ? 'source_available' : 'missing_previous_last')),
        byVariation: continuityByVariation
      }
    };
  }

  function resolvePreviousShotLastFrame(projectId, currentShotId) {
    const orderedShotIds = getOrderedShotIds(projectId);
    const previousShotId = getPreviousShotId(currentShotId, orderedShotIds);
    if (!previousShotId) return { available: false, reason: 'no_previous_shot' };

    const sequence = storyboardPersistence.readSequenceFile(projectId);
    const prevSelection = (sequence.selections || []).find((s) => s.shotId === previousShotId);
    const prevChosenVariation = (prevSelection && prevSelection.selectedVariation && prevSelection.selectedVariation !== 'none')
      ? prevSelection.selectedVariation
      : 'A';

    const previousRenders = listShotRenderEntries(projectId, previousShotId);
    const lastFrame = previousRenders.seedream?.[prevChosenVariation]?.last || null;

    if (!lastFrame) {
      return {
        available: false,
        previousShotId,
        variation: prevChosenVariation,
        reason: 'missing_previous_last'
      };
    }

    return {
      available: true,
      previousShotId,
      variation: prevChosenVariation,
      path: lastFrame,
      reason: 'source_available'
    };
  }

  const MIME_MAP = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp' };
  const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per reference image

  function imagePathToDataUri(projectId, relativeImagePath) {
    if (!relativeImagePath) return null;
    const absolutePath = safeResolve(projectManager.getProjectPath(projectId), relativeImagePath);
    if (!fs.existsSync(absolutePath)) return null;

    try {
      const stat = fs.statSync(absolutePath);
      if (stat.size > MAX_IMAGE_FILE_SIZE) return null;
    } catch { return null; }

    const ext = path.extname(absolutePath).toLowerCase();
    const mime = MIME_MAP[ext];
    if (!mime) return null;

    const imgData = fs.readFileSync(absolutePath);
    return `data:image/${mime};base64,${imgData.toString('base64')}`;
  }

  function getShotPreviewDir(projectPath, shotId) {
    return path.join(projectPath, 'rendered', 'shots', shotId, 'preview');
  }

  function isPreviewPathForShot(shotId, relativePath) {
    if (!relativePath || typeof relativePath !== 'string') return false;
    const normalized = String(relativePath).replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized.includes('..')) return false;
    const expectedPrefix = `rendered/shots/${shotId}/preview/`;
    return normalized.startsWith(expectedPrefix);
  }

  return {
    parseShotSortValue,
    sortShotIds,
    ensureVariationEntry,
    listShotRenderEntries,
    getOrderedReferenceFiles,
    collectShotReferenceImagePaths,
    syncShotReferenceSetFiles,
    normalizeRelativeProjectPath,
    addReferenceDataUriIfPossible,
    getOrderedShotIds,
    getPreviousShotId,
    resolveSeedreamContinuityForShot,
    resolvePreviousShotLastFrame,
    imagePathToDataUri,
    getShotPreviewDir,
    isPreviewPathForShot,
    IMAGE_EXTENSIONS
  };
}

module.exports = { createRenderManagementService };
