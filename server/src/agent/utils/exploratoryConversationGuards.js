/**
 * Exploration conversationnelle — thème sans mandat livrable explicite.
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";

const EXPLORATORY_SHELL_RE =
  /\b(?:on part vers|on va vers|partons vers|direction|on discute de|on parle de|on explore|j aimerais qu on|je voudrais qu on|on pourrait parler|si on parlait|allons vers)\b/i;

const RESEARCH_DELEGATION_RE =
  /\b(?:va faire|vas faire|va chercher|vas chercher|lance|effectue|fais des).{0,40}(?:recherche|recherches|investigation|veille|documente)\b/i;

const DELIVERABLE_ACTION_RE =
  /\b(?:fais|faire|crée|cree|creer|génère|genere|prepare|prépare|organise|produis|produire|rédige|redige|construis|élabore|elabore|planifie|livre|fournis|écris|ecris)\b/i;

const DELIVERABLE_FORMAT_RE =
  /\b(?:plan|rapport|document|pdf|slides|présentation|presentation|cours structuré|cours structure|programme|livrable|artefact)\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isExploratoryTopicIntent(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 10) return false;
  if (RESEARCH_DELEGATION_RE.test(q)) return false;
  if (DELIVERABLE_ACTION_RE.test(q) && DELIVERABLE_FORMAT_RE.test(q)) return false;
  if (DELIVERABLE_ACTION_RE.test(q)) return false;
  return EXPLORATORY_SHELL_RE.test(q);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractExploratoryTopic(query = "") {
  const q = normalizeFamiliarityQuery(query);
  const patterns = [
    /\b(?:on part vers|partons vers|on va vers|allons vers|direction)\s+(.+)/i,
    /\b(?:on discute de|on parle de|on explore|si on parlait de?)\s+(.+)/i,
    /\b(?:j aimerais qu on|je voudrais qu on)\s+(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\?+$/, "").trim().slice(0, 120) || null;
    }
  }
  return null;
}
