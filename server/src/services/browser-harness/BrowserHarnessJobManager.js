/**
 * Jobs asynchrones Browser Harness — observe pipeline (C4/C6).
 */
import { EventEmitter } from 'events';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canAccessProductionJob } from '../../security/productionJobAccess.js';
import runBrowserObserveWorker from './browserHarnessWorker.js';
import {
  BROWSER_SESSION_ARTIFACT_ROOT,
  writePartialBrowserFailureArtifacts,
} from './browserTraceArtifacts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BrowserHarnessJobManager {
  constructor(options = {}) {
    this.jobs = new Map();
    this.workerRunner = options.workerRunner || runBrowserObserveWorker;
    this.artifactRoot = options.artifactRoot || BROWSER_SESSION_ARTIFACT_ROOT;
  }

  startJob({
    url = null,
    egressPolicy = 'local-only',
    viewport = null,
    captureScreenshot = false,
    sessionId = null,
    browserId = null,
    traceId = null,
    browserLauncher = undefined,
    extractTimeoutMs = undefined,
  }) {
    const jobId = `job-browser-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const jobTraceId = traceId || crypto.randomUUID();

    const job = {
      id: jobId,
      traceId: jobTraceId,
      kind: 'browser.observe',
      status: 'RUNNING',
      events: [],
      emitter: new EventEmitter(),
      createdAt: Date.now(),
      sessionId,
      browserId,
      url,
      browserSessionId: null,
      artifacts: null,
      refusalCode: null,
      envelope: null,
    };

    this.jobs.set(jobId, job);

    this._runAsync(jobId, {
      url,
      egressPolicy,
      viewport,
      captureScreenshot,
      traceId: jobTraceId,
      browserLauncher,
      extractTimeoutMs,
    }).catch((error) => {
      this._pushEvent(jobId, {
        error: error.message || 'Erreur Browser Harness',
        trace_id: jobTraceId,
        job_id: jobId,
      });
      this._pushEvent(jobId, { done: true, trace_id: jobTraceId, job_id: jobId });
      job.status = 'FAILED';
    });

    return { jobId, traceId: jobTraceId };
  }

  canAccess(jobId, browserId) {
    return canAccessProductionJob(this.jobs.get(jobId), browserId);
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Vue publique pour GET /api/browser/observe/:jobId
   * @param {string} jobId
   */
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      jobId: job.id,
      status: job.status,
      trace_id: job.traceId,
      browser_session_id: job.browserSessionId,
      url: job.url,
      code: job.refusalCode,
      artifacts: job.artifacts,
      events_count: job.events.length,
      stream_url: `/api/browser/observe/${job.id}/stream`,
    };
  }

  subscribe(jobId, lastIndex, res, { browserId } = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ error: 'Job Browser Harness introuvable' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    if (!this.canAccess(jobId, browserId)) {
      res.write(`data: ${JSON.stringify({ error: 'Accès refusé.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const startIndex = Math.max(0, parseInt(lastIndex || '0', 10));
    for (let i = startIndex; i < job.events.length; i++) {
      res.write(`data: ${JSON.stringify(job.events[i])}\n\n`);
    }

    if (job.status !== 'RUNNING') {
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const listener = (evt) => {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
      if (evt.done) {
        res.write('data: [DONE]\n\n');
        res.end();
        job.emitter.removeListener('event', listener);
      }
    };

    job.emitter.on('event', listener);
    res.on('close', () => job.emitter.removeListener('event', listener));
  }

  abortJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'RUNNING') {
      this._pushEvent(jobId, { error: 'Job interrompu.', trace_id: job.traceId });
      this._pushEvent(jobId, { done: true, trace_id: job.traceId });
      job.status = 'ABORTED';
    }
  }

  _pushEvent(jobId, data) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    const evt = {
      ...data,
      trace_id: data.trace_id ?? job.traceId,
      job_id: data.job_id ?? jobId,
      eventIndex: job.events.length,
    };
    job.events.push(evt);
    job.emitter.emit('event', evt);
  }

  async _runAsync(jobId, params) {
    const job = this.jobs.get(jobId);
    const outputDir = path.join(this.artifactRoot, jobId);

    this._pushEvent(jobId, {
      step: 'browser.observe.job.start',
      status: 'ok',
      trace_id: params.traceId,
      job_id: jobId,
    });

    const result = await this.workerRunner({
      ...params,
      jobId,
      outputDir,
      onStep: (entry) => this._pushEvent(jobId, entry),
    });

    if (result.browser_session_id) {
      job.browserSessionId = result.browser_session_id;
    }

    if (!result.ok) {
      job.refusalCode = result.refusal?.code || result.violations?.[0]?.code || null;

      if (result.events?.length > 0) {
        const partial = await writePartialBrowserFailureArtifacts(outputDir, {
          events: result.events,
          refusal: result.refusal,
          code: job.refusalCode,
          message: result.refusal?.message || result.violations?.[0]?.message,
          trace_id: params.traceId,
          job_id: jobId,
          browser_session_id: result.browser_session_id || null,
        });
        job.artifacts = partial.files;
      }

      this._pushEvent(jobId, {
        error:
          result.refusal?.message ||
          result.violations?.[0]?.message ||
          'Observation refusée.',
        code: job.refusalCode,
        trace_id: params.traceId,
        job_id: jobId,
        browser_session_id: result.browser_session_id || null,
      });
      this._pushEvent(jobId, { done: true, trace_id: params.traceId, job_id: jobId });
      job.status = 'FAILED';
      return;
    }

    job.browserSessionId = result.browser_session_id;
    job.artifacts = result.artifacts?.files || null;
    job.envelope = result.envelope;

    this._pushEvent(jobId, {
      step: 'browser.observe.job.complete',
      status: 'ok',
      trace_id: params.traceId,
      job_id: jobId,
      browser_session_id: result.browser_session_id,
      artifacts: result.artifacts?.files || null,
    });
    this._pushEvent(jobId, {
      done: true,
      trace_id: params.traceId,
      job_id: jobId,
      envelope: result.envelope,
    });
    job.status = 'SUCCESS';

    setTimeout(() => this.jobs.delete(jobId), 15 * 60 * 1000).unref?.();
  }
}

const browserHarnessJobManager = new BrowserHarnessJobManager();
export default browserHarnessJobManager;
