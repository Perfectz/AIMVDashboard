#!/usr/bin/env node

/**
 * Full app health check:
 * - Starts API server if needed
 * - Runs endpoint smoke checks across project + save flows
 * - Cleans up temporary health-check project
 */

const { spawn } = require('child_process');

const BASE_URL = process.env.HEALTH_BASE_URL || 'http://127.0.0.1:8000';
const SERVER_START_TIMEOUT_MS = 20000;
const POLL_INTERVAL_MS = 250;
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZL3sAAAAASUVORK5CYII=';

let startedServer = false;
let serverProc = null;
let tempProjectId = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERT FAILED: ${message}`);
  }
}

async function isServerUp() {
  try {
    const res = await fetch(`${BASE_URL}/api/projects`);
    return res.ok;
  } catch {
    return false;
  }
}

async function requestJSON(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);
  const text = await response.text();

  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (err) {
    throw new Error(`Invalid JSON from ${path}: ${text.slice(0, 200)}`);
  }

  return { response, json };
}

async function requestText(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

async function startServerIfNeeded() {
  if (await isServerUp()) {
    return;
  }

  serverProc = spawn(process.execPath, ['scripts/serve_ui.js'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    windowsHide: true
  });
  startedServer = true;

  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    if (await isServerUp()) return;
  }

  throw new Error(`Server did not start within ${SERVER_START_TIMEOUT_MS}ms`);
}

async function stopServerIfStarted() {
  if (!startedServer || !serverProc || serverProc.killed) {
    return;
  }

  try {
    serverProc.kill('SIGTERM');
  } catch {}

  await sleep(300);

  if (!serverProc.killed) {
    try {
      serverProc.kill('SIGKILL');
    } catch {}
  }
}

async function cleanupTempProject() {
  if (!tempProjectId) return;
  try {
    await fetch(`${BASE_URL}/api/projects/${encodeURIComponent(tempProjectId)}?cleanup=1`, {
      method: 'DELETE'
    });
  } catch {}
}

async function checkProjectCrud() {
  const before = await requestJSON('/api/projects');
  assert(before.response.ok && before.json.success, 'GET /api/projects failed');

  const form = new FormData();
  form.set('name', `Health Check ${Date.now()}`);
  form.set('description', 'Temporary project created by health check');

  const create = await requestJSON('/api/projects', {
    method: 'POST',
    body: form
  });
  assert(create.response.ok && create.json.success, 'POST /api/projects failed');
  assert(create.json.project && create.json.project.id, 'Create project returned no ID');
  tempProjectId = create.json.project.id;

  const details = await requestJSON(`/api/projects/${encodeURIComponent(tempProjectId)}`);
  assert(details.response.ok && details.json.success, 'GET /api/projects/:id failed');

  const detailsWithQuery = await requestJSON(`/api/projects/${encodeURIComponent(tempProjectId)}?health=1`);
  assert(detailsWithQuery.response.ok && detailsWithQuery.json.success, 'GET /api/projects/:id with query failed');

  const updateForm = new FormData();
  updateForm.set('name', `${details.json.project.name} Updated`);
  updateForm.set('description', 'Updated during health check');
  const update = await requestJSON(`/api/projects/${encodeURIComponent(tempProjectId)}?health=1`, {
    method: 'PUT',
    body: updateForm
  });
  assert(update.response.ok && update.json.success, 'PUT /api/projects/:id failed');
}

async function checkProjectScopedEndpoints() {
  const project = tempProjectId;
  assert(project, 'Temp project ID missing');

  const home = await requestText(`/?project=${encodeURIComponent(project)}`);
  assert(home.response.ok && home.text.includes('<!DOCTYPE html>'), 'GET / failed');

  const storyboardPage = await requestText(`/storyboard.html?project=${encodeURIComponent(project)}`);
  assert(storyboardPage.response.ok && storyboardPage.text.includes('Storyboard'), 'GET /storyboard.html failed');

  const appJs = await requestText('/ui/app.js');
  assert(appJs.response.ok && appJs.text.includes('saveTextContent'), 'GET /ui/app.js failed');

  const status = await requestJSON(`/api/upload-status?project=${encodeURIComponent(project)}`);
  assert(status.response.ok, 'GET /api/upload-status failed');

  const charRefs = await requestJSON(`/api/references/characters?project=${encodeURIComponent(project)}`);
  assert(charRefs.response.ok && charRefs.json.success, 'GET /api/references/characters failed');

  const locRefs = await requestJSON(`/api/references/locations?project=${encodeURIComponent(project)}`);
  assert(locRefs.response.ok && locRefs.json.success, 'GET /api/references/locations failed');

  const reviewSequence = await requestJSON(`/api/review/sequence?project=${encodeURIComponent(project)}`);
  assert(reviewSequence.response.ok, 'GET /api/review/sequence failed');

  const previs = await requestJSON(`/api/storyboard/previs-map?project=${encodeURIComponent(project)}`);
  assert(previs.response.ok && previs.json.success, 'GET /api/storyboard/previs-map failed');

  const shotId = 'SHOT_01';

  const saveSequence = await requestJSON(`/api/storyboard/sequence?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selections: [{
        shotId,
        selectedVariation: 'A',
        locked: true,
        sourceType: 'Manual',
        assignee: 'HealthCheck'
      }],
      editorialOrder: [shotId]
    })
  });
  assert(saveSequence.response.ok && saveSequence.json.success, 'POST /api/storyboard/sequence failed');

  const invalidMusicForm = new FormData();
  invalidMusicForm.set('project', project);
  invalidMusicForm.set('file', new Blob(['not an mp3'], { type: 'text/plain' }), 'not-music.txt');
  const invalidMusicUpload = await requestJSON('/api/upload/music', {
    method: 'POST',
    body: invalidMusicForm
  });
  assert(
    !invalidMusicUpload.response.ok && invalidMusicUpload.json.success === false,
    'Invalid music upload should fail validation'
  );

  const invalidShotForm = new FormData();
  invalidShotForm.set('project', project);
  invalidShotForm.set('shotId', shotId);
  invalidShotForm.set('fileType', 'kling');
  invalidShotForm.set('variation', 'A');
  invalidShotForm.set('file', new Blob(['not a video'], { type: 'text/plain' }), 'not-video.txt');
  const invalidShotUpload = await requestJSON('/api/upload/shot', {
    method: 'POST',
    body: invalidShotForm
  });
  assert(
    !invalidShotUpload.response.ok && invalidShotUpload.json.success === false,
    'Invalid shot upload should fail validation'
  );

  const shotRenderForm = new FormData();
  shotRenderForm.set('project', project);
  shotRenderForm.set('shot', shotId);
  shotRenderForm.set('variation', 'A');
  shotRenderForm.set('frame', 'first');
  shotRenderForm.set('tool', 'seedream');
  shotRenderForm.set(
    'image',
    new Blob([Buffer.from(TINY_PNG_BASE64, 'base64')], { type: 'image/png' }),
    'health-first-frame.png'
  );
  const shotRenderUpload = await requestJSON('/api/upload/shot-render', {
    method: 'POST',
    body: shotRenderForm
  });
  assert(
    shotRenderUpload.response.ok && shotRenderUpload.json.success,
    'Valid shot render image upload failed'
  );

  const shotRenders = await requestJSON(`/api/shot-renders?project=${encodeURIComponent(project)}&shot=${encodeURIComponent(shotId)}`);
  assert(shotRenders.response.ok && shotRenders.json.success, 'GET /api/shot-renders failed');
  assert(
    typeof shotRenders.json.renders?.seedream?.A?.first === 'string' &&
      shotRenders.json.renders.seedream.A.first.includes('seedream_A_first'),
    'Uploaded shot render was not discoverable via /api/shot-renders'
  );

  const loadSequence = await requestJSON(`/api/review/sequence?project=${encodeURIComponent(project)}`);
  const shot = (loadSequence.json.selections || []).find((s) => s.shotId === shotId);
  assert(shot, 'Saved shot missing from review sequence');
  assert(shot.selectedVariation === 'A', 'selectedVariation not persisted');

  const saveReview = await requestJSON(`/api/save/review-metadata?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shotId,
      reviewStatus: 'in_review',
      comments: [{ author: 'HealthCheck', text: 'Smoke test comment', timestamp: new Date().toISOString() }],
      assignee: 'QA Bot'
    })
  });
  assert(saveReview.response.ok && saveReview.json.success, 'POST /api/save/review-metadata failed');

  const loadReview = await requestJSON(`/api/load/review-metadata?project=${encodeURIComponent(project)}`);
  assert(loadReview.response.ok && loadReview.json.success, 'GET /api/load/review-metadata failed');
  assert(loadReview.json.reviewMetadata?.[shotId]?.assignee === 'QA Bot', 'Review assignee not persisted');

  const savePrevis = await requestJSON(`/api/storyboard/previs-map/${encodeURIComponent(shotId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      entry: {
        sourceType: 'manual',
        sourceRef: 'HEALTH',
        notes: 'Health check previs override',
        locked: false
      }
    })
  });
  assert(savePrevis.response.ok && savePrevis.json.success, 'PUT /api/storyboard/previs-map/:shotId failed');

  const deletePrevis = await requestJSON(`/api/storyboard/previs-map/${encodeURIComponent(shotId)}?project=${encodeURIComponent(project)}`, {
    method: 'DELETE'
  });
  assert(deletePrevis.response.ok && deletePrevis.json.success, 'DELETE /api/storyboard/previs-map/:shotId failed');

  const saveReadiness = await requestJSON(`/api/storyboard/readiness-report?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generatedAt: new Date().toISOString(),
      projectId: project,
      totalShots: 1,
      readyShots: 0,
      blockedShots: 1,
      blockedShotIds: [shotId],
      categories: {
        missingPreview: [shotId],
        missingCharacterRefs: [],
        missingLocationRefs: [],
        missingSelection: []
      }
    })
  });
  assert(saveReadiness.response.ok && saveReadiness.json.success, 'POST /api/storyboard/readiness-report failed');

  const saveConcept = await requestJSON('/api/save/concept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, content: 'health-concept' })
  });
  assert(saveConcept.response.ok && saveConcept.json.success, 'POST /api/save/concept failed');

  const loadConcept = await requestJSON(`/api/load/concept?project=${encodeURIComponent(project)}`);
  assert(loadConcept.response.ok && loadConcept.json.content === 'health-concept', 'GET /api/load/concept mismatch');

  const saveAnalysis = await requestJSON('/api/save/analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      content: JSON.stringify({
        version: 'health',
        duration: 10,
        bpm: 120,
        sections: [{ name: 'Intro', start: 0, end: 4 }]
      })
    })
  });
  assert(saveAnalysis.response.ok && saveAnalysis.json.success, 'POST /api/save/analysis failed');

  const saveCanon = await requestJSON(`/api/save/canon/script?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: JSON.stringify({
        version: '2026-02-08',
        shots: [],
        youtubeContentScript: 'health script',
        transcriptBlocks: []
      })
    })
  });
  assert(saveCanon.response.ok && saveCanon.json.success, 'POST /api/save/canon/script failed');

  const loadCanon = await requestJSON(`/api/load/canon/script?project=${encodeURIComponent(project)}`);
  assert(loadCanon.response.ok, 'GET /api/load/canon/script failed');

  const bundlePost = await requestJSON('/api/export/context-bundle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, includePromptTemplates: true })
  });
  assert(bundlePost.response.ok && bundlePost.json.success, 'POST /api/export/context-bundle failed');

  const bundleGet = await requestJSON(`/api/export/context-bundle?project=${encodeURIComponent(project)}`);
  assert(bundleGet.response.ok && bundleGet.json.success, 'GET /api/export/context-bundle failed');
}

async function verifyCleanup() {
  const del = await requestJSON(`/api/projects/${encodeURIComponent(tempProjectId)}?cleanup=1`, {
    method: 'DELETE'
  });
  assert(del.response.ok && del.json.success, 'DELETE /api/projects/:id failed');

  const listAfter = await requestJSON('/api/projects?health=1');
  assert(listAfter.response.ok && listAfter.json.success, 'GET /api/projects?health=1 failed');
  const stillExists = (listAfter.json.projects || []).some((p) => p.id === tempProjectId);
  assert(!stillExists, 'Temp project still exists after delete');

  tempProjectId = null;
}

async function main() {
  const startedAt = Date.now();

  await startServerIfNeeded();
  await checkProjectCrud();
  await checkProjectScopedEndpoints();
  await verifyCleanup();

  const elapsed = Date.now() - startedAt;
  console.log(`HEALTH_OK base=${BASE_URL} duration_ms=${elapsed}`);
}

main()
  .catch(async (err) => {
    console.error(err.stack || String(err));
    await cleanupTempProject();
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopServerIfStarted();
  });
