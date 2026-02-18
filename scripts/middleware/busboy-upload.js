const path = require('path');
const Busboy = require('busboy');
const { MAX_UPLOAD_SIZE } = require('../config');

function parseBusboyUpload(req, options = {}) {
  const maxFileSize = Number.isFinite(options.maxFileSize) ? options.maxFileSize : MAX_UPLOAD_SIZE;

  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: maxFileSize,
        files: 1
      }
    });
    const fields = {};
    let fileBuffer = null;
    let fileExt = '';
    let originalFilename = '';
    let fileTooLarge = false;

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (_name, file, info) => {
      originalFilename = info && info.filename ? info.filename : '';
      fileExt = path.extname(originalFilename);
      const chunks = [];

      file.on('limit', () => {
        fileTooLarge = true;
      });
      file.on('data', (chunk) => {
        chunks.push(chunk);
      });
      file.on('end', () => {
        if (!fileTooLarge) {
          fileBuffer = Buffer.concat(chunks);
        }
      });
      file.on('error', reject);
    });

    busboy.on('close', () => {
      if (fileTooLarge) {
        reject(new Error('File too large'));
        return;
      }
      resolve({ fields, fileBuffer, fileExt, originalFilename });
    });

    busboy.on('error', reject);
    req.pipe(busboy);
  });
}

/**
 * Multi-file multipart parser (callback-based).
 * Supports up to 4 files and 50 fields per request.
 */
function parseMultipartData(req, callback, options = {}) {
  const { MAX_VIDEO_SIZE = 500 * 1024 * 1024 } = options;
  const busboy = Busboy({
    headers: req.headers,
    limits: {
      fileSize: MAX_VIDEO_SIZE,
      files: 4,
      fields: 50,
      parts: 80
    }
  });
  const fields = {};
  const files = [];
  let oversized = false;

  busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  busboy.on('file', (fieldname, file, info) => {
    const chunks = [];
    file.on('limit', () => {
      oversized = true;
    });
    file.on('data', chunk => chunks.push(chunk));
    file.on('end', () => {
      files.push({
        fieldname,
        filename: info.filename,
        mimeType: info.mimeType,
        buffer: Buffer.concat(chunks)
      });
    });
  });

  busboy.on('finish', () => {
    if (oversized) {
      callback(new Error('File too large'), { fields, files });
      return;
    }
    callback(null, { fields, files });
  });

  busboy.on('error', (err) => {
    callback(err, { fields, files });
  });

  req.pipe(busboy);
}

module.exports = {
  parseBusboyUpload,
  parseMultipartData
};
