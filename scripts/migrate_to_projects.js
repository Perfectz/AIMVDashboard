#!/usr/bin/env node

/**
 * Migration Script - Single Project to Multi-Project Structure
 * Version: 2026-02-07
 *
 * This script migrates existing data from the single-project structure
 * to the new multi-project structure.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT_DIR, 'projects');
const DEFAULT_PROJECT_DIR = path.join(PROJECTS_DIR, 'default');

console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║   MULTI-PROJECT MIGRATION                             ║');
console.log('║   Version: 2026-02-07                                 ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

console.log('Starting migration to multi-project structure...\n');

// ===== STEP 1: Create projects directory =====
console.log('Step 1: Creating projects directory...');
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  console.log('✓ Created projects/ directory');
} else {
  console.log('⚠ projects/ directory already exists');
}

// ===== STEP 2: Create default project directory =====
console.log('\nStep 2: Creating default project directory...');
if (!fs.existsSync(DEFAULT_PROJECT_DIR)) {
  fs.mkdirSync(DEFAULT_PROJECT_DIR, { recursive: true });
  console.log('✓ Created projects/default/ directory');
} else {
  console.log('⚠ projects/default/ directory already exists');
}

// ===== STEP 3: Move existing directories to default project =====
console.log('\nStep 3: Moving existing directories to projects/default/...');

const dirsToMove = ['bible', 'reference', 'prompts', 'rendered', 'music'];
let movedCount = 0;
let skippedCount = 0;

for (const dir of dirsToMove) {
  const srcDir = path.join(ROOT_DIR, dir);
  const destDir = path.join(DEFAULT_PROJECT_DIR, dir);

  if (fs.existsSync(srcDir)) {
    if (!fs.existsSync(destDir)) {
      try {
        fs.renameSync(srcDir, destDir);
        console.log(`✓ Moved ${dir}/ to projects/default/`);
        movedCount++;
      } catch (err) {
        console.error(`✗ Failed to move ${dir}/: ${err.message}`);
      }
    } else {
      console.log(`⚠ ${dir}/ already exists in projects/default/, skipping`);
      skippedCount++;
    }
  } else {
    console.log(`ℹ ${dir}/ does not exist in root, skipping`);
  }
}

// ===== STEP 4: Create project.json =====
console.log('\nStep 4: Creating project.json...');

const projectJsonPath = path.join(DEFAULT_PROJECT_DIR, 'project.json');

if (!fs.existsSync(projectJsonPath)) {
  const now = new Date().toISOString();

  // Try to read existing sequence.json for metadata
  let projectName = 'My First Music Video';
  let musicData = {
    songTitle: '',
    artist: '',
    duration: 0,
    bpm: 0,
    sections: []
  };

  const sequencePath = path.join(DEFAULT_PROJECT_DIR, 'rendered', 'storyboard', 'sequence.json');
  if (fs.existsSync(sequencePath)) {
    try {
      const sequenceData = JSON.parse(fs.readFileSync(sequencePath, 'utf8'));
      if (sequenceData.projectName) {
        projectName = sequenceData.projectName;
      }
      if (sequenceData.totalShots) {
        // We'll count this below
      }
    } catch (err) {
      console.warn('Warning: Could not read sequence.json:', err.message);
    }
  }

  const projectMeta = {
    id: 'default',
    name: projectName,
    description: 'Migrated from single-project structure',
    createdAt: now,
    lastModified: now,
    music: musicData,
    visualStyle: {
      genre: '',
      colorPalette: [],
      themes: []
    },
    stats: {
      totalShots: 0,
      renderedShots: 0,
      selectedShots: 0,
      totalDuration: 0
    }
  };

  fs.writeFileSync(projectJsonPath, JSON.stringify(projectMeta, null, 2), 'utf8');
  console.log('✓ Created projects/default/project.json');
} else {
  console.log('⚠ projects/default/project.json already exists, skipping');
}

// ===== STEP 5: Ensure sequence.json exists =====
console.log('\nStep 5: Verifying storyboard sequence.json...');

const storyboardDir = path.join(DEFAULT_PROJECT_DIR, 'rendered', 'storyboard');
const sequenceJsonPath = path.join(storyboardDir, 'sequence.json');

if (!fs.existsSync(storyboardDir)) {
  fs.mkdirSync(storyboardDir, { recursive: true });
  console.log('✓ Created rendered/storyboard/ directory');
}

if (!fs.existsSync(sequenceJsonPath)) {
  const now = new Date().toISOString();
  const sequenceData = {
    version: '2026-02-07',
    projectName: 'My First Music Video',
    totalShots: 0,
    totalDuration: 0,
    musicFile: '',
    selections: [],
    lastUpdated: now
  };

  fs.writeFileSync(sequenceJsonPath, JSON.stringify(sequenceData, null, 2), 'utf8');
  console.log('✓ Created rendered/storyboard/sequence.json');
} else {
  console.log('✓ rendered/storyboard/sequence.json exists');
}

// ===== STEP 6: Create projects_index.json =====
console.log('\nStep 6: Creating projects_index.json...');

const indexPath = path.join(PROJECTS_DIR, 'projects_index.json');

if (!fs.existsSync(indexPath)) {
  const now = new Date().toISOString();

  const indexData = {
    version: '2026-02-07',
    activeProject: 'default',
    projects: [
      {
        id: 'default',
        name: 'My First Music Video',
        createdAt: now,
        lastModified: now,
        status: 'active'
      }
    ]
  };

  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf8');
  console.log('✓ Created projects/projects_index.json');
} else {
  console.log('⚠ projects/projects_index.json already exists, skipping');
}

// ===== SUMMARY =====
console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║   MIGRATION COMPLETE                                  ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

console.log('Summary:');
console.log(`  - Directories moved: ${movedCount}`);
console.log(`  - Directories skipped: ${skippedCount}`);
console.log(`  - Project created: projects/default/`);
console.log(`  - Projects index created: projects/projects_index.json`);

console.log('\nNext steps:');
console.log('  1. Restart the server: npm run serve');
console.log('  2. Visit http://localhost:8000/');
console.log('  3. Verify your existing data appears under "My First Music Video"');
console.log('  4. Use the "+ New Project" button to create additional projects');
console.log('  5. Update prompts_index.json by running: npm run index\n');

console.log('🎉 Multi-project support is now active!\n');
