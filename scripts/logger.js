'use strict';

/**
 * Structured logger with severity levels, request correlation, and JSON output.
 * Replaces scattered console.log/warn/error calls with a unified logging interface.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const LOG_LEVEL_NAMES = Object.keys(LOG_LEVELS);

const configuredLevel = LOG_LEVELS[String(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LOG_LEVELS.info;
const jsonOutput = String(process.env.LOG_FORMAT || '').toLowerCase() === 'json';

let _requestIdCounter = 0;

function generateRequestId() {
  _requestIdCounter = (_requestIdCounter + 1) % 1_000_000;
  return Date.now().toString(36) + '-' + _requestIdCounter.toString(36);
}

function formatPlain(level, message, data) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  if (!data || Object.keys(data).length === 0) {
    return `${prefix} ${message}`;
  }
  const extra = Object.entries(data)
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' ');
  return `${prefix} ${message} | ${extra}`;
}

function formatJson(level, message, data) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  });
}

function log(level, message, data) {
  const levelNum = LOG_LEVELS[level] ?? LOG_LEVELS.info;
  if (levelNum < configuredLevel) return;

  const output = jsonOutput
    ? formatJson(level, message, data || {})
    : formatPlain(level, message, data || {});

  if (levelNum >= LOG_LEVELS.error) {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

function debug(message, data) { log('debug', message, data); }
function info(message, data) { log('info', message, data); }
function warn(message, data) { log('warn', message, data); }
function error(message, data) { log('error', message, data); }
function fatal(message, data) { log('fatal', message, data); }

/**
 * Create a child logger with pre-bound context fields.
 * Useful for request-scoped logging.
 */
function child(context) {
  return {
    debug: (msg, data) => log('debug', msg, { ...context, ...data }),
    info: (msg, data) => log('info', msg, { ...context, ...data }),
    warn: (msg, data) => log('warn', msg, { ...context, ...data }),
    error: (msg, data) => log('error', msg, { ...context, ...data }),
    fatal: (msg, data) => log('fatal', msg, { ...context, ...data })
  };
}

module.exports = {
  LOG_LEVELS,
  generateRequestId,
  log,
  debug,
  info,
  warn,
  error,
  fatal,
  child
};
