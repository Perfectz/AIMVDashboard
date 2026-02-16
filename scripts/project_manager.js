#!/usr/bin/env node

/**
 * Project Manager - Multi-Project CRUD Operations
 * Version: 2026-02-07
 *
 * Manages multiple music video projects with complete data isolation.
 */

const fs = require('fs');
const path = require('path');
const { isPathInside, writeJsonPreserveEol } = require('./shared');

const ROOT_DIR = path.join(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT_DIR, 'projects');
const INDEX_FILE = path.join(PROJECTS_DIR, 'projects_index.json');
const PROJECT_ID_REGEX = /^[a-z0-9-]{1,50}$/;

class ProjectManager {
  getDiskProjectIds() {
    try {
      if (!fs.existsSync(PROJECTS_DIR)) return [];
      return fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((id) => PROJECT_ID_REGEX.test(id))
        .filter((id) => fs.existsSync(path.join(PROJECTS_DIR, id, 'project.json')))
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * Load projects index from disk
   */
  loadIndex() {
    try {
      if (!fs.existsSync(INDEX_FILE)) {
        // Return default structure if no index exists
        return {
          version: '2026-02-07',
          activeProject: 'default',
          projects: []
        };
      }

      const data = fs.readFileSync(INDEX_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error loading projects index:', err.message);
      return {
        version: '2026-02-07',
        activeProject: 'default',
        projects: []
      };
    }
  }

  /**
   * Save projects index to disk
   */
  saveIndex(data) {
    try {
      // Ensure projects directory exists
      if (!fs.existsSync(PROJECTS_DIR)) {
        fs.mkdirSync(PROJECTS_DIR, { recursive: true });
      }

      writeJsonPreserveEol(INDEX_FILE, data);
      return true;
    } catch (err) {
      console.error('Error saving projects index:', err.message);
      return false;
    }
  }

  /**
   * Create a new project with folder structure
   */
  createProject(name, description = '') {
    try {
      // Generate project ID from name (sanitized)
      const id = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);

      if (!PROJECT_ID_REGEX.test(id)) {
        throw new Error('Project name must produce a valid ID (a-z, 0-9, hyphen).');
      }

      // Check if project already exists
      if (this.projectExists(id)) {
        throw new Error(`Project '${id}' already exists`);
      }

      const projectDir = path.join(PROJECTS_DIR, id);

      // Create project directory structure
      const dirs = [
        projectDir,
        path.join(projectDir, 'bible'),
        path.join(projectDir, 'reference'),
        path.join(projectDir, 'reference', 'characters'),
        path.join(projectDir, 'reference', 'locations'),
        path.join(projectDir, 'prompts'),
        path.join(projectDir, 'rendered'),
        path.join(projectDir, 'rendered', 'shots'),
        path.join(projectDir, 'rendered', 'storyboard'),
        path.join(projectDir, 'music')
      ];

      for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // Create project.json
      const now = new Date().toISOString();
      const projectData = {
        id,
        name,
        description,
        createdAt: now,
        lastModified: now,
        music: {
          songTitle: '',
          artist: '',
          duration: 0,
          bpm: 0,
          sections: []
        },
        visualStyle: {
          genre: '',
          colorPalette: [],
          themes: []
        },
        stats: {
          totalShots: 0,
          renderedShots: 0,
          selectedShots: 0,
          totalDuration: 0
        }
      };

      writeJsonPreserveEol(path.join(projectDir, 'project.json'), projectData);

      // Create default sequence.json
      const sequenceData = {
        version: '2026-02-07',
        projectName: name,
        totalShots: 0,
        totalDuration: 0,
        musicFile: '',
        selections: [],
        lastUpdated: now
      };

      writeJsonPreserveEol(path.join(projectDir, 'rendered', 'storyboard', 'sequence.json'), sequenceData);

      // Update projects index
      const index = this.loadIndex();
      index.projects.push({
        id,
        name,
        createdAt: now,
        lastModified: now,
        status: 'active'
      });

      // Set as active if it's the first project
      if (index.projects.length === 1) {
        index.activeProject = id;
      }

      this.saveIndex(index);

      return projectData;
    } catch (err) {
      console.error('Error creating project:', err.message);
      throw err;
    }
  }

  /**
   * Get project metadata
   */
  getProject(projectId) {
    try {
      if (!PROJECT_ID_REGEX.test(projectId || '')) {
        throw new Error(`Invalid project ID: '${projectId}'`);
      }
      const projectFile = path.join(PROJECTS_DIR, projectId, 'project.json');

      if (!fs.existsSync(projectFile)) {
        throw new Error(`Project '${projectId}' not found`);
      }

      const data = fs.readFileSync(projectFile, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error loading project:', err.message);
      throw err;
    }
  }

  /**
   * Update project metadata
   */
  updateProject(projectId, updates) {
    try {
      if (!PROJECT_ID_REGEX.test(projectId || '')) {
        throw new Error(`Invalid project ID: '${projectId}'`);
      }
      const project = this.getProject(projectId);

      // Merge updates
      const updated = {
        ...project,
        ...updates,
        id: project.id, // Preserve ID
        createdAt: project.createdAt, // Preserve creation date
        lastModified: new Date().toISOString()
      };

      // Save updated project.json
      const projectFile = path.join(PROJECTS_DIR, projectId, 'project.json');
      writeJsonPreserveEol(projectFile, updated);

      // Update index if name changed
      if (updates.name && updates.name !== project.name) {
        const index = this.loadIndex();
        const indexEntry = index.projects.find(p => p.id === projectId);
        if (indexEntry) {
          indexEntry.name = updates.name;
          indexEntry.lastModified = updated.lastModified;
          this.saveIndex(index);
        }
      }

      return updated;
    } catch (err) {
      console.error('Error updating project:', err.message);
      throw err;
    }
  }

  /**
   * Delete project (removes folder and index entry)
   */
  deleteProject(projectId) {
    try {
      if (!PROJECT_ID_REGEX.test(projectId || '')) {
        throw new Error(`Invalid project ID: '${projectId}'`);
      }
      // Don't allow deleting the active project if it's the only one
      const index = this.loadIndex();

      if (index.projects.length === 1 && index.projects[0].id === projectId) {
        throw new Error('Cannot delete the only project');
      }

      // Remove from index
      index.projects = index.projects.filter(p => p.id !== projectId);

      // If deleting active project, switch to first available
      if (index.activeProject === projectId && index.projects.length > 0) {
        index.activeProject = index.projects[0].id;
      }

      this.saveIndex(index);

      // Remove project directory
      const projectDir = path.join(PROJECTS_DIR, projectId);
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }

      return true;
    } catch (err) {
      console.error('Error deleting project:', err.message);
      throw err;
    }
  }

  /**
   * List all projects
   */
  listProjects() {
    const index = this.loadIndex();
    const projects = Array.isArray(index.projects) ? index.projects : [];
    const existingIds = new Set(this.getDiskProjectIds());
    const byId = new Map();

    for (const project of projects) {
      if (!project || !project.id || !existingIds.has(project.id)) continue;
      byId.set(project.id, project);
    }

    for (const projectId of existingIds) {
      if (byId.has(projectId)) continue;
      try {
        const metadata = this.getProject(projectId);
        byId.set(projectId, {
          id: metadata.id,
          name: metadata.name || metadata.id,
          createdAt: metadata.createdAt || new Date().toISOString(),
          lastModified: metadata.lastModified || metadata.createdAt || new Date().toISOString(),
          status: 'active'
        });
      } catch {
        byId.set(projectId, {
          id: projectId,
          name: projectId,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          status: 'active'
        });
      }
    }

    return Array.from(byId.values());
  }

  /**
   * Check if project exists
   */
  projectExists(projectId) {
    if (!PROJECT_ID_REGEX.test(projectId || '')) {
      return false;
    }
    const projectDir = path.join(PROJECTS_DIR, projectId);
    return fs.existsSync(projectDir) && fs.existsSync(path.join(projectDir, 'project.json'));
  }

  /**
   * Get project path with optional subdirectory
   */
  getProjectPath(projectId, subdir = '') {
    if (!PROJECT_ID_REGEX.test(projectId || '')) {
      throw new Error(`Invalid project ID: '${projectId}'`);
    }
    const projectDir = path.resolve(PROJECTS_DIR, projectId);
    if (!isPathInside(PROJECTS_DIR, projectDir)) {
      throw new Error('Invalid project path');
    }

    if (!subdir) {
      return projectDir;
    }

    const fullPath = path.resolve(projectDir, subdir);
    if (!isPathInside(projectDir, fullPath)) {
      throw new Error('Invalid subdirectory path');
    }

    return fullPath;
  }

  /**
   * Get active project ID
   */
  getActiveProject() {
    const index = this.loadIndex();
    const activeProject = String(index.activeProject || '').trim();
    if (this.projectExists(activeProject)) {
      return activeProject;
    }

    const indexedExisting = (Array.isArray(index.projects) ? index.projects : [])
      .map((project) => String((project && project.id) || '').trim())
      .find((projectId) => this.projectExists(projectId));

    if (indexedExisting) {
      index.activeProject = indexedExisting;
      this.saveIndex(index);
      return indexedExisting;
    }

    const diskProjects = this.getDiskProjectIds();
    if (diskProjects.length > 0) {
      index.activeProject = diskProjects[0];
      this.saveIndex(index);
      return diskProjects[0];
    }

    return 'default';
  }

  /**
   * Set active project
   */
  setActiveProject(projectId) {
    try {
      if (!PROJECT_ID_REGEX.test(projectId || '')) {
        throw new Error(`Invalid project ID: '${projectId}'`);
      }
      if (!this.projectExists(projectId)) {
        throw new Error(`Project '${projectId}' not found`);
      }

      const index = this.loadIndex();
      index.activeProject = projectId;
      this.saveIndex(index);

      return true;
    } catch (err) {
      console.error('Error setting active project:', err.message);
      throw err;
    }
  }
}

// Export singleton instance
module.exports = new ProjectManager();
