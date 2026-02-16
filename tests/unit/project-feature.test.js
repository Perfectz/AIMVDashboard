const assert = require('assert');
const { createProjectFeature } = require('../../ui/features/project-feature.js');

function createStorageStub() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    }
  };
}

async function run() {
  const storage = createStorageStub();

  const feature = createProjectFeature({
    storage,
    projectService: {
      async listProjects() {
        return {
          ok: true,
          data: { success: true, projects: [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }] }
        };
      },
      async createProject() {
        return {
          ok: true,
          data: { project: { id: 'p3', name: 'Three' } }
        };
      },
      async deleteProject() {
        return {
          ok: true,
          data: { success: true, message: 'Project deleted' }
        };
      }
    }
  });

  const firstLoad = await feature.loadProjects();
  assert.strictEqual(firstLoad.ok, true);
  assert.strictEqual(firstLoad.currentProject.id, 'p1');

  feature.setActiveProjectId('p2');
  const secondLoad = await feature.loadProjects();
  assert.strictEqual(secondLoad.currentProject.id, 'p2');

  const createResult = await feature.createProject({ name: 'Three' });
  assert.strictEqual(createResult.ok, true);
  assert.strictEqual(createResult.project.id, 'p3');
  assert.strictEqual(feature.getActiveProjectId(), 'p3');

  const deleteResult = await feature.deleteProject('p2');
  assert.strictEqual(deleteResult.ok, true);
  assert.strictEqual(deleteResult.data.success, true);

  console.log('project-feature.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
