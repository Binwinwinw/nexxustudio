import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDesignCreateInput } from '../src/services/nexxus-design/nexxusDesignContract.js';
import { NexxusDesignJobManager } from '../src/services/nexxus-design/NexxusDesignJobManager.js';
import runNexxusDesignWorker from '../src/services/nexxus-design/nexxusDesignWorker.js';
import runDesignExtractWorker from '../src/services/design-extract/designExtractWorker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, 'fixtures/browser-golden');
const MANIFEST = JSON.parse(
  await fs.readFile(
    path.resolve(__dirname, 'golden/browser-harness/golden-manifest.json'),
    'utf8',
  ),
);

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
  return fs.mkdtemp(path.join(os.tmpdir(), 'design-create-api-'));
}

async function waitForJob(manager, jobId, { timeoutMs = 5000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = manager.getJob(jobId);
    if (job && job.status !== 'RUNNING') return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return manager.getJob(jobId);
}

async function loadFixture(name) {
  return fs.readFile(path.join(FIXTURE_ROOT, name), 'utf8');
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
    browser_session_id: `sess-api-${caseDef.id}`,
    html,
    viewport: { width: 1280, height: 720 },
  };
}

async function extractEnvelopeForCase(caseId) {
  const caseDef = MANIFEST.cases.find((entry) => entry.id === caseId);
  const html = await loadFixture(caseDef.fixture);
  const result = await runDesignExtractWorker({
    url: caseDef.url,
    extractionMode: 'hybrid',
    egressPolicy: 'local-only',
    traceId: `trace-api-extract-${caseId}`,
    browserObservation: buildBrowserObservation(caseDef, html),
    fetchHtml: async () => ({ html, fetched_at: new Date().toISOString() }),
    browserObserveRunner: async () => ({ ok: false }),
  });
  assert.equal(result.ok, true);
  return result.envelope;
}

const GOLDEN_CASES = [
  { id: 'landing', objective: 'landing' },
  { id: 'components', objective: 'design_system' },
  { id: 'dashboard', objective: 'cockpit' },
];

for (const caseSpec of GOLDEN_CASES) {
  test(`NexxusDesignJobManager API: job nominal ${caseSpec.id}`, async () => {
    const artifactRoot = await tempArtifactRoot();
    const manager = new NexxusDesignJobManager({
      workerRunner: runNexxusDesignWorker,
      artifactRoot,
    });

    const referenceDna = await extractEnvelopeForCase(caseSpec.id);
    const sseRes = createMockSseRes();

    const { jobId, traceId } = manager.startJob({
      query: `Forge ${caseSpec.id}`,
      objective: caseSpec.objective,
      referenceDna,
      browserId: `browser-create-${caseSpec.id}`,
      traceId: `trace-create-${caseSpec.id}`,
    });

    assert.ok(jobId.startsWith('job-nexxus-create-'));

    manager.subscribe(jobId, '0', sseRes, {
      browserId: `browser-create-${caseSpec.id}`,
    });

    const job = await waitForJob(manager, jobId);
    assert.equal(job.status, 'SUCCESS');
    assert.equal(job.traceId, traceId);
    assert.ok(job.artifacts?.blueprint_md || job.artifacts?.app_jsx);

    const status = manager.getJobStatus(jobId);
    assert.equal(status.objective, caseSpec.objective);
    assert.match(status.stream_url, new RegExp(`/api/design/create/${jobId}/stream`));

    const sseEvents = parseSseEvents(sseRes.chunks);
    assert.ok(sseEvents.some((event) => event.step === 'design.create.forge'));
    assert.ok(sseEvents.some((event) => event.done === true));
    assert.ok(sseEvents.every((event) => event.trace_id === traceId));
    assert.ok(sseEvents.every((event) => event.job_id === jobId));

    await fs.access(path.join(artifactRoot, jobId, 'blueprint.md'));
    await fs.access(path.join(artifactRoot, jobId, 'src', 'App.jsx'));
    await fs.access(path.join(artifactRoot, jobId, 'components-manifest.json'));
  });
}

test('validateDesignCreateInput: referenceDna invalide refusée avant job', () => {
  const result = validateDesignCreateInput({
    query: 'test',
    referenceDna: {
      version: '2.0.0',
      kind: 'nexxus.design.extract_result',
      tokens: { colors: { distinct_count: 1 } },
    },
  });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((entry) => entry.code === 'REFERENCE_DNA_INSUFFICIENT'));
});

test('NexxusDesignJobManager API: referenceDna invalide — FAILED + artefacts partiels', async () => {
  const artifactRoot = await tempArtifactRoot();
  const manager = new NexxusDesignJobManager({
    workerRunner: runNexxusDesignWorker,
    artifactRoot,
  });

  const { jobId } = manager.startJob({
    query: 'test invalid dna',
    referenceDna: {
      version: '2.0.0',
      kind: 'nexxus.design.extract_result',
      tokens: { colors: { distinct_count: 1 } },
      quality_gate: { merge_ok: false, score: 40 },
    },
    browserId: 'browser-create-invalid',
    traceId: 'trace-create-invalid',
  });

  const job = await waitForJob(manager, jobId);
  assert.equal(job.status, 'FAILED');
  assert.equal(job.refusalCode, 'REFERENCE_DNA_INSUFFICIENT');
  assert.ok(job.artifacts?.failure_json);
  assert.ok(job.artifacts?.trace_jsonl);
});

test('NexxusDesignJobManager API: abort job en cours', async () => {
  const artifactRoot = await tempArtifactRoot();
  const manager = new NexxusDesignJobManager({
    workerRunner: async ({ onStep, traceId }) => {
      onStep?.({ step: 'design.create.validate', status: 'running', trace_id: traceId });
      await new Promise((resolve) => setTimeout(resolve, 400));
      onStep?.({ step: 'design.create.compose', status: 'running', trace_id: traceId });
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        ok: true,
        envelope: { kind: 'nexxus.design.create_result', objective: 'landing' },
        artifacts: { files: {} },
      };
    },
    artifactRoot,
  });

  const referenceDna = await extractEnvelopeForCase('landing');

  const { jobId } = manager.startJob({
    query: 'abort test',
    referenceDna,
    browserId: 'browser-create-abort',
    traceId: 'trace-create-abort',
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  manager.abortJob(jobId);

  const job = await waitForJob(manager, jobId, { timeoutMs: 2000 });
  assert.equal(job.status, 'ABORTED');
  assert.ok(job.events.some((event) => event.done === true));
});

test('NexxusDesignJobManager API: accès refusé si browserId différent', async () => {
  const manager = new NexxusDesignJobManager({
    workerRunner: async ({ traceId }) => ({
      ok: true,
      trace_id: traceId,
      envelope: { kind: 'nexxus.design.create_result', objective: 'landing' },
      artifacts: { files: { blueprint_md: '/tmp/b.md' } },
    }),
  });

  const referenceDna = await extractEnvelopeForCase('landing');

  const { jobId } = manager.startJob({
    query: 'access test',
    referenceDna,
    browserId: 'owner-browser',
    traceId: 'trace-access',
  });

  await waitForJob(manager, jobId);

  assert.equal(manager.canAccess(jobId, 'owner-browser'), true);
  assert.equal(manager.canAccess(jobId, 'intruder-browser'), false);
});
