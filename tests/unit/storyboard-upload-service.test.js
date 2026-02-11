const assert = require('assert');
const { createStoryboardUploadService } = require('../../ui/services/storyboard-upload-service.js');

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

  const uploadDomain = {
    validateKlingVideoUpload(input) {
      if (!input || !input.file) return { ok: false, error: 'No file selected' };
      return {
        ok: true,
        normalized: {
          file: input.file,
          shotId: input.shotId,
          variation: String(input.variation || '').toUpperCase()
        }
      };
    }
  };

  const captured = [];
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

  const service = createStoryboardUploadService({
    uploadDomain,
    httpClientFactory,
    fetchImpl: async () => ({ ok: true, json: async () => ({ success: true }) })
  });

  const result = await service.uploadKlingVariation({
    file: { name: 'video.mp4', size: 1000 },
    shotId: 'SHOT_01',
    variation: 'b',
    projectId: 'default'
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(captured.length, 1);
  assert.ok(captured[0].url.includes('/api/upload/shot?project=default'));

  const formEntries = captured[0].options.body.entries;
  assert.deepStrictEqual(
    formEntries.map((x) => x[0]),
    ['file', 'shotId', 'variation', 'fileType']
  );
  assert.strictEqual(formEntries[2][1], 'B');
  assert.strictEqual(formEntries[3][1], 'kling');

  const failingService = createStoryboardUploadService({
    uploadDomain: {
      validateKlingVideoUpload() {
        return { ok: false, error: 'Bad input' };
      }
    },
    httpClientFactory
  });
  const failure = await failingService.uploadKlingVariation({});
  assert.strictEqual(failure.ok, false);
  assert.strictEqual(failure.error, 'Bad input');

  console.log('storyboard-upload-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
