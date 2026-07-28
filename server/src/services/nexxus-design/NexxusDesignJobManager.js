/**
 * Jobs asynchrones Nexxus Design — create + bridge Forge (D3).
 */
import { EventEmitter } from 'events';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canAccessProductionJob } from '../../security/productionJobAccess.js';
import runNexxusDesignWorker from './nexxusDesignWorker.js';
import {
  NEXXUS_DESIGN_ARTIFACT_ROOT,
  writePartialDesignFailureArtifacts,
} from './nexxusDesignArtifacts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class NexxusDesignJobManager {
  constructor(options = {}) {
    this.jobs = new Map();
    this.workerRunner = options.workerRunner || runNexxusDesignWorker;
    this.artifactRoot = options.artifactRoot || NEXXUS_DESIGN_ARTIFACT_ROOT;
  }

  startJob({
    query = '',
    objective = 'redesign',
    referenceDna = null,
    extractEnvelope = null,
    projectTitle = null,
    emitForge = true,
    sessionId = null,
    browserId = null,
    traceId = null,
  }) {
    const jobId = `job-nexxus-create-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const jobTraceId = traceId || crypto.randomUUID();
    const reference = referenceDna || extractEnvelope;

    const job = {
      id: jobId,
      traceId: jobTraceId,
      kind: 'design.create',
      status: 'RUNNING',
      events: [],
      emitter: new EventEmitter(),
      createdAt: Date.now(),
      sessionId,
      browserId,
      objective,
      artifacts: null,
      refusalCode: null,
      envelope: null,
    };

    this.jobs.set(jobId, job);

    this._runAsync(jobId, {
      query,
      objective,
      referenceDna: reference,
      projectTitle,
      emitForge,
      traceId: jobTraceId,
    }).catch((error) => {
      this._pushEvent(jobId, {
        error: error.message || 'Erreur Nexxus Design',
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
   * @param {string} jobId
   */
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      jobId: job.id,
      status: job.status,
      trace_id: job.traceId,
      objective: job.objective,
      code: job.refusalCode,
      artifacts: job.artifacts,
      events_count: job.events.length,
      stream_url: `/api/design/create/${job.id}/stream`,
    };
  }

  subscribe(jobId, lastIndex, res, { browserId } = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ error: 'Job Nexxus Design introuvable' })}\n\n`);
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
      this._pushEvent(jobId, {
        error: 'Job interrompu.',
        trace_id: job.traceId,
        job_id: jobId,
      });
      this._pushEvent(jobId, { done: true, trace_id: job.traceId, job_id: jobId });
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

    if (job.status === 'ABORTED') return;

    this._pushEvent(jobId, {
      step: 'design.create.job.start',
      status: 'ok',
      trace_id: params.traceId,
      job_id: jobId,
    });

    const result = await this.workerRunner({
      ...params,
      outputDir,
      traceId: params.traceId,
      onStep: (entry) => {
        if (job.status === 'ABORTED') return;
        this._pushEvent(jobId, entry);
      },
    });

    if (job.status === 'ABORTED') return;

    if (!result.ok) {
      job.refusalCode =
        result.refusal?.code || result.violations?.[0]?.code || 'DESIGN_CREATE_FAILED';

      const partial = await writePartialDesignFailureArtifacts(outputDir, {
        events: job.events,
        violations: result.violations,
        refusal: result.refusal,
        code: job.refusalCode,
        trace_id: params.traceId,
        job_id: jobId,
      });
      job.artifacts = partial.files;

      this._pushEvent(jobId, {
        error:
          result.refusal?.message ||
          result.violations?.[0]?.message ||
          'Création design refusée.',
        code: job.refusalCode,
        trace_id: params.traceId,
        job_id: jobId,
        artifacts: partial.files,
      });
      this._pushEvent(jobId, { done: true, trace_id: params.traceId, job_id: jobId });
      job.status = 'FAILED';
      return;
    }

    job.artifacts = result.artifacts?.files || null;
    job.envelope = result.envelope;

    this._pushEvent(jobId, {
      step: 'design.create.job.complete',
      status: 'ok',
      trace_id: params.traceId,
      job_id: jobId,
      artifacts: result.artifacts?.files || null,
      objective: result.envelope?.objective,
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

const nexxusDesignJobManager = new NexxusDesignJobManager();
export default nexxusDesignJobManager;
