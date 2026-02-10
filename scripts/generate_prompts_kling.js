#!/usr/bin/env node

/**
 * Kling 3.0 Prompt Generator
 * Version: 2026-02-08
 *
 * Generates compact motion/animation prompts for Kling 3.0 video generation.
 * Kling takes first frame + last frame + text prompt describing motion between them.
 * Prompts focus on: camera movement, character action transitions, atmosphere shifts.
 *
 * Total Kling prompt stays under 500 characters.
 *
 * Variations: A (Standard), B (Dynamic), C (Slow/Atmospheric)
 *
 * Usage: node scripts/generate_prompts_kling.js [project-id]
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
const negativePrompt = 'no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin, modern objects';

// ── Prompt-friendly names (AI needs real names + short descriptor) ──

const PROMPT_NAMES = {
  'CHAR_HER': 'Su, a beautiful Thai woman',
  'CHAR_HIM': 'Patrick, a Black man'
};

function promptName(charId) {
  return PROMPT_NAMES[charId] || charMap[charId]?.name?.split(' (')[0] || charId;
}

function promptNameShort(charId) {
  return PROMPT_NAMES[charId]?.split(',')[0] || charMap[charId]?.name?.split(' (')[0] || charId;
}

function replaceCanonNames(text) {
  return text
    .replace(/\bTide\b/g, 'Su')
    .replace(/\bEmber\b/g, 'Patrick');
}

// ── Compact builders ─────────────────────────────────────────────

const strip = (s) => (s || '').replace(/\.+\s*$/, '');

/**
 * Compact character identity for Kling (~60 chars).
 * Name + 3-4 key visual anchors only.
 */
function charIdentity(charId) {
  const c = charMap[charId];
  if (!c) return '';
  const b = c.physicalCore;
  const f = c.faceSignature;

  const parts = [promptName(charId)];
  parts.push(strip(b.skinTone));
  parts.push(strip(f.hair).split(',')[0]); // First hair descriptor only
  parts.push(strip(c.costume.default.signature).split(',')[0]); // First costume part

  // Add key distinctive features (glasses, goatee, etc.) — skip smile/face/hair dupes
  for (const feat of f.distinctiveFeatures) {
    if (/smile|face.*complexion|hair.*pulled/i.test(feat)) continue;
    if (parts.join(', ').length > 80) break;
    parts.push(strip(feat).split(',')[0]);
  }

  return parts.join(', ') + '.';
}

/**
 * Camera movement string for Kling (describes motion over 8 seconds).
 */
const CAM_MOTION = {
  'locked hold': 'Static camera, locked tripod',
  'slow glide': 'Slow lateral glide left to right',
  'push in': 'Steady push in toward subject',
  'pull back / reveal': 'Pull back revealing full environment',
  'dolly tracking': 'Dolly tracking alongside subject movement',
  'crane up/down': 'Crane rises from low to high angle',
  'slight lag tracking': 'Tracking with subtle lag behind motion',
  'orbital': 'Slow orbital rotation around subject'
};

// ── Variation definitions ────────────────────────────────────────

const VARS = {
  A: {
    label: 'Standard',
    adjustCam: (c) => c
  },
  B: {
    label: 'Dynamic',
    adjustCam: (c) => {
      const t = {
        'locked hold': 'push in',
        'slow glide': 'dolly tracking',
        'push in': 'dolly tracking',
        'pull back / reveal': 'push in',
        'dolly tracking': 'slight lag tracking',
        'crane up/down': 'dolly tracking',
        'slight lag tracking': 'dolly tracking',
        'orbital': 'dolly tracking'
      };
      return { ...c, movement: t[c.movement] || 'push in' };
    }
  },
  C: {
    label: 'Slow/Atmospheric',
    adjustCam: (c) => {
      const w = {
        'locked hold': 'slow glide',
        'slow glide': 'orbital',
        'push in': 'slow glide',
        'pull back / reveal': 'crane up/down',
        'dolly tracking': 'crane up/down',
        'crane up/down': 'orbital',
        'slight lag tracking': 'slow glide',
        'orbital': 'crane up/down'
      };
      return { ...c, movement: w[c.movement] || 'slow glide' };
    }
  }
};

// ── Build prompt ─────────────────────────────────────────────────

function buildPrompt(shot, variation) {
  const v = VARS[variation];
  const cam = v.adjustCam(shot.cameraIntent);
  const camStr = CAM_MOTION[cam.movement] || cam.movement;

  // Character identities (compact)
  const chars = (shot.characters || []).map(ref => {
    const c = charMap[ref.id];
    if (!c) return null;
    return {
      name: promptNameShort(ref.id),
      identity: charIdentity(ref.id),
      action: ref.action
    };
  }).filter(Boolean);

  // Location atmosphere (very compact)
  const loc = shot.location ? locMap[shot.location.id] : null;
  let locBrief = '';
  if (loc) {
    locBrief = strip(shot.location.specificArea || loc.setting.type);
  }

  // Parse action into start → end transition
  const transitions = chars.map(cd => {
    const parts = cd.action.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      return `${cd.name} transitions from ${parts[0]} to ${parts[parts.length - 1]}`;
    }
    return `${cd.name} ${parts[0]}`;
  });

  // Build the motion prompt
  const promptParts = [];

  // Camera movement first (most important for video)
  promptParts.push(camStr + '.');

  // Character action and identity
  chars.forEach((cd, i) => {
    promptParts.push(cd.identity);
  });

  // Action transition
  if (transitions.length > 0) {
    promptParts.push(transitions.join('. ') + '.');
  }

  // Location context (brief)
  if (locBrief) {
    promptParts.push(strip(locBrief) + '.');
  }

  // Atmosphere/light shift
  if (loc && loc.atmosphere) {
    const colors = loc.atmosphere.colorPalette.slice(0, 2).join(', ');
    promptParts.push(`${colors} tones.`);
  }

  // Combine and trim to 500 chars
  let prompt = promptParts.join(' ');
  if (prompt.length > 500) {
    // Trim by removing location detail first, then atmosphere
    prompt = promptParts.slice(0, -1).join(' ');
    if (prompt.length > 500) {
      prompt = promptParts.slice(0, -2).join(' ');
    }
    if (prompt.length > 500) {
      prompt = prompt.substring(0, 497) + '...';
    }
  }

  // ── Full file with metadata headers ──
  const lines = [];
  lines.push(`=== SHOT ${shot.id} \u2014 Variation ${variation} (${v.label}) ===`);
  lines.push(`Shot: ${shot.id} | Section: ${shot.timing.musicSection} | Time: ${shot.timing.start}s\u2013${shot.timing.end}s (${shot.timing.duration}s)`);
  lines.push(`Version: 2026-02-08`);
  lines.push(`Variation: ${variation}`);
  lines.push('');
  lines.push('--- KLING PROMPT ---');
  lines.push('');
  lines.push(prompt);
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

  return { text: lines.join('\n'), promptLen: prompt.length };
}

// ── Main ──────────────────────────────────────────────────────────

function main() {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551   KLING 3.0 PROMPT GENERATOR                  \u2551');
  console.log('\u2551   Version: 2026-02-08 (Motion Prompts)        \u2551');
  console.log('\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n');

  const project = projectManager.getProject(projectId);
  console.log(`Project: ${project.name} (${projectId})`);
  console.log(`Shots: ${shotList.shots.length}`);
  console.log(`Variations: A (Standard), B (Dynamic), C (Slow/Atmospheric)`);
  console.log(`Total prompts: ${shotList.shots.length * 3}`);
  console.log(`Char limit: 500 per prompt section\n`);

  const outputDir = projectManager.getProjectPath(projectId, 'prompts/kling');
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
      const { text, promptLen } = buildPrompt(shot, vKey);
      const filename = `shot_${String(shot.shotNumber).padStart(2, '0')}_${vKey}.txt`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, text);

      if (promptLen > maxLen) maxLen = promptLen;
      if (promptLen > 500) {
        overLimit++;
        console.warn(`  \u26A0 ${shot.id} ${vKey}: ${promptLen} chars`);
      }

      generated++;
    });

    process.stdout.write(`  \u2713 ${shot.id} (A/B/C)\n`);
  });

  console.log(`\n\u2705 Generated ${generated} prompt files`);
  console.log(`   Max prompt: ${maxLen} chars`);
  if (overLimit > 0) {
    console.warn(`   \u26A0 ${overLimit} prompts exceed 500 char limit`);
  } else {
    console.log(`   \u2705 All under 500 chars`);
  }

  console.log('\nSections:');
  Object.entries(sectionGroups).forEach(([sec, shots]) => {
    console.log(`  ${sec}: ${shots.join(', ')}`);
  });

  console.log(`\nNext: npm run index ${projectId} && npm run restart\n`);
}

main();
