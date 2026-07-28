/**
 * Ring buffer mémoire pour traces corrélées (M1-S1).
 */

const DEFAULT_MAX_TRACES = Number(process.env.TRACE_STORE_MAX || 500);

class TraceStore {
  constructor(maxTraces = DEFAULT_MAX_TRACES) {
    this.maxTraces = maxTraces;
    /** @type {Map<string, object>} */
    this.traces = new Map();
    /** @type {string[]} */
    this.order = [];
  }

  /**
   * @param {object} trace
   */
  save(trace) {
    if (!trace?.trace_id) return null;

    const id = trace.trace_id;
    if (!this.traces.has(id)) {
      this.order.push(id);
    }
    this.traces.set(id, trace);

    while (this.order.length > this.maxTraces) {
      const oldest = this.order.shift();
      if (oldest) this.traces.delete(oldest);
    }

    return trace;
  }

  /**
   * @param {string} traceId
   */
  get(traceId) {
    return this.traces.get(traceId) || null;
  }

  /**
   * @param {string} sessionId
   * @param {number} [limit]
   */
  listBySession(sessionId, limit = 20) {
    if (!sessionId) return [];

    const matches = [];
    for (let i = this.order.length - 1; i >= 0; i -= 1) {
      const trace = this.traces.get(this.order[i]);
      if (trace?.session_id === sessionId) {
        matches.push({
          trace_id: trace.trace_id,
          session_id: trace.session_id,
          status: trace.status,
          started_at: trace.started_at,
          finished_at: trace.finished_at,
          duration_ms: trace.duration_ms,
          span_count: trace.spans?.length || 0,
          query_preview: trace.query_preview,
        });
      }
      if (matches.length >= limit) break;
    }
    return matches;
  }

  clear() {
    this.traces.clear();
    this.order = [];
  }
}

export const traceStore = new TraceStore();
export default traceStore;
