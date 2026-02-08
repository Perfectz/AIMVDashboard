#!/usr/bin/env node

/**
 * Project Manager - Multi-Project CRUD Operations
 * Version: 2026-02-07
 *
 * Manages multiple music video projects with complete data isolation.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT_DIR, 'projects');
const INDEX_FILE = path.join(PROJECTS_DIR, 'projects_index.json');

class ProjectManager {
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

      fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2), 'utf8');
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

      fs.writeFileSync(
        path.join(projectDir, 'project.json'),
        JSON.stringify(projectData, null, 2),
        'utf8'
      );

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

      fs.writeFileSync(
        path.join(projectDir, 'rendered', 'storyboard', 'sequence.json'),
        JSON.stringify(sequenceData, null, 2),
        'utf8'
      );

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
      fs.writeFileSync(projectFile, JSON.stringify(updated, null, 2), 'utf8');

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
    return index.projects;
  }

  /**
   * Check if project exists
   */
  projectExists(projectId) {
    const projectDir = path.join(PROJECTS_DIR, projectId);
    return fs.existsSync(projectDir) && fs.existsSync(path.join(projectDir, 'project.json'));
  }

  /**
   * Get project path with optional subdirectory
   */
  getProjectPath(projectId, subdir = '') {
    const projectDir = path.join(PROJECTS_DIR, projectId);

    if (subdir) {
      return path.join(projectDir, subdir);
    }

    return projectDir;
  }

  /**
   * Get active project ID
   */
  getActiveProject() {
    const index = this.loadIndex();
    return index.activeProject || 'default';
  }

  /**
   * Set active project
   */
  setActiveProject(projectId) {
    try {
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
