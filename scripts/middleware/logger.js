const logger = require('../logger');

function requestLogger(req, res, next) {
  const start = Date.now();
  const method = String(req.method || 'GET').toUpperCase();
  const urlPath = (req.path || req.url || '').split('?')[0];

  // Attach a request ID for correlation across middleware/routes/services
  req._requestId = logger.generateRequestId();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const status = res.statusCode || 0;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    logger.log(level, `${method} ${urlPath} ${status} ${durationMs}ms`, {
      method,
      path: urlPath,
      status,
      durationMs,
      requestId: req._requestId
    });
  });

  if (typeof next === 'function') {
    next();
  }
}

module.exports = {
  requestLogger
};
