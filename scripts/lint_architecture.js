#!/usr/bin/env node

/**
 * Architecture Lint
 *
 * Enforces layering guardrails for AI-friendly iteration:
 * - direct fetch() should live in ui/services/*
 * - legacy exceptions must be explicitly allowlisted
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UI_DIR = process.env.ARCH_LINT_UI_DIR
  ? path.resolve(process.env.ARCH_LINT_UI_DIR)
  : path.join(ROOT, 'ui');
const ALLOWLIST_PATH = process.env.ARCH_LINT_ALLOWLIST
  ? path.resolve(process.env.ARCH_LINT_ALLOWLIST)
  : path.join(ROOT, 'docs', 'architecture', 'fetch-allowlist.json');
const REL_ROOT = process.env.ARCH_LINT_ROOT
  ? path.resolve(process.env.ARCH_LINT_ROOT)
  : ROOT;


function walkJsFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && fullPath.endsWith('.js')) {
        out.push(fullPath);
      }
    }
  }

  return out.sort();
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    return { files: [] };
  }

  try {
    const data = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
    return {
      files: Array.isArray(data.files) ? data.files.map(String) : []
    };
  } catch (err) {
    console.error('❌ Failed to parse allowlist:', err.message);
    process.exit(1);
  }
}

function findFetchLocations(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const hits = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/\bfetch\s*\(/.test(line)) {
      hits.push(i + 1);
    }
  }

  return hits;
}

function isServiceFile(relPath) {
  return relPath.startsWith('ui/services/');
}

function main() {
  const allowlist = loadAllowlist();
  const allow = new Set(allowlist.files);

  const files = walkJsFiles(UI_DIR);
  const violations = [];

  for (const absPath of files) {
    const relPath = path.relative(REL_ROOT, absPath).replace(/\\/g, '/');
    const hits = findFetchLocations(absPath);
    if (hits.length === 0) continue;

    if (isServiceFile(relPath)) continue;
    if (allow.has(relPath)) continue;

    violations.push({ relPath, lines: hits });
  }

  if (violations.length > 0) {
    console.error('\n❌ Architecture lint failed. direct fetch() is only allowed in ui/services/* unless allowlisted.\n');
    violations.forEach((v) => {
      console.error(`- ${v.relPath} (lines: ${v.lines.join(', ')})`);
    });
    console.error('\nTo allow a legacy file temporarily, add it to docs/architecture/fetch-allowlist.json with rationale.\n');
    process.exit(1);
  }

  console.log('✅ Architecture lint passed');
}

main();
