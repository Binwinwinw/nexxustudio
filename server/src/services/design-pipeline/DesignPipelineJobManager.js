/**
 * Jobs asynchrones pipeline Extract → Design → Forge (D4).
 */
import { EventEmitter } from 'events';
import crypto from 'node:crypto';
import path from 'node:path';
import { canAccessProductionJob } from '../../security/productionJobAccess.js';
import runDesignPipelineWorker from './designPipelineWorker.js';
import {
  DESIGN_PIPELINE_ARTIFACT_ROOT,
  writePartialPipelineFailureArtifacts,
} from './designPipelineArtifacts.js';

export class DesignPipelineJobManager {
  constructor(options = {}) {
    this.jobs = new Map();
    this.workerRunner = options.workerRunner || runDesignPipelineWorker;
    this.artifactRoot = options.artifactRoot || DESIGN_PIPELINE_ARTIFACT_ROOT;
  }

  startJob({
    url = null,
    query = '',
    objective = 'redesign',
    referenceDna = null,
    extractEnvelope = null,
    extractionMode = 'hybrid',
    egressPolicy = 'local-only',
    htmlSnapshot = null,
    viewport = null,
    projectTitle = null,
    emitForge = true,
    fetchHtml = undefined,
    browserObservation = null,
    browserObserveRunner = undefined,
    browserLauncher = undefined,
    sessionId = null,
    browserId = null,
    traceId = null,
  }) {
    const jobId = `job-design-pipeline-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const jobTraceId = traceId || crypto.randomUUID();

    const job = {
      id: jobId,
      traceId: jobTraceId,
      kind: 'design.pipeline',
      status: 'RUNNING',
      events: [],
      emitter: new EventEmitter(),
      createdAt: Date.now(),
      sessionId,
      browserId,
      mode: url ? 'url_extract' : 'dna_direct',
      url,
      objective,
      artifacts: null,
      refusalCode: null,
      extractEnvelope: null,
      createEnvelope: null,
    };

    this.jobs.set(jobId, job);

    this._runAsync(jobId, {
      url,
      query,
      objective,
      referenceDna: referenceDna || extractEnvelope,
      extractEnvelope,
      extractionMode,
      egressPolicy,
      htmlSnapshot,
      viewport,
      projectTitle,
      emitForge: emitForge !== false,
      fetchHtml,
      browserObservation,
      browserObserveRunner,
      browserLauncher,
      traceId: jobTraceId,
    }).catch((error) => {
      this._pushEvent(jobId, {
        error: error.message || 'Erreur pipeline design',
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
      mode: job.mode,
      url: job.url,
      objective: job.objective,
      code: job.refusalCode,
      phase: job.failurePhase || null,
      artifacts: job.artifacts,
      extract_envelope: job.extractEnvelope,
      create_envelope: job.createEnvelope,
      events_count: job.events.length,
      stream_url: `/api/design/pipeline/${job.id}/stream`,
    };
  }

  subscribe(jobId, lastIndex, res, { browserId } = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ error: 'Job pipeline design introuvable' })}\n\n`);
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
      step: 'design.pipeline.job.start',
      status: 'ok',
      trace_id: params.traceId,
      job_id: jobId,
      mode: job.mode,
    });

    const result = await this.workerRunner({
      ...params,
      outputDir,
      isAborted: () => job.status === 'ABORTED',
      onStep: (entry) => {
        if (job.status === 'ABORTED') return;
        this._pushEvent(jobId, entry);
      },
    });

    if (job.status === 'ABORTED') return;

    if (!result.ok) {
      job.refusalCode =
        result.refusal?.code ||
        result.violations?.[0]?.code ||
        (result.aborted ? 'JOB_ABORTED' : 'PIPELINE_FAILED');
      job.failurePhase = result.phase || null;
      job.extractEnvelope = result.extractEnvelope || null;

      const partial = await writePartialPipelineFailureArtifacts(outputDir, {
        phase: result.phase || 'unknown',
        code: job.refusalCode,
        refusal: result.refusal,
        violations: result.violations,
        extractEnvelope: result.extractEnvelope,
        orchestrationEvents: job.events,
        trace_id: params.traceId,
        job_id: jobId,
      });
      job.artifacts = { ...partial.files, ...(result.artifacts?.files || {}) };

      this._pushEvent(jobId, {
        error:
          result.refusal?.message ||
          result.violations?.[0]?.message ||
          (result.aborted ? 'Pipeline interrompu.' : 'Pipeline design refusé.'),
        code: job.refusalCode,
        phase: job.failurePhase,
        trace_id: params.traceId,
        job_id: jobId,
        artifacts: job.artifacts,
      });
      this._pushEvent(jobId, { done: true, trace_id: params.traceId, job_id: jobId });
      job.status = result.aborted ? 'ABORTED' : 'FAILED';
      return;
    }

    job.artifacts = result.artifacts?.files || null;
    job.extractEnvelope = result.extractEnvelope;
    job.createEnvelope = result.createEnvelope;

    this._pushEvent(jobId, {
      step: 'design.pipeline.job.complete',
      status: 'ok',
      trace_id: params.traceId,
      job_id: jobId,
      mode: result.mode,
      artifacts: job.artifacts,
      objective: result.createEnvelope?.objective,
    });
    this._pushEvent(jobId, {
      done: true,
      trace_id: params.traceId,
      job_id: jobId,
      extract_envelope: result.extractEnvelope,
      create_envelope: result.createEnvelope,
    });
    job.status = 'SUCCESS';

    setTimeout(() => this.jobs.delete(jobId), 15 * 60 * 1000).unref?.();
  }
}

const designPipelineJobManager = new DesignPipelineJobManager();
export default designPipelineJobManager;
