(function(root) {
  'use strict';

  function resolveDependency(name, directValue) {
    if (directValue) return directValue;
    if (root && root[name]) return root[name];
    return null;
  }

  function createProjectService(options) {
    var opts = options || {};
    var httpClientFactory = resolveDependency('HttpClient', opts.httpClientFactory);
    var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);

    if (!httpClientFactory || !httpClientFactory.createHttpClient) {
      throw new Error('HttpClient.createHttpClient is required');
    }

    var httpClient = httpClientFactory.createHttpClient({ fetchImpl: fetchImpl });

    async function listProjects() {
      var result = await httpClient.request('/api/projects', { method: 'GET' });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to load projects' };
      }
      return { ok: true, data: result.payload };
    }

    async function createProject(input) {
      var formData = new FormData();
      formData.append('name', String((input && input.name) || ''));
      formData.append('description', String((input && input.description) || ''));

      var result = await httpClient.request('/api/projects', {
        method: 'POST',
        body: formData
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to create project' };
      }
      return { ok: true, data: result.payload };
    }

    async function deleteProject(projectId) {
      var id = String(projectId || '').trim();
      if (!id) {
        return { ok: false, error: 'Project ID is required' };
      }

      var result = await httpClient.request('/api/projects/' + encodeURIComponent(id), {
        method: 'DELETE'
      });
      if (!result.response.ok || !result.payload.success) {
        return { ok: false, error: result.payload.error || 'Failed to delete project' };
      }
      return { ok: true, data: result.payload };
    }

    return {
      listProjects: listProjects,
      createProject: createProject,
      deleteProject: deleteProject
    };
  }

  var api = {
    createProjectService: createProjectService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ProjectService = api;
})(typeof window !== 'undefined' ? window : globalThis);
