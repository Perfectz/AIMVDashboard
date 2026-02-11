const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-feature-'));
  const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'scaffold_feature.js');

  const dryRun = spawnSync('node', [scriptPath, 'agent-test', '--with-domain', '--with-service', '--dry-run'], {
    env: { ...process.env, SCAFFOLD_ROOT: tmpRoot },
    encoding: 'utf8'
  });

  assert.strictEqual(dryRun.status, 0);
  assert.match(dryRun.stdout, /would create/);
  assert.strictEqual(fs.existsSync(path.join(tmpRoot, 'ui', 'features', 'agent-test-feature.js')), false);

  const createRun = spawnSync('node', [scriptPath, 'agent-test', '--with-domain', '--with-service'], {
    env: { ...process.env, SCAFFOLD_ROOT: tmpRoot },
    encoding: 'utf8'
  });

  assert.strictEqual(createRun.status, 0);
  assert.strictEqual(fs.existsSync(path.join(tmpRoot, 'ui', 'features', 'agent-test-feature.js')), true);
  assert.strictEqual(fs.existsSync(path.join(tmpRoot, 'ui', 'domain', 'agent-test-domain.js')), true);
  assert.strictEqual(fs.existsSync(path.join(tmpRoot, 'ui', 'services', 'agent-test-service.js')), true);
  assert.strictEqual(fs.existsSync(path.join(tmpRoot, 'tests', 'unit', 'agent-test-feature.test.js')), true);

  const rerun = spawnSync('node', [scriptPath, 'agent-test'], {
    env: { ...process.env, SCAFFOLD_ROOT: tmpRoot },
    encoding: 'utf8'
  });

  assert.strictEqual(rerun.status, 0);
  assert.match(rerun.stdout, /exists/);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('scaffold-feature-script.test.js passed');
}

run();
