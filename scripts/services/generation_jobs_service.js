const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'canceled']);

function ensureDir(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function safeReadJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function createJobId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `job_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

class GenerationJobsService {
  constructor({ projectManager }) {
    this.projectManager = projectManager;
    this.jobs = new Map();
    this.listeners = new Map();
    this.lockIndex = new Map();
    this.loadExistingJobs();
  }

  getJobsDir(projectId) {
    return this.projectManager.getProjectPath(projectId, path.join('rendered', 'storyboard', 'generation_jobs'));
  }

  getJobPaths(projectId, jobId) {
    const jobDir = path.join(this.getJobsDir(projectId), jobId);
    return {
      jobDir,
      jobPath: path.join(jobDir, 'job.json'),
      eventsPath: path.join(jobDir, 'events.log')
    };
  }

  serializeJob(job) {
    if (!job) return null;
    return {
      jobId: job.jobId,
      projectId: job.projectId,
      type: job.type,
      lockKey: job.lockKey || '',
      status: job.status,
      step: job.step,
      progress: job.progress,
      input: job.input,
      result: job.result || null,
      error: job.error || null,
      createdAt: job.createdAt,
      startedAt: job.startedAt || null,
      finishedAt: job.finishedAt || null,
      canceled: Boolean(job.canceled),
      events: Array.isArray(job.events) ? job.events.slice() : []
    };
  }

  saveJob(job) {
    const paths = this.getJobPaths(job.projectId, job.jobId);
    ensureDir(paths.jobDir);
    fs.writeFileSync(paths.jobPath, JSON.stringify(this.serializeJob(job), null, 2), 'utf8');
  }

  appendEvent(job, event, payload = {}) {
    const evt = {
      event,
      jobId: job.jobId,
      timestamp: new Date().toISOString(),
      ...payload
    };

    job.events = Array.isArray(job.events) ? job.events : [];
    job.events.push(evt);
    if (job.events.length > 400) {
      job.events.shift();
    }

    const paths = this.getJobPaths(job.projectId, job.jobId);
    ensureDir(paths.jobDir);
    fs.appendFileSync(paths.eventsPath, `${JSON.stringify(evt)}\n`, 'utf8');
    this.saveJob(job);

    const set = this.listeners.get(job.jobId);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(evt);
        } catch {
          // ignore listener failure
        }
      });
    }
    return evt;
  }

  setStep(job, step, progress = null, payload = {}) {
    if (step) job.step = step;
    if (Number.isFinite(progress)) {
      job.progress = Math.max(0, Math.min(100, Math.floor(progress)));
    }
    this.appendEvent(job, 'job_progress', {
      step: job.step,
      progress: job.progress,
      ...payload
    });
  }

  markIncompleteAsFailed(job) {
    if (TERMINAL_STATUSES.has(job.status)) return;
    job.status = 'failed';
    job.step = 'server_restarted';
    job.progress = Number.isFinite(job.progress) ? job.progress : 0;
    job.error = {
      code: 'SERVER_RESTARTED',
      message: 'Job stopped because the server restarted'
    };
    job.finishedAt = new Date().toISOString();
    this.appendEvent(job, 'job_failed', {
      step: job.step,
      progress: job.progress,
      error: job.error
    });
  }

  releaseLockForJob(job) {
    if (!job || !job.lockKey) return;
    if (this.lockIndex.get(job.lockKey) === job.jobId) {
      this.lockIndex.delete(job.lockKey);
    }
  }

  trackLockForJob(job) {
    if (!job || !job.lockKey) return;
    if (TERMINAL_STATUSES.has(job.status)) return;
    this.lockIndex.set(job.lockKey, job.jobId);
  }

  loadExistingJobs() {
    const projects = this.projectManager.listProjects();
    projects.forEach((project) => {
      const projectId = project && project.id;
      if (!projectId) return;
      const jobsDir = this.getJobsDir(projectId);
      if (!fs.existsSync(jobsDir)) return;

      const entries = fs.readdirSync(jobsDir, { withFileTypes: true });
      entries.forEach((entry) => {
        if (!entry.isDirectory()) return;
        const jobId = entry.name;
        const paths = this.getJobPaths(projectId, jobId);
        const job = safeReadJson(paths.jobPath, null);
        if (!job || !job.jobId) return;

        if (!Array.isArray(job.events)) {
          job.events = [];
        }
        if (typeof job.lockKey !== 'string') {
          job.lockKey = '';
        }

        this.jobs.set(job.jobId, job);
        this.trackLockForJob(job);
        this.markIncompleteAsFailed(job);
        this.releaseLockForJob(job);
        this.saveJob(job);
      });
    });
  }

  createJob(input) {
    const projectId = input.projectId;
    const type = String(input.type || '').trim();
    const payload = input.input || {};
    const lockKey = typeof input.lockKey === 'string' ? input.lockKey.trim() : '';
    if (!projectId) throw new Error('projectId is required');
    if (!type) throw new Error('type is required');

    if (lockKey) {
      const activeJobId = this.lockIndex.get(lockKey);
      if (activeJobId) {
        const active = this.jobs.get(activeJobId);
        if (active && !TERMINAL_STATUSES.has(active.status)) {
          const err = new Error('Another generation job is already running for this target');
          err.code = 'LOCK_CONFLICT';
          err.activeJobId = activeJobId;
          throw err;
        }
        this.lockIndex.delete(lockKey);
      }
    }

    const jobId = createJobId();
    const job = {
      jobId,
      projectId,
      type,
      lockKey,
      status: 'queued',
      step: 'queued',
      progress: 0,
      input: payload,
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      canceled: false,
      events: []
    };
    this.jobs.set(jobId, job);
    this.trackLockForJob(job);
    this.appendEvent(job, 'job_queued', { step: job.step, progress: job.progress });
    return this.serializeJob(job);
  }

  runJob(jobId, executor) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status !== 'queued') return;

    job.status = 'running';
    job.step = 'running';
    job.progress = 2;
    job.startedAt = new Date().toISOString();
    this.appendEvent(job, 'job_started', { step: job.step, progress: job.progress });

    setImmediate(async () => {
      try {
        const result = await executor({
          job: this.serializeJob(job),
          emit: (event, payload = {}) => this.appendEvent(job, event, payload),
          setStep: (step, progress, payload = {}) => this.setStep(job, step, progress, payload),
          isCanceled: () => Boolean(job.canceled),
          throwIfCanceled: () => {
            if (!job.canceled) return;
            const err = new Error('Job canceled');
            err.code = 'CANCELED';
            throw err;
          }
        });

        if (job.canceled) {
          job.status = 'canceled';
          job.step = 'canceled';
          job.finishedAt = new Date().toISOString();
          this.appendEvent(job, 'job_canceled', {
            step: job.step,
            progress: job.progress,
            finishedAt: job.finishedAt
          });
          return;
        }

        job.status = 'completed';
        job.step = 'completed';
        job.progress = 100;
        job.result = result || {};
        job.finishedAt = new Date().toISOString();
        this.appendEvent(job, 'job_completed', {
          step: job.step,
          progress: job.progress,
          finishedAt: job.finishedAt
        });
      } catch (err) {
        if (job.canceled || err.code === 'CANCELED') {
          job.status = 'canceled';
          job.step = 'canceled';
          job.finishedAt = new Date().toISOString();
          this.appendEvent(job, 'job_canceled', {
            step: job.step,
            progress: job.progress,
            finishedAt: job.finishedAt
          });
          return;
        }

        job.status = 'failed';
        job.step = 'failed';
        job.finishedAt = new Date().toISOString();
        job.error = {
          code: err.code || 'JOB_FAILED',
          message: err.message || 'Generation job failed'
        };
        this.appendEvent(job, 'job_failed', {
          step: job.step,
          progress: job.progress,
          error: job.error,
          finishedAt: job.finishedAt
        });
      } finally {
        this.releaseLockForJob(job);
        try {
          this.saveJob(job);
        } catch (saveErr) {
          // Log but don't throw — the job result/error is already set
          console.error('Failed to persist job state:', job.jobId, saveErr.message);
        }
        // Clean up listeners for terminal jobs
        if (this.listeners.has(job.jobId)) {
          // Defer cleanup to let SSE subscribers receive the final event
          setTimeout(() => {
            this.listeners.delete(job.jobId);
          }, 5000);
        }
      }
    });
  }

  getJob(jobId) {
    const job = this.jobs.get(jobId);
    return this.serializeJob(job);
  }

  listJobs(projectId = '', limit = 50) {
    const max = Math.max(1, Math.min(200, Number(limit) || 50));
    const list = Array.from(this.jobs.values())
      .filter((job) => !projectId || job.projectId === projectId)
      .sort((a, b) => {
        const aTime = Date.parse(a.createdAt || '') || 0;
        const bTime = Date.parse(b.createdAt || '') || 0;
        return bTime - aTime;
      })
      .slice(0, max)
      .map((job) => this.serializeJob(job));
    return list;
  }

  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (TERMINAL_STATUSES.has(job.status)) return false;
    if (job.canceled) return true;
    job.canceled = true;
    this.appendEvent(job, 'job_cancel_requested', {
      step: job.step,
      progress: job.progress
    });
    return true;
  }

  findActiveJobByLock(lockKey) {
    const key = typeof lockKey === 'string' ? lockKey.trim() : '';
    if (!key) return null;
    const jobId = this.lockIndex.get(key);
    if (!jobId) return null;
    const job = this.jobs.get(jobId);
    if (!job || TERMINAL_STATUSES.has(job.status)) {
      this.lockIndex.delete(key);
      return null;
    }
    return this.serializeJob(job);
  }

  getMetrics(projectId = '', limit = 200) {
    const max = Math.max(1, Math.min(1000, Number(limit) || 200));
    const jobs = Array.from(this.jobs.values())
      .filter((job) => !projectId || job.projectId === projectId)
      .sort((a, b) => {
        const aTime = Date.parse(a.createdAt || '') || 0;
        const bTime = Date.parse(b.createdAt || '') || 0;
        return bTime - aTime;
      })
      .slice(0, max);

    const counts = {
      total: jobs.length,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      canceled: 0,
      other: 0
    };
    const byType = {};
    const failureCodes = {};
    const durations = [];

    jobs.forEach((job) => {
      const status = String(job.status || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      } else {
        counts.other += 1;
      }

      const type = String(job.type || 'unknown');
      byType[type] = (byType[type] || 0) + 1;

      if (status === 'failed') {
        const code = String(job.error && (job.error.code || job.error.message) || 'UNKNOWN').trim() || 'UNKNOWN';
        failureCodes[code] = (failureCodes[code] || 0) + 1;
      }

      const startedMs = Date.parse(job.startedAt || '');
      const finishedMs = Date.parse(job.finishedAt || '');
      if (Number.isFinite(startedMs) && Number.isFinite(finishedMs) && finishedMs >= startedMs) {
        durations.push((finishedMs - startedMs) / 1000);
      }
    });

    const terminalCount = counts.completed + counts.failed + counts.canceled;
    const successRate = terminalCount > 0
      ? Number(((counts.completed / terminalCount) * 100).toFixed(2))
      : 0;

    let avgDurationSec = 0;
    let p95DurationSec = 0;
    if (durations.length > 0) {
      const sorted = durations.slice().sort((a, b) => a - b);
      const sum = sorted.reduce((acc, value) => acc + value, 0);
      avgDurationSec = Number((sum / sorted.length).toFixed(2));
      const p95Index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1));
      p95DurationSec = Number(sorted[p95Index].toFixed(2));
    }

    const topFailureCodes = Object.entries(failureCodes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));

    const activeLocks = [];
    for (const [lockKey, jobId] of this.lockIndex.entries()) {
      const job = this.jobs.get(jobId);
      if (!job || TERMINAL_STATUSES.has(job.status)) continue;
      activeLocks.push({
        lockKey,
        jobId,
        projectId: job.projectId,
        type: job.type,
        status: job.status
      });
    }

    const recent = jobs.slice(0, 12).map((job) => ({
      jobId: job.jobId,
      type: job.type,
      status: job.status,
      step: job.step,
      createdAt: job.createdAt,
      startedAt: job.startedAt || null,
      finishedAt: job.finishedAt || null,
      errorCode: job.error?.code || null
    }));

    return {
      projectId: projectId || '',
      limit: max,
      counts,
      byType,
      successRate,
      avgDurationSec,
      p95DurationSec,
      topFailureCodes,
      activeLocks,
      recent
    };
  }

  subscribe(jobId, listener) {
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    const set = this.listeners.get(jobId);
    set.add(listener);
    return () => {
      const listeners = this.listeners.get(jobId);
      if (!listeners) return;
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(jobId);
      }
    };
  }
}

module.exports = {
  GenerationJobsService
};
