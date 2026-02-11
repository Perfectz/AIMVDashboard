#!/usr/bin/env node

/**
 * Feature Scaffolder
 * Usage:
 *   npm run scaffold:feature -- <feature-name> [--with-domain] [--with-service] [--dry-run] [--force]
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.env.SCAFFOLD_ROOT
  ? path.resolve(process.env.SCAFFOLD_ROOT)
  : path.join(__dirname, '..');
const UI_DIR = path.join(ROOT, 'ui');
const TEST_DIR = path.join(ROOT, 'tests', 'unit');

function toKebab(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toPascal(kebab) {
  return kebab
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function writeFileWithMode(filePath, content, options) {
  var opts = options || {};
  var exists = fs.existsSync(filePath);

  if (exists && !opts.force) {
    return { created: false, overwritten: false, path: filePath };
  }

  if (opts.dryRun) {
    return { created: !exists, overwritten: !!exists, path: filePath, dryRun: true };
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return { created: !exists, overwritten: !!exists, path: filePath };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const positional = args.filter(a => !a.startsWith('--'));
  return {
    featureName: positional[0],
    withDomain: flags.has('--with-domain'),
    withService: flags.has('--with-service'),
    dryRun: flags.has('--dry-run'),
    force: flags.has('--force')
  };
}

function createFeatureModule(kebabName, pascalName, withDomain, withService) {
  const domainVar = withDomain ? `\n    var domain = opts.domain || (root && root.${pascalName}Domain ? root.${pascalName}Domain : null);` : '';
  const serviceVar = withService ? `\n    var service = opts.service || (root && root.${pascalName}Service ? root.${pascalName}Service : null);` : '';

  const dependencyChecks = [
    withDomain ? `    if (!domain) {\n      throw new Error('${pascalName}Domain is required');\n    }` : '',
    withService ? `    if (!service) {\n      throw new Error('${pascalName}Service is required');\n    }` : ''
  ].filter(Boolean).join('\n\n');

  const runBody = [
    withDomain ? '      var validation = domain.validate(input);\n      if (!validation.ok) return validation;' : '',
    withService ? '      return service.execute(input);' : '      return { ok: true, data: input || {} };'
  ].filter(Boolean).join('\n');

  return `(function(root) {
  'use strict';

  function create${pascalName}Feature(options) {
    var opts = options || {};${domainVar}${serviceVar}

${dependencyChecks ? dependencyChecks + '\n' : ''}
    async function run(input) {
${runBody}
    }

    return {
      run: run
    };
  }

  var api = {
    create${pascalName}Feature: create${pascalName}Feature
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.${pascalName}Feature = api;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

function createDomainModule(pascalName) {
  return `(function(root) {
  'use strict';

  function validate(input) {
    if (!input) {
      return { ok: false, error: 'Input is required' };
    }
    return { ok: true, value: input };
  }

  var api = {
    validate: validate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.${pascalName}Domain = api;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

function createServiceModule(kebabName, pascalName) {
  return `(function(root) {
  'use strict';

  function create${pascalName}Service(options) {
    var opts = options || {};
    var httpClientFactory = opts.httpClientFactory || (root && root.HttpClient ? root.HttpClient : null);
    var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);

    if (!httpClientFactory || !httpClientFactory.createHttpClient) {
      throw new Error('HttpClient.createHttpClient is required');
    }

    var httpClient = httpClientFactory.createHttpClient({ fetchImpl: fetchImpl });

    async function execute(input) {
      var result = await httpClient.request('/api/${kebabName}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input || {})
      });

      if (!result.response.ok) {
        return { ok: false, error: result.payload.error || 'Request failed' };
      }

      return { ok: true, data: result.payload || {} };
    }

    return {
      execute: execute
    };
  }

  var api = {
    create${pascalName}Service: create${pascalName}Service
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.${pascalName}Service = api;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

function createTestModule(kebabName, pascalName, withDomain, withService) {
  const setup = [];
  if (withDomain) {
    setup.push(`
    domain: {
      validate(input) {
        if (!input) return { ok: false, error: 'Input is required' };
        return { ok: true, value: input };
      }
    }`);
  }
  if (withService) {
    setup.push(`
    service: {
      async execute(input) {
        return { ok: true, data: { echoed: input } };
      }
    }`);
  }

  return `const assert = require('assert');
const { create${pascalName}Feature } = require('../../ui/features/${kebabName}-feature.js');

async function run() {
  const feature = create${pascalName}Feature({${setup.join(',')}
  });

  const okResult = await feature.run({ hello: 'world' });
  assert.strictEqual(okResult.ok, true);

  console.log('${kebabName}-feature.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
}

function main() {
  const { featureName, withDomain, withService, dryRun, force } = parseArgs(process.argv);
  const kebabName = toKebab(featureName);

  if (!kebabName) {
    console.error('Usage: npm run scaffold:feature -- <feature-name> [--with-domain] [--with-service] [--dry-run] [--force]');
    process.exit(1);
  }

  const pascalName = toPascal(kebabName);

  const created = [];

  created.push(writeFileWithMode(
    path.join(UI_DIR, 'features', `${kebabName}-feature.js`),
    createFeatureModule(kebabName, pascalName, withDomain, withService),
    { dryRun: dryRun, force: force }
  ));

  if (withDomain) {
    created.push(writeFileWithMode(
      path.join(UI_DIR, 'domain', `${kebabName}-domain.js`),
      createDomainModule(pascalName),
      { dryRun: dryRun, force: force }
    ));
  }

  if (withService) {
    created.push(writeFileWithMode(
      path.join(UI_DIR, 'services', `${kebabName}-service.js`),
      createServiceModule(kebabName, pascalName),
      { dryRun: dryRun, force: force }
    ));
  }

  created.push(writeFileWithMode(
    path.join(TEST_DIR, `${kebabName}-feature.test.js`),
    createTestModule(kebabName, pascalName, withDomain, withService),
    { dryRun: dryRun, force: force }
  ));

  console.log('\nFeature scaffold complete:\n');
  created.forEach((entry) => {
    const relPath = path.relative(ROOT, entry.path);
    var label = 'ℹ️  exists ';
    if (entry.dryRun && entry.created) label = '📝 would create';
    else if (entry.dryRun && entry.overwritten) label = '📝 would overwrite';
    else if (entry.created) label = '✅ created';
    else if (entry.overwritten) label = '♻️ overwritten';
    console.log(`${label} ${relPath}`);
  });
}

main();
