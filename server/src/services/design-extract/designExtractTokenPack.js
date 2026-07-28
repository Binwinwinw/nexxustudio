/**
 * Packaging tokens v2 — agrège clustering depuis analyse brute.
 */
import { clusterColors } from './designExtractColorCluster.js';
import { clusterTypography } from './designExtractTypographyCluster.js';
import { detectLayoutSignatures } from './designExtractLayoutSignatures.js';

function topFrequency(items = [], limit = 8) {
  const counts = new Map();
  for (const item of items) {
    const key = String(item).trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

/**
 * @param {object} analysis — sortie analyzeDesignHtml enrichie
 */
export function packDesignExtractV2(analysis = {}) {
  const colorCluster = clusterColors(analysis.color_samples || []);
  const typographyCluster = clusterTypography(analysis.typography_samples || []);
  const layout_signatures = detectLayoutSignatures(analysis.dna_dossier || {});

  const radiusRanked = analysis.raw_tokens?.radius || [];
  const spacingRanked = analysis.dna_dossier?.spacing_rhythm || [];
  const spacingValues = spacingRanked.map((entry) => entry.value);

  const tokens = {
    colors: colorCluster,
    typography: typographyCluster,
    spacing: {
      scale_px: spacingValues
        .map((value) => parseInt(String(value).replace(/[^\d]/g, ''), 10))
        .filter((value) => !Number.isNaN(value)),
      dominant_gap: spacingValues[0] || null,
      raw: spacingValues.slice(0, 8),
    },
    radius: {
      values: radiusRanked.map((entry) => entry.value || entry),
      dominant: radiusRanked[0]?.value || null,
    },
    shadows: (analysis.raw_tokens?.shadows || []).slice(0, 4).map((entry) => ({
      value: entry.value || entry,
      frequency: entry.count || 1,
    })),
  };

  return {
    tokens,
    layout_signatures,
    signals: {
      ...analysis.signals,
      palette: colorCluster.distinct_count,
      typography: typographyCluster.distinct_families,
      layout_signatures: layout_signatures.length,
      computed_nodes: 0,
    },
  };
}

export default { packDesignExtractV2 };
