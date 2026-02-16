#!/usr/bin/env node

/**
 * Index Generator - Scans prompt files and generates prompts_index.json
 * Version: 2026-02-15
 */

const fs = require('fs');
const path = require('path');
const projectManager = require('./project_manager');

function parsePromptMetadata(content, filename) {
  const metadata = {
    version: null,
    created: null,
    shotId: null,
    variation: null
  };

  const versionMatch = content.match(/Version:\s*(\d{4}-\d{2}-\d{2})/i);
  if (versionMatch) metadata.version = versionMatch[1];

  const createdMatch = content.match(/Created:\s*(\d{4}-\d{2}-\d{2})/i);
  if (createdMatch) metadata.created = createdMatch[1];

  const shotMatch = content.match(/Shot(?:\s+ID)?:\s*(SHOT_\d+)/i);
  if (shotMatch) metadata.shotId = shotMatch[1];

  const variationMatch = content.match(/Variation:\s*([A-D])/i);
  if (variationMatch) metadata.variation = variationMatch[1];

  if (!metadata.shotId) {
    const fromFilename = filename.match(/(SHOT_\d+)/);
    if (fromFilename) metadata.shotId = fromFilename[1];
  }

  if (!metadata.variation) {
    const fromFilename = filename.match(/(?:option_|_)([A-D])(?:\.|$)/i);
    if (fromFilename) metadata.variation = fromFilename[1].toUpperCase();
  }

  return metadata;
}

function scanPrompts(promptsDir, tools) {
  const allPrompts = [];

  tools.forEach((tool) => {
    const toolDir = path.join(promptsDir, tool);
    if (!fs.existsSync(toolDir)) return;

    const files = fs.readdirSync(toolDir);
    files.forEach((file) => {
      if (file.startsWith('_')) return;
      if (!file.endsWith('.txt') && !file.endsWith('.md')) return;

      const filePath = path.join(toolDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const metadata = parsePromptMetadata(content, file);

      allPrompts.push({
        tool,
        filename: file,
        path: `prompts/${tool}/${file}`,
        ...metadata,
        size: content.length,
        preview: `${content.substring(0, 200).replace(/\n/g, ' ').trim()}...`
      });
    });
  });

  return allPrompts;
}

function loadLintReport(lintReportPath) {
  if (!fs.existsSync(lintReportPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(lintReportPath, 'utf8'));
  } catch {
    return null;
  }
}

function mergeLintStatus(prompts, lintReport) {
  if (!lintReport || !Array.isArray(lintReport.promptValidation)) {
    return prompts.map((prompt) => ({
      ...prompt,
      lintStatus: 'UNKNOWN',
      lintErrors: 0,
      lintWarnings: 0
    }));
  }

  const lintMap = new Map();
  lintReport.promptValidation.forEach((result) => {
    if (!result || !result.file) return;
    lintMap.set(result.file, {
      status: result.status || 'UNKNOWN',
      errors: Array.isArray(result.errors) ? result.errors : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : []
    });
  });

  return prompts.map((prompt) => {
    const lint = lintMap.get(prompt.path);
    if (!lint) {
      return {
        ...prompt,
        lintStatus: 'UNKNOWN',
        lintErrors: 0,
        lintWarnings: 0
      };
    }
    return {
      ...prompt,
      lintStatus: lint.status,
      lintErrors: lint.errors.length,
      lintWarnings: lint.warnings.length
    };
  });
}

function groupByShot(prompts) {
  const shotMap = new Map();

  prompts.forEach((prompt) => {
    const shotId = prompt.shotId || 'UNKNOWN';
    if (!shotMap.has(shotId)) {
      shotMap.set(shotId, {
        shotId,
        variations: {}
      });
    }
    const group = shotMap.get(shotId);
    if (!group.variations[prompt.tool]) {
      group.variations[prompt.tool] = [];
    }
    group.variations[prompt.tool].push(prompt);
  });

  return Array.from(shotMap.values()).sort((a, b) => a.shotId.localeCompare(b.shotId));
}

function runGenerateIndex(projectId, options = {}) {
  const resolvedProjectId = String(projectId || projectManager.getActiveProject() || 'default').trim();
  const quiet = Boolean(options.quiet);
  const log = (...args) => { if (!quiet) console.log(...args); };

  if (!projectManager.projectExists(resolvedProjectId)) {
    return {
      success: false,
      projectId: resolvedProjectId,
      error: `Project '${resolvedProjectId}' not found`
    };
  }

  try {
    const projectPath = projectManager.getProjectPath(resolvedProjectId);
    const promptsDir = path.join(projectPath, 'prompts');
    const outputPath = path.join(projectPath, 'prompts_index.json');
    const lintReportPath = path.join(projectPath, 'lint', 'report.json');
    const tools = Array.isArray(options.tools) && options.tools.length > 0
      ? options.tools
      : ['kling', 'nanobanana', 'suno', 'seedream'];

    log('');
    log('----------------------------------------');
    log('PROMPT INDEX GENERATOR');
    log(`Project: ${resolvedProjectId}`);
    log('----------------------------------------');

    const prompts = scanPrompts(promptsDir, tools);
    const lintReport = loadLintReport(lintReportPath);
    const promptsWithLint = mergeLintStatus(prompts, lintReport);
    const shots = groupByShot(promptsWithLint);

    const index = {
      generated: new Date().toISOString(),
      version: '2026-02-15',
      totalPrompts: prompts.length,
      totalShots: shots.length,
      tools: {
        kling: prompts.filter((p) => p.tool === 'kling').length,
        nanobanana: prompts.filter((p) => p.tool === 'nanobanana').length,
        suno: prompts.filter((p) => p.tool === 'suno').length,
        seedream: prompts.filter((p) => p.tool === 'seedream').length
      },
      shots,
      allPrompts: promptsWithLint
    };

    fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf8');

    log(`Index generated: ${outputPath}`);
    log(`Shots: ${index.totalShots}`);
    log(`Prompts: ${index.totalPrompts}`);
    log('');

    return {
      success: true,
      projectId: resolvedProjectId,
      totalPrompts: index.totalPrompts,
      totalShots: index.totalShots,
      tools: index.tools,
      outputPath,
      index
    };
  } catch (err) {
    return {
      success: false,
      projectId: resolvedProjectId,
      error: err.message || 'Failed to generate prompts index'
    };
  }
}

module.exports = {
  runGenerateIndex,
  parsePromptMetadata
};

if (require.main === module) {
  const projectIdArg = process.argv.slice(2).find((arg) => !String(arg).startsWith('--'));
  const result = runGenerateIndex(projectIdArg || 'default');
  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
  process.exit(0);
}
