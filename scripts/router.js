/**
 * Lightweight HTTP router with middleware support.
 * No external dependencies.
 */

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  const trimmed = String(pathname).trim();
  if (!trimmed) return '/';
  return trimmed.endsWith('/') && trimmed.length > 1
    ? trimmed.slice(0, -1)
    : trimmed;
}

function parseQuery(searchParams) {
  const query = {};
  for (const [key, value] of searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      if (Array.isArray(query[key])) {
        query[key].push(value);
      } else {
        query[key] = [query[key], value];
      }
    } else {
      query[key] = value;
    }
  }
  return query;
}

function compilePattern(pattern) {
  const normalized = normalizePath(pattern || '/');
  const paramNames = [];

  if (normalized === '*') {
    return {
      pattern: normalized,
      paramNames,
      regex: /^.*$/
    };
  }

  const escaped = normalized
    .split('/')
    .map((segment) => {
      if (!segment) return '';
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return {
    pattern: normalized,
    paramNames,
    regex: new RegExp(`^${escaped}$`)
  };
}

function matchesPrefix(pathname, prefix) {
  const normalizedPath = normalizePath(pathname);
  const normalizedPrefix = normalizePath(prefix || '/');
  if (normalizedPrefix === '/') return true;
  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
}

function createRouter() {
  const routes = [];
  const middleware = [];

  function register(method, pattern, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Route handler must be a function for ${method} ${pattern}`);
    }
    const compiled = compilePattern(pattern);
    routes.push({
      method: String(method || 'GET').toUpperCase(),
      pattern: compiled.pattern,
      regex: compiled.regex,
      paramNames: compiled.paramNames,
      handler
    });
  }

  function use(pathOrHandler, maybeHandler) {
    if (typeof pathOrHandler === 'function') {
      middleware.push({ prefix: '/', fn: pathOrHandler });
      return;
    }
    if (typeof maybeHandler !== 'function') {
      throw new Error('Middleware requires a function');
    }
    middleware.push({ prefix: normalizePath(pathOrHandler || '/'), fn: maybeHandler });
  }

  function handle(req, res) {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = normalizePath(requestUrl.pathname);
    const method = String(req.method || 'GET').toUpperCase();

    req.path = pathname;
    req.query = parseQuery(requestUrl.searchParams);
    req.params = {};
    req.urlObj = requestUrl;

    const route = routes.find((item) => {
      if (item.method !== method) return false;
      return item.regex.test(pathname);
    });
    if (!route) return false;

    const match = pathname.match(route.regex);
    if (match) {
      req.params = {};
      route.paramNames.forEach((name, idx) => {
        const raw = match[idx + 1] || '';
        try {
          req.params[name] = decodeURIComponent(raw);
        } catch {
          req.params[name] = raw;
        }
      });
    }

    const stack = middleware
      .filter((mw) => matchesPrefix(pathname, mw.prefix))
      .map((mw) => mw.fn);
    stack.push(route.handler);

    let index = 0;
    function next() {
      const fn = stack[index++];
      if (!fn) return;
      fn(req, res, next);
    }

    next();
    return true;
  }

  return {
    get: (pattern, handler) => register('GET', pattern, handler),
    post: (pattern, handler) => register('POST', pattern, handler),
    put: (pattern, handler) => register('PUT', pattern, handler),
    delete: (pattern, handler) => register('DELETE', pattern, handler),
    use,
    handle
  };
}

module.exports = {
  createRouter
};
