/**
 * P4 — Normalisation de requêtes bancales (fillers, répétitions, formes elliptiques).
 */
import { sanitizeQuery, stripTrailingFiller } from "../normalization/querySanitizer.js";

const FILLER_PREFIXES = [
  /^et\s+(?:pour\s+)?/i,
  /^bon\s+/i,
  /^alors\s+/i,
  /^du coup\s+/i,
  /^euh+\s+/i,
  /^je sais pas comment dire mais\s+/i,
  /^tu vois\s+/i,
  /^en fait\s+/i,
];

const FILLER_SUFFIXES = [
  /\s+ou\s+pas$/i,
  /\s+ou\s+non$/i,
  /\s+stp$/i,
  /\s+svp$/i,
  /\s+merci$/i,
];

/** Marqueurs de requête fragile nécessitant interprétation. */
export const FRAGILE_REQUEST_MARKERS =
  /\b(ou pas|ou non|je sais pas comment dire|tu vois|et pour|ce truc|truc avec|ca tu peux|cela tu peux)\b/;

export function normalizeRequest(raw = "") {
  const display = String(raw || "").trim();
  let stripped = stripTrailingFiller(display);

  for (const pattern of FILLER_PREFIXES) {
    stripped = stripped.replace(pattern, "");
  }
  for (const pattern of FILLER_SUFFIXES) {
    stripped = stripped.replace(pattern, "");
  }

  stripped = stripped.replace(/\?+/g, "?").replace(/\s+/g, " ").trim();

  return {
    raw: display,
    stripped,
    normalized: sanitizeQuery(stripped),
  };
}

/**
 * Reformule implicitement une requête fragile en forme canonique exploitable.
 * @returns {{ canonical: string|null, reason: string|null }}
 */
export function canonicalizeRequest(normalized = "", stripped = "") {
  const q = normalized || sanitizeQuery(stripped);
  if (!q) return { canonical: null, reason: null };

  let match = q.match(/^(?:et\s+)?(?:pour\s+)?(.+?)\s+tu\s+connais(?:\s+ou\s+pas)?$/);
  if (match?.[1] && match[1].length >= 2 && !/\b(ca|cela|ce truc)\b/.test(match[1])) {
    return { canonical: `tu connais ${match[1].trim()}`, reason: "fragile_et_pour_connais" };
  }

  match = q.match(/^tu\s+connais\s+ou\s+pas\s+(?:le|la|les|l\s)?(.+)$/);
  if (match?.[1] && match[1].length >= 2) {
    return { canonical: `tu connais ${match[1].trim()}`, reason: "fragile_connais_ou_pas" };
  }

  match = q.match(/^et\s+pour\s+(.+?)\s+tu\s+peux\s+(?:me\s+)?(?:dire|expliquer)/);
  if (match?.[1] && match[1].length >= 2 && !/\b(ca|cela)\b/.test(match[1])) {
    return { canonical: `tu connais ${match[1].trim()}`, reason: "fragile_et_pour_dire" };
  }

  return { canonical: null, reason: null };
}

export function needsRequestInterpretation(normalized = "") {
  if (!normalized) return false;
  return FRAGILE_REQUEST_MARKERS.test(normalized);
}
