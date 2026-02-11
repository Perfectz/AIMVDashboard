const assert = require('assert');
const { createContentService } = require('../../ui/services/content-service.js');

async function run() {
  const captured = [];
  const domain = {
    validateContentType(contentType) {
      const allowed = ['concept', 'analysis', 'suno-prompt'];
      if (!allowed.includes(contentType)) {
        return { ok: false, error: 'Unsupported content type' };
      }
      return { ok: true, key: contentType };
    }
  };

  const httpClientFactory = {
    createHttpClient() {
      return {
        async request(url, options) {
          captured.push({ url, options });
          if (url.startsWith('/api/save/')) {
            return { response: { ok: true }, payload: { success: true } };
          }
          return { response: { ok: true }, payload: { success: true, content: 'loaded' } };
        }
      };
    }
  };

  const service = createContentService({ domain, httpClientFactory });

  const save = await service.saveContent({
    projectId: 'default',
    contentType: 'concept',
    content: 'project concept'
  });
  assert.strictEqual(save.ok, true);
  assert.strictEqual(captured[0].url, '/api/save/concept');

  const load = await service.loadContent({
    projectId: 'default',
    contentType: 'analysis'
  });
  assert.strictEqual(load.ok, true);
  assert.ok(captured[1].url.includes('/api/load/analysis?project=default'));

  let threw = false;
  try {
    await service.loadContent({ projectId: 'default', contentType: 'mood' });
  } catch (err) {
    threw = true;
  }
  assert.strictEqual(threw, true);

  console.log('content-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
