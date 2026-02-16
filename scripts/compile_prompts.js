#!/usr/bin/env node

/**
 * Prompt Compile Orchestrator
 * Version: 2026-02-12
 *
 * One command to compile prompts for a project and refresh prompts_index.json.
 *
 * Usage:
 *   node scripts/compile_prompts.js [project-id]
 *   node scripts/compile_prompts.js --all
 */

const { spawnSync } = require('child_process');
const path = require('path');
const projectManager = require('./project_manager');

const ROOT = path.join(__dirname, '..');

function runNodeScript(scriptName, scriptArgs = [], options = {}) {
  const scriptPath = path.join(ROOT, 'scripts', scriptName);
  const stdio = options.quiet ? 'pipe' : 'inherit';
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: ROOT,
    stdio
  });
  return {
    success: result.status === 0,
    status: result.status,
    stdout: result.stdout ? String(result.stdout) : '',
    stderr: result.stderr ? String(result.stderr) : '',
    error: result.error ? result.error.message : ''
  };
}

function selectCompiler(projectId) {
  if (projectId === 'linkedin-app-showcase') {
    return { script: 'generate_prompts_linkedin.js', args: [] };
  }
  return { script: 'generate_prompts_basic.js', args: [projectId] };
}

function compileProject(projectId, options = {}) {
  const quiet = Boolean(options.quiet);
  const log = (...args) => { if (!quiet) console.log(...args); };

  if (!projectManager.projectExists(projectId)) {
    return {
      success: false,
      projectId,
      error: `Project '${projectId}' not found`
    };
  }

  const project = projectManager.getProject(projectId);
  const compiler = selectCompiler(projectId);

  log('');
  log('========================================');
  log(`Compiling prompts for: ${project.name} (${projectId})`);
  log(`Compiler: ${compiler.script}`);
  log('========================================');
  log('');

  const compileStep = runNodeScript(compiler.script, compiler.args, { quiet });
  if (!compileStep.success) {
    return {
      success: false,
      projectId,
      step: 'compile',
      compiler: compiler.script,
      error: compileStep.error || `${compiler.script} failed`
    };
  }

  const indexStep = runNodeScript('generate_index.js', [projectId], { quiet });
  if (!indexStep.success) {
    return {
      success: false,
      projectId,
      step: 'reindex',
      compiler: compiler.script,
      error: indexStep.error || 'generate_index.js failed'
    };
  }

  return {
    success: true,
    projectId,
    compiler: compiler.script
  };
}

function runCompile(projectId, options = {}) {
  const quiet = Boolean(options.quiet);
  const allProjects = Boolean(options.all);
  const log = (...args) => { if (!quiet) console.log(...args); };

  const projectIds = allProjects
    ? projectManager.listProjects().map((p) => p.id)
    : [projectId || projectManager.getActiveProject()];

  if (!projectIds.length) {
    return {
      success: false,
      projects: [],
      failures: 1,
      error: 'No projects found'
    };
  }

  const results = projectIds.map((id) => compileProject(id, { quiet }));
  const failures = results.filter((item) => !item.success).length;

  if (!quiet) {
    if (failures > 0) {
      log(`Compile completed with ${failures} failure(s).`);
    } else {
      log('Compile completed successfully for all requested projects.');
    }
    log('');
  }

  return {
    success: failures === 0,
    failures,
    projects: results
  };
}

module.exports = {
  runCompile,
  selectCompiler
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const allProjects = args.includes('--all');
  const explicitProjectId = args.find((arg) => !String(arg).startsWith('--'));
  const result = runCompile(explicitProjectId || projectManager.getActiveProject(), {
    all: allProjects
  });

  if (!result.success) {
    const firstError = result.projects.find((item) => !item.success);
    if (firstError && firstError.error) {
      console.error(`Error: ${firstError.error}`);
    }
    process.exit(1);
  }
  process.exit(0);
}
