#!/usr/bin/env node
/**
 * Gate pre-merge Impeccable (E5) — golden landing doit passer merge_ok ou score documenté.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import runDesignExtractWorker from '../src/services/design-extract/designExtractWorker.js';
import runNexxusDesignWorker from '../src/services/nexxus-design/nexxusDesignWorker.js';
import runImpeccableWorker from '../src/services/impeccable/impeccableWorker.js';
import { IMPECCABLE_MERGE_SCORE_MIN } from '../src/services/impeccable/impeccableContract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '../tests/fixtures/browser-golden');
const MANIFEST = JSON.parse(
  await fs.readFile(
    path.resolve(__dirname, '../tests/golden/browser-harness/golden-manifest.json'),
    'utf8',
  ),
);

async function loadFixture(name) {
  return fs.readFile(path.join(FIXTURE_ROOT, name), 'utf8');
}

const caseDef = MANIFEST.cases.find((entry) => entry.id === 'landing');
const html = await loadFixture(caseDef.fixture);
const styles = caseDef.computed_styles || [];

const extract = await runDesignExtractWorker({
  url: caseDef.url,
  extractionMode: 'hybrid',
  egressPolicy: 'local-only',
  traceId: 'premerge-impeccable-extract',
  browserObservation: {
    computed_styles: styles,
    style_summary: { samples_count: styles.length },
    browser_session_id: 'premerge-impeccable',
    html,
    viewport: { width: 1280, height: 720 },
  },
  fetchHtml: async () => ({ html, fetched_at: new Date().toISOString() }),
  browserObserveRunner: async () => ({ ok: false }),
});

assert.equal(extract.ok, true, 'Extract golden landing requis pour gate Impeccable');

const outputDir = path.join(
  process.cwd(),
  'src/data/impeccable-premerge-gate',
);
await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});

const design = await runNexxusDesignWorker({
  query: 'Premerge gate landing',
  objective: 'landing',
  referenceDna: extract.envelope,
  outputDir,
  traceId: 'premerge-impeccable-design',
});

assert.equal(design.ok, true, 'Design Create golden requis pour gate Impeccable');

const audit = await runImpeccableWorker({
  artifactDir: outputDir,
  traceId: 'premerge-impeccable-audit',
  includeVisualAudit: true,
  browserObservation: {
    computed_styles: styles,
    style_summary: { samples_count: styles.length },
  },
});

assert.equal(audit.ok, true, 'Worker Impeccable doit terminer');
assert.ok(
  audit.envelope.score_global >= IMPECCABLE_MERGE_SCORE_MIN,
  `Score ${audit.envelope.score_global} < seuil ${IMPECCABLE_MERGE_SCORE_MIN}`,
);
assert.equal(
  audit.envelope.merge_ok,
  true,
  `merge_ok=false — blockers: ${JSON.stringify(audit.envelope.blockers)}`,
);

console.log(
  `✅ Gate Impeccable OK — score=${audit.envelope.score_global} merge_ok=true`,
);
