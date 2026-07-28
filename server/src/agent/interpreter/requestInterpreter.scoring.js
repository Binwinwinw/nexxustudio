export const REQUEST_INTERPRETER_SCORING_RULE = "request_interpreter_composite_score_v1";

export const SCORE_WEIGHTS = Object.freeze({
  lexical: 0.35,
  semantic: 0.35,
  pattern: 0.2,
  context: 0.1,
});

export const CONFIDENCE_THRESHOLDS = Object.freeze({
  direct: 0.8,
  review: 0.6,
});

export function clampScore(value = 0) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function computeCompositeScore(input = {}) {
  const lexical = clampScore(input.lexical);
  const semantic = clampScore(input.semantic);
  const pattern = clampScore(input.pattern);
  const context = clampScore(input.context);

  const rawScore =
    lexical * SCORE_WEIGHTS.lexical +
      semantic * SCORE_WEIGHTS.semantic +
      pattern * SCORE_WEIGHTS.pattern +
      context * SCORE_WEIGHTS.context;

  return clampScore(Number(rawScore.toFixed(6)));
}

export function resolveClarificationNeed(confidence = 0, riskFlags = []) {
  if (confidence < CONFIDENCE_THRESHOLDS.review) return true;
  if (
    confidence < CONFIDENCE_THRESHOLDS.direct &&
    riskFlags.some((flag) => flag.endsWith("_confusion") || flag.endsWith("_ambiguity"))
  ) {
    return true;
  }
  return false;
}
