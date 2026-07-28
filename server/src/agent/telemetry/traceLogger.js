/**
 * Logs JSON corrélés par trace_id (M1-S1).
 */

export function logTraceEvent(payload = {}) {
  const line = {
    timestamp: new Date().toISOString(),
    level: payload.status === 'error' ? 'error' : 'info',
    trace_id: payload.trace_id || null,
    span_id: payload.span_id || null,
    session_id: payload.session_id || null,
    turn_id: payload.turn_id || payload.trace_id || null,
    event: payload.event || 'trace.event',
    status: payload.status || 'ok',
    duration_ms: payload.duration_ms ?? null,
    ...payload,
  };

  console.log(JSON.stringify(line));
}

export default { logTraceEvent };
