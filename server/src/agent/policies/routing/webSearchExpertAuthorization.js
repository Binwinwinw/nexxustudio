/**
 * Lot A — autorisation expert_web_search.
 * BM25 / embeddings seuls ne suffisent jamais.
 * Pas un 2e NLU : réutilise isExplicitWebSearchRequest + contrats déjà posés.
 */
import { isExplicitWebSearchRequest } from "./explicitWebSearchRequestPolicy.js";
import {
  resolveIntentContract,
  shouldSkipWebSearchForIntent,
} from "../../config/intentContractRegistry.js";

export const WEB_SEARCH_EXPERT_KEY = "expert_web_search";
export const WEB_SEARCH_EXPERT_AUTHORIZATION_RULE =
  "web_search_expert_authorization_v1";

/**
 * @param {string|null|undefined} key
 * @returns {boolean}
 */
export function isForcedWebSearchExpertKey(key) {
  const n = String(key || "")
    .trim()
    .toLowerCase();
  if (!n) return false;
  return n === WEB_SEARCH_EXPERT_KEY || n.endsWith(`:${WEB_SEARCH_EXPERT_KEY}`);
}

/**
 * Contrat web déjà posé : budget web sur le contrat résolu, ou preferWebResearch.
 * skipWebSearch === false seul (CONVERSATION_STANDARD, DIRECT_EXPLANATION) ne suffit pas.
 * @param {string} query
 * @param {object} [packet]
 * @param {{ preferWebResearch?: boolean }} [options]
 * @returns {boolean}
 */
export function isWebContractAlreadyPosed(query = "", packet = {}, options = {}) {
  if (options.preferWebResearch === true) return true;
  const { contract } = resolveIntentContract(query, packet);
  return Number(contract?.routing?.webSearchMaxSources) > 0;
}

/**
 * @param {string} query
 * @param {object} [packet]
 * @param {{ forcedExpertKey?: string|null, preferWebResearch?: boolean }} [options]
 * @returns {boolean}
 */
export function isWebSearchExpertAuthorized(
  query = "",
  packet = {},
  options = {},
) {
  if (isForcedWebSearchExpertKey(options.forcedExpertKey)) return true;
  if (isExplicitWebSearchRequest(query)) return true;
  if (shouldSkipWebSearchForIntent(query, packet)) return false;
  const { contract } = resolveIntentContract(query, packet);
  if (contract?.routing?.skipWebSearch !== false) return false;
  return isWebContractAlreadyPosed(query, packet, options);
}

/**
 * Barrière de sélection : retire expert_web_search si non autorisé.
 * @param {Array} matches
 * @param {string} query
 * @param {object} [packet]
 * @param {{ forcedExpertKey?: string|null, preferWebResearch?: boolean }} [options]
 * @returns {Array}
 */
export function filterUnauthorizedWebExpertMatches(
  matches,
  query = "",
  packet = {},
  options = {},
) {
  const list = Array.isArray(matches) ? matches : [];
  if (isWebSearchExpertAuthorized(query, packet, options)) return list;
  return list.filter(
    (m) => String(m?.expert?.key || "") !== WEB_SEARCH_EXPERT_KEY,
  );
}
