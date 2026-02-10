/**
 * Replicate API Client — SeedDream v4.5
 * Zero dependencies (uses built-in https module)
 *
 * Shared by CLI script and server endpoint.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODEL_VERSION = 'cd80290b0ab8c7de300e756309eb8918208516abe394e3e427e1e760f36f8398';
const API_HOST = 'api.replicate.com';
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const INITIAL_POLL_INTERVAL_MS = 2000;
const MAX_POLL_INTERVAL_MS = 15000;

let cachedToken = null;

/**
 * Load REPLICATE_API_TOKEN from .env file at project root.
 * Parses manually — no dotenv dependency.
 */
function loadApiToken() {
  if (cachedToken) return cachedToken;

  // Check environment variable first
  if (process.env.REPLICATE_API_TOKEN) {
    cachedToken = process.env.REPLICATE_API_TOKEN;
    return cachedToken;
  }

  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(
      'No .env file found.\n' +
      'Create one at the project root with:\n\n' +
      '  REPLICATE_API_TOKEN=r8_your_token_here\n\n' +
      'Get your token at: https://replicate.com/account/api-tokens\n' +
      'See .env.example for reference.'
    );
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^REPLICATE_API_TOKEN\s*=\s*(.+)$/);
    if (match) {
      let value = match[1].trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!value) {
        throw new Error('REPLICATE_API_TOKEN is empty in .env file.');
      }
      cachedToken = value;
      return cachedToken;
    }
  }

  throw new Error(
    'REPLICATE_API_TOKEN not found in .env file.\n' +
    'Add this line to your .env:\n\n' +
    '  REPLICATE_API_TOKEN=r8_your_token_here'
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

/**
 * Create a prediction on Replicate using SeedDream v4.5.
 * Uses Prefer: wait header to hold connection for up to 60s.
 * Falls through to polling if not completed within that window.
 *
 * @param {string} prompt - The text prompt
 * @param {object} options - Optional: size, aspect_ratio, width, height, max_images, sequential_image_generation, image_input
 * @param {function} onStatus - Optional callback for status updates
 * @returns {object} { output: string[], predictionId: string, duration: number }
 */
async function createPrediction(prompt, options = {}, onStatus = null) {
  const startTime = Date.now();

  const input = { prompt };
  if (options.size) input.size = options.size;
  if (options.aspect_ratio) input.aspect_ratio = options.aspect_ratio;
  if (options.width) input.width = options.width;
  if (options.height) input.height = options.height;
  if (options.max_images) input.max_images = options.max_images;
  if (options.sequential_image_generation) input.sequential_image_generation = options.sequential_image_generation;
  if (options.image_input) input.image_input = options.image_input;

  if (onStatus) onStatus('sending');

  const response = await makeRequest(
    'POST',
    '/v1/predictions',
    { version: MODEL_VERSION, input },
    { 'Prefer': 'wait' }
  );

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
  return await pollPrediction(response.id, startTime, onStatus);
}

/**
 * Poll a prediction until it completes or times out.
 */
async function pollPrediction(predictionId, startTime = Date.now(), onStatus = null) {
  let interval = INITIAL_POLL_INTERVAL_MS;

  while (true) {
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

    const response = await makeRequest('GET', `/v1/predictions/${predictionId}`);

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
      throw new Error('Generation was canceled');
    }
  }
}

/**
 * Download an image from a URL to a local file path.
 * Follows redirects. Creates parent directories.
 */
function downloadImage(imageUrl, savePath) {
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const handleResponse = (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location;
        const mod = redirectUrl.startsWith('https') ? https : require('http');
        mod.get(redirectUrl, handleResponse).on('error', reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        return;
      }

      const writeStream = fs.createWriteStream(savePath);
      response.pipe(writeStream);
      writeStream.on('finish', () => {
        const stats = fs.statSync(savePath);
        resolve({ path: savePath, size: stats.size });
      });
      writeStream.on('error', (err) => {
        fs.unlinkSync(savePath); // cleanup partial file
        reject(err);
      });
    };

    https.get(imageUrl, handleResponse).on('error', reject);
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
}

module.exports = {
  loadApiToken,
  isConfigured,
  createPrediction,
  pollPrediction,
  downloadImage,
  clearTokenCache,
  MODEL_VERSION
};
