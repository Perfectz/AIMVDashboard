/**
 * Prompt Template Engine - Shared building blocks for prompt generators
 * Version: 2026-02-15
 *
 * Provides canon loading, data mapping, and prompt file structure utilities
 * used by all project-specific prompt generators.
 */

const fs = require('fs');
const path = require('path');

/**
 * Load a canon JSON file with error handling and fallback.
 */
function loadCanonFile(biblePath, filename, fallback) {
  if (fallback === undefined) fallback = null;
  const filePath = path.join(biblePath, filename);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    /* ignored — return fallback on parse error */
    return fallback;
  }
}

/**
 * Load all standard canon data for a project.
 * Returns { shotList, characters, locations, visualStyle, charMap, locMap, negativePrompt }.
 */
function loadCanonData(biblePath) {
  const shotList = loadCanonFile(biblePath, 'shot_list.json', {});
  const characters = loadCanonFile(biblePath, 'characters.json', {});
  const locations = loadCanonFile(biblePath, 'locations.json', {});
  const visualStyle = loadCanonFile(biblePath, 'visual_style.json', {});

  const charMap = new Map((characters.characters || []).map(function(c) { return [c.id, c]; }));
  const locMap = new Map((locations.locations || []).map(function(l) { return [l.id, l]; }));
  const negativePrompt = (visualStyle.negativePromptBase || 'no text, no logos, no watermark, no distorted anatomy, no cartoon style').trim();

  return { shotList, characters, locations, visualStyle, charMap, locMap, negativePrompt };
}

/**
 * Build character identity phrase from character references.
 * Generic version — project-specific generators can override.
 */
function characterPhrase(charRefs, charMap) {
  if (!Array.isArray(charRefs) || charRefs.length === 0) {
    return 'No specific character visible; environment-led visual storytelling.';
  }
  var chunks = [];
  charRefs.forEach(function(ref) {
    var c = charMap.get(ref.id);
    if (c) {
      var look = c.look ? ' ' + c.look : '';
      chunks.push((c.name || ref.id) + '.' + look);
    } else {
      chunks.push(ref.id + ' present in frame.');
    }
  });
  return chunks.join(' ');
}

/**
 * Build location description phrase from shot data.
 */
function locationPhrase(shot, locMap) {
  var locId = shot.location && shot.location.id;
  if (!locId) return 'Generic cinematic setting.';
  var loc = locMap.get(locId);
  if (!loc) return locId + ' environment.';
  var bits = [loc.name || locId];
  if (loc.description) bits.push(loc.description);
  if (shot.location.specificArea) bits.push('Specific area: ' + shot.location.specificArea);
  return bits.join('. ') + '.';
}

/**
 * Write a prompt file with standard structure: header + prompt + negative prompt + notes.
 */
function writePromptFile(filePath, header, promptBody, negativePrompt, notes) {
  var lines = [];
  lines.push(header);
  lines.push('');
  lines.push(promptBody);
  lines.push('');
  lines.push('--- NEGATIVE PROMPT ---');
  lines.push('');
  lines.push(negativePrompt);
  lines.push('');
  if (notes) {
    lines.push('--- DIRECTOR NOTES ---');
    lines.push('');
    lines.push(notes);
    lines.push('');
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

/**
 * Build a standard prompt file header.
 */
function buildPromptHeader(opts) {
  var shotId = opts.shotId;
  var variation = opts.variation;
  var label = opts.label;
  var section = opts.section || 'unknown';
  var start = opts.start != null ? opts.start : 0;
  var end = opts.end != null ? opts.end : start + 8;
  var duration = opts.duration != null ? opts.duration : (end - start);
  var toolLabel = opts.toolLabel || 'PROMPT';
  var version = opts.version || '2026-02-15';

  return '=== SHOT ' + shotId + ' - Variation ' + variation + ' (' + label + ') ===\n' +
    'Shot: ' + shotId + ' | Section: ' + section + ' | Time: ' + start + 's-' + end + 's (' + duration + 's)\n' +
    'Version: ' + version + '\n' +
    'Variation: ' + variation + '\n\n' +
    '--- ' + toolLabel + ' ---';
}

/**
 * Extract shot timing data with sensible defaults.
 */
function extractTiming(shot, idx) {
  var shotNumber = String(shot.shotNumber || idx + 1).padStart(2, '0');
  var shotId = shot.id || 'SHOT_' + shotNumber;
  var section = (shot.timing && shot.timing.musicSection) ? shot.timing.musicSection : 'unknown';
  var start = (shot.timing && Number.isFinite(shot.timing.start)) ? shot.timing.start : 0;
  var duration = (shot.timing && Number.isFinite(shot.timing.duration)) ? shot.timing.duration : 8;
  var end = (shot.timing && Number.isFinite(shot.timing.end)) ? shot.timing.end : start + duration;

  return { shotNumber: shotNumber, shotId: shotId, section: section, start: start, end: end, duration: duration };
}

module.exports = {
  loadCanonFile: loadCanonFile,
  loadCanonData: loadCanonData,
  characterPhrase: characterPhrase,
  locationPhrase: locationPhrase,
  writePromptFile: writePromptFile,
  buildPromptHeader: buildPromptHeader,
  extractTiming: extractTiming
};
