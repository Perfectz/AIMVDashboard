const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  initRunManifest,
  writeFileWithSnapshot,
  loadManifest,
  revertManifestWrites,
  resolveProjectRelativeSafe
} = require('../../scripts/services/agent_file_guard_service');

function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'amv-agent-guard-'));
  const projectPath = path.join(tmpRoot, 'project');
  fs.mkdirSync(projectPath, { recursive: true });

  const promptPath = path.join(projectPath, 'prompts', 'seedream');
  fs.mkdirSync(promptPath, { recursive: true });
  const existingPrompt = path.join(promptPath, 'shot_01_A.txt');
  fs.writeFileSync(existingPrompt, 'before-content', 'utf8');

  const runMeta = {
    runId: 'run_test_guard',
    projectId: 'unit',
    shotId: 'SHOT_01',
    variation: 'A',
    mode: 'generate',
    startedAt: new Date().toISOString()
  };
  const { manifestPath, snapshotDir } = initRunManifest(projectPath, runMeta);

  const record1 = writeFileWithSnapshot({
    projectPath,
    relativePath: 'prompts/seedream/shot_01_A.txt',
    content: 'after-content',
    manifestPath,
    snapshotDir
  });
  assert.strictEqual(record1.result, 'written');
  assert.strictEqual(record1.existedBefore, true);
  assert.strictEqual(fs.readFileSync(existingPrompt, 'utf8'), 'after-content');

  const newFilePath = path.join(projectPath, 'rendered', 'storyboard', 'notes.txt');
  const record2 = writeFileWithSnapshot({
    projectPath,
    relativePath: 'rendered/storyboard/notes.txt',
    content: 'new-note',
    manifestPath,
    snapshotDir
  });
  assert.strictEqual(record2.existedBefore, false);
  assert.strictEqual(fs.readFileSync(newFilePath, 'utf8'), 'new-note');

  const manifest = loadManifest(manifestPath);
  assert.ok(manifest);
  assert.strictEqual(Array.isArray(manifest.writes), true);
  assert.strictEqual(manifest.writes.length, 2);

  assert.throws(
    () => resolveProjectRelativeSafe(projectPath, '../outside.txt'),
    /writable scope|Forbidden path/i
  );

  const reverted = revertManifestWrites(projectPath, manifestPath);
  assert.strictEqual(reverted.revertedCount, 2);
  assert.strictEqual(fs.readFileSync(existingPrompt, 'utf8'), 'before-content');
  assert.strictEqual(fs.existsSync(newFilePath), false);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('agent-file-guard-service.test.js passed');
}

run();
