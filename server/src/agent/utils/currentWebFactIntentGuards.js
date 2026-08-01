/**
 * current_web_fact — garde-fous transverses (lot #38).
 * Web uniquement quand la valeur change dans le temps + fraîcheur explicite.
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { hasDocumentSynthesisShell } from "../policies/document/index.js";

export const CURRENT_WEB_FACT_RULE = "current_web_fact_v1";

export const CURRENT_WEB_FACT_TYPES = {
  WEATHER: "weather",
  TRAFFIC: "traffic",
  SCHEDULE: "schedule",
  RATE: "rate",
};

export const CURRENT_WEB_FACT_TIME_SCOPES = {
  NOW: "now",
  TODAY: "today",
};

const FRESHNESS_SCOPE_RE =
  /\b(?:maintenant|actuellement|en ce moment|aujourd['']?hui|ce matin|ce soir|à l['']?instant|a l['']?instant|right now|currently|today)\b/i;

const NARRATIVE_PAST_RE =
  /\b(?:hier|avant[- ]?hier|la semaine derniere|la semaine dernière|l an dernier|l'année dernière|il y avait|on avait|j avais|j'avais|nous avions|c etait|cetait|c'était|autrefois)\b/i;

const PEDAGOGY_SOFT_BREADTH_RE =
  /\b(?:parle(?:r|-)?moi\s+de|en\s+général|en\s+general|l['']?\s*essentiel|globalement|dans\s+les\s+grandes\s+lignes)\b/i;

/** Mécanisme / définition — pas une valeur actuelle. */
const MECHANISM_EXPLAIN_RE =
  /\b(?:c['']est quoi|c est quoi|qu['']est[- ]ce qu|qu est ce qu|définition|definition|explique(?:r|-)?moi\s+(?:ce qu(?:['']|\s+)est|le mécanisme|le principe|comment fonctionne|pourquoi)|comment\s+(?:fonctionne|marche|éviter|eviter|se calcule|se forme)|pourquoi\s+(?:le|la|les|un|une)\s+(?:taux|trafic|change))\b/i;

const HOW_TO_PROCEDURE_RE =
  /\b(?:comment\s+(?:éviter|eviter|contourner|réduire|reduire|prévenir|prevenir)|how to avoid|étape par étape|etape par etape|pas a pas|pas à pas)\b/i;

const STABLE_ENCYCLOPEDIC_RE =
  /\b(?:capitale de|date de|qui a inventé|qui a cree|qui a créé|en quelle année|en quelle annee)\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasCurrentWebFactFreshnessScope(query = "") {
  return FRESHNESS_SCOPE_RE.test(normalizeFamiliarityQuery(query));
}

/**
 * Demande d'explication du mécanisme plutôt qu'une valeur actuelle.
 * @param {string} query
 * @returns {boolean}
 */
export function isCurrentWebFactMechanismExplanation(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;
  if (MECHANISM_EXPLAIN_RE.test(q)) return true;
  if (HOW_TO_PROCEDURE_RE.test(q)) return true;
  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isCurrentWebFactGloballyExcluded(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return true;
  if (hasDocumentSynthesisShell(query)) return true;
  if (NARRATIVE_PAST_RE.test(q)) return true;
  if (PEDAGOGY_SOFT_BREADTH_RE.test(q)) return true;
  if (isCurrentWebFactMechanismExplanation(query)) return true;
  if (STABLE_ENCYCLOPEDIC_RE.test(q)) return true;
  return false;
}

/**
 * @param {string} query
 * @returns {"now"|"today"|null}
 */
export function extractCurrentWebFactTimeScope(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return null;
  if (/\b(?:aujourd['']?hui|ce matin|ce soir|today)\b/.test(q)) {
    return CURRENT_WEB_FACT_TIME_SCOPES.TODAY;
  }
  if (FRESHNESS_SCOPE_RE.test(q)) {
    return CURRENT_WEB_FACT_TIME_SCOPES.NOW;
  }
  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function requiresCurrentWebFactFreshness(query = "") {
  return Boolean(extractCurrentWebFactTimeScope(query));
}
