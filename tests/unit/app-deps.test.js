const assert = require('assert');
const { createAppDeps } = require('../../ui/controllers/app-deps.js');

function makeFactory(result) {
  return { create: () => result };
}

async function run() {
  const env = {
    localStorage: {
      getItem() { return 'p1'; },
      setItem() {}
    },
    ReferenceUploadService: { createReferenceUploadService: () => ({ uploadCharacterReference: async () => ({ ok: true }), uploadLocationReference: async () => ({ ok: true }), uploadShotRenderFrame: async () => ({ ok: true }) }) },
    ContentService: { createContentService: () => ({ saveContent: async () => ({ ok: true }), loadContent: async () => ({ ok: true }) }) },
    ProjectService: { createProjectService: () => ({ listProjects: async () => ({ ok: true, data: { success: true, projects: [{ id: 'p1' }] } }), createProject: async () => ({ ok: true, data: { project: { id: 'p2' } } }) }) },
    ReferenceFeature: { createReferenceFeature: ({ referenceUploadService }) => ({ uploadCharacterReference: referenceUploadService.uploadCharacterReference }) },
    ContentFeature: { createContentFeature: ({ contentService }) => ({ saveContent: contentService.saveContent }) },
    ProjectFeature: { createProjectFeature: ({ projectService }) => ({ loadProjects: projectService.listProjects }) }
  };

  const deps = createAppDeps({ windowRef: env });
  assert.ok(deps.getReferenceUploadService());
  assert.ok(deps.getContentService());
  assert.ok(deps.getProjectService());
  assert.ok(deps.getReferenceFeature());
  assert.ok(deps.getContentFeature());
  assert.ok(deps.getProjectFeature());

  console.log('app-deps.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
