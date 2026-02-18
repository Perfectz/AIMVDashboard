const logger = require('../logger');

function wrapAsync(fn) {
  return async (req, res, next) => {
    try {
      await Promise.resolve(fn(req, res, next));
    } catch (err) {
      const method = String(req.method || 'GET').toUpperCase();
      const url = String(req.url || '').split('?')[0];
      const statusCode = Number(err && (err.statusCode || err.status)) || 500;

      logger.error('Request handler error', {
        method,
        url,
        statusCode,
        error: (err && err.message) || 'Unknown error',
        stack: statusCode >= 500 ? (err && err.stack) : undefined,
        requestId: req._requestId
      });

      if (res.writableEnded) return;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (err && err.message) || 'Internal server error'
      }));
    }
  };
}

module.exports = {
  wrapAsync
};
