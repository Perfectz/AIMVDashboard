#!/usr/bin/env node

/**
 * Image Generator — SeedDream v4.5 via Replicate API
 * Version: 2026-02-08
 *
 * Two modes:
 *   Character reference: npm run generate -- <project> --character CHAR_HER --slot 1
 *   Arbitrary prompt:    npm run generate -- <project> --prompt "A cyberpunk city"
 */

const fs = require('fs');
const path = require('path');
const projectManager = require('./project_manager');
const replicate = require('./replicate_client');

// ── Parse arguments ──────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

if (hasFlag('help') || args.length === 0) {
  console.log(`
╔═══════════════════════════════════════════════╗
║   IMAGE GENERATOR (SeedDream v4.5)            ║
║   Version: 2026-02-08                         ║
╚═══════════════════════════════════════════════╝

Usage:
  npm run generate -- <project-id> [options]

Character Reference Mode:
  npm run generate -- where-time-breaks --character CHAR_HER --slot 1
  Reads prompt from: reference/characters/CHAR_HER/prompt_01.txt
  Saves image to:    reference/characters/CHAR_HER/generated_01.png

Arbitrary Prompt Mode:
  npm run generate -- where-time-breaks --prompt "A cyberpunk city at night"
  Saves image to:    rendered/generated/<timestamp>.png

  npm run generate -- where-time-breaks --prompt "A city" --output my_image.png
  Saves image to:    rendered/generated/my_image.png

Options:
  --character <id>       Character ID (e.g., CHAR_HER, CHAR_HIM)
  --slot <1|2|3>         Prompt slot number (1=Identity, 2=Full Body, 3=Action)
  --prompt <text>        Arbitrary prompt text
  --file <path>          Read prompt from a file instead
  --output <filename>    Output filename (arbitrary mode only)
  --size <2K|4K>         Image resolution (default: 2K)
  --aspect-ratio <ratio> Aspect ratio (default: 3:4 for chars, 16:9 for arbitrary)
  --count <n>            Number of images to generate (default: 1)
  --sequential           Enable sequential image generation (model decides count)
  --help                 Show this help
`);
  process.exit(0);
}

// First non-flag argument is the project ID
const projectId = args.find(a => !a.startsWith('--') && args.indexOf(a) === 0) || 'default';

// ── Validate project ─────────────────────────────────────────────

if (!projectManager.projectExists(projectId)) {
  console.error(`\n\u274C Error: Project '${projectId}' not found`);
  console.error('   Available projects:');
  projectManager.listProjects().forEach(p => {
    console.error(`   - ${p.id}: ${p.name}`);
  });
  console.error('\nUsage: npm run generate -- <project-id> [options]\n');
  process.exit(1);
}

// ── Determine mode ───────────────────────────────────────────────

const characterId = getFlag('character');
const slotNum = getFlag('slot') ? parseInt(getFlag('slot')) : null;
const promptText = getFlag('prompt');
const promptFile = getFlag('file');
const outputName = getFlag('output');
const size = getFlag('size') || '2K';
const aspectRatio = getFlag('aspect-ratio');
const count = getFlag('count') ? parseInt(getFlag('count')) : 1;
const sequential = hasFlag('sequential');

let mode = null;
if (characterId && slotNum) {
  mode = 'character';
} else if (promptText || promptFile) {
  mode = 'arbitrary';
} else {
  console.error('\n\u274C Error: Must specify either --character + --slot, or --prompt / --file');
  console.error('Run with --help for usage.\n');
  process.exit(1);
}

// ── Main execution ───────────────────────────────────────────────

async function main() {
  console.log(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551   IMAGE GENERATOR (SeedDream v4.5)            \u2551
\u2551   Version: 2026-02-08                         \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D
`);

  const project = projectManager.getProject(projectId);
  console.log(`Project: ${project.name} (${projectId})`);

  // Validate token
  try {
    replicate.loadApiToken();
    console.log('API Token: \u2705 configured\n');
  } catch (err) {
    console.error(`\n\u274C ${err.message}`);
    process.exit(1);
  }

  let prompt = '';
  let savePath = '';

  if (mode === 'character') {
    console.log(`Mode: Character Reference`);
    console.log(`Character: ${characterId}`);

    const SLOT_LABELS = ['Identity Portrait', 'Full Body / Outfit', 'Action / Emotion'];
    console.log(`Slot: ${slotNum} (${SLOT_LABELS[slotNum - 1] || 'Unknown'})\n`);

    // Validate character exists
    const charDir = projectManager.getProjectPath(projectId, `reference/characters/${characterId}`);
    if (!fs.existsSync(charDir)) {
      console.error(`\u274C Character '${characterId}' not found in project.`);
      const refDir = projectManager.getProjectPath(projectId, 'reference/characters');
      if (fs.existsSync(refDir)) {
        const chars = fs.readdirSync(refDir).filter(f =>
          fs.statSync(path.join(refDir, f)).isDirectory()
        );
        if (chars.length > 0) {
          console.error('   Available characters:');
          chars.forEach(c => console.error(`   - ${c}`));
        }
      }
      process.exit(1);
    }

    // Read prompt file
    const promptPath = path.join(charDir, `prompt_0${slotNum}.txt`);
    if (!fs.existsSync(promptPath)) {
      console.error(`\u274C No prompt_0${slotNum}.txt found for ${characterId}`);
      process.exit(1);
    }

    prompt = fs.readFileSync(promptPath, 'utf-8').trim();
    savePath = path.join(charDir, `generated_0${slotNum}.png`);

    console.log(`Reading prompt: reference/characters/${characterId}/prompt_0${slotNum}.txt`);
    console.log(`Prompt length: ${prompt.length} characters`);
    console.log(`Output: reference/characters/${characterId}/generated_0${slotNum}.png\n`);

  } else {
    console.log(`Mode: Arbitrary Prompt\n`);

    if (promptFile) {
      const filePath = path.isAbsolute(promptFile)
        ? promptFile
        : path.join(process.cwd(), promptFile);
      if (!fs.existsSync(filePath)) {
        console.error(`\u274C Prompt file not found: ${promptFile}`);
        process.exit(1);
      }
      prompt = fs.readFileSync(filePath, 'utf-8').trim();
      console.log(`Reading prompt from: ${promptFile}`);
    } else {
      prompt = promptText;
      console.log(`Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}"`);
    }

    console.log(`Prompt length: ${prompt.length} characters`);

    const genDir = projectManager.getProjectPath(projectId, 'rendered/generated');
    if (!fs.existsSync(genDir)) {
      fs.mkdirSync(genDir, { recursive: true });
    }

    const filename = outputName || `gen_${Date.now()}.png`;
    savePath = path.join(genDir, filename);
    console.log(`Output: rendered/generated/${filename}\n`);
  }

  // Build options
  const options = { size };
  if (aspectRatio) {
    options.aspect_ratio = aspectRatio;
  } else {
    options.aspect_ratio = mode === 'character' ? '3:4' : '16:9';
  }
  if (count > 1) {
    options.max_images = count;
  }
  if (sequential) {
    options.sequential_image_generation = 'auto';
  }

  console.log(`Settings: size=${options.size}, aspect_ratio=${options.aspect_ratio}, count=${count}${sequential ? ', sequential=auto' : ''}`);
  console.log('');

  // Generate
  const spinner = ['|', '/', '-', '\\'];
  let spinIdx = 0;
  let lastStatus = '';

  const statusInterval = setInterval(() => {
    process.stdout.write(`\r  ${spinner[spinIdx++ % 4]} Generating... ${lastStatus}`);
  }, 200);

  try {
    const result = await replicate.createPrediction(prompt, options, (status) => {
      lastStatus = status;
    });

    clearInterval(statusInterval);
    process.stdout.write('\r' + ' '.repeat(60) + '\r');

    console.log(`\u2705 Generation succeeded! (${result.duration.toFixed(1)}s)\n`);

    // Download image(s)
    const outputs = Array.isArray(result.output) ? result.output : [result.output];

    for (let i = 0; i < outputs.length; i++) {
      const url = outputs[i];
      let imgPath = savePath;
      if (i > 0) {
        const ext = path.extname(savePath);
        const base = savePath.slice(0, -ext.length);
        imgPath = `${base}_${String.fromCharCode(98 + i)}${ext}`; // _b, _c, _d...
      }

      process.stdout.write(`  Downloading image ${i + 1}/${outputs.length}...`);
      const { size: fileSize } = await replicate.downloadImage(url, imgPath);
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      console.log(` \u2705 saved (${sizeMB} MB)`);
      console.log(`  \u2192 ${path.relative(projectManager.getProjectPath(projectId), imgPath)}`);
    }

    console.log('\n\u2705 Done!\n');

  } catch (err) {
    clearInterval(statusInterval);
    process.stdout.write('\r' + ' '.repeat(60) + '\r');
    console.error(`\n\u274C Generation failed: ${err.message}\n`);
    process.exit(1);
  }
}

main();
