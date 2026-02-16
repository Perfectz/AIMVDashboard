const assert = require('assert');
const replicate = require('../../scripts/replicate_client');

function run() {
  const prompt = 'test prompt';

  const refs14 = Array.from({ length: 14 }, (_, i) => `data:image/png;base64,ref${i + 1}`);
  const normalizedA = replicate.normalizePredictionInput(prompt, {
    image_input: refs14,
    max_images: 2
  });
  assert.strictEqual(normalizedA.max_images, 2, 'max_images should stay 2');
  assert.strictEqual(normalizedA.image_input.length, 13, 'refs should trim to 13 when requesting 2 outputs');

  const normalizedB = replicate.normalizePredictionInput(prompt, {
    image_input: refs14,
    max_images: 1
  });
  assert.strictEqual(normalizedB.max_images, 1, 'max_images should stay 1');
  assert.strictEqual(normalizedB.image_input.length, 14, 'refs should stay 14 when requesting 1 output');

  const normalizedC = replicate.normalizePredictionInput(prompt, {
    image_input: ['a', '', null, 'b'],
    max_images: 20
  });
  assert.strictEqual(normalizedC.max_images, 4, 'max_images should clamp to model max');
  assert.deepStrictEqual(normalizedC.image_input, ['a', 'b']);

  console.log('replicate-client.test.js passed');
}

run();
