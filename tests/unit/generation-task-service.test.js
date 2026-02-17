const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createGenerationTaskService } = require('../../scripts/services/generation_task_service');

function createProjectManager(rootDir) {
  const projectsRoot = path.join(rootDir, 'projects');
  const projectId = 'default';
  const projectPath = path.join(projectsRoot, projectId);
  fs.mkdirSync(projectPath, { recursive: true });
  return {
    projectId,
    projectPath,
    getActiveProject() {
      return projectId;
    },
    projectExists(id) {
      return id === projectId;
    },
    getProjectPath(id, subPath = '') {
      if (id !== projectId) {
        throw new Error(`Unknown project: ${id}`);
      }
      return subPath ? path.join(projectPath, subPath) : projectPath;
    }
  };
}

function createRenderManagementStub(projectPath) {
  return {
    listShotRenderEntries() {
      return {
        seedream: {
          A: {
            first: null,
            last: null,
            refs: ['rendered/shots/SHOT_01/seedream_A_first_ref_01.png']
          }
        }
      };
    },
    resolveSeedreamContinuityForShot() {
      return {
        resolved: {
          A: {
            first: {
              path: 'rendered/shots/SHOT_00/seedream_A_last.png',
              source: 'inherited',
              inheritedFromShotId: 'SHOT_00'
            }
          }
        },
        continuity: {
          byVariation: {
            A: { reason: 'inherited_from_previous_last' }
          }
        }
      };
    },
    imagePathToDataUri(_projectId, relativePath) {
      return `data:image/png;base64,${Buffer.from(relativePath).toString('base64')}`;
    },
    addReferenceDataUriIfPossible(refList, dataUri, sourceTag) {
      if (!dataUri || refList.inputs.includes(dataUri) || refList.inputs.length >= 14) return false;
      refList.inputs.push(dataUri);
      refList.sources.push(sourceTag);
      return true;
    },
    collectShotReferenceImagePaths() {
      return [];
    },
    syncShotReferenceSetFiles() {
      return [];
    },
    normalizeRelativeProjectPath(base, absPath) {
      return path.relative(base, absPath).replace(/\\/g, '/');
    },
    getOrderedReferenceFiles() {
      return [];
    },
    getShotPreviewDir(_projectPath, shotId) {
      return path.join(projectPath, 'rendered', 'shots', shotId, 'preview');
    }
  };
}

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'amv-generation-task-'));
  const projectManager = createProjectManager(tmpRoot);
  const promptsDir = path.join(projectManager.projectPath, 'prompts', 'seedream');
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.writeFileSync(
    path.join(promptsDir, 'shot_01_A.txt'),
    [
      '--- SEEDREAM PROMPT ---',
      'Cinematic frame of the lead in rain.',
      '--- NEGATIVE PROMPT ---',
      'No distortions.'
    ].join('\n'),
    'utf8'
  );

  const storyboardPersistence = {
    readPrevisMapFile() {
      return {};
    }
  };

  const replicateMissing = {
    isConfigured() {
      return false;
    }
  };

  const servicePreflight = createGenerationTaskService({
    projectManager,
    replicate: replicateMissing,
    generationJobs: {},
    renderManagement: createRenderManagementStub(projectManager.projectPath),
    storyboardPersistence
  });

  const preflight = servicePreflight.buildShotGenerationPreflight({
    project: 'default',
    shotId: 'SHOT_01',
    variation: 'A',
    tool: 'seedream'
  });
  assert.strictEqual(preflight.success, true);
  assert.strictEqual(preflight.recommendedAction, 'set_replicate_key');

  const replicateReady = {
    isConfigured() {
      return true;
    },
    async createPrediction(_prompt, options) {
      const maxImages = Number(options && options.max_images);
      if (Number.isFinite(maxImages) && maxImages >= 2) {
        return {
          output: ['https://example.com/img1.png', 'https://example.com/img2.png'],
          predictionId: 'pred_pair',
          duration: 1.4
        };
      }
      return {
        output: ['https://example.com/img1.png'],
        predictionId: 'pred_test',
        duration: 1.1
      };
    },
    async downloadImage(_url, savePath) {
      fs.mkdirSync(path.dirname(savePath), { recursive: true });
      fs.writeFileSync(savePath, Buffer.from('png'));
      return { path: savePath, size: 3 };
    }
  };

  const serviceGenerate = createGenerationTaskService({
    projectManager,
    replicate: replicateReady,
    generationJobs: {
      createJob() { return { jobId: 'job1', status: 'queued' }; },
      runJob() {}
    },
    renderManagement: createRenderManagementStub(projectManager.projectPath),
    storyboardPersistence
  });

  const result = await serviceGenerate.executeGenerateShotTask({
    project: 'default',
    shotId: 'SHOT_01',
    variation: 'A',
    maxImages: 1,
    requireReference: true,
    previewOnly: true
  });

  assert.ok(Array.isArray(result.images));
  assert.ok(Array.isArray(result.frameAssignments));
  assert.strictEqual(result.frameAssignments.length, 1);
  assert.strictEqual(result.frameAssignments[0].frame, 'first');
  assert.strictEqual(result.isFirstLastPair, false);
  assert.ok(Array.isArray(result.referenceManifest));
  assert.ok(result.referenceManifest.length >= 2);
  assert.strictEqual(result.referenceManifest[0].sourceType, 'continuity');
  assert.strictEqual(result.referenceManifest[1].sourceType, 'uploaded_ref_set');
  assert.ok(result.preflightSnapshot);
  assert.strictEqual(result.preflightSnapshot.options.referencePolicy, 'continuity_then_uploaded_then_canon');

  const pairResult = await serviceGenerate.executeGenerateShotTask({
    project: 'default',
    shotId: 'SHOT_01',
    variation: 'A',
    maxImages: 2,
    requireReference: true,
    previewOnly: true
  });
  assert.ok(Array.isArray(pairResult.images));
  assert.strictEqual(pairResult.images.length, 2);
  assert.ok(Array.isArray(pairResult.frameAssignments));
  assert.strictEqual(pairResult.frameAssignments.length, 2);
  assert.strictEqual(pairResult.frameAssignments[0].frame, 'first');
  assert.strictEqual(pairResult.frameAssignments[1].frame, 'last');
  assert.strictEqual(pairResult.isFirstLastPair, true);
  assert.strictEqual(pairResult.generationMode, 'first_last_pair');

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('generation-task-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
