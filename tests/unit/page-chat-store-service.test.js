const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPageChatStoreService } = require('../../scripts/services/page_chat_store_service');

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

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'amv-page-chat-store-'));
  const projectManager = createProjectManager(tmpRoot);
  const store = createPageChatStoreService({ projectManager });

  const opened = store.openOrCreateSession({
    projectId: 'default',
    pageId: 'index',
    url: '/index.html'
  });
  assert.strictEqual(opened.created, true);
  assert.ok(opened.session.sessionId);

  const status0 = store.getStatus('default', 'index');
  assert.strictEqual(status0.lastSessionId, opened.session.sessionId);
  assert.strictEqual(status0.messageCount, 0);

  store.addMessage('default', opened.session.sessionId, {
    role: 'user',
    text: 'Hello chat'
  });
  store.setPendingProposals('default', opened.session.sessionId, [{ proposalId: 'prop_1' }]);

  const loaded = store.loadSession('default', opened.session.sessionId);
  assert.strictEqual(loaded.messages.length, 1);
  assert.strictEqual(loaded.pendingProposals.length, 1);

  const status1 = store.getStatus('default', 'index');
  assert.strictEqual(status1.messageCount, 1);

  const applyId = store.createApplyId();
  store.saveApplyManifest('default', opened.session.sessionId, applyId, {
    applyId,
    writes: []
  });
  const loadedManifest = store.loadApplyManifest('default', opened.session.sessionId, applyId);
  assert.strictEqual(loadedManifest.applyId, applyId);

  store.appendApply('default', opened.session.sessionId, {
    applyId,
    appliedCount: 1
  });
  const withApply = store.loadSession('default', opened.session.sessionId);
  assert.strictEqual(withApply.applies.length, 1);

  const reopened = store.openOrCreateSession({
    projectId: 'default',
    pageId: 'index',
    url: '/index.html'
  });
  assert.strictEqual(reopened.created, false);
  assert.strictEqual(reopened.session.sessionId, opened.session.sessionId);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('page-chat-store-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
