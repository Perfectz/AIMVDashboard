#!/usr/bin/env node

/**
 * SeedDream v4.5 Prompt Generator
 * Version: 2026-02-08 v3
 *
 * Generates compact "Create 2 Images" prompts for sequential generation.
 * Each image prompt is a complete scene description — Frame 2 describes
 * the same scene with specific changes in gesture, expression, and light.
 *
 * Total SeedDream prompt stays under 2000 characters.
 * Emotions match the situation (no forced smile anchoring).
 *
 * Variations: A (Standard), B (Intimate Close), C (Wide Cinematic)
 *
 * Usage: node scripts/generate_prompts_seedream.js [project-id]
 */

const fs = require('fs');
const path = require('path');
const projectManager = require('./project_manager');

const projectId = process.argv[2] || 'where-time-breaks';

if (!projectManager.projectExists(projectId)) {
  console.error(`\n\u274C Error: Project '${projectId}' not found`);
  process.exit(1);
}

// ── Load canon data ───────────────────────────────────────────────

const biblePath = projectManager.getProjectPath(projectId, 'bible');

function loadCanonFile(filename) {
  const filePath = path.join(biblePath, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`\n\u274C Error: Canon file not found: ${filename}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`\n\u274C Error: Failed to parse ${filename}: ${err.message}\n`);
    process.exit(1);
  }
}

const shotList = loadCanonFile('shot_list.json');
const characters = loadCanonFile('characters.json');
const locations = loadCanonFile('locations.json');
const visualStyle = loadCanonFile('visual_style.json');

if (!shotList.shots || shotList.shots.length === 0) {
  console.error('\n\u274C Error: shot_list.json has no shots defined.\n');
  process.exit(1);
}

const charMap = {};
(characters.characters || []).forEach(c => { charMap[c.id] = c; });
const locMap = {};
(locations.locations || []).forEach(l => { locMap[l.id] = l; });
const negativePrompt = visualStyle.negativePromptBase || 'no text, logos, watermarks, distorted anatomy';

// ── Prompt-friendly names (AI needs real names + short descriptor) ──

const PROMPT_NAMES = {
  'CHAR_HER': 'Su, a beautiful Thai woman',
  'CHAR_HIM': 'Patrick, a Black man'
};

function promptName(charId) {
  return PROMPT_NAMES[charId] || charMap[charId]?.name?.split(' (')[0] || charId;
}

function promptNameShort(charId) {
  // Just the first name for continuity references ("Same Su", "Patrick now ...")
  return PROMPT_NAMES[charId]?.split(',')[0] || charMap[charId]?.name?.split(' (')[0] || charId;
}

/**
 * Replace canon character names (Tide, Ember) with prompt-friendly names in any text.
 */
function replaceCanonNames(text) {
  return text
    .replace(/\bTide\b/g, 'Su')
    .replace(/\bEmber\b/g, 'Patrick');
}

// ── Compact builders ─────────────────────────────────────────────

const strip = (s) => (s || '').replace(/\.+\s*$/, '');

/**
 * Build a compact character description. No smile anchoring.
 * ~150-200 chars for single character.
 */
function charDesc(charId, costumeVar) {
  const c = charMap[charId];
  if (!c) return '';
  const b = c.physicalCore;
  const f = c.faceSignature;
  const cos = c.costume.default;

  const parts = [];
  parts.push(`${b.age}, ${strip(b.skinTone)}`);
  parts.push(strip(b.build));
  parts.push(strip(f.hair));
  parts.push(strip(f.structure));

  // Key identity anchors — skip smile-related
  for (const feat of f.distinctiveFeatures) {
    if (/smile/i.test(feat)) continue;
    if (/face.*complexion/i.test(feat)) continue; // already said
    if (/hair.*pulled/i.test(feat)) continue; // already said
    parts.push(strip(feat));
  }

  parts.push(strip(cos.signature));

  if (costumeVar === 'BATTLE_WORN') {
    const bw = (c.costume.variations || []).find(v => v.id === 'BATTLE_WORN');
    if (bw) parts.push(strip(bw.description));
  }

  return parts.join('. ') + '.';
}

/**
 * Build compact location atmosphere. ~100-150 chars.
 */
function locAtmosphere(locId, specificArea) {
  const loc = locMap[locId];
  if (!loc) return '';
  const a = loc.atmosphere;
  return [
    strip(specificArea || loc.setting.type),
    strip(a.lighting),
    a.colorPalette.slice(0, 3).join(', ')
  ].join('. ') + '.';
}

/**
 * Camera movement string (compact).
 */
const CAM = {
  'locked hold': 'Static camera, locked tripod',
  'slow glide': 'Slow smooth lateral glide',
  'push in': 'Slow push in toward subject',
  'pull back / reveal': 'Pull back revealing environment',
  'dolly tracking': 'Dolly tracking alongside movement',
  'crane up/down': 'Crane shot, vertical sweep',
  'slight lag tracking': 'Tracking with slight lag',
  'orbital': 'Slow orbital rotation'
};

// ── Variation definitions ────────────────────────────────────────

const VARS = {
  A: {
    label: 'Standard',
    framingTag: '',
    adjustCam: (c) => c,
    trimLoc: (d) => d,
    trimChar: (d) => d
  },
  B: {
    label: 'Intimate Close',
    framingTag: 'Extreme close-up, shallow depth of field, skin texture visible, bokeh background. ',
    adjustCam: (c) => {
      const t = { 'locked hold': 'slow glide', 'slow glide': 'push in', 'push in': 'locked hold', 'pull back / reveal': 'push in', 'dolly tracking': 'slight lag tracking', 'crane up/down': 'push in', 'slight lag tracking': 'push in', 'orbital': 'slow glide' };
      return { ...c, movement: t[c.movement] || 'push in', focus: 'subject' };
    },
    trimLoc: (d) => {
      // Keep first 2 sentences + bokeh
      const s = d.split('. ');
      return s.slice(0, 2).join('. ') + '. Background soft bokeh.';
    },
    trimChar: (d) => d
  },
  C: {
    label: 'Wide Cinematic',
    framingTag: 'Ultra-wide cinematic, epic scale, deep focus, IMAX format. ',
    adjustCam: (c) => {
      const w = { 'locked hold': 'crane up/down', 'slow glide': 'pull back / reveal', 'push in': 'pull back / reveal', 'pull back / reveal': 'crane up/down', 'dolly tracking': 'orbital', 'crane up/down': 'orbital', 'slight lag tracking': 'dolly tracking', 'orbital': 'crane up/down' };
      return { ...c, movement: w[c.movement] || 'pull back / reveal', focus: 'environment' };
    },
    trimLoc: (d) => d + ' Vast scale visible.',
    trimChar: (d) => {
      // Fewer character details — they're small in frame
      const s = d.split('. ');
      return s.slice(0, 4).join('. ') + '.';
    }
  }
};

// ── Build prompt ─────────────────────────────────────────────────

function buildPrompt(shot, variation) {
  const v = VARS[variation];
  const cam = v.adjustCam(shot.cameraIntent);
  const camStr = CAM[cam.movement] || cam.movement;

  // Character info
  const chars = (shot.characters || []).map(ref => {
    const c = charMap[ref.id];
    if (!c) return null;
    return {
      name: promptName(ref.id),
      shortName: promptNameShort(ref.id),
      desc: v.trimChar(charDesc(ref.id, ref.costumeVariation)),
      action: ref.action,
      prominence: ref.prominence
    };
  }).filter(Boolean);

  // Location
  const loc = shot.location ? locMap[shot.location.id] : null;
  const locStr = shot.location ? v.trimLoc(locAtmosphere(shot.location.id, shot.location.specificArea)) : '';
  const mood = loc ? (loc.atmosphere.mood || '') : '';

  // ── Parse action into start-state and end-state ──
  const charFrame1 = [];
  const charFrame2 = [];

  chars.forEach(cd => {
    const actionParts = cd.action.split(',').map(s => s.trim());
    if (actionParts.length >= 2) {
      charFrame1.push({ name: cd.name, shortName: cd.shortName, state: actionParts[0] });
      charFrame2.push({ name: cd.name, shortName: cd.shortName, state: actionParts[actionParts.length - 1] });
    } else {
      charFrame1.push({ name: cd.name, shortName: cd.shortName, state: actionParts[0] });
      charFrame2.push({ name: cd.name, shortName: cd.shortName, state: actionParts[0] });
    }
  });

  const emotionalBeat = shot.intent.emotionalBeat;
  const what = replaceCanonNames(shot.intent.what);

  // ── Build Image 1 (complete scene description) ──
  const img1Parts = [];

  // Framing tag for variation
  if (v.framingTag) img1Parts.push(v.framingTag);

  // Scene description from shot intent — cap at 160 chars for 2-char shots, 200 for single
  const maxSceneLen = chars.length > 1 ? 160 : 200;
  const sceneSentences = what.split('. ');
  let sceneDesc = '';
  for (const s of sceneSentences) {
    if (sceneDesc.length > maxSceneLen) break;
    sceneDesc += (sceneDesc ? '. ' : '') + s;
  }
  img1Parts.push(strip(sceneDesc) + '.');

  // Character descriptions inline
  chars.forEach((cd, i) => {
    const state = charFrame1[i]?.state || '';
    img1Parts.push(`${cd.name}: ${cd.desc} ${state ? state + '.' : ''}`);
  });

  // Location + atmosphere
  if (locStr) img1Parts.push(locStr);

  // Camera
  img1Parts.push(`${camStr}, ${cam.feeling} framing.`);

  // ── Build Image 2 (same scene with specific changes) ──
  const img2Parts = [];

  // Start with continuity
  if (chars.length > 0) {
    const charNames = chars.map(c => c.shortName).join(' and ');
    img2Parts.push(`Same ${charNames}, same location`);
  } else {
    img2Parts.push('Same location');
  }

  // Describe what changes
  if (chars.length > 0) {
    const changes = [];
    charFrame2.forEach((cf, i) => {
      const f1 = charFrame1[i];
      if (cf.state !== f1.state) {
        changes.push(`${cf.shortName} now ${cf.state}`);
      }
    });
    if (changes.length > 0) {
      img2Parts.push('but ' + changes.join(', and ') + '.');
    } else {
      img2Parts.push(`but the emotional weight has shifted — ${emotionalBeat.toLowerCase()}.`);
    }
  } else {
    img2Parts.push(`but light and atmosphere have shifted — ${emotionalBeat.toLowerCase()}.`);
  }

  // Emotional shift description
  img2Parts.push(`${emotionalBeat}. Same camera angle, same framing — the change is in gesture, expression, and light.`);

  // ── Combine into SeedDream prompt ──
  const sdPrompt = [
    'Create 2 Images',
    `1: ${img1Parts.join(' ')}`,
    '',
    `2: ${img2Parts.join(' ')}`
  ].join('\n');

  // ── Full file with metadata headers ──
  const lines = [];
  lines.push(`=== SHOT ${shot.id} — Variation ${variation} (${v.label}) ===`);
  lines.push(`Shot: ${shot.id} | Section: ${shot.timing.musicSection} | Time: ${shot.timing.start}s\u2013${shot.timing.end}s (${shot.timing.duration}s)`);
  lines.push(`Version: 2026-02-08`);
  lines.push(`Variation: ${variation}`);
  lines.push('');
  lines.push('--- SEEDREAM PROMPT ---');
  lines.push('');
  lines.push(sdPrompt);
  lines.push('');
  lines.push('--- NEGATIVE PROMPT ---');
  lines.push('');
  lines.push(negativePrompt);
  lines.push('');

  if (shot.notes) {
    lines.push('--- DIRECTOR NOTES ---');
    lines.push('');
    lines.push(replaceCanonNames(shot.notes));
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────

function main() {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551   SEEDREAM v4.5 PROMPT GENERATOR              \u2551');
  console.log('\u2551   Version: 2026-02-08 v3 (Create 2 Images)   \u2551');
  console.log('\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n');

  const project = projectManager.getProject(projectId);
  console.log(`Project: ${project.name} (${projectId})`);
  console.log(`Shots: ${shotList.shots.length}`);
  console.log(`Variations: A (Standard), B (Intimate Close), C (Wide Cinematic)`);
  console.log(`Total prompts: ${shotList.shots.length * 3}`);
  console.log(`Char limit: 2000 per prompt section\n`);

  const outputDir = projectManager.getProjectPath(projectId, 'prompts/seedream');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sectionGroups = {};
  let generated = 0;
  let overLimit = 0;
  let maxLen = 0;
  const variations = ['A', 'B', 'C'];

  shotList.shots.forEach(shot => {
    const section = shot.timing.musicSection;
    if (!sectionGroups[section]) sectionGroups[section] = [];
    sectionGroups[section].push(shot.id);

    variations.forEach(vKey => {
      const fullText = buildPrompt(shot, vKey);
      const filename = `shot_${String(shot.shotNumber).padStart(2, '0')}_${vKey}.txt`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, fullText);

      // Measure prompt section length
      const pStart = fullText.indexOf('--- SEEDREAM PROMPT ---');
      const pEnd = fullText.indexOf('--- NEGATIVE PROMPT ---');
      if (pStart !== -1 && pEnd !== -1) {
        const section = fullText.substring(pStart + '--- SEEDREAM PROMPT ---'.length, pEnd).trim();
        const len = section.length;
        if (len > maxLen) maxLen = len;
        if (len > 2000) {
          overLimit++;
          console.warn(`  \u26A0 ${shot.id} ${vKey}: ${len} chars`);
        }
      }

      generated++;
    });

    process.stdout.write(`  \u2713 ${shot.id} (A/B/C)\n`);
  });

  console.log(`\n\u2705 Generated ${generated} prompt files`);
  console.log(`   Max prompt: ${maxLen} chars`);
  if (overLimit > 0) {
    console.warn(`   \u26A0 ${overLimit} prompts exceed 2000 char limit`);
  } else {
    console.log(`   \u2705 All under 2000 chars`);
  }

  console.log('\nSections:');
  Object.entries(sectionGroups).forEach(([sec, shots]) => {
    console.log(`  ${sec}: ${shots.join(', ')}`);
  });

  console.log(`\nNext: npm run index ${projectId} && npm run restart\n`);
}

main();
