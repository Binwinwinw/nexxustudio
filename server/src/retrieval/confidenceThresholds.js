/**
 * Seuils de confiance RAG — reject / proceed / traçabilité sources.
 */

export const CONFIDENCE_THRESHOLDS = {
  MINIMUM_CONFIDENCE: 0.7,
  HIGH_CONFIDENCE: 0.85,
  SOURCE_RELEVANCE_MIN: 0.6,
  RERANK_SCORE_MIN: 0.5,
};

const DEFAULT_RRF_K = 60;

/**
 * Normalise un score RRF brut vers [0, 1] via le maximum théorique (rang 1 fusionné).
 * @param {number} rawScore
 * @param {object} [config]
 */
export function normalizeHybridScore(rawScore, config = {}) {
  const k = config.rrfK ?? DEFAULT_RRF_K;
  const vectorWeight = config.vectorWeight ?? 0.7;
  const bm25Weight = config.bm25Weight ?? 0.3;
  const theoreticalMax = vectorWeight / (k + 1) + bm25Weight / (k + 1);

  if (!rawScore || theoreticalMax <= 0) return 0;
  return Math.min(1, rawScore / theoreticalMax);
}

/**
 * @param {object} evaluation
 * @param {number} evaluation.score
 */
export function evaluateConfidence(score, config = {}) {
  const threshold =
    config.threshold ?? CONFIDENCE_THRESHOLDS.MINIMUM_CONFIDENCE;
  const numericScore = Number(score) || 0;

  if (numericScore < threshold) {
    return {
      score: numericScore,
      level: 'reject',
      threshold,
      action: 'fallback_epistemic',
      reason: `confidence_below_threshold (${numericScore.toFixed(2)} < ${threshold})`,
    };
  }

  if (numericScore >= CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE) {
    return {
      score: numericScore,
      level: 'high',
      threshold,
      action: 'proceed',
      reason: `high_confidence (${numericScore.toFixed(2)} >= ${CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE})`,
    };
  }

  return {
    score: numericScore,
    level: 'acceptable',
    threshold,
    action: 'proceed',
    reason: `acceptable_confidence (${numericScore.toFixed(2)})`,
  };
}

/**
 * Score combiné pondéré vector / BM25 / rerank (0–1 attendu en entrée).
 */
export function calculateCombinedScore(
  vectorScore,
  bm25Score,
  rerankScore,
  weights = { vector: 0.4, bm25: 0.3, rerank: 0.3 },
) {
  return (
    vectorScore * weights.vector +
    bm25Score * weights.bm25 +
    rerankScore * weights.rerank
  );
}

/**
 * Attache relevance normalisée + chunk pour traçabilité.
 * @param {Array<object>} sources
 */
export function attachSourceRelevance(sources = [], config = {}) {
  if (!Array.isArray(sources) || sources.length === 0) return [];

  const normalized = sources.map((source) =>
    normalizeHybridScore(source.score, config),
  );
  const max = Math.max(...normalized, 1e-9);

  return sources.map((source, index) => ({
    ...source,
    id: source.id || source.metadata?.id || `source-${index}`,
    relevance: max > 0 ? normalized[index] / max : 0,
    chunk: source.chunk ?? source.document ?? '',
  }));
}

/**
 * @param {Array<object>} sources
 */
export function filterSourcesByRelevance(
  sources = [],
  minRelevance = CONFIDENCE_THRESHOLDS.SOURCE_RELEVANCE_MIN,
) {
  return sources.filter((source) => {
    const relevance = source.relevance ?? source.score ?? 0;
    return relevance >= minRelevance;
  });
}

/**
 * Confiance agrégée à partir des candidats rerankés (scores RRF bruts).
 * @param {Array<object>} results
 */
export function computeRetrievalConfidence(results = [], config = {}) {
  if (!Array.isArray(results) || results.length === 0) {
    return evaluateConfidence(0, config);
  }

  const best = results[0];
  const second = results[1];
  const absolute = normalizeHybridScore(best?.score, config);
  const margin =
    second && best.score > 0
      ? (best.score - (second.score || 0)) / best.score
      : 1;
  const combined = Math.min(1, absolute * 0.65 + margin * 0.35);

  return evaluateConfidence(combined, config);
}

/**
 * @param {object} evaluation — sortie evaluateConfidence / computeRetrievalConfidence
 * @param {Array<object>} sources
 * @param {string} query
 */
export function generateConfidenceReport(evaluation, sources = [], query = '') {
  return {
    query,
    confidence: evaluation.score,
    level: evaluation.level,
    action: evaluation.action,
    reason: evaluation.reason,
    sourcesCount: sources.length,
    topSourceRelevance: sources[0]?.relevance ?? 0,
    threshold: evaluation.threshold,
    timestamp: new Date().toISOString(),
  };
}

export default evaluateConfidence;
