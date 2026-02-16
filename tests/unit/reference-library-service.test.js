const assert = require('assert');
const { createReferenceLibraryService } = require('../../ui/services/reference-library-service.js');

async function run() {
  const calls = [];

  const httpClientFactory = {
    createHttpClient() {
      return {
        async request(url, options) {
          calls.push({ url, options });
          if (url.startsWith('/api/references/characters')) {
            return { response: { ok: true }, payload: { success: true, characters: [{ name: 'CHAR_HOST' }] } };
          }
          if (url.startsWith('/api/references/locations')) {
            return { response: { ok: true }, payload: { success: true, locations: [{ name: 'LOC_STAGE' }] } };
          }
          return { response: { ok: true }, payload: { success: true } };
        }
      };
    }
  };

  const service = createReferenceLibraryService({ httpClientFactory });

  const chars = await service.listCharacters('demo');
  assert.strictEqual(chars.ok, true);
  assert.strictEqual(chars.data.characters[0].name, 'CHAR_HOST');

  const locs = await service.listLocations('demo');
  assert.strictEqual(locs.ok, true);
  assert.strictEqual(locs.data.locations[0].name, 'LOC_STAGE');

  const addChar = await service.addCharacter('demo', 'CHAR_TEST');
  assert.strictEqual(addChar.ok, true);

  const delChar = await service.deleteCharacter('demo', 'CHAR_TEST');
  assert.strictEqual(delChar.ok, true);

  const delCharImage = await service.deleteCharacterImage('demo', 'CHAR_TEST', 1);
  assert.strictEqual(delCharImage.ok, true);

  const addLoc = await service.addLocation('demo', 'LOC_TEST');
  assert.strictEqual(addLoc.ok, true);

  const delLoc = await service.deleteLocation('demo', 'LOC_TEST');
  assert.strictEqual(delLoc.ok, true);

  const delLocImage = await service.deleteLocationImage('demo', 'LOC_TEST', 1);
  assert.strictEqual(delLocImage.ok, true);

  assert.ok(calls.some((c) => c.url.includes('/api/references/characters')));
  assert.ok(calls.some((c) => c.url.includes('/api/references/locations')));

  console.log('reference-library-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

