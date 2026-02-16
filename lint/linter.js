#!/usr/bin/env node

/**
 * Prompt Linter - Validation engine for AI Music Video prompts
 * Version: 2026-02-15
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const projectManager = require('../scripts/project_manager');

const ajv = new Ajv({ allErrors: true });

function checkCrossReferences(content) {
  const forbidden = [
    /same as before/i,
    /\bcontinue\b/i,
    /\bagain\b/i,
    /earlier shot/i,
    /previous scene/i,
    /as seen in/i,
    /like the last one/i
  ];

  const errors = [];
  forbidden.forEach((pattern) => {
    if (!pattern.test(content)) return;
    errors.push({
      rule: 'G001',
      severity: 'CRITICAL',
      message: `Cross-reference detected: "${content.match(pattern)[0]}". Prompts must be standalone.`
    });
  });
  return errors;
}

function checkVersionTag(content) {
  if (/Version:\s*\d{4}-\d{2}-\d{2}/i.test(content)) return [];
  return [{
    rule: 'G002',
    severity: 'CRITICAL',
    message: 'Missing version tag. Required format: "Version: YYYY-MM-DD"'
  }];
}

function checkOneAction(content) {
  const patterns = [
    /,\s*then\s+/i,
    /,\s*and then\s+/i,
    /\bafter\b.*\bthen\b/i
  ];
  const errors = [];
  patterns.forEach((pattern) => {
    if (!pattern.test(content)) return;
    errors.push({
      rule: 'K006',
      severity: 'CRITICAL',
      message: 'Multiple actions detected. Describe only ONE continuous action for 8-second shot.'
    });
  });
  return errors;
}

function checkNegativePrompt(content, tool) {
  if (tool === 'suno') return [];
  if (/negative|no text|no logos|no watermarks/i.test(content)) return [];
  return [{
    rule: tool === 'kling' ? 'K009' : 'N007',
    severity: 'CRITICAL',
    message: 'Missing negative prompt. Must include no text/logos/watermarks and anatomy/style guards.'
  }];
}

function checkMotionVerbs(content) {
  const patterns = [
    /\bwalking\b/i,
    /\brunning\b/i,
    /\bturning\b/i,
    /\bmoving\b/i,
    /\bflying\b/i,
    /in the process of/i
  ];
  const errors = [];
  patterns.forEach((pattern) => {
    if (!pattern.test(content)) return;
    errors.push({
      rule: 'N005',
      severity: 'CRITICAL',
      message: `Motion verb detected: "${content.match(pattern)[0]}". Image prompts must be static.`
    });
  });
  return errors;
}

function checkMusicFocus(content) {
  const visualTerms = [
    /\bcharacter\b/i,
    /\blocation\b/i,
    /\bneon\b/i,
    /\balley\b/i,
    /\bwalking\b/i,
    /\bvisual\b/i
  ];
  const errors = [];
  visualTerms.forEach((pattern) => {
    if (!pattern.test(content)) return;
    errors.push({
      rule: 'S002',
      severity: 'CRITICAL',
      message: 'Visual scene description detected in music prompt. Suno prompts should describe music only.'
    });
  });
  return errors;
}

function findPromptFiles(promptsDir) {
  const promptFiles = [];
  const tools = ['kling', 'nanobanana', 'suno'];

  tools.forEach((tool) => {
    const toolDir = path.join(promptsDir, tool);
    if (!fs.existsSync(toolDir)) return;
    const files = fs.readdirSync(toolDir);
    files.forEach((file) => {
      if (file.startsWith('_')) return;
      if (!file.endsWith('.txt') && !file.endsWith('.md')) return;
      promptFiles.push({
        tool,
        file,
        path: path.join(toolDir, file)
      });
    });
  });

  return promptFiles;
}

function validatePromptFile(promptFile) {
  const { tool, file, path: filePath } = promptFile;
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const warnings = [];

  errors.push(...checkCrossReferences(content));
  errors.push(...checkVersionTag(content));

  if (tool === 'kling') {
    errors.push(...checkOneAction(content));
    errors.push(...checkNegativePrompt(content, tool));
  } else if (tool === 'nanobanana') {
    errors.push(...checkMotionVerbs(content));
    errors.push(...checkNegativePrompt(content, tool));
  } else if (tool === 'suno') {
    errors.push(...checkMusicFocus(content));
  }

  return {
    file: `prompts/${tool}/${file}`,
    tool,
    status: errors.length > 0 ? 'FAIL' : 'PASS',
    errors,
    warnings
  };
}

function validateBibleFiles(context) {
  const {
    bibleDir,
    schemasDir,
    results,
    log
  } = context;

  const bibleFiles = [
    { file: 'project.json', schema: 'project_schema.json' },
    { file: 'visual_style.json', schema: 'visual_style_schema.json' },
    { file: 'cinematography.json', schema: 'cinematography_schema.json' },
    { file: 'characters.json', schema: 'characters_schema.json' },
    { file: 'locations.json', schema: 'locations_schema.json' }
  ];

  bibleFiles.forEach(({ file, schema }) => {
    const filePath = path.join(bibleDir, file);
    const schemaPath = path.join(schemasDir, schema);

    if (!fs.existsSync(filePath)) {
      results.bibleValidation.push({ file, status: 'FAIL', error: 'File not found' });
      log(`FAIL ${file}: File not found`);
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      const validate = ajv.compile(schemaData);
      const valid = validate(data);

      if (valid) {
        results.bibleValidation.push({ file, status: 'PASS' });
        log(`PASS ${file}`);
      } else {
        results.bibleValidation.push({ file, status: 'FAIL', errors: validate.errors });
        log(`FAIL ${file}: schema validation failed`);
      }
    } catch (err) {
      results.bibleValidation.push({ file, status: 'FAIL', error: err.message });
      log(`FAIL ${file}: ${err.message}`);
    }
  });
}

function validatePrompts(context) {
  const {
    promptsDir,
    results,
    log
  } = context;

  const promptFiles = findPromptFiles(promptsDir);
  results.summary.totalPrompts = promptFiles.length;

  if (promptFiles.length === 0) {
    log('No prompt files found.');
    return;
  }

  promptFiles.forEach((promptFile) => {
    const result = validatePromptFile(promptFile);
    results.promptValidation.push(result);

    if (result.status === 'PASS') {
      results.summary.passed += 1;
      log(`PASS ${result.file}`);
    } else {
      results.summary.failed += 1;
      log(`FAIL ${result.file}`);
    }

    if (result.warnings.length > 0) {
      results.summary.warnings += result.warnings.length;
    }
  });
}

function writeReport(reportPath, results) {
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
}

function runLinter(projectId, options = {}) {
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

  const results = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPrompts: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    },
    bibleValidation: [],
    promptValidation: []
  };

  try {
    const projectPath = projectManager.getProjectPath(resolvedProjectId);
    const context = {
      bibleDir: path.join(projectPath, 'bible'),
      promptsDir: path.join(projectPath, 'prompts'),
      schemasDir: path.join(__dirname, 'schemas'),
      reportPath: path.join(projectPath, 'lint', 'report.json'),
      results,
      log
    };

    log('');
    log('----------------------------------------');
    log('PROMPT LINTER');
    log(`Project: ${resolvedProjectId}`);
    log('----------------------------------------');

    validateBibleFiles(context);
    validatePrompts(context);
    writeReport(context.reportPath, results);

    const success = results.summary.failed === 0;
    log(`Report written: ${context.reportPath}`);
    log(`Prompts: ${results.summary.totalPrompts}`);
    log(`Passed: ${results.summary.passed}`);
    log(`Failed: ${results.summary.failed}`);
    log(`Warnings: ${results.summary.warnings}`);
    log('');

    return {
      success,
      projectId: resolvedProjectId,
      summary: results.summary,
      reportPath: context.reportPath,
      results
    };
  } catch (err) {
    return {
      success: false,
      projectId: resolvedProjectId,
      summary: results.summary,
      error: err.message || 'Linter failed'
    };
  }
}

module.exports = {
  runLinter
};

if (require.main === module) {
  const projectIdArg = process.argv.slice(2).find((arg) => !String(arg).startsWith('--'));
  const result = runLinter(projectIdArg || 'default');
  if (!result.success) {
    console.error(`Error: ${result.error || 'Lint failed'}`);
    process.exit(1);
  }
  process.exit(0);
}
