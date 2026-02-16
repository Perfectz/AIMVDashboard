const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WRITEABLE_PREFIXES = [
  'prompts/',
  'rendered/storyboard/'
];
const WRITEABLE_FILES = new Set([
  'prompts_index.json'
]);

function normalizeRelativePath(relativePath) {
  return String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function isScopedWritable(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (WRITEABLE_FILES.has(normalized)) return true;
  return WRITEABLE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isPathInside(basePath, targetPath) {
  const base = path.resolve(basePath);
  const target = path.resolve(targetPath);
  return target === base || target.startsWith(base + path.sep);
}

function resolveProjectRelativeSafe(projectPath, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (!isScopedWritable(normalized)) {
    throw new Error(`Path out of writable scope: ${normalized}`);
  }
  const target = path.resolve(projectPath, normalized);
  if (!isPathInside(projectPath, target)) {
    throw new Error('Forbidden path');
  }
  return target;
}

function ensureDir(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getRunPaths(projectPath, runId) {
  const runDir = path.join(projectPath, 'rendered', 'storyboard', 'agent_runs', runId);
  const snapshotDir = path.join(runDir, 'snapshots');
  const manifestPath = path.join(runDir, 'manifest.json');
  return { runDir, snapshotDir, manifestPath };
}

function initRunManifest(projectPath, runMeta) {
  const { runDir, snapshotDir, manifestPath } = getRunPaths(projectPath, runMeta.runId);
  ensureDir(runDir);
  ensureDir(snapshotDir);
  const manifest = {
    runId: runMeta.runId,
    projectId: runMeta.projectId,
    shotId: runMeta.shotId,
    variation: runMeta.variation,
    mode: runMeta.mode,
    status: 'running',
    startedAt: runMeta.startedAt,
    finishedAt: null,
    writes: [],
    rollback: { status: 'none', revertedAt: null, revertedCount: 0 }
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return { manifestPath, snapshotDir };
}

function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function saveManifest(manifestPath, manifest) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

function updateManifestStatus(manifestPath, status, finishedAt = null) {
  const manifest = loadManifest(manifestPath);
  if (!manifest) return;
  manifest.status = status;
  if (finishedAt) manifest.finishedAt = finishedAt;
  saveManifest(manifestPath, manifest);
}

function createSnapshotPath(snapshotDir, relativePath, index = 0) {
  const safeName = normalizeRelativePath(relativePath).replace(/[\/:]/g, '__');
  return path.join(snapshotDir, `${safeName}.${String(index).padStart(3, '0')}.before`);
}

function writeFileWithSnapshot(input) {
  const projectPath = input.projectPath;
  const relativePath = normalizeRelativePath(input.relativePath);
  const content = typeof input.content === 'string' ? input.content : String(input.content || '');
  const manifestPath = input.manifestPath;
  const snapshotDir = input.snapshotDir;

  const targetPath = resolveProjectRelativeSafe(projectPath, relativePath);
  ensureDir(path.dirname(targetPath));

  const manifest = loadManifest(manifestPath);
  const existingWritesCount = manifest && Array.isArray(manifest.writes) ? manifest.writes.length : 0;
  const existedBefore = fs.existsSync(targetPath);
  let beforeSnapshotPath = null;
  if (existedBefore) {
    beforeSnapshotPath = createSnapshotPath(snapshotDir, relativePath, existingWritesCount);
    fs.copyFileSync(targetPath, beforeSnapshotPath);
  }

  const tmpPath = `${targetPath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, targetPath);

  const afterHash = hashContent(content);
  const writeRecord = {
    path: relativePath,
    beforeSnapshotPath: beforeSnapshotPath
      ? normalizeRelativePath(path.relative(projectPath, beforeSnapshotPath))
      : null,
    existedBefore,
    afterHash,
    writtenAt: new Date().toISOString(),
    result: 'written'
  };

  if (manifest) {
    manifest.writes = Array.isArray(manifest.writes) ? manifest.writes : [];
    manifest.writes.push(writeRecord);
    saveManifest(manifestPath, manifest);
  }

  return writeRecord;
}

function revertManifestWrites(projectPath, manifestPath) {
  const manifest = loadManifest(manifestPath);
  if (!manifest) throw new Error('Run manifest not found');
  const writes = Array.isArray(manifest.writes) ? manifest.writes.slice().reverse() : [];

  let revertedCount = 0;
  writes.forEach((record) => {
    const targetPath = resolveProjectRelativeSafe(projectPath, record.path);
    if (record.existedBefore && record.beforeSnapshotPath) {
      const snapshotAbs = path.resolve(projectPath, record.beforeSnapshotPath);
      if (fs.existsSync(snapshotAbs)) {
        ensureDir(path.dirname(targetPath));
        fs.copyFileSync(snapshotAbs, targetPath);
        revertedCount += 1;
      }
      return;
    }

    if (!record.existedBefore && fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      revertedCount += 1;
    }
  });

  manifest.rollback = {
    status: 'reverted',
    revertedAt: new Date().toISOString(),
    revertedCount
  };
  manifest.status = 'reverted';
  manifest.finishedAt = manifest.finishedAt || new Date().toISOString();
  saveManifest(manifestPath, manifest);
  return { revertedCount, manifest };
}

module.exports = {
  isScopedWritable,
  normalizeRelativePath,
  resolveProjectRelativeSafe,
  initRunManifest,
  loadManifest,
  saveManifest,
  updateManifestStatus,
  writeFileWithSnapshot,
  revertManifestWrites,
  getRunPaths,
  hashContent
};
