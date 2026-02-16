const fs = require('fs');
const path = require('path');

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

function writeJsonPreserveEol(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const eol = detectFileEol(filePath);
  const raw = JSON.stringify(data, null, 2);
  const normalized = eol === '\r\n' ? raw.replace(/\n/g, '\r\n') : raw;
  fs.writeFileSync(filePath, normalized, 'utf8');
}

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
  sanitizeFilename
};
