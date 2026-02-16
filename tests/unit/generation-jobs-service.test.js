const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { GenerationJobsService } = require('../../scripts/services/generation_jobs_service');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs = 4000, intervalMs = 25) {
  const started = Date.now();
  while ((Date.now() - started) < timeoutMs) {
    if (fn()) return true;
    await sleep(intervalMs);
  }
  return false;
}

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'amv-generation-jobs-'));
  const projectId = 'job-test-project';
  const projectPath = path.join(tmpRoot, projectId);
  fs.mkdirSync(projectPath, { recursive: true });

  const projectManager = {
    listProjects() {
      return [{ id: projectId }];
    },
    getProjectPath(id, relative = '') {
      return path.join(tmpRoot, id, relative || '');
    }
  };

  const service = new GenerationJobsService({ projectManager });

  const first = service.createJob({
    projectId,
    type: 'generate-shot',
    input: { shotId: 'SHOT_01' }
  });
  assert.ok(first.jobId, 'Expected jobId on created job');

  service.runJob(first.jobId, async ({ setStep }) => {
    setStep('mock_running', 40, { detail: 'unit_test' });
    await sleep(30);
    return { ok: true, previewPaths: ['rendered/shots/SHOT_01/preview/test.png'] };
  });

  const completed = await waitFor(() => {
    const job = service.getJob(first.jobId);
    return Boolean(job && job.status === 'completed');
  });
  assert.strictEqual(completed, true, 'Job should complete');

  const completedJob = service.getJob(first.jobId);
  assert.strictEqual(completedJob.status, 'completed');
  assert.strictEqual(completedJob.result.ok, true);
  assert.ok(Array.isArray(completedJob.events) && completedJob.events.length > 0, 'Expected persisted job events');

  const persistedJobPath = path.join(projectPath, 'rendered', 'storyboard', 'generation_jobs', first.jobId, 'job.json');
  assert.ok(fs.existsSync(persistedJobPath), 'Expected job.json persisted to disk');

  const third = service.createJob({
    projectId,
    type: 'generate-shot',
    lockKey: `${projectId}:generate-shot:SHOT_03:A`,
    input: { shotId: 'SHOT_03', variation: 'A' }
  });
  service.runJob(third.jobId, async ({ isCanceled }) => {
    while (!isCanceled()) {
      await sleep(20);
    }
    const err = new Error('Canceled by lock test');
    err.code = 'CANCELED';
    throw err;
  });

  let lockErr = null;
  try {
    service.createJob({
      projectId,
      type: 'generate-shot',
      lockKey: `${projectId}:generate-shot:SHOT_03:A`,
      input: { shotId: 'SHOT_03', variation: 'A' }
    });
  } catch (err) {
    lockErr = err;
  }
  assert.ok(lockErr, 'Expected lock conflict error for duplicate lockKey');
  assert.strictEqual(lockErr.code, 'LOCK_CONFLICT', 'Expected LOCK_CONFLICT code');
  assert.strictEqual(lockErr.activeJobId, third.jobId, 'Expected active lock owner job ID');

  const activeByLock = service.findActiveJobByLock(`${projectId}:generate-shot:SHOT_03:A`);
  assert.ok(activeByLock && activeByLock.jobId === third.jobId, 'Expected active job lookup by lock key');

  const cancelThird = service.cancelJob(third.jobId);
  assert.strictEqual(cancelThird, true, 'Expected cancel request for lock-held job');
  const thirdCanceled = await waitFor(() => {
    const job = service.getJob(third.jobId);
    return Boolean(job && job.status === 'canceled');
  });
  assert.strictEqual(thirdCanceled, true, 'Lock-held job should transition to canceled');

  const second = service.createJob({
    projectId,
    type: 'generate-shot',
    input: { shotId: 'SHOT_02' }
  });

  service.runJob(second.jobId, async ({ isCanceled }) => {
    while (!isCanceled()) {
      await sleep(20);
    }
    const err = new Error('Canceled by test');
    err.code = 'CANCELED';
    throw err;
  });

  const cancelRequested = service.cancelJob(second.jobId);
  assert.strictEqual(cancelRequested, true, 'Expected cancel request to succeed');

  const canceled = await waitFor(() => {
    const job = service.getJob(second.jobId);
    return Boolean(job && job.status === 'canceled');
  });
  assert.strictEqual(canceled, true, 'Job should transition to canceled');

  const metrics = service.getMetrics(projectId, 50);
  assert.ok(metrics && metrics.counts, 'Expected metrics payload');
  assert.ok(Number.isFinite(metrics.successRate), 'Expected numeric successRate');
  assert.ok(Array.isArray(metrics.recent), 'Expected recent jobs list');
  assert.ok(Array.isArray(metrics.activeLocks), 'Expected active lock list');

  console.log('generation-jobs-service.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
