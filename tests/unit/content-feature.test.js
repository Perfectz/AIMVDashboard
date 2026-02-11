const assert = require('assert');
const { createContentFeature } = require('../../ui/features/content-feature.js');

async function run() {
  const calls = [];
  const feature = createContentFeature({
    contentDomain: {
      validateAnalysisJsonContent(content) {
        if (content === 'ok') return { ok: true, value: content };
        return { ok: false, error: 'bad json' };
      }
    },
    contentService: {
      async saveContent(input) {
        calls.push({ type: 'save', input });
        return { ok: true, data: { saved: true } };
      },
      async loadContent(input) {
        calls.push({ type: 'load', input });
        return { ok: true, data: { content: 'value:' + input.contentType } };
      }
    }
  });

  assert.deepStrictEqual(feature.validateAnalysisJson('ok'), { ok: true, value: 'ok' });
  assert.strictEqual(feature.validateAnalysisJson('no').ok, false);

  const saveResult = await feature.saveContent({ projectId: 'p1', contentType: 'concept', content: 'x' });
  assert.strictEqual(saveResult.ok, true);

  const loadResult = await feature.loadContent({ projectId: 'p1', contentType: 'genre' });
  assert.strictEqual(loadResult.ok, true);
  assert.strictEqual(loadResult.data.content, 'value:genre');

  const batch = await feature.loadContentBatch({ projectId: 'p1', contentTypes: ['concept', 'mood'] });
  assert.strictEqual(batch.concept.ok, true);
  assert.strictEqual(batch.mood.ok, true);

  assert.strictEqual(calls.length, 4);

  console.log('content-feature.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
