/**
 * Seuils ajustables — JUST_INTENT_DETECTION_V1 (calibration terrain).
 */
export const JUST_INTENT_THRESHOLDS = Object.freeze({
  /** Requête trop courte pour agir sans clarification */
  veryVagueMaxLength: 28,
  /** Requête partiellement ambiguë */
  partiallyAmbiguousMaxLength: 55,
  /** Questions min pour clarify_then_build partiel */
  minClarifyQuestionsForPartial: 2,
  /** Longueur min pour détection code implicite */
  codeDetectMinLength: 35,
});
