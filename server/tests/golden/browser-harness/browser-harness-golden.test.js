import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import runBrowserObserveWorker from '../../../src/services/browser-harness/browserHarnessWorker.js';
import { BrowserHarnessJobManager } from '../../../src/services/browser-harness/BrowserHarnessJobManager.js';
import runDesignExtractWorker from '../../../src/services/design-extract/designExtractWorker.js';
import {
  normalizeObservationGolden,
  normalizeExtractGolden,
  normalizeRefusalGolden,
  goldenPath,
  readGolden,
  writeGolden,
  assertGoldenEqual,
} from './goldenHarnessUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '../../fixtures/browser-golden');
const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === '1';

const manifest = JSON.parse(
  await fs.readFile(path.join(__dirname, 'golden-manifest.json'), 'utf8'),
);

function createMockPage(html, overrides = {}) {
  const state = { url: 'about:blank' };
  return {
    url: () => state.url,
    isClosed: () => false,
    close: async () => {},
    goto: async (targetUrl) => {
      state.url = targetUrl;
      const status = overrides.gotoStatus ?? 200;
      return { status: () => status };
    },
    title: async () => overrides.title || 'Golden Mock',
    content: async () => html,
    queryComputedStyles:
      overrides.queryComputedStyles ??
      (async () => overrides.computed_styles || []),
  };
}

function mockLauncher(html, overrides = {}) {
  return async () => ({
    ok: true,
    browser: { isConnected: () => true, close: async () => {} },
    page: createMockPage(html, overrides),
    engine: 'mock/chromium',
  });
}

async function loadFixture(name) {
  return fs.readFile(path.join(FIXTURE_ROOT, name), 'utf8');
}

async function tempArtifactRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'browser-golden-'));
}

function buildBrowserObservation(caseDef, html) {
  const styles = caseDef.computed_styles || [];
  return {
    computed_styles: styles,
    style_summary: {
      samples_count: styles.length,
      unique_colors: new Set(
        styles.flatMap((sample) => [
          sample.styles?.color,
          sample.styles?.['background-color'],
        ].filter(Boolean)),
      ).size,
    },
    uncertainties: [],
    browser_session_id: `sess-golden-${caseDef.id}`,
    html,
    viewport: { width: 1280, height: 720 },
  };
}

async function runObserveGolden(caseDef, html) {
  const artifactRoot = await tempArtifactRoot();
  const result = await runBrowserObserveWorker({
    url: caseDef.url,
    traceId: `trace-golden-${caseDef.id}`,
    jobId: `job-golden-${caseDef.id}`,
    outputDir: path.join(artifactRoot, caseDef.id),
    browserLauncher: mockLauncher(html, { computed_styles: caseDef.computed_styles }),
  });
  return result;
}

async function runHybridGolden(caseDef, html) {
  const observation = buildBrowserObservation(caseDef, html);
  return runDesignExtractWorker({
    url: caseDef.url,
    extractionMode: 'hybrid',
    egressPolicy: 'local-only',
    traceId: `trace-golden-hybrid-${caseDef.id}`,
    browserObservation: observation,
    fetchHtml: async () => ({ html, fetched_at: new Date().toISOString() }),
    browserObserveRunner: async () => ({ ok: false, code: 'SHOULD_NOT_RUN' }),
  });
}

async function assertOrUpdateGolden(caseId, kind, actual, normalizer) {
  const baselinePath = goldenPath(caseId, kind, '00');
  const replayPath = goldenPath(caseId, kind, '01');
  const normalized = normalizer(actual);

  if (UPDATE_GOLDEN) {
    await writeGolden(baselinePath, normalized);
    await writeGolden(replayPath, normalized);
    return normalized;
  }

  const baseline = await readGolden(baselinePath);
  assertGoldenEqual(normalized, baseline, `${caseId}.${kind} vs .00`);
  return normalized;
}

async function waitForJob(manager, jobId) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const job = manager.getJob(jobId);
    if (job && job.status !== 'RUNNING') return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return manager.getJob(jobId);
}

for (const caseDef of manifest.cases) {
  test(`golden observe: ${caseDef.id} — envelope .00/.01`, async () => {
    const html = await loadFixture(caseDef.fixture);
    const resultA = await runObserveGolden(caseDef, html);
    const resultB = await runObserveGolden(caseDef, html);

    assert.equal(resultA.ok, true, `${caseDef.id} observe must succeed`);
    assert.equal(resultB.ok, true, `${caseDef.id} observe replay must succeed`);
    assert.ok(resultA.artifacts?.files?.observation_json);
    assert.ok(resultA.artifacts?.files?.computed_styles_json);
    assert.ok(resultA.artifacts?.files?.trace_jsonl);

    const normalizedA = await assertOrUpdateGolden(
      caseDef.id,
      'observe',
      resultA.envelope,
      normalizeObservationGolden,
    );
    const normalizedB = normalizeObservationGolden(resultB.envelope);
    assertGoldenEqual(normalizedB, normalizedA, `${caseDef.id}.observe replay in-memory`);
  });

  test(`golden hybrid: ${caseDef.id} — tokens et confidence .00/.01`, async () => {
    const html = await loadFixture(caseDef.fixture);
    const resultA = await runHybridGolden(caseDef, html);
    const resultB = await runHybridGolden(caseDef, html);

    assert.equal(resultA.ok, true, `${caseDef.id} hybrid must succeed`);
    assert.equal(resultB.ok, true, `${caseDef.id} hybrid replay must succeed`);
    assert.equal(resultA.envelope.source.extraction_mode, 'hybrid');
    assert.ok(resultA.envelope.quality_gate?.merge_ok);

    const normalizedA = await assertOrUpdateGolden(
      caseDef.id,
      'hybrid',
      resultA.envelope,
      normalizeExtractGolden,
    );
    const normalizedB = normalizeExtractGolden(resultB.envelope);
    assertGoldenEqual(normalizedB, normalizedA, `${caseDef.id}.hybrid replay in-memory`);

    if (caseDef.id === 'landing') {
      assert.ok(normalizedA.layout_signatures.some((entry) => entry.confidence >= 0.7));
    }
    if (caseDef.id === 'components') {
      assert.ok(normalizedA.tokens.colors.distinct_count >= 3);
    }
    if (caseDef.id === 'dashboard') {
      assert.ok(normalizedA.signals.computed_nodes >= 3);
      assert.ok(normalizedA.tokens.colors.distinct_count >= 5);
    }
  });
}

test('golden refusal: notfound — NAVIGATION_FAILED + artefacts partiels', async () => {
  const artifactRoot = await tempArtifactRoot();
  const manager = new BrowserHarnessJobManager({
    workerRunner: runBrowserObserveWorker,
    artifactRoot,
  });

  const { jobId } = manager.startJob({
    url: 'http://127.0.0.1:5173/notfound',
    browserId: 'browser-golden-notfound',
    traceId: 'trace-golden-notfound',
    browserLauncher: mockLauncher('<html></html>', { gotoStatus: 404 }),
  });

  const job = await waitForJob(manager, jobId);
  assert.equal(job.status, 'FAILED');
  assert.equal(job.refusalCode, 'NAVIGATION_FAILED');

  const payload = {
    code: job.refusalCode,
    browser_session_id: job.browserSessionId,
    artifacts: job.artifacts,
  };
  await assertOrUpdateGolden('notfound', 'refusal', payload, normalizeRefusalGolden);
});

test('golden refusal: timeout — OBSERVATION_TIMEOUT + artefacts partiels', async () => {
  const artifactRoot = await tempArtifactRoot();
  const html = await loadFixture('landing.html');

  const workerResult = await runBrowserObserveWorker({
    url: 'http://127.0.0.1:5173/landing',
    traceId: 'trace-golden-timeout',
    jobId: 'job-golden-timeout',
    outputDir: path.join(artifactRoot, 'timeout'),
    extractTimeoutMs: 30,
    browserLauncher: mockLauncher(html, {
      queryComputedStyles: () => new Promise((resolve) => setTimeout(() => resolve([]), 200)),
    }),
  });

  assert.equal(workerResult.ok, false);
  assert.equal(workerResult.refusal?.code, 'OBSERVATION_TIMEOUT');
  assert.ok(workerResult.browser_session_id);

  const { writePartialBrowserFailureArtifacts } = await import(
    '../../../src/services/browser-harness/browserTraceArtifacts.js'
  );

  const partial = await writePartialBrowserFailureArtifacts(path.join(artifactRoot, 'timeout-fail'), {
    events: workerResult.events,
    refusal: workerResult.refusal,
    trace_id: 'trace-golden-timeout',
    job_id: 'job-golden-timeout',
    browser_session_id: workerResult.browser_session_id,
  });

  const payload = {
    code: workerResult.refusal.code,
    browser_session_id: workerResult.browser_session_id,
    artifacts: partial.files,
  };

  await assertOrUpdateGolden('timeout', 'refusal', payload, normalizeRefusalGolden);
});

test('golden refusal: contradiction — HYBRID_SIGNAL_CONTRADICTORY', async () => {
  const html = await loadFixture('landing.html');
  const contradictoryStyles = [
    {
      selector: 'body',
      tag: 'body',
      classes: [],
      styles: { color: 'rgb(255, 0, 0)', 'background-color': 'rgb(0, 255, 0)' },
    },
    {
      selector: 'main',
      tag: 'main',
      classes: [],
      styles: { color: 'rgb(0, 0, 255)', 'background-color': 'rgb(255, 255, 0)' },
    },
  ];

  const result = await runDesignExtractWorker({
    url: 'http://127.0.0.1:5173/landing',
    extractionMode: 'hybrid',
    egressPolicy: 'local-only',
    traceId: 'trace-golden-contradiction',
    browserObservation: {
      computed_styles: contradictoryStyles,
      style_summary: { samples_count: 2, unique_colors: 4 },
      uncertainties: [],
      browser_session_id: 'sess-golden-contradiction',
      html,
      viewport: { width: 1280, height: 720 },
    },
    fetchHtml: async () => ({ html, fetched_at: new Date().toISOString() }),
    browserObserveRunner: async () => ({ ok: false }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.refusal?.code, 'HYBRID_SIGNAL_CONTRADICTORY');

  await assertOrUpdateGolden(
    'contradiction',
    'refusal',
    { code: result.refusal.code, refusal: result.refusal },
    normalizeRefusalGolden,
  );
});

test('golden replay: double observation — sessions isolées sans fuite', async () => {
  const artifactRoot = await tempArtifactRoot();
  const manager = new BrowserHarnessJobManager({
    workerRunner: runBrowserObserveWorker,
    artifactRoot,
  });

  const html = await loadFixture('landing.html');
  const caseDef = manifest.cases.find((entry) => entry.id === 'landing');

  const first = manager.startJob({
    url: caseDef.url,
    browserId: 'browser-golden-replay',
    traceId: 'trace-golden-replay-1',
    browserLauncher: mockLauncher(html, { computed_styles: caseDef.computed_styles }),
  });

  const second = manager.startJob({
    url: caseDef.url,
    browserId: 'browser-golden-replay',
    traceId: 'trace-golden-replay-2',
    browserLauncher: mockLauncher(html, { computed_styles: caseDef.computed_styles }),
  });

  const [jobA, jobB] = await Promise.all([
    waitForJob(manager, first.jobId),
    waitForJob(manager, second.jobId),
  ]);

  assert.equal(jobA.status, 'SUCCESS');
  assert.equal(jobB.status, 'SUCCESS');
  assert.notEqual(jobA.browserSessionId, jobB.browserSessionId);
  assert.notEqual(jobA.artifacts?.observation_json, jobB.artifacts?.observation_json);

  const normA = normalizeObservationGolden(jobA.envelope || jobA.events.find((e) => e.envelope)?.envelope);
  const normB = normalizeObservationGolden(jobB.envelope || jobB.events.find((e) => e.envelope)?.envelope);

  assertGoldenEqual(normA, normB, 'double observation replay structural parity');
});
