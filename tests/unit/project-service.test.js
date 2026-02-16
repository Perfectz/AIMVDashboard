const assert = require('assert');
const { createProjectService } = require('../../ui/services/project-service.js');

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

  const httpClientFactory = {
    createHttpClient() {
      return {
        async request(url, options) {
          captured.push({ url, options });
          if (url === '/api/projects' && options.method === 'GET') {
            return { response: { ok: true }, payload: { success: true, projects: [{ id: 'default', name: 'Default' }] } };
          }
          if (url === '/api/projects' && options.method === 'POST') {
            return { response: { ok: true }, payload: { success: true, project: { id: 'new-project' } } };
          }
          if (url === '/api/projects/p1' && options.method === 'DELETE') {
            return { response: { ok: true }, payload: { success: true, message: 'Project deleted' } };
          }
          return { response: { ok: false }, payload: { success: false, error: 'Unexpected call' } };
        }
      };
    }
  };

  const service = createProjectService({ httpClientFactory });

  const listResult = await service.listProjects();
  assert.strictEqual(listResult.ok, true);
  assert.strictEqual(listResult.data.projects[0].id, 'default');

  const createResult = await service.createProject({ name: 'New', description: 'Desc' });
  assert.strictEqual(createResult.ok, true);
  assert.strictEqual(createResult.data.project.id, 'new-project');

  const deleteResult = await service.deleteProject('p1');
  assert.strictEqual(deleteResult.ok, true);
  assert.strictEqual(deleteResult.data.success, true);

  assert.strictEqual(captured.length, 3);
  assert.strictEqual(captured[0].url, '/api/projects');
  assert.strictEqual(captured[1].url, '/api/projects');
  assert.strictEqual(captured[2].url, '/api/projects/p1');
  assert.strictEqual(captured[1].options.body.entries[0][0], 'name');
  assert.strictEqual(captured[1].options.body.entries[1][0], 'description');
  assert.strictEqual(captured[2].options.method, 'DELETE');

  console.log('project-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
