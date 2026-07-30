/**
 * Continuité du fil recherche web — corrections date / mémorisation sans re-hash du message courant.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { deriveGuidedProductWebSearchQuery } from "../guidedProductRecommendationPolicy.js";
import {
  extractWebSearchTopic,
  hasExplicitWebProductRecoSignals,
  isExplicitWebSearchRequest,
  isWebSearchThreadActive,
} from "../explicitWebSearchRequestPolicy.js";

const POLITE_INFORM_RE = /\bje me permets?\b|\bje me permettrais\b/i;

const USER_CALENDAR_DATE_RE =
  /\b(?:nous sommes|on est)\s+(?:aujourd['']?hui\s+)?(?:le\s+)?\d{1,2}\s+(?:janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+\d{4}\b/i;

const THREAD_MEMORY_UPDATE_RE =
  /\b(?:memoris|mettre a jour|mettre à jour|resultats obtenus|résultats obtenus|te mettre a jour|te mettre à jour|mémoris)\b/i;

/**
 * Message méta : date système / mémoriser les résultats — pas un nouveau sujet web.
 * @param {string} query
 * @returns {boolean}
 */
export function isWebSearchThreadMaintenanceMessage(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return false;
  if (isExplicitWebSearchRequest(raw)) return false;

  const q = normalizeFamiliarityQuery(query);
  const hasPolite = POLITE_INFORM_RE.test(raw);
  const hasMemory = THREAD_MEMORY_UPDATE_RE.test(q);
  const hasCalendarDate =
    USER_CALENDAR_DATE_RE.test(raw) ||
    USER_CALENDAR_DATE_RE.test(q) ||
    (/\baujourd['']?hui\b/i.test(q) &&
      /\b20\d{2}\b/.test(q) &&
      /\b(?:nous sommes|on est|informer|informe)\b/i.test(q));

  if (hasCalendarDate && (hasMemory || hasPolite)) return true;
  if (hasPolite && hasMemory) return true;
  return false;
}

/**
 * Dernière requête utilisateur avec demande web explicite dans l'historique.
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {string|null}
 */
export function findLastExplicitWebSearchUserMessage(history = []) {
  const list = Array.isArray(history) ? history : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const msg = list[i];
    if (msg?.role !== "user") continue;
    const content = String(msg?.content || "").trim();
    if (content && isExplicitWebSearchRequest(content)) return content;
  }
  return null;
}

/**
 * Requête web dérivée du fil (pas du message méta courant).
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {string|null}
 */
export function deriveWebQueryFromActiveThread(history = []) {
  const prior = findLastExplicitWebSearchUserMessage(history);
  if (!prior) return null;

  if (
    hasExplicitWebProductRecoSignals(prior) ||
    /\b(?:carte\s+graphique|gpu|geforce|radeon|rtx|rx\s*\d)\b/i.test(prior)
  ) {
    return deriveGuidedProductWebSearchQuery(prior);
  }

  const topic = extractWebSearchTopic(prior);
  return topic || null;
}

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {{
 *   path: string,
 *   kind: string,
 *   deferToLlm?: boolean,
 *   deferToFullPipeline?: boolean,
 *   preferWebResearch?: boolean,
 *   informationSeeking?: boolean,
 *   webQuery?: string,
 *   forcedIntentContractId?: string,
 *   reflectiveHint?: string,
 *   step?: string,
 * }|null}
 */
export function resolveWebSearchThreadMaintenanceShortCircuit(query = "", options = {}) {
  const history = options.history || [];
  if (!isWebSearchThreadMaintenanceMessage(query)) return null;
  if (!isWebSearchThreadActive(history)) return null;

  const priorUser = findLastExplicitWebSearchUserMessage(history);
  const webQuery = deriveWebQueryFromActiveThread(history);
  if (!webQuery) return null;

  const productThread =
    priorUser &&
    (hasExplicitWebProductRecoSignals(priorUser) ||
      /\b(?:carte\s+graphique|gpu|rtx|rx)\b/i.test(priorUser));

  return {
    path: "information_seeking_full_pipeline",
    kind: "web_help_thread_maintenance",
    reply: null,
    deferToLlm: true,
    deferToFullPipeline: true,
    preferWebResearch: true,
    informationSeeking: true,
    webQuery,
    forcedIntentContractId: productThread
      ? "GUIDED_PRODUCT_RECOMMENDATION"
      : "FACTUAL_RESEARCH",
    reflectiveHint: [
      "CONTINUITÉ FIL RECHERCHE WEB — DATE / MÉMOIRE :",
      "- L'utilisateur précise la date du jour ou demande de mémoriser les résultats du fil en cours.",
      "- INTERDIT : traiter « je me permets/permettrais » comme sujet ou requête web.",
      "- Reprendre le fil de recherche du tour précédent ; ancrer prix/specs sur la date indiquée.",
      `- Requête web du fil : ${webQuery}`,
    ].join("\n"),
    step: "🔍 Recherche web — continuité fil (date / mémorisation)...",
  };
}
