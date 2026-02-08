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

const PORT = 8000;
const UI_DIR = path.join(__dirname, '..', 'ui');
const ROOT_DIR = path.join(__dirname, '..');

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

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'text/plain';
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>');
      return;
    }

    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(data);
  });
}

/**
 * Parse multipart/form-data from request
 */
function parseMultipartData(req, callback) {
  const busboy = Busboy({ headers: req.headers });
  const fields = {};
  const files = [];

  busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  busboy.on('file', (fieldname, file, info) => {
    const chunks = [];
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
    callback(null, { fields, files });
  });

  busboy.on('error', (err) => {
    callback(err);
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
function getProjectContext(req) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const projectId = url.searchParams.get('project') || 'default';

    if (!projectManager.projectExists(projectId)) {
      throw new Error(`Project '${projectId}' not found`);
    }

    return { projectId };
  } catch (err) {
    // If project doesn't exist, default to 'default' (will be created by migration)
    return { projectId: 'default' };
  }
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

/**
 * Send JSON response
 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
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
        sendJSON(res, 400, { success: false, error: 'No file provided' });
        return;
      }

      // Get project context
      const { projectId } = getProjectContext(req);

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
        sendJSON(res, 400, { success: false, error: 'No file provided' });
        return;
      }

      // Get project context
      const { projectId } = getProjectContext(req);

      const { shotId, variation, fileType } = fields;
      const file = files[0];

      if (!shotId || !variation || !fileType) {
        sendJSON(res, 400, { success: false, error: 'Missing parameters' });
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

  // ===== GET FILE ROUTES =====

  let filePath;

  // Extract project context for project-specific routes
  const { projectId } = getProjectContext(req);

  // Serve rendered files (project-specific)
  if (req.url.startsWith('/rendered/')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const cleanPath = url.pathname; // Remove query string
    filePath = path.join(projectManager.getProjectPath(projectId), cleanPath);
  } else if (req.url.startsWith('/music/')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const cleanPath = url.pathname;
    filePath = path.join(projectManager.getProjectPath(projectId), cleanPath);
  } else if (req.url === '/' || req.url === '/index.html') {
    filePath = path.join(UI_DIR, 'index.html');
  } else if (req.url.startsWith('/ui/')) {
    // UI assets
    filePath = path.join(ROOT_DIR, req.url);
  } else if (req.url.startsWith('/prompts_index.json')) {
    // Serve prompts index (project-specific)
    filePath = path.join(projectManager.getProjectPath(projectId), 'prompts_index.json');
  } else if (req.url.startsWith('/lint/report.json')) {
    // Serve lint report (project-specific)
    filePath = path.join(projectManager.getProjectPath(projectId), 'lint', 'report.json');
  } else if (req.url.startsWith('/prompts/')) {
    // Serve prompt files (project-specific)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const cleanPath = url.pathname;
    filePath = path.join(projectManager.getProjectPath(projectId), cleanPath);
  } else {
    // Try serving from UI directory
    filePath = path.join(UI_DIR, req.url);
  }

  // Security check - prevent directory traversal
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 - Forbidden</h1>');
    return;
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   PROMPT COMPILER UI SERVER                  ║');
  console.log('║   Version: 2026-02-07 (with file uploads)   ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`Server running at http://localhost:${PORT}/`);
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
