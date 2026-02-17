const assert = require('assert');
const {
  validateReferenceImageFile,
  validateShotRenderUpload
} = require('../../ui/domain/reference-upload-domain.js');

function run() {
  const okRef = validateReferenceImageFile({ name: 'ref.jpg', size: 1024 });
  assert.strictEqual(okRef.ok, true);

  const okRefWebp = validateReferenceImageFile({ name: 'ref.webp', size: 1024 });
  assert.strictEqual(okRefWebp.ok, true);

  const badRefExt = validateReferenceImageFile({ name: 'ref.gif', size: 1024 });
  assert.strictEqual(badRefExt.ok, false);

  const tooLargeRef = validateReferenceImageFile({ name: 'ref.jpg', size: 25 * 1024 * 1024 });
  assert.strictEqual(tooLargeRef.ok, false);

  const okRender = validateShotRenderUpload({
    file: { name: 'frame.webp', size: 1024 },
    shotId: 'SHOT_01',
    variation: 'b',
    frame: 'first',
    tool: 'seedream'
  });
  assert.strictEqual(okRender.ok, true);
  assert.strictEqual(okRender.normalized.variation, 'B');

  const badTool = validateShotRenderUpload({
    file: { name: 'frame.png', size: 1024 },
    shotId: 'SHOT_01',
    variation: 'A',
    frame: 'first',
    tool: 'unknown'
  });
  assert.strictEqual(badTool.ok, false);

  const badFrame = validateShotRenderUpload({
    file: { name: 'frame.png', size: 1024 },
    shotId: 'SHOT_01',
    variation: 'A',
    frame: 'middle',
    tool: 'seedream'
  });
  assert.strictEqual(badFrame.ok, false);

  console.log('reference-upload-domain.test.js passed');
}

run();
