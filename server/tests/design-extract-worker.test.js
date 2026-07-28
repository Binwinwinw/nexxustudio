import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDesignExtractEgress } from '../src/services/design-extract/designExtractPolicy.js';
import {
  analyzeDesignHtml,
  buildReproductionPrompt,
} from '../src/services/design-extract/designExtractAnalyzer.js';
import runDesignExtractWorker from '../src/services/design-extract/designExtractWorker.js';
import { DesignExtractJobManager } from '../src/services/design-extract/DesignExtractJobManager.js';
import { validateDesignExtractInput } from '../src/services/design-extract/designExtractContract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = await fs.readFile(
  path.join(__dirname, 'fixtures/design-extract-sample.html'),
  'utf8',
);

test('validateDesignExtractEgress: local-only autorise localhost', () => {
  const result = validateDesignExtractEgress('http://127.0.0.1:5173/', 'local-only');
  assert.equal(result.ok, true);
});

test('validateDesignExtractEgress: local-only bloque domaine public', () => {
  const result = validateDesignExtractEgress('https://example.com', 'local-only');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EGRESS_LOCAL_ONLY');
});

test('validateDesignExtractInput: accepte snapshot HTML inline', () => {
  const result = validateDesignExtractInput({ htmlSnapshot: FIXTURE_HTML });
  assert.equal(result.ok, true);
});

test('analyzeDesignHtml: extrait palette, typo et sections', () => {
  const analysis = analyzeDesignHtml(FIXTURE_HTML, 'http://localhost:5173/');

  assert.ok(analysis.color_samples.length > 0);
  assert.ok(
    analysis.color_samples.some((sample) => sample.value.includes('#0f172a')),
  );
  assert.ok(analysis.dna_dossier.typography.families.length > 0);
  assert.ok(analysis.dna_dossier.layout_sections.some((section) => section.tag === 'header'));
  assert.ok(analysis.dna_dossier.cta_patterns.length > 0);
  assert.ok(analysis.uncertainties.length > 0);
});

test('runDesignExtractWorker: envelope v2 avec clustering', async () => {
  const result = await runDesignExtractWorker({
    htmlSnapshot: FIXTURE_HTML,
    query: 'ADN complet',
    egressPolicy: 'local-only',
    traceId: 'trace-design-v2',
  });

  assert.equal(result.ok, true);
  assert.equal(result.envelope.version, '2.0.0');
  assert.ok(result.envelope.tokens.colors.primary);
  assert.ok(result.envelope.tokens.colors.distinct_count >= 3);
  assert.ok(result.envelope.layout_signatures.length > 0);
  assert.ok(result.envelope.quality_gate);
  assert.equal(result.envelope.quality_gate.merge_ok, true);
});

test('runDesignExtractWorker: fail-closed palette insuffisante', async () => {
  const minimal = await fs.readFile(
    path.join(__dirname, 'fixtures/design-extract-minimal.html'),
    'utf8',
  );
  const result = await runDesignExtractWorker({
    htmlSnapshot: minimal,
    egressPolicy: 'local-only',
    traceId: 'trace-design-fail',
  });

  assert.equal(result.ok, false);
  assert.equal(result.refusal?.code, 'INSUFFICIENT_PALETTE');
});

test('buildReproductionPrompt: contient palette et structure', () => {
  const analysis = analyzeDesignHtml(FIXTURE_HTML);
  const prompt = buildReproductionPrompt(analysis);
  assert.match(prompt, /Palette dominante/i);
  assert.match(prompt, /Refonte fidèle/i);
});

test('runDesignExtractWorker: pipeline snapshot sans réseau', async () => {
  const steps = [];
  const result = await runDesignExtractWorker({
    htmlSnapshot: FIXTURE_HTML,
    query: 'ADN complet',
    egressPolicy: 'local-only',
    traceId: 'trace-design-extract-test',
    onStep: (entry) => steps.push(entry.step),
  });

  assert.equal(result.ok, true);
  assert.equal(result.envelope.kind, 'nexxus.design.extract_result');
  assert.ok(result.envelope.tokens.colors.primary || result.envelope.tokens.colors.distinct_count > 0);
  assert.ok(result.envelope.reproduction_prompt);
  assert.ok(steps.includes('design.extract.cluster'));
});

test('DesignExtractJobManager: job mocké termine en SUCCESS', async () => {
  const manager = new DesignExtractJobManager({
    workerRunner: async ({ htmlSnapshot, onStep, traceId }) => {
      onStep?.({ step: 'design.extract.analyze', status: 'ok' });
      return {
        ok: true,
        trace_id: traceId,
        envelope: {
          kind: 'nexxus.design.extract_result',
          reproduction_prompt: 'Refonte fidèle test.',
        },
        artifacts: { files: { json: '/tmp/design-dna.json' } },
      };
    },
  });

  const { jobId, traceId } = manager.startJob({
    htmlSnapshot: FIXTURE_HTML,
    browserId: 'browser-design-test',
    traceId: 'trace-design-job',
  });

  await new Promise((resolve) => setTimeout(resolve, 60));

  const job = manager.getJob(jobId);
  assert.ok(job);
  assert.equal(job.status, 'SUCCESS');
  assert.equal(job.traceId, traceId);
  assert.ok(job.events.some((event) => event.done === true));
});
