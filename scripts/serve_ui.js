#!/usr/bin/env node

/**
 * Simple HTTP server for viewing the Prompt Compiler UI
 * Version: 2026-02-07
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const Busboy = require('busboy');
const projectManager = require('./project_manager');
const replicate = require('./replicate_client');

const PORT = 8000;
const HOST = process.env.HOST || '127.0.0.1';
const UI_DIR = path.join(__dirname, '..', 'ui');
const ROOT_DIR = path.join(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT_DIR, 'projects');

const PROJECT_ID_REGEX = /^[a-z0-9-]{1,50}$/;
const SHOT_ID_REGEX = /^SHOT_\d{2,4}$/;
const VARIATION_REGEX = /^[A-D]$/;
const CHARACTER_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const ALLOWED_ORIGINS = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
]);

// MIME types
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

// File validation constants
const ALLOWED_MUSIC_TYPES = ['.mp3'];
const ALLOWED_VIDEO_TYPES = ['.mp4', '.mov'];
const ALLOWED_IMAGE_TYPES = ['.png', '.jpg', '.jpeg'];
const MAX_MUSIC_SIZE = 50 * 1024 * 1024;  // 50MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB

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

function isValidProjectId(value) {
  return PROJECT_ID_REGEX.test(value || '');
}

function parseRequestUrl(req) {
  return new URL(req.url, `http://${req.headers.host}`);
}

function sanitizePathSegment(value, pattern, label) {
  if (!pattern.test(value || '')) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function resolveProjectId(projectId, { required = true } = {}) {
  if (!projectId) {
    if (!required) {
      return projectManager.getActiveProject();
    }
    throw new Error('project is required');
  }
  if (!isValidProjectId(projectId)) {
    throw new Error('Invalid project ID');
  }
  if (!projectManager.projectExists(projectId)) {
    throw new Error(`Project '${projectId}' not found`);
  }
  return projectId;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'text/plain';
}

// Max body size for JSON POST requests (1MB)
const MAX_BODY_SIZE = 1024 * 1024;

// Allowed canon types (whitelist)
const ALLOWED_CANON_TYPES = ['characters', 'locations', 'cinematography', 'style', 'script'];

// Map canon type names to actual filenames in bible/
function canonFilename(type) {
  const map = { 'style': 'visual_style.json', 'script': 'shot_list.json' };
  return map[type] || `${type}.json`;
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>');
      return;
    }

    res.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Content-Length': stats.size
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
      }
      res.end('<h1>500 - Read Error</h1>');
    });
    stream.pipe(res);
  });
}

/**
 * Read request body with size limit
 */
function readBody(req, maxSize, callback) {
  let body = '';
  let called = false;

  function done(err, result) {
    if (called) return;
    called = true;
    callback(err, result);
  }

  req.on('data', chunk => {
    if (called) return;
    body += chunk.toString();
    if (body.length > maxSize) {
      done(new Error('Payload too large'));
      req.destroy();
    }
  });

  req.on('end', () => {
    done(null, body);
  });

  req.on('error', err => {
    done(err);
  });
}

/**
 * Parse multipart/form-data from request
 */
function parseMultipartData(req, callback) {
  const busboy = Busboy({
    headers: req.headers,
    limits: {
      fileSize: MAX_VIDEO_SIZE,
      files: 4,
      fields: 50,
      parts: 80
    }
  });
  const fields = {};
  const files = [];
  let oversized = false;

  busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  busboy.on('file', (fieldname, file, info) => {
    const chunks = [];
    file.on('limit', () => {
      oversized = true;
    });
    file.on('data', chunk => chunks.push(chunk));
    file.on('end', () => {
      files.push({
        fieldname,
        filename: info.filename,
        mimeType: info.mimeType,
        buffer: Buffer.concat(chunks)
      });
    });
  });

  busboy.on('finish', () => {
    if (oversized) {
      callback(new Error('File too large'), { fields, files });
      return;
    }
    callback(null, { fields, files });
  });

  busboy.on('error', (err) => {
    callback(err, { fields, files });
  });

  req.pipe(busboy);
}

/**
 * Validate file based on type and size
 */
function validateFile(filename, size, allowedTypes, maxSize) {
  const ext = path.extname(filename).toLowerCase();

  if (!allowedTypes.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`
    };
  }

  if (size > maxSize) {
    return {
      valid: false,
      error: `File too large. Max: ${Math.round(maxSize / 1024 / 1024)}MB`
    };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}

/**
 * Extract project context from request URL
 */
function getProjectContext(req, { required = false } = {}) {
  const url = parseRequestUrl(req);
  const requested = url.searchParams.get('project');
  const projectId = requested || projectManager.getActiveProject();
  return { projectId: resolveProjectId(projectId, { required }) };
}

function corsHeadersForRequest(req) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };
  }
  return {};
}

/**
 * Read sequence.json file (project-aware)
 */
function readSequenceFile(projectId = 'default') {
  const sequencePath = path.join(
    projectManager.getProjectPath(projectId, 'rendered'),
    'storyboard',
    'sequence.json'
  );

  try {
    const data = fs.readFileSync(sequencePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // Return default structure
    return {
      version: "2026-02-07",
      projectName: "AI Music Video Project",
      totalShots: 0,
      totalDuration: 0,
      musicFile: "",
      selections: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Write sequence.json file (project-aware)
 */
function writeSequenceFile(data, projectId = 'default') {
  const sequencePath = path.join(
    projectManager.getProjectPath(projectId, 'rendered'),
    'storyboard',
    'sequence.json'
  );
  const dir = path.dirname(sequencePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(sequencePath, JSON.stringify(data, null, 2), 'utf8');
}

function readJsonIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

function collectReferenceFiles(dirPath, projectRoot) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath)
    .filter(file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort();

  return files.map(file => {
    const absolutePath = path.join(dirPath, file);
    return {
      filename: file,
      relativePath: path.relative(projectRoot, absolutePath),
      resolvedPath: path.resolve(absolutePath)
    };
  });
}

function extractShotId(shot) {
  return shot?.shotId || shot?.id || null;
}

function buildContextBundle(projectId, { includePromptTemplates = false } = {}) {
  const projectRoot = projectManager.getProjectPath(projectId);
  const projectMetadata = readJsonIfExists(path.join(projectRoot, 'project.json'), {});
  const bibleProject = readJsonIfExists(path.join(projectRoot, 'bible', 'project.json'), {});
  const shotList = readJsonIfExists(path.join(projectRoot, 'bible', 'shot_list.json'), {});
  const sequence = readSequenceFile(projectId);
  const analysis = readJsonIfExists(path.join(projectRoot, 'music', 'analysis.json'), {});

  const sunoPrompt = readTextIfExists(path.join(projectRoot, 'music', 'suno_prompt.txt'));
  const songInfo = readTextIfExists(path.join(projectRoot, 'music', 'song_info.txt'));
  const youtubeScriptText = readTextIfExists(path.join(projectRoot, 'music', 'youtube_script.txt')) || songInfo;

  const shots = Array.isArray(shotList?.shots) ? shotList.shots : [];
  const shotById = new Map(shots.map(shot => [extractShotId(shot), shot]));
  const sequenceOrder = Array.isArray(sequence?.selections) ? sequence.selections : [];

  const orderedShotList = [];
  const includedShotIds = new Set();

  for (const selection of sequenceOrder) {
    const shotId = selection?.shotId;
    if (!shotId || includedShotIds.has(shotId)) continue;
    const shotFromList = shotById.get(shotId);
    if (!shotFromList) continue;

    orderedShotList.push({
      ...shotFromList,
      storyboardSelection: {
        selectedVariation: selection.selectedVariation || null,
        timing: selection.timing || null,
        status: selection.status || null
      }
    });
    includedShotIds.add(shotId);
  }

  for (const shot of shots) {
    const shotId = extractShotId(shot);
    if (!shotId || includedShotIds.has(shotId)) continue;
    orderedShotList.push(shot);
    includedShotIds.add(shotId);
  }

  const usedCharacterIds = new Set();
  const usedLocationIds = new Set();

  orderedShotList.forEach(shot => {
    const characters = Array.isArray(shot.characters) ? shot.characters : [];
    characters.forEach(character => {
      if (character?.id) usedCharacterIds.add(character.id);
    });

    if (shot.location?.id) usedLocationIds.add(shot.location.id);
  });

  const selectedCharacterReferences = Array.from(usedCharacterIds).map(characterId => {
    const charDir = path.join(projectRoot, 'reference', 'characters', characterId);
    return {
      id: characterId,
      references: collectReferenceFiles(charDir, projectRoot),
      guide: fs.existsSync(path.join(charDir, 'guide.json'))
        ? {
            relativePath: path.relative(projectRoot, path.join(charDir, 'guide.json')),
            resolvedPath: path.resolve(path.join(charDir, 'guide.json'))
          }
        : null
    };
  });

  const selectedLocationReferences = Array.from(usedLocationIds).map(locationId => {
    const locDir = path.join(projectRoot, 'reference', 'locations', locationId);
    return {
      id: locationId,
      references: collectReferenceFiles(locDir, projectRoot),
      guide: fs.existsSync(path.join(locDir, 'guide.json'))
        ? {
            relativePath: path.relative(projectRoot, path.join(locDir, 'guide.json')),
            resolvedPath: path.resolve(path.join(locDir, 'guide.json'))
          }
        : null
    };
  });

  const missingCharacterReferences = selectedCharacterReferences
    .filter(ref => ref.references.length < 3)
    .map(ref => ({ id: ref.id, missingSlots: Math.max(3 - ref.references.length, 0) }));

  const missingLocationReferences = selectedLocationReferences
    .filter(ref => ref.references.length < 3)
    .map(ref => ({ id: ref.id, missingSlots: Math.max(3 - ref.references.length, 0) }));

  const renderGaps = sequenceOrder
    .filter(selection => !selection?.selectedVariation)
    .map(selection => ({ shotId: selection.shotId, reason: 'No selected variation in storyboard sequence' }));

  const transcript = analysis?.transcript || analysis?.lyrics || analysis?.fullTranscript || '';

  const styleCanon = readJsonIfExists(path.join(projectRoot, 'bible', 'visual_style.json'), {});
  const cinematographyCanon = readJsonIfExists(path.join(projectRoot, 'bible', 'cinematography.json'), {});

  const promptTemplates = includePromptTemplates
    ? {
        kling: readTextIfExists(path.join(projectRoot, 'prompts', 'kling', '_template.md')),
        nanobanana: readTextIfExists(path.join(projectRoot, 'prompts', 'nanobanana', '_template.md')),
        suno: readTextIfExists(path.join(projectRoot, 'prompts', 'suno', '_template.md'))
      }
    : null;

  const bundle = {
    generatedAt: new Date().toISOString(),
    projectId,
    projectMetadata: {
      registry: projectMetadata,
      bible: bibleProject
    },
    youtubeScript: youtubeScriptText,
    shotList: {
      totalShots: orderedShotList.length,
      orderedShots: orderedShotList
    },
    transcript,
    selectedReferences: {
      characters: selectedCharacterReferences,
      locations: selectedLocationReferences
    },
    assetManifestGaps: {
      charactersMissingReferenceImages: missingCharacterReferences,
      locationsMissingReferenceImages: missingLocationReferences,
      storyboardSelectionGaps: renderGaps
    },
    styleCinematographyCanon: {
      style: styleCanon,
      cinematography: cinematographyCanon
    },
    promptTemplates
  };

  const markdown = [
    `# Context Bundle: ${projectMetadata.name || projectId}`,
    '',
    `Generated: ${bundle.generatedAt}`,
    '',
    '## Project Metadata',
    '```json',
    JSON.stringify(bundle.projectMetadata, null, 2),
    '```',
    '',
    '## YouTube Script',
    bundle.youtubeScript || '_Not available_',
    '',
    '## Shot List (Storyboard Order)',
    '```json',
    JSON.stringify(bundle.shotList, null, 2),
    '```',
    '',
    '## Transcript',
    bundle.transcript || '_Not available_',
    '',
    '## Selected References (Resolved Paths)',
    '```json',
    JSON.stringify(bundle.selectedReferences, null, 2),
    '```',
    '',
    '## Asset Manifest Gaps',
    '```json',
    JSON.stringify(bundle.assetManifestGaps, null, 2),
    '```',
    '',
    '## Style + Cinematography Canon',
    '```json',
    JSON.stringify(bundle.styleCinematographyCanon, null, 2),
    '```'
  ];

  if (promptTemplates) {
    markdown.push('', '## Prompt Templates', '```json', JSON.stringify(promptTemplates, null, 2), '```');
  }

  return {
    ...bundle,
    markdown: markdown.join('\n')
  };
}

/**
 * Send JSON response
 */
function sendJSON(res, statusCode, data) {
  const headers = { 'Content-Type': 'application/json' };
  const corsHeaders = corsHeadersForRequest(res.req);
  Object.assign(headers, corsHeaders);
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  // ===== CORS PREFLIGHT =====
  if (req.method === 'OPTIONS') {
    const corsHeaders = corsHeadersForRequest(req);
    if (!Object.keys(corsHeaders).length) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Origin not allowed' }));
      return;
    }
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // ===== PROJECT MANAGEMENT ENDPOINTS =====

  // GET /api/projects - List all projects
  if (req.method === 'GET' && req.url === '/api/projects') {
    try {
      const projects = projectManager.listProjects();
      sendJSON(res, 200, { success: true, projects });
    } catch (err) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // GET /api/projects/:id - Get project details
  if (req.method === 'GET' && req.url.match(/^\/api\/projects\/([^\/]+)$/)) {
    try {
      const projectId = req.url.match(/^\/api\/projects\/([^\/]+)$/)[1];
      const project = projectManager.getProject(projectId);
      sendJSON(res, 200, { success: true, project });
    } catch (err) {
      sendJSON(res, 404, { success: false, error: err.message });
    }
    return;
  }

  // POST /api/projects - Create new project
  if (req.method === 'POST' && req.url === '/api/projects') {
    parseMultipartData(req, (err, { fields }) => {
      if (err) {
        sendJSON(res, 400, { success: false, error: 'Invalid request' });
        return;
      }

      const { name, description } = fields;

      if (!name || name.trim() === '') {
        sendJSON(res, 400, { success: false, error: 'Project name is required' });
        return;
      }

      try {
        const project = projectManager.createProject(name.trim(), description || '');
        sendJSON(res, 201, { success: true, project });
      } catch (err) {
        sendJSON(res, 400, { success: false, error: err.message });
      }
    });
    return;
  }

  // PUT /api/projects/:id - Update project metadata
  if (req.method === 'PUT' && req.url.match(/^\/api\/projects\/([^\/]+)$/)) {
    const projectId = req.url.match(/^\/api\/projects\/([^\/]+)$/)[1];

    parseMultipartData(req, (err, { fields }) => {
      if (err) {
        sendJSON(res, 400, { success: false, error: 'Invalid request' });
        return;
      }

      try {
        // Parse JSON fields if provided
        const updates = {};
        if (fields.name) updates.name = fields.name;
        if (fields.description) updates.description = fields.description;
        if (fields.music) updates.music = JSON.parse(fields.music);
        if (fields.visualStyle) updates.visualStyle = JSON.parse(fields.visualStyle);
        if (fields.stats) updates.stats = JSON.parse(fields.stats);

        const project = projectManager.updateProject(projectId, updates);
        sendJSON(res, 200, { success: true, project });
      } catch (err) {
        sendJSON(res, 400, { success: false, error: err.message });
      }
    });
    return;
  }

  // DELETE /api/projects/:id - Delete project
  if (req.method === 'DELETE' && req.url.match(/^\/api\/projects\/([^\/]+)$/)) {
    try {
      const projectId = req.url.match(/^\/api\/projects\/([^\/]+)$/)[1];
      projectManager.deleteProject(projectId);
      sendJSON(res, 200, { success: true, message: 'Project deleted' });
    } catch (err) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return;
  }

  // ===== UPLOAD ENDPOINTS =====

  // POST /api/upload/music
  if (req.method === 'POST' && req.url.startsWith('/api/upload/music')) {
    parseMultipartData(req, (err, { fields, files }) => {
      if (err || files.length === 0) {
        sendJSON(res, err && err.message === 'File too large'
          ? 413
          : 400, { success: false, error: err ? err.message : 'No file provided' });
        return;
      }

      let projectId;
      try {
        projectId = resolveProjectId(fields.project || getProjectContext(req).projectId, { required: true });
      } catch (ctxErr) {
        sendJSON(res, 400, { success: false, error: ctxErr.message });
        return;
      }

      const file = files[0];
      const validation = validateFile(
        file.filename,
        file.buffer.length,
        ALLOWED_MUSIC_TYPES,
        MAX_MUSIC_SIZE
      );

      if (!validation.valid) {
        sendJSON(res, 400, { success: false, error: validation.error });
        return;
      }

      // Save file to project-specific directory
      const musicDir = projectManager.getProjectPath(projectId, 'music');
      if (!fs.existsSync(musicDir)) {
        fs.mkdirSync(musicDir, { recursive: true });
      }

      const filename = sanitizeFilename(file.filename);
      const filePath = path.join(musicDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      // Update sequence.json for this project
      const sequence = readSequenceFile(projectId);
      sequence.musicFile = `music/${filename}`;
      writeSequenceFile(sequence, projectId);

      sendJSON(res, 200, {
        success: true,
        filePath: `music/${filename}`,
        message: 'Music uploaded successfully'
      });
    });
    return;
  }

  // POST /api/upload/shot
  if (req.method === 'POST' && req.url.startsWith('/api/upload/shot')) {
    parseMultipartData(req, (err, { fields, files }) => {
      if (err || files.length === 0) {
        sendJSON(res, err && err.message === 'File too large'
          ? 413
          : 400, { success: false, error: err ? err.message : 'No file provided' });
        return;
      }

      let projectId;
      try {
        projectId = resolveProjectId(fields.project || getProjectContext(req).projectId, { required: true });
      } catch (ctxErr) {
        sendJSON(res, 400, { success: false, error: ctxErr.message });
        return;
      }

      const { shotId, variation, fileType } = fields;
      const file = files[0];

      if (!shotId || !variation || !fileType) {
        sendJSON(res, 400, { success: false, error: 'Missing parameters' });
        return;
      }

      try {
        sanitizePathSegment(shotId, SHOT_ID_REGEX, 'shotId');
        if (fileType === 'kling') {
          sanitizePathSegment(variation, VARIATION_REGEX, 'variation');
        }
      } catch (validationErr) {
        sendJSON(res, 400, { success: false, error: validationErr.message });
        return;
      }

      // Validate based on type
      const isVideo = fileType === 'kling';
      const validation = validateFile(
        file.filename,
        file.buffer.length,
        isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES,
        isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
      );

      if (!validation.valid) {
        sendJSON(res, 400, { success: false, error: validation.error });
        return;
      }

      // Create shot directory in project-specific location
      const shotDir = path.join(
        projectManager.getProjectPath(projectId, 'rendered'),
        'shots',
        shotId
      );
      if (!fs.existsSync(shotDir)) {
        fs.mkdirSync(shotDir, { recursive: true });
      }

      // Generate filename
      let filename;
      if (fileType === 'kling') {
        filename = `kling_option_${variation}.mp4`;
      } else if (fileType === 'nano-first') {
        filename = 'nano_first_frame.png';
      } else if (fileType === 'nano-last') {
        filename = 'nano_last_frame.png';
      } else {
        sendJSON(res, 400, { success: false, error: 'Invalid fileType' });
        return;
      }

      const filePath = path.join(shotDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      // Update sequence.json for this project
      const sequence = readSequenceFile(projectId);
      let shot = sequence.selections.find(s => s.shotId === shotId);

      if (!shot) {
        shot = {
          shotId,
          selectedVariation: 'none',
          status: 'rendered',
          renderFiles: { kling: {}, nano: {} }
        };
        sequence.selections.push(shot);
      }

      if (!shot.renderFiles) shot.renderFiles = { kling: {}, nano: {} };

      const relativePath = `rendered/shots/${shotId}/${filename}`;
      if (fileType === 'kling') {
        shot.renderFiles.kling[variation] = relativePath;
      } else if (fileType === 'nano-first') {
        shot.renderFiles.nano.firstFrame = relativePath;
      } else if (fileType === 'nano-last') {
        shot.renderFiles.nano.lastFrame = relativePath;
      }

      sequence.totalShots = sequence.selections.length;
      writeSequenceFile(sequence, projectId);

      sendJSON(res, 200, {
        success: true,
        filePath: relativePath,
        message: 'Shot uploaded successfully'
      });
    });
    return;
  }

  // POST /api/save/suno-prompt
  if (req.method === 'POST' && req.url.startsWith('/api/save/suno-prompt')) {
    readBody(req, MAX_BODY_SIZE, (err, body) => {
      if (err) { sendJSON(res, 413, { success: false, error: 'Payload too large' }); return; }
      try {
        const { project, content } = JSON.parse(body);

        if (!content || typeof content !== 'string') {
          sendJSON(res, 400, { success: false, error: 'Invalid content' });
          return;
        }

        if (content.length > 50 * 1024) { // 50KB max
          sendJSON(res, 400, { success: false, error: 'Content too large (max 50KB)' });
          return;
        }

        const safeProjectId = resolveProjectId(project, { required: true });
        const musicDir = projectManager.getProjectPath(safeProjectId, 'music');
        if (!fs.existsSync(musicDir)) {
          fs.mkdirSync(musicDir, { recursive: true });
        }

        const filePath = path.join(musicDir, 'suno_prompt.txt');
        fs.writeFileSync(filePath, content, 'utf8');

        sendJSON(res, 200, {
          success: true,
          filePath: 'music/suno_prompt.txt',
          message: 'Suno prompt saved successfully'
        });
      } catch (err) {
        sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }
    });
    return;
  }

  // POST /api/save/song-info
  if (req.method === 'POST' && req.url.startsWith('/api/save/song-info')) {
    readBody(req, MAX_BODY_SIZE, (err, body) => {
      if (err) { sendJSON(res, 413, { success: false, error: 'Payload too large' }); return; }
      try {
        const { project, content } = JSON.parse(body);

        if (!content || typeof content !== 'string') {
          sendJSON(res, 400, { success: false, error: 'Invalid content' });
          return;
        }

        if (content.length > 100 * 1024) { // 100KB max
          sendJSON(res, 400, { success: false, error: 'Content too large (max 100KB)' });
          return;
        }

        const safeProjectId = resolveProjectId(project, { required: true });
        const musicDir = projectManager.getProjectPath(safeProjectId, 'music');
        if (!fs.existsSync(musicDir)) {
          fs.mkdirSync(musicDir, { recursive: true });
        }

        const filePath = path.join(musicDir, 'song_info.txt');
        fs.writeFileSync(filePath, content, 'utf8');

        sendJSON(res, 200, {
          success: true,
          filePath: 'music/song_info.txt',
          message: 'Song info saved successfully'
        });
      } catch (err) {
        sendJSON(res, 400, { success: false, error: 'Invalid JSON' });
      }
    });
    return;
  }

  // GET /api/load/suno-prompt
  if (req.method === 'GET' && req.url.startsWith('/api/load/suno-prompt')) {
    try {
      const { projectId } = getProjectContext(req);
      const filePath = path.join(projectManager.getProjectPath(projectId, 'music'), 'suno_prompt.txt');

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        sendJSON(res, 200, { content });
      } else {
        sendJSON(res, 200, { content: '' });
      }
    } catch (err) {
      sendJSON(res, 500, { error: 'Failed to load Suno prompt' });
    }
    return;
  }

  // GET /api/load/song-info
  if (req.method === 'GET' && req.url.startsWith('/api/load/song-info')) {
    try {
      const { projectId } = getProjectContext(req);
      const filePath = path.join(projectManager.getProjectPath(projectId, 'music'), 'song_info.txt');

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        sendJSON(res, 200, { content });
      } else {
        sendJSON(res, 200, { content: '' });
      }
    } catch (err) {
      sendJSON(res, 500, { error: 'Failed to load song info' });
    }
    return;
  }

  // POST /api/save/analysis
  if (req.method === 'POST' && req.url.startsWith('/api/save/analysis')) {
    readBody(req, MAX_BODY_SIZE, (err, body) => {
      if (err) { sendJSON(res, 413, { success: false, error: 'Payload too large' }); return; }
      try {
        const { project, content } = JSON.parse(body);

        if (!content || typeof content !== 'string') {
          sendJSON(res, 400, { success: false, error: 'Invalid content' });
          return;
        }

        if (content.length > 500 * 1024) { // 500KB max
          sendJSON(res, 400, { success: false, error: 'Content too large (max 500KB)' });
          return;
        }

        // Validate JSON structure
        let analysisData;
        try {
          analysisData = JSON.parse(content);
        } catch (parseErr) {
          sendJSON(res, 400, { success: false, error: 'Invalid JSON format: ' + parseErr.message });
          return;
        }

        // Basic validation - check required fields
        if (!analysisData.version || !analysisData.duration || !analysisData.bpm || !analysisData.sections) {
          sendJSON(res, 400, { success: false, error: 'Missing required fields (version, duration, bpm, sections)' });
          return;
        }

        const safeProjectId = resolveProjectId(project, { required: true });
        const musicDir = projectManager.getProjectPath(safeProjectId, 'music');
        if (!fs.existsSync(musicDir)) {
          fs.mkdirSync(musicDir, { recursive: true });
        }

        const filePath = path.join(musicDir, 'analysis.json');
        fs.writeFileSync(filePath, JSON.stringify(analysisData, null, 2), 'utf8');

        sendJSON(res, 200, {
          success: true,
          filePath: 'music/analysis.json',
          message: 'Analysis JSON saved successfully',
          sections: analysisData.sections.length,
          duration: analysisData.duration,
          bpm: analysisData.bpm
        });
      } catch (err) {
        sendJSON(res, 400, { success: false, error: 'Invalid request: ' + err.message });
      }
    });
    return;
  }

  // GET /api/load/analysis
  if (req.method === 'GET' && req.url.startsWith('/api/load/analysis')) {
    try {
      const { projectId } = getProjectContext(req);
      const filePath = path.join(projectManager.getProjectPath(projectId, 'music'), 'analysis.json');

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        sendJSON(res, 200, { content });
      } else {
        sendJSON(res, 200, { content: '' });
      }
    } catch (err) {
      sendJSON(res, 500, { error: 'Failed to load analysis JSON' });
    }
    return;
  }

  // POST /api/export/context-bundle
  if (req.method === 'POST' && req.url.startsWith('/api/export/context-bundle')) {
    readBody(req, MAX_BODY_SIZE, (err, body) => {
      if (err) {
        sendJSON(res, 413, { success: false, error: 'Payload too large' });
        return;
      }

      try {
        const parsed = body ? JSON.parse(body) : {};
        const projectId = resolveProjectId(parsed.project || getProjectContext(req).projectId, { required: true });
        const includePromptTemplates = Boolean(parsed.includePromptTemplates);
        const bundle = buildContextBundle(projectId, { includePromptTemplates });

        sendJSON(res, 200, {
          success: true,
          bundle
        });
      } catch (bundleErr) {
        sendJSON(res, 400, { success: false, error: bundleErr.message });
      }
    });
    return;
  }

  // ========================================
  // Step 1: Theme & Concept Endpoints
  // ========================================

  // POST /api/save/concept
  if (req.method === 'POST' && req.url.startsWith('/api/save/concept')) {
    readBody(req, MAX_BODY_SIZE, (err, body) => {
      if (err) { sendJSON(res, 413, { success: false, error: 'Payload too large' }); return; }
      try {
        const { project, content } = JSON.parse(body);

        if (!content || typeof content !== 'string') {
          sendJSON(res, 400, { success: false, error: 'Invalid content' });
          return;
        }

        if (content.length > 50 * 1024) {
          sendJSON(res, 400, { success: false, error: 'Content too large (max 50KB)' });
          return;
        }

        const safeProjectId = resolveProjectId(project, { required: true });
        const musicDir = projectManager.getProjectPath(safeProjectId, 'music');
        if (!fs.existsSync(musicDir)) {
          fs.mkdirSync(musicDir, { recursive: true });
        }

        const filePath = path.join(musicDir, 'concept.txt');
        fs.writeFileSync(filePath, content, 'utf8');

        sendJSON(res, 200, { success: true, filePath: 'music/concept.txt' });
      } catch (err) {
        sendJSON(res, 500, { success: false, error: 'Failed to save concept' });
      }
    });
    return;
  }

  // GET /api/load/concept
  if (req.method === 'GET' && req.url.startsWith('/api/load/concept')) {
    try {
      const { projectId } = getProjectContext(req);
      const filePath = path.join(projectManager.getProjectPath(projectId, 'music'), 'concept.txt');

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        sendJSON(res, 200, { content });
      } else {
        sendJSON(res, 200, { content: '' });
      }
    } catch (err) {
      sendJSON(res, 500, { error: 'Failed to load concept' });
    }
    return;
  }

  // POST /api/save/inspiration
  if (req.method === 'POST' && req.url.startsWith('/api/save/inspiration')) {
    readBody(req, MAX_BODY_SIZE, (err, body) => {
      if (err) { sendJSON(res, 413, { success: false, error: 'Payload too large' }); return; }
      try {
        const { project, content } = JSON.parse(body);

        if (!content || typeof content !== 'string') {
          sendJSON(res, 400, { success: false, error: 'Invalid content' });
          return;
        }

        if (content.length > 50 * 1024) {
          sendJSON(res, 400, { success: false, error: 'Content too large (max 50KB)' });
          return;
        }

        const safeProjectId = resolveProjectId(project, { required: true });
        const musicDir = projectManager.getProjectPath(safeProjectId, 'music');
        if (!fs.existsSync(musicDir)) {
          fs.mkdirSync(musicDir, { recursive: true });
        }

        const filePath = path.join(musicDir, 'inspiration.txt');
        fs.writeFileSync(filePath, content, 'utf8');

        sendJSON(res, 200, { success: true, filePath: 'music/inspiration.txt' });
      } catch (err) {
        sendJSON(res, 500, { success: false, error: 'Failed to save inspiration' });
      }
    });
    return;
  }

  // GET /api/load/inspiration
  if (req.method === 'GET' && req.url.startsWith('/api/load/inspiration')) {
    try {
      const { projectId } = getProjectContext(req);
      const filePath = path.join(projectManager.getProjectPath(projectId, 'music'), 'inspiration.txt');

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        sendJSON(res, 200, { content });
      } else {
        sendJSON(res, 200, { content: '' });
      }
    } catch (err) {
      sendJSON(res, 500, { error: 'Failed to load inspiration' });
    }
    return;
  }

  // POST /api/save/mood
  if (req.method === 'POST' && req.url.startsWith('/api/save/mood')) {
    readBody(req, MAX_BODY_SIZE, (err, body) => {
      if (err) { sendJSON(res, 413, { success: false, error: 'Payload too large' }); return; }
      try {
        const { project, content } = JSON.parse(body);

        if (!content || typeof content !== 'string') {
          sendJSON(res, 400, { success: false, error: 'Invalid content' });
          return;
        }

        if (content.length > 50 * 1024) {
          sendJSON(res, 400, { success: false, error: 'Content too large (max 50KB)' });
          return;
        }

        const safeProjectId = resolveProjectId(project, { required: true });
        const musicDir = projectManager.getProjectPath(safeProjectId, 'music');
        if (!fs.existsSync(musicDir)) {
          fs.mkdirSync(musicDir, { recursive: true });
        }

        const filePath = path.join(musicDir, 'mood.txt');
        fs.writeFileSync(filePath, content, 'utf8');

        sendJSON(res, 200, { success: true, filePath: 'music/mood.txt' });
      } catch (err) {
        sendJSON(res, 500, { success: false, error: 'Failed to save mood' });
      }
    });
    return;
  }

  // GET /api/load/mood
  if (req.method === 'GET' && req.url.startsWith('/api/load/mood')) {
    try {
      const { projectId } = getProjectContext(req);
      const filePath = path.join(projectManager.getProjectPath(projectId, 'music'), 'mood.txt');

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        sendJSON(res, 200, { content });
      } else {
        sendJSON(res, 200, { content: '' });
      }
    } catch (err) {
      sendJSON(res, 500, { error: 'Failed to load mood' });
    }
    return;
  }

  // POST /api/save/genre
  if (req.method === 'POST' && req.url.startsWith('/api/save/genre')) {
    readBody(req, MAX_BODY_SIZE, (err, body) => {
      if (err) { sendJSON(res, 413, { success: false, error: 'Payload too large' }); return; }
      try {
        const { project, content } = JSON.parse(body);

        if (!content || typeof content !== 'string') {
          sendJSON(res, 400, { success: false, error: 'Invalid content' });
          return;
        }

        if (content.length > 50 * 1024) {
          sendJSON(res, 400, { success: false, error: 'Content too large (max 50KB)' });
          return;
        }

        const safeProjectId = resolveProjectId(project, { required: true });
        const musicDir = projectManager.getProjectPath(safeProjectId, 'music');
        if (!fs.existsSync(musicDir)) {
          fs.mkdirSync(musicDir, { recursive: true });
        }

        const filePath = path.join(musicDir, 'genre.txt');
        fs.writeFileSync(filePath, content, 'utf8');

        sendJSON(res, 200, { success: true, filePath: 'music/genre.txt' });
      } catch (err) {
        sendJSON(res, 500, { success: false, error: 'Failed to save genre' });
      }
    });
    return;
  }

  // GET /api/load/genre
  if (req.method === 'GET' && req.url.startsWith('/api/load/genre')) {
    try {
      const { projectId } = getProjectContext(req);
      const filePath = path.join(projectManager.getProjectPath(projectId, 'music'), 'genre.txt');

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        sendJSON(res, 200, { content });
      } else {
        sendJSON(res, 200, { content: '' });
      }
    } catch (err) {
      sendJSON(res, 500, { error: 'Failed to load genre' });
    }
    return;
  }

  // GET /api/upload-status
  if (req.method === 'GET' && req.url.startsWith('/api/upload-status')) {
    try {
      const { projectId } = getProjectContext(req);
      const musicDir = projectManager.getProjectPath(projectId, 'music');

      const status = {
        music: false,
        sunoPrompt: false,
        songInfo: false,
        analysis: false,
        musicFile: null,
        musicFileSize: null
      };

      if (fs.existsSync(musicDir)) {
        // Check for music files (any .mp3)
        const files = fs.readdirSync(musicDir);
        const mp3File = files.find(f => f.endsWith('.mp3'));

        if (mp3File) {
          status.music = true;
          status.musicFile = mp3File;
          const musicPath = path.join(musicDir, mp3File);
          const stats = fs.statSync(musicPath);
          status.musicFileSize = stats.size;
        }

        status.sunoPrompt = files.includes('suno_prompt.txt');
        status.songInfo = files.includes('song_info.txt');
        status.analysis = files.includes('analysis.json');
      }

      sendJSON(res, 200, status);
    } catch (err) {
      sendJSON(res, 500, { error: 'Failed to check upload status' });
    }
    return;
  }

  // DELETE /api/delete/music - Delete music file
  if (req.method === 'DELETE' && req.url.startsWith('/api/delete/music')) {
    try {
      const url = parseRequestUrl(req);
      const projectId = resolveProjectId(url.searchParams.get('project') || projectManager.getActiveProject(), { required: true });
      const musicDir = projectManager.getProjectPath(projectId, 'music');
      const files = fs.readdirSync(musicDir);
      const mp3File = files.find(f => f.endsWith('.mp3'));

      if (mp3File) {
        fs.unlinkSync(path.join(musicDir, mp3File));
        sendJSON(res, 200, { success: true, message: 'Music file deleted' });
      } else {
        sendJSON(res, 404, { success: false, error: 'No music file found' });
      }
    } catch (err) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // POST /api/save/canon/:type - Save canon file
  if (req.method === 'POST' && req.url.includes('/api/save/canon/')) {
    const match = req.url.match(/\/api\/save\/canon\/(\w+)/);
    if (match) {
      const type = match[1];

      // Whitelist allowed canon types
      if (!ALLOWED_CANON_TYPES.includes(type)) {
        sendJSON(res, 400, { success: false, error: `Invalid canon type: ${type}` });
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      let projectId;
      try {
        projectId = resolveProjectId(url.searchParams.get('project') || projectManager.getActiveProject(), { required: true });
      } catch (ctxErr) {
        sendJSON(res, 400, { success: false, error: ctxErr.message });
        return;
      }

      readBody(req, MAX_BODY_SIZE, (err, body) => {
        if (err) { sendJSON(res, 413, { success: false, error: 'Payload too large' }); return; }
        try {
          const { content } = JSON.parse(body);
          const bibleDir = projectManager.getProjectPath(projectId, 'bible');

          if (!fs.existsSync(bibleDir)) {
            fs.mkdirSync(bibleDir, { recursive: true });
          }

          const filename = canonFilename(type);
          const filePath = path.join(bibleDir, filename);

          // Validate it's valid JSON
          JSON.parse(content);

          fs.writeFileSync(filePath, content, 'utf8');
          sendJSON(res, 200, { success: true, message: `${type} saved` });
        } catch (err) {
          sendJSON(res, 400, { success: false, error: err.message });
        }
      });
      return;
    }
  }

  // GET /api/load/canon/:type - Load canon file
  if (req.method === 'GET' && req.url.includes('/api/load/canon/')) {
    const match = req.url.match(/\/api\/load\/canon\/(\w+)/);
    if (match) {
      const type = match[1];
      try {
        const url = parseRequestUrl(req);
        const projectId = resolveProjectId(url.searchParams.get('project') || projectManager.getActiveProject(), { required: true });
        const filename = canonFilename(type);
        const filePath = path.join(projectManager.getProjectPath(projectId, 'bible'), filename);

        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          sendJSON(res, 200, { content });
        } else {
          sendJSON(res, 404, { content: null });
        }
      } catch (err) {
        sendJSON(res, 400, { success: false, error: err.message });
      }
      return;
    }
  }

  // GET /api/references/characters - List all characters with their reference images
  if (req.method === 'GET' && req.url.startsWith('/api/references/characters')) {
    try {
      const url = parseRequestUrl(req);
      const projectId = resolveProjectId(url.searchParams.get('project') || projectManager.getActiveProject(), { required: true });
      const refDir = projectManager.getProjectPath(projectId, 'reference/characters');
      if (!fs.existsSync(refDir)) {
        sendJSON(res, 200, { characters: [] });
        return;
      }

      const characters = fs.readdirSync(refDir).filter(name => {
        const stats = fs.statSync(path.join(refDir, name));
        return stats.isDirectory();
      }).map(name => {
        const charDir = path.join(refDir, name);
        const files = fs.existsSync(charDir) ? fs.readdirSync(charDir) : [];

        const images = files
          .filter(f => /^ref_\d+\.(png|jpg|jpeg)$/i.test(f))
          .map(f => {
            const match = f.match(/ref_(\d+)\./);
            return {
              filename: f,
              slot: match ? parseInt(match[1]) : 0
            };
          })
          .filter(img => img.slot > 0);

        const generatedImages = files
          .filter(f => /^generated_0\d+\.(png|jpg|jpeg)$/i.test(f))
          .map(f => {
            const match = f.match(/generated_0(\d+)\./);
            return {
              filename: f,
              slot: match ? parseInt(match[1]) : 0
            };
          })
          .filter(img => img.slot > 0);

        // Read definition and prompt files if they exist
        let definition = '';
        const defPath = path.join(charDir, 'definition.txt');
        if (fs.existsSync(defPath)) {
          definition = fs.readFileSync(defPath, 'utf-8');
        }

        const prompts = [1, 2, 3].map(slot => {
          const promptPath = path.join(charDir, `prompt_0${slot}.txt`);
          if (fs.existsSync(promptPath)) {
            return fs.readFileSync(promptPath, 'utf-8');
          }
          return '';
        });

        return { name, images, generatedImages, definition, prompts };
      });

      sendJSON(res, 200, { characters });
    } catch (err) {
      sendJSON(res, 500, { characters: [], error: err.message });
    }
    return;
  }

  // POST /api/add-character - Create a character folder
  if (req.method === 'POST' && req.url.startsWith('/api/add-character')) {
    try {
      const url = parseRequestUrl(req);
      const projectId = resolveProjectId(url.searchParams.get('project') || projectManager.getActiveProject(), { required: true });
      const character = sanitizePathSegment(url.searchParams.get('character'), CHARACTER_REGEX, 'character');
      const charDir = safeResolve(projectManager.getProjectPath(projectId, 'reference/characters'), character);

      if (fs.existsSync(charDir)) {
        sendJSON(res, 400, { success: false, error: 'Character already exists' });
        return;
      }

      fs.mkdirSync(charDir, { recursive: true });
      sendJSON(res, 200, { success: true, message: 'Character added' });
    } catch (err) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // POST /api/upload/reference-image - Upload a reference image
  // NOTE: Busboy processes fields in multipart order. We buffer the file
  // data and write to disk only in 'close' when all fields are available.
  if (req.method === 'POST' && req.url.startsWith('/api/upload/reference-image')) {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 20 * 1024 * 1024 } });
    let projectId = projectManager.getActiveProject();
    let character = '';
    let slot = 0;
    let fileExt = '';
    const fileChunks = [];

    busboy.on('field', (name, val) => {
      if (name === 'project') projectId = val;
      if (name === 'character') character = val;
      if (name === 'slot') slot = parseInt(val);
    });

    busboy.on('file', (name, file, info) => {
      fileExt = path.extname(info.filename);
      file.on('data', (chunk) => { fileChunks.push(chunk); });
      file.on('error', (err) => {
        console.error('File stream error:', err);
        fileChunks.length = 0;
      });
    });

    busboy.on('close', () => {
      if (fileChunks.length === 0 || !character || slot < 1) {
        sendJSON(res, 400, { success: false, error: 'Missing file, character name, or slot number' });
        return;
      }

      try {
        projectId = resolveProjectId(projectId, { required: true });
        sanitizePathSegment(character, CHARACTER_REGEX, 'character');
        if (!IMAGE_EXTENSIONS.has(fileExt.toLowerCase())) {
          throw new Error('Invalid image format');
        }
        const charDir = safeResolve(projectManager.getProjectPath(projectId, 'reference/characters'), character);
        if (!fs.existsSync(charDir)) {
          fs.mkdirSync(charDir, { recursive: true });
        }

        // Remove any existing image in this slot (handles extension changes)
        const existingFiles = fs.readdirSync(charDir);
        existingFiles.forEach(f => {
          if (f.startsWith(`ref_${slot}.`)) {
            fs.unlinkSync(path.join(charDir, f));
          }
        });

        const newFilename = `ref_${slot}${fileExt}`;
        const savePath = path.join(charDir, newFilename);
        fs.writeFileSync(savePath, Buffer.concat(fileChunks));

        sendJSON(res, 200, { success: true, message: 'Image uploaded', filename: newFilename });
      } catch (err) {
        console.error('Upload save error:', err);
        sendJSON(res, 500, { success: false, error: 'Failed to save image: ' + err.message });
      }
    });

    req.pipe(busboy);
    return;
  }

  // DELETE /api/delete/reference-image - Delete a specific reference image
  if (req.method === 'DELETE' && req.url.startsWith('/api/delete/reference-image')) {
    try {
      const url = parseRequestUrl(req);
      const projectId = resolveProjectId(url.searchParams.get('project') || projectManager.getActiveProject(), { required: true });
      const character = sanitizePathSegment(url.searchParams.get('character'), CHARACTER_REGEX, 'character');
      const slot = parseInt(url.searchParams.get('slot'), 10);
      if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
        throw new Error('Invalid slot');
      }
      const charDir = safeResolve(projectManager.getProjectPath(projectId, 'reference/characters'), character);
      const files = fs.readdirSync(charDir);
      const fileToDelete = files.find(f => f.startsWith(`ref_${slot}.`));

      if (fileToDelete) {
        fs.unlinkSync(path.join(charDir, fileToDelete));
        sendJSON(res, 200, { success: true, message: 'Image deleted' });
      } else {
        sendJSON(res, 404, { success: false, error: 'Image not found' });
      }
    } catch (err) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // DELETE /api/delete/character-reference - Delete entire character
  if (req.method === 'DELETE' && req.url.startsWith('/api/delete/character-reference')) {
    try {
      const url = parseRequestUrl(req);
      const projectId = resolveProjectId(url.searchParams.get('project') || projectManager.getActiveProject(), { required: true });
      const character = sanitizePathSegment(url.searchParams.get('character'), CHARACTER_REGEX, 'character');
      const charDir = safeResolve(projectManager.getProjectPath(projectId, 'reference/characters'), character);
      if (fs.existsSync(charDir)) {
        fs.rmSync(charDir, { recursive: true, force: true });
        sendJSON(res, 200, { success: true, message: 'Character deleted' });
      } else {
        sendJSON(res, 404, { success: false, error: 'Character not found' });
      }
    } catch (err) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // GET /api/generate-status - Check if Replicate API is configured
  if (req.method === 'GET' && req.url.startsWith('/api/generate-status')) {
    sendJSON(res, 200, { configured: replicate.isConfigured() });
    return;
  }

  // POST /api/generate-image - Generate an image via Replicate API (SeedDream v4.5)
  if (req.method === 'POST' && req.url.startsWith('/api/generate-image')) {
    // Set a long timeout for generation (5 minutes)
    req.setTimeout(300000);
    res.setTimeout(300000);

    readBody(req, MAX_BODY_SIZE, async (err, body) => {
      if (err) {
        sendJSON(res, 400, { success: false, error: err.message });
        return;
      }

      try {
        const data = JSON.parse(body);
        const projId = resolveProjectId(data.project || projectManager.getActiveProject(), { required: true });
        const mode = data.mode || 'character';
        const character = data.character;
        const slot = data.slot;
        const size = data.size || '2K';
        const aspectRatio = data.aspect_ratio || (mode === 'character' ? '3:4' : '16:9');

        if (!replicate.isConfigured()) {
          sendJSON(res, 500, { success: false, error: 'Replicate API token not configured. Add REPLICATE_API_TOKEN to .env file.' });
          return;
        }

        let prompt = '';
        let savePath = '';
        let relativePath = '';

        if (mode === 'character') {
          if (!character || !slot) {
            sendJSON(res, 400, { success: false, error: 'Character and slot are required for character mode.' });
            return;
          }

          const charDir = path.join(__dirname, '..', 'projects', projId, 'reference', 'characters', character);
          if (!fs.existsSync(charDir)) {
            sendJSON(res, 404, { success: false, error: `Character '${character}' not found.` });
            return;
          }

          const promptPath = path.join(charDir, `prompt_0${slot}.txt`);
          if (!fs.existsSync(promptPath)) {
            sendJSON(res, 404, { success: false, error: `No prompt_0${slot}.txt found for ${character}.` });
            return;
          }

          prompt = fs.readFileSync(promptPath, 'utf-8').trim();
          savePath = path.join(charDir, `generated_0${slot}.png`);
          relativePath = `reference/characters/${character}/generated_0${slot}.png`;

        } else {
          prompt = data.prompt;
          if (!prompt) {
            sendJSON(res, 400, { success: false, error: 'Prompt text is required for arbitrary mode.' });
            return;
          }

          const genDir = path.join(__dirname, '..', 'projects', projId, 'rendered', 'generated');
          if (!fs.existsSync(genDir)) {
            fs.mkdirSync(genDir, { recursive: true });
          }
          const filename = `gen_${Date.now()}.png`;
          savePath = path.join(genDir, filename);
          relativePath = `rendered/generated/${filename}`;
        }

        console.log(`[Generate] ${mode} mode — ${prompt.substring(0, 60)}...`);

        const genOptions = {
          size,
          aspect_ratio: aspectRatio,
          max_images: data.max_images || 1
        };
        if (data.sequential_image_generation) genOptions.sequential_image_generation = data.sequential_image_generation;
        if (data.image_input) genOptions.image_input = data.image_input;
        if (data.width) genOptions.width = data.width;
        if (data.height) genOptions.height = data.height;

        const result = await replicate.createPrediction(prompt, genOptions);

        // Download first image
        const outputs = Array.isArray(result.output) ? result.output : [result.output];
        const savedImages = [];

        for (let i = 0; i < outputs.length; i++) {
          let imgPath = savePath;
          let imgRelative = relativePath;
          if (i > 0) {
            const ext = path.extname(savePath);
            const base = savePath.slice(0, -ext.length);
            imgPath = `${base}_${String.fromCharCode(98 + i)}${ext}`;
            const relExt = path.extname(relativePath);
            const relBase = relativePath.slice(0, -relExt.length);
            imgRelative = `${relBase}_${String.fromCharCode(98 + i)}${relExt}`;
          }

          await replicate.downloadImage(outputs[i], imgPath);
          savedImages.push(imgRelative);
        }

        console.log(`[Generate] Success — ${result.duration.toFixed(1)}s — ${savedImages.join(', ')}`);

        sendJSON(res, 200, {
          success: true,
          images: savedImages,
          predictionId: result.predictionId,
          duration: result.duration
        });

      } catch (genErr) {
        console.error(`[Generate] Error: ${genErr.message}`);
        const statusCode = genErr.statusCode || 500;
        sendJSON(res, statusCode, { success: false, error: genErr.message });
      }
    });
    return;
  }

  // POST /api/generate-shot - Generate first+last frame for a shot prompt via Replicate
  if (req.method === 'POST' && req.url.startsWith('/api/generate-shot')) {
    req.setTimeout(300000);
    res.setTimeout(300000);

    readBody(req, MAX_BODY_SIZE, async (err, body) => {
      if (err) {
        sendJSON(res, 400, { success: false, error: err.message });
        return;
      }

      try {
        const data = JSON.parse(body);
        const projId = resolveProjectId(data.project || projectManager.getActiveProject(), { required: true });
        const shotId = data.shotId;
        const variation = data.variation || 'A';

        if (!shotId) {
          sendJSON(res, 400, { success: false, error: 'shotId is required.' });
          return;
        }

        if (!replicate.isConfigured()) {
          sendJSON(res, 500, { success: false, error: 'Replicate API token not configured. Add REPLICATE_API_TOKEN to .env file.' });
          return;
        }

        const projectPath = projectManager.getProjectPath(projId);

        // Find the prompt file — try seedream first
        const shotNum = shotId.replace('SHOT_', '');
        const promptPath = path.join(projectPath, 'prompts', 'seedream', `shot_${shotNum}_${variation}.txt`);

        if (!fs.existsSync(promptPath)) {
          sendJSON(res, 404, { success: false, error: `Prompt file not found: prompts/seedream/shot_${shotNum}_${variation}.txt` });
          return;
        }

        const promptContent = fs.readFileSync(promptPath, 'utf-8');

        // Extract the SEEDREAM PROMPT section (between --- SEEDREAM PROMPT --- and --- NEGATIVE PROMPT ---)
        let prompt = promptContent;
        const promptStart = promptContent.indexOf('--- SEEDREAM PROMPT ---');
        const negStart = promptContent.indexOf('--- NEGATIVE PROMPT');
        if (promptStart !== -1 && negStart !== -1) {
          prompt = promptContent.substring(promptStart + '--- SEEDREAM PROMPT ---'.length, negStart).trim();
        } else if (promptStart !== -1) {
          prompt = promptContent.substring(promptStart + '--- SEEDREAM PROMPT ---'.length).trim();
        }

        if (!prompt) {
          sendJSON(res, 400, { success: false, error: 'Could not extract prompt text from file.' });
          return;
        }

        console.log(`[Generate Shot] ${shotId} variation ${variation} — ${prompt.substring(0, 80)}...`);

        // Find character reference images for image_input
        let imageInput = null;
        const shotListPath = path.join(projectPath, 'bible', 'shot_list.json');
        if (fs.existsSync(shotListPath)) {
          try {
            const shotList = JSON.parse(fs.readFileSync(shotListPath, 'utf-8'));
            const shot = shotList.shots ? shotList.shots.find(s => s.shotId === shotId) : null;

            if (shot && shot.characters && shot.characters.length > 0) {
              // Find primary character, or fallback to first
              const primaryChar = shot.characters.find(c => c.prominence === 'primary') || shot.characters[0];
              const charId = primaryChar.id;
              const charDir = path.join(projectPath, 'reference', 'characters', charId);

              if (fs.existsSync(charDir)) {
                // Try ref_1 (uploaded) first, then generated_01 (AI-generated)
                const candidates = ['ref_1.png', 'ref_1.jpg', 'ref_1.jpeg', 'ref_1.webp', 'generated_01.png'];
                for (const candidate of candidates) {
                  const refPath = path.join(charDir, candidate);
                  if (fs.existsSync(refPath)) {
                    const imgData = fs.readFileSync(refPath);
                    const ext = path.extname(candidate).slice(1);
                    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
                    imageInput = `data:${mimeType};base64,${imgData.toString('base64')}`;
                    console.log(`[Generate Shot] Using ref image: ${charId}/${candidate}`);
                    break;
                  }
                }
              }
            }
          } catch (shotListErr) {
            console.warn(`[Generate Shot] Could not read shot_list.json: ${shotListErr.message}`);
          }
        }

        const genOptions = {
          aspect_ratio: '16:9',
          sequential_image_generation: 'auto',
          max_images: 2
        };
        if (imageInput) {
          genOptions.image_input = imageInput;
        }

        const result = await replicate.createPrediction(prompt, genOptions);

        // Save output images
        const shotDir = path.join(projectPath, 'rendered', 'shots', shotId);
        if (!fs.existsSync(shotDir)) {
          fs.mkdirSync(shotDir, { recursive: true });
        }

        const outputs = Array.isArray(result.output) ? result.output : [result.output];
        const savedImages = [];
        const labels = ['first', 'last'];

        for (let i = 0; i < outputs.length && i < 2; i++) {
          const filename = `seedream_${variation}_${labels[i]}.png`;
          const savePath = path.join(shotDir, filename);
          await replicate.downloadImage(outputs[i], savePath);
          savedImages.push(`rendered/shots/${shotId}/${filename}`);
        }

        console.log(`[Generate Shot] Success — ${result.duration.toFixed(1)}s — ${savedImages.join(', ')}`);

        sendJSON(res, 200, {
          success: true,
          images: savedImages,
          predictionId: result.predictionId,
          duration: result.duration,
          hasReferenceImage: !!imageInput
        });

      } catch (genErr) {
        console.error(`[Generate Shot] Error: ${genErr.message}`);
        const statusCode = genErr.statusCode || 500;
        sendJSON(res, statusCode, { success: false, error: genErr.message });
      }
    });
    return;
  }

  // GET /api/shot-renders - Get existing rendered images for a shot
  if (req.method === 'GET' && req.url.startsWith('/api/shot-renders')) {
    const url = parseRequestUrl(req);
    const shotId = url.searchParams.get('shot');
    let projId;

    if (!shotId) {
      sendJSON(res, 400, { success: false, error: 'shot parameter is required.' });
      return;
    }

    try {
      projId = resolveProjectId(url.searchParams.get('project') || projectManager.getActiveProject(), { required: true });
      sanitizePathSegment(shotId, SHOT_ID_REGEX, 'shot');
    } catch (validationErr) {
      sendJSON(res, 400, { success: false, error: validationErr.message });
      return;
    }

    const shotDir = safeResolve(projectManager.getProjectPath(projId), 'rendered', 'shots', shotId);
    const renders = { seedream: {}, kling: {} };

    if (fs.existsSync(shotDir)) {
      try {
        const files = fs.readdirSync(shotDir);
        for (const file of files) {
          // Match pattern: {tool}_{variation}_{first|last}.{ext}
          const match = file.match(/^(seedream|kling)_([A-D])_(first|last)\.(png|jpg|jpeg|webp)$/);
          if (match) {
            const [, tool, variation, frame] = match;
            if (!renders[tool][variation]) {
              renders[tool][variation] = { first: null, last: null };
            }
            renders[tool][variation][frame] = `rendered/shots/${shotId}/${file}`;
          }
        }
      } catch (readErr) {
        console.warn(`[Shot Renders] Error reading ${shotDir}: ${readErr.message}`);
      }
    }

    sendJSON(res, 200, { success: true, renders });
    return;
  }

  // POST /api/upload/shot-render - Upload a first/last frame image for a shot
  if (req.method === 'POST' && req.url.startsWith('/api/upload/shot-render')) {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 20 * 1024 * 1024 } });
    let projectId = projectManager.getActiveProject();
    let shotId = '';
    let variation = 'A';
    let frame = '';
    let tool = 'seedream';
    let fileExt = '';
    const fileChunks = [];

    busboy.on('field', (name, val) => {
      if (name === 'project') projectId = val;
      if (name === 'shot') shotId = val;
      if (name === 'variation') variation = val;
      if (name === 'frame') frame = val;
      if (name === 'tool') tool = val;
    });

    busboy.on('file', (name, file, info) => {
      fileExt = path.extname(info.filename);
      file.on('data', (chunk) => { fileChunks.push(chunk); });
      file.on('error', (err) => {
        console.error('File stream error:', err);
        fileChunks.length = 0;
      });
    });

    busboy.on('close', () => {
      if (fileChunks.length === 0 || !shotId || !frame) {
        sendJSON(res, 400, { success: false, error: 'Missing file, shot ID, or frame type' });
        return;
      }

      if (!['first', 'last'].includes(frame)) {
        sendJSON(res, 400, { success: false, error: 'frame must be "first" or "last"' });
        return;
      }

      if (!['seedream', 'kling'].includes(tool)) {
        sendJSON(res, 400, { success: false, error: 'tool must be "seedream" or "kling"' });
        return;
      }

      try {
        projectId = resolveProjectId(projectId, { required: true });
        sanitizePathSegment(shotId, SHOT_ID_REGEX, 'shot');
        sanitizePathSegment(variation, VARIATION_REGEX, 'variation');
        if (!IMAGE_EXTENSIONS.has(fileExt.toLowerCase())) {
          throw new Error('Invalid image format');
        }

        const shotDir = safeResolve(projectManager.getProjectPath(projectId), 'rendered', 'shots', shotId);
        if (!fs.existsSync(shotDir)) {
          fs.mkdirSync(shotDir, { recursive: true });
        }

        // Remove any existing file at this slot (handles extension changes)
        const existingFiles = fs.readdirSync(shotDir);
        existingFiles.forEach(f => {
          if (f.startsWith(`${tool}_${variation}_${frame}.`)) {
            fs.unlinkSync(path.join(shotDir, f));
          }
        });

        const newFilename = `${tool}_${variation}_${frame}${fileExt}`;
        const savePath = path.join(shotDir, newFilename);
        fs.writeFileSync(savePath, Buffer.concat(fileChunks));

        const relativePath = `rendered/shots/${shotId}/${newFilename}`;
        console.log(`[Upload Shot Render] ${relativePath}`);

        sendJSON(res, 200, { success: true, filename: newFilename, path: relativePath });
      } catch (err) {
        console.error('Upload shot render error:', err);
        sendJSON(res, 500, { success: false, error: 'Failed to save image: ' + err.message });
      }
    });

    req.pipe(busboy);
    return;
  }

  // DELETE /api/delete/shot-render - Delete a specific shot render
  if (req.method === 'DELETE' && req.url.startsWith('/api/delete/shot-render')) {
    const url = parseRequestUrl(req);
    const shotId = url.searchParams.get('shot');
    const variation = url.searchParams.get('variation') || 'A';
    const frame = url.searchParams.get('frame');
    const tool = url.searchParams.get('tool') || 'seedream';

    if (!shotId || !frame) {
      sendJSON(res, 400, { success: false, error: 'shot and frame parameters are required' });
      return;
    }

    let projId;
    let shotDir;
    try {
      projId = resolveProjectId(url.searchParams.get('project') || projectManager.getActiveProject(), { required: true });
      sanitizePathSegment(shotId, SHOT_ID_REGEX, 'shot');
      sanitizePathSegment(variation, VARIATION_REGEX, 'variation');
      sanitizePathSegment(frame, /^(first|last)$/, 'frame');
      sanitizePathSegment(tool, /^(seedream|kling)$/, 'tool');
      shotDir = safeResolve(projectManager.getProjectPath(projId), 'rendered', 'shots', shotId);
    } catch (validationErr) {
      sendJSON(res, 400, { success: false, error: validationErr.message });
      return;
    }

    try {
      if (!fs.existsSync(shotDir)) {
        sendJSON(res, 404, { success: false, error: 'Shot directory not found' });
        return;
      }

      const files = fs.readdirSync(shotDir);
      const fileToDelete = files.find(f => f.startsWith(`${tool}_${variation}_${frame}.`));

      if (fileToDelete) {
        fs.unlinkSync(path.join(shotDir, fileToDelete));
        console.log(`[Delete Shot Render] ${shotId}/${fileToDelete}`);
        sendJSON(res, 200, { success: true, message: 'Render deleted' });
      } else {
        sendJSON(res, 404, { success: false, error: 'Render file not found' });
      }
    } catch (err) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // ===== GET FILE ROUTES =====

  let filePath;
  const requestUrl = parseRequestUrl(req);
  const requestPath = requestUrl.pathname;

  // Extract project context for project-specific routes
  let projectId;
  try {
    projectId = getProjectContext(req).projectId;
  } catch (ctxErr) {
    sendJSON(res, 400, { success: false, error: ctxErr.message });
    return;
  }

  try {
    // Serve rendered files (project-specific)
    if (requestPath.startsWith('/rendered/')) {
      const cleanPath = requestPath.replace(/^\/+/, '');
      filePath = safeResolve(projectManager.getProjectPath(projectId), cleanPath);
    } else if (requestPath.startsWith('/music/')) {
      const cleanPath = requestPath.replace(/^\/+/, '');
      filePath = safeResolve(projectManager.getProjectPath(projectId), cleanPath);
    } else if (requestPath.startsWith('/projects/')) {
      // Serve project files (including reference images)
      const cleanPath = requestPath.replace(/^\/projects\//, '');
      filePath = safeResolve(PROJECTS_DIR, cleanPath);
    } else if (requestPath === '/' || requestPath === '/index.html') {
      filePath = path.join(UI_DIR, 'index.html');
    } else if (requestPath.startsWith('/ui/')) {
      // UI assets
      filePath = safeResolve(ROOT_DIR, requestPath.replace(/^\/+/, ''));
    } else if (requestPath.startsWith('/prompts_index.json')) {
      // Serve prompts index (project-specific)
      filePath = path.join(projectManager.getProjectPath(projectId), 'prompts_index.json');
    } else if (requestPath.startsWith('/lint/report.json')) {
      // Serve lint report (project-specific)
      filePath = path.join(projectManager.getProjectPath(projectId), 'lint', 'report.json');
    } else if (requestPath === '/prompts/ai_music_analysis_prompt.txt') {
      // Serve AI analysis prompt (shared, not project-specific)
      filePath = path.join(ROOT_DIR, 'prompts', 'ai_music_analysis_prompt.txt');
    } else if (requestPath.startsWith('/prompts/')) {
      // Serve prompt files (project-specific)
      const cleanPath = requestPath.replace(/^\/+/, '');
      filePath = safeResolve(projectManager.getProjectPath(projectId), cleanPath);
    } else {
      // Try serving from UI directory
      filePath = safeResolve(UI_DIR, requestPath.replace(/^\/+/, ''));
    }
  } catch (pathErr) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 - Forbidden</h1>');
    return;
  }

  // Security check - prevent directory traversal
  const normalizedPath = path.resolve(filePath);
  if (!normalizedPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 - Forbidden</h1>');
    return;
  }

  serveFile(res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   PROMPT COMPILER UI SERVER                  ║');
  console.log('║   Version: 2026-02-07 (with file uploads)   ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`Server running at http://${HOST}:${PORT}/`);
  console.log('\nPress Ctrl+C to stop the server.\n');
  console.log('UI Features:');
  console.log('  - Browse all prompts by shot and tool');
  console.log('  - Toggle between A/B/C/D variations (Kling)');
  console.log('  - Copy prompts to clipboard');
  console.log('  - View lint status for each prompt');
  console.log('  - Search and filter prompts');
  console.log('  - Drag-and-drop file uploads (music + shots)\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Try stopping other servers or change the PORT in ${__filename}\n`);
  } else {
    console.error('\n❌ Server error:', err.message, '\n');
  }
  process.exit(1);
});
