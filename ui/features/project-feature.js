(function(root) {
  'use strict';

  function createProjectFeature(options) {
    var opts = options || {};
    var projectService = opts.projectService;
    var storage = opts.storage || (root && root.localStorage ? root.localStorage : null);

    if (!projectService || !projectService.listProjects || !projectService.createProject) {
      throw new Error('projectService with listProjects/createProject is required');
    }

    function getActiveProjectId() {
      if (!storage || !storage.getItem) return '';
      try {
        return String(storage.getItem('activeProject') || '');
      } catch (err) {
        return '';
      }
    }

    function setActiveProjectId(projectId) {
      if (!storage || !storage.setItem) return;
      try {
        storage.setItem('activeProject', String(projectId || ''));
      } catch (err) {
        // private browsing or blocked storage
      }
    }

    async function loadProjects() {
      var result = await projectService.listProjects();
      if (!result.ok || !result.data || !result.data.success) {
        return { ok: false, error: result.error || 'Failed to load projects' };
      }

      var projects = Array.isArray(result.data.projects) ? result.data.projects : [];
      if (projects.length === 0) {
        return { ok: false, error: 'No projects found' };
      }

      var activeId = getActiveProjectId() || projects[0].id;
      var currentProject = projects.find(function(project) { return project.id === activeId; }) || projects[0];
      setActiveProjectId(currentProject.id);

      return {
        ok: true,
        projects: projects,
        currentProject: currentProject
      };
    }

    async function createProject(input) {
      var result = await projectService.createProject(input || {});
      if (!result.ok || !result.data || !result.data.project || !result.data.project.id) {
        return { ok: false, error: result.error || 'Failed to create project' };
      }
      setActiveProjectId(result.data.project.id);
      return { ok: true, project: result.data.project };
    }

    async function deleteProject(projectId) {
      var id = String(projectId || '').trim();
      if (!id) {
        return { ok: false, error: 'Project ID is required' };
      }
      if (typeof projectService.deleteProject !== 'function') {
        return { ok: false, error: 'Delete project is not available in this page context' };
      }

      var result = await projectService.deleteProject(id);
      if (!result.ok || !result.data || !result.data.success) {
        return { ok: false, error: result.error || 'Failed to delete project' };
      }
      return { ok: true, data: result.data };
    }

    return {
      getActiveProjectId: getActiveProjectId,
      setActiveProjectId: setActiveProjectId,
      loadProjects: loadProjects,
      createProject: createProject,
      deleteProject: deleteProject
    };
  }

  var api = {
    createProjectFeature: createProjectFeature
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ProjectFeature = api;
})(typeof window !== 'undefined' ? window : globalThis);
