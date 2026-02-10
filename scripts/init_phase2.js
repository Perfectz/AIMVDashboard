#!/usr/bin/env node

/**
 * Phase 2 Initializer - Captures song metadata and creates beat map scaffold
 * Version: 2026-02-07
 *
 * Run this script after:
 * 1. Music has been generated in Suno
 * 2. You know the song duration
 * 3. You've identified section timestamps
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const projectManager = require('./project_manager');

const projectId = process.argv[2] || projectManager.getActiveProject();
if (!projectManager.projectExists(projectId)) {
  console.error(`\nError: Project '${projectId}' not found.`);
  console.error('Usage: npm run init-phase2 -- <project-id>\n');
  process.exit(1);
}

const PROJECT_PATH = projectManager.getProjectPath(projectId, 'project.json');
const BEAT_MAP_PATH = projectManager.getProjectPath(projectId, 'rendered/storyboard/beat_map.json');
const SHOT_PLAN_PATH = projectManager.getProjectPath(projectId, 'rendered/storyboard/shot_plan.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   PHASE 2 INITIALIZATION                     ║');
  console.log('║   Version: 2026-02-07                        ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  console.log('This script captures song metadata and creates scaffolds for Phase 2.\n');
  console.log('Prerequisites:');
  console.log('  ✓ Music generated in Suno');
  console.log('  ✓ Song duration known');
  console.log('  ✓ Section timestamps identified\n');

  const proceed = await question('Ready to proceed? (yes/no): ');
  if (proceed.toLowerCase() !== 'yes') {
    console.log('\nCancelled. Run this script when ready.\n');
    rl.close();
    return;
  }

  console.log('\n─────────────────────────────────────────────\n');
  console.log('SONG METADATA\n');

  const duration = await question('Song duration in seconds (e.g., 180): ');
  const bpm = await question('BPM (optional, press Enter to skip): ');

  console.log('\n─────────────────────────────────────────────\n');
  console.log('SONG SECTIONS\n');
  console.log('Enter sections with timestamps. Format: name,start,end,mood');
  console.log('Example: intro,0,30,contemplative');
  console.log('Type "done" when finished.\n');

  const sections = [];
  let sectionIndex = 1;

  while (true) {
    const input = await question(`Section ${sectionIndex}: `);
    if (input.toLowerCase() === 'done') {
      break;
    }

    const parts = input.split(',').map(s => s.trim());
    if (parts.length < 3) {
      console.log('Invalid format. Use: name,start,end[,mood]');
      continue;
    }

    sections.push({
      name: parts[0],
      start: parseFloat(parts[1]),
      end: parseFloat(parts[2]),
      mood: parts[3] || ''
    });

    sectionIndex++;
  }

  console.log('\n─────────────────────────────────────────────\n');
  console.log('SUMMARY\n');
  console.log(`Duration: ${duration}s`);
  if (bpm) console.log(`BPM: ${bpm}`);
  console.log(`Sections: ${sections.length}\n`);

  sections.forEach(s => {
    console.log(`  ${s.name} (${s.start}s - ${s.end}s) ${s.mood ? `[${s.mood}]` : ''}`);
  });

  console.log('\n─────────────────────────────────────────────\n');

  const confirm = await question('Save this data? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('\nCancelled.\n');
    rl.close();
    return;
  }

  // Update project.json
  const project = JSON.parse(fs.readFileSync(PROJECT_PATH, 'utf8'));
  project.music = {
    duration: parseFloat(duration),
    bpm: bpm ? parseFloat(bpm) : null,
    sections: sections
  };
  if (project.project && typeof project.project === 'object') {
    project.project.phase = '2_PRODUCTION';
  } else {
    project.phase = '2_PRODUCTION';
  }
  fs.writeFileSync(PROJECT_PATH, JSON.stringify(project, null, 2));
  console.log(`\n✅ Updated ${PROJECT_PATH}`);

  // Create beat_map.json
  const beatMap = {
    version: new Date().toISOString().split('T')[0],
    songDuration: parseFloat(duration),
    bpm: bpm ? parseFloat(bpm) : null,
    sections: sections,
    shotPlanning: {
      defaultShotDuration: 8,
      totalShots: Math.floor(parseFloat(duration) / 8),
      notes: 'Plan shots in 8-second increments aligned with music sections'
    }
  };
  fs.writeFileSync(BEAT_MAP_PATH, JSON.stringify(beatMap, null, 2));
  console.log(`✅ Created ${BEAT_MAP_PATH}`);

  // Create shot_plan.json scaffold
  const shotPlan = {
    version: new Date().toISOString().split('T')[0],
    _TODO: 'Fill in shot intents for each shot. Use storyboard/example_shot_intent.json as template.',
    totalShots: Math.floor(parseFloat(duration) / 8),
    shots: []
  };

  // Generate shot scaffolds
  let currentTime = 0;
  let shotNumber = 1;
  while (currentTime < parseFloat(duration)) {
    const shotDuration = 8;
    const section = sections.find(s => currentTime >= s.start && currentTime < s.end);

    shotPlan.shots.push({
      id: `SHOT_${String(shotNumber).padStart(2, '0')}`,
      shotNumber,
      timing: {
        start: currentTime,
        duration: shotDuration,
        end: Math.min(currentTime + shotDuration, parseFloat(duration)),
        musicSection: section ? section.name : 'unknown'
      },
      intent: {
        what: 'TODO: What happens in this shot',
        why: 'TODO: Purpose of this shot',
        emotionalBeat: section ? section.mood : 'TODO'
      },
      characters: [],
      location: {
        id: 'TODO: LOC_*'
      },
      cameraIntent: {
        feeling: 'TODO',
        movement: 'TODO',
        focus: 'subject'
      },
      status: 'draft'
    });

    currentTime += shotDuration;
    shotNumber++;
  }

  fs.writeFileSync(SHOT_PLAN_PATH, JSON.stringify(shotPlan, null, 2));
  console.log(`✅ Created ${SHOT_PLAN_PATH} with ${shotPlan.shots.length} shot scaffolds`);

  console.log('\n─────────────────────────────────────────────\n');
  console.log('PHASE 2 INITIALIZED\n');
  console.log('Next steps:');
  console.log('  1. Fill in bible/characters.json with actual character data');
  console.log('  2. Fill in bible/locations.json with actual location data');
  console.log('  3. Create reference images in reference/characters/ and reference/locations/');
  console.log(`  4. Fill in shot intents in ${SHOT_PLAN_PATH}`);
  console.log('  5. Run prompt compilation (TBD in Phase 2)');
  console.log('\n');

  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
