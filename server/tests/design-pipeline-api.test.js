import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDesignPipelineInput } from '../src/services/design-pipeline/designPipelineContract.js';
import { DesignPipelineJobManager } from '../src/services/design-pipeline/DesignPipelineJobManager.js';
import runDesignPipelineWorker from '../src/services/design-pipeline/designPipelineWorker.js';
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
  return fs.mkdtemp(path.join(os.tmpdir(), 'design-pipeline-api-'));
}

async function waitForJob(manager, jobId, { timeoutMs = 8000 } = {}) {
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
    browser_session_id: `sess-pipeline-${caseDef.id}`,
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
    traceId: `trace-pipeline-extract-${caseId}`,
    browserObservation: buildBrowserObservation(caseDef, html),
    fetchHtml: async () => ({ html, fetched_at: new Date().toISOString() }),
    browserObserveRunner: async () => ({ ok: false }),
  });
  assert.equal(result.ok, true);
  return result.envelope;
}

function pipelineDepsForCase(caseId) {
  return async () => {
    const caseDef = MANIFEST.cases.find((entry) => entry.id === caseId);
    const html = await loadFixture(caseDef.fixture);
    return {
      browserObservation: buildBrowserObservation(caseDef, html),
      fetchHtml: async () => ({ html, fetched_at: new Date().toISOString() }),
      browserObserveRunner: async () => ({ ok: false }),
    };
  };
}

const GOLDEN_URL_CASES = [
  { id: 'landing', objective: 'landing' },
  { id: 'components', objective: 'design_system' },
  { id: 'dashboard', objective: 'cockpit' },
];

for (const caseSpec of GOLDEN_URL_CASES) {
  test(`DesignPipelineJobManager: chaîne URL → Extract → Design → Forge (${caseSpec.id})`, async () => {
    const artifactRoot = await tempArtifactRoot();
    const deps = await pipelineDepsForCase(caseSpec.id)();
    const caseDef = MANIFEST.cases.find((entry) => entry.id === caseSpec.id);

    const manager = new DesignPipelineJobManager({
      workerRunner: runDesignPipelineWorker,
      artifactRoot,
    });

    const sseRes = createMockSseRes();
    const { jobId, traceId } = manager.startJob({
      url: caseDef.url,
      query: `Pipeline ${caseSpec.id}`,
      objective: caseSpec.objective,
      extractionMode: 'hybrid',
      browserId: `browser-pipeline-${caseSpec.id}`,
      traceId: `trace-pipeline-${caseSpec.id}`,
      ...deps,
    });

    manager.subscribe(jobId, '0', sseRes, {
      browserId: `browser-pipeline-${caseSpec.id}`,
    });

    const job = await waitForJob(manager, jobId);
    assert.equal(job.status, 'SUCCESS', JSON.stringify(job.events?.slice(-3)));
    assert.equal(job.mode, 'url_extract');

    const sseEvents = parseSseEvents(sseRes.chunks);
    assert.ok(sseEvents.some((event) => event.step === 'design.pipeline.extract'));
    assert.ok(sseEvents.some((event) => event.step === 'design.pipeline.design.create'));
    assert.ok(
      sseEvents.some(
        (event) =>
          event.step === 'design.pipeline.forge' ||
          event.step === 'design.create.forge',
      ),
    );
    assert.ok(sseEvents.some((event) => event.step === 'design.pipeline.done'));
    assert.ok(sseEvents.some((event) => event.done === true));
    assert.ok(sseEvents.every((event) => event.trace_id === traceId));

    const jobDir = path.join(artifactRoot, jobId);
    await fs.access(path.join(jobDir, 'extract-envelope.json'));
    await fs.access(path.join(jobDir, 'design-create.json'));
    await fs.access(path.join(jobDir, 'blueprint.md'));
    await fs.access(path.join(jobDir, 'src', 'App.jsx'));
    await fs.access(path.join(jobDir, 'components-manifest.json'));
    await fs.access(path.join(jobDir, 'forge-scaffold.json'));
    await fs.access(path.join(jobDir, 'pipeline-trace.jsonl'));
  });
}

test('DesignPipelineJobManager: mode direct referenceDna (sans Extract)', async () => {
  const artifactRoot = await tempArtifactRoot();
  const referenceDna = await extractEnvelopeForCase('landing');

  const manager = new DesignPipelineJobManager({
    workerRunner: runDesignPipelineWorker,
    artifactRoot,
  });

  const { jobId } = manager.startJob({
    query: 'Landing direct DNA',
    objective: 'landing',
    referenceDna,
    browserId: 'browser-pipeline-direct',
    traceId: 'trace-pipeline-direct',
  });

  const job = await waitForJob(manager, jobId);
  assert.equal(job.status, 'SUCCESS');
  assert.equal(job.mode, 'dna_direct');

  const jobDir = path.join(artifactRoot, jobId);
  await fs.access(path.join(jobDir, 'extract-envelope.json'));
  await fs.access(path.join(jobDir, 'blueprint.md'));
});

test('validateDesignPipelineInput: URL + referenceDna ambigu refusé', () => {
  const result = validateDesignPipelineInput({
    url: 'http://127.0.0.1:5173/landing',
    referenceDna: { kind: 'nexxus.design.extract_result', version: '2.0.0' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, 'PIPELINE_INPUT_AMBIGUOUS');
});

test('DesignPipelineJobManager: referenceDna insuffisant — FAILED fail-closed', async () => {
  const artifactRoot = await tempArtifactRoot();
  const manager = new DesignPipelineJobManager({
    workerRunner: runDesignPipelineWorker,
    artifactRoot,
  });

  const { jobId } = manager.startJob({
    query: 'invalid dna pipeline',
    referenceDna: {
      version: '2.0.0',
      kind: 'nexxus.design.extract_result',
      tokens: { colors: { distinct_count: 1 } },
    },
    browserId: 'browser-pipeline-invalid',
    traceId: 'trace-pipeline-invalid',
  });

  const job = await waitForJob(manager, jobId);
  assert.equal(job.status, 'FAILED');
  assert.ok(job.refusalCode === 'REFERENCE_DNA_INSUFFICIENT');
  assert.ok(job.artifacts?.failure_json);
});

test('DesignPipelineJobManager: abort en cours de pipeline', async () => {
  const artifactRoot = await tempArtifactRoot();
  const referenceDna = await extractEnvelopeForCase('landing');

  const manager = new DesignPipelineJobManager({
    workerRunner: async ({ onStep, traceId, isAborted }) => {
      onStep?.({ step: 'design.pipeline.validate', status: 'running', trace_id: traceId });
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (isAborted?.()) return { ok: false, aborted: true, trace_id: traceId };
      onStep?.({ step: 'design.pipeline.extract', status: 'running', trace_id: traceId });
      await new Promise((resolve) => setTimeout(resolve, 400));
      return runDesignPipelineWorker({
        referenceDna,
        query: 'abort',
        traceId,
        onStep,
        isAborted,
      });
    },
    artifactRoot,
  });

  const { jobId } = manager.startJob({
    query: 'abort pipeline',
    referenceDna,
    browserId: 'browser-pipeline-abort',
    traceId: 'trace-pipeline-abort',
  });

  await new Promise((resolve) => setTimeout(resolve, 80));
  manager.abortJob(jobId);

  const job = await waitForJob(manager, jobId);
  assert.equal(job.status, 'ABORTED');
});

test('DesignPipelineJobManager: contrôle accès browserId', async () => {
  const referenceDna = await extractEnvelopeForCase('landing');
  const manager = new DesignPipelineJobManager({
    workerRunner: runDesignPipelineWorker,
  });

  const { jobId } = manager.startJob({
    query: 'access',
    referenceDna,
    browserId: 'owner-pipeline',
    traceId: 'trace-pipeline-access',
  });

  await waitForJob(manager, jobId);
  assert.equal(manager.canAccess(jobId, 'owner-pipeline'), true);
  assert.equal(manager.canAccess(jobId, 'intruder-pipeline'), false);
});
