/**
 * Corrélation et logs structurés — Browser Harness Phase C.
 */
import crypto from 'node:crypto';
import { BROWSER_HARNESS_SKILL_ID } from './browserPolicy.js';

/**
 * @param {object} [options]
 * @param {string} [options.traceId]
 * @param {string} [options.jobId]
 * @param {string} [options.browserSessionId]
 */
export function createBrowserCorrelationIds(options = {}) {
  const trace_id = options.traceId || crypto.randomUUID();
  const browser_session_id =
    options.browserSessionId ||
    `bsess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job_id = options.jobId || null;

  return {
    trace_id,
    browser_session_id,
    job_id,
    skill_id: BROWSER_HARNESS_SKILL_ID,
  };
}

/**
 * @param {object} entry
 */
export function buildBrowserHarnessLog(entry = {}) {
  const timestamp = new Date().toISOString();
  return {
    ts: timestamp,
    component: 'browser-harness',
    skill_id: BROWSER_HARNESS_SKILL_ID,
    trace_id: entry.trace_id || null,
    browser_session_id: entry.browser_session_id || null,
    job_id: entry.job_id || null,
    step: entry.step || null,
    status: entry.status || 'info',
    code: entry.code || null,
    message: entry.message || null,
    ...entry.extra,
  };
}

/**
 * @param {'info'|'warn'|'error'} level
 * @param {object} entry
 */
export function logBrowserHarnessEvent(level, entry = {}) {
  const payload = buildBrowserHarnessLog(entry);
  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  return payload;
}

/**
 * Contexte session minimal pour garantir fermeture traçable.
 * @param {object} correlation
 */
export function createBrowserSessionContext(correlation = {}) {
  let closed = false;
  const started_at = Date.now();

  return {
    ...correlation,
    started_at,
    isClosed: () => closed,
    markClosed: (reason = 'normal') => {
      closed = true;
      logBrowserHarnessEvent('info', {
        step: 'browser.observe.close',
        status: 'ok',
        trace_id: correlation.trace_id,
        browser_session_id: correlation.browser_session_id,
        job_id: correlation.job_id,
        message: reason,
      });
      return {
        closed: true,
        reason,
        duration_ms: Date.now() - started_at,
      };
    },
    logRefusal: (refusal = {}) => {
      logBrowserHarnessEvent('warn', {
        step: refusal.step || 'browser.observe.validate',
        status: 'refused',
        trace_id: correlation.trace_id,
        browser_session_id: correlation.browser_session_id,
        job_id: correlation.job_id,
        code: refusal.code,
        message: refusal.message,
      });
    },
  };
}

export default {
  createBrowserCorrelationIds,
  buildBrowserHarnessLog,
  logBrowserHarnessEvent,
  createBrowserSessionContext,
};
