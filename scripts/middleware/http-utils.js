const fs = require('fs');
const { getContentType } = require('../shared');

/**
 * Creates HTTP utility functions bound to a given set of allowed origins.
 * @param {Set<string>} allowedOrigins
 */
function createHttpUtils(allowedOrigins) {
  function corsHeadersForRequest(req) {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      };
    }
    return {};
  }

  function sendJSON(res, statusCode, data) {
    const headers = { 'Content-Type': 'application/json' };
    const corsHeaders = corsHeadersForRequest(res.req);
    Object.assign(headers, corsHeaders);
    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data));
  }

  function sendSseEvent(res, eventPayload) {
    const payload = JSON.stringify(eventPayload || {});
    res.write(`data: ${payload}\n\n`);
  }

  function serveFile(res, filePath) {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>');
        return;
      }

      res.writeHead(200, {
        'Content-Type': getContentType(filePath),
        'Content-Length': stats.size
      });

      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
        }
        res.end('<h1>500 - Read Error</h1>');
      });
      stream.pipe(res);
    });
  }

  return {
    corsHeadersForRequest,
    sendJSON,
    sendSseEvent,
    serveFile
  };
}

module.exports = {
  createHttpUtils
};
