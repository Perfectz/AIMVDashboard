const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT_DIR = path.join(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT_DIR, 'projects');
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime'
};

function isPathInside(basePath, targetPath) {
  const base = path.resolve(basePath);
  const target = path.resolve(targetPath);
  return target === base || target.startsWith(base + path.sep);
}

function safeResolve(basePath, ...segments) {
  const target = path.resolve(basePath, ...segments);
  if (!isPathInside(basePath, target)) {
    throw new Error('Forbidden path');
  }
  return target;
}

function safeReadJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function safeReadText(filePath, fallback = '') {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

function detectFileEol(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '\n';
    return fs.readFileSync(filePath, 'utf8').includes('\r\n') ? '\r\n' : '\n';
  } catch {
    return '\n';
  }
}

/**
 * Atomic JSON write: writes to a temp file in the same directory, then renames.
 * This prevents data corruption if the process crashes mid-write.
 */
function writeJsonPreserveEol(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const eol = detectFileEol(filePath);
  const raw = JSON.stringify(data, null, 2);
  const normalized = eol === '\r\n' ? raw.replace(/\n/g, '\r\n') : raw;

  // Write to temp file first, then atomic rename
  const tmpFile = path.join(dir, `.tmp-${crypto.randomBytes(6).toString('hex')}-${path.basename(filePath)}`);
  try {
    fs.writeFileSync(tmpFile, normalized, 'utf8');
    fs.renameSync(tmpFile, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tmpFile); } catch { /* ignore cleanup error */ }
    throw err;
  }
}

// --- File Locking ---
// Simple cooperative file lock to prevent concurrent write races on the same JSON file.
// Uses lock files with stale detection (locks older than LOCK_STALE_MS are broken).

const {
  LOCK_STALE_MS,
  LOCK_RETRY_MS,
  LOCK_MAX_RETRIES
} = require('./config');

const _activeLocks = new Map();

function _lockPath(filePath) {
  return filePath + '.lock';
}

function acquireFileLock(filePath) {
  const lockFile = _lockPath(filePath);

  for (let attempt = 0; attempt < LOCK_MAX_RETRIES; attempt++) {
    try {
      // O_EXCL ensures atomic create — fails if file exists
      const fd = fs.openSync(lockFile, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now() }));
      fs.closeSync(fd);
      _activeLocks.set(filePath, lockFile);
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;

      // Check if lock is stale
      try {
        const stat = fs.statSync(lockFile);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          fs.unlinkSync(lockFile);
          continue; // retry immediately after breaking stale lock
        }
      } catch { /* lock file gone, retry */ continue; }

      // Wait and retry
      if (attempt < LOCK_MAX_RETRIES - 1) {
        const waitMs = LOCK_RETRY_MS + Math.random() * LOCK_RETRY_MS;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
      }
    }
  }
  return false;
}

function releaseFileLock(filePath) {
  const lockFile = _lockPath(filePath);
  _activeLocks.delete(filePath);
  try { fs.unlinkSync(lockFile); } catch { /* already removed */ }
}

/**
 * Execute a function while holding a file lock.
 * Ensures only one writer at a time per file path.
 */
function withFileLock(filePath, fn) {
  const acquired = acquireFileLock(filePath);
  if (!acquired) {
    throw new Error(`Failed to acquire lock for ${path.basename(filePath)} after ${LOCK_MAX_RETRIES} retries`);
  }
  try {
    return fn();
  } finally {
    releaseFileLock(filePath);
  }
}

// Clean up any locks on process exit
function _cleanupLocks() {
  for (const [, lockFile] of _activeLocks) {
    try { fs.unlinkSync(lockFile); } catch { /* ignore */ }
  }
  _activeLocks.clear();
}
process.on('exit', _cleanupLocks);

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'text/plain';
}

function sanitizePathSegment(value, pattern, label) {
  if (!pattern.test(value || '')) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}

module.exports = {
  ROOT_DIR,
  PROJECTS_DIR,
  MIME_TYPES,
  isPathInside,
  safeResolve,
  safeReadJson,
  safeReadText,
  detectFileEol,
  writeJsonPreserveEol,
  getContentType,
  sanitizePathSegment,
  sanitizeFilename,
  acquireFileLock,
  releaseFileLock,
  withFileLock
};
