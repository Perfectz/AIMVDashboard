#!/usr/bin/env node

/**
 * Basic Prompt Generator
 * Version: 2026-02-12
 *
 * Generates practical Kling + Nano Banana prompts from lightweight canon files.
 * Use this for projects that do not have the advanced character/location schema.
 *
 * Usage: node scripts/generate_prompts_basic.js [project-id]
 */

const fs = require('fs');
const path = require('path');
const projectManager = require('./project_manager');
const { loadCanonData, characterPhrase: sharedCharPhrase, locationPhrase: sharedLocPhrase, writePromptFile, buildPromptHeader, extractTiming } = require('./prompt-template-engine');

const projectId = process.argv[2] || projectManager.getActiveProject();

if (!projectManager.projectExists(projectId)) {
  console.error(`\nError: Project '${projectId}' not found.`);
  process.exit(1);
}

const biblePath = projectManager.getProjectPath(projectId, 'bible');
const { shotList, charMap, locMap, negativePrompt } = loadCanonData(biblePath);

if (!Array.isArray(shotList.shots) || shotList.shots.length === 0) {
  console.error('\nError: bible/shot_list.json has no shots defined.\n');
  process.exit(1);
}

const KLING_VARIATIONS = {
  A: { label: 'Standard', camera: 'steady cinematic camera, natural movement' },
  B: { label: 'Dynamic', camera: 'more dynamic movement, push-in or tracking energy' },
  C: { label: 'Atmospheric', camera: 'slower cinematic glides, mood-forward framing' }
};

const NANO_VARIATIONS = {
  A: { label: 'Standard', framing: 'balanced framing' },
  B: { label: 'Close Detail', framing: 'closer framing with stronger subject detail' },
  C: { label: 'Wide Context', framing: 'wider framing emphasizing environment context' }
};

function characterPhrase(charRefs) {
  return sharedCharPhrase(charRefs, charMap);
}

function locationPhrase(shot) {
  return sharedLocPhrase(shot, locMap);
}

function buildKlingPrompt(shot, variationKey) {
  const v = KLING_VARIATIONS[variationKey];
  const what = shot.intent && shot.intent.what ? shot.intent.what : 'Visual metaphor supporting narration';
  const why = shot.intent && shot.intent.why ? shot.intent.why : 'Support key point in script';
  const emotionalBeat = shot.intent && shot.intent.emotionalBeat ? shot.intent.emotionalBeat : 'focused';

  return [
    `${v.camera}.`,
    `B-roll only, no talking head, no direct-to-camera speaking.`,
    `Scene: ${what}.`,
    `Purpose: ${why}.`,
    `Mood: ${emotionalBeat}.`,
    `Characters: ${characterPhrase(shot.characters)}`,
    `Location: ${locationPhrase(shot)}`,
    'Photorealistic cinematic style, natural lighting transitions, coherent motion over the shot duration.'
  ].join(' ');
}

function buildNanoPrompt(shot, variationKey) {
  const v = NANO_VARIATIONS[variationKey];
  const what = shot.intent && shot.intent.what ? shot.intent.what : 'Visual metaphor supporting narration';
  const emotionalBeat = shot.intent && shot.intent.emotionalBeat ? shot.intent.emotionalBeat : 'focused';

  const image1 = `${v.framing}. Establishing frame: ${what}. ${locationPhrase(shot)} Mood is ${emotionalBeat}.`;
  const image2 = `Same scene continuity, subtle progression in action and emotion. Keep identity, wardrobe, and environment consistent with image 1.`;

  return `Create 2 Images\n1: ${image1}\n\n2: ${image2}`;
}


function main() {
  const project = projectManager.getProject(projectId);
  const klingDir = projectManager.getProjectPath(projectId, 'prompts/kling');
  const nanoDir = projectManager.getProjectPath(projectId, 'prompts/nanobanana');

  fs.mkdirSync(klingDir, { recursive: true });
  fs.mkdirSync(nanoDir, { recursive: true });

  let klingCount = 0;
  let nanoCount = 0;
  const variations = ['A', 'B', 'C'];

  console.log(`\nBasic compiler for ${project.name} (${projectId})`);
  console.log(`Shots: ${shotList.shots.length}`);

  shotList.shots.forEach((shot, idx) => {
    const t = extractTiming(shot, idx);

    variations.forEach((v) => {
      const klingHeader = buildPromptHeader({ shotId: t.shotId, variation: v, label: KLING_VARIATIONS[v].label, section: t.section, start: t.start, end: t.end, duration: t.duration, toolLabel: 'KLING PROMPT', version: '2026-02-12' });
      const klingPrompt = buildKlingPrompt(shot, v);
      const klingFile = path.join(klingDir, `shot_${t.shotNumber}_${v}.txt`);
      writePromptFile(klingFile, klingHeader, klingPrompt, negativePrompt, shot.notes || '');
      klingCount++;

      const nanoHeader = buildPromptHeader({ shotId: t.shotId, variation: v, label: NANO_VARIATIONS[v].label, section: t.section, start: t.start, end: t.end, duration: t.duration, toolLabel: 'NANO BANANA PROMPT', version: '2026-02-12' });
      const nanoPrompt = buildNanoPrompt(shot, v);
      const nanoFile = path.join(nanoDir, `shot_${t.shotNumber}_${v}.txt`);
      writePromptFile(nanoFile, nanoHeader, nanoPrompt, negativePrompt, shot.notes || '');
      nanoCount++;
    });
  });

  console.log(`Generated ${klingCount} Kling prompts + ${nanoCount} Nano Banana prompts.`);
  console.log(`Next: npm run index ${projectId}\n`);
}

main();

