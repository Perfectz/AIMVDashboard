#!/usr/bin/env node

/**
 * Prompt Linter - Validation engine for AI Music Video prompts
 * Version: 2026-02-07
 *
 * Validates:
 * 1. Bible JSON files against schemas
 * 2. Prompt files against lint rules
 * 3. Generates lint/report.json
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const projectManager = require('../scripts/project_manager');

// Initialize JSON Schema validator
const ajv = new Ajv({ allErrors: true });

// Get project ID from CLI args or use default
const projectId = process.argv[2] || 'default';

// Verify project exists
if (!projectManager.projectExists(projectId)) {
  console.error(`\n❌ Error: Project '${projectId}' not found`);
  console.error('   Available projects:');
  projectManager.listProjects().forEach(p => {
    console.error(`   - ${p.id}: ${p.name}`);
  });
  console.error('\nUsage: npm run lint [project-id]\n');
  process.exit(1);
}

// Paths (project-aware)
const BIBLE_DIR = projectManager.getProjectPath(projectId, 'bible');
const PROMPTS_DIR = projectManager.getProjectPath(projectId, 'prompts');
const SCHEMAS_DIR = path.join(__dirname, 'schemas');
const REPORT_PATH = path.join(projectManager.getProjectPath(projectId), 'lint', 'report.json');

// Lint results
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

/**
 * Load and validate Bible JSON files against schemas
 */
function validateBibleFiles() {
  console.log('Validating Bible files...\n');

  const bibleFiles = [
    { file: 'project.json', schema: 'project_schema.json' },
    { file: 'visual_style.json', schema: 'visual_style_schema.json' },
    { file: 'cinematography.json', schema: 'cinematography_schema.json' },
    { file: 'characters.json', schema: 'characters_schema.json' },
    { file: 'locations.json', schema: 'locations_schema.json' }
  ];

  bibleFiles.forEach(({ file, schema }) => {
    const filePath = path.join(BIBLE_DIR, file);
    const schemaPath = path.join(SCHEMAS_DIR, schema);

    if (!fs.existsSync(filePath)) {
      results.bibleValidation.push({
        file,
        status: 'FAIL',
        error: 'File not found'
      });
      console.log(`❌ ${file}: File not found`);
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      const validate = ajv.compile(schemaData);
      const valid = validate(data);

      if (valid) {
        results.bibleValidation.push({
          file,
          status: 'PASS'
        });
        console.log(`✅ ${file}: Valid`);
      } else {
        results.bibleValidation.push({
          file,
          status: 'FAIL',
          errors: validate.errors
        });
        console.log(`❌ ${file}: Schema validation failed`);
        console.log(JSON.stringify(validate.errors, null, 2));
      }
    } catch (err) {
      results.bibleValidation.push({
        file,
        status: 'FAIL',
        error: err.message
      });
      console.log(`❌ ${file}: ${err.message}`);
    }
  });

  console.log('');
}

/**
 * Find all prompt files in prompts/ directory
 */
function findPromptFiles() {
  const promptFiles = [];
  const tools = ['kling', 'nanobanana', 'suno'];

  tools.forEach(tool => {
    const toolDir = path.join(PROMPTS_DIR, tool);
    if (!fs.existsSync(toolDir)) {
      return;
    }

    const files = fs.readdirSync(toolDir);
    files.forEach(file => {
      if (file.startsWith('_')) {
        // Skip template files
        return;
      }
      if (file.endsWith('.txt') || file.endsWith('.md')) {
        promptFiles.push({
          tool,
          file,
          path: path.join(toolDir, file)
        });
      }
    });
  });

  return promptFiles;
}

/**
 * Check for cross-references to previous shots (G001)
 */
function checkCrossReferences(content) {
  const forbiddenPhrases = [
    /same as before/i,
    /\bcontinue\b/i,
    /\bagain\b/i,
    /earlier shot/i,
    /previous scene/i,
    /as seen in/i,
    /like the last one/i
  ];

  const errors = [];
  forbiddenPhrases.forEach(pattern => {
    if (pattern.test(content)) {
      errors.push({
        rule: 'G001',
        severity: 'CRITICAL',
        message: `Cross-reference detected: "${content.match(pattern)[0]}". Prompts must be standalone.`
      });
    }
  });

  return errors;
}

/**
 * Check for version tag (G002)
 */
function checkVersionTag(content) {
  const versionPattern = /Version:\s*\d{4}-\d{2}-\d{2}/i;
  if (!versionPattern.test(content)) {
    return [{
      rule: 'G002',
      severity: 'CRITICAL',
      message: 'Missing version tag. Required format: "Version: YYYY-MM-DD"'
    }];
  }
  return [];
}

/**
 * Check for one action per shot (K006 - Kling)
 */
function checkOneAction(content) {
  // Look for multiple action sequences
  const multiActionPatterns = [
    /,\s*then\s+/i,
    /,\s*and then\s+/i,
    /\bafter\b.*\bthen\b/i
  ];

  const errors = [];
  multiActionPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      errors.push({
        rule: 'K006',
        severity: 'CRITICAL',
        message: 'Multiple actions detected. Describe only ONE continuous action for 8-second shot.'
      });
    }
  });

  return errors;
}

/**
 * Check for negative prompt (K009 - Kling, N007 - Nano Banana)
 */
function checkNegativePrompt(content, tool) {
  if (tool === 'suno') {
    return []; // Suno doesn't use negative prompts
  }

  const hasNegative = /negative|no text|no logos|no watermarks/i.test(content);
  if (!hasNegative) {
    const rule = tool === 'kling' ? 'K009' : 'N007';
    return [{
      rule,
      severity: 'CRITICAL',
      message: 'Missing negative prompt. Must include: "no text, logos, watermarks, distorted anatomy, cartoon style, flat lighting, plastic skin"'
    }];
  }

  return [];
}

/**
 * Check for motion verbs in Nano Banana prompts (N005)
 */
function checkMotionVerbs(content) {
  const motionVerbs = [
    /\bwalking\b/i,
    /\brunning\b/i,
    /\bturning\b/i,
    /\bmoving\b/i,
    /\bflying\b/i,
    /in the process of/i
  ];

  const errors = [];
  motionVerbs.forEach(pattern => {
    if (pattern.test(content)) {
      errors.push({
        rule: 'N005',
        severity: 'CRITICAL',
        message: `Motion verb detected: "${content.match(pattern)[0]}". Image prompts must use static descriptions.`
      });
    }
  });

  return errors;
}

/**
 * Check for visual descriptions in Suno prompts (S001, S002)
 */
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
  visualTerms.forEach(pattern => {
    if (pattern.test(content)) {
      errors.push({
        rule: 'S002',
        severity: 'CRITICAL',
        message: 'Visual scene description detected in music prompt. Suno prompts should describe music only.'
      });
    }
  });

  return errors;
}

/**
 * Validate a single prompt file
 */
function validatePromptFile({ tool, file, path: filePath }) {
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const warnings = [];

  // Global rules (all tools)
  errors.push(...checkCrossReferences(content));
  errors.push(...checkVersionTag(content));

  // Tool-specific rules
  if (tool === 'kling') {
    errors.push(...checkOneAction(content));
    errors.push(...checkNegativePrompt(content, tool));
    // Could add more Kling-specific checks here
  } else if (tool === 'nanobanana') {
    errors.push(...checkMotionVerbs(content));
    errors.push(...checkNegativePrompt(content, tool));
  } else if (tool === 'suno') {
    errors.push(...checkMusicFocus(content));
  }

  const status = errors.length > 0 ? 'FAIL' : 'PASS';

  return {
    file: `prompts/${tool}/${file}`,
    tool,
    status,
    errors,
    warnings
  };
}

/**
 * Validate all prompt files
 */
function validatePrompts() {
  console.log('Validating prompts...\n');

  const promptFiles = findPromptFiles();

  if (promptFiles.length === 0) {
    console.log('No prompt files found. This is expected in Phase 1.');
    console.log('Prompt generation happens in Phase 2.\n');
    return;
  }

  results.summary.totalPrompts = promptFiles.length;

  promptFiles.forEach(promptFile => {
    const result = validatePromptFile(promptFile);
    results.promptValidation.push(result);

    if (result.status === 'PASS') {
      results.summary.passed++;
      console.log(`✅ ${result.file}`);
    } else {
      results.summary.failed++;
      console.log(`❌ ${result.file}`);
      result.errors.forEach(err => {
        console.log(`   [${err.rule}] ${err.message}`);
      });
    }

    if (result.warnings.length > 0) {
      results.summary.warnings += result.warnings.length;
      result.warnings.forEach(warn => {
        console.log(`   ⚠️  [${warn.rule}] ${warn.message}`);
      });
    }
  });

  console.log('');
}

/**
 * Write lint report to file
 */
function writeReport() {
  const reportDir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));
  console.log(`Lint report written to: ${REPORT_PATH}\n`);
}

/**
 * Print summary
 */
function printSummary() {
  console.log('═════════════════════════════════════════');
  console.log('LINT SUMMARY');
  console.log('═════════════════════════════════════════');
  console.log(`Bible files validated: ${results.bibleValidation.length}`);
  console.log(`Total prompts: ${results.summary.totalPrompts}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Warnings: ${results.summary.warnings}`);
  console.log('═════════════════════════════════════════\n');
}

/**
 * Main execution
 */
function main() {
  const project = projectManager.getProject(projectId);
  console.log('\n');
  console.log('╔═════════════════════════════════════════╗');
  console.log('║   AI MUSIC VIDEO - PROMPT LINTER       ║');
  console.log('║   Version: 2026-02-07                  ║');
  console.log('╚═════════════════════════════════════════╝');
  console.log(`\nProject: ${project.name} (${projectId})\n`);

  validateBibleFiles();
  validatePrompts();
  writeReport();
  printSummary();

  // Exit with error code if any prompts failed
  if (results.summary.failed > 0) {
    console.log('❌ Linting failed. Fix critical errors before using prompts.\n');
    process.exit(1);
  } else {
    console.log('✅ All validations passed!\n');
    process.exit(0);
  }
}

// Run linter
main();
