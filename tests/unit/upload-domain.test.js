const assert = require('assert');
const { validateKlingVideoUpload } = require('../../ui/domain/upload-domain.js');

function run() {
  const valid = validateKlingVideoUpload({
    file: { name: 'clip.mp4', size: 1024 },
    shotId: 'SHOT_01',
    variation: 'a'
  });
  assert.strictEqual(valid.ok, true);
  assert.strictEqual(valid.normalized.variation, 'A');

  const badExt = validateKlingVideoUpload({
    file: { name: 'clip.png', size: 1024 },
    shotId: 'SHOT_01',
    variation: 'A'
  });
  assert.strictEqual(badExt.ok, false);

  const tooLarge = validateKlingVideoUpload({
    file: { name: 'clip.mp4', size: 600 * 1024 * 1024 },
    shotId: 'SHOT_01',
    variation: 'A'
  });
  assert.strictEqual(tooLarge.ok, false);

  const badShot = validateKlingVideoUpload({
    file: { name: 'clip.mp4', size: 1000 },
    shotId: 'invalid',
    variation: 'A'
  });
  assert.strictEqual(badShot.ok, false);

  const badVariation = validateKlingVideoUpload({
    file: { name: 'clip.mp4', size: 1000 },
    shotId: 'SHOT_01',
    variation: 'Z'
  });
  assert.strictEqual(badVariation.ok, false);

  console.log('upload-domain.test.js passed');
}

run();
