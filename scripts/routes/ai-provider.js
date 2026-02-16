'use strict';

function registerAiProviderRoutes(router, ctx) {
  const { sendJSON, wrapAsync, jsonBody, MAX_BODY_SIZE, aiProvider } = ctx;

  router.get('/api/ai-provider/status', (req, res) => {
    sendJSON(res, 200, {
      success: true,
      ...aiProvider.getStatus()
    });
  });

  router.post('/api/ai-provider/active', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const provider = String(payload && payload.provider || '').trim().toLowerCase();

    if (!aiProvider.PROVIDERS.includes(provider)) {
      sendJSON(res, 400, {
        success: false,
        error: `Invalid provider. Must be one of: ${aiProvider.PROVIDERS.join(', ')}`
      });
      return;
    }

    aiProvider.setActiveProvider(provider);
    sendJSON(res, 200, {
      success: true,
      ...aiProvider.getStatus()
    });
  }));

  router.post('/api/ai-provider/key', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const provider = String(payload && payload.provider || '').trim().toLowerCase();
    const key = typeof payload.key === 'string' ? payload.key.trim() : '';

    if (!aiProvider.PROVIDERS.includes(provider)) {
      sendJSON(res, 400, {
        success: false,
        error: `Invalid provider. Must be one of: ${aiProvider.PROVIDERS.join(', ')}`
      });
      return;
    }

    if (provider === 'github') {
      sendJSON(res, 400, {
        success: false,
        error: 'GitHub uses OAuth authentication, not API keys'
      });
      return;
    }

    if (key) {
      aiProvider.setSessionKey(provider, key);
    } else {
      aiProvider.clearSessionKey(provider);
    }

    sendJSON(res, 200, {
      success: true,
      message: key ? `${provider} session key saved` : `${provider} session key cleared`,
      ...aiProvider.getStatus()
    });
  }));
}

module.exports = { registerAiProviderRoutes };
