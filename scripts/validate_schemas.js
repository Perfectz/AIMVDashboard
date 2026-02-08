#!/usr/bin/env node

/**
 * Schema Validator - Validates all Bible JSON files against their schemas
 * Version: 2026-02-07
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true });

const BIBLE_DIR = path.join(__dirname, '..', 'bible');
const SCHEMAS_DIR = path.join(__dirname, '..', 'lint', 'schemas');

const bibleFiles = [
  { file: 'project.json', schema: 'project_schema.json' },
  { file: 'visual_style.json', schema: 'visual_style_schema.json' },
  { file: 'cinematography.json', schema: 'cinematography_schema.json' },
  { file: 'characters.json', schema: 'characters_schema.json' },
  { file: 'locations.json', schema: 'locations_schema.json' }
];

console.log('\n╔═══════════════════════════════════════╗');
console.log('║   SCHEMA VALIDATOR                   ║');
console.log('║   Version: 2026-02-07                ║');
console.log('╚═══════════════════════════════════════╝\n');

let allValid = true;

bibleFiles.forEach(({ file, schema }) => {
  const filePath = path.join(BIBLE_DIR, file);
  const schemaPath = path.join(SCHEMAS_DIR, schema);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${file}: File not found`);
    allValid = false;
    return;
  }

  if (!fs.existsSync(schemaPath)) {
    console.log(`❌ ${schema}: Schema file not found`);
    allValid = false;
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
});

console.log('\n');

if (allValid) {
  console.log('✅ All Bible files are valid!\n');
  process.exit(0);
} else {
  console.log('❌ Some Bible files failed validation.\n');
  process.exit(1);
}
