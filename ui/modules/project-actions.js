(function(root) {
  'use strict';

  function asErrorMessage(err, fallback) {
    if (err && err.message) return String(err.message);
    return fallback || 'Action failed';
  }

  function resolveProjectLabel(project) {
    if (!project || typeof project !== 'object') return '';
    return String(project.name || project.id || '').trim();
  }

  function notifyError(message, showToast) {
    if (typeof showToast === 'function') {
      showToast('Error', message, 'error', 4000);
      return;
    }
    if (typeof root.alert === 'function') {
      root.alert(message);
      return;
    }
    /* silently handled */
  }

  function bindProjectActions(options) {
    var opts = options || {};
    var showToast = opts.showToast;
    var dismissToast = opts.dismissToast;
    var getCurrentProject = typeof opts.getCurrentProject === 'function'
      ? opts.getCurrentProject
      : function() { return null; };
    var onCreate = typeof opts.createProject === 'function' ? opts.createProject : null;
    var onDelete = typeof opts.deleteProject === 'function' ? opts.deleteProject : null;

    var newProjectBtn = document.getElementById('newProjectBtn');
    var deleteProjectBtn = document.getElementById('deleteProjectBtn');
    var newProjectModal = document.getElementById('newProjectModal');
    var newProjectModalClose = document.getElementById('newProjectModalClose');
    var newProjectModalOverlay = document.getElementById('newProjectModalOverlay');
    var cancelNewProjectBtn = document.getElementById('cancelNewProject');
    var createNewProjectBtn = document.getElementById('createNewProject');
    var projectNameInput = document.getElementById('projectName');
    var projectDescriptionInput = document.getElementById('projectDescription');

    if (newProjectBtn && newProjectModal && onCreate && newProjectBtn.dataset.projectActionsBound !== '1') {
      newProjectBtn.dataset.projectActionsBound = '1';

      var closeNewProjectModal = function() {
        newProjectModal.style.display = 'none';
      };

      newProjectBtn.addEventListener('click', function() {
        if (projectNameInput) projectNameInput.value = '';
        if (projectDescriptionInput) projectDescriptionInput.value = '';
        newProjectModal.style.display = 'flex';
      });

      if (newProjectModalClose) newProjectModalClose.addEventListener('click', closeNewProjectModal);
      if (newProjectModalOverlay) newProjectModalOverlay.addEventListener('click', closeNewProjectModal);
      if (cancelNewProjectBtn) cancelNewProjectBtn.addEventListener('click', closeNewProjectModal);

      if (createNewProjectBtn && createNewProjectBtn.dataset.projectActionsBound !== '1') {
        createNewProjectBtn.dataset.projectActionsBound = '1';
        createNewProjectBtn.addEventListener('click', async function() {
          var name = String(projectNameInput ? projectNameInput.value : '').trim();
          var description = String(projectDescriptionInput ? projectDescriptionInput.value : '').trim();

          if (!name) {
            notifyError('Project name is required.', showToast);
            return;
          }

          var loadingToast = typeof showToast === 'function'
            ? showToast('Creating project...', name, 'info', 0)
            : null;
          try {
            var result = await onCreate({ name: name, description: description });
            if (result && result.ok === false) {
              throw new Error(result.error || 'Failed to create project');
            }
          } catch (err) {
            if (loadingToast && typeof dismissToast === 'function') {
              dismissToast(loadingToast);
            }
            notifyError(asErrorMessage(err, 'Failed to create project'), showToast);
            return;
          }

          closeNewProjectModal();
        });
      }
    }

    if (deleteProjectBtn && onDelete && deleteProjectBtn.dataset.projectActionsBound !== '1') {
      deleteProjectBtn.dataset.projectActionsBound = '1';
      deleteProjectBtn.addEventListener('click', async function() {
        var project = getCurrentProject();
        if (!project || !project.id) {
          notifyError('No active project selected.', showToast);
          return;
        }

        var projectName = resolveProjectLabel(project) || String(project.id);
        var confirmMessage = typeof opts.confirmDeleteMessage === 'function'
          ? opts.confirmDeleteMessage(project)
          : 'Delete project "' + projectName + '"? This cannot be undone.';
        if (typeof root.confirm === 'function' && !root.confirm(confirmMessage)) {
          return;
        }

        var loadingToast = typeof showToast === 'function'
          ? showToast('Deleting project...', projectName, 'info', 0)
          : null;
        try {
          var result = await onDelete({ projectId: String(project.id), projectName: projectName, project: project });
          if (result && result.ok === false) {
            throw new Error(result.error || 'Failed to delete project');
          }
        } catch (err) {
          if (loadingToast && typeof dismissToast === 'function') {
            dismissToast(loadingToast);
          }
          notifyError(asErrorMessage(err, 'Failed to delete project'), showToast);
        }
      });
    }
  }

  var api = {
    bindProjectActions: bindProjectActions
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ProjectActions = api;
})(typeof window !== 'undefined' ? window : globalThis);
