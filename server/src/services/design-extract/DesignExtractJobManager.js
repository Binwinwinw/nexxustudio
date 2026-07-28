/**
 * Jobs asynchrones Design Extract.
 */
import { EventEmitter } from 'events';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canAccessProductionJob } from '../../security/productionJobAccess.js';
import runDesignExtractWorker from './designExtractWorker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '../../data/design-extract-jobs');

export class DesignExtractJobManager {
  constructor(options = {}) {
    this.jobs = new Map();
    this.workerRunner = options.workerRunner || runDesignExtractWorker;
    this.artifactRoot = options.artifactRoot || DEFAULT_ROOT;
  }

  startJob({
    url = null,
    htmlSnapshot = null,
    query = '',
    egressPolicy = 'local-only',
    extractionMode = 'static',
    viewport = null,
    browserLauncher = undefined,
    sessionId = null,
    browserId = null,
    traceId = null,
  }) {
    const jobId = `job-design-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const jobTraceId = traceId || crypto.randomUUID();

    const job = {
      id: jobId,
      traceId: jobTraceId,
      kind: 'design.extract',
      status: 'RUNNING',
      events: [],
      emitter: new EventEmitter(),
      createdAt: Date.now(),
      sessionId,
      browserId,
      url,
      extractionMode,
    };

    this.jobs.set(jobId, job);

    this._runAsync(jobId, {
      url,
      htmlSnapshot,
      query,
      egressPolicy,
      extractionMode,
      viewport,
      browserLauncher,
      traceId: jobTraceId,
    }).catch((error) => {
      this._pushEvent(jobId, {
        error: error.message || 'Erreur Design Extract',
        trace_id: jobTraceId,
      });
      this._pushEvent(jobId, { done: true, trace_id: jobTraceId });
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

  subscribe(jobId, lastIndex, res, { browserId } = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ error: 'Job Design Extract introuvable' })}\n\n`);
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
    const evt = { ...data, eventIndex: job.events.length };
    job.events.push(evt);
    job.emitter.emit('event', evt);
  }

  async _runAsync(jobId, params) {
    const job = this.jobs.get(jobId);
    const outputDir = path.join(this.artifactRoot, jobId);

    this._pushEvent(jobId, {
      step: 'design.extract.job.start',
      status: 'ok',
      trace_id: params.traceId,
    });

    const result = await this.workerRunner({
      ...params,
      outputDir,
      traceId: params.traceId,
      onStep: (entry) => this._pushEvent(jobId, entry),
    });

    if (!result.ok) {
      this._pushEvent(jobId, {
        error:
          result.refusal?.message ||
          result.violations?.[0]?.message ||
          'Extraction refusée.',
        code: result.refusal?.code,
        trace_id: params.traceId,
      });
      this._pushEvent(jobId, { done: true, trace_id: params.traceId });
      job.status = 'FAILED';
      return;
    }

    this._pushEvent(jobId, {
      step: 'design.extract.job.complete',
      status: 'ok',
      trace_id: params.traceId,
      artifacts: result.artifacts?.files || null,
      reproduction_prompt: result.envelope?.reproduction_prompt || null,
    });
    this._pushEvent(jobId, {
      done: true,
      trace_id: params.traceId,
      envelope: result.envelope,
    });
    job.status = 'SUCCESS';

    setTimeout(() => this.jobs.delete(jobId), 15 * 60 * 1000).unref?.();
  }
}

const designExtractJobManager = new DesignExtractJobManager();
export default designExtractJobManager;
