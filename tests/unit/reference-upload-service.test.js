const assert = require('assert');
const { createReferenceUploadService } = require('../../ui/services/reference-upload-service.js');

function createFormDataStub() {
  return class FormDataStub {
    constructor() {
      this.entries = [];
    }
    append(name, value) {
      this.entries.push([name, value]);
    }
  };
}

async function run() {
  global.FormData = createFormDataStub();
  const captured = [];

  const domain = {
    validateReferenceImageFile(file) {
      if (!file) return { ok: false, error: 'No file selected' };
      return { ok: true };
    },
    validateShotRenderUpload(input) {
      if (!input || !input.file) return { ok: false, error: 'No file selected' };
      return {
        ok: true,
        normalized: {
          file: input.file,
          shotId: input.shotId,
          variation: String(input.variation).toUpperCase(),
          frame: input.frame,
          tool: input.tool
        }
      };
    }
  };

  const httpClientFactory = {
    createHttpClient() {
      return {
        async request(url, options) {
          captured.push({ url, options });
          return { response: { ok: true }, payload: { success: true } };
        }
      };
    }
  };

  const service = createReferenceUploadService({ domain, httpClientFactory });
  const file = { name: 'ref.png', size: 200 };

  const charResult = await service.uploadCharacterReference({
    projectId: 'default',
    characterName: 'Hero',
    slotNum: 1,
    file
  });
  assert.strictEqual(charResult.ok, true);
  assert.strictEqual(captured[0].url, '/api/upload/reference-image');

  const locResult = await service.uploadLocationReference({
    projectId: 'default',
    locationName: 'City',
    slotNum: 2,
    file
  });
  assert.strictEqual(locResult.ok, true);
  assert.strictEqual(captured[1].url, '/api/upload/location-reference-image');

  const renderResult = await service.uploadShotRenderFrame({
    projectId: 'default',
    shotId: 'SHOT_01',
    variation: 'a',
    frame: 'first',
    tool: 'seedream',
    file
  });
  assert.strictEqual(renderResult.ok, true);
  assert.strictEqual(captured[2].url, '/api/upload/shot-render');

  const renderEntryKeys = captured[2].options.body.entries.map((x) => x[0]);
  assert.deepStrictEqual(renderEntryKeys, ['project', 'shot', 'variation', 'frame', 'tool', 'image']);

  console.log('reference-upload-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
