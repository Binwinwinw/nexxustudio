import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import runDesignExtractWorker from '../src/services/design-extract/designExtractWorker.js';
import runNexxusDesignWorker, {
  inferDesignObjective,
} from '../src/services/nexxus-design/nexxusDesignWorker.js';
import {
  validateDesignCreateInput,
  validateReferenceDna,
} from '../src/services/nexxus-design/nexxusDesignContract.js';
import { composeDesignFromExtract } from '../src/services/nexxus-design/nexxusDesignComposer.js';
import {
  buildForgeScaffold,
  renderBlueprintMarkdown,
} from '../src/services/nexxus-design/forgeDesignBridge.js';

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
    browser_session_id: `sess-design-${caseDef.id}`,
    html,
    viewport: { width: 1280, height: 720 },
  };
}

async function extractEnvelopeForCase(caseId) {
  const caseDef = MANIFEST.cases.find((entry) => entry.id === caseId);
  assert.ok(caseDef, `case ${caseId} introuvable`);
  const html = await loadFixture(caseDef.fixture);

  const result = await runDesignExtractWorker({
    url: caseDef.url,
    extractionMode: 'hybrid',
    egressPolicy: 'local-only',
    traceId: `trace-extract-${caseId}`,
    browserObservation: buildBrowserObservation(caseDef, html),
    fetchHtml: async () => ({ html, fetched_at: new Date().toISOString() }),
    browserObserveRunner: async () => ({ ok: false }),
  });

  assert.equal(result.ok, true, `extract ${caseId} doit réussir`);
  return result.envelope;
}

async function tempOutputDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'nexxus-design-'));
}

test('validateDesignCreateInput: refuse sans brief ni ADN', () => {
  const result = validateDesignCreateInput({});
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, 'QUERY_OR_DNA_REQUIRED');
});

test('validateReferenceDna: refuse envelope invalide', () => {
  const result = validateReferenceDna({ kind: 'wrong', version: '1.0.0' });
  assert.equal(result.ok, false);
});

test('inferDesignObjective: déduit landing depuis URL golden', () => {
  assert.equal(
    inferDesignObjective({ source: { url: 'http://127.0.0.1:5173/landing' } }),
    'landing',
  );
  assert.equal(
    inferDesignObjective({ source: { url: 'http://127.0.0.1:5173/dashboard' } }),
    'cockpit',
  );
});

test('composeDesignFromExtract: produit blueprint et composants', async () => {
  const extract = await extractEnvelopeForCase('landing');
  const composed = composeDesignFromExtract(extract, {
    objective: 'landing',
    query: 'Landing La Citadelle',
  });

  assert.ok(composed.blueprint.layout);
  assert.ok(composed.components.length >= 2);
  assert.ok(composed.page_structure.length >= 3);
  assert.equal(composed.assembly.scaffold_template, 'react-vite');
});

test('buildForgeScaffold: génère blueprint.md et App.jsx', async () => {
  const extract = await extractEnvelopeForCase('components');
  const composed = composeDesignFromExtract(extract, { objective: 'design_system' });
  const forge = buildForgeScaffold(
    {
      version: '1.0.0',
      kind: 'nexxus.design.create_result',
      ...composed,
    },
    { projectTitle: 'Nexxus Components' },
  );

  assert.ok(forge.files['blueprint.md']);
  assert.ok(forge.files['src/App.jsx']);
  assert.ok(forge.files['components-manifest.json']);
  assert.match(forge.files['src/App.jsx'], /function App/);
  assert.match(renderBlueprintMarkdown(composed), /Composants UI/);
});

const GOLDEN_FORGE_CASES = [
  { id: 'landing', expectedObjective: 'landing', appPattern: /La Citadelle/ },
  { id: 'components', expectedObjective: 'design_system', appPattern: /Composants UI/ },
  { id: 'dashboard', expectedObjective: 'cockpit', appPattern: /Dashboard/ },
];

for (const caseSpec of GOLDEN_FORGE_CASES) {
  test(`pipeline D1+D2 golden: ${caseSpec.id} — create_result + artefacts Forge`, async () => {
    const extract = await extractEnvelopeForCase(caseSpec.id);
    const outputDir = await tempOutputDir();
    const steps = [];

    const result = await runNexxusDesignWorker({
      query: `Forge UI ${caseSpec.id}`,
      referenceDna: extract,
      traceId: `trace-design-${caseSpec.id}`,
      outputDir,
      onStep: (entry) => steps.push(entry.step),
    });

    assert.equal(result.ok, true);
    assert.equal(result.envelope.kind, 'nexxus.design.create_result');
    assert.equal(result.envelope.objective, caseSpec.expectedObjective);
    assert.ok(result.envelope.blueprint);
    assert.ok(result.envelope.components.length >= 2);
    assert.ok(result.envelope.tokens.colors.primary);
    assert.ok(result.forgeScaffold?.files['src/App.jsx']);
    assert.match(result.forgeScaffold.files['src/App.jsx'], caseSpec.appPattern);

    assert.ok(steps.includes('design.create.validate'));
    assert.ok(steps.includes('design.create.compose'));
    assert.ok(steps.includes('design.create.forge'));

    const blueprintPath = path.join(outputDir, 'blueprint.md');
    const appPath = path.join(outputDir, 'src', 'App.jsx');
    const manifestPath = path.join(outputDir, 'components-manifest.json');

    await fs.access(blueprintPath);
    await fs.access(appPath);
    await fs.access(manifestPath);

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    assert.equal(manifest.scaffold_template, 'react-vite');
    assert.equal(manifest.objective, caseSpec.expectedObjective);
  });
}

test('runNexxusDesignWorker: fail-closed ADN palette insuffisante', async () => {
  const result = await runNexxusDesignWorker({
    query: 'test',
    referenceDna: {
      version: '2.0.0',
      kind: 'nexxus.design.extract_result',
      tokens: { colors: { distinct_count: 1 } },
      quality_gate: { merge_ok: false, score: 40 },
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations?.some((entry) => entry.code === 'REFERENCE_DNA_INSUFFICIENT'));
});
