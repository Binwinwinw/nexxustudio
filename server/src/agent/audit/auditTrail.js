// server/src/agent/audit/auditTrail.js

import auditRepository from '../../db/repositories/auditRepository.js';

export const auditTrail = {
  traces: new Map(),

  startRun({ queryId, userQuery, sessionId = null }) {
    const traceId = `trace_${Date.now()}`;
    const trace = {
      traceId,
      queryId,
      sessionId,
      userQuery,
      startTime: new Date().toISOString(),
      events: [],
      status: "running",
      lastDbId: null
    };
    this.traces.set(traceId, trace);
    return traceId;
  },

  async record(traceId, stage, payload, status = "ok") {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    
    // Attempt to extract a payload type from the schema logic or convention
    let payloadType = "Unknown";
    if (payload && typeof payload === 'object') {
      if (payload.evidence_id) payloadType = "EvidenceRecord";
      else if (payload.fact_id) payloadType = "FactRecord";
      else if (payload.draft_id) payloadType = "AnswerDraft";
      else if (payload.review_id) payloadType = "CriticReport";
      else if (payload.answer_id) payloadType = "FinalAnswer";
      else if (stage.includes('router')) payloadType = "RoutingPlan";
      else payloadType = "GenericObject";
    }

    const eventToSave = {
      query_id: trace.queryId,
      session_id: trace.sessionId,
      stage,
      payload_type: payloadType,
      status,
      payload_json: payload,
      parent_id: trace.lastDbId
    };

    trace.events.push({
      ...eventToSave,
      timestamp: new Date().toISOString()
    });

    try {
      const insertedId = await auditRepository.saveEvent(eventToSave);
      trace.lastDbId = insertedId;
    } catch (err) {
      console.error(`[AuditTrail] Failed to persist event for trace ${traceId}:`, err);
    }
  },

  async complete(traceId, { status, error }) {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.status = status;
    trace.endTime = new Date().toISOString();
    if (error) {
      trace.error = error;
      // Record the failure
      await this.record(traceId, "orchestrator", { error: error.message, stack: error.stack }, "failed");
    } else {
      await this.record(traceId, "orchestrator", { message: "Pipeline completed successfully" }, "ok");
    }
    
    // In production we might delete the local memory map to prevent memory leaks over time
    this.traces.delete(traceId);
    console.log(`[AuditTrail] Trace ${traceId} completed with status: ${status}`);
  }
};
