#!/usr/bin/env node

/**
 * Index Generator - Scans prompt files and generates prompts_index.json for UI
 * Version: 2026-02-07 (Multi-Project Support)
 */

const fs = require('fs');
const path = require('path');
const projectManager = require('./project_manager');

// Get project ID from CLI args or use default
const projectId = process.argv[2] || 'default';

// Verify project exists
if (!projectManager.projectExists(projectId)) {
  console.error(`\n❌ Error: Project '${projectId}' not found`);
  console.error('   Available projects:');
  projectManager.listProjects().forEach(p => {
    console.error(`   - ${p.id}: ${p.name}`);
  });
  console.error('\nUsage: npm run index [project-id]\n');
  process.exit(1);
}

const PROMPTS_DIR = projectManager.getProjectPath(projectId, 'prompts');
const OUTPUT_PATH = path.join(projectManager.getProjectPath(projectId), 'prompts_index.json');
const LINT_REPORT_PATH = path.join(projectManager.getProjectPath(projectId, 'lint'), 'report.json');

/**
 * Parse metadata from prompt file content
 */
function parsePromptMetadata(content, filename) {
  const metadata = {
    version: null,
    created: null,
    shotId: null,
    variation: null
  };

  // Extract version
  const versionMatch = content.match(/Version:\s*(\d{4}-\d{2}-\d{2})/i);
  if (versionMatch) {
    metadata.version = versionMatch[1];
  }

  // Extract created date
  const createdMatch = content.match(/Created:\s*(\d{4}-\d{2}-\d{2})/i);
  if (createdMatch) {
    metadata.created = createdMatch[1];
  }

  // Extract shot ID
  const shotMatch = content.match(/Shot(?:\s+ID)?:\s*(SHOT_\d+)/i);
  if (shotMatch) {
    metadata.shotId = shotMatch[1];
  }

  // Extract variation
  const variationMatch = content.match(/Variation:\s*([A-D])/i);
  if (variationMatch) {
    metadata.variation = variationMatch[1];
  }

  // Try to infer from filename if not found in content
  if (!metadata.shotId) {
    const filenameMatch = filename.match(/(SHOT_\d+)/);
    if (filenameMatch) {
      metadata.shotId = filenameMatch[1];
    }
  }

  if (!metadata.variation) {
    const filenameMatch = filename.match(/option_([A-D])/i);
    if (filenameMatch) {
      metadata.variation = filenameMatch[1].toUpperCase();
    }
  }

  return metadata;
}

/**
 * Scan prompts directory and collect prompt files
 */
function scanPrompts() {
  const tools = ['kling', 'nanobanana', 'suno'];
  const allPrompts = [];

  tools.forEach(tool => {
    const toolDir = path.join(PROMPTS_DIR, tool);
    if (!fs.existsSync(toolDir)) {
      return;
    }

    const files = fs.readdirSync(toolDir);
    files.forEach(file => {
      // Skip template files
      if (file.startsWith('_')) {
        return;
      }

      if (file.endsWith('.txt') || file.endsWith('.md')) {
        const filePath = path.join(toolDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const metadata = parsePromptMetadata(content, file);

        allPrompts.push({
          tool,
          filename: file,
          path: `prompts/${tool}/${file}`,
          ...metadata,
          size: content.length,
          preview: content.substring(0, 200).replace(/\n/g, ' ').trim() + '...'
        });
      }
    });
  });

  return allPrompts;
}

/**
 * Load lint report if available
 */
function loadLintReport() {
  if (!fs.existsSync(LINT_REPORT_PATH)) {
    return null;
  }

  try {
    const report = JSON.parse(fs.readFileSync(LINT_REPORT_PATH, 'utf8'));
    return report;
  } catch (err) {
    console.warn('Warning: Could not load lint report:', err.message);
    return null;
  }
}

/**
 * Merge lint status into prompts
 */
function mergeLintStatus(prompts, lintReport) {
  if (!lintReport || !lintReport.promptValidation) {
    return prompts;
  }

  const lintMap = {};
  lintReport.promptValidation.forEach(result => {
    lintMap[result.file] = {
      status: result.status,
      errors: result.errors || [],
      warnings: result.warnings || []
    };
  });

  return prompts.map(prompt => {
    const lintStatus = lintMap[prompt.path];
    if (lintStatus) {
      return {
        ...prompt,
        lintStatus: lintStatus.status,
        lintErrors: lintStatus.errors.length,
        lintWarnings: lintStatus.warnings.length
      };
    }
    return {
      ...prompt,
      lintStatus: 'UNKNOWN',
      lintErrors: 0,
      lintWarnings: 0
    };
  });
}

/**
 * Group prompts by shot
 */
function groupByShot(prompts) {
  const shotMap = {};

  prompts.forEach(prompt => {
    const shotId = prompt.shotId || 'UNKNOWN';
    if (!shotMap[shotId]) {
      shotMap[shotId] = {
        shotId,
        variations: {}
      };
    }

    const tool = prompt.tool;
    if (!shotMap[shotId].variations[tool]) {
      shotMap[shotId].variations[tool] = [];
    }

    shotMap[shotId].variations[tool].push(prompt);
  });

  return Object.values(shotMap).sort((a, b) => {
    return a.shotId.localeCompare(b.shotId);
  });
}

/**
 * Generate index
 */
function generateIndex() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   PROMPT INDEX GENERATOR             ║');
  console.log('║   Version: 2026-02-07                ║');
  console.log('╚═══════════════════════════════════════╝\n');

  console.log('Scanning prompts directory...\n');

  const prompts = scanPrompts();
  console.log(`Found ${prompts.length} prompt files\n`);

  const lintReport = loadLintReport();
  const promptsWithLint = mergeLintStatus(prompts, lintReport);

  const shotGroups = groupByShot(promptsWithLint);

  const index = {
    generated: new Date().toISOString(),
    version: '2026-02-07',
    totalPrompts: prompts.length,
    totalShots: shotGroups.length,
    tools: {
      kling: prompts.filter(p => p.tool === 'kling').length,
      nanobanana: prompts.filter(p => p.tool === 'nanobanana').length,
      suno: prompts.filter(p => p.tool === 'suno').length
    },
    shots: shotGroups,
    allPrompts: promptsWithLint
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2));
  const project = projectManager.getProject(projectId);
  console.log(`✅ Index generated for project: ${project.name} (${projectId})`);
  console.log(`   Output: ${OUTPUT_PATH}`);
  console.log(`\nTotal shots: ${shotGroups.length}`);
  console.log(`Total prompts: ${prompts.length}`);
  console.log(`  - Kling: ${index.tools.kling}`);
  console.log(`  - Nano Banana: ${index.tools.nanobanana}`);
  console.log(`  - Suno: ${index.tools.suno}\n`);

  if (prompts.length === 0) {
    console.log('ℹ️  No prompts found. This is expected in Phase 1.');
    console.log('   Prompts will be generated in Phase 2.\n');
  }
}

// Run generator
generateIndex();
