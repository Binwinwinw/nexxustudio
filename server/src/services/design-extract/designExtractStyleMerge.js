/**
 * Fusion hybride Design Extract v2 + Browser Harness — computed prioritaire.
 */
import { toDesignExtractColorSamples } from '../browser-harness/browserStyleSampler.js';
import { clusterColors, parseColorToRgb, rgbToHex, bucketRgb } from './designExtractColorCluster.js';
import { clusterTypography } from './designExtractTypographyCluster.js';

export const HYBRID_MIN_COMPUTED_SAMPLES = 2;
export const HYBRID_MIN_COMPUTED_COLORS = 2;

function colorBucketKey(value = '') {
  const rgb = parseColorToRgb(value);
  if (!rgb) return null;
  return rgbToHex(bucketRgb(rgb));
}

/**
 * @param {object} observation — sortie browser observePage / envelope browser
 */
export function validateHybridBrowserSignal(observation = {}) {
  const blockers = [];
  const styles = observation.computed_styles || [];
  const summary = observation.style_summary || {};

  if (styles.length < HYBRID_MIN_COMPUTED_SAMPLES) {
    blockers.push({
      code: 'HYBRID_SIGNAL_PARTIAL',
      message: `Signal browser insuffisant (${styles.length} échantillon(s) calculé(s)).`,
    });
  }

  const colorCount = summary.unique_colors ?? new Set(
    toDesignExtractColorSamples(styles).map((sample) => sample.value),
  ).size;

  if (colorCount < HYBRID_MIN_COMPUTED_COLORS) {
    blockers.push({
      code: 'HYBRID_PALETTE_PARTIAL',
      message: 'Palette browser insuffisante pour fusion hybride.',
    });
  }

  return { ok: blockers.length === 0, blockers };
}

/**
 * @param {Array} computed_styles
 */
export function browserStylesToTypographySamples(computed_styles = []) {
  const samples = [];
  for (const sample of computed_styles) {
    const styles = sample.styles || {};
    const family = styles['font-family'];
    if (!family) continue;
    samples.push({
      family,
      size: styles['font-size'] || null,
      hint: sample.hint || 'computed',
    });
  }
  return samples;
}

/**
 * @param {Array} layoutSignatures
 * @param {Array} computed_styles
 */
export function boostLayoutSignatures(layoutSignatures = [], computed_styles = []) {
  const classHints = computed_styles
    .flatMap((sample) => sample.classes || [])
    .join(' ')
    .toLowerCase();

  return layoutSignatures.map((entry) => {
    let confidence = entry.confidence || 0.5;
    if (entry.pattern === 'hero-first' && /hero/.test(classHints)) {
      confidence = Math.min(0.98, confidence + 0.08);
    }
    if (entry.pattern === 'card-grid' && /card/.test(classHints)) {
      confidence = Math.min(0.98, confidence + 0.06);
    }
    if (entry.pattern === 'header+main+footer') {
      confidence = Math.min(0.98, confidence + 0.04);
    }
    return { ...entry, confidence: Number(confidence.toFixed(2)) };
  });
}

/**
 * Détecte contradiction palette static vs browser (fail-closed si totale).
 * @param {object} staticColors
 * @param {object} browserColors
 */
export function detectHybridColorContradiction(staticColors = {}, browserColors = {}) {
  const staticPrimary = colorBucketKey(staticColors.primary);
  const browserPrimary = colorBucketKey(browserColors.primary);

  if (!staticPrimary || !browserPrimary) {
    return { contradictory: false, uncertainties: [] };
  }

  if (staticPrimary === browserPrimary) {
    return { contradictory: false, uncertainties: [] };
  }

  const staticRanked = new Set((staticColors.palette_ranked || []).map((entry) => entry.hex));
  const browserRanked = new Set((browserColors.palette_ranked || []).map((entry) => entry.hex));
  let overlap = 0;
  for (const hex of staticRanked) {
    if (browserRanked.has(hex)) overlap += 1;
  }

  if (overlap === 0 && staticRanked.size >= 3 && browserRanked.size >= 2) {
    return {
      contradictory: true,
      uncertainties: [
        'Contradiction palette static vs computed — aucun chevauchement couleur.',
      ],
    };
  }

  return {
    contradictory: false,
    uncertainties: [
      `Palette static (${staticPrimary}) vs computed (${browserPrimary}) — computed prioritaire.`,
    ],
  };
}

/**
 * @param {object} params
 * @param {object} params.staticAnalysis
 * @param {object} params.staticPacked
 * @param {object} params.browserObservation
 */
export function mergeHybridExtract({
  staticAnalysis = {},
  staticPacked = {},
  browserObservation = {},
} = {}) {
  const computed = browserObservation.computed_styles || [];
  const browserColorSamples = toDesignExtractColorSamples(computed).map((sample) => ({
    ...sample,
    weight: 2,
  }));
  const staticColorSamples = (staticAnalysis.color_samples || []).map((sample) => ({
    ...sample,
    weight: 1,
  }));

  const mergedColorSamples = [];
  for (const sample of [...browserColorSamples, ...staticColorSamples]) {
    for (let i = 0; i < (sample.weight || 1); i += 1) {
      mergedColorSamples.push({ value: sample.value, hint: sample.hint });
    }
  }

  const mergedTypoSamples = [
    ...browserStylesToTypographySamples(computed),
    ...(staticAnalysis.typography_samples || []),
  ];

  const colors = clusterColors(mergedColorSamples);
  const browserOnlyColors = clusterColors(
    browserColorSamples.map((sample) => ({ value: sample.value, hint: sample.hint })),
  );
  const typography = clusterTypography(mergedTypoSamples);
  const layout_signatures = boostLayoutSignatures(
    staticPacked.layout_signatures || [],
    computed,
  );

  const contradiction = detectHybridColorContradiction(
    staticPacked.tokens?.colors || {},
    browserOnlyColors,
  );

  const uncertainties = [
    ...(staticAnalysis.uncertainties || []),
    ...(browserObservation.uncertainties || []),
    'Fusion hybrid — styles getComputedStyle prioritaires sur HTML statique.',
    ...contradiction.uncertainties,
  ];

  return {
    ok: !contradiction.contradictory,
    refusal: contradiction.contradictory
      ? {
          code: 'HYBRID_SIGNAL_CONTRADICTORY',
          message: contradiction.uncertainties[0],
        }
      : null,
    tokens: {
      ...(staticPacked.tokens || {}),
      colors,
      typography,
    },
    layout_signatures,
    signals: {
      ...(staticPacked.signals || {}),
      palette: colors.distinct_count,
      typography: typography.distinct_families,
      layout_signatures: layout_signatures.length,
      computed_nodes: computed.length,
      static_nodes: staticAnalysis.color_samples?.length || 0,
    },
    uncertainties,
    browser_session_id: browserObservation.browser_session_id || null,
  };
}

export default {
  HYBRID_MIN_COMPUTED_SAMPLES,
  HYBRID_MIN_COMPUTED_COLORS,
  validateHybridBrowserSignal,
  browserStylesToTypographySamples,
  boostLayoutSignatures,
  detectHybridColorContradiction,
  mergeHybridExtract,
};
