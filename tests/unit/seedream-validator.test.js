const assert = require('assert');
const { validateSeedreamPromptStructure } = require('../../scripts/services/agent_prompt_tools');

function run() {
  const validPrompt = [
    '=== SHOT SHOT_03 - Variation A ===',
    'Shot: SHOT_03',
    'Variation: A',
    '',
    '--- SEEDREAM PROMPT ---',
    '',
    'Create 2 Images that preserve character identity and wardrobe continuity from references. ' +
      'Scene: handheld medium-wide push-in on performer crossing an empty street at blue hour, ' +
      'neon reflections on wet pavement, shallow haze, cinematic film grain, natural skin tones.',
    '',
    '--- NEGATIVE PROMPT ---',
    '',
    'text, logos, watermark, extra limbs, deformed hands, low quality, blurry'
  ].join('\n');

  const valid = validateSeedreamPromptStructure(validPrompt);
  assert.strictEqual(valid.ok, true, `Expected valid prompt, got: ${valid.errors.join('; ')}`);
  assert.strictEqual(Array.isArray(valid.errors), true);
  assert.strictEqual(Array.isArray(valid.warnings), true);

  const invalidPrompt = [
    '=== SHOT SHOT_05 ===',
    'Variation: C',
    '',
    '--- SEEDREAM PROMPT ---',
    '',
    'Tiny'
  ].join('\n');

  const invalid = validateSeedreamPromptStructure(invalidPrompt);
  assert.strictEqual(invalid.ok, false, 'Expected invalid prompt to fail validation');
  assert.ok(
    invalid.errors.some((msg) => msg.includes('NEGATIVE PROMPT')),
    'Expected missing negative prompt error'
  );

  console.log('seedream-validator.test.js passed');
}

run();
