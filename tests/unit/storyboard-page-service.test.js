const assert = require('assert');
const { createStoryboardPageService } = require('../../ui/services/storyboard-page-service.js');

async function run() {
  const calls = [];
  const httpClientFactory = {
    createHttpClient() {
      return {
        async request(url, options) {
          calls.push({ url, options });
          if (url.startsWith('/projects/p1/bible/asset_manifest.json')) {
            return { response: { ok: true }, payload: { assets: [] } };
          }
          if (url.startsWith('/api/export/context-bundle?project=')) {
            return { response: { ok: true }, payload: { success: true, bundle: { preview: true } } };
          }
          if (url.startsWith('/api/upload/music')) {
            return { response: { ok: true }, payload: { success: true, filePath: 'music/x.mp3' } };
          }
          if (url.startsWith('/api/storyboard/readiness-report')) {
            return { response: { ok: true }, payload: { success: true, path: 'lint/readiness_report.json' } };
          }
          if (url.startsWith('/api/load/canon/script')) {
            return { response: { ok: true }, payload: { content: '{"shots":[]}' } };
          }
          if (url === '/api/export/context-bundle') {
            return { response: { ok: true }, payload: { success: true, bundle: { markdown: 'ok' } } };
          }
          return { response: { ok: false }, payload: { error: 'unexpected' } };
        }
      };
    }
  };

  global.FormData = class FormDataStub {
    constructor() { this.entries = []; }
    append(k, v) { this.entries.push([k, v]); }
  };

  const svc = createStoryboardPageService({ httpClientFactory });

  assert.strictEqual((await svc.loadAssetManifest('p1')).ok, true);
  assert.strictEqual((await svc.loadContextBundlePreview('p1')).ok, true);
  assert.strictEqual((await svc.uploadMusic({ projectId: 'p1', file: { name: 'a.mp3' } })).ok, true);
  assert.strictEqual((await svc.saveReadinessReport({ projectId: 'p1', payload: { a: 1 } })).ok, true);
  assert.strictEqual((await svc.loadCanonScript('p1')).ok, true);
  assert.strictEqual((await svc.exportContextBundle({ projectId: 'p1' })).ok, true);

  assert.ok(calls.length >= 6);
  console.log('storyboard-page-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
