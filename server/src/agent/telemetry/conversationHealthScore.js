/** Seuils bloquants minimaux — gate locale v1 */
export const QUALITY_GATE_THRESHOLDS = {
  minScore: 85,
  maxNoVisibleTokens: 0,
  maxFallbackRatePct: 1,
};

/**
 * Score santé conversationnelle 0-100 (simple, stable, reproductible).
 * @param {object} today - Métriques journalières (snapshot.health.today)
 */
export function computeHealthScore(today = {}) {
  const noVisible = today.noVisibleTokens ?? 0;
  const fallbackRate = today.fallbackRatePct ?? 0;
  const streamErrors = today.streamErrorCount ?? today.streamErrors ?? 0;

  let score = 100;

  if (noVisible > 0) {
    score -= Math.min(50, noVisible * 25);
  }

  score -= Math.min(30, fallbackRate * 15);

  if (streamErrors > 0) {
    score -= Math.min(40, streamErrors * 20);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Évalue les seuils bloquants du quality gate.
 * @param {object} metrics - Métriques today (noVisibleTokens, fallbackRatePct, …)
 * @param {object} [options]
 * @param {object} [options.thresholds] - Surcharge des seuils par défaut
 */
export function evaluateQualityGate(metrics = {}, options = {}) {
  const thresholds = { ...QUALITY_GATE_THRESHOLDS, ...options.thresholds };
  const score = computeHealthScore(metrics);
  const failures = [];

  const noVisible = metrics.noVisibleTokens ?? 0;
  const fallbackRate = metrics.fallbackRatePct ?? 0;

  if (noVisible > thresholds.maxNoVisibleTokens) {
    failures.push({
      rule: "no_visible_tokens",
      value: noVisible,
      max: thresholds.maxNoVisibleTokens,
      message: `noVisibleTokens=${noVisible} > ${thresholds.maxNoVisibleTokens}`,
    });
  }

  if (fallbackRate >= thresholds.maxFallbackRatePct) {
    failures.push({
      rule: "fallback_rate",
      value: fallbackRate,
      max: thresholds.maxFallbackRatePct,
      message: `fallbackRatePct=${fallbackRate} >= ${thresholds.maxFallbackRatePct}`,
    });
  }

  if (score < thresholds.minScore) {
    failures.push({
      rule: "health_score",
      value: score,
      min: thresholds.minScore,
      message: `healthScore=${score} < ${thresholds.minScore}`,
    });
  }

  return {
    pass: failures.length === 0,
    score,
    failures,
    thresholds,
  };
}
