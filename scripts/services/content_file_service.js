const fs = require('fs');
const path = require('path');

class ContentFileService {
  static CONTENT_TYPES = {
    'suno-prompt': {
      subdir: 'music',
      filename: 'suno_prompt.txt',
      maxSize: 50 * 1024
    },
    'song-info': {
      subdir: 'music',
      filename: 'song_info.txt',
      maxSize: 100 * 1024
    },
    analysis: {
      subdir: 'music',
      filename: 'analysis.json',
      maxSize: 500 * 1024,
      isJson: true,
      validateJson(value) {
        if (!value || !value.version || !value.duration || !value.bpm || !Array.isArray(value.sections)) {
          throw new Error('Missing required fields (version, duration, bpm, sections)');
        }
      }
    },
    concept: {
      subdir: 'music',
      filename: 'concept.txt',
      maxSize: 50 * 1024
    },
    inspiration: {
      subdir: 'music',
      filename: 'inspiration.txt',
      maxSize: 50 * 1024
    },
    mood: {
      subdir: 'music',
      filename: 'mood.txt',
      maxSize: 50 * 1024
    },
    genre: {
      subdir: 'music',
      filename: 'genre.txt',
      maxSize: 50 * 1024
    }
  };

  constructor(projectManager) {
    if (!projectManager || typeof projectManager.getProjectPath !== 'function') {
      throw new Error('ContentFileService requires projectManager');
    }
    this._projectManager = projectManager;
  }

  save(projectId, contentType, content) {
    const config = this._getConfig(contentType);

    if (typeof content !== 'string' || !content) {
      throw new Error('Invalid content');
    }
    if (content.length > config.maxSize) {
      throw new Error(`Content too large (max ${Math.round(config.maxSize / 1024)}KB)`);
    }

    let parsedJson = null;
    let normalizedContent = content;
    if (config.isJson) {
      try {
        parsedJson = JSON.parse(content);
      } catch (err) {
        throw new Error(`Invalid JSON format: ${err.message}`);
      }
      if (typeof config.validateJson === 'function') {
        config.validateJson(parsedJson);
      }
      normalizedContent = JSON.stringify(parsedJson, null, 2);
    }

    const dir = this._projectManager.getProjectPath(projectId, config.subdir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, config.filename);
    fs.writeFileSync(filePath, normalizedContent, 'utf8');

    return {
      filePath: `${config.subdir}/${config.filename}`,
      parsedJson
    };
  }

  load(projectId, contentType) {
    const config = this._getConfig(contentType);
    const filePath = path.join(this._projectManager.getProjectPath(projectId, config.subdir), config.filename);
    if (!fs.existsSync(filePath)) {
      return '';
    }
    return fs.readFileSync(filePath, 'utf8');
  }

  _getConfig(contentType) {
    const config = ContentFileService.CONTENT_TYPES[contentType];
    if (!config) {
      throw new Error('Unknown content type');
    }
    return config;
  }
}

module.exports = {
  ContentFileService
};
