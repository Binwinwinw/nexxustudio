/* Couche micro — normalisation déterministe des requêtes conversationnelles */
import { normalizeText } from "../../utils/parsing-normalization/normalizationGuards.js";

/**
 * Typo orale « qu'st » / « quest ce qu » → « qu est ».
 * Après apostrophe → espace, « qu'st » devient « qu st ».
 * @param {string} q
 */
export function repairSpokenQuEst(q = "") {
  return String(q || "")
    .replace(/\bqu\s+st\b/g, "qu est")
    .replace(/\bquest\s+ce\s+qu/g, "qu est ce qu");
}

/**
 * Sanitize une requête pour classification / matching déterministe.
 * Apostrophes → espaces, accents retirés, casse basse.
 */
export function sanitizeQuery(query = "") {
  return repairSpokenQuEst(
    normalizeText(query)
      .toLowerCase()
      .replace(/[?!.]+$/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );
}

export function countWords(query = "") {
  return sanitizeQuery(query).split(/\s+/).filter(Boolean).length;
}

export function stripTrailingFiller(text = "") {
  return String(text || "")
    .replace(/\b(exactement|stp|st|svp|merci)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
