/**
 * Kling Video Generation Client — via Replicate API
 * Zero dependencies (uses built-in https module)
 *
 * Generates video from first/last frame images using Kling v2.0 on Replicate.
 * Designed to work alongside seedream for the image→video pipeline.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const KLING_MODEL_OWNER = process.env.KLING_MODEL_OWNER || 'kwaai';
const KLING_MODEL_NAME = process.env.KLING_MODEL_NAME || 'kling-video';
const KLING_MODEL_VERSION = (process.env.KLING_MODEL_VERSION || '').trim() || null;
const API_HOST = 'api.replicate.com';
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (video takes longer)
const INITIAL_POLL_INTERVAL_MS = 5000;
const MAX_POLL_INTERVAL_MS = 15000;

// Reuse token management from replicate_client
const replicate = require('./replicate_client');

function makeRequest(method, apiPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const token = replicate.loadApiToken();
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
        try { parsed = JSON.parse(responseBody); } catch { parsed = { raw: responseBody }; }
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
    req.setTimeout(120000, () => { req.destroy(new Error('Request timed out')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a video from a prompt + optional first/last frame images.
 *
 * @param {string} prompt - Text description of the video
 * @param {object} options
 * @param {string} options.start_image - Data URI or URL of the first frame
 * @param {string} options.end_image - Data URI or URL of the last frame (optional)
 * @param {number} options.duration - Video duration in seconds (5 or 10, default 5)
 * @param {string} options.aspect_ratio - Aspect ratio (16:9, 9:16, 1:1, default 16:9)
 * @param {function} onStatus - Status callback
 * @param {function} shouldCancel - Cancellation check
 * @returns {object} { output: string, predictionId: string, duration: number }
 */
async function generateVideo(prompt, options = {}, onStatus = null, shouldCancel = null) {
  const startTime = Date.now();
  const isCanceled = typeof shouldCancel === 'function' ? shouldCancel : () => false;

  if (isCanceled()) {
    const err = new Error('Generation canceled before request was sent');
    err.code = 'CANCELED';
    throw err;
  }

  const input = {
    prompt: String(prompt || ''),
    duration: options.duration || 5,
    aspect_ratio: options.aspect_ratio || '16:9'
  };

  if (options.start_image) input.start_image = options.start_image;
  if (options.end_image) input.end_image = options.end_image;

  const requestPath = KLING_MODEL_VERSION
    ? '/v1/predictions'
    : `/v1/models/${KLING_MODEL_OWNER}/${KLING_MODEL_NAME}/predictions`;

  const requestBody = KLING_MODEL_VERSION
    ? { version: KLING_MODEL_VERSION, input }
    : { input };

  if (onStatus) onStatus('sending');

  let response;
  try {
    response = await makeRequest('POST', requestPath, requestBody, { 'Prefer': 'wait=60' });
  } catch (err) {
    // If the specific model isn't found, provide a helpful error
    if (err.statusCode === 404) {
      throw new Error(
        'Kling model not found on Replicate. ' +
        'Set KLING_MODEL_OWNER and KLING_MODEL_NAME in .env to point to an available video model. ' +
        'Try: KLING_MODEL_OWNER=kwaai KLING_MODEL_NAME=kling-video'
      );
    }
    throw err;
  }

  if (isCanceled()) {
    if (response && response.id) {
      try { await makeRequest('POST', `/v1/predictions/${response.id}/cancel`); } catch { /* ignore */ }
    }
    const err = new Error('Generation canceled');
    err.code = 'CANCELED';
    throw err;
  }

  if (response.status === 'succeeded') {
    return {
      output: response.output,
      predictionId: response.id,
      duration: (Date.now() - startTime) / 1000
    };
  }

  if (response.status === 'failed') {
    throw new Error(`Kling generation failed: ${response.error || 'Unknown error'}`);
  }

  // Poll for completion
  if (onStatus) onStatus('processing');
  return await pollKlingPrediction(response.id, startTime, onStatus, isCanceled);
}

async function pollKlingPrediction(predictionId, startTime = Date.now(), onStatus = null, shouldCancel = null) {
  let interval = INITIAL_POLL_INTERVAL_MS;
  const isCanceled = typeof shouldCancel === 'function' ? shouldCancel : () => false;

  while (true) {
    if (isCanceled()) {
      try { await makeRequest('POST', `/v1/predictions/${predictionId}/cancel`); } catch { /* ignore */ }
      const err = new Error('Generation canceled');
      err.code = 'CANCELED';
      throw err;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > POLL_TIMEOUT_MS) {
      try { await makeRequest('POST', `/v1/predictions/${predictionId}/cancel`); } catch { /* ignore */ }
      throw new Error(`Kling generation timed out after ${Math.round(elapsed / 1000)}s`);
    }

    await sleep(interval);
    interval = Math.min(interval * 1.5, MAX_POLL_INTERVAL_MS);

    let response;
    try {
      response = await makeRequest('GET', `/v1/predictions/${predictionId}`);
    } catch (pollErr) {
      const statusCode = Number(pollErr && pollErr.statusCode);
      if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
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
      throw new Error(`Kling generation failed: ${response.error || 'Unknown error'}`);
    }
    if (response.status === 'canceled') {
      const err = new Error('Kling generation was canceled');
      err.code = 'CANCELED';
      throw err;
    }
  }
}

/**
 * Download a video file from URL to local path.
 */
function downloadVideo(videoUrl, savePath) {
  const dir = path.dirname(savePath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (err) { if (err.code !== 'EEXIST') throw err; }

  return new Promise((resolve, reject) => {
    const MAX_REDIRECTS = 5;
    let settled = false;
    let redirectCount = 0;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      try { fs.unlinkSync(savePath); } catch { /* ignore */ }
      reject(err);
    };

    const handleResponse = (response) => {
      if (settled) return;
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) { fail(new Error('Too many redirects')); return; }
        const mod = response.headers.location.startsWith('https') ? https : require('http');
        const req = mod.get(response.headers.location, handleResponse);
        req.setTimeout(300000, () => { req.destroy(new Error('Download timed out')); });
        req.on('error', fail);
        return;
      }
      if (response.statusCode !== 200) { fail(new Error(`Download failed: HTTP ${response.statusCode}`)); return; }

      const ws = fs.createWriteStream(savePath);
      response.pipe(ws);
      ws.on('finish', () => {
        if (settled) return;
        settled = true;
        resolve({ path: savePath, size: fs.statSync(savePath).size });
      });
      ws.on('error', fail);
    };

    const req = https.get(videoUrl, handleResponse);
    req.setTimeout(300000, () => { req.destroy(new Error('Video download timed out')); });
    req.on('error', fail);
  });
}

module.exports = {
  generateVideo,
  downloadVideo,
  KLING_MODEL_OWNER,
  KLING_MODEL_NAME
};
