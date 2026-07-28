import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockBrowserLauncher,
  withBrowserSession,
} from '../src/services/browser-harness/browserSessionService.js';
import { validateObserveInput } from '../src/services/browser-harness/browserHarnessContract.js';
import {
  observePage,
  navigateToUrl,
  extractComputedStyles,
} from '../src/services/browser-harness/browserObservationService.js';
import {
  summarizeComputedStyles,
  capStyleSamples,
  MAX_STYLE_SAMPLES,
} from '../src/services/browser-harness/browserStyleSampler.js';

function createObservationMockPage(overrides = {}) {
  const state = { url: overrides.initialUrl || 'about:blank' };

  return {
    url: () => state.url,
    isClosed: () => false,
    close: async () => {},
    goto: async (targetUrl, _options) => {
      if (overrides.gotoError) throw overrides.gotoError;
      if (overrides.gotoStatus >= 400) {
        state.url = targetUrl;
        return { status: () => overrides.gotoStatus };
      }
      state.url = targetUrl;
      return { status: () => overrides.gotoStatus ?? 200 };
    },
    title: async () => overrides.title || 'Nexxus Studio Mock',
    content: async () => overrides.html || '<html><body><button class="btn-primary">Go</button></body></html>',
    mockHtml: overrides.html,
    mockTitle: overrides.title,
    mockNodeCount: overrides.nodeCount ?? 12,
    queryComputedStyles:
      overrides.queryComputedStyles ??
      (async () => [
      {
        selector: 'button.btn-primary',
        tag: 'button',
        classes: ['btn-primary'],
        styles: {
          color: 'rgb(255, 255, 255)',
          'background-color': 'rgb(99, 102, 241)',
          'font-family': 'Inter, sans-serif',
          'font-size': '16px',
        },
      },
      {
        selector: 'body',
        tag: 'body',
        classes: [],
        styles: {
          color: 'rgb(15, 23, 42)',
          'background-color': 'rgb(248, 250, 252)',
        },
      },
    ]),
    ...(overrides.pageExtras || {}),
  };
}

function mockLauncherFromPage(page) {
  return async () => ({
    ok: true,
    browser: { isConnected: () => true, close: async () => {} },
    page,
    engine: 'mock/chromium',
  });
}

test('summarizeComputedStyles: agrège couleurs et fonts', () => {
  const summary = summarizeComputedStyles([
    { styles: { color: 'rgb(15, 23, 42)', 'font-family': 'Inter, sans-serif' } },
    { styles: { 'background-color': 'rgb(99, 102, 241)' } },
  ]);
  assert.equal(summary.samples_count, 2);
  assert.ok(summary.unique_colors >= 2);
  assert.equal(summary.unique_font_families, 1);
});

test('capStyleSamples: limite à 120 nœuds', () => {
  const samples = Array.from({ length: 200 }, (_, index) => ({ id: index }));
  assert.equal(capStyleSamples(samples).length, MAX_STYLE_SAMPLES);
});

test('navigateToUrl: navigation OK', async () => {
  const page = createObservationMockPage();
  const launch = mockLauncherFromPage(page);
  const wrapped = await withBrowserSession({ browserLauncher: launch }, async (session) => {
    return navigateToUrl(session, 'http://127.0.0.1:5173/');
  });

  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.result.response_status, 200);
  assert.match(wrapped.result.final_url, /5173/);
});

test('navigateToUrl: page inaccessible HTTP 404', async () => {
  const page = createObservationMockPage({ gotoStatus: 404 });
  const wrapped = await withBrowserSession({ browserLauncher: mockLauncherFromPage(page) }, async (session) =>
    navigateToUrl(session, 'http://127.0.0.1:5173/missing'),
  );

  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.result.ok, false);
  assert.equal(wrapped.result.refusal.code, 'NAVIGATION_FAILED');
});

test('extractComputedStyles: styles partiels acceptés', async () => {
  const page = createObservationMockPage({
    queryComputedStyles: async () => [
      {
        selector: 'body',
        tag: 'body',
        classes: [],
        styles: { color: 'rgb(51, 51, 51)' },
      },
    ],
  });

  const wrapped = await withBrowserSession({ browserLauncher: mockLauncherFromPage(page) }, async (session) =>
    extractComputedStyles(session),
  );

  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.result.computed_styles.length, 1);
  assert.ok(wrapped.result.uncertainties.some((note) => /partiel/i.test(note)));
});

test('extractComputedStyles: timeout observation', async () => {
  const page = createObservationMockPage({
    queryComputedStyles: () =>
      new Promise((resolve) => {
        setTimeout(() => resolve([]), 200);
      }),
  });

  const wrapped = await withBrowserSession({ browserLauncher: mockLauncherFromPage(page) }, async (session) =>
    extractComputedStyles(session, { extractTimeoutMs: 30 }),
  );

  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.result.ok, false);
  assert.equal(wrapped.result.refusal.code, 'OBSERVATION_TIMEOUT');
});

test('observePage: pipeline complet avec événements', async () => {
  const steps = [];
  const page = createObservationMockPage();
  const input = validateObserveInput({
    url: 'http://127.0.0.1:5173/',
    traceId: 'trace-observe-c3',
  });
  assert.equal(input.ok, true);

  const wrapped = await withBrowserSession(
    { traceId: 'trace-observe-c3', browserLauncher: mockLauncherFromPage(page) },
    async (session) =>
      observePage(session, input.normalized, {
        onStep: (entry) => steps.push(entry.step),
      }),
  );

  assert.equal(wrapped.ok, true);
  assert.ok(wrapped.result.observation.computed_styles.length >= 2);
  assert.equal(wrapped.result.observation.style_summary.samples_count, 2);
  assert.ok(steps.includes('browser.observe.navigate'));
  assert.ok(steps.includes('browser.observe.snapshot'));
  assert.ok(steps.includes('browser.observe.styles'));
  assert.ok(steps.includes('browser.observe.pack'));
});

test('withBrowserSession: fermeture garantie après échec navigation', async () => {
  const page = createObservationMockPage({
    gotoError: Object.assign(new Error('Timeout navigation mock'), { code: 'NAVIGATION_TIMEOUT' }),
  });

  let sessionRef = null;
  const wrapped = await withBrowserSession({ browserLauncher: mockLauncherFromPage(page) }, async (session) => {
    sessionRef = session;
    return navigateToUrl(session, 'http://127.0.0.1:5173/');
  });

  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.result.ok, false);
  assert.equal(sessionRef.ctx.isClosed(), true);
});
