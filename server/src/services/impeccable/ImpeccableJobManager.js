/**
 * Jobs asynchrones Impeccable — audit qualité design (E3).
 */
import { EventEmitter } from 'events';
import crypto from 'node:crypto';
import path from 'node:path';
import { canAccessProductionJob } from '../../security/productionJobAccess.js';
import runImpeccableWorker from './impeccableWorker.js';
import {
  IMPECCABLE_ARTIFACT_ROOT,
  writePartialImpeccableFailureArtifacts,
} from './impeccableArtifacts.js';
import { publishImpeccableCockpitSnapshot } from './impeccableCockpitSnapshot.js';

export class ImpeccableJobManager {
  constructor(options = {}) {
    this.jobs = new Map();
    this.workerRunner = options.workerRunner || runImpeccableWorker;
    this.artifactRoot = options.artifactRoot || IMPECCABLE_ARTIFACT_ROOT;
  }

  startJob({
    query = '',
    target = null,
    pipelineJobId = null,
    createJobId = null,
    artifactDir = null,
    createEnvelope = null,
    extractEnvelope = null,
    browserObservation = null,
    includeVisualAudit = false,
    sessionId = null,
    browserId = null,
    traceId = null,
  }) {
    const jobId = `job-impeccable-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const jobTraceId = traceId || crypto.randomUUID();

    const job = {
      id: jobId,
      traceId: jobTraceId,
      kind: 'impeccable.audit',
      status: 'RUNNING',
      events: [],
      emitter: new EventEmitter(),
      createdAt: Date.now(),
      sessionId,
      browserId,
      pipelineJobId,
      merge_ok: null,
      score_global: null,
      artifacts: null,
      envelope: null,
    };

    this.jobs.set(jobId, job);

    this._runAsync(jobId, {
      query,
      target,
      pipelineJobId,
      createJobId,
      artifactDir,
      createEnvelope,
      extractEnvelope,
      browserObservation,
      includeVisualAudit,
      sessionId,
      traceId: jobTraceId,
    }).catch((error) => {
      this._pushEvent(jobId, {
        error: error.message || 'Erreur Impeccable',
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

  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      jobId: job.id,
      status: job.status,
      trace_id: job.traceId,
      pipeline_job_id: job.pipelineJobId,
      score_global: job.score_global,
      merge_ok: job.merge_ok,
      artifacts: job.artifacts,
      envelope: job.envelope,
      events_count: job.events.length,
      stream_url: `/api/impeccable/audit/${job.id}/stream`,
    };
  }

  subscribe(jobId, lastIndex, res, { browserId } = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ error: 'Job Impeccable introuvable' })}\n\n`);
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
      step: 'impeccable.audit.job.start',
      status: 'ok',
      trace_id: params.traceId,
      job_id: jobId,
      pipeline_job_id: params.pipelineJobId,
    });

    const result = await this.workerRunner({
      ...params,
      outputDir,
      onStep: (entry) => {
        if (job.status === 'ABORTED') return;
        this._pushEvent(jobId, entry);
      },
    });

    if (job.status === 'ABORTED') return;

    if (!result.ok) {
      const partial = await writePartialImpeccableFailureArtifacts(outputDir, {
        code: result.violations?.[0]?.code || 'IMPECCABLE_AUDIT_FAILED',
        message: result.violations?.[0]?.message,
        orchestrationEvents: job.events,
        trace_id: params.traceId,
        job_id: jobId,
      });
      job.artifacts = partial.files;

      this._pushEvent(jobId, {
        error: result.violations?.[0]?.message || 'Audit refusé.',
        code: result.violations?.[0]?.code,
        trace_id: params.traceId,
        job_id: jobId,
      });
      this._pushEvent(jobId, { done: true, trace_id: params.traceId, job_id: jobId });
      job.status = 'FAILED';
      return;
    }

    job.envelope = result.envelope;
    job.merge_ok = result.envelope?.merge_ok ?? false;
    job.score_global = result.envelope?.score_global ?? null;
    job.artifacts = result.artifacts?.files || null;

    publishImpeccableCockpitSnapshot({
      sessionId: params.sessionId,
      jobId,
      trace_id: params.traceId,
      score_global: job.score_global,
      merge_ok: job.merge_ok,
      blockers_count: result.envelope?.blockers?.length ?? 0,
      checklist_pre_merge: result.envelope?.checklist_pre_merge ?? [],
      quick_wins: result.envelope?.quick_wins ?? [],
      pipeline_job_id: params.pipelineJobId,
      updated_at: Date.now(),
    });

    this._pushEvent(jobId, {
      step: 'impeccable.audit.job.complete',
      status: job.merge_ok ? 'ok' : 'blocked',
      trace_id: params.traceId,
      job_id: jobId,
      score_global: job.score_global,
      merge_ok: job.merge_ok,
      artifacts: job.artifacts,
    });
    this._pushEvent(jobId, {
      done: true,
      trace_id: params.traceId,
      job_id: jobId,
      envelope: result.envelope,
      merge_ok: job.merge_ok,
    });
    job.status = job.merge_ok ? 'SUCCESS' : 'BLOCKED';

    setTimeout(() => this.jobs.delete(jobId), 15 * 60 * 1000).unref?.();
  }
}

const impeccableJobManager = new ImpeccableJobManager();
export default impeccableJobManager;
