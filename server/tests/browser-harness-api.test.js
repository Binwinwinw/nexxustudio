import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateObserveInput } from '../src/services/browser-harness/browserHarnessContract.js';
import { BrowserHarnessJobManager } from '../src/services/browser-harness/BrowserHarnessJobManager.js';
import runBrowserObserveWorker from '../src/services/browser-harness/browserHarnessWorker.js';
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

function createMockSseRes() {
  const chunks = [];
  return {
    chunks,
    setHeader: () => {},
    flushHeaders: () => {},
    write: (chunk) => chunks.push(chunk),
    end: () => {},
    on: () => {},
  };
}

function parseSseEvents(chunks) {
  return chunks
    .join('')
    .split('\n\n')
    .filter((block) => block.startsWith('data: ') && !block.includes('[DONE]'))
    .map((block) => JSON.parse(block.replace(/^data: /, '')));
}

async function tempArtifactRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'browser-harness-api-'));
}

async function waitForJob(manager, jobId, { timeoutMs = 3000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = manager.getJob(jobId);
    if (job && job.status !== 'RUNNING') return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return manager.getJob(jobId);
}

test('validateObserveInput: URL publique refusée avant lancement (local-only)', () => {
  const result = validateObserveInput({
    url: 'https://example.com',
    egressPolicy: 'local-only',
  });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((entry) => entry.code === 'EGRESS_LOCAL_ONLY'));
});

test('BrowserHarnessJobManager API: observation nominale — job_id, SSE, artefacts', async () => {
  const artifactRoot = await tempArtifactRoot();
  const manager = new BrowserHarnessJobManager({
    workerRunner: runBrowserObserveWorker,
    artifactRoot,
  });

  const { jobId, traceId } = manager.startJob({
    url: 'http://127.0.0.1:5173/',
    browserId: 'browser-api-nominal',
    traceId: 'trace-api-nominal',
    browserLauncher: mockLauncher(createMockPage()),
  });

  assert.ok(jobId.startsWith('job-browser-'));

  const sseRes = createMockSseRes();
  manager.subscribe(jobId, '0', sseRes, { browserId: 'browser-api-nominal' });

  const job = await waitForJob(manager, jobId);
  assert.equal(job.status, 'SUCCESS');
  assert.ok(job.browserSessionId);

  const status = manager.getJobStatus(jobId);
  assert.equal(status.trace_id, traceId);
  assert.equal(status.browser_session_id, job.browserSessionId);
  assert.ok(status.artifacts?.observation_json);
  assert.match(status.stream_url, new RegExp(`/api/browser/observe/${jobId}/stream`));

  const sseEvents = parseSseEvents(sseRes.chunks);
  assert.ok(sseEvents.some((event) => event.step === 'browser.observe.pack'));
  assert.ok(sseEvents.every((event) => event.trace_id === traceId));
  assert.ok(sseEvents.every((event) => event.job_id === jobId));

  const envelopeEvent = sseEvents.find((event) => event.done === true);
  assert.equal(envelopeEvent.envelope.kind, OBSERVATION_ENVELOPE_KIND);
});

test('BrowserHarnessJobManager API: navigation 404 — NAVIGATION_FAILED + session fermée', async () => {
  const artifactRoot = await tempArtifactRoot();
  const manager = new BrowserHarnessJobManager({
    workerRunner: runBrowserObserveWorker,
    artifactRoot,
  });

  const { jobId } = manager.startJob({
    url: 'http://127.0.0.1:5173/missing',
    browserId: 'browser-api-404',
    traceId: 'trace-api-404',
    browserLauncher: mockLauncher(createMockPage({ gotoStatus: 404 })),
  });

  const job = await waitForJob(manager, jobId);
  assert.equal(job.status, 'FAILED');
  assert.equal(job.refusalCode, 'NAVIGATION_FAILED');
  assert.ok(job.browserSessionId);

  const status = manager.getJobStatus(jobId);
  assert.equal(status.code, 'NAVIGATION_FAILED');
  assert.ok(status.artifacts?.failure_json);
  assert.ok(status.artifacts?.trace_jsonl);
});

test('BrowserHarnessJobManager API: timeout — OBSERVATION_TIMEOUT + artefacts partiels', async () => {
  const artifactRoot = await tempArtifactRoot();
  const manager = new BrowserHarnessJobManager({
    workerRunner: runBrowserObserveWorker,
    artifactRoot,
  });

  const { jobId } = manager.startJob({
    url: 'http://127.0.0.1:5173/',
    browserId: 'browser-api-timeout',
    traceId: 'trace-api-timeout',
    browserLauncher: mockLauncher(
      createMockPage({
        queryComputedStyles: () => new Promise((resolve) => setTimeout(() => resolve([]), 200)),
      }),
    ),
    extractTimeoutMs: 30,
  });

  const job = await waitForJob(manager, jobId, { timeoutMs: 5000 });
  assert.equal(job.status, 'FAILED');
  assert.equal(job.refusalCode, 'OBSERVATION_TIMEOUT');
  assert.ok(job.browserSessionId);

  const status = manager.getJobStatus(jobId);
  assert.equal(status.code, 'OBSERVATION_TIMEOUT');
  assert.ok(status.artifacts?.trace_jsonl);
  assert.ok(status.artifacts?.failure_json);

  const failure = JSON.parse(await fs.readFile(status.artifacts.failure_json, 'utf8'));
  assert.equal(failure.code, 'OBSERVATION_TIMEOUT');
  assert.equal(failure.browser_session_id, job.browserSessionId);
});

test('BrowserHarnessJobManager API: double observation — sessions isolées', async () => {
  const artifactRoot = await tempArtifactRoot();
  const manager = new BrowserHarnessJobManager({
    workerRunner: runBrowserObserveWorker,
    artifactRoot,
  });

  const first = manager.startJob({
    url: 'http://127.0.0.1:5173/a',
    browserId: 'browser-api-double',
    traceId: 'trace-api-double-1',
    browserLauncher: mockLauncher(createMockPage()),
  });

  const second = manager.startJob({
    url: 'http://127.0.0.1:5173/b',
    browserId: 'browser-api-double',
    traceId: 'trace-api-double-2',
    browserLauncher: mockLauncher(createMockPage()),
  });

  assert.notEqual(first.jobId, second.jobId);

  const [jobA, jobB] = await Promise.all([
    waitForJob(manager, first.jobId),
    waitForJob(manager, second.jobId),
  ]);

  assert.equal(jobA.status, 'SUCCESS');
  assert.equal(jobB.status, 'SUCCESS');
  assert.notEqual(jobA.browserSessionId, jobB.browserSessionId);
  assert.notEqual(jobA.artifacts?.observation_json, jobB.artifacts?.observation_json);
});

test('BrowserHarnessJobManager API: accès refusé si browserId différent', async () => {
  const manager = new BrowserHarnessJobManager({
    workerRunner: async ({ onStep, traceId, jobId }) => {
      onStep?.({ step: 'browser.observe.pack', status: 'ok', trace_id: traceId, job_id: jobId });
      return {
        ok: true,
        trace_id: traceId,
        browser_session_id: 'bsess-access',
        job_id: jobId,
        envelope: { kind: OBSERVATION_ENVELOPE_KIND },
        artifacts: { files: {} },
        events: [],
      };
    },
  });

  const { jobId } = manager.startJob({
    url: 'http://127.0.0.1:5173/',
    browserId: 'owner-browser',
    traceId: 'trace-access',
  });

  await waitForJob(manager, jobId);

  assert.equal(manager.canAccess(jobId, 'owner-browser'), true);
  assert.equal(manager.canAccess(jobId, 'intruder-browser'), false);
});
