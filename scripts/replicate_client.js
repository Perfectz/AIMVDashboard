/**
 * Replicate API Client — SeedDream v4.5
 * Zero dependencies (uses built-in https module)
 *
 * Shared by CLI script and server endpoint.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODEL_OWNER = process.env.REPLICATE_MODEL_OWNER || 'bytedance';
const MODEL_NAME = process.env.REPLICATE_MODEL_NAME || 'seedream-4.5';
const MODEL_VERSION = (process.env.REPLICATE_MODEL_VERSION || '').trim() || null;
const API_HOST = 'api.replicate.com';
const LOCAL_REPLICATE_API_TOKEN = '';
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const INITIAL_POLL_INTERVAL_MS = 2000;
const MAX_POLL_INTERVAL_MS = 15000;
const MAX_TOTAL_IMAGES = 15;
const MAX_REFERENCE_IMAGES = 14;
const MAX_GENERATED_IMAGES = 4;
const DEFAULT_MAX_IMAGES = 1;
const PLACEHOLDER_TOKEN_PATTERN = /^r8_your_token_here$/i;
const LOCAL_HOST_ALLOWLIST = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '']);
const LOCAL_RUNTIME_BLOCKLIST_ENV = [
  'VERCEL',
  'RENDER',
  'RAILWAY_ENVIRONMENT',
  'HEROKU_APP_ID',
  'K_SERVICE',
  'AWS_EXECUTION_ENV',
  'AWS_LAMBDA_FUNCTION_NAME',
  'FLY_APP_NAME',
  'CI'
];

let cachedToken = null;
let sessionToken = null;
let cachedTokenSource = null;

function normalizeToken(value) {
  let token = String(value || '').trim();
  if ((token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }
  return token;
}

function isPlaceholderToken(token) {
  return PLACEHOLDER_TOKEN_PATTERN.test(String(token || '').trim());
}

function cacheToken(token, source) {
  cachedToken = token;
  cachedTokenSource = source;
  return token;
}

function isLocalRuntime() {
  const forcedLocal = String(process.env.AIMV_FORCE_LOCAL || '').trim() === '1';
  if (forcedLocal) return true;

  const host = String(process.env.HOST || '').trim().toLowerCase();
  const isLocalHost = LOCAL_HOST_ALLOWLIST.has(host);
  if (!isLocalHost) return false;

  const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
  if (isProduction) return false;

  const blocked = LOCAL_RUNTIME_BLOCKLIST_ENV.some((key) => {
    return String(process.env[key] || '').trim() !== '';
  });
  return !blocked;
}

/**
 * Load REPLICATE_API_TOKEN from .env file at project root.
 * Parses manually — no dotenv dependency.
 */
function loadApiToken() {
  if (sessionToken) return sessionToken;
  if (cachedToken) return cachedToken;

  if (isLocalRuntime()) {
    return cacheToken(LOCAL_REPLICATE_API_TOKEN, 'local');
  }

  // Check environment variable first
  if (process.env.REPLICATE_API_TOKEN) {
    const envToken = normalizeToken(process.env.REPLICATE_API_TOKEN);
    if (envToken && !isPlaceholderToken(envToken)) {
      return cacheToken(envToken, 'env');
    }
  }

  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^REPLICATE_API_TOKEN\s*=\s*(.+)$/);
      if (match) {
        const fileToken = normalizeToken(match[1]);
        if (fileToken && !isPlaceholderToken(fileToken)) {
          return cacheToken(fileToken, 'env');
        }
      }
    }
  }

  throw new Error(
    'Replicate API token not configured.\n' +
    'Set REPLICATE_API_TOKEN in your environment or .env file.'
  );
}

/**
 * Check if the API token is configured (without throwing).
 */
function isConfigured() {
  try {
    loadApiToken();
    return true;
  } catch {
    return false;
  }
}

/**
 * Make an HTTPS request to the Replicate API.
 */
function makeRequest(method, apiPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const token = loadApiToken();
    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: API_HOST,
      path: apiPath,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...extraHeaders
      }
    };

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString();
        let parsed;
        try {
          parsed = JSON.parse(responseBody);
        } catch {
          parsed = { raw: responseBody };
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const errMsg = parsed.detail || parsed.error || parsed.raw || `HTTP ${res.statusCode}`;
          const err = new Error(errMsg);
          err.statusCode = res.statusCode;
          err.body = parsed;
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Request timed out'));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function clampInteger(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

function normalizeImageInputList(imageInput) {
  const rawList = Array.isArray(imageInput) ? imageInput : [imageInput];
  const filtered = rawList
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);

  if (filtered.length === 0) return [];
  return filtered.slice(0, MAX_REFERENCE_IMAGES);
}

function normalizePredictionInput(prompt, options = {}) {
  const input = { prompt: String(prompt || '') };

  const imageInput = normalizeImageInputList(options.image_input);
  if (imageInput.length > 0) {
    input.image_input = imageInput;
  }

  if (options.size) input.size = options.size;
  if (options.aspect_ratio) input.aspect_ratio = options.aspect_ratio;
  if (options.width) input.width = options.width;
  if (options.height) input.height = options.height;
  if (options.sequential_image_generation) {
    input.sequential_image_generation = options.sequential_image_generation;
  }

  const requestedMaxImages = clampInteger(options.max_images, 1, MAX_GENERATED_IMAGES, DEFAULT_MAX_IMAGES);
  const allowedInputCount = Math.max(0, MAX_TOTAL_IMAGES - requestedMaxImages);

  if (Array.isArray(input.image_input) && input.image_input.length > allowedInputCount) {
    // Preserve output count; trim lower-priority refs at the tail.
    input.image_input = input.image_input.slice(0, allowedInputCount);
  }

  const inputCount = Array.isArray(input.image_input) ? input.image_input.length : 0;
  const maxImagesCap = Math.max(1, MAX_TOTAL_IMAGES - inputCount);
  input.max_images = clampInteger(requestedMaxImages, 1, maxImagesCap, DEFAULT_MAX_IMAGES);

  return input;
}

function buildPredictionRequest(input) {
  if (MODEL_VERSION) {
    return {
      path: '/v1/predictions',
      body: { version: MODEL_VERSION, input }
    };
  }
  return {
    path: `/v1/models/${MODEL_OWNER}/${MODEL_NAME}/predictions`,
    body: { input }
  };
}

/**
 * Create a prediction on Replicate using SeedDream v4.5.
 * Uses Prefer: wait header to hold connection for up to 60s.
 * Falls through to polling if not completed within that window.
 *
 * @param {string} prompt - The text prompt
 * @param {object} options - Optional: size, aspect_ratio, width, height, max_images, sequential_image_generation, image_input
 * @param {function} onStatus - Optional callback for status updates
 * @param {function} shouldCancel - Optional callback that returns true to cancel generation
 * @returns {object} { output: string[], predictionId: string, duration: number }
 */
async function createPrediction(prompt, options = {}, onStatus = null, shouldCancel = null) {
  const startTime = Date.now();
  const input = normalizePredictionInput(prompt, options);
  const isCanceled = typeof shouldCancel === 'function' ? shouldCancel : () => false;

  if (isCanceled()) {
    const cancelErr = new Error('Generation canceled before request was sent');
    cancelErr.code = 'CANCELED';
    throw cancelErr;
  }

  if (onStatus) onStatus('sending');
  const request = buildPredictionRequest(input);
  let response;
  try {
    response = await makeRequest(
      'POST',
      request.path,
      request.body,
      { 'Prefer': 'wait=60' }
    );
  } catch (err) {
    const details = String(err?.body?.detail || err?.message || '');
    const missingVersion = /version.*(not found|does not exist|invalid|archived)/i.test(details);
    if (MODEL_VERSION && err.statusCode === 422 && missingVersion) {
      // Fall back to model endpoint when a pinned version is no longer available.
      response = await makeRequest(
        'POST',
        `/v1/models/${MODEL_OWNER}/${MODEL_NAME}/predictions`,
        { input },
        { 'Prefer': 'wait=60' }
      );
    } else {
      throw err;
    }
  }

  if (isCanceled()) {
    if (response && response.id) {
      try {
        await makeRequest('POST', `/v1/predictions/${response.id}/cancel`);
      } catch {
        // ignore cancel errors
      }
    }
    const cancelErr = new Error('Generation canceled');
    cancelErr.code = 'CANCELED';
    throw cancelErr;
  }

  if (response.status === 'succeeded') {
    return {
      output: response.output,
      predictionId: response.id,
      duration: (Date.now() - startTime) / 1000
    };
  }

  if (response.status === 'failed') {
    throw new Error(`Generation failed: ${response.error || 'Unknown error'}`);
  }

  // Not completed yet — poll
  if (onStatus) onStatus('processing');
  return await pollPrediction(response.id, startTime, onStatus, isCanceled);
}

/**
 * Poll a prediction until it completes or times out.
 */
async function pollPrediction(predictionId, startTime = Date.now(), onStatus = null, shouldCancel = null) {
  let interval = INITIAL_POLL_INTERVAL_MS;
  const isCanceled = typeof shouldCancel === 'function' ? shouldCancel : () => false;

  while (true) {
    if (isCanceled()) {
      try {
        await makeRequest('POST', `/v1/predictions/${predictionId}/cancel`);
      } catch {
        // ignore cancel errors
      }
      const cancelErr = new Error('Generation canceled');
      cancelErr.code = 'CANCELED';
      throw cancelErr;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > POLL_TIMEOUT_MS) {
      // Cancel the prediction
      try {
        await makeRequest('POST', `/v1/predictions/${predictionId}/cancel`);
      } catch { /* ignore cancel errors */ }
      throw new Error(`Generation timed out after ${Math.round(elapsed / 1000)}s`);
    }

    await sleep(interval);
    interval = Math.min(interval * 2, MAX_POLL_INTERVAL_MS);

    if (isCanceled()) {
      try {
        await makeRequest('POST', `/v1/predictions/${predictionId}/cancel`);
      } catch {
        // ignore cancel errors
      }
      const cancelErr = new Error('Generation canceled');
      cancelErr.code = 'CANCELED';
      throw cancelErr;
    }

    let response;
    try {
      response = await makeRequest('GET', `/v1/predictions/${predictionId}`);
    } catch (pollErr) {
      const statusCode = Number(pollErr && pollErr.statusCode);
      const transientStatus = statusCode === 429 || (statusCode >= 500 && statusCode < 600);
      const transientNetwork = /timeout|ECONNRESET|EAI_AGAIN|ENOTFOUND|socket hang up/i.test(String(pollErr && pollErr.message || ''));
      if (transientStatus || transientNetwork) {
        if (onStatus) onStatus('retrying');
        continue;
      }
      throw pollErr;
    }

    if (onStatus) onStatus(response.status);

    if (response.status === 'succeeded') {
      return {
        output: response.output,
        predictionId: response.id,
        duration: (Date.now() - startTime) / 1000
      };
    }

    if (response.status === 'failed') {
      throw new Error(`Generation failed: ${response.error || 'Unknown error'}`);
    }

    if (response.status === 'canceled') {
      const cancelErr = new Error('Generation was canceled');
      cancelErr.code = 'CANCELED';
      throw cancelErr;
    }
  }
}

/**
 * Download an image from a URL to a local file path.
 * Follows redirects. Creates parent directories.
 */
function downloadImage(imageUrl, savePath) {
  const dir = path.dirname(savePath);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  const MAX_REDIRECTS = 5;
  const DOWNLOAD_TIMEOUT_MS = 120000;

  return new Promise((resolve, reject) => {
    let settled = false;
    let redirectCount = 0;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      // Clean up partial file
      try { fs.unlinkSync(savePath); } catch { /* file may not exist */ }
      reject(err);
    };

    const handleResponse = (response) => {
      if (settled) return;

      // Follow redirects with limit
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) {
          fail(new Error(`Download failed: too many redirects (${MAX_REDIRECTS})`));
          return;
        }
        const redirectUrl = response.headers.location;
        const mod = redirectUrl.startsWith('https') ? https : require('http');
        const req = mod.get(redirectUrl, handleResponse);
        req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
          req.destroy(new Error('Download redirect timed out'));
        });
        req.on('error', fail);
        return;
      }

      if (response.statusCode !== 200) {
        fail(new Error(`Download failed: HTTP ${response.statusCode}`));
        return;
      }

      const writeStream = fs.createWriteStream(savePath);
      response.pipe(writeStream);
      writeStream.on('finish', () => {
        if (settled) return;
        settled = true;
        try {
          const stats = fs.statSync(savePath);
          resolve({ path: savePath, size: stats.size });
        } catch (statErr) {
          try { fs.unlinkSync(savePath); } catch { /* ignore */ }
          reject(new Error(`Downloaded file not accessible: ${statErr.message}`));
        }
      });
      writeStream.on('error', fail);
    };

    const req = https.get(imageUrl, handleResponse);
    req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
      req.destroy(new Error('Image download timed out'));
    });
    req.on('error', fail);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clear the cached token (useful for testing or after .env changes).
 */
function clearTokenCache() {
  cachedToken = null;
  cachedTokenSource = null;
}

function setSessionToken(token) {
  const value = typeof token === 'string' ? token.trim() : '';
  sessionToken = value || null;
}

function clearSessionToken() {
  sessionToken = null;
}

function getTokenSource() {
  if (sessionToken) return 'session';
  if (cachedTokenSource) return cachedTokenSource;
  try {
    loadApiToken();
    return cachedTokenSource || 'env';
  } catch {
    return 'none';
  }
}

module.exports = {
  loadApiToken,
  isConfigured,
  createPrediction,
  normalizePredictionInput,
  pollPrediction,
  downloadImage,
  clearTokenCache,
  setSessionToken,
  clearSessionToken,
  getTokenSource,
  isLocalRuntime,
  MODEL_VERSION,
  MODEL_OWNER,
  MODEL_NAME
};
