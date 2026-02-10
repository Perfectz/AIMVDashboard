#!/usr/bin/env node

/**
 * Schema Validator - Validates project bible JSON files against schemas
 * Version: 2026-02-10
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const projectManager = require('./project_manager');

const ajv = new Ajv({ allErrors: true });

const SCHEMAS_DIR = path.join(__dirname, '..', 'lint', 'schemas');
const requestedProjectId = process.argv[2] || projectManager.getActiveProject();

if (!projectManager.projectExists(requestedProjectId)) {
  console.error(`\n❌ Error: Project '${requestedProjectId}' not found`);
  console.error('   Available projects:');
  projectManager.listProjects().forEach(p => console.error(`   - ${p.id}: ${p.name}`));
  console.error('\nUsage: npm run validate -- [project-id]\n');
  process.exit(1);
}

const BIBLE_DIR = projectManager.getProjectPath(requestedProjectId, 'bible');

const requiredBibleFiles = [
  { file: 'project.json', schema: 'project_schema.json' },
  { file: 'visual_style.json', schema: 'visual_style_schema.json' },
  { file: 'cinematography.json', schema: 'cinematography_schema.json' },
  { file: 'characters.json', schema: 'characters_schema.json' },
  { file: 'locations.json', schema: 'locations_schema.json' }
];

const optionalBibleFiles = [
  { file: 'shot_list.json', schema: 'shot_intent_schema.json' },
  { file: 'youtube_script.json', schema: 'youtube_script_schema.json' },
  { file: 'transcript.json', schema: 'transcript_schema.json' },
  { file: 'asset_manifest.json', schema: 'asset_manifest_schema.json' }
];

console.log('\n╔═══════════════════════════════════════╗');
console.log('║   SCHEMA VALIDATOR                   ║');
console.log('║   Version: 2026-02-10                ║');
console.log('╚═══════════════════════════════════════╝\n');
console.log(`Project: ${requestedProjectId}`);
console.log(`Bible dir: ${BIBLE_DIR}\n`);

let allValid = true;

function validateEntry({ file, schema }, { required }) {
  const filePath = path.join(BIBLE_DIR, file);
  const schemaPath = path.join(SCHEMAS_DIR, schema);

  if (!fs.existsSync(schemaPath)) {
    console.log(`❌ ${schema}: Schema file not found`);
    allValid = false;
    return;
  }

  if (!fs.existsSync(filePath)) {
    if (required) {
      console.log(`❌ ${file}: File not found`);
      allValid = false;
    } else {
      console.log(`ℹ️  ${file}: Not found (optional)`);
    }
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const validate = ajv.compile(schemaData);
    const valid = validate(data);

    if (valid) {
      console.log(`✅ ${file}: Valid`);
    } else {
      console.log(`❌ ${file}: Validation failed`);
      validate.errors.forEach(err => {
        console.log(`   ${err.instancePath} ${err.message}`);
      });
      allValid = false;
    }
  } catch (err) {
    console.log(`❌ ${file}: ${err.message}`);
    allValid = false;
  }
}

requiredBibleFiles.forEach(entry => validateEntry(entry, { required: true }));
optionalBibleFiles.forEach(entry => validateEntry(entry, { required: false }));

console.log('\n');

if (allValid) {
  console.log('✅ All required files are valid!\n');
  process.exit(0);
} else {
  console.log('❌ Validation failed for one or more files.\n');
  process.exit(1);
}
