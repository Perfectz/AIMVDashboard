'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROVIDERS = ['anthropic', 'openai', 'github'];

const DEFAULTS = {
  anthropic: {
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-6',
    endpoint: 'https://api.anthropic.com/v1/messages',
    envKey: 'ANTHROPIC_API_KEY'
  },
  openai: {
    model: process.env.OPENAI_MODEL || 'gpt-5.2',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    envKey: 'OPENAI_API_KEY'
  },
  github: {
    model: process.env.GITHUB_MODELS_MODEL || 'openai/gpt-5.3-codex',
    endpoint: process.env.GITHUB_MODELS_ENDPOINT || 'https://models.inference.ai.azure.com/chat/completions',
    envKey: null
  }
};

function requestJson(url, options, body) {
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
      req.destroy(new Error('AI provider request timed out'));
    });
    if (body) req.write(body);
    req.end();
  });
}

function loadEnvKey(envKeyName) {
  if (!envKeyName) return null;

  if (process.env[envKeyName]) {
    return process.env[envKeyName];
  }

  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return null;

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const regex = new RegExp(`^${envKeyName}\\s*=\\s*(.+)$`);
    const match = trimmed.match(regex);
    if (match) {
      let value = match[1].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return value || null;
    }
  }
  return null;
}

async function callAnthropic(key, model, messages, temperature, maxTokens) {
  const body = JSON.stringify({
    model,
    messages,
    max_tokens: maxTokens,
    temperature
  });
  const url = new URL(DEFAULTS.anthropic.endpoint);
  const payload = await requestJson(url, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'AIMusicVideo-Agent',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);

  const content = payload?.content?.[0]?.text;
  if (!content || typeof content !== 'string') {
    throw new Error('Anthropic response missing message content');
  }
  return { model, content };
}

async function callOpenAI(key, model, messages, temperature, maxTokens) {
  const body = JSON.stringify({
    model,
    messages,
    max_completion_tokens: maxTokens,
    temperature
  });
  const url = new URL(DEFAULTS.openai.endpoint);
  const payload = await requestJson(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'AIMusicVideo-Agent',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI response missing message content');
  }
  return { model, content };
}

async function callGitHub(token, model, endpoint, messages, temperature, maxTokens) {
  const body = JSON.stringify({
    model,
    messages,
    max_completion_tokens: maxTokens,
    temperature
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
  return { model, content };
}

function createAiProviderService() {
  const sessionKeys = { anthropic: null, openai: null };
  const envKeyCache = { anthropic: null, openai: null };
  let activeProvider = null;

  function resolveKey(provider) {
    if (provider === 'github') return null;
    if (sessionKeys[provider]) return sessionKeys[provider];
    if (envKeyCache[provider]) return envKeyCache[provider];
    const key = loadEnvKey(DEFAULTS[provider].envKey);
    if (key) envKeyCache[provider] = key;
    return key;
  }

  function isConfigured(provider) {
    if (provider === 'github') return true;
    return Boolean(resolveKey(provider));
  }

  function getTokenSource(provider) {
    if (provider === 'github') return 'oauth';
    if (sessionKeys[provider]) return 'session';
    if (resolveKey(provider)) return 'env';
    return 'none';
  }

  function getActiveProvider() {
    if (activeProvider) return activeProvider;
    for (const p of PROVIDERS) {
      if (p !== 'github' && isConfigured(p)) {
        activeProvider = p;
        return p;
      }
    }
    activeProvider = 'github';
    return 'github';
  }

  function setActiveProvider(provider) {
    if (!PROVIDERS.includes(provider)) {
      throw new Error(`Invalid provider: ${provider}. Must be one of: ${PROVIDERS.join(', ')}`);
    }
    activeProvider = provider;
    return activeProvider;
  }

  function setSessionKey(provider, key) {
    if (provider === 'github') {
      throw new Error('GitHub uses OAuth, not API keys');
    }
    if (!PROVIDERS.includes(provider)) {
      throw new Error(`Invalid provider: ${provider}`);
    }
    const value = typeof key === 'string' ? key.trim() : '';
    sessionKeys[provider] = value || null;
  }

  function clearSessionKey(provider) {
    if (provider === 'github') return;
    if (!PROVIDERS.includes(provider)) return;
    sessionKeys[provider] = null;
  }

  function getStatus() {
    const providers = {};
    for (const p of PROVIDERS) {
      providers[p] = {
        configured: isConfigured(p),
        tokenSource: getTokenSource(p),
        model: DEFAULTS[p].model
      };
    }
    return {
      activeProvider: getActiveProvider(),
      providers
    };
  }

  async function generate(providerConfig, options) {
    const provider = getActiveProvider();
    const messages = Array.isArray(options.messages) ? options.messages : [];
    if (messages.length === 0) throw new Error('messages is required');
    const temperature = Number.isFinite(options.temperature) ? options.temperature : 0.2;
    const maxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : 1200;

    if (provider === 'anthropic') {
      const key = resolveKey('anthropic');
      if (!key) throw new Error('Anthropic API key not configured');
      return callAnthropic(key, DEFAULTS.anthropic.model, messages, temperature, maxTokens);
    }

    if (provider === 'openai') {
      const key = resolveKey('openai');
      if (!key) throw new Error('OpenAI API key not configured');
      return callOpenAI(key, DEFAULTS.openai.model, messages, temperature, maxTokens);
    }

    const token = providerConfig && providerConfig.token ? String(providerConfig.token).trim() : '';
    if (!token) throw new Error('GitHub access token is required');
    return callGitHub(token, DEFAULTS.github.model, DEFAULTS.github.endpoint, messages, temperature, maxTokens);
  }

  return {
    generate,
    getStatus,
    getActiveProvider,
    setActiveProvider,
    isConfigured,
    getTokenSource,
    setSessionKey,
    clearSessionKey,
    PROVIDERS
  };
}

module.exports = { createAiProviderService };
