#!/usr/bin/env node
/**
 * Restart Server Script
 * Kills any process on port 8000 and restarts the UI server.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

const PORT = 8000;
const PROJECT_ROOT = path.join(__dirname, '..');

console.log(`\n  Restarting server on port ${PORT}...\n`);

// Kill existing process on the port
try {
  if (process.platform === 'win32') {
    const result = execSync(
      `powershell -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`,
      { encoding: 'utf-8' }
    ).trim();
    const pids = [...new Set(result.split(/\r?\n/).filter(p => p && p !== '0'))];
    for (const pid of pids) {
      // Validate PID is numeric
      if (!/^\d+$/.test(pid)) continue;
      console.log(`  Killing PID ${pid} on port ${PORT}`);
      execSync(`powershell -Command "Stop-Process -Id ${pid} -Force"`, { stdio: 'ignore' });
    }
  } else {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
  }
  console.log('  Previous server stopped.\n');
} catch {
  console.log('  No existing server found.\n');
}

// Small delay to let the port free up
setTimeout(() => {
  console.log('  Starting server...\n');
  const child = spawn('node', ['scripts/serve_ui.js'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    detached: false
  });

  child.on('error', (err) => {
    console.error(`  Failed to start server: ${err.message}`);
    process.exit(1);
  });
}, 500);
