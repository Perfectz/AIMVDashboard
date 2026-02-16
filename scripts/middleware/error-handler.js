function wrapAsync(fn) {
  return async (req, res, next) => {
    try {
      await Promise.resolve(fn(req, res, next));
    } catch (err) {
      if (res.writableEnded) return;
      const statusCode = Number(err && (err.statusCode || err.status)) || 500;
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
