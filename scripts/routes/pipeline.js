const fs = require('fs');
const path = require('path');

function registerPipelineRoutes(router, ctx) {
  const {
    sendJSON,
    wrapAsync,
    jsonBody,
    MAX_BODY_SIZE,
    resolveProjectId,
    projectManager,
    getPipelineStatus,
    updatePipelineStatus,
    runCompile,
    runLinter,
    runGenerateIndex
  } = ctx;

  router.get('/api/pipeline/status', wrapAsync(async (req, res) => {
    const projectId = resolveProjectId(
      req.query.project
        || req.query.projectId
        || projectManager.getActiveProject(),
      { required: true }
    );
    const status = getPipelineStatus(projectId);
    sendJSON(res, 200, { success: true, status });
  }));

  router.post('/api/pipeline/:action', wrapAsync(async (req, res) => {
    const action = String(req.params.action || '').trim().toLowerCase();
    const allowedActions = new Set(['compile', 'lint', 'reindex', 'run-all']);
    if (!allowedActions.has(action)) {
      sendJSON(res, 404, { success: false, error: 'Unknown pipeline action' });
      return;
    }

    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(
      payload.project
        || payload.projectId
        || req.query.project
        || req.query.projectId
        || projectManager.getActiveProject(),
      { required: true }
    );

    const startedAt = new Date().toISOString();
    const result = {
      action,
      projectId,
      startedAt,
      finishedAt: null,
      success: false,
      step: action,
      compile: null,
      lint: null,
      reindex: null
    };

    if (action === 'compile' || action === 'run-all') {
      result.compile = runCompile(projectId, { quiet: true, all: false });
      result.step = 'compile';
      if (result.compile.success) {
        updatePipelineStatus(projectId, { lastCompileAt: new Date().toISOString() });
      }
    }

    if ((action === 'lint' || action === 'run-all') && (!result.compile || result.compile.success)) {
      result.lint = runLinter(projectId, { quiet: true });
      result.step = 'lint';
      updatePipelineStatus(projectId, {
        lastLintAt: new Date().toISOString(),
        lintSummary: result.lint.summary || null
      });
    }

    if ((action === 'reindex' || action === 'run-all') && (!result.compile || result.compile.success)) {
      result.reindex = runGenerateIndex(projectId, { quiet: true });
      result.step = 'reindex';
      if (result.reindex.success) {
        updatePipelineStatus(projectId, { lastReindexAt: new Date().toISOString() });
      }
    }

    if (action === 'compile') {
      result.success = Boolean(result.compile && result.compile.success);
    } else if (action === 'lint') {
      result.success = Boolean(result.lint && result.lint.success);
    } else if (action === 'reindex') {
      result.success = Boolean(result.reindex && result.reindex.success);
    } else {
      result.success = Boolean(
        (!result.compile || result.compile.success)
        && (!result.lint || result.lint.success)
        && (!result.reindex || result.reindex.success)
      );
    }

    result.finishedAt = new Date().toISOString();
    const statusPatch = {
      lastRun: {
        action,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        success: result.success,
        step: result.step
      }
    };
    if (action === 'run-all') {
      statusPatch.lastRunAllAt = result.finishedAt;
    }
    updatePipelineStatus(projectId, statusPatch);

    const statusCode = result.success ? 200 : 400;
    sendJSON(res, statusCode, {
      success: result.success,
      result,
      status: getPipelineStatus(projectId)
    });
  }));

  // --- Generate shot plan from song analysis (replaces CLI init_phase2.js) ---
  router.post('/api/pipeline/generate-shot-plan', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(
      payload.project || payload.projectId || projectManager.getActiveProject(),
      { required: true }
    );
    const projectPath = projectManager.getProjectPath(projectId);

    // Read analysis.json to get song sections
    const analysisPath = path.join(projectPath, 'music', 'analysis.json');
    let analysis = null;
    if (fs.existsSync(analysisPath)) {
      try { analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8')); } catch { /* ignore */ }
    }

    // Allow manual override via payload
    const duration = Number(payload.duration) || (analysis && Number(analysis.duration)) || 180;
    const bpm = payload.bpm != null ? Number(payload.bpm) : (analysis && analysis.bpm ? Number(analysis.bpm) : null);
    const sections = Array.isArray(payload.sections)
      ? payload.sections
      : (analysis && Array.isArray(analysis.sections) ? analysis.sections : []);

    if (sections.length === 0) {
      sendJSON(res, 400, {
        success: false,
        error: 'No song sections found. Please add sections in Step 2 (Analysis JSON) first, or provide sections in the request.'
      });
      return;
    }

    const shotDuration = Number(payload.shotDuration) || 8;

    // Update project.json with music metadata
    const projectJsonPath = path.join(projectPath, 'project.json');
    let projectData = {};
    try { projectData = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8')); } catch { /* ignore */ }
    projectData.music = {
      duration,
      bpm,
      sections
    };
    if (projectData.project && typeof projectData.project === 'object') {
      projectData.project.phase = '2_PRODUCTION';
    } else {
      projectData.phase = '2_PRODUCTION';
    }
    fs.writeFileSync(projectJsonPath, JSON.stringify(projectData, null, 2));

    // Create beat_map.json
    const storyboardDir = path.join(projectPath, 'rendered', 'storyboard');
    if (!fs.existsSync(storyboardDir)) fs.mkdirSync(storyboardDir, { recursive: true });

    const beatMap = {
      version: new Date().toISOString().split('T')[0],
      songDuration: duration,
      bpm,
      sections,
      shotPlanning: {
        defaultShotDuration: shotDuration,
        totalShots: Math.ceil(duration / shotDuration),
        notes: 'Plan shots in ' + shotDuration + '-second increments aligned with music sections'
      }
    };
    fs.writeFileSync(path.join(storyboardDir, 'beat_map.json'), JSON.stringify(beatMap, null, 2));

    // Create shot_plan.json
    const shots = [];
    let currentTime = 0;
    let shotNumber = 1;
    while (currentTime < duration) {
      const section = sections.find(function(s) {
        return currentTime >= (s.start || 0) && currentTime < (s.end || duration);
      });
      shots.push({
        id: 'SHOT_' + String(shotNumber).padStart(2, '0'),
        shotNumber,
        timing: {
          start: currentTime,
          duration: shotDuration,
          end: Math.min(currentTime + shotDuration, duration),
          musicSection: section ? (section.name || section.label || 'unknown') : 'unknown'
        },
        intent: {
          what: 'TODO: What happens in this shot',
          why: 'TODO: Purpose of this shot',
          emotionalBeat: section ? (section.mood || section.energy || 'TODO') : 'TODO'
        },
        characters: [],
        location: { id: 'TODO: LOC_*' },
        cameraIntent: { feeling: 'TODO', movement: 'TODO', focus: 'subject' },
        status: 'draft'
      });
      currentTime += shotDuration;
      shotNumber++;
    }

    const shotPlan = {
      version: new Date().toISOString().split('T')[0],
      totalShots: shots.length,
      shots
    };
    fs.writeFileSync(path.join(storyboardDir, 'shot_plan.json'), JSON.stringify(shotPlan, null, 2));

    sendJSON(res, 200, {
      success: true,
      projectId,
      totalShots: shots.length,
      duration,
      bpm,
      sectionCount: sections.length,
      message: 'Shot plan generated with ' + shots.length + ' shots'
    });
  }));

  // --- Auto-compile: compile + reindex in one call, with status update ---
  router.post('/api/pipeline/auto-compile', wrapAsync(async (req, res) => {
    const payload = await jsonBody(req, MAX_BODY_SIZE);
    const projectId = resolveProjectId(
      payload.project || payload.projectId || projectManager.getActiveProject(),
      { required: true }
    );

    const compileResult = runCompile(projectId, { quiet: true, all: false });
    if (compileResult.success) {
      updatePipelineStatus(projectId, { lastCompileAt: new Date().toISOString() });
    }

    let reindexResult = { success: false };
    if (compileResult.success) {
      reindexResult = runGenerateIndex(projectId, { quiet: true });
      if (reindexResult.success) {
        updatePipelineStatus(projectId, { lastReindexAt: new Date().toISOString() });
      }
    }

    const success = compileResult.success && reindexResult.success;
    updatePipelineStatus(projectId, {
      lastRun: {
        action: 'auto-compile',
        finishedAt: new Date().toISOString(),
        success
      }
    });

    sendJSON(res, success ? 200 : 400, {
      success,
      compile: compileResult,
      reindex: reindexResult,
      status: getPipelineStatus(projectId)
    });
  }));
}

module.exports = {
  registerPipelineRoutes
};
