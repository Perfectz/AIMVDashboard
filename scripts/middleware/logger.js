function requestLogger(req, res, next) {
  const start = Date.now();
  const method = String(req.method || 'GET').toUpperCase();
  const path = (req.path || req.url || '').split('?')[0];

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const timestamp = new Date().toISOString();
    const status = res.statusCode || 0;
    console.log(`[${timestamp}] ${method} ${path} ${status} ${durationMs}ms`);
  });

  if (typeof next === 'function') {
    next();
  }
}

module.exports = {
  requestLogger
};
