const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPageChatStoreService } = require('../../scripts/services/page_chat_store_service');
const { createPageChatApplyService } = require('../../scripts/services/page_chat_apply_service');

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
        throw new Error('Unknown project');
      }
      return subPath ? path.join(projectPath, subPath) : projectPath;
    }
  };
}

function canonFilename(type) {
  const map = {
    style: 'visual_style.json',
    script: 'shot_list.json',
    transcript: 'transcript.json',
    assets: 'asset_manifest.json',
    youtubeScript: 'youtube_script.json'
  };
  return map[type] || `${type}.json`;
}

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'amv-page-chat-apply-'));
  const projectManager = createProjectManager(tmpRoot);
  const projectPath = projectManager.getProjectPath('default');

  const musicDir = path.join(projectPath, 'music');
  fs.mkdirSync(musicDir, { recursive: true });
  const conceptPath = path.join(musicDir, 'concept.txt');
  fs.writeFileSync(conceptPath, 'old concept', 'utf8');

  const promptsDir = path.join(projectPath, 'prompts', 'seedream');
  fs.mkdirSync(promptsDir, { recursive: true });
  const shotPromptPath = path.join(promptsDir, 'shot_03_A.txt');
  fs.writeFileSync(shotPromptPath, 'old shot prompt', 'utf8');

  const store = createPageChatStoreService({ projectManager });
  const session = store.openOrCreateSession({ projectId: 'default', pageId: 'step1', url: '/step1.html' }).session;

  const contextService = {
    resolveShotPromptTarget(_projectId, target) {
      return {
        absolutePath: shotPromptPath,
        relativePath: 'prompts/seedream/shot_03_A.txt',
        kind: 'shot_prompt',
        shotId: target.shotId,
        variation: target.variation,
        tool: target.tool
      };
    }
  };

  const applyService = createPageChatApplyService({
    projectManager,
    canonFilename,
    contextService
  });

  const result = applyService.applyProposals({
    projectId: 'default',
    pageId: 'step1',
    sessionId: session.sessionId,
    applyId: 'apply_test_1',
    proposals: [
      {
        proposalId: 'prop_1',
        target: { kind: 'content', contentType: 'concept' },
        newContent: 'new concept from chat',
        baseHash: 'sha256:stale_hash'
      }
    ],
    store
  });

  assert.strictEqual(result.applied.length, 1);
  assert.strictEqual(result.applied[0].path, 'music/concept.txt');
  assert.strictEqual(result.applied[0].conflict.detected, true);
  assert.strictEqual(fs.readFileSync(conceptPath, 'utf8'), 'new concept from chat');

  const undo = applyService.undoApply({
    projectId: 'default',
    sessionId: session.sessionId,
    applyId: 'apply_test_1',
    store
  });

  assert.strictEqual(undo.revertedCount, 1);
  assert.strictEqual(fs.readFileSync(conceptPath, 'utf8'), 'old concept');

  const undoAgain = applyService.undoApply({
    projectId: 'default',
    sessionId: session.sessionId,
    applyId: 'apply_test_1',
    store
  });
  assert.strictEqual(undoAgain.revertedCount, 0);
  assert.strictEqual(undoAgain.alreadyReverted, true);

  // Validate step-5 shot prompt target write path also works through the same service.
  const shotSession = store.openOrCreateSession({ projectId: 'default', pageId: 'index', url: '/index.html' }).session;
  applyService.applyProposals({
    projectId: 'default',
    pageId: 'index',
    sessionId: shotSession.sessionId,
    applyId: 'apply_test_2',
    proposals: [
      {
        proposalId: 'prop_2',
        target: { kind: 'shot_prompt', shotId: 'SHOT_03', variation: 'A', tool: 'seedream' },
        newContent: 'updated shot prompt',
        baseHash: ''
      }
    ],
    store
  });
  assert.strictEqual(fs.readFileSync(shotPromptPath, 'utf8'), 'updated shot prompt');

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('page-chat-apply-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
