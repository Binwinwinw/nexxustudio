import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import runBrowserObserveWorker from '../src/services/browser-harness/browserHarnessWorker.js';
import { BrowserHarnessJobManager } from '../src/services/browser-harness/BrowserHarnessJobManager.js';
import { OBSERVATION_ENVELOPE_KIND } from '../src/services/browser-harness/browserHarnessContract.js';

function createMockPage(overrides = {}) {
  const state = { url: 'about:blank' };
  return {
    url: () => state.url,
    isClosed: () => false,
    close: async () => {},
    goto: async (targetUrl) => {
      if (overrides.gotoError) throw overrides.gotoError;
      state.url = targetUrl;
      const status = overrides.gotoStatus ?? 200;
      if (status >= 400) return { status: () => status };
      return { status: () => status };
    },
    title: async () => overrides.title || 'Mock Page',
    content: async () => overrides.html || '<html><body><button class="btn">OK</button></body></html>',
    queryComputedStyles:
      overrides.queryComputedStyles ??
      (async () => overrides.styles ?? [
        {
          selector: 'button.btn',
          tag: 'button',
          classes: ['btn'],
          styles: { color: 'rgb(255,255,255)', 'background-color': 'rgb(99,102,241)' },
        },
        {
          selector: 'body',
          tag: 'body',
          classes: [],
          styles: { color: 'rgb(15,23,42)', 'background-color': 'rgb(248,250,252)' },
        },
      ]),
  };
}

function mockLauncher(page) {
  return async () => ({
    ok: true,
    browser: { isConnected: () => true, close: async () => {} },
    page,
    engine: 'mock/chromium',
  });
}

async function tempArtifactRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'browser-harness-c4-'));
}

test('runBrowserObserveWorker: pipeline complet + envelope + artefacts', async () => {
  const artifactRoot = await tempArtifactRoot();
  const steps = [];

  const result = await runBrowserObserveWorker({
    url: 'http://127.0.0.1:5173/',
    traceId: 'trace-worker-c4',
    jobId: 'job-browser-test',
    outputDir: path.join(artifactRoot, 'session-complete'),
    browserLauncher: mockLauncher(createMockPage()),
    onStep: (entry) => steps.push(entry.step),
  });

  assert.equal(result.ok, true);
  assert.equal(result.envelope.kind, OBSERVATION_ENVELOPE_KIND);
  assert.equal(result.envelope.session.trace_id, 'trace-worker-c4');
  assert.equal(result.envelope.session.job_id, 'job-browser-test');
  assert.ok(result.envelope.computed_styles.length >= 2);
  assert.ok(steps.includes('browser.observe.validate'));
  assert.ok(steps.includes('browser.observe.pack'));

  const observationJson = JSON.parse(
    await fs.readFile(result.artifacts.files.observation_json, 'utf8'),
  );
  assert.equal(observationJson.version, '1.0.0');

  const traceRaw = await fs.readFile(result.artifacts.files.trace_jsonl, 'utf8');
  assert.ok(traceRaw.includes('browser.observe.navigate'));
});

test('runBrowserObserveWorker: échec navigation', async () => {
  const result = await runBrowserObserveWorker({
    url: 'http://127.0.0.1:5173/missing',
    browserLauncher: mockLauncher(createMockPage({ gotoStatus: 404 })),
  });

  assert.equal(result.ok, false);
  assert.equal(result.refusal.code, 'NAVIGATION_FAILED');
  assert.ok(result.browser_session_id);
});

test('runBrowserObserveWorker: styles partiels acceptés', async () => {
  const result = await runBrowserObserveWorker({
    url: 'http://127.0.0.1:5173/',
    browserLauncher: mockLauncher(
      createMockPage({
        styles: [
          {
            selector: 'body',
            tag: 'body',
            classes: [],
            styles: { color: 'rgb(51,51,51)' },
          },
        ],
      }),
    ),
  });

  assert.equal(result.ok, true);
  assert.equal(result.envelope.computed_styles.length, 1);
  assert.ok(result.envelope.uncertainties.some((note) => /partiel/i.test(note)));
});

test('runBrowserObserveWorker: timeout pipeline styles', async () => {
  const result = await runBrowserObserveWorker({
    url: 'http://127.0.0.1:5173/',
    browserLauncher: mockLauncher(
      createMockPage({
        queryComputedStyles: () => new Promise((resolve) => setTimeout(() => resolve([]), 200)),
      }),
    ),
    extractTimeoutMs: 30,
  });

  assert.equal(result.ok, false);
  assert.equal(result.refusal.code, 'OBSERVATION_TIMEOUT');
});

test('runBrowserObserveWorker: refuse URL invalide sans session', async () => {
  const result = await runBrowserObserveWorker({
    url: 'https://example.com',
    egressPolicy: 'local-only',
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations?.length > 0);
});

test('BrowserHarnessJobManager: job mocké termine SUCCESS avec envelope', async () => {
  const manager = new BrowserHarnessJobManager({
    workerRunner: async ({ onStep, traceId, jobId }) => {
      onStep?.({ step: 'browser.observe.pack', status: 'ok' });
      return {
        ok: true,
        trace_id: traceId,
        browser_session_id: 'bsess-mock-job',
        job_id: jobId,
        envelope: {
          kind: OBSERVATION_ENVELOPE_KIND,
          version: '1.0.0',
        },
        artifacts: { files: { observation_json: '/tmp/observation.json' } },
        events: [],
      };
    },
  });

  const { jobId, traceId } = manager.startJob({
    url: 'http://127.0.0.1:5173/',
    browserId: 'browser-job-test',
    traceId: 'trace-job-c4',
  });

  await new Promise((resolve) => setTimeout(resolve, 60));

  const job = manager.getJob(jobId);
  assert.ok(job);
  assert.equal(job.status, 'SUCCESS');
  assert.equal(job.traceId, traceId);
  assert.ok(job.events.some((event) => event.done === true));
});
