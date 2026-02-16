const fs = require('fs');
const path = require('path');

function registerUploadRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    parseMultipartData,
    resolveProjectId,
    getProjectContext,
    validateFile,
    sanitizeFilename,
    sanitizePathSegment,
    SHOT_ID_REGEX,
    VARIATION_REGEX,
    projectManager,
    ALLOWED_MUSIC_TYPES,
    ALLOWED_VIDEO_TYPES,
    ALLOWED_IMAGE_TYPES,
    MAX_MUSIC_SIZE,
    MAX_VIDEO_SIZE,
    MAX_IMAGE_SIZE,
    readSequenceFile,
    writeSequenceFile,
    normalizeShotReviewFields
  } = ctx;

  router.post('/api/upload/music', (req, res) => {
    parseMultipartData(req, (err, parsed) => {
      const fields = (parsed && parsed.fields) || {};
      const files = (parsed && parsed.files) || [];
      if (err || files.length === 0) {
        sendJSON(
          res,
          err && err.message === 'File too large' ? 413 : 400,
          { success: false, error: err ? err.message : 'No file provided' }
        );
        return;
      }

      let projectId;
      try {
        projectId = resolveProjectId(fields.project || getProjectContext(req).projectId, { required: true });
      } catch (ctxErr) {
        sendJSON(res, 400, { success: false, error: ctxErr.message });
        return;
      }

      const file = files[0];
      const validation = validateFile(
        file.filename,
        file.buffer.length,
        ALLOWED_MUSIC_TYPES,
        MAX_MUSIC_SIZE
      );
      if (!validation.valid) {
        sendJSON(res, 400, { success: false, error: validation.error });
        return;
      }

      const musicDir = projectManager.getProjectPath(projectId, 'music');
      if (!fs.existsSync(musicDir)) {
        fs.mkdirSync(musicDir, { recursive: true });
      }

      const filename = sanitizeFilename(file.filename);
      const filePath = path.join(musicDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      const sequence = readSequenceFile(projectId);
      sequence.musicFile = `music/${filename}`;
      writeSequenceFile(sequence, projectId);

      sendJSON(res, 200, {
        success: true,
        filePath: `music/${filename}`,
        message: 'Music uploaded successfully'
      });
    });
  });

  router.post('/api/upload/shot', (req, res) => {
    parseMultipartData(req, (err, parsed) => {
      const fields = (parsed && parsed.fields) || {};
      const files = (parsed && parsed.files) || [];
      if (err || files.length === 0) {
        sendJSON(
          res,
          err && err.message === 'File too large' ? 413 : 400,
          { success: false, error: err ? err.message : 'No file provided' }
        );
        return;
      }

      let projectId;
      try {
        projectId = resolveProjectId(fields.project || getProjectContext(req).projectId, { required: true });
      } catch (ctxErr) {
        sendJSON(res, 400, { success: false, error: ctxErr.message });
        return;
      }

      const { shotId, variation, fileType } = fields;
      const file = files[0];

      if (!shotId || !variation || !fileType) {
        sendJSON(res, 400, { success: false, error: 'Missing parameters' });
        return;
      }

      try {
        sanitizePathSegment(shotId, SHOT_ID_REGEX, 'shotId');
        if (fileType === 'kling') {
          sanitizePathSegment(variation, VARIATION_REGEX, 'variation');
        }
      } catch (validationErr) {
        sendJSON(res, 400, { success: false, error: validationErr.message });
        return;
      }

      const isVideo = fileType === 'kling';
      const validation = validateFile(
        file.filename,
        file.buffer.length,
        isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES,
        isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
      );
      if (!validation.valid) {
        sendJSON(res, 400, { success: false, error: validation.error });
        return;
      }

      const shotDir = path.join(
        projectManager.getProjectPath(projectId, 'rendered'),
        'shots',
        shotId
      );
      if (!fs.existsSync(shotDir)) {
        fs.mkdirSync(shotDir, { recursive: true });
      }

      let filename;
      if (fileType === 'kling') {
        filename = `kling_option_${variation}.mp4`;
      } else if (fileType === 'nano-first') {
        filename = 'nano_first_frame.png';
      } else if (fileType === 'nano-last') {
        filename = 'nano_last_frame.png';
      } else {
        sendJSON(res, 400, { success: false, error: 'Invalid fileType' });
        return;
      }

      const filePath = path.join(shotDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      const sequence = readSequenceFile(projectId);
      if (!Array.isArray(sequence.selections)) {
        sequence.selections = [];
      }
      let shot = sequence.selections.find((item) => item.shotId === shotId);

      if (!shot) {
        shot = {
          shotId,
          selectedVariation: 'none',
          status: 'rendered',
          reviewStatus: 'draft',
          comments: [],
          renderFiles: { kling: {}, nano: {} }
        };
        sequence.selections.push(shot);
      }

      normalizeShotReviewFields(shot);
      if (!shot.renderFiles) shot.renderFiles = { kling: {}, nano: {} };

      const relativePath = `rendered/shots/${shotId}/${filename}`;
      if (fileType === 'kling') {
        shot.renderFiles.kling[variation] = relativePath;
      } else if (fileType === 'nano-first') {
        shot.renderFiles.nano.firstFrame = relativePath;
      } else if (fileType === 'nano-last') {
        shot.renderFiles.nano.lastFrame = relativePath;
      }

      sequence.totalShots = sequence.selections.length;
      writeSequenceFile(sequence, projectId);

      sendJSON(res, 200, {
        success: true,
        filePath: relativePath,
        message: 'Shot uploaded successfully'
      });
    });
  });

  router.get('/api/upload-status', wrapAsync(async (req, res) => {
    const { projectId } = getProjectContext(req);
    const musicDir = projectManager.getProjectPath(projectId, 'music');

    const status = {
      music: false,
      sunoPrompt: false,
      songInfo: false,
      analysis: false,
      musicFile: null,
      musicFileSize: null
    };

    if (fs.existsSync(musicDir)) {
      const files = fs.readdirSync(musicDir);
      const mp3File = files.find((file) => file.endsWith('.mp3'));

      if (mp3File) {
        status.music = true;
        status.musicFile = mp3File;
        const musicPath = path.join(musicDir, mp3File);
        const stats = fs.statSync(musicPath);
        status.musicFileSize = stats.size;
      }

      status.sunoPrompt = files.includes('suno_prompt.txt');
      status.songInfo = files.includes('song_info.txt');
      status.analysis = files.includes('analysis.json');
    }

    sendJSON(res, 200, status);
  }));

  router.delete('/api/delete/music', wrapAsync(async (req, res) => {
    const projectId = resolveProjectId(req.query.project || projectManager.getActiveProject(), { required: true });
    const musicDir = projectManager.getProjectPath(projectId, 'music');
    const files = fs.existsSync(musicDir) ? fs.readdirSync(musicDir) : [];
    const mp3File = files.find((file) => file.endsWith('.mp3'));

    if (mp3File) {
      fs.unlinkSync(path.join(musicDir, mp3File));
      sendJSON(res, 200, { success: true, message: 'Music file deleted' });
    } else {
      sendJSON(res, 404, { success: false, error: 'No music file found' });
    }
  }));
}

module.exports = {
  registerUploadRoutes
};
