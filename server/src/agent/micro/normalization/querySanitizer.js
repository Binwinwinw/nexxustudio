/* Couche micro — normalisation déterministe des requêtes conversationnelles */
import { normalizeText } from "../../utils/normalizationGuards.js";

/**
 * Sanitize une requête pour classification / matching déterministe.
 * Apostrophes → espaces, accents retirés, casse basse.
 */
export function sanitizeQuery(query = "") {
  return normalizeText(query)
    .toLowerCase()
    .replace(/[?!.]+$/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
