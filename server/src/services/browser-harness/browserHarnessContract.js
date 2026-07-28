/**
 * Contrats Browser Harness — validateObserveInput, envelope, refus normalisés.
 */
import {
  BROWSER_HARNESS_SKILL_ID,
  BROWSER_EGRESS_POLICIES,
  BROWSER_OPERATION_MODES,
  BROWSER_DEFAULT_VIEWPORT,
  validateBrowserNavigationUrl,
  validateBrowserActionList,
  validateBrowserViewport,
  validateBrowserSessionPolicy,
} from './browserPolicy.js';
import { createBrowserCorrelationIds } from './browserHarnessObservability.js';

export const BROWSER_HARNESS_INTENT = 'WEB_OBSERVE';

export const OBSERVATION_ENVELOPE_VERSION = '1.0.0';

export const OBSERVATION_ENVELOPE_KIND = 'nexxus.browser.observation_result';

/**
 * @param {string} code
 * @param {string} message
 */
export function normalizeBrowserViolation(code, message) {
  return {
    code: String(code || 'BROWSER_REFUSED'),
    message: String(message || 'Opération browser refusée.'),
  };
}

/**
 * @param {object} input
 * @param {string} [input.url]
 * @param {string} [input.egressPolicy]
 * @param {string} [input.mode]
 * @param {string[]} [input.requestedActions]
 * @param {object} [input.viewport]
 * @param {boolean} [input.captureScreenshot]
 * @param {boolean} [input.async]
 * @param {string} [input.traceId]
 * @param {string} [input.jobId]
 */
export function validateObserveInput(input = {}) {
  const violations = [];
  const url = String(input.url || '').trim();
  const egressPolicy = input.egressPolicy || 'local-only';
  const mode = input.mode || 'observe';
  const requestedActions = input.requestedActions || ['navigate', 'snapshot', 'styles', 'close'];

  if (!url) {
    violations.push(normalizeBrowserViolation('URL_REQUIRED', 'URL requise pour observation browser.'));
  }

  if (!BROWSER_EGRESS_POLICIES.includes(egressPolicy)) {
    violations.push(
      normalizeBrowserViolation(
        'EGRESS_POLICY_INVALID',
        `Politique egress « ${egressPolicy} » non autorisée.`,
      ),
    );
  }

  if (!BROWSER_OPERATION_MODES.includes(mode)) {
    violations.push(
      normalizeBrowserViolation('MODE_FORBIDDEN', `Mode « ${mode} » non autorisé en Phase C.`),
    );
  }

  const viewportCheck = validateBrowserViewport(input.viewport || BROWSER_DEFAULT_VIEWPORT);
  if (!viewportCheck.ok) {
    violations.push(normalizeBrowserViolation(viewportCheck.code, viewportCheck.message));
  }

  const actionCheck = validateBrowserActionList(requestedActions, mode);
  if (!actionCheck.ok) {
    violations.push(normalizeBrowserViolation(actionCheck.code, actionCheck.message));
  }

  const downloadCheck = validateBrowserSessionPolicy({ intent: 'download' });
  if (input.allowDownload === true && !downloadCheck.ok) {
    violations.push(normalizeBrowserViolation(downloadCheck.code, downloadCheck.message));
  }

  const uploadCheck = validateBrowserSessionPolicy({ intent: 'upload' });
  if (input.allowUpload === true && !uploadCheck.ok) {
    violations.push(normalizeBrowserViolation(uploadCheck.code, uploadCheck.message));
  }

  let resolvedUrl = url;
  if (url && violations.length === 0) {
    const egress = validateBrowserNavigationUrl(url, egressPolicy);
    if (!egress.ok) {
      violations.push(normalizeBrowserViolation(egress.code, egress.message));
    } else {
      resolvedUrl = egress.url;
    }
  }

  const correlation = createBrowserCorrelationIds({
    traceId: input.traceId,
    jobId: input.jobId,
  });

  return {
    ok: violations.length === 0,
    violations,
    normalized: violations.length
      ? null
      : {
          url: resolvedUrl,
          egressPolicy,
          mode,
          viewport: viewportCheck.ok ? viewportCheck.viewport : BROWSER_DEFAULT_VIEWPORT,
          captureScreenshot: Boolean(input.captureScreenshot),
          async: Boolean(input.async),
          requestedActions,
          ...correlation,
        },
  };
}

/**
 * @param {object} payload
 */
export function buildObservationEnvelope(payload = {}) {
  return {
    version: payload.version || OBSERVATION_ENVELOPE_VERSION,
    kind: OBSERVATION_ENVELOPE_KIND,
    skill_id: BROWSER_HARNESS_SKILL_ID,
    source: {
      url: payload.url || null,
      final_url: payload.final_url || payload.url || null,
      observed_at: payload.observed_at || new Date().toISOString(),
      response_status: payload.response_status ?? null,
      viewport: payload.viewport || BROWSER_DEFAULT_VIEWPORT,
    },
    session: {
      browser_session_id: payload.browser_session_id || null,
      trace_id: payload.trace_id || null,
      job_id: payload.job_id || null,
      duration_ms: payload.duration_ms ?? null,
      engine: payload.engine || 'chromium/playwright',
    },
    dom_snapshot: payload.dom_snapshot || null,
    computed_styles: payload.computed_styles || [],
    style_summary: payload.style_summary || {
      samples_count: 0,
      unique_colors: 0,
      unique_font_families: 0,
    },
    artifacts: payload.artifacts || {
      observation_json: null,
      screenshot_png: null,
      dom_html: null,
    },
    uncertainties: payload.uncertainties || [],
    generated_at: new Date().toISOString(),
  };
}

/**
 * @param {object} refusal
 */
export function buildBrowserRefusal(refusal = {}) {
  const correlation = createBrowserCorrelationIds({
    traceId: refusal.trace_id,
    jobId: refusal.job_id,
    browserSessionId: refusal.browser_session_id,
  });

  return {
    ok: false,
    refusal: normalizeBrowserViolation(refusal.code, refusal.message),
    trace_id: correlation.trace_id,
    browser_session_id: correlation.browser_session_id,
    job_id: correlation.job_id,
  };
}

export default {
  BROWSER_HARNESS_SKILL_ID,
  BROWSER_HARNESS_INTENT,
  OBSERVATION_ENVELOPE_VERSION,
  OBSERVATION_ENVELOPE_KIND,
  normalizeBrowserViolation,
  validateObserveInput,
  buildObservationEnvelope,
  buildBrowserRefusal,
};
