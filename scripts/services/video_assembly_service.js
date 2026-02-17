/**
 * Video Assembly Service — FFmpeg-based video export
 *
 * Stitches selected shot frames + music into a final video file.
 * Requires FFmpeg to be installed on the system (ffmpeg command in PATH).
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function createVideoAssemblyService({ projectManager }) {

  /**
   * Check if FFmpeg is available on the system.
   */
  function checkFfmpeg() {
    return new Promise((resolve) => {
      execFile('ffmpeg', ['-version'], { timeout: 5000 }, (err, stdout) => {
        if (err) {
          resolve({ available: false, error: 'FFmpeg not found. Install FFmpeg to enable video export.' });
        } else {
          const versionMatch = String(stdout).match(/ffmpeg version ([^\s]+)/);
          resolve({ available: true, version: versionMatch ? versionMatch[1] : 'unknown' });
        }
      });
    });
  }

  /**
   * Build a video from shot frames and music.
   *
   * @param {string} projectId
   * @param {object} options
   * @param {Array} options.shots - Array of { shotId, variation, duration }
   * @param {boolean} options.includeMusic - Whether to add audio track
   * @param {number} options.fps - Frames per second (default 24)
   * @param {string} options.resolution - Output resolution (default '1920x1080')
   * @param {string} options.outputFilename - Output filename (default 'export.mp4')
   * @returns {object} { success, outputPath, duration }
   */
  async function assembleVideo(projectId, options = {}) {
    const ffmpegCheck = await checkFfmpeg();
    if (!ffmpegCheck.available) {
      throw new Error(ffmpegCheck.error);
    }

    const projectPath = projectManager.getProjectPath(projectId);
    const shots = Array.isArray(options.shots) ? options.shots : [];
    if (shots.length === 0) {
      throw new Error('No shots provided for assembly');
    }

    const fps = options.fps || 24;
    const resolution = options.resolution || '1920x1080';
    const [width, height] = resolution.split('x').map(Number);
    const outputFilename = options.outputFilename || 'export.mp4';
    const includeMusic = options.includeMusic !== false;

    const exportDir = path.join(projectPath, 'rendered', 'export');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    const outputPath = path.join(exportDir, outputFilename);

    // Build FFmpeg filter complex for image slideshow
    // Each shot's first frame is shown for the shot duration
    const inputArgs = [];
    const filterParts = [];
    let inputIdx = 0;

    for (const shot of shots) {
      const shotDir = path.join(projectPath, 'rendered', 'shots', shot.shotId);
      const variation = shot.variation || 'A';
      const duration = shot.duration || 8;

      // Find the first frame for this shot+variation
      let framePath = null;
      if (fs.existsSync(shotDir)) {
        const files = fs.readdirSync(shotDir);
        // Prefer seedream first frame, then kling video, then any first frame
        const candidates = [
          `seedream_${variation}_first.png`,
          `seedream_${variation}_first.jpg`,
          `kling_${variation}.mp4`
        ];
        for (const candidate of candidates) {
          if (files.includes(candidate)) {
            framePath = path.join(shotDir, candidate);
            break;
          }
        }
        // Fallback: find any first frame
        if (!framePath) {
          const anyFirst = files.find((f) => f.includes('_first.'));
          if (anyFirst) framePath = path.join(shotDir, anyFirst);
        }
      }

      if (!framePath) {
        // Use a black frame placeholder for missing shots
        inputArgs.push('-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:d=${duration}:r=${fps}`);
      } else if (framePath.endsWith('.mp4') || framePath.endsWith('.mov')) {
        // Video file — use directly
        inputArgs.push('-i', framePath);
      } else {
        // Image file — loop for duration
        inputArgs.push('-loop', '1', '-t', String(duration), '-i', framePath);
      }

      filterParts.push(
        `[${inputIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,` +
        `setsar=1,fps=${fps}[v${inputIdx}]`
      );
      inputIdx++;
    }

    // Concatenate all video streams
    const concatInputs = shots.map((_, i) => `[v${i}]`).join('');
    filterParts.push(`${concatInputs}concat=n=${shots.length}:v=1:a=0[outv]`);

    const filterComplex = filterParts.join('; ');

    // Build full FFmpeg command
    const ffmpegArgs = [
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[outv]'
    ];

    // Add music track if requested and available
    const musicDir = path.join(projectPath, 'music');
    let musicPath = null;
    if (includeMusic && fs.existsSync(musicDir)) {
      const musicFiles = fs.readdirSync(musicDir).filter((f) => f.endsWith('.mp3'));
      if (musicFiles.length > 0) {
        musicPath = path.join(musicDir, musicFiles[0]);
        ffmpegArgs.push('-i', musicPath, '-map', `${inputIdx}:a`, '-shortest');
      }
    }

    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-y', // overwrite output
      outputPath
    );

    if (musicPath) {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
    }

    // Execute FFmpeg
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const proc = execFile('ffmpeg', ffmpegArgs, {
        timeout: 600000, // 10 minute timeout
        maxBuffer: 10 * 1024 * 1024
      }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error('FFmpeg failed: ' + (err.message || stderr || 'Unknown error')));
          return;
        }

        const durationSec = (Date.now() - startTime) / 1000;
        const stats = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;

        resolve({
          success: true,
          outputPath: `rendered/export/${outputFilename}`,
          absolutePath: outputPath,
          fileSize: stats ? stats.size : 0,
          duration: durationSec,
          shotCount: shots.length,
          hasAudio: Boolean(musicPath)
        });
      });
    });
  }

  return {
    checkFfmpeg,
    assembleVideo
  };
}

module.exports = { createVideoAssemblyService };
