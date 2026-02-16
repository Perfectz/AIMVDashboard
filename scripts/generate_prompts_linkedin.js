#!/usr/bin/env node

/**
 * Prompt Generator for linkedin-app-showcase
 *
 * Generates Kling 3.0 + Nano Banana prompts for the "3 Ways to Vibe Code" project.
 * Handles the costumeVariants format and tri-color mode system.
 * Only generates prompts for kling_video, nano_image, and mixed renderTypes.
 *
 * Usage: node scripts/generate_prompts_linkedin.js
 */

const fs = require('fs');
const path = require('path');
const projectManager = require('./project_manager');
const { loadCanonData } = require('./prompt-template-engine');

const PROJECT_ID = 'linkedin-app-showcase';

if (!projectManager.projectExists(PROJECT_ID)) {
  console.error(`\n\u274C Error: Project '${PROJECT_ID}' not found`);
  process.exit(1);
}

// ── Load canon ────────────────────────────────────────────────────

const biblePath = projectManager.getProjectPath(PROJECT_ID, 'bible');
const canonData = loadCanonData(biblePath);
const { shotList } = canonData;
const negativePrompt = canonData.negativePrompt;

// LinkedIn generator uses plain objects for charMap (needs bracket access for getCharIdentity)
const charMap = {};
(canonData.characters.characters || []).forEach(c => { charMap[c.id] = c; });

// ── Character identity ─────────────────────────────────────────

function getCharIdentity(charId, shotId) {
  const c = charMap[charId];
  if (!c) return '';
  const b = c.physicalCore;

  // Find the costume variant used in this shot — extract visual details only
  let costumeVisual = '';
  if (c.costumeVariants) {
    const variant = c.costumeVariants.find(v => v.usedInShots && v.usedInShots.includes(shotId));
    if (variant && variant.keyDetails) {
      // Use first 2 key details (these are visual, not meta-descriptions)
      costumeVisual = variant.keyDetails.slice(0, 2).map(d => d.split(' — ')[0]).join(', ');
    }
  }

  const parts = ['Patrick, a man in his early 30s'];
  parts.push('bald shaved head');
  parts.push('dark rectangular-framed glasses');
  parts.push('clean goatee');
  parts.push(b.skinTone.split(',')[0]); // "medium-dark brown skin"
  if (costumeVisual) {
    parts.push(costumeVisual);
  }

  return parts.join(', ') + '.';
}

// ── Camera motion ─────────────────────────────────────────────

const CAM_MOTION = {
  'slow_zoom': 'Slow zoom toward subject',
  'push_in': 'Steady push in toward subject',
  'pull_back_reveal': 'Pull back revealing full environment',
  'dolly_tracking': 'Dolly tracking alongside movement',
  'orbital': 'Slow orbital rotation around subject',
  'locked_hold': 'Static camera, locked tripod',
  'n/a': 'Static camera'
};

// Kling variations
const KLING_VARS = {
  A: {
    label: 'Standard',
    adjustCam: (m) => m
  },
  B: {
    label: 'Dynamic',
    adjustCam: (m) => ({
      'slow_zoom': 'push_in',
      'push_in': 'dolly_tracking',
      'pull_back_reveal': 'push_in',
      'dolly_tracking': 'orbital',
      'orbital': 'dolly_tracking',
      'locked_hold': 'push_in',
      'n/a': 'push_in'
    }[m] || 'push_in')
  },
  C: {
    label: 'Slow/Atmospheric',
    adjustCam: (m) => ({
      'slow_zoom': 'orbital',
      'push_in': 'slow_zoom',
      'pull_back_reveal': 'orbital',
      'dolly_tracking': 'slow_zoom',
      'orbital': 'slow_zoom',
      'locked_hold': 'slow_zoom',
      'n/a': 'slow_zoom'
    }[m] || 'slow_zoom')
  }
};

// Nano Banana variations
const NANO_VARS = {
  A: { label: 'Standard', framingPrefix: '' },
  B: { label: 'Intimate Close', framingPrefix: 'Extreme close-up detail shot. ' },
  C: { label: 'Wide Cinematic', framingPrefix: 'Ultra-wide cinematic establishing shot. ' }
};

// ── Shot-specific prompt content ──────────────────────────────

const SHOT_PROMPTS = {
  SHOT_01: {
    scene: 'A man stands in a dark void between three massive glowing portals arranged in an arc. Left portal emits blue light showing a floating code editor interface. Center portal emits green light showing cascading terminal text. Right portal emits warm amber light showing a browser interface. He is centered, lit from all three sides in blue, green, and amber. Arms at sides, dead-serious expression. Dark reflective floor catches all three colors. Character select screen from a fighting game aesthetic.',
    charAction: 'standing between three glowing portals, dead-serious face, bathed in tri-color light from blue, green, and amber portals',
    mood: 'epic, dramatic, character select screen energy'
  },
  SHOT_02: {
    scene: 'Rapid flash montage across three environments. A VS Code editor with ghost code autocompleting in blue tones. A terminal window with file directories generating rapidly in green tones. A browser showing AI chat with a GitHub PR notification in warm amber tones. Each environment is distinct, punchy, fast-cut.',
    charAction: null,
    mood: 'fast, energetic, movie trailer montage'
  },
  SHOT_03: {
    scene: 'Three massive stone monoliths standing in a dark void, arranged in a triangle formation. Left monolith etched with code brackets and glowing blue from within. Center monolith etched with a terminal cursor symbol glowing green. Right monolith etched with a globe icon glowing warm amber. Dust particles float in the light. Ancient, powerful artifacts. 2001 A Space Odyssey monolith energy.',
    charAction: null,
    mood: 'ancient, sacred, reverent'
  },
  SHOT_04: {
    scene: 'A massive VS Code editor environment filling the frame. Autocomplete suggestions float out of the editor as 3D holographic panels glowing soft blue. A cursor blinks with dramatic intensity. Ghost text materializes letter by letter with shimmer effect. Lines of code stack perfectly. Everything is clean, precise, blue-tinted. Holographic code suggestions in dark space.',
    charAction: null,
    mood: 'precise, magical, blue-tinted tech'
  },
  SHOT_05: {
    scene: 'Split screen composition. Left side shows hands on a keyboard illuminated by blue monitor glow, forearms visible with sleeves pushed up. Right side shows a code editor with ghost text appearing and materializing in rhythm. Each completion creates a small pulse of blue light. The split shows human and machine partnership.',
    charAction: 'hands on keyboard, Tab-completing with rhythmic confidence in blue monitor glow',
    mood: 'rhythmic, collaborative, blue-tinted'
  },
  SHOT_07: {
    scene: 'A bright VS Code editor as a small spotlight in center of frame. Camera has pulled far back revealing the editor illuminates only ONE file. Around it, dozens of other files and system nodes float in complete darkness, disconnected, unreachable. The IDE vision is a focused blue spotlight in a vast dark workspace. The limitation is visible — powerful but scoped.',
    charAction: null,
    mood: 'focused but limited, blue spotlight in darkness'
  },
  SHOT_08: {
    scene: 'A terminal window filling an enormous cathedral-like dark space. Terminal text is massive, floating in 3D. A cursor blinks twice. A command types itself character by character with green glowing text. When Enter is pressed, a green shockwave ripples outward through the void. Green text begins cascading from the impact point like a waterfall. Cathedral arches visible in shadows. Something powerful has been awakened.',
    charAction: null,
    mood: 'ancient power awakened, green-tinted cathedral'
  },
  SHOT_09: {
    scene: 'A cinematic factory assembly line for code. Glowing raw text enters from left. It passes through processing stages lighting up in sequence — blue flash, green checkmark pulse, amber fire, white crystallization. Clean organized files emerge from right, stacking themselves into a perfect directory tree structure. The factory runs autonomously with no human hands. Dark industrial background with colorful processing stages.',
    charAction: null,
    mood: 'industrial, autonomous, factory energy'
  },
  SHOT_12: {
    scene: 'A browser window floating in dark space. Inside, an AI conversation is happening in extreme fast-forward — messages blur into streaks of amber light. Then everything stops. A green checkmark notification materializes saying PR Ready. Golden confetti explodes outward. Light rays emanate. Celebration energy for a push notification. Lottery-winner treatment for a pull request.',
    charAction: null,
    mood: 'celebration, lottery-winner energy, amber-tinted'
  },
  SHOT_13: {
    scene: 'Split screen with soft light dividing line. Left side: a man walking away from a desk, stretching, pouring coffee, looking out a window in warm natural light. Right side: simultaneously, a ghostly translucent AI agent is working — reading code, writing files, running tests in ethereal amber-green glow. The agent side speeds up as the human walks further away.',
    charAction: 'walking away from desk, stretching, pouring coffee, living life while AI agent works autonomously',
    mood: 'relaxed human vs productive agent split'
  },
  SHOT_15: {
    scene: 'Dark space with glowing clouds above. Three translucent task description cards float — labeled Add the test suite, Refactor this module, Fix the linting errors. One by one they fold into paper airplanes and launch upward into the amber glowing clouds. Small particle trails follow each airplane. The clouds glow brighter with each absorbed task. Something is working up there.',
    charAction: null,
    mood: 'playful, satisfying, paper airplanes into clouds'
  },
  SHOT_16: {
    scene: 'Three monoliths — blue, green, amber — accelerate toward each other from the edges of frame. They SLAM together in the center with a massive white impact flash. When light clears they have merged into ONE tricolor tower pulsing with blue green and amber energy flowing through it. Lightning arcs between sections. Ground cracks from impact. The tower rotates slowly, all three colors flowing together.',
    charAction: null,
    mood: 'maximum impact, Voltron assembly, tricolor fusion'
  },
  SHOT_17: {
    scene: 'A circular 24-hour clock floating in dark space. Three colored arcs light up different time segments. Morning section glows green labeled Architecture with a miniaturized factory inside. Afternoon section glows blue labeled Details with a miniaturized editor inside. Evening section glows amber labeled Async Tasks with miniaturized clouds inside. All three arcs illuminate simultaneously — complete circle of tricolor light.',
    charAction: null,
    mood: 'practical, concrete, tricolor workflow visualization'
  },
  SHOT_20: {
    scene: 'A man stands inside one of three glowing portals, looking back at the other two. The portal he is in glows warmly around him. The other two portals pulse gently with blue and green light, still inviting. He gestures toward them warmly with an open hand. The space feels warm and inviting rather than dramatic. An invitation, not a command.',
    charAction: 'inside one portal, gesturing warmly toward the other two portals, inviting expression',
    mood: 'warm, inviting, encouraging'
  },
  SHOT_22: {
    scene: 'Wide shot — a man stands between three massive glowing portals. Same position as the opening, but now ALL THREE portals are active, pulsing with blue, green, and amber light. Threads of light connect him to each portal. The portals begin to slowly orbit around him like moons around a planet. He stands connected to everything. Dead-serious face. Dark reflective floor. Maximum scope.',
    charAction: 'standing between all three active portals connected by light threads, dead-serious expression, arms slightly out',
    mood: 'triumphant, connected, earned audacity'
  }
};

// ── Build Kling prompt ────────────────────────────────────────

function buildKlingPrompt(shot, variation) {
  const v = KLING_VARS[variation];
  const movement = shot.cameraIntent.movement || 'locked_hold';
  const adjMovement = v.adjustCam(movement);
  const camStr = CAM_MOTION[adjMovement] || adjMovement;

  const shotData = SHOT_PROMPTS[shot.id];
  if (!shotData) {
    console.warn(`  \u26A0 No prompt data for ${shot.id}`);
    return null;
  }

  // Build the compact Kling prompt
  const parts = [];
  parts.push(camStr + '.');

  // Character identity if present
  if (shot.characters && shot.characters.length > 0 && shotData.charAction) {
    const charId = shot.characters[0].id;
    parts.push(getCharIdentity(charId, shot.id));
    parts.push(shotData.charAction + '.');
  }

  // Scene description (trimmed for 500 char limit)
  const sceneWords = shotData.scene.split(' ');
  let sceneStr = shotData.scene;
  if (parts.join(' ').length + sceneStr.length > 480) {
    // Trim scene to fit
    const remaining = 470 - parts.join(' ').length;
    if (remaining > 100) {
      sceneStr = sceneStr.substring(0, remaining - 3) + '...';
    } else {
      sceneStr = shotData.mood;
    }
  }
  parts.push(sceneStr);

  let prompt = parts.join(' ');
  if (prompt.length > 500) {
    prompt = prompt.substring(0, 497) + '...';
  }

  // Build full file
  const lines = [];
  lines.push(`=== SHOT ${shot.id} \u2014 Variation ${variation} (${v.label}) ===`);
  lines.push(`Shot: ${shot.id} | Section: ${shot.timing.musicSection} | Time: ${shot.timing.start}s\u2013${shot.timing.end}s (${shot.timing.duration}s)`);
  lines.push(`Version: 2026-02-11`);
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
    lines.push(shot.notes);
    lines.push('');
  }

  return { text: lines.join('\n'), promptLen: prompt.length };
}

// ── Build Nano Banana prompt ──────────────────────────────────

const NANO_PROMPTS = {
  SHOT_11: {
    title: 'Lane vs Highway Comparison',
    image1: 'Clean split-screen comparison image. Hard vertical split down the center. LEFT SIDE: A single bright blue code editor spotlight illuminating one file in a dark workspace. Dozens of other files float in darkness around it, disconnected. Small, focused. A text label reads "A lane." Blue color palette on left. RIGHT SIDE: Full flood lighting in green — an entire project workspace visible, all files connected by glowing green lines, everything lit up. Big, expansive, interconnected. A text label reads "The highway." Green color palette on right. The visual contrast between focused blue spotlight and expansive green flood light is immediate and obvious. Clean, shareable, screenshot-worthy composition.',
    image2: 'Same split-screen concept but from a different angle. LEFT: the blue IDE spotlight seen slightly from above, emphasizing how small and contained it is. RIGHT: the green CLI view seen at eye level, emphasizing its expansive scope. Same labels: "A lane" and "The highway." Same blue vs green color coding. Different perspective to show depth.'
  },
  SHOT_19: {
    title: '3x3 Tool Matrix',
    image1: 'Clean 3x3 grid materializing in dark space. Three columns labeled IDE (blue glow), CLI (green glow), WEB (amber glow) across the top. Three rows labeled Claude, Codex, Copilot down the left side. Nine cells, each illuminated with a subtle glow combining the column and row colors. Clean white grid lines separate the cells. Each cell contains a small icon or tool logo. The entire matrix pulses with golden light when complete. Dark background. Readable text. Clean design. This is the periodic table of AI coding tools. Screenshot-worthy, shareable, definitive.',
    image2: 'Same 3x3 matrix grid but with slight perspective — viewed at a gentle angle that gives it depth. The cells have a subtle 3D quality. Same labels: IDE/CLI/WEB columns in blue/green/amber. Same rows: Claude/Codex/Copilot. The golden completion pulse is captured mid-pulse. More dramatic lighting with edge glow. Still readable, still clean, slightly more cinematic angle.'
  }
};

function buildNanoPrompt(shot, variation) {
  const v = NANO_VARS[variation];
  const nanoData = NANO_PROMPTS[shot.id];
  if (!nanoData) {
    console.warn(`  \u26A0 No nano prompt data for ${shot.id}`);
    return null;
  }

  const lines = [];
  lines.push(`=== SHOT ${shot.id} \u2014 Variation ${variation} (${v.label}) ===`);
  lines.push(`Shot: ${shot.id} | Section: ${shot.timing.musicSection} | Time: ${shot.timing.start}s\u2013${shot.timing.end}s (${shot.timing.duration}s)`);
  lines.push(`Version: 2026-02-11`);
  lines.push(`Variation: ${variation}`);
  lines.push('');
  lines.push('--- NANO BANANA PROMPT ---');
  lines.push('');
  lines.push('Create 2 Images');
  lines.push(`1: ${v.framingPrefix}${nanoData.image1}`);
  lines.push('');
  lines.push(`2: ${nanoData.image2}`);
  lines.push('');
  lines.push('--- NEGATIVE PROMPT ---');
  lines.push('');
  lines.push(negativePrompt);
  lines.push('');

  if (shot.notes) {
    lines.push('--- DIRECTOR NOTES ---');
    lines.push('');
    lines.push(shot.notes);
    lines.push('');
  }

  const promptText = `${v.framingPrefix}${nanoData.image1}\n\n${nanoData.image2}`;
  return { text: lines.join('\n'), promptLen: promptText.length };
}

// ── Main ──────────────────────────────────────────────────────

function main() {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551   3 WAYS TO VIBE CODE — PROMPT GENERATOR        \u2551');
  console.log('\u2551   Kling 3.0 + Nano Banana Pro 3                 \u2551');
  console.log('\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n');

  const klingDir = projectManager.getProjectPath(PROJECT_ID, 'prompts/kling');
  const nanoDir = projectManager.getProjectPath(PROJECT_ID, 'prompts/nanobanana');

  fs.mkdirSync(klingDir, { recursive: true });
  fs.mkdirSync(nanoDir, { recursive: true });

  let klingCount = 0;
  let nanoCount = 0;
  let klingMax = 0;
  let klingOver = 0;
  const variations = ['A', 'B', 'C'];

  // Group shots by render type
  const klingShots = shotList.shots.filter(s => s.renderType === 'kling_video' || s.renderType === 'mixed');
  const nanoShots = shotList.shots.filter(s => s.renderType === 'nano_image');
  const screenShots = shotList.shots.filter(s => s.renderType === 'screen_capture');

  console.log(`Total shots: ${shotList.shots.length}`);
  console.log(`  Kling video: ${klingShots.length} shots`);
  console.log(`  Nano Banana: ${nanoShots.length} shots`);
  console.log(`  Screen capture: ${screenShots.length} shots (no prompts needed)`);
  console.log(`  Variations: A/B/C per shot\n`);

  // Generate Kling prompts
  console.log('\u2500\u2500\u2500 KLING 3.0 PROMPTS \u2500\u2500\u2500\n');

  klingShots.forEach(shot => {
    if (!SHOT_PROMPTS[shot.id]) {
      console.log(`  \u23ED ${shot.id} — no prompt data (screen recording or talking head)`);
      return;
    }

    variations.forEach(v => {
      const result = buildKlingPrompt(shot, v);
      if (!result) return;

      const filename = `shot_${String(shot.shotNumber).padStart(2, '0')}_${v}.txt`;
      fs.writeFileSync(path.join(klingDir, filename), result.text);

      if (result.promptLen > klingMax) klingMax = result.promptLen;
      if (result.promptLen > 500) klingOver++;
      klingCount++;
    });

    console.log(`  \u2713 ${shot.id} (A/B/C) — ${shot.renderType}`);
  });

  // Generate Nano Banana prompts
  console.log('\n\u2500\u2500\u2500 NANO BANANA PRO 3 PROMPTS \u2500\u2500\u2500\n');

  nanoShots.forEach(shot => {
    if (!NANO_PROMPTS[shot.id]) {
      console.log(`  \u23ED ${shot.id} — no prompt data`);
      return;
    }

    variations.forEach(v => {
      const result = buildNanoPrompt(shot, v);
      if (!result) return;

      const filename = `shot_${String(shot.shotNumber).padStart(2, '0')}_${v}.txt`;
      fs.writeFileSync(path.join(nanoDir, filename), result.text);
      nanoCount++;
    });

    console.log(`  \u2713 ${shot.id} (A/B/C) — nano_image`);
  });

  // Summary
  console.log('\n\u2500\u2500\u2500 SUMMARY \u2500\u2500\u2500\n');
  console.log(`\u2705 Kling prompts: ${klingCount} files`);
  console.log(`   Max Kling prompt: ${klingMax} chars`);
  if (klingOver > 0) {
    console.warn(`   \u26A0 ${klingOver} prompts exceed 500 char limit`);
  } else {
    console.log(`   \u2705 All Kling under 500 chars`);
  }
  console.log(`\u2705 Nano Banana prompts: ${nanoCount} files`);
  console.log(`\u23ED Screen captures: ${screenShots.length} shots (no prompts — record manually)`);
  console.log(`\nTotal prompt files: ${klingCount + nanoCount}`);
  console.log(`\nScreen recordings needed:`);
  screenShots.forEach(s => {
    console.log(`  ${s.id} — ${s.intent.what.substring(0, 80)}...`);
  });
  console.log(`\nNext: npm run index ${PROJECT_ID}\n`);
}

main();
