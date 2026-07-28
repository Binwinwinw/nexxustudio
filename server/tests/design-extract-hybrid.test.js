import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateDesignExtractInput,
} from '../src/services/design-extract/designExtractContract.js';
import { analyzeDesignHtml } from '../src/services/design-extract/designExtractAnalyzer.js';
import { packDesignExtractV2 } from '../src/services/design-extract/designExtractTokenPack.js';
import runDesignExtractWorker from '../src/services/design-extract/designExtractWorker.js';
import {
  validateHybridBrowserSignal,
  mergeHybridExtract,
  detectHybridColorContradiction,
  boostLayoutSignatures,
} from '../src/services/design-extract/designExtractStyleMerge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = await fs.readFile(
  path.join(__dirname, 'fixtures/design-extract-sample.html'),
  'utf8',
);

const MOCK_BROWSER_OBSERVATION = {
  computed_styles: [
    {
      selector: '.btn-primary',
      tag: 'button',
      classes: ['btn-primary'],
      hint: 'cta',
      styles: {
        color: 'rgb(255, 255, 255)',
        'background-color': 'rgb(99, 102, 241)',
        'font-family': 'Inter, sans-serif',
        'font-size': '16px',
      },
    },
    {
      selector: 'body',
      tag: 'body',
      classes: [],
      hint: 'surface',
      styles: {
        color: 'rgb(15, 23, 42)',
        'background-color': 'rgb(248, 250, 252)',
      },
    },
  ],
  style_summary: {
    samples_count: 2,
    unique_colors: 4,
  },
  uncertainties: ['Mock browser observation.'],
  browser_session_id: 'sess-hybrid-test',
  html: FIXTURE_HTML,
  viewport: { width: 1280, height: 720 },
};

function mockBrowserRunner(observation = MOCK_BROWSER_OBSERVATION) {
  return async () => ({
    ok: true,
    browser_session_id: observation.browser_session_id || 'sess-mock',
    observation,
    envelope: {
      computed_styles: observation.computed_styles,
      style_summary: observation.style_summary,
      uncertainties: observation.uncertainties,
      source: { viewport: observation.viewport },
    },
  });
}

test('validateDesignExtractInput: hybrid exige URL et refuse snapshot', () => {
  const missingUrl = validateDesignExtractInput({ extractionMode: 'hybrid' });
  assert.equal(missingUrl.ok, false);

  const withSnapshot = validateDesignExtractInput({
    extractionMode: 'hybrid',
    url: 'http://127.0.0.1:5173/',
    htmlSnapshot: FIXTURE_HTML,
  });
  assert.equal(withSnapshot.ok, false);

  const valid = validateDesignExtractInput({
    extractionMode: 'hybrid',
    url: 'http://127.0.0.1:5173/',
    egressPolicy: 'local-only',
  });
  assert.equal(valid.ok, true);
});

test('validateHybridBrowserSignal: fail-closed si échantillons insuffisants', () => {
  const result = validateHybridBrowserSignal({ computed_styles: [], style_summary: {} });
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((entry) => entry.code === 'HYBRID_SIGNAL_PARTIAL'));
});

test('validateHybridBrowserSignal: accepte signal browser complet', () => {
  const result = validateHybridBrowserSignal(MOCK_BROWSER_OBSERVATION);
  assert.equal(result.ok, true);
});

test('boostLayoutSignatures: renforce hero si classe hero détectée', () => {
  const boosted = boostLayoutSignatures(
    [{ pattern: 'hero-first', confidence: 0.7 }],
    [{ classes: ['hero'], styles: {} }],
  );
  assert.ok(boosted[0].confidence > 0.7);
});

test('detectHybridColorContradiction: refuse chevauchement nul total', () => {
  const staticColors = {
    primary: '#ff0000',
    palette_ranked: [{ hex: '#ff0000' }, { hex: '#00ff00' }, { hex: '#0000ff' }],
  };
  const browserColors = {
    primary: '#111111',
    palette_ranked: [{ hex: '#111111' }, { hex: '#222222' }],
  };
  const result = detectHybridColorContradiction(staticColors, browserColors);
  assert.equal(result.contradictory, true);
});

test('mergeHybridExtract: computed prioritaire et signaux enrichis', () => {
  const rawAnalysis = analyzeDesignHtml(FIXTURE_HTML, 'http://127.0.0.1:5173/');
  const staticPacked = packDesignExtractV2(rawAnalysis);

  const merged = mergeHybridExtract({
    staticAnalysis: rawAnalysis,
    staticPacked,
    browserObservation: MOCK_BROWSER_OBSERVATION,
  });

  assert.equal(merged.ok, true);
  assert.ok(merged.signals.computed_nodes >= 2);
  assert.ok(merged.tokens.colors.distinct_count >= 3);
  assert.ok(
    merged.uncertainties.some((entry) => /Fusion hybrid/i.test(entry)),
  );
  assert.equal(merged.browser_session_id, 'sess-hybrid-test');
});

test('runDesignExtractWorker: mode hybrid produit envelope extraction_mode hybrid', async () => {
  const steps = [];
  const result = await runDesignExtractWorker({
    url: 'http://127.0.0.1:5173/',
    extractionMode: 'hybrid',
    egressPolicy: 'local-only',
    traceId: 'trace-hybrid-envelope',
    fetchHtml: async () => ({
      html: FIXTURE_HTML,
      fetched_at: new Date().toISOString(),
    }),
    browserObserveRunner: mockBrowserRunner(),
    onStep: (entry) => steps.push(entry.step),
  });

  assert.equal(result.ok, true);
  assert.equal(result.envelope.source.extraction_mode, 'hybrid');
  assert.equal(result.envelope.source.browser_session_id, 'sess-hybrid-test');
  assert.ok(result.envelope.signals.computed_nodes >= 2);
  assert.ok(result.envelope.quality_gate.merge_ok);
  assert.ok(steps.includes('design.extract.browser'));
});

test('runDesignExtractWorker: hybrid fail-closed signal browser partiel', async () => {
  const result = await runDesignExtractWorker({
    url: 'http://127.0.0.1:5173/',
    extractionMode: 'hybrid',
    egressPolicy: 'local-only',
    traceId: 'trace-hybrid-partial',
    fetchHtml: async () => ({
      html: FIXTURE_HTML,
      fetched_at: new Date().toISOString(),
    }),
    browserObserveRunner: mockBrowserRunner({
      computed_styles: [],
      style_summary: {},
      uncertainties: [],
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.refusal?.code, 'HYBRID_SIGNAL_PARTIAL');
});

test('runDesignExtractWorker: hybrid fail-closed palette contradictoire', async () => {
  const contradictoryObservation = {
    ...MOCK_BROWSER_OBSERVATION,
    computed_styles: [
      {
        selector: 'body',
        tag: 'body',
        classes: [],
        styles: {
          color: 'rgb(255, 0, 0)',
          'background-color': 'rgb(0, 255, 0)',
        },
      },
      {
        selector: 'main',
        tag: 'main',
        classes: [],
        styles: {
          color: 'rgb(0, 0, 255)',
          'background-color': 'rgb(255, 255, 0)',
        },
      },
    ],
    style_summary: { samples_count: 2, unique_colors: 4 },
  };

  const result = await runDesignExtractWorker({
    url: 'http://127.0.0.1:5173/',
    extractionMode: 'hybrid',
    egressPolicy: 'local-only',
    traceId: 'trace-hybrid-contradiction',
    fetchHtml: async () => ({
      html: FIXTURE_HTML,
      fetched_at: new Date().toISOString(),
    }),
    browserObserveRunner: mockBrowserRunner(contradictoryObservation),
  });

  assert.equal(result.ok, false);
  assert.equal(result.refusal?.code, 'HYBRID_SIGNAL_CONTRADICTORY');
});

test('runDesignExtractWorker: browserObservation injectée évite le runner', async () => {
  let runnerCalled = false;
  const result = await runDesignExtractWorker({
    url: 'http://127.0.0.1:5173/',
    extractionMode: 'hybrid',
    egressPolicy: 'local-only',
    htmlSnapshot: null,
    traceId: 'trace-hybrid-injected',
    browserObservation: MOCK_BROWSER_OBSERVATION,
    fetchHtml: async () => ({
      html: FIXTURE_HTML,
      fetched_at: new Date().toISOString(),
    }),
    browserObserveRunner: async () => {
      runnerCalled = true;
      return { ok: false };
    },
  });

  assert.equal(runnerCalled, false);
  assert.equal(result.ok, true);
  assert.equal(result.envelope.source.extraction_mode, 'hybrid');
});
