/**
 * Seuils ajustables — HTML_PROJECT_DELIVERY_V1 (calibration terrain).
 * Modifier ici après observation des faux positifs / faux négatifs.
 */
export const HTML_PROJECT_THRESHOLDS = Object.freeze({
  /** Longueur max (normalisée) pour classify clarify_then_build si aucun signal structure/sujet/profil */
  veryVagueMaxLength: 45,
  /** Longueur max pour ambiguïté partielle (profil generic sans layout explicite) */
  partiallyAmbiguousMaxLength: 70,
  /** Nombre min de questions pour basculer en clarify_then_build (ambiguïté partielle) */
  minClarifyQuestionsForPartial: 2,
  /** Longueur min requête pour détecter un projet HTML sans mot-clé création explicite */
  htmlDetectMinLength: 35,
  /** Longueur min requête brute pour isHtmlProjectDeliverable */
  htmlDetectMinQueryLength: 12,
});
