const assert = require('assert');
const { createReferenceFeature } = require('../../ui/features/reference-feature.js');

async function run() {
  const calls = [];
  const feature = createReferenceFeature({
    referenceUploadService: {
      async uploadCharacterReference(input) {
        calls.push({ type: 'char', input });
        return { ok: true, data: { uploaded: 'character' } };
      },
      async uploadLocationReference(input) {
        calls.push({ type: 'location', input });
        return { ok: true, data: { uploaded: 'location' } };
      },
      async uploadShotRenderFrame(input) {
        calls.push({ type: 'shot', input });
        return { ok: false, error: 'failed' };
      }
    }
  });

  const charResult = await feature.uploadCharacterReference({ projectId: 'p1', characterName: 'A' });
  assert.strictEqual(charResult.ok, true);
  assert.strictEqual(charResult.data.uploaded, 'character');

  const locResult = await feature.uploadLocationReference({ projectId: 'p1', locationName: 'L1' });
  assert.strictEqual(locResult.ok, true);
  assert.strictEqual(locResult.data.uploaded, 'location');

  const shotResult = await feature.uploadShotRenderFrame({ projectId: 'p1', shotId: 's1' });
  assert.strictEqual(shotResult.ok, false);
  assert.strictEqual(shotResult.error, 'failed');

  assert.strictEqual(calls.length, 3);

  console.log('reference-feature.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
