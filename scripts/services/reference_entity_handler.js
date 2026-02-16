const fs = require('fs');
const path = require('path');

function parseSlotFromFilename(filename, matcher) {
  const match = filename.match(matcher);
  if (!match) return 0;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

class ReferenceEntityHandler {
  constructor(config) {
    this.entityType = config.entityType;
    this.entityLabel = config.entityLabel || this.entityType;
    this.regex = config.regex;
    this.subdir = config.subdir;
    this.includeDefinition = Boolean(config.includeDefinition);
    this.includePrompts = Boolean(config.includePrompts);
    this.includeGeneratedImages = Boolean(config.includeGeneratedImages);
    this.maxSlot = Number.isFinite(config.maxSlot) ? config.maxSlot : 14;
    this._projectManager = config.projectManager;
    this._safeResolve = config.safeResolve;
    this._sanitizePathSegment = config.sanitizePathSegment;
    this._imageExtensions = config.imageExtensions || new Set();
  }

  list(projectId) {
    const rootDir = this._projectManager.getProjectPath(projectId, this.subdir);
    if (!fs.existsSync(rootDir)) {
      return [];
    }

    return fs.readdirSync(rootDir)
      .filter((name) => {
        const fullPath = path.join(rootDir, name);
        return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
      })
      .map((name) => {
        const entityDir = path.join(rootDir, name);
        return this._buildEntityData(entityDir, name);
      });
  }

  add(projectId, entityName) {
    const safeName = this._sanitize(entityName);
    const entityDir = this._safeResolve(this._projectManager.getProjectPath(projectId, this.subdir), safeName);
    if (fs.existsSync(entityDir)) {
      throw new Error(`${this.entityLabel} already exists`);
    }
    fs.mkdirSync(entityDir, { recursive: true });
  }

  uploadImage(projectId, entityName, slot, fileExt, fileBuffer) {
    const parsedSlot = this._parseSlot(slot);
    const safeName = this._sanitize(entityName);
    const extension = String(fileExt || '').toLowerCase();
    if (!this._imageExtensions.has(extension)) {
      throw new Error('Invalid image format');
    }
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      throw new Error('Missing file');
    }

    const entityDir = this._safeResolve(this._projectManager.getProjectPath(projectId, this.subdir), safeName);
    if (!fs.existsSync(entityDir)) {
      fs.mkdirSync(entityDir, { recursive: true });
    }

    fs.readdirSync(entityDir).forEach((filename) => {
      if (filename.startsWith(`ref_${parsedSlot}.`)) {
        fs.unlinkSync(path.join(entityDir, filename));
      }
    });

    const newFilename = `ref_${parsedSlot}${extension}`;
    fs.writeFileSync(path.join(entityDir, newFilename), fileBuffer);
    return newFilename;
  }

  deleteImage(projectId, entityName, slot) {
    const parsedSlot = this._parseSlot(slot);
    const safeName = this._sanitize(entityName);
    const entityDir = this._safeResolve(this._projectManager.getProjectPath(projectId, this.subdir), safeName);
    if (!fs.existsSync(entityDir)) {
      return false;
    }

    const filename = fs.readdirSync(entityDir).find((entry) => entry.startsWith(`ref_${parsedSlot}.`));
    if (!filename) {
      return false;
    }
    fs.unlinkSync(path.join(entityDir, filename));
    return true;
  }

  deleteEntity(projectId, entityName) {
    const safeName = this._sanitize(entityName);
    const entityDir = this._safeResolve(this._projectManager.getProjectPath(projectId, this.subdir), safeName);
    if (!fs.existsSync(entityDir)) {
      return false;
    }
    fs.rmSync(entityDir, { recursive: true, force: true });
    return true;
  }

  _sanitize(value) {
    return this._sanitizePathSegment(value, this.regex, this.entityType);
  }

  _parseSlot(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > this.maxSlot) {
      throw new Error('Invalid slot');
    }
    return parsed;
  }

  _buildEntityData(entityDir, name) {
    const files = fs.existsSync(entityDir) ? fs.readdirSync(entityDir) : [];
    const images = files
      .filter((filename) => /^ref_\d+\.(png|jpg|jpeg|webp)$/i.test(filename))
      .map((filename) => ({
        filename,
        slot: parseSlotFromFilename(filename, /^ref_(\d+)\./i)
      }))
      .filter((entry) => entry.slot > 0);

    const payload = { name, images };

    if (this.includeGeneratedImages) {
      payload.generatedImages = files
        .filter((filename) => /^generated_0\d+\.(png|jpg|jpeg|webp)$/i.test(filename))
        .map((filename) => ({
          filename,
          slot: parseSlotFromFilename(filename, /^generated_0(\d+)\./i)
        }))
        .filter((entry) => entry.slot > 0);
    }

    if (this.includeDefinition) {
      const definitionPath = path.join(entityDir, 'definition.txt');
      payload.definition = fs.existsSync(definitionPath)
        ? fs.readFileSync(definitionPath, 'utf8')
        : '';
    }

    if (this.includePrompts) {
      payload.prompts = [1, 2, 3].map((slot) => {
        const promptPath = path.join(entityDir, `prompt_0${slot}.txt`);
        return fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : '';
      });
    }

    return payload;
  }
}

module.exports = {
  ReferenceEntityHandler
};
