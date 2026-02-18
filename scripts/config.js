'use strict';

// --- Helper: parse env var as integer with fallback ---
function envInt(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// ===== Validation regexes =====
const PROJECT_ID_REGEX = /^[a-z0-9-]{1,50}$/;
const SHOT_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const VARIATION_REGEX = /^[A-D]$/;
// Allow human-readable reference names with spaces while requiring at least one
// alphanumeric character to avoid empty/whitespace-only values.
const CHARACTER_REGEX = /^(?=.*[A-Za-z0-9])[A-Za-z0-9 _-]{1,64}$/;
const LOCATION_REGEX = /^(?=.*[A-Za-z0-9])[A-Za-z0-9 _-]{1,64}$/;
const REVIEW_STATUS_VALUES = new Set(['draft', 'ready_for_review', 'changes_requested', 'approved']);

// ===== Image file extensions =====
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// ===== File type constraints =====
const ALLOWED_MUSIC_TYPES = ['.mp3'];
const ALLOWED_VIDEO_TYPES = ['.mp4', '.mov'];
const ALLOWED_IMAGE_TYPES = ['.png', '.jpg', '.jpeg'];
const ALLOWED_CANON_TYPES = ['characters', 'locations', 'cinematography', 'style', 'script', 'transcript', 'assets', 'youtubeScript'];

// ===== Size limits (env overridable) =====
const MAX_MUSIC_SIZE = envInt('MAX_MUSIC_SIZE', 50 * 1024 * 1024);      // 50MB
const MAX_VIDEO_SIZE = envInt('MAX_VIDEO_SIZE', 500 * 1024 * 1024);     // 500MB
const MAX_IMAGE_SIZE = envInt('MAX_IMAGE_SIZE', 10 * 1024 * 1024);      // 10MB
const MAX_UPLOAD_SIZE = envInt('MAX_UPLOAD_SIZE', 20 * 1024 * 1024);    // 20MB — busboy default per-file limit
const MAX_BODY_SIZE = envInt('MAX_BODY_SIZE', 1024 * 1024);             // 1MB
const MAX_REFERENCE_IMAGES = envInt('MAX_REFERENCE_IMAGES', 14);

// ===== Timeout / limit constants (env overridable) =====
const HTTP_TIMEOUT_MS = envInt('HTTP_TIMEOUT_MS', 120000);                         // 2 min — shared HTTP request timeout
const GENERATION_SOCKET_TIMEOUT_MS = envInt('GENERATION_SOCKET_TIMEOUT_MS', 300000); // 5 min — SSE generation stream timeout
const LONG_RUNNING_TIMEOUT_MS = envInt('LONG_RUNNING_TIMEOUT_MS', 330000);          // 5.5 min — SSE/generation/export routes
const REQUEST_TIMEOUT_MS = envInt('REQUEST_TIMEOUT_MS', 30000);                     // 30s — default per-request timeout
const SHUTDOWN_TIMEOUT_MS = envInt('SHUTDOWN_TIMEOUT_MS', 10000);                   // 10s — graceful shutdown drain
const SSE_HEARTBEAT_MS = envInt('SSE_HEARTBEAT_MS', 15000);                         // 15s — SSE keep-alive ping interval

// ===== Session constants =====
const SESSION_TTL_MS = envInt('SESSION_TTL_MS', 12 * 60 * 60 * 1000);   // 12 hours
const SESSION_CLEANUP_MS = envInt('SESSION_CLEANUP_MS', 10 * 60 * 1000); // 10 min cleanup sweep

// ===== Chat limits =====
const MAX_CHAT_MESSAGE_CHARS = envInt('MAX_CHAT_MESSAGE_CHARS', 4000);
const MAX_CHAT_MODEL_HISTORY = envInt('MAX_CHAT_MODEL_HISTORY', 8);

// ===== File locking =====
const LOCK_STALE_MS = envInt('LOCK_STALE_MS', 10000);    // 10s — lock considered stale after this
const LOCK_RETRY_MS = envInt('LOCK_RETRY_MS', 50);       // base retry delay with jitter
const LOCK_MAX_RETRIES = envInt('LOCK_MAX_RETRIES', 60);  // ~3s total wait

// ===== Agent constraints =====
const AGENT_MODES = new Set(['generate', 'revise']);
const AGENT_TOOLS = new Set(['seedream', 'kling', 'nanobanana', 'suno']);

module.exports = {
  envInt,
  PROJECT_ID_REGEX,
  SHOT_ID_REGEX,
  VARIATION_REGEX,
  CHARACTER_REGEX,
  LOCATION_REGEX,
  REVIEW_STATUS_VALUES,
  IMAGE_EXTENSIONS,
  ALLOWED_MUSIC_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_CANON_TYPES,
  MAX_MUSIC_SIZE,
  MAX_VIDEO_SIZE,
  MAX_IMAGE_SIZE,
  MAX_UPLOAD_SIZE,
  MAX_BODY_SIZE,
  MAX_REFERENCE_IMAGES,
  HTTP_TIMEOUT_MS,
  GENERATION_SOCKET_TIMEOUT_MS,
  LONG_RUNNING_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  SHUTDOWN_TIMEOUT_MS,
  SSE_HEARTBEAT_MS,
  SESSION_TTL_MS,
  SESSION_CLEANUP_MS,
  MAX_CHAT_MESSAGE_CHARS,
  MAX_CHAT_MODEL_HISTORY,
  LOCK_STALE_MS,
  LOCK_RETRY_MS,
  LOCK_MAX_RETRIES,
  AGENT_MODES,
  AGENT_TOOLS
};
