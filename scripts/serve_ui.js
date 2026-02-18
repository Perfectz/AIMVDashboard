#!/usr/bin/env node

/**
 * Simple HTTP server for viewing the Prompt Compiler UI
 * Version: 2026-02-07
 *
 * Phase 4: Domain logic extracted into dedicated service modules under scripts/services/.
 * This file is now a thin bootstrap that wires services together and starts the server.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { createRouter } = require('./router');
const { requestLogger } = require('./middleware/logger');
const { wrapAsync } = require('./middleware/error-handler');
const { jsonBody } = require('./middleware/body-parser');
const { createHttpUtils } = require('./middleware/http-utils');
const { parseMultipartData } = require('./middleware/busboy-upload');
const projectManager = require('./project_manager');
const replicate = require('./replicate_client');
const { runCompile } = require('./compile_prompts');
const { runGenerateIndex } = require('./generate_index');
const { runLinter } = require('../lint/linter');
const {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchUserProfile
} = require('./services/github_auth_service');
const { AgentRuntimeService } = require('./services/agent_runtime_service');
const { GenerationJobsService } = require('./services/generation_jobs_service');
const { createSessionService } = require('./services/session_service');
const { createStoryboardPersistenceService } = require('./services/storyboard_persistence_service');
const {
  sanitizeReviewMetadata,
  getReviewMetadataMap
} = require('./services/review_metadata_service');
const { createRenderManagementService } = require('./services/render_management_service');
const { createGenerationTaskService } = require('./services/generation_task_service');
const { createContextBundleService } = require('./services/context_bundle_service');
const { createPipelineStatusService } = require('./services/pipeline_status_service');
const { createPageChatStoreService } = require('./services/page_chat_store_service');
const { createPageChatContextService } = require('./services/page_chat_context_service');
const { createPageChatApplyService } = require('./services/page_chat_apply_service');
const { createPageChatService } = require('./services/page_chat_service');
const { createAiProviderService } = require('./services/ai_provider_service');
const { registerAuthRoutes } = require('./routes/auth');
const { registerProjectRoutes } = require('./routes/projects');
const { registerBootstrapRoutes } = require('./routes/bootstrap');
const { registerPageChatRoutes } = require('./routes/page-chat');
const { registerPipelineRoutes } = require('./routes/pipeline');
const { registerAgentRoutes } = require('./routes/agents');
const { registerGenerationJobRoutes } = require('./routes/generation-jobs');
const { registerStoryboardRoutes } = require('./routes/storyboard');
const { registerContentRoutes } = require('./routes/content');
const { registerCanonRoutes } = require('./routes/canon');
const { registerReferenceRoutes } = require('./routes/references');
const { registerUploadRoutes } = require('./routes/uploads');
const { registerGenerationRoutes } = require('./routes/generation');
const { registerAiProviderRoutes } = require('./routes/ai-provider');
const { registerStaticRoutes } = require('./routes/static');
const { createDatabaseService } = require('./services/database_service');
const { createAuthMiddleware } = require('./middleware/auth');
const {
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
} = require('./shared');
const {
  PROJECT_ID_REGEX, SHOT_ID_REGEX, VARIATION_REGEX,
  CHARACTER_REGEX, LOCATION_REGEX, IMAGE_EXTENSIONS,
  ALLOWED_MUSIC_TYPES, ALLOWED_VIDEO_TYPES, ALLOWED_IMAGE_TYPES,
  ALLOWED_CANON_TYPES,
  MAX_MUSIC_SIZE, MAX_VIDEO_SIZE, MAX_IMAGE_SIZE,
  MAX_BODY_SIZE, MAX_REFERENCE_IMAGES,
  AGENT_MODES, AGENT_TOOLS,
  REQUEST_TIMEOUT_MS, LONG_RUNNING_TIMEOUT_MS, SHUTDOWN_TIMEOUT_MS
} = require('./config');

const parsedPort = Number(process.env.PORT);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 8000;
const HOST = process.env.HOST || '0.0.0.0';
const UI_DIR = path.join(__dirname, '..', 'ui');
const ROOT_DIR = path.join(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT_DIR, 'projects');

const ALLOWED_ORIGINS = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
]);

// ===== HTTP utilities (from middleware) =====
const { sendJSON, sendSseEvent, corsHeadersForRequest, serveFile } = createHttpUtils(ALLOWED_ORIGINS);

// ===== Database & Auth =====

const databaseService = createDatabaseService({ dataDir: path.join(ROOT_DIR, 'data') });
databaseService.init();

const authMiddleware = createAuthMiddleware({ databaseService, sendJSON, jsonBody, MAX_BODY_SIZE });

// ===== Instantiate services =====

const aiProvider = createAiProviderService();
const agentRuntime = new AgentRuntimeService({ aiProvider });
const generationJobs = new GenerationJobsService({ projectManager });

const sessionService = createSessionService({ host: HOST, port: PORT });
const storyboardPersistence = createStoryboardPersistenceService({ projectManager });
const renderManagement = createRenderManagementService({ projectManager, storyboardPersistence });
const generationTasks = createGenerationTaskService({
  projectManager,
  replicate,
  generationJobs,
  renderManagement,
  storyboardPersistence
});
const contextBundle = createContextBundleService({ projectManager });
const pipelineStatus = createPipelineStatusService({ projectManager });
const pageChatStore = createPageChatStoreService({ projectManager });
const pageChatContext = createPageChatContextService({ projectManager, canonFilename });
const pageChatApply = createPageChatApplyService({
  projectManager,
  canonFilename,
  contextService: pageChatContext
});
const pageChatService = createPageChatService({
  store: pageChatStore,
  contextService: pageChatContext,
  applyService: pageChatApply,
  aiProvider
});

// ===== Utility functions that remain in serve_ui.js =====

function isValidProjectId(value) {
  return PROJECT_ID_REGEX.test(value || '');
}

function parseRequestUrl(req) {
  return new URL(req.url, `http://${req.headers.host}`);
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

function canonFilename(type) {
  const map = {
    'style': 'visual_style.json',
    'script': 'shot_list.json',
    'transcript': 'transcript.json',
    'assets': 'asset_manifest.json',
    'youtubeScript': 'youtube_script.json'
  };
  return map[type] || `${type}.json`;
}

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

function getProjectContext(req, { required = false } = {}) {
  const url = parseRequestUrl(req);
  const requested = url.searchParams.get('project');
  const projectId = requested || projectManager.getActiveProject();
  return { projectId: resolveProjectId(projectId, { required }) };
}

// HTTP utilities (sendJSON, serveFile, etc.) are created below after ALLOWED_ORIGINS is defined

// ===== Router setup =====

const router = createRouter();
router.use(requestLogger);

// ===== Health Check (before auth — accessible for monitoring) =====
const SERVER_START_TIME = Date.now();

router.get('/api/health', wrapAsync(async (req, res) => {
  const uptimeMs = Date.now() - SERVER_START_TIME;
  const memUsage = process.memoryUsage();
  sendJSON(res, 200, {
    success: true,
    status: 'ok',
    uptime: Math.floor(uptimeMs / 1000),
    uptimeFormatted: `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`,
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
    },
    activeProject: projectManager.getActiveProject(),
    timestamp: new Date().toISOString()
  });
}));

// Auth middleware — checks session before other routes
router.use((req, res) => {
  return authMiddleware.requireAuth(req, res);
});

// Register auth API routes (login, logout, register)
authMiddleware.registerAuthApiRoutes(router, wrapAsync);

// ===== Domain-scoped route contexts =====
// Each route module receives only the dependencies it actually uses.

const sharedCtx = {
  sendJSON, wrapAsync, jsonBody, MAX_BODY_SIZE,
  projectManager, resolveProjectId
};

registerAuthRoutes(router, {
  ...sharedCtx,
  ensureSession: sessionService.ensureSession,
  getGitHubAuthPayload: sessionService.getGitHubAuthPayload,
  getGitHubOAuthConfigPayload: sessionService.getGitHubOAuthConfigPayload,
  normalizeReturnToPath: sessionService.normalizeReturnToPath,
  resolveGitHubOAuthRedirectUri: sessionService.resolveGitHubOAuthRedirectUri,
  resolveGitHubOAuthClientId: sessionService.resolveGitHubOAuthClientId,
  resolveGitHubOAuthClientSecret: sessionService.resolveGitHubOAuthClientSecret,
  clearGitHubSessionAuth: sessionService.clearGitHubSessionAuth,
  setGitHubOAuthConfig: sessionService.setGitHubOAuthConfig,
  clearGitHubOAuthConfig: sessionService.clearGitHubOAuthConfig,
  appendQueryParam: sessionService.appendQueryParam,
  buildAuthorizeUrl, exchangeCodeForToken, fetchUserProfile,
  corsHeadersForRequest
});

registerProjectRoutes(router, {
  ...sharedCtx,
  parseMultipartData
});

registerBootstrapRoutes(router, {
  ...sharedCtx,
  ensureSession: sessionService.ensureSession,
  getGitHubAuthPayload: sessionService.getGitHubAuthPayload,
  getGitHubOAuthConfigPayload: sessionService.getGitHubOAuthConfigPayload,
  replicate,
  getPipelineStatus: pipelineStatus.getPipelineStatus
});

registerPageChatRoutes(router, {
  ...sharedCtx,
  ensureSession: sessionService.ensureSession,
  getGitHubAuthPayload: sessionService.getGitHubAuthPayload,
  pageChatService, pageChatStore, aiProvider
});

registerPipelineRoutes(router, {
  ...sharedCtx,
  getPipelineStatus: pipelineStatus.getPipelineStatus,
  updatePipelineStatus: pipelineStatus.updatePipelineStatus,
  runCompile, runLinter, runGenerateIndex
});

registerAgentRoutes(router, {
  ...sharedCtx,
  sanitizePathSegment, SHOT_ID_REGEX, VARIATION_REGEX,
  AGENT_MODES, AGENT_TOOLS,
  ensureSession: sessionService.ensureSession,
  agentRuntime, aiProvider, sendSseEvent, corsHeadersForRequest
});

registerGenerationJobRoutes(router, {
  ...sharedCtx,
  sanitizePathSegment, SHOT_ID_REGEX, VARIATION_REGEX,
  generationJobs,
  startGenerationJob: generationTasks.startGenerationJob,
  sendSseEvent, corsHeadersForRequest
});

registerStoryboardRoutes(router, {
  ...sharedCtx,
  getProjectContext, sanitizePathSegment,
  SHOT_ID_REGEX, VARIATION_REGEX,
  readPrevisMapFile: storyboardPersistence.readPrevisMapFile,
  writePrevisMapFile: storyboardPersistence.writePrevisMapFile,
  validatePrevisEntry: storyboardPersistence.validatePrevisEntry,
  readSequenceFile: storyboardPersistence.readSequenceFile,
  writeSequenceFile: storyboardPersistence.writeSequenceFile,
  normalizeSequenceReviewFields: storyboardPersistence.normalizeSequenceReviewFields,
  normalizeShotReviewFields: storyboardPersistence.normalizeShotReviewFields,
  normalizeAssignee: storyboardPersistence.normalizeAssignee,
  getReviewMetadataMap, sanitizeReviewMetadata,
  writeJsonPreserveEol,
  listShotRenderEntries: renderManagement.listShotRenderEntries
});

registerContentRoutes(router, {
  ...sharedCtx,
  getProjectContext,
  buildContextBundle: contextBundle.buildContextBundle
});

registerCanonRoutes(router, {
  ...sharedCtx,
  ALLOWED_CANON_TYPES, canonFilename
});

registerReferenceRoutes(router, {
  ...sharedCtx,
  safeResolve,
  sanitizePathSegment,
  CHARACTER_REGEX,
  LOCATION_REGEX,
  IMAGE_EXTENSIONS
});

registerUploadRoutes(router, {
  ...sharedCtx,
  getProjectContext, parseMultipartData,
  validateFile, sanitizeFilename, sanitizePathSegment,
  SHOT_ID_REGEX, VARIATION_REGEX,
  ALLOWED_MUSIC_TYPES, ALLOWED_VIDEO_TYPES, ALLOWED_IMAGE_TYPES,
  MAX_MUSIC_SIZE, MAX_VIDEO_SIZE, MAX_IMAGE_SIZE,
  readSequenceFile: storyboardPersistence.readSequenceFile,
  writeSequenceFile: storyboardPersistence.writeSequenceFile,
  normalizeShotReviewFields: storyboardPersistence.normalizeShotReviewFields
});

registerGenerationRoutes(router, {
  ...sharedCtx,
  sanitizePathSegment, safeResolve,
  SHOT_ID_REGEX, VARIATION_REGEX,
  IMAGE_EXTENSIONS, MAX_REFERENCE_IMAGES,
  replicate,
  executeGenerateImageTask: generationTasks.executeGenerateImageTask,
  executeGenerateShotTask: generationTasks.executeGenerateShotTask,
  buildShotGenerationPreflight: generationTasks.buildShotGenerationPreflight,
  isPreviewPathForShot: renderManagement.isPreviewPathForShot,
  listShotRenderEntries: renderManagement.listShotRenderEntries,
  readPrevisMapFile: storyboardPersistence.readPrevisMapFile,
  resolveSeedreamContinuityForShot: renderManagement.resolveSeedreamContinuityForShot,
  resolvePreviousShotLastFrame: renderManagement.resolvePreviousShotLastFrame,
  getOrderedReferenceFiles: renderManagement.getOrderedReferenceFiles,
  getOrderedShotIds: renderManagement.getOrderedShotIds,
  getPreviousShotId: renderManagement.getPreviousShotId,
  collectShotReferenceImagePaths: renderManagement.collectShotReferenceImagePaths,
  syncShotReferenceSetFiles: renderManagement.syncShotReferenceSetFiles,
  readSequenceFile: storyboardPersistence.readSequenceFile
});

registerAiProviderRoutes(router, {
  ...sharedCtx,
  aiProvider
});

registerStaticRoutes(router, {
  sendJSON, getProjectContext, projectManager,
  safeResolve, ROOT_DIR, UI_DIR, PROJECTS_DIR, serveFile
});

// ===== HTTPS Support =====
const HTTPS_ENABLED = String(process.env.HTTPS_ENABLED || '').trim().toLowerCase() === 'true';
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH || './certs/key.pem';
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH || './certs/cert.pem';

function createServerInstance(handler) {
  if (HTTPS_ENABLED) {
    try {
      const key = fs.readFileSync(path.resolve(ROOT_DIR, HTTPS_KEY_PATH));
      const cert = fs.readFileSync(path.resolve(ROOT_DIR, HTTPS_CERT_PATH));
      console.log('[HTTPS] TLS certificates loaded');
      return https.createServer({ key, cert }, handler);
    } catch (err) {
      console.warn('[HTTPS] Failed to load certificates:', err.message);
      console.warn('[HTTPS] Falling back to HTTP');
    }
  }
  return http.createServer(handler);
}

// ===== Global Request Timeout =====

const server = createServerInstance((req, res) => {
  // Set global request timeout (extended for SSE/generation routes)
  const urlPath = String(req.url || '').split('?')[0];
  const isLongRunning = urlPath.includes('/events') || urlPath.includes('/generate') || urlPath.includes('/export-video');
  req.setTimeout(isLongRunning ? LONG_RUNNING_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  res.setTimeout(isLongRunning ? LONG_RUNNING_TIMEOUT_MS : REQUEST_TIMEOUT_MS, () => {
    if (!res.writableEnded) {
      logger.warn('Response timeout', { method: req.method, path: urlPath, requestId: req._requestId });
      res.writeHead(408, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Request timed out' }));
    }
  });

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

  if (router.handle(req, res)) {
    return;
  }

  const requestPath = String(req.url || '').split('?')[0];
  if (requestPath.startsWith('/api/')) {
    sendJSON(res, 404, { success: false, error: 'Not found' });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end('<h1>404 - File Not Found</h1>');
});
server.listen(PORT, HOST, () => {
  logger.info('Server started', { host: HOST, port: PORT, https: HTTPS_ENABLED });
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   PROMPT COMPILER UI SERVER                  ║');
  console.log('║   Version: 2026-02-17 (reliability update)  ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`Server running at http://${HOST}:${PORT}/`);
  if (HOST === '0.0.0.0') {
    console.log(`Local access: http://127.0.0.1:${PORT}/`);
  }
  console.log(`Health check: http://127.0.0.1:${PORT}/api/health`);
  console.log(`Request timeout: ${REQUEST_TIMEOUT_MS}ms (long-running: ${LONG_RUNNING_TIMEOUT_MS}ms)`);
  console.log('\nPress Ctrl+C to stop the server.\n');
});

// ===== Graceful shutdown =====
let _shuttingDown = false;

function gracefulShutdown(signal) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  logger.info('Graceful shutdown initiated', { signal });

  // Stop accepting new connections
  server.close(() => {
    logger.info('All connections drained');
    databaseService.close();
    process.exit(0);
  });

  // Force exit after timeout if connections don't drain
  setTimeout(() => {
    logger.warn('Shutdown timeout reached, forcing exit', { timeoutMs: SHUTDOWN_TIMEOUT_MS });
    databaseService.close();
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ===== Crash handlers =====
process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught exception — initiating shutdown', {
    error: err.message,
    stack: err.stack
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.error('Unhandled promise rejection', { error: message, stack });
  // Don't crash on unhandled rejections, but log them loudly
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.fatal('Port already in use', { port: PORT });
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Try stopping other servers or change the PORT in ${__filename}\n`);
  } else {
    logger.fatal('Server error', { error: err.message });
  }
  process.exit(1);
});
