import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import runDesignExtractWorker from '../src/services/design-extract/designExtractWorker.js';
import runNexxusDesignWorker from '../src/services/nexxus-design/nexxusDesignWorker.js';
import runImpeccableWorker from '../src/services/impeccable/impeccableWorker.js';
import { scoreImpeccableArtifacts, contrastRatio } from '../src/services/impeccable/impeccableScorer.js';
import { buildImpeccableAuditEnvelope } from '../src/services/impeccable/impeccableContract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, 'fixtures/browser-golden');
const MANIFEST = JSON.parse(
  await fs.readFile(
    path.resolve(__dirname, 'golden/browser-harness/golden-manifest.json'),
    'utf8',
  ),
);

async function loadFixture(name) {
  return fs.readFile(path.join(FIXTURE_ROOT, name), 'utf8');
}

function buildBrowserObservation(caseDef, html) {
  const styles = caseDef.computed_styles || [];
  return {
    computed_styles: styles,
    style_summary: { samples_count: styles.length },
    browser_session_id: `sess-impeccable-${caseDef.id}`,
    html,
    viewport: { width: 1280, height: 720 },
  };
}

async function buildGoldenForgeArtifacts(caseId = 'landing') {
  const caseDef = MANIFEST.cases.find((entry) => entry.id === caseId);
  const html = await loadFixture(caseDef.fixture);
  const extract = await runDesignExtractWorker({
    url: caseDef.url,
    extractionMode: 'hybrid',
    egressPolicy: 'local-only',
    traceId: `trace-impeccable-extract-${caseId}`,
    browserObservation: buildBrowserObservation(caseDef, html),
    fetchHtml: async () => ({ html, fetched_at: new Date().toISOString() }),
    browserObserveRunner: async () => ({ ok: false }),
  });
  assert.equal(extract.ok, true);

  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'impeccable-forge-'));
  const design = await runNexxusDesignWorker({
    query: `Audit ${caseId}`,
    objective: 'landing',
    referenceDna: extract.envelope,
    outputDir,
    traceId: `trace-impeccable-design-${caseId}`,
  });
  assert.equal(design.ok, true);
  return { outputDir, extract, design };
}

test('contrastRatio: calcule ratio WCAG', () => {
  const ratio = contrastRatio('#101828', '#f8f8ff');
  assert.ok(ratio > 10);
});

test('scoreImpeccableArtifacts: produit merge_ok et checklist', async () => {
  const { design, extract } = await buildGoldenForgeArtifacts('landing');
  const scored = scoreImpeccableArtifacts({
    createEnvelope: design.envelope,
    extractEnvelope: extract.envelope,
    appJsx: design.forgeScaffold?.files?.['src/App.jsx'] || '',
    blueprintMd: design.forgeScaffold?.files?.['blueprint.md'] || '',
  });
  assert.ok(scored.score_global >= 50);
  assert.ok(Array.isArray(scored.checklist_pre_merge));
  assert.equal(typeof scored.merge_ok, 'boolean');
});

test('runImpeccableWorker: audit artefacts pipeline golden landing', async () => {
  const { outputDir } = await buildGoldenForgeArtifacts('landing');
  const result = await runImpeccableWorker({
    artifactDir: outputDir,
    outputDir,
    traceId: 'trace-impeccable-worker',
    includeVisualAudit: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.envelope.kind, 'nexxus.design.audit_result');
  assert.ok(typeof result.merge_ok === 'boolean');
  await fs.access(path.join(outputDir, 'audit-result.json'));
});

test('runImpeccableWorker: fail-closed sans design-create', async () => {
  const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'impeccable-empty-'));
  const result = await runImpeccableWorker({ artifactDir: emptyDir, traceId: 'trace-empty' });
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, 'CREATE_ENVELOPE_MISSING');
});

test('buildImpeccableAuditEnvelope: merge_ok dérivé du score', () => {
  const envelope = buildImpeccableAuditEnvelope({
    score_global: 80,
    issues: [],
    blockers: [],
    checklist_pre_merge: [],
  });
  assert.equal(envelope.merge_ok, true);
});
