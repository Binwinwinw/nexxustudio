import crypto from 'crypto';
import { OTEL_ATTRIBUTES, SPAN_NAMES } from './otelSemanticMap.js';
import { logTraceEvent } from './traceLogger.js';
import traceStore from './traceStore.js';

function newSpanId() {
  return crypto.randomBytes(8).toString('hex');
}

function toIso(ms) {
  return new Date(ms).toISOString();
}

class TurnTelemetry {
  constructor() {
    this._initState('unknown');
  }

  _initState(query = '') {
    this.traceId = null;
    this.sessionId = null;
    this.turnId = null;
    this.rootSpanId = null;
    this.currentSpanId = null;
    this.query = query;
    this.startedAt = Date.now();
    this.finishedAt = null;
    this.status = 'in_progress';
    this.responseMode = null;
    this.error = null;
    this.layers = new Set();
    this.spans = [];
    this.events = [];
    this.activeSpans = new Map();
    this.metrics = {
      [OTEL_ATTRIBUTES.INTENT]: 'none',
      [OTEL_ATTRIBUTES.REASONING_BUDGET]: 0,
      [OTEL_ATTRIBUTES.DETERMINISTIC_BYPASS]: false,
      [OTEL_ATTRIBUTES.GEN_AI_MODEL]: 'none',
      [OTEL_ATTRIBUTES.GEN_AI_INPUT_TOKENS]: 0,
      [OTEL_ATTRIBUTES.GEN_AI_OUTPUT_TOKENS]: 0,
      ttft: 0,
      tps: 0,
      totalTokens: 0,
    };
    this.multimodal = undefined;
    this._lastPipelinePath = null;
  }

  /**
   * Démarre une trace corrélée (entrée HTTP ou job).
   * @param {{ traceId?: string, sessionId?: string, query?: string }} [options]
   */
  startTrace({ traceId, sessionId, query = '' } = {}) {
    this._initState(query);
    this.traceId = traceId || crypto.randomUUID();
    this.turnId = this.traceId;
    this.sessionId = sessionId || null;
    this.rootSpanId = newSpanId();
    this.currentSpanId = this.rootSpanId;

    this.startSpan(SPAN_NAMES.TURN, {
      span_id: this.rootSpanId,
      parent_span_id: null,
    });

    this.recordEvent('trace.start', {
      status: 'ok',
      query_preview: String(query).slice(0, 120),
    });

    return this.traceId;
  }

  /**
   * Réinitialise spans/métriques pour un nouveau segment de tour sans changer trace_id.
   */
  beginTurn(query = '', { sessionId, traceId } = {}) {
    const preservedTraceId = traceId || this.traceId;
    const preservedSessionId = sessionId || this.sessionId;
    const preservedTurnId = this.turnId || preservedTraceId;

    this.query = query;
    this.layers = new Set();
    this.activeSpans = new Map();

    if (!preservedTraceId) {
      return this.startTrace({ sessionId: preservedSessionId, query });
    }

    this.traceId = preservedTraceId;
    this.sessionId = preservedSessionId;
    this.turnId = preservedTurnId;

    if (!this.rootSpanId) {
      this.rootSpanId = newSpanId();
      this.currentSpanId = this.rootSpanId;
      this.startSpan(SPAN_NAMES.TURN, {
        span_id: this.rootSpanId,
        parent_span_id: null,
      });
    }

    this.recordEvent('pipeline.begin_turn', { status: 'ok' });
    return this.traceId;
  }

  /** @deprecated Préférer startTrace / beginTurn — conservé pour compat tests. */
  reset(query = '', options = {}) {
    if (options.traceId || options.sessionId) {
      return this.beginTurn(query, options);
    }
    return this.startTrace({ query, sessionId: options.sessionId, traceId: options.traceId });
  }

  startSpan(name, attributes = {}) {
    const spanId = attributes.span_id || newSpanId();
    const parentSpanId =
      attributes.parent_span_id !== undefined
        ? attributes.parent_span_id
        : this.currentSpanId || this.rootSpanId;

    const startedAt = Date.now();
    const span = {
      span_id: spanId,
      parent_span_id: parentSpanId,
      name,
      started_at: toIso(startedAt),
      startedAt,
      attributes: { ...attributes },
      events: [],
      status: 'in_progress',
    };

    this.activeSpans.set(name, span);
    this.currentSpanId = spanId;

    this.recordEvent('span.start', {
      span_id: spanId,
      parent_span_id: parentSpanId,
      span_name: name,
      status: 'ok',
    });

    return span;
  }

  endSpan(name, attributes = {}) {
    const span = this.activeSpans.get(name);
    if (!span) return;

    const endedAt = Date.now();
    span.durationMs = endedAt - span.startedAt;
    span.duration_ms = span.durationMs;
    span.ended_at = toIso(endedAt);
    span.status = attributes.error ? 'error' : attributes.status || 'ok';
    span.attributes = { ...span.attributes, ...attributes };
    if (attributes.error) {
      span.error = String(attributes.error);
    }

    this.spans.push(span);
    this.activeSpans.delete(name);

    this.recordEvent('span.end', {
      span_id: span.span_id,
      span_name: name,
      status: span.status,
      duration_ms: span.durationMs,
      error: span.error || null,
    });

    if (span.parent_span_id) {
      this.currentSpanId = span.parent_span_id;
    }
  }

  addEvent(spanName, eventName, data = {}) {
    const span = this.activeSpans.get(spanName);
    if (span) {
      span.events.push({
        name: eventName,
        timestamp: toIso(Date.now()),
        data,
      });
    }
    this.recordEvent(eventName, { span_name: spanName, ...data });
  }

  recordEvent(event, data = {}) {
    const entry = {
      timestamp: toIso(Date.now()),
      trace_id: this.traceId,
      span_id: data.span_id || this.currentSpanId || this.rootSpanId,
      session_id: this.sessionId,
      turn_id: this.turnId || this.traceId,
      event,
      status: data.status || 'ok',
      duration_ms: data.duration_ms ?? null,
      ...data,
    };

    this.events.push(entry);
    if (this.traceId) {
      logTraceEvent(entry);
    }
    return entry;
  }

  recordError(error, context = {}) {
    const message = error?.message || String(error);
    this.error = { message, ...context };
    this.recordEvent('trace.error', {
      status: 'error',
      error: message,
      ...context,
    });
  }

  recordPipelinePath(path, extra = {}) {
    this._lastPipelinePath = path;
    this.recordEvent('pipeline.route', {
      path,
      status: 'ok',
      ...extra,
    });
  }

  /** Dernier chemin enregistré pour ce tour (diagnostic runtime / SSE). */
  getLastPipelinePath() {
    if (this._lastPipelinePath) return this._lastPipelinePath;
    const routes = this.events.filter((e) => e.event === 'pipeline.route');
    const last = routes[routes.length - 1];
    return last?.path || null;
  }

  markLayer(layer) {
    if (layer) {
      this.layers.add(layer);
    }
  }

  setMetric(name, value) {
    if (Object.prototype.hasOwnProperty.call(this.metrics, name)) {
      this.metrics[name] = value;
    } else {
      if (!this.metrics.legacy) this.metrics.legacy = {};
      this.metrics.legacy[name] = value;
    }
  }

  increment(name, delta = 1) {
    if (typeof this.metrics[name] === 'number') {
      this.metrics[name] += delta;
    } else {
      if (!this.metrics.legacy) this.metrics.legacy = {};
      this.metrics.legacy[name] = (this.metrics.legacy[name] || 0) + delta;
    }
  }

  snapshot() {
    return {
      traceId: this.traceId,
      turnId: this.turnId || this.traceId,
      sessionId: this.sessionId,
      queryPreview: String(this.query || '').slice(0, 120),
      durationMs: Date.now() - this.startedAt,
      layers: [...this.layers],
      spans: [...this.spans],
      events: [...this.events],
      metrics: { ...this.metrics },
      multimodal: this.multimodal,
      status: this.status,
    };
  }

  exportTrace() {
    const openSpans = [...this.activeSpans.values()].map((span) => ({
      ...span,
      status: span.status || 'in_progress',
      duration_ms: span.durationMs ?? Date.now() - span.startedAt,
    }));

    const allSpans = [...this.spans, ...openSpans].sort(
      (a, b) => (a.startedAt || 0) - (b.startedAt || 0),
    );

    const timeline = [...this.events].sort((a, b) =>
      String(a.timestamp).localeCompare(String(b.timestamp)),
    );

    return {
      trace_id: this.traceId,
      session_id: this.sessionId,
      turn_id: this.turnId || this.traceId,
      query_preview: String(this.query || '').slice(0, 120),
      started_at: toIso(this.startedAt),
      finished_at: this.finishedAt ? toIso(this.finishedAt) : null,
      duration_ms: (this.finishedAt || Date.now()) - this.startedAt,
      status: this.status,
      response_mode: this.responseMode,
      error: this.error,
      metrics: { ...this.metrics },
      spans: allSpans.map(({ startedAt, activeSpans, ...rest }) => rest),
      timeline,
    };
  }

  finishTrace({ status = 'ok', responseMode, error } = {}) {
    if (this.activeSpans.has(SPAN_NAMES.TURN)) {
      this.endSpan(SPAN_NAMES.TURN, { status });
    }

    this.finishedAt = Date.now();
    this.status = status;
    if (responseMode) this.responseMode = responseMode;
    if (error) {
      this.recordError(typeof error === 'string' ? new Error(error) : error);
    }

    this.recordEvent('trace.finish', {
      status,
      duration_ms: this.finishedAt - this.startedAt,
      response_mode: responseMode || null,
    });

    const exported = this.exportTrace();
    if (exported.trace_id) {
      traceStore.save(exported);
    }
    return exported;
  }

  logSummary(context = 'turn') {
    const snap = this.snapshot();
    const intent = snap.metrics[OTEL_ATTRIBUTES.INTENT];
    const budget = snap.metrics[OTEL_ATTRIBUTES.REASONING_BUDGET];
    const bypass = snap.metrics[OTEL_ATTRIBUTES.DETERMINISTIC_BYPASS];

    console.log(
      `[Telemetry][${context}] trace_id=${snap.traceId || 'none'} durationMs=${snap.durationMs} spans=${snap.spans.length} ` +
        `intent=${intent} budget=${budget} bypass=${bypass} ` +
        `model=${snap.metrics[OTEL_ATTRIBUTES.GEN_AI_MODEL]} ` +
        `ttft=${snap.metrics.ttft}ms tps=${snap.metrics.tps} tokens=${snap.metrics.totalTokens} ` +
        `spans_detail=[${snap.spans.map((s) => `${s.name}:${s.duration_ms || s.durationMs}ms`).join(', ')}]`,
    );
  }
}

export default new TurnTelemetry();
