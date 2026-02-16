const DEFAULT_MAX_BODY_SIZE = 1024 * 1024;

function readBody(req, maxSize = DEFAULT_MAX_BODY_SIZE) {
  return new Promise((resolve, reject) => {
    let data = '';
    let totalSize = 0;

    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        const err = new Error('Request body too large');
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      data += chunk;
    });

    req.on('end', () => resolve(data));
    req.on('error', (err) => reject(err));
  });
}

async function jsonBody(req, maxSize = DEFAULT_MAX_BODY_SIZE) {
  const raw = await readBody(req, maxSize);
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Invalid JSON payload');
    err.statusCode = 400;
    throw err;
  }
}

module.exports = {
  DEFAULT_MAX_BODY_SIZE,
  readBody,
  jsonBody
};
