/**
 * Jobs asynchrones Document Analysis (SSE).
 */
import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import { runDocumentAnalysisWorker } from "./documentAnalysisWorker.js";
import { updateDocumentMeta } from "./documentStore.js";

export class DocumentAnalysisJobManager {
  constructor(options = {}) {
    this.jobs = new Map();
    this.workerRunner = options.workerRunner || runDocumentAnalysisWorker;
  }

  startJob({
    documentId,
    mode = "summary",
    query = "",
    sessionId = null,
    browserId = null,
    traceId = null,
  }) {
    const jobId = `job-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const jobTraceId = traceId || crypto.randomUUID();

    const job = {
      id: jobId,
      traceId: jobTraceId,
      kind: "document.analysis",
      status: "RUNNING",
      events: [],
      emitter: new EventEmitter(),
      createdAt: Date.now(),
      sessionId,
      browserId,
      documentId,
      mode,
    };

    this.jobs.set(jobId, job);
    updateDocumentMeta(documentId, {
      status: "analyzing",
      lastAnalysisJobId: jobId,
    }).catch(() => {});

    this._runAsync(jobId, {
      documentId,
      mode,
      query,
      sessionId,
      browserId,
      traceId: jobTraceId,
    }).catch((error) => {
      this._pushEvent(jobId, {
        error: error.message || "Erreur Document Analysis",
        trace_id: jobTraceId,
      });
      this._pushEvent(jobId, { done: true, trace_id: jobTraceId });
      job.status = "FAILED";
      updateDocumentMeta(documentId, { status: "imported" }).catch(() => {});
    });

    return { jobId, traceId: jobTraceId };
  }

  canAccess(job, { sessionId, browserId }) {
    if (!job) return false;
    if (sessionId && job.sessionId === sessionId) return true;
    if (browserId && job.browserId === browserId) return true;
    return false;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  subscribe(jobId, lastIndex, res, access = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ error: "Job introuvable" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    if (!this.canAccess(job, access)) {
      res.write(`data: ${JSON.stringify({ error: "Accès refusé." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const startIndex = Math.max(0, parseInt(lastIndex || "0", 10));
    for (let i = startIndex; i < job.events.length; i++) {
      res.write(`data: ${JSON.stringify(job.events[i])}\n\n`);
    }

    if (job.status !== "RUNNING") {
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const listener = (evt) => {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
      if (evt.done) {
        res.write("data: [DONE]\n\n");
        res.end();
        job.emitter.removeListener("event", listener);
      }
    };

    job.emitter.on("event", listener);
    res.on("close", () => job.emitter.removeListener("event", listener));
  }

  abortJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.status === "RUNNING") {
      this._pushEvent(jobId, { error: "Analyse interrompue.", trace_id: job.traceId });
      this._pushEvent(jobId, { done: true, trace_id: job.traceId });
      job.status = "ABORTED";
    }
  }

  _pushEvent(jobId, data) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    const evt = { ...data, eventIndex: job.events.length };
    job.events.push(evt);
    job.emitter.emit("event", evt);
  }

  async _runAsync(jobId, params) {
    const job = this.jobs.get(jobId);

    this._pushEvent(jobId, {
      step: "document.analysis.start",
      status: "ok",
      trace_id: params.traceId,
      documentId: params.documentId,
      mode: params.mode,
    });

    const result = await this.workerRunner({
      ...params,
      onStep: (entry) => this._pushEvent(jobId, entry),
      onContent: (entry) => this._pushEvent(jobId, entry),
    });

    if (!result.ok) {
      this._pushEvent(jobId, {
        error: result.error,
        code: result.code,
        trace_id: params.traceId,
      });
      this._pushEvent(jobId, { done: true, trace_id: params.traceId });
      job.status = "FAILED";
      return;
    }

    this._pushEvent(jobId, {
      step: "document.analysis.complete",
      status: "ok",
      trace_id: params.traceId,
      metadata: result.artifact.metadata,
    });
    this._pushEvent(jobId, {
      result: result.artifact.result,
      metadata: result.artifact.metadata,
      trace_id: params.traceId,
    });
    this._pushEvent(jobId, { done: true, trace_id: params.traceId });
    job.status = "SUCCESS";

    setTimeout(() => this.jobs.delete(jobId), 20 * 60 * 1000).unref?.();
  }
}

const documentAnalysisJobManager = new DocumentAnalysisJobManager();
export default documentAnalysisJobManager;
