import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImpeccableJobManager } from '../src/services/impeccable/ImpeccableJobManager.js';
import runImpeccableWorker from '../src/services/impeccable/impeccableWorker.js';
import runDesignPipelineWorker from '../src/services/design-pipeline/designPipelineWorker.js';
import runDesignExtractWorker from '../src/services/design-extract/designExtractWorker.js';
import { getImpeccableCockpitSnapshot } from '../src/services/impeccable/impeccableCockpitSnapshot.js';
import { validateDesignAuditInput } from '../src/services/impeccable/impeccableContract.js';

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
  return fs.mkdtemp(path.join(os.tmpdir(), 'impeccable-api-'));
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
    style_summary: { samples_count: styles.length },
    browser_session_id: `sess-impeccable-api-${caseDef.id}`,
    html,
    viewport: { width: 1280, height: 720 },
  };
}

async function runPipelineLanding(artifactRoot) {
  const caseDef = MANIFEST.cases.find((entry) => entry.id === 'landing');
  const html = await loadFixture(caseDef.fixture);
  const jobId = `job-design-pipeline-test-${Date.now()}`;
  const outputDir = path.join(artifactRoot, jobId);

  const result = await runDesignPipelineWorker({
    url: caseDef.url,
    query: 'Pipeline audit landing',
    objective: 'landing',
    extractionMode: 'hybrid',
    outputDir,
    traceId: 'trace-pipeline-for-impeccable',
    browserObservation: buildBrowserObservation(caseDef, html),
    fetchHtml: async () => ({ html, fetched_at: new Date().toISOString() }),
    browserObserveRunner: async () => ({ ok: false }),
  });

  assert.equal(result.ok, true);
  return { jobId, outputDir };
}

test('ImpeccableJobManager: audit après pipeline D4 (artifactDir)', async () => {
  const artifactRoot = await tempArtifactRoot();
  const { outputDir } = await runPipelineLanding(artifactRoot);

  const manager = new ImpeccableJobManager({
    workerRunner: runImpeccableWorker,
    artifactRoot: await tempArtifactRoot(),
  });

  const sseRes = createMockSseRes();
  const { jobId, traceId } = manager.startJob({
    artifactDir: outputDir,
    query: 'Audit post-pipeline',
    browserId: 'browser-impeccable',
    sessionId: 'session-impeccable',
    traceId: 'trace-impeccable-api',
  });

  manager.subscribe(jobId, '0', sseRes, { browserId: 'browser-impeccable' });

  const job = await waitForJob(manager, jobId);
  assert.ok(['SUCCESS', 'BLOCKED'].includes(job.status));
  assert.ok(job.score_global !== null);

  const sseEvents = parseSseEvents(sseRes.chunks);
  assert.ok(sseEvents.some((event) => event.step === 'impeccable.audit.score'));
  assert.ok(sseEvents.some((event) => event.done === true));
  assert.ok(sseEvents.every((event) => event.trace_id === traceId));

  const snapshot = getImpeccableCockpitSnapshot('session-impeccable');
  assert.equal(snapshot.score_global, job.score_global);

  await fs.access(path.join(manager.artifactRoot, jobId, 'audit-result.json'));
});

test('ImpeccableJobManager: audit visuel enrichi (browser observation)', async () => {
  const artifactRoot = await tempArtifactRoot();
  const { outputDir } = await runPipelineLanding(artifactRoot);
  const caseDef = MANIFEST.cases.find((entry) => entry.id === 'landing');
  const html = await loadFixture(caseDef.fixture);

  const manager = new ImpeccableJobManager({
    workerRunner: runImpeccableWorker,
    artifactRoot: await tempArtifactRoot(),
  });

  const { jobId } = manager.startJob({
    artifactDir: outputDir,
    includeVisualAudit: true,
    browserObservation: buildBrowserObservation(caseDef, html),
    browserId: 'browser-impeccable-visual',
    traceId: 'trace-impeccable-visual',
  });

  const job = await waitForJob(manager, jobId);
  assert.ok(job.status === 'SUCCESS' || job.status === 'BLOCKED');
  assert.ok(
    job.events.some(
      (event) =>
        event.step === 'impeccable.audit.visual' && event.status === 'ok',
    ),
  );
});

test('validateDesignAuditInput: refuse sans cible', () => {
  const result = validateDesignAuditInput({});
  assert.equal(result.ok, false);
});

test('ImpeccableJobManager: contrôle accès', async () => {
  const artifactRoot = await tempArtifactRoot();
  const { outputDir } = await runPipelineLanding(artifactRoot);

  const manager = new ImpeccableJobManager({ workerRunner: runImpeccableWorker });
  const { jobId } = manager.startJob({
    artifactDir: outputDir,
    browserId: 'owner-impeccable',
    traceId: 'trace-access',
  });

  await waitForJob(manager, jobId);
  assert.equal(manager.canAccess(jobId, 'owner-impeccable'), true);
  assert.equal(manager.canAccess(jobId, 'intruder'), false);
});
