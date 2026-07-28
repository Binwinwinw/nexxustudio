/**
 * Utilitaires partagés de normalisation lexicale pour le routage d'intentions et l'analyse de prompt.
 * 
 * Cette centralisation remplace les multiples implémentations isolées (normalizeText, normalizeQuery, etc.)
 * éparpillées dans les policy (codeDeliveryPolicy, responseStylePolicy, intentGuards, etc.).
 */

/**
 * Retire les accents (diacritiques) d'une chaîne de caractères de façon robuste (Unicode-aware).
 */
export function stripDiacritics(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "");
}

/**
 * Normalisation de base pour l'intention : minuscule, sans accents, espaces gérés de base (trim).
 * Remplace l'ancien normalizeIntentText de codeDeliveryPolicy.js.
 */
export function normalizeIntentText(text = "") {
  return stripDiacritics(text)
    .toLowerCase()
    .trim();
}

/**
 * Normalisation plus stricte : minuscule, sans accents, et écrase les espaces multiples en un seul.
 * Remplace l'ancien normalizeText de responseStylePolicy.js et autres intentGuards.
 */
export function normalizeQueryText(text = "") {
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
