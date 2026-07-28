/**
 * Cycle de vie session Browser Harness — launch, close, withSession (finally garanti).
 * C2 : mockable ; Playwright réel branché en C3 via browserLauncher injectable.
 */
import {
  BROWSER_SESSION_LIMITS,
  BROWSER_DEFAULT_VIEWPORT,
  validateBrowserSessionTimeout,
} from './browserPolicy.js';
import {
  createBrowserCorrelationIds,
  createBrowserSessionContext,
  logBrowserHarnessEvent,
} from './browserHarnessObservability.js';

/**
 * Lanceur par défaut — fail-closed tant que Playwright n'est pas câblé (C3).
 */
export async function defaultBrowserLauncher() {
  return {
    ok: false,
    code: 'CHROMIUM_UNAVAILABLE',
    message:
      'Chromium indisponible — injecter browserLauncher (mock tests ou Playwright C3).',
  };
}

/**
 * Mock CI — browser + page sans Chromium.
 */
export function createMockBrowserLauncher(overrides = {}) {
  let browserClosed = false;
  let pageClosed = false;

  const browser = {
    isConnected: () => !browserClosed,
    close: async () => {
      browserClosed = true;
    },
    ...overrides.browser,
  };

  const page = {
    url: () => overrides.url || 'http://127.0.0.1:5173/',
    close: async () => {
      pageClosed = true;
    },
    isClosed: () => pageClosed,
    ...overrides.page,
  };

  return async () => ({
    ok: true,
    browser,
    page,
  });
}

/**
 * @param {object} options
 * @param {string} [options.traceId]
 * @param {string} [options.jobId]
 * @param {string} [options.browserSessionId]
 * @param {object} [options.viewport]
 * @param {Function} [options.browserLauncher]
 */
export async function launchBrowserSession(options = {}) {
  const correlation = createBrowserCorrelationIds({
    traceId: options.traceId,
    jobId: options.jobId,
    browserSessionId: options.browserSessionId,
  });

  const ctx = createBrowserSessionContext(correlation);
  const viewport = options.viewport || BROWSER_DEFAULT_VIEWPORT;
  const browserLauncher = options.browserLauncher || defaultBrowserLauncher;

  logBrowserHarnessEvent('info', {
    step: 'browser.observe.launch',
    status: 'running',
    trace_id: correlation.trace_id,
    browser_session_id: correlation.browser_session_id,
    job_id: correlation.job_id,
  });

  let launched;
  try {
    launched = await browserLauncher({
      viewport,
      correlation,
      limits: BROWSER_SESSION_LIMITS,
    });
  } catch (error) {
    logBrowserHarnessEvent('error', {
      step: 'browser.observe.launch',
      status: 'error',
      trace_id: correlation.trace_id,
      browser_session_id: correlation.browser_session_id,
      job_id: correlation.job_id,
      code: 'LAUNCH_FAILED',
      message: error.message,
    });
    return {
      ok: false,
      refusal: {
        code: 'LAUNCH_FAILED',
        message: error.message || 'Échec lancement session browser.',
      },
      trace_id: correlation.trace_id,
      browser_session_id: correlation.browser_session_id,
    };
  }

  if (!launched?.ok) {
    const refusal = {
      code: launched?.code || 'CHROMIUM_UNAVAILABLE',
      message: launched?.message || 'Session browser non démarrée.',
    };
    ctx.logRefusal({ step: 'browser.observe.launch', ...refusal });
    return {
      ok: false,
      refusal,
      trace_id: correlation.trace_id,
      browser_session_id: correlation.browser_session_id,
    };
  }

  const session = {
    ...correlation,
    ctx,
    browser: launched.browser,
    page: launched.page,
    viewport,
    pageCount: 1,
    launched_at: Date.now(),
    engine: launched.engine || 'mock/chromium',
  };

  logBrowserHarnessEvent('info', {
    step: 'browser.observe.launch',
    status: 'ok',
    trace_id: correlation.trace_id,
    browser_session_id: correlation.browser_session_id,
    job_id: correlation.job_id,
    message: session.engine,
  });

  return { ok: true, session };
}

/**
 * @param {object} session
 * @param {string} [reason='normal']
 */
export async function closeBrowserSession(session, reason = 'normal') {
  if (!session) {
    return { closed: false, reason: 'no_session' };
  }

  if (session.ctx?.isClosed?.()) {
    return { closed: true, reason: 'already_closed', idempotent: true };
  }

  const errors = [];

  if (session.page?.close && !session.page.isClosed?.()) {
    try {
      await session.page.close();
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (session.browser?.close && session.browser.isConnected?.()) {
    try {
      await session.browser.close();
    } catch (error) {
      errors.push(error.message);
    }
  }

  const closeMeta = session.ctx.markClosed(reason);

  if (errors.length > 0) {
    logBrowserHarnessEvent('warn', {
      step: 'browser.observe.close',
      status: 'partial',
      trace_id: session.trace_id,
      browser_session_id: session.browser_session_id,
      job_id: session.job_id,
      message: errors.join('; '),
    });
  }

  return {
    ...closeMeta,
    errors,
  };
}

/**
 * Vérifie timeout session avant opération.
 * @param {object} session
 */
export function assertSessionWithinTimeout(session) {
  const elapsed = Date.now() - (session.launched_at || Date.now());
  const check = validateBrowserSessionTimeout(elapsed);
  if (!check.ok) {
    const error = new Error(check.message);
    error.code = check.code;
    throw error;
  }
  return elapsed;
}

/**
 * Exécute un runner avec session garantie fermée en finally.
 * @param {object} options
 * @param {Function} runner — async (session, helpers) => result
 */
export async function withBrowserSession(options, runner) {
  const launch = await launchBrowserSession(options);
  if (!launch.ok) {
    return {
      ok: false,
      refusal: launch.refusal,
      trace_id: launch.trace_id,
      browser_session_id: launch.browser_session_id,
    };
  }

  const { session } = launch;
  let runnerError = null;
  let runnerResult = null;

  try {
    runnerResult = await runner(session, {
      assertWithinTimeout: () => assertSessionWithinTimeout(session),
    });
  } catch (error) {
    runnerError = error;
  } finally {
    const closeReason = runnerError
      ? runnerError.code === 'SESSION_TIMEOUT'
        ? 'timeout'
        : 'error'
      : 'normal';
    await closeBrowserSession(session, closeReason);
  }

  if (runnerError) {
    return {
      ok: false,
      refusal: {
        code: runnerError.code || 'SESSION_ERROR',
        message: runnerError.message || 'Erreur session browser.',
      },
      trace_id: session.trace_id,
      browser_session_id: session.browser_session_id,
    };
  }

  return {
    ok: true,
    trace_id: session.trace_id,
    browser_session_id: session.browser_session_id,
    job_id: session.job_id,
    result: runnerResult,
  };
}

export default {
  defaultBrowserLauncher,
  createMockBrowserLauncher,
  launchBrowserSession,
  closeBrowserSession,
  assertSessionWithinTimeout,
  withBrowserSession,
};
