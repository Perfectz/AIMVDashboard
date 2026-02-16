(function(root) {
  'use strict';

  var CODES = {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    CONFIG_MISSING: 'CONFIG_MISSING',
    PROMPT_MISSING: 'PROMPT_MISSING',
    REF_MISSING: 'REF_MISSING',
    LOCK_CONFLICT: 'LOCK_CONFLICT',
    NETWORK_ERROR: 'NETWORK_ERROR',
    SERVER_ERROR: 'SERVER_ERROR'
  };

  function asMessage(error) {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error.message) return String(error.message);
    return '';
  }

  function classify(error, fallbackCode) {
    var message = asMessage(error);
    var code = (error && error.code) ? String(error.code) : '';
    if (!code && fallbackCode) code = String(fallbackCode);

    if (!code) {
      var lower = message.toLowerCase();
      if (lower.includes('auth')) code = CODES.AUTH_REQUIRED;
      else if (lower.includes('replicate') && lower.includes('key')) code = CODES.CONFIG_MISSING;
      else if (lower.includes('prompt')) code = CODES.PROMPT_MISSING;
      else if (lower.includes('reference')) code = CODES.REF_MISSING;
      else if (lower.includes('lock')) code = CODES.LOCK_CONFLICT;
      else if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('http')) code = CODES.NETWORK_ERROR;
      else code = CODES.SERVER_ERROR;
    }

    return {
      code: code,
      message: message || defaultMessage(code),
      raw: error || null
    };
  }

  function defaultMessage(code) {
    switch (code) {
      case CODES.AUTH_REQUIRED:
        return 'Authentication is required.';
      case CODES.CONFIG_MISSING:
        return 'A required provider configuration is missing.';
      case CODES.PROMPT_MISSING:
        return 'Prompt data is missing or invalid.';
      case CODES.REF_MISSING:
        return 'Required references are missing.';
      case CODES.LOCK_CONFLICT:
        return 'Another active run is already using this target.';
      case CODES.NETWORK_ERROR:
        return 'Network request failed.';
      default:
        return 'Unexpected server error.';
    }
  }

  function toUserMessage(classified) {
    var data = classified || { code: CODES.SERVER_ERROR, message: '' };
    var message = String(data.message || '').trim();
    if (message) return message;
    return defaultMessage(data.code);
  }

  var api = {
    CODES: CODES,
    classify: classify,
    toUserMessage: toUserMessage
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ErrorTaxonomy = api;
})(typeof window !== 'undefined' ? window : globalThis);
