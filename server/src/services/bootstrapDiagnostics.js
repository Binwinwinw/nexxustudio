/**
 * Journal bootstrap/warmup corrélé par boot_trace_id (M1-S2).
 */
import crypto from 'crypto';

const MAX_EVENTS = 30;

let bootTraceId = crypto.randomUUID();
/** @type {Array<object>} */
const events = [];

export function initBootstrapDiagnostics() {
  bootTraceId = crypto.randomUUID();
  events.length = 0;
  return recordBootstrapEvent('boot.start', {
    status: 'ok',
    message: 'Process Citadelle démarré',
  });
}

export function getBootTraceId() {
  return bootTraceId;
}

/**
 * @param {string} event
 * @param {object} [data]
 */
export function recordBootstrapEvent(event, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    trace_id: bootTraceId,
    event,
    status: data.status || 'ok',
    message: data.message || null,
    phase: data.phase || null,
    model: data.model || null,
    ...data,
  };

  events.unshift(entry);
  while (events.length > MAX_EVENTS) events.pop();

  console.log(
    JSON.stringify({
      timestamp: entry.timestamp,
      level: entry.status === 'error' ? 'error' : 'info',
      trace_id: bootTraceId,
      event,
      status: entry.status,
      message: entry.message,
      phase: entry.phase,
      model: entry.model,
      source: 'bootstrap',
    }),
  );

  return entry;
}

export function getBootstrapDiagnostics() {
  return {
    boot_trace_id: bootTraceId,
    events: [...events],
  };
}

export default {
  initBootstrapDiagnostics,
  getBootTraceId,
  recordBootstrapEvent,
  getBootstrapDiagnostics,
};
