'use strict';

// Validation regexes
const PROJECT_ID_REGEX = /^[a-z0-9-]{1,50}$/;
const SHOT_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const VARIATION_REGEX = /^[A-D]$/;
const CHARACTER_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const LOCATION_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const REVIEW_STATUS_VALUES = new Set(['draft', 'ready_for_review', 'changes_requested', 'approved']);

// Image file extensions
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// File type constraints
const ALLOWED_MUSIC_TYPES = ['.mp3'];
const ALLOWED_VIDEO_TYPES = ['.mp4', '.mov'];
const ALLOWED_IMAGE_TYPES = ['.png', '.jpg', '.jpeg'];
const ALLOWED_CANON_TYPES = ['characters', 'locations', 'cinematography', 'style', 'script', 'transcript', 'assets', 'youtubeScript'];

// Size limits
const MAX_MUSIC_SIZE = 50 * 1024 * 1024;   // 50MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;  // 500MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10MB
const MAX_BODY_SIZE = 1024 * 1024;          // 1MB
const MAX_REFERENCE_IMAGES = 14;

// Agent constraints
const AGENT_MODES = new Set(['generate', 'revise']);
const AGENT_TOOLS = new Set(['seedream', 'kling', 'nanobanana', 'suno']);

module.exports = {
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
  MAX_BODY_SIZE,
  MAX_REFERENCE_IMAGES,
  AGENT_MODES,
  AGENT_TOOLS
};
