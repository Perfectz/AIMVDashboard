(function(root) {
  'use strict';

  function requireFactory(name, factoryName, env) {
    var mod = env[name];
    if (!mod || !mod[factoryName]) {
      throw new Error(name + '.' + factoryName + ' is required');
    }
    return mod[factoryName]();
  }

  function createAppDeps(options) {
    var opts = options || {};
    var env = opts.windowRef || root;

    var referenceUploadService = null;
    var contentService = null;
    var projectService = null;
    var contentFeature = null;
    var projectFeature = null;
    var referenceFeature = null;

    function getReferenceUploadService() {
      if (!referenceUploadService) {
        referenceUploadService = requireFactory('ReferenceUploadService', 'createReferenceUploadService', env);
      }
      return referenceUploadService;
    }

    function getContentService() {
      if (!contentService) {
        contentService = requireFactory('ContentService', 'createContentService', env);
      }
      return contentService;
    }

    function getProjectService() {
      if (!projectService) {
        projectService = requireFactory('ProjectService', 'createProjectService', env);
      }
      return projectService;
    }

    function getReferenceFeature() {
      if (!referenceFeature) {
        if (!env.ReferenceFeature || !env.ReferenceFeature.createReferenceFeature) {
          throw new Error('ReferenceFeature.createReferenceFeature is required');
        }
        referenceFeature = env.ReferenceFeature.createReferenceFeature({
          referenceUploadService: getReferenceUploadService()
        });
      }
      return referenceFeature;
    }

    function getContentFeature() {
      if (!contentFeature) {
        if (!env.ContentFeature || !env.ContentFeature.createContentFeature) {
          throw new Error('ContentFeature.createContentFeature is required');
        }
        contentFeature = env.ContentFeature.createContentFeature({
          contentService: getContentService(),
          contentDomain: env.ContentDomain || null
        });
      }
      return contentFeature;
    }

    function getProjectFeature() {
      if (!projectFeature) {
        if (!env.ProjectFeature || !env.ProjectFeature.createProjectFeature) {
          throw new Error('ProjectFeature.createProjectFeature is required');
        }
        projectFeature = env.ProjectFeature.createProjectFeature({
          projectService: getProjectService(),
          storage: env.localStorage
        });
      }
      return projectFeature;
    }

    return {
      getReferenceUploadService: getReferenceUploadService,
      getContentService: getContentService,
      getProjectService: getProjectService,
      getReferenceFeature: getReferenceFeature,
      getContentFeature: getContentFeature,
      getProjectFeature: getProjectFeature
    };
  }

  var api = {
    createAppDeps: createAppDeps
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.AppDeps = api;
})(typeof window !== 'undefined' ? window : globalThis);
