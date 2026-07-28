/**
 * Observation browser — navigation, snapshot DOM, getComputedStyle (C3).
 */
import {
  BROWSER_NAVIGATION_TIMEOUT_MS,
  BROWSER_DOM_STABLE_TIMEOUT_MS,
} from './browserPolicy.js';
import { logBrowserHarnessEvent } from './browserHarnessObservability.js';
import { assertSessionWithinTimeout } from './browserSessionService.js';
import {
  STYLE_SAMPLE_SELECTORS,
  COMPUTED_STYLE_PROPS,
  capStyleSamples,
  summarizeComputedStyles,
  inferStyleHint,
} from './browserStyleSampler.js';

function emitStep(onStep, entry) {
  onStep?.(entry);
  logBrowserHarnessEvent(entry.status === 'error' ? 'error' : 'info', entry);
}

function navigationRefusal(code, message, session) {
  return {
    ok: false,
    refusal: { code, message },
    trace_id: session.trace_id,
    browser_session_id: session.browser_session_id,
  };
}

/**
 * @param {object} session
 * @param {string} url
 * @param {object} [options]
 */
export async function navigateToUrl(session, url, options = {}) {
  const onStep = options.onStep;
  assertSessionWithinTimeout(session);

  emitStep(onStep, {
    step: 'browser.observe.navigate',
    status: 'running',
    trace_id: session.trace_id,
    browser_session_id: session.browser_session_id,
    job_id: session.job_id,
  });

  const page = session.page;
  if (!page?.goto) {
    return navigationRefusal(
      'PAGE_GOTO_UNSUPPORTED',
      'Page mock sans goto — injecter adapter Playwright ou mock goto.',
      session,
    );
  }

  try {
    const response = await page.goto(url, {
      timeout: options.timeoutMs || BROWSER_NAVIGATION_TIMEOUT_MS,
      waitUntil: options.waitUntil || 'domcontentloaded',
    });

    const status =
      typeof response?.status === 'function'
        ? response.status()
        : response?.status ?? 200;

    if (status >= 400) {
      emitStep(onStep, {
        step: 'browser.observe.navigate',
        status: 'error',
        trace_id: session.trace_id,
        browser_session_id: session.browser_session_id,
        code: 'NAVIGATION_FAILED',
        message: `HTTP ${status}`,
      });
      return navigationRefusal('NAVIGATION_FAILED', `Navigation refusée — HTTP ${status}.`, session);
    }

    const final_url = typeof page.url === 'function' ? page.url() : url;
    emitStep(onStep, {
      step: 'browser.observe.navigate',
      status: 'ok',
      trace_id: session.trace_id,
      browser_session_id: session.browser_session_id,
      response_status: status,
      final_url,
    });

    return { ok: true, response_status: status, final_url };
  } catch (error) {
    const isTimeout = /timeout/i.test(error.message || '');
    const code = isTimeout ? 'NAVIGATION_TIMEOUT' : 'NAVIGATION_FAILED';
    emitStep(onStep, {
      step: 'browser.observe.navigate',
      status: 'error',
      trace_id: session.trace_id,
      browser_session_id: session.browser_session_id,
      code,
      message: error.message,
    });
    return navigationRefusal(code, error.message || 'Navigation échouée.', session);
  }
}

/**
 * @param {object} session
 * @param {object} [options]
 */
export async function captureDomSnapshot(session, options = {}) {
  const onStep = options.onStep;
  assertSessionWithinTimeout(session);

  emitStep(onStep, {
    step: 'browser.observe.snapshot',
    status: 'running',
    trace_id: session.trace_id,
    browser_session_id: session.browser_session_id,
  });

  const page = session.page;
  let title = '';
  let html = '';

  if (typeof page.title === 'function') {
    title = await page.title();
  }
  if (typeof page.content === 'function') {
    html = await page.content();
  } else if (typeof page.evaluate === 'function') {
    html = await page.evaluate(() => document.documentElement.outerHTML);
  } else if (page.mockHtml) {
    html = page.mockHtml;
    title = page.mockTitle || title;
  }

  const dom_snapshot = {
    title: title || null,
    html_bytes: html.length,
    node_count_estimate: page.mockNodeCount ?? Math.max(1, Math.floor(html.length / 120)),
  };

  emitStep(onStep, {
    step: 'browser.observe.snapshot',
    status: 'ok',
    trace_id: session.trace_id,
    browser_session_id: session.browser_session_id,
    html_bytes: dom_snapshot.html_bytes,
  });

  return { ok: true, dom_snapshot, html };
}

/**
 * Extraction styles via page.queryComputedStyles (mock) ou page.$$eval (Playwright futur).
 * @param {object} session
 * @param {object} [options]
 */
export async function extractComputedStyles(session, options = {}) {
  const onStep = options.onStep;
  assertSessionWithinTimeout(session);

  emitStep(onStep, {
    step: 'browser.observe.styles',
    status: 'running',
    trace_id: session.trace_id,
    browser_session_id: session.browser_session_id,
  });

  const page = session.page;
  const selectors = options.selectors || STYLE_SAMPLE_SELECTORS;
  const props = options.props || COMPUTED_STYLE_PROPS;
  const uncertainties = [];
  let rawSamples = [];

  const extractTimeoutMs = options.extractTimeoutMs || BROWSER_DOM_STABLE_TIMEOUT_MS;

  const extractPromise = (async () => {
    if (typeof page.queryComputedStyles === 'function') {
      return page.queryComputedStyles({ selectors, props });
    }

    if (typeof page.$$eval === 'function') {
      return page.$$eval(
        selectors.join(','),
        (elements, styleProps) =>
          elements.map((element) => {
            const computed = getComputedStyle(element);
            const styles = {};
            for (const prop of styleProps) {
              styles[prop] = computed.getPropertyValue(prop);
            }
            return {
              selector: element.tagName.toLowerCase(),
              tag: element.tagName.toLowerCase(),
              classes: [...element.classList],
              styles,
            };
          }),
        props,
      );
    }

    uncertainties.push('Extraction styles non supportée — adapter page manquant.');
    return [];
  })();

  try {
    rawSamples = await Promise.race([
      extractPromise,
      new Promise((_, reject) => {
        setTimeout(
          () => reject(Object.assign(new Error('Timeout extraction styles.'), { code: 'OBSERVATION_TIMEOUT' })),
          extractTimeoutMs,
        ).unref?.();
      }),
    ]);
  } catch (error) {
    if (error.code === 'OBSERVATION_TIMEOUT') {
      emitStep(onStep, {
        step: 'browser.observe.styles',
        status: 'error',
        trace_id: session.trace_id,
        browser_session_id: session.browser_session_id,
        code: 'OBSERVATION_TIMEOUT',
        message: error.message,
      });
      return {
        ok: false,
        refusal: { code: 'OBSERVATION_TIMEOUT', message: error.message },
        trace_id: session.trace_id,
        browser_session_id: session.browser_session_id,
      };
    }
    uncertainties.push(`Extraction partielle : ${error.message}`);
  }

  const enriched = capStyleSamples(
    (rawSamples || []).map((sample) => ({
      ...sample,
      hint:
        sample.hint ||
        inferStyleHint(sample.selector, sample.tag, (sample.classes || []).join(' ')),
    })),
  );

  if (enriched.length === 0) {
    uncertainties.push('Aucun style calculé — DOM vide ou sélecteurs non matchés.');
  } else if (enriched.length < 5) {
    uncertainties.push('Styles partiels — échantillon limité.');
  }

  const style_summary = summarizeComputedStyles(enriched);

  emitStep(onStep, {
    step: 'browser.observe.styles',
    status: 'ok',
    trace_id: session.trace_id,
    browser_session_id: session.browser_session_id,
    samples_count: style_summary.samples_count,
  });

  return {
    ok: true,
    computed_styles: enriched,
    style_summary,
    uncertainties,
    partial: uncertainties.length > 0,
  };
}

/**
 * Pipeline observation complet sur session active.
 * @param {object} session
 * @param {object} observeRequest — sortie validateObserveInput.normalized
 * @param {object} [options]
 */
export async function observePage(session, observeRequest = {}, options = {}) {
  const onStep = options.onStep;
  const startedAt = Date.now();
  const uncertainties = [];

  const navigation = await navigateToUrl(session, observeRequest.url, { onStep });
  if (!navigation.ok) {
    return navigation;
  }

  if (options.waitForStable !== false && typeof session.page?.waitForLoadState === 'function') {
    emitStep(onStep, {
      step: 'browser.observe.wait',
      status: 'running',
      trace_id: session.trace_id,
      browser_session_id: session.browser_session_id,
    });
    try {
      await session.page.waitForLoadState('networkidle', {
        timeout: options.networkIdleTimeoutMs || 4_000,
      });
      emitStep(onStep, {
        step: 'browser.observe.wait',
        status: 'ok',
        trace_id: session.trace_id,
        browser_session_id: session.browser_session_id,
      });
    } catch {
      uncertainties.push('DOM stable partiel — networkidle non atteint.');
      emitStep(onStep, {
        step: 'browser.observe.wait',
        status: 'warn',
        trace_id: session.trace_id,
        browser_session_id: session.browser_session_id,
        message: 'networkidle skipped',
      });
    }
  }

  const snapshot = await captureDomSnapshot(session, { onStep });
  const styles = await extractComputedStyles(session, { onStep, ...options });

  if (!styles.ok) {
    return styles;
  }

  uncertainties.push(...(styles.uncertainties || []));

  const observation = {
    url: observeRequest.url,
    final_url: navigation.final_url,
    response_status: navigation.response_status,
    observed_at: new Date().toISOString(),
    viewport: observeRequest.viewport || session.viewport,
    dom_snapshot: snapshot.dom_snapshot,
    html: snapshot.html || null,
    computed_styles: styles.computed_styles,
    style_summary: styles.style_summary,
    uncertainties,
    duration_ms: Date.now() - startedAt,
    engine: session.engine,
    browser_session_id: session.browser_session_id,
  };

  emitStep(onStep, {
    step: 'browser.observe.pack',
    status: 'ok',
    trace_id: session.trace_id,
    browser_session_id: session.browser_session_id,
    samples_count: styles.style_summary.samples_count,
  });

  return {
    ok: true,
    observation,
    trace_id: session.trace_id,
    browser_session_id: session.browser_session_id,
    job_id: session.job_id,
  };
}

export default {
  navigateToUrl,
  captureDomSnapshot,
  extractComputedStyles,
  observePage,
};
