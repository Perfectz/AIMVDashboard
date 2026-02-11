const assert = require('assert');
const { createReviewService } = require('../../ui/services/review-service.js');

async function run() {
  const captured = [];

  const httpClientFactory = {
    createHttpClient() {
      return {
        async request(url, options) {
          captured.push({ url, options });
          if (url.startsWith('/api/storyboard/previs-map') && options.method === 'GET') {
            return { response: { ok: true }, payload: { success: true, previsMap: {} } };
          }
          if (url.startsWith('/api/storyboard/previs-map') && options.method === 'PUT') {
            return { response: { ok: true }, payload: { success: true, entry: { sourceType: 'manual' } } };
          }
          if (url.startsWith('/api/storyboard/previs-map') && options.method === 'DELETE') {
            return { response: { ok: true }, payload: { success: true } };
          }
          if (url.startsWith('/api/review/sequence') && options.method === 'GET') {
            return { response: { ok: true }, payload: { selections: [] } };
          }
          if (url.startsWith('/api/load/review-metadata') && options.method === 'GET') {
            return { response: { ok: true }, payload: { success: true, reviewMetadata: {} } };
          }
          if (url.startsWith('/api/save/review-metadata') && options.method === 'POST') {
            return { response: { ok: true }, payload: { success: true, reviewMetadata: {} } };
          }
          if (url.startsWith('/api/storyboard/sequence') && options.method === 'POST') {
            return { response: { ok: true }, payload: { success: true } };
          }
          return { response: { ok: false }, payload: { success: false, error: 'Unexpected call' } };
        }
      };
    }
  };

  const service = createReviewService({ httpClientFactory });

  const previs = await service.loadPrevisMap('default');
  assert.strictEqual(previs.ok, true);

  const savePrevis = await service.savePrevisMapEntry({
    projectId: 'default',
    shotId: 'SHOT_01',
    entry: { sourceType: 'manual' }
  });
  assert.strictEqual(savePrevis.ok, true);

  const resetPrevis = await service.resetPrevisMapEntry({ projectId: 'default', shotId: 'SHOT_01' });
  assert.strictEqual(resetPrevis.ok, true);

  const sequence = await service.loadReviewSequence('default');
  assert.strictEqual(sequence.ok, true);

  const metadata = await service.loadReviewMetadata('default');
  assert.strictEqual(metadata.ok, true);

  const saveMetadata = await service.saveReviewMetadata({
    projectId: 'default',
    payload: { shotId: 'SHOT_01' }
  });
  assert.strictEqual(saveMetadata.ok, true);

  const saveSequence = await service.saveStoryboardSequence({
    projectId: 'default',
    payload: { selections: [] }
  });
  assert.strictEqual(saveSequence.ok, true);

  assert.strictEqual(captured.length, 7);
  assert.ok(captured[0].url.includes('/api/storyboard/previs-map?project=default'));
  assert.ok(captured[1].url.includes('/api/storyboard/previs-map/SHOT_01'));
  assert.ok(captured[2].url.includes('/api/storyboard/previs-map/SHOT_01?project=default'));
  assert.ok(captured[3].url.includes('/api/review/sequence?project=default'));
  assert.ok(captured[4].url.includes('/api/load/review-metadata?project=default'));
  assert.ok(captured[5].url.includes('/api/save/review-metadata?project=default'));
  assert.ok(captured[6].url.includes('/api/storyboard/sequence?project=default'));

  console.log('review-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
