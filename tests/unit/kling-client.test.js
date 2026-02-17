const assert = require('assert');
const klingClient = require('../../scripts/kling_client');

function run() {
  // Test 1: Module exports expected functions
  assert.strictEqual(typeof klingClient.generateVideo, 'function', 'Should export generateVideo');
  assert.strictEqual(typeof klingClient.downloadVideo, 'function', 'Should export downloadVideo');

  // Test 2: Model constants are defined
  assert.ok(klingClient.KLING_MODEL_OWNER, 'Should have model owner');
  assert.ok(klingClient.KLING_MODEL_NAME, 'Should have model name');

  // Test 3: generateVideo rejects when canceled before sending
  let cancelError = false;
  klingClient.generateVideo('test', {}, null, () => true).catch((err) => {
    cancelError = true;
    assert.strictEqual(err.code, 'CANCELED', 'Should have CANCELED code');
  }).then(() => {
    assert.ok(cancelError, 'Should have thrown cancel error');
    console.log('kling-client.test.js passed');
  });
}

run();
