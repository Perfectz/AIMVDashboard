const assert = require('assert');
const replicate = require('../../scripts/replicate_client');

function run() {
  const envSnapshot = {};
  const keys = [
    'HOST',
    'NODE_ENV',
    'CI',
    'VERCEL',
    'RENDER',
    'RAILWAY_ENVIRONMENT',
    'HEROKU_APP_ID',
    'K_SERVICE',
    'AWS_EXECUTION_ENV',
    'AWS_LAMBDA_FUNCTION_NAME',
    'FLY_APP_NAME',
    'AIMV_FORCE_LOCAL'
  ];
  keys.forEach((key) => {
    envSnapshot[key] = process.env[key];
  });

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

  process.env.HOST = '127.0.0.1';
  process.env.NODE_ENV = 'development';
  process.env.CI = '';
  process.env.VERCEL = '';
  process.env.RENDER = '';
  process.env.RAILWAY_ENVIRONMENT = '';
  process.env.HEROKU_APP_ID = '';
  process.env.K_SERVICE = '';
  process.env.AWS_EXECUTION_ENV = '';
  process.env.AWS_LAMBDA_FUNCTION_NAME = '';
  process.env.FLY_APP_NAME = '';
  process.env.AIMV_FORCE_LOCAL = '';
  assert.strictEqual(replicate.isLocalRuntime(), true, '127.0.0.1 + dev should be local runtime');

  process.env.NODE_ENV = 'production';
  assert.strictEqual(replicate.isLocalRuntime(), false, 'production should disable local runtime fallback');

  keys.forEach((key) => {
    if (envSnapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = envSnapshot[key];
    }
  });

  console.log('replicate-client.test.js passed');
}

run();
