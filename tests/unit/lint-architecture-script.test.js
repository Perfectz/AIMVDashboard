const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-lint-'));
  const uiDir = path.join(tmpRoot, 'ui');
  const allowlistPath = path.join(tmpRoot, 'allowlist.json');
  const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'lint_architecture.js');

  write(path.join(uiDir, 'services', 'ok.js'), "fetch('/api/ok');\n");
  write(path.join(uiDir, 'bad.js'), "fetch('/api/not-allowed');\n");
  write(allowlistPath, JSON.stringify({ files: [] }, null, 2));

  const failRun = spawnSync('node', [scriptPath], {
    env: {
      ...process.env,
      ARCH_LINT_ROOT: tmpRoot,
      ARCH_LINT_UI_DIR: uiDir,
      ARCH_LINT_ALLOWLIST: allowlistPath
    },
    encoding: 'utf8'
  });

  assert.notStrictEqual(failRun.status, 0);
  assert.match(failRun.stderr, /Architecture lint failed/);
  assert.match(failRun.stderr, /ui\/bad\.js/);

  write(allowlistPath, JSON.stringify({ files: ['ui/bad.js'] }, null, 2));

  const passRun = spawnSync('node', [scriptPath], {
    env: {
      ...process.env,
      ARCH_LINT_ROOT: tmpRoot,
      ARCH_LINT_UI_DIR: uiDir,
      ARCH_LINT_ALLOWLIST: allowlistPath
    },
    encoding: 'utf8'
  });

  assert.strictEqual(passRun.status, 0);
  assert.match(passRun.stdout, /Architecture lint passed/);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('lint-architecture-script.test.js passed');
}

run();
