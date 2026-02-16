const https = require('https');

const DEFAULT_MODELS_ENDPOINT = process.env.GITHUB_MODELS_ENDPOINT || 'https://models.inference.ai.azure.com/chat/completions';
const DEFAULT_MODEL = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-5.3-codex';

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = { raw };
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
          return;
        }

        const message = parsed.error?.message || parsed.message || parsed.raw || `HTTP ${res.statusCode}`;
        const err = new Error(message);
        err.statusCode = res.statusCode;
        err.payload = parsed;
        reject(err);
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('GitHub models request timed out'));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function generateWithGitHubModel(input) {
  const token = input && input.token ? String(input.token).trim() : '';
  if (!token) throw new Error('GitHub access token is required');

  const messages = Array.isArray(input.messages) ? input.messages : [];
  if (messages.length === 0) throw new Error('messages is required');

  const model = (input.model || DEFAULT_MODEL).trim();
  const endpoint = (input.endpoint || DEFAULT_MODELS_ENDPOINT).trim();
  const temperature = Number.isFinite(input.temperature) ? input.temperature : 0.2;
  const maxTokens = Number.isFinite(input.maxTokens) ? input.maxTokens : 1200;

  const body = JSON.stringify({
    model,
    messages,
    temperature,
    max_completion_tokens: maxTokens
  });

  const url = new URL(endpoint);
  const payload = await requestJson(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'AIMusicVideo-Agent',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('GitHub model response missing message content');
  }

  return {
    model,
    content
  };
}

module.exports = {
  DEFAULT_MODELS_ENDPOINT,
  DEFAULT_MODEL,
  generateWithGitHubModel
};

