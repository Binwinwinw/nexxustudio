/**
 * Jobs vidéo asynchrones — Nexxus Video (MVP).
 */
import { EventEmitter } from 'events';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canAccessProductionJob } from '../../security/productionJobAccess.js';
import runNexxusVideoPipeline from './nexxusVideoPipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ARTIFACT_ROOT = path.resolve(__dirname, '../../data/video-jobs');

export class VideoJobManager {
  /**
   * @param {object} [options]
   * @param {Function} [options.pipelineRunner]
   * @param {string} [options.artifactRoot]
   */
  constructor(options = {}) {
    this.jobs = new Map();
    this.pipelineRunner = options.pipelineRunner || runNexxusVideoPipeline;
    this.artifactRoot = options.artifactRoot || DEFAULT_ARTIFACT_ROOT;
  }

  startJob({
    filePath,
    objective = 'summary',
    depth = 'fast',
    query = '',
    sessionId = null,
    browserId = null,
    traceId = null,
    egressPolicy = 'local-only',
  }) {
    const jobId = `job-video-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const jobTraceId = traceId || crypto.randomUUID();

    const job = {
      id: jobId,
      traceId: jobTraceId,
      kind: 'nexxus.video',
      status: 'RUNNING',
      events: [],
      emitter: new EventEmitter(),
      createdAt: Date.now(),
      sessionId,
      browserId,
      filePath,
      objective,
    };

    this.jobs.set(jobId, job);

    this._runVideoAsync(jobId, {
      filePath,
      objective,
      depth,
      query,
      sessionId,
      browserId,
      traceId: jobTraceId,
      egressPolicy,
    }).catch((error) => {
      console.error(`[VideoJobManager] Job ${jobId} failed:`, error);
      this._pushEvent(jobId, {
        error: error.message || 'Erreur interne Video Job Manager',
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

  subscribe(jobId, lastIndex, res, { browserId } = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ error: 'Job vidéo introuvable ou expiré' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    if (!this.canAccess(jobId, browserId)) {
      res.write(
        `data: ${JSON.stringify({ error: 'Accès refusé à ce job vidéo.' })}\n\n`,
      );
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

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  abortJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'RUNNING') {
      this._pushEvent(jobId, { error: 'Job vidéo interrompu.', trace_id: job.traceId });
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

  async _runVideoAsync(
    jobId,
    { filePath, objective, depth, query, traceId, egressPolicy },
  ) {
    const job = this.jobs.get(jobId);
    const outputDir = path.join(this.artifactRoot, jobId);

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        trace_id: traceId,
        event: 'video.job.start',
        job_id: jobId,
        objective,
      }),
    );

    this._pushEvent(jobId, {
      step: 'video.job.start',
      status: 'ok',
      trace_id: traceId,
      query: query || null,
    });

    const result = await this.pipelineRunner({
      filePath,
      objective,
      depth,
      outputDir,
      egressPolicy,
      traceId,
      onStep: (entry) => {
        this._pushEvent(jobId, {
          step: entry.step,
          status: entry.status,
          trace_id: traceId,
          ...entry,
        });
      },
    });

    if (!result.ok) {
      this._pushEvent(jobId, {
        error:
          result.refusal?.message ||
          result.violations?.[0]?.message ||
          'Pipeline vidéo refusé.',
        code: result.refusal?.code || result.code,
        trace_id: traceId,
      });
      this._pushEvent(jobId, { done: true, trace_id: traceId });
      job.status = 'FAILED';
      return;
    }

    this._pushEvent(jobId, {
      step: 'video.job.complete',
      status: 'ok',
      trace_id: traceId,
      artifacts: result.artifacts?.files || null,
      summary: result.analysisResult?.summary || null,
    });
    this._pushEvent(jobId, {
      done: true,
      trace_id: traceId,
      result: result.analysisResult,
      evidence_pack: result.evidencePack,
    });
    job.status = 'SUCCESS';

    setTimeout(() => {
      this.jobs.delete(jobId);
    }, 15 * 60 * 1000);
  }
}

const videoJobManager = new VideoJobManager();
export default videoJobManager;
