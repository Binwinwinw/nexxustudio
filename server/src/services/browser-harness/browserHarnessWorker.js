/**
 * Worker Browser Harness — orchestration observePage → envelope → artefacts.
 */
import { validateObserveInput, buildObservationEnvelope } from './browserHarnessContract.js';
import { withBrowserSession } from './browserSessionService.js';
import { observePage } from './browserObservationService.js';
import {
  writeBrowserTraceArtifacts,
  resolveBrowserSessionArtifactDir,
} from './browserTraceArtifacts.js';

export const BROWSER_HARNESS_STEPS = [
  'browser.observe.validate',
  'browser.observe.launch',
  'browser.observe.navigate',
  'browser.observe.wait',
  'browser.observe.snapshot',
  'browser.observe.styles',
  'browser.observe.screenshot',
  'browser.observe.close',
  'browser.observe.pack',
];

/**
 * @param {object} options
 * @param {string} [options.url]
 * @param {string} [options.egressPolicy]
 * @param {object} [options.viewport]
 * @param {boolean} [options.captureScreenshot]
 * @param {string} [options.traceId]
 * @param {string} [options.jobId]
 * @param {string} [options.browserSessionId]
 * @param {string} [options.outputDir]
 * @param {Function} [options.browserLauncher]
 * @param {Function} [options.onStep]
 * @param {Function} [options.observePageRunner]
 */
export async function runBrowserObserveWorker(options = {}) {
  const {
    url = null,
    egressPolicy = 'local-only',
    viewport = null,
    captureScreenshot = false,
    traceId = null,
    jobId = null,
    browserSessionId = null,
    outputDir = null,
    browserLauncher = undefined,
    onStep,
    observePageRunner = observePage,
    ...observeOptions
  } = options;

  const events = [];
  const emit = (entry = {}) => {
    const evt = {
      ...entry,
      trace_id: entry.trace_id || traceId || null,
      job_id: entry.job_id || jobId || null,
      eventIndex: events.length,
    };
    events.push(evt);
    onStep?.(evt);
  };

  emit({ step: 'browser.observe.validate', status: 'running' });

  const inputCheck = validateObserveInput({
    url,
    egressPolicy,
    viewport,
    captureScreenshot,
    traceId,
    jobId,
  });

  if (!inputCheck.ok) {
    emit({
      step: 'browser.observe.validate',
      status: 'error',
      violations: inputCheck.violations,
    });
    return {
      ok: false,
      trace_id: traceId,
      job_id: jobId,
      violations: inputCheck.violations,
      events,
    };
  }

  const normalized = {
    ...inputCheck.normalized,
    trace_id: inputCheck.normalized.trace_id,
    job_id: jobId || inputCheck.normalized.job_id,
  };

  if (browserSessionId) {
    normalized.browser_session_id = browserSessionId;
  }

  emit({ step: 'browser.observe.validate', status: 'ok' });

  const startedAt = Date.now();
  const sessionOutcome = await withBrowserSession(
    {
      traceId: normalized.trace_id,
      jobId: normalized.job_id,
      browserSessionId: normalized.browser_session_id,
      viewport: normalized.viewport,
      browserLauncher,
    },
    async (session, helpers) => {
      helpers.assertWithinTimeout();
      return observePageRunner(session, normalized, {
        ...observeOptions,
        onStep: emit,
      });
    },
  );

  if (!sessionOutcome.ok) {
    emit({
      step: 'browser.observe.pack',
      status: 'error',
      code: sessionOutcome.refusal?.code,
      message: sessionOutcome.refusal?.message,
      browser_session_id: sessionOutcome.browser_session_id,
    });
    return {
      ok: false,
      trace_id: sessionOutcome.trace_id || normalized.trace_id,
      browser_session_id: sessionOutcome.browser_session_id,
      job_id: jobId,
      refusal: sessionOutcome.refusal,
      events,
    };
  }

  const observeResult = sessionOutcome.result;
  if (!observeResult?.ok) {
    emit({
      step: 'browser.observe.pack',
      status: 'error',
      code: observeResult.refusal?.code,
      message: observeResult.refusal?.message,
      browser_session_id: sessionOutcome.browser_session_id,
    });
    return {
      ok: false,
      trace_id: sessionOutcome.trace_id,
      browser_session_id: sessionOutcome.browser_session_id,
      job_id: jobId,
      refusal: observeResult.refusal,
      events,
    };
  }

  const observation = observeResult.observation;
  const duration_ms = Date.now() - startedAt;

  const envelope = buildObservationEnvelope({
    url: normalized.url,
    final_url: observation.final_url,
    observed_at: observation.observed_at,
    response_status: observation.response_status,
    viewport: observation.viewport,
    browser_session_id: sessionOutcome.browser_session_id,
    trace_id: sessionOutcome.trace_id,
    job_id: jobId,
    duration_ms,
    engine: observation.engine,
    dom_snapshot: observation.dom_snapshot,
    computed_styles: observation.computed_styles,
    style_summary: observation.style_summary,
    uncertainties: observation.uncertainties,
    artifacts: {
      observation_json: null,
      screenshot_png: null,
      dom_html: null,
    },
  });

  let artifacts = null;
  const artifactDir =
    outputDir || resolveBrowserSessionArtifactDir(sessionOutcome.browser_session_id);

  artifacts = await writeBrowserTraceArtifacts(artifactDir, envelope, {
    events,
    computed_styles: observation.computed_styles,
  });

  envelope.artifacts = {
    observation_json: artifacts.files.observation_json,
    computed_styles_json: artifacts.files.computed_styles_json,
    trace_jsonl: artifacts.files.trace_jsonl,
    screenshot_png: null,
    dom_html: null,
  };

  emit({
    step: 'browser.observe.pack',
    status: 'ok',
    browser_session_id: sessionOutcome.browser_session_id,
    samples_count: observation.style_summary?.samples_count,
  });

  return {
    ok: true,
    trace_id: sessionOutcome.trace_id,
    browser_session_id: sessionOutcome.browser_session_id,
    job_id: jobId,
    envelope,
    observation,
    artifacts,
    events,
  };
}

export default runBrowserObserveWorker;
